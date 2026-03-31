"""
ingest.py — Upsert no Supabase e log de ingestão

Tabelas esperadas no Supabase:
  - normativos
  - normativos_chunks
  - normativos_log
"""

import os
from datetime import datetime, timezone

from supabase import create_client, Client

from pipeline.extract import Documento
from pipeline.process import Chunk


# ── Cliente Supabase ──────────────────────────────────────────────────────────

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar no .env")
    return create_client(url, key)


# ── Verificação de duplicatas ─────────────────────────────────────────────────

def hash_ja_ingerido(sb: Client, hash_conteudo: str) -> str | None:
    """
    Retorna o ID do normativo se o hash já existe no banco.
    Evita reingerir documentos que não mudaram.
    """
    res = (
        sb.table("normativos")
        .select("id")
        .eq("hash_conteudo", hash_conteudo)
        .execute()
    )
    if res.data:
        return res.data[0]["id"]
    return None


# ── Upsert de normativo ───────────────────────────────────────────────────────

def upsert_normativo(sb: Client, doc: Documento) -> str:
    """
    Insere ou atualiza um normativo na tabela `normativos`.
    Retorna o ID do registro.
    """
    agora = datetime.now(timezone.utc).isoformat()

    payload = {
        "tipo": doc.tipo,
        "titulo": doc.titulo,
        "numero": doc.numero,
        "ano": doc.ano,
        "url_origem": doc.url_origem,
        "vigente": doc.vigente,
        "data_publicacao": doc.data_publicacao or None,
        "data_ingestao": agora,
        "hash_conteudo": doc.hash_conteudo,
        "metadados": doc.metadados,
    }

    res = (
        sb.table("normativos")
        .upsert(payload, on_conflict="hash_conteudo")
        .execute()
    )

    return res.data[0]["id"]


# ── Upsert de chunks ──────────────────────────────────────────────────────────

def upsert_chunks(
    sb: Client,
    normativo_id: str,
    chunks_com_embeddings: list[tuple[Chunk, list[float]]],
) -> int:
    """
    Insere os chunks e seus embeddings na tabela `normativos_chunks`.
    Apaga os chunks antigos do mesmo normativo antes de inserir.
    Retorna a quantidade de chunks inseridos.
    """
    # Remove chunks antigos (garante idempotência em caso de reprocessamento)
    sb.table("normativos_chunks").delete().eq("normativo_id", normativo_id).execute()

    lote = []
    for chunk, embedding in chunks_com_embeddings:
        lote.append({
            "normativo_id": normativo_id,
            "sequencia": chunk.sequencia,
            "artigo_ref": chunk.artigo_ref,
            "texto": chunk.texto,
            "tokens": chunk.tokens,
            "embedding": embedding,
        })

    # Supabase tem limite de 500 rows por insert — divide em lotes
    LOTE_MAX = 100
    for i in range(0, len(lote), LOTE_MAX):
        sb.table("normativos_chunks").insert(lote[i : i + LOTE_MAX]).execute()

    return len(lote)


# ── Log de execução ───────────────────────────────────────────────────────────

def registrar_log(
    sb: Client,
    normativo_id: str | None,
    titulo: str,
    status: str,         # sucesso | ignorado | erro
    chunks_gerados: int = 0,
    mensagem: str = "",
):
    sb.table("normativos_log").insert({
        "normativo_id": normativo_id,
        "titulo": titulo[:200],
        "status": status,
        "chunks_gerados": chunks_gerados,
        "mensagem": mensagem[:500],
        "executado_em": datetime.now(timezone.utc).isoformat(),
    }).execute()


# ── SQL para criar as tabelas ─────────────────────────────────────────────────

SETUP_SQL = """
-- Habilita a extensão pgvector (rodar uma vez)
create extension if not exists vector;

-- Tabela de normativos (catálogo)
create table if not exists normativos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,        -- lei | decreto | in | parecer
  titulo          text not null,
  numero          text,
  ano             text,
  url_origem      text,
  vigente         boolean default true,
  data_publicacao date,
  data_ingestao   timestamptz,
  hash_conteudo   text unique,
  metadados       jsonb default '{}'
);

-- Tabela de chunks vetorizados
create table if not exists normativos_chunks (
  id             uuid primary key default gen_random_uuid(),
  normativo_id   uuid references normativos(id) on delete cascade,
  sequencia      integer,
  artigo_ref     text,
  texto          text not null,
  tokens         integer,
  embedding      vector(768)
);

-- Índice vetorial para busca semântica (HNSW — melhor para consultas rápidas)
create index if not exists idx_chunks_embedding
  on normativos_chunks
  using hnsw (embedding vector_cosine_ops);

-- Log de execuções da pipeline
create table if not exists normativos_log (
  id             uuid primary key default gen_random_uuid(),
  normativo_id   uuid,
  titulo         text,
  status         text,   -- sucesso | ignorado | erro
  chunks_gerados integer default 0,
  mensagem       text,
  executado_em   timestamptz default now()
);

-- Função de busca semântica (usar na aplicação)
create or replace function buscar_normativos(
  query_embedding vector(768),
  match_count     int     default 5,
  tipo_filtro     text    default null,
  apenas_vigentes boolean default true
)
returns table (
  id          uuid,
  normativo_id uuid,
  titulo      text,
  tipo        text,
  artigo_ref  text,
  texto       text,
  similaridade float
)
language sql stable as $$
  select
    c.id,
    c.normativo_id,
    n.titulo,
    n.tipo,
    c.artigo_ref,
    c.texto,
    1 - (c.embedding <=> query_embedding) as similaridade
  from normativos_chunks c
  join normativos n on n.id = c.normativo_id
  where
    (tipo_filtro is null or n.tipo = tipo_filtro)
    and (not apenas_vigentes or n.vigente = true)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
"""


def imprimir_setup_sql():
    """Imprime o SQL de setup para rodar no Supabase SQL Editor."""
    print("\n" + "="*60)
    print("COLE O SQL ABAIXO NO SUPABASE SQL EDITOR:")
    print("="*60)
    print(SETUP_SQL)
    print("="*60 + "\n")
