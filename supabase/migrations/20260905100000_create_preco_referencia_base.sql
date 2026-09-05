-- ==============================================================================
-- BASE LOCAL DE PESQUISA DE PREÇOS (IN SEGES/ME 65/2021 & LEI 14.133/2021)
-- Suporte a Busca Semântica (pgvector HNSW), Busca Híbrida (FTS + Trigram),
-- Ingestão Mês a Mês e Job Diário de Sincronização.
-- ==============================================================================

-- 1. Extensões necessárias
create extension if not exists vector with schema public;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- 2. Tabela de controle de execuções de sincronização
create table if not exists public.preco_referencia_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tipo_sync text not null check (tipo_sync in ('backfill_mensal', 'daily_delta', 'manual')),
  ano integer not null,
  mes integer check (mes between 1 and 12),
  data_inicial date not null,
  data_final date not null,
  status text not null default 'running' check (status in ('running', 'completed', 'partial_success', 'error')),
  escopo text not null default 'federal_rn_nordeste',
  total_compras_consultadas integer not null default 0,
  total_itens_ingeridos integer not null default 0,
  total_embeddings_gerados integer not null default 0,
  cursor_data jsonb not null default '{}'::jsonb,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- 3. Tabela de itens de contratações públicas / cotações de referência
create table if not exists public.preco_referencia_itens (
  id uuid primary key default gen_random_uuid(),
  source_id text,
  numero_controle_pncp text not null,
  numero_item integer not null,
  codigo_item_catalogo text,
  tipo_catalogo text not null default 'material' check (tipo_catalogo in ('material', 'servico')),
  descricao_item text not null,
  descricao_detalhada text,
  unidade_medida text not null default 'UN',
  quantidade numeric(15, 4) not null default 1,
  valor_unitario numeric(15, 4) not null check (valor_unitario > 0),
  valor_total numeric(15, 2),
  marca text,
  fornecedor_nome text,
  fornecedor_cnpj text,
  orgao_nome text not null,
  orgao_cnpj text not null,
  orgao_esfera text not null default 'Federal',
  orgao_uf text,
  orgao_municipio text,
  uasg_codigo text,
  modalidade_nome text,
  ano_compra integer not null,
  numero_compra text,
  processo text,
  data_publicacao_pncp timestamptz not null,
  data_resultado timestamptz,
  link_pncp text,
  amostra_valida boolean not null default true,
  exclusion_reason text,
  embedding vector(768),
  search_tsv tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(descricao_item, '') || ' ' ||
      coalesce(descricao_detalhada, '') || ' ' ||
      coalesce(marca, '') || ' ' ||
      coalesce(codigo_item_catalogo, '')
    )
  ) stored,
  sync_run_id uuid references public.preco_referencia_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_preco_referencia_item unique (numero_controle_pncp, numero_item)
);

-- 4. Gatilho para updated_at automático
create or replace function public.update_preco_referencia_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_preco_referencia_itens_updated on public.preco_referencia_itens;
create trigger trg_preco_referencia_itens_updated
before update on public.preco_referencia_itens
for each row execute function public.update_preco_referencia_timestamp();

-- 5. Índices Estratégicos
-- 5.1 Índice HNSW para pesquisa vetorial semântica ultrarrápida (distância cosseno)
create index if not exists idx_preco_ref_embedding_hnsw
  on public.preco_referencia_itens
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 5.2 Índice Full-Text Search (GIN)
create index if not exists idx_preco_ref_search_tsv
  on public.preco_referencia_itens
  using gin (search_tsv);

-- 5.3 Índice Trigram (GIN) para tolerância a erros e similaridade morfológica
create index if not exists idx_preco_ref_descricao_trgm
  on public.preco_referencia_itens
  using gin (descricao_item extensions.gin_trgm_ops);

-- 5.4 Índices B-Tree para filtros normativos e relacionais
create index if not exists idx_preco_ref_data_pub
  on public.preco_referencia_itens (data_publicacao_pncp desc);

create index if not exists idx_preco_ref_cat_code
  on public.preco_referencia_itens (codigo_item_catalogo);

create index if not exists idx_preco_ref_orgao_uf
  on public.preco_referencia_itens (orgao_uf, orgao_esfera);

create index if not exists idx_preco_ref_sync_run
  on public.preco_referencia_itens (sync_run_id);

create index if not exists idx_preco_ref_sync_runs_lookup
  on public.preco_referencia_sync_runs (ano, mes, status);

-- 6. Row Level Security (RLS)
alter table public.preco_referencia_sync_runs enable row level security;
alter table public.preco_referencia_itens enable row level security;

-- Leitura pública para usuários autenticados e anônimos (dados de cotações governamentais abertas)
drop policy if exists "Leitura de itens de preco de referencia" on public.preco_referencia_itens;
create policy "Leitura de itens de preco de referencia"
  on public.preco_referencia_itens
  for select
  to authenticated, anon
  using (true);

drop policy if exists "Leitura de sync runs de preco de referencia" on public.preco_referencia_sync_runs;
create policy "Leitura de sync runs de preco de referencia"
  on public.preco_referencia_sync_runs
  for select
  to authenticated, anon
  using (true);

-- Permissões de escrita restritas a service_role (usada pelas Edge Functions e jobs)
grant select on public.preco_referencia_itens to authenticated, anon;
grant select on public.preco_referencia_sync_runs to authenticated, anon;
grant all on public.preco_referencia_itens to service_role;
grant all on public.preco_referencia_sync_runs to service_role;

-- 7. Função RPC de Busca Híbrida Ponderada (Semântica + FTS + Trigram)
create or replace function public.match_preco_referencia_hibrido(
  query_text text,
  query_embedding vector(768) default null,
  match_threshold float default 0.25,
  match_count int default 20,
  filter_uf text default null,
  filter_esfera text default null,
  max_lookback_days int default 365
)
returns table (
  id uuid,
  numero_controle_pncp text,
  numero_item integer,
  codigo_item_catalogo text,
  tipo_catalogo text,
  descricao_item text,
  descricao_detalhada text,
  unidade_medida text,
  quantidade numeric,
  valor_unitario numeric,
  valor_total numeric,
  marca text,
  fornecedor_nome text,
  fornecedor_cnpj text,
  orgao_nome text,
  orgao_cnpj text,
  orgao_esfera text,
  orgao_uf text,
  uasg_codigo text,
  modalidade_nome text,
  ano_compra integer,
  numero_compra text,
  data_publicacao_pncp timestamptz,
  link_pncp text,
  similarity_score float
)
language plpgsql
stable
as $$
declare
  clean_query text := trim(query_text);
  query_plain_tsquery tsquery;
begin
  if clean_query <> '' then
    query_plain_tsquery := plainto_tsquery('portuguese', clean_query);
  else
    query_plain_tsquery := null;
  end if;

  return query
  select
    i.id,
    i.numero_controle_pncp,
    i.numero_item,
    i.codigo_item_catalogo,
    i.tipo_catalogo,
    i.descricao_item,
    i.descricao_detalhada,
    i.unidade_medida,
    i.quantidade,
    i.valor_unitario,
    i.valor_total,
    i.marca,
    i.fornecedor_nome,
    i.fornecedor_cnpj,
    i.orgao_nome,
    i.orgao_cnpj,
    i.orgao_esfera,
    i.orgao_uf,
    i.uasg_codigo,
    i.modalidade_nome,
    i.ano_compra,
    i.numero_compra,
    i.data_publicacao_pncp,
    i.link_pncp,
    cast(
      (
        case
          when query_embedding is not null and i.embedding is not null
            then 0.50 * (1 - (i.embedding <=> query_embedding))
          else 0.0
        end
      ) +
      (
        case
          when query_plain_tsquery is not null
            then 0.30 * least(1.0, ts_rank_cd(i.search_tsv, query_plain_tsquery))
          else 0.0
        end
      ) +
      (
        case
          when clean_query <> ''
            then 0.20 * extensions.similarity(i.descricao_item, clean_query)
          else 0.0
        end
      )
      as float
    ) as similarity_score
  from public.preco_referencia_itens i
  where i.amostra_valida = true
    and i.data_publicacao_pncp >= (now() - (max_lookback_days || ' days')::interval)
    and (filter_uf is null or i.orgao_uf = filter_uf)
    and (filter_esfera is null or i.orgao_esfera ilike filter_esfera)
    and (
      (query_embedding is not null and i.embedding is not null and (1 - (i.embedding <=> query_embedding)) >= match_threshold)
      or
      (query_plain_tsquery is not null and i.search_tsv @@ query_plain_tsquery)
      or
      (clean_query <> '' and extensions.similarity(i.descricao_item, clean_query) >= 0.20)
    )
  order by similarity_score desc
  limit match_count;
end;
$$;
