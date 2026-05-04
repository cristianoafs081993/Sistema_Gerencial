create table if not exists public.licitacoes_pncp_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial_success', 'error')),
  cnpj_orgao text not null,
  unidade_codigos text[] not null default '{}'::text[],
  data_inicial date not null,
  data_final date not null,
  modalidade_id integer not null default 6,
  total_windows integer not null default 0,
  total_fetched integer not null default 0,
  total_upserted integer not null default 0,
  error_message text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.licitacoes_pncp (
  id uuid primary key default gen_random_uuid(),
  numero_controle_pncp text not null unique,
  cnpj_orgao text not null,
  razao_social_orgao text,
  ano_compra integer not null,
  sequencial_compra integer not null,
  numero_compra text,
  processo text,
  objeto_compra text,
  modalidade_id integer,
  modalidade_nome text,
  modo_disputa_id integer,
  modo_disputa_nome text,
  situacao_compra_id integer,
  situacao_compra_nome text,
  uasg_codigo text,
  uasg_nome text,
  unidade_uf text,
  unidade_municipio text,
  unidade_codigo_ibge text,
  valor_total_estimado numeric(15, 2),
  valor_total_homologado numeric(15, 2),
  srp boolean,
  data_publicacao_pncp timestamptz,
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz,
  data_inclusao timestamptz,
  data_atualizacao timestamptz,
  data_atualizacao_global timestamptz,
  amparo_legal_codigo integer,
  amparo_legal_nome text,
  amparo_legal_descricao text,
  tipo_instrumento_convocatorio_codigo integer,
  tipo_instrumento_convocatorio_nome text,
  usuario_nome text,
  informacao_complementar text,
  link_sistema_origem text,
  link_processo_eletronico text,
  raw_data jsonb not null default '{}'::jsonb,
  compras_gov_data jsonb not null default '{}'::jsonb,
  sync_run_id uuid references public.licitacoes_pncp_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licitacoes_pncp_uasgs (
  codigo_uasg text primary key,
  nome_uasg text,
  codigo_orgao text,
  cnpj_orgao text,
  sigla_uf text,
  codigo_municipio_ibge text,
  nome_municipio_ibge text,
  codigo_unidade_polo text,
  nome_unidade_polo text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licitacoes_pncp_uasg_publicacao
  on public.licitacoes_pncp (uasg_codigo, data_publicacao_pncp desc);

create index if not exists idx_licitacoes_pncp_cnpj_publicacao
  on public.licitacoes_pncp (cnpj_orgao, data_publicacao_pncp desc);

create index if not exists idx_licitacoes_pncp_situacao
  on public.licitacoes_pncp (situacao_compra_nome);

create index if not exists idx_licitacoes_pncp_propostas
  on public.licitacoes_pncp (data_abertura_proposta, data_encerramento_proposta);

create index if not exists idx_licitacoes_pncp_sync_started
  on public.licitacoes_pncp_sync_runs (started_at desc);

drop trigger if exists trg_update_licitacoes_pncp_updated_at on public.licitacoes_pncp;
create trigger trg_update_licitacoes_pncp_updated_at
before update on public.licitacoes_pncp
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_licitacoes_pncp_uasgs_updated_at on public.licitacoes_pncp_uasgs;
create trigger trg_update_licitacoes_pncp_uasgs_updated_at
before update on public.licitacoes_pncp_uasgs
for each row
execute function update_updated_at_column();

alter table public.licitacoes_pncp enable row level security;
alter table public.licitacoes_pncp_sync_runs enable row level security;
alter table public.licitacoes_pncp_uasgs enable row level security;

drop policy if exists "Authenticated users can read licitacoes pncp" on public.licitacoes_pncp;
create policy "Authenticated users can read licitacoes pncp"
  on public.licitacoes_pncp
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read licitacoes pncp sync runs" on public.licitacoes_pncp_sync_runs;
create policy "Authenticated users can read licitacoes pncp sync runs"
  on public.licitacoes_pncp_sync_runs
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read licitacoes pncp uasgs" on public.licitacoes_pncp_uasgs;
create policy "Authenticated users can read licitacoes pncp uasgs"
  on public.licitacoes_pncp_uasgs
  for select
  to authenticated
  using (true);

grant select on public.licitacoes_pncp to authenticated;
grant select on public.licitacoes_pncp_sync_runs to authenticated;
grant select on public.licitacoes_pncp_uasgs to authenticated;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values ('licitacoes-pregoes', 'contratos', 'Pregoes IFRN', '/licitacoes-pregoes', 20, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, 'licitacoes-pregoes', true
from public.user_groups groups
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('sync-licitacoes-pncp-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'sync-licitacoes-pncp-daily'
);

select cron.schedule(
  'sync-licitacoes-pncp-daily',
  '30 6 * * *',
  $$
  select net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-licitacoes-pncp',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "supabase-cron-daily"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
