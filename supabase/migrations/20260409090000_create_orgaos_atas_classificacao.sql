do $$
begin
  if not exists (select 1 from pg_type where typname = 'classificacao_orgao_adesao_atas') then
    create type public.classificacao_orgao_adesao_atas as enum (
      'nao_classificado',
      'administracao_publica',
      'empresa_publica',
      'sociedade_economia_mista',
      'outra_entidade'
    );
  end if;
end $$;

create table if not exists public.orgaos_atas_classificacao (
  cnpj text primary key check (cnpj ~ '^[0-9]{14}$'),
  razao_social text,
  classificacao public.classificacao_orgao_adesao_atas not null default 'nao_classificado',
  natureza_juridica text,
  permite_adesao_ifrn boolean,
  usar_somente_pesquisa_precos boolean not null default false,
  observacoes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orgaos_atas_classificacao_classificacao
  on public.orgaos_atas_classificacao (classificacao);

create index if not exists idx_orgaos_atas_classificacao_permite_adesao
  on public.orgaos_atas_classificacao (permite_adesao_ifrn, usar_somente_pesquisa_precos);

alter table public.orgaos_atas_classificacao enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orgaos_atas_classificacao'
      and policyname = 'Permitir leitura publica'
  ) then
    create policy "Permitir leitura publica"
      on public.orgaos_atas_classificacao
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orgaos_atas_classificacao'
      and policyname = 'Permitir escrita publica'
  ) then
    create policy "Permitir escrita publica"
      on public.orgaos_atas_classificacao
      for all
      using (true)
      with check (true);
  end if;
end $$;
