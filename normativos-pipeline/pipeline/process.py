"""
process.py — Chunking e geração de embeddings

Estratégia de chunking:
  1. Tenta preservar artigos/seções completos
  2. Se o artigo for maior que CHUNK_SIZE, divide por parágrafos
  3. Aplica overlap entre chunks consecutivos
"""

import os
import re
import time
from dataclasses import dataclass

from google import genai
import tiktoken
from tenacity import retry, stop_after_attempt, wait_exponential

from pipeline.extract import Documento

# ── Configuração ─────────────────────────────────────────────────────────────

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 500))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 50))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2-preview")

# Tokenizador (cl100k é compatível com a contagem do Gemini)
_enc = tiktoken.get_encoding("cl100k_base")

# Google GenAI client (singleton)
_client = None


def _contar_tokens(texto: str) -> int:
    return len(_enc.encode(texto))


# ── Chunking ──────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    normativo_titulo: str
    normativo_tipo: str
    normativo_numero: str
    normativo_ano: str
    sequencia: int
    artigo_ref: str
    texto: str
    tokens: int


def _detectar_artigos(texto: str) -> list[tuple[str, str]]:
    """
    Divide o texto em (referência, conteúdo) por artigo/seção ou itens numerados (1., 2., etc).
    """
    # Regex seguro que busca quebra de linha seguida de Art., Seção, ou números (ex: 1., 2.1.)
    padrao = re.compile(
        r"(?=\n\s*(?:Art\.|Artigo|SEÇÃO|Seção|CAPÍTULO|Capítulo|TÍTULO|Título|\d{1,2}\.)\s)",
        re.IGNORECASE
    )
    partes = padrao.split("\n" + texto)
    resultado = []

    for parte in partes:
        if not parte.strip():
            continue
        # Extrai a referência da primeira linha
        linhas = parte.strip().split("\n", 1)
        primeira_linha = linhas[0].strip()
        
        # Limpa e encurta a referência para ficar amigável nos cards (ex: "Art. 5º", "Item 1.")
        # Pega no máximo os primeiros 60 caracteres e para no primeiro ponto final não-abreviativo ou vírgula
        ref_curta = primeira_linha[:60].split(',')[0].strip()
        if len(ref_curta) > 40:
            ref_curta = ref_curta[:40] + "..."
            
        conteudo = parte.strip()
        resultado.append((ref_curta, conteudo))

    return resultado if resultado else [("Geral", texto)]


def _dividir_por_tokens(texto: str, tamanho: int, overlap: int) -> list[str]:
    """Divide texto em chunks por contagem de tokens com overlap."""
    tokens = _enc.encode(texto)
    chunks = []
    inicio = 0

    while inicio < len(tokens):
        fim = min(inicio + tamanho, len(tokens))
        chunk_tokens = tokens[inicio:fim]
        chunks.append(_enc.decode(chunk_tokens))
        if fim == len(tokens):
            break
        inicio = fim - overlap  # recua pelo overlap

    return chunks


def chunkar_documento(doc: Documento) -> list[Chunk]:
    """
    Divide um Documento em Chunks preservando estrutura de artigos.
    """
    chunks = []
    artigos = _detectar_artigos(doc.texto)
    sequencia = 0

    for ref, conteudo in artigos:
        tokens = _contar_tokens(conteudo)

        if tokens <= CHUNK_SIZE:
            # Artigo cabe inteiro
            chunks.append(Chunk(
                normativo_titulo=doc.titulo,
                normativo_tipo=doc.tipo,
                normativo_numero=doc.numero,
                normativo_ano=doc.ano,
                sequencia=sequencia,
                artigo_ref=ref,
                texto=conteudo,
                tokens=tokens,
            ))
            sequencia += 1
        else:
            # Artigo muito grande: divide por tokens com overlap
            sub_chunks = _dividir_por_tokens(conteudo, CHUNK_SIZE, CHUNK_OVERLAP)
            for i, sub in enumerate(sub_chunks):
                chunks.append(Chunk(
                    normativo_titulo=doc.titulo,
                    normativo_tipo=doc.tipo,
                    normativo_numero=doc.numero,
                    normativo_ano=doc.ano,
                    sequencia=sequencia,
                    artigo_ref=f"{ref} (parte {i+1}/{len(sub_chunks)})",
                    texto=sub,
                    tokens=_contar_tokens(sub),
                ))
                sequencia += 1

    return chunks


# ── Embeddings ────────────────────────────────────────────────────────────────

def configurar_google_ai():
    global _client
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY não definida no .env")
    _client = genai.Client(api_key=api_key)


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    reraise=True,
)
def _gerar_embedding(texto: str) -> list[float]:
    """Gera embedding via Google GenAI (new SDK) com retry automático."""
    result = _client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texto,
        config={"output_dimensionality": 768}
    )
    return result.embeddings[0].values


def gerar_embeddings(
    chunks: list[Chunk],
    delay_entre_lotes: float = 0.5,
    tamanho_lote: int = 20,
) -> list[tuple[Chunk, list[float]]]:
    """
    Gera embeddings para uma lista de chunks em lotes.
    Respeita o rate limit da API gratuita (1.500 req/min).
    """
    resultados = []
    total = len(chunks)

    for i in range(0, total, tamanho_lote):
        lote = chunks[i : i + tamanho_lote]
        for chunk in lote:
            embedding = _gerar_embedding(chunk.texto)
            resultados.append((chunk, embedding))

        processados = min(i + tamanho_lote, total)
        print(f"  Embeddings: {processados}/{total} chunks", end="\r")

        # Pausa para não saturar o rate limit gratuito (100 req/minuto -> ~20 reqs a cada 12 segundos)
        # Vamos pausar 15 segundos entre lotes de 20
        if i + tamanho_lote < total:
            time.sleep(15)

    print()  # nova linha após o \r
    return resultados
