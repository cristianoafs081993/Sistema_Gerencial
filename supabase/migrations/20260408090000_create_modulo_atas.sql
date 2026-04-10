create extension if not exists pgcrypto;
create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_search_text(input_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(input_text, ''))),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'modulo_busca_atas') then
    create type public.modulo_busca_atas as enum ('adesao', 'pesquisa_precos');
  end if;

  if not exists (select 1 from pg_type where typname = 'tipo_item_ata') then
    create type public.tipo_item_ata as enum ('material', 'servico', 'nao_classificado');
  end if;

  if not exists (select 1 from pg_type where typname = 'status_vigencia_ata') then
    create type public.status_vigencia_ata as enum ('vigente', 'a_vencer', 'encerrada', 'desconhecida');
  end if;
end $$;

create table if not exists public.atas (
  id uuid primary key default gen_random_uuid(),
  identificador_fonte text unique,
  numero_ata text not null,
  ano_ata integer,
  objeto text not null,
  objeto_normalizado text generated always as (public.normalize_search_text(objeto)) stored,
  orgao_gerenciador text,
  orgao_gerenciador_normalizado text generated always as (public.normalize_search_text(orgao_gerenciador)) stored,
  vigencia_inicio date,
  vigencia_fim date,
  status_vigencia public.status_vigencia_ata not null default 'desconhecida',
  fonte text not null default 'nao_informada',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itens_ata (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.atas(id) on delete cascade,
  numero_item text,
  descricao text not null,
  descricao_normalizada text generated always as (public.normalize_search_text(descricao)) stored,
  tipo_item public.tipo_item_ata not null default 'nao_classificado',
  unidade_fornecimento text,
  quantidade numeric(18, 4),
  codigo_catmat_catser text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documentos_ata (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.atas(id) on delete cascade,
  tipo_documento text not null,
  url_origem text,
  texto_extraido text,
  status_extracao text not null default 'pendente',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessoes_busca_atas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid,
  modulo public.modulo_busca_atas not null,
  consulta_original text not null,
  consulta_normalizada text generated always as (public.normalize_search_text(consulta_original)) stored,
  contexto jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resultados_busca_atas (
  id uuid primary key default gen_random_uuid(),
  sessao_busca_id uuid not null references public.sessoes_busca_atas(id) on delete cascade,
  ata_id uuid not null references public.atas(id) on delete cascade,
  item_ata_id uuid references public.itens_ata(id) on delete set null,
  posicao integer not null check (posicao >= 1 and posicao <= 5),
  justificativa_curta text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.eventos_uso_atas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid,
  modulo public.modulo_busca_atas,
  tipo_evento text not null,
  referencia_tipo text,
  referencia_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_atas_numero_ano on public.atas (numero_ata, ano_ata);
create index if not exists idx_atas_status_vigencia on public.atas (status_vigencia);
create index if not exists idx_atas_vigencia_fim on public.atas (vigencia_fim);
create index if not exists idx_atas_objeto_fts on public.atas using gin (
  to_tsvector('portuguese', coalesce(objeto_normalizado, ''))
);
create index if not exists idx_atas_orgao_fts on public.atas using gin (
  to_tsvector('portuguese', coalesce(orgao_gerenciador_normalizado, ''))
);

create index if not exists idx_itens_ata_ata_id on public.itens_ata (ata_id);
create index if not exists idx_itens_ata_tipo_item on public.itens_ata (tipo_item);
create index if not exists idx_itens_ata_codigo_catalogo on public.itens_ata (codigo_catmat_catser);
create index if not exists idx_itens_ata_descricao_fts on public.itens_ata using gin (
  to_tsvector('portuguese', coalesce(descricao_normalizada, ''))
);

create index if not exists idx_documentos_ata_ata_id on public.documentos_ata (ata_id);
create index if not exists idx_sessoes_busca_atas_modulo on public.sessoes_busca_atas (modulo, created_at desc);
create index if not exists idx_resultados_busca_atas_sessao on public.resultados_busca_atas (sessao_busca_id, posicao);
create index if not exists idx_resultados_busca_atas_ata on public.resultados_busca_atas (ata_id);
create index if not exists idx_eventos_uso_atas_modulo on public.eventos_uso_atas (modulo, created_at desc);

do $$
declare
  current_table text;
begin
  foreach current_table in array array[
    'atas',
    'itens_ata',
    'documentos_ata',
    'sessoes_busca_atas',
    'resultados_busca_atas',
    'eventos_uso_atas'
  ]
  loop
    execute format('alter table public.%I enable row level security', current_table);

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = current_table
        and policyname = 'Permitir leitura publica'
    ) then
      execute format(
        'create policy "Permitir leitura publica" on public.%I for select using (true)',
        current_table
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = current_table
        and policyname = 'Permitir escrita publica'
    ) then
      execute format(
        'create policy "Permitir escrita publica" on public.%I for all using (true) with check (true)',
        current_table
      );
    end if;
  end loop;
end $$;
