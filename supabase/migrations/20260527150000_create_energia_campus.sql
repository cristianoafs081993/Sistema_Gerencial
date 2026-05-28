create table if not exists public.energia_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  imported_by uuid default auth.uid(),
  imported_by_email text default (auth.jwt() ->> 'email'),
  totals jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.energia_consumo_faturas (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.energia_import_runs(id) on delete cascade,
  fonte text not null check (fonte in ('cosern', 'mercatto')),
  ambiente text,
  subestacao text,
  contrato text,
  competencia date,
  ano integer,
  leitura_inicio date,
  leitura_fim date,
  consumo_ativo_fp_kwh numeric(15, 3),
  consumo_ativo_np_kwh numeric(15, 3),
  consumo_total_kwh numeric(15, 3),
  valor_faturado numeric(15, 2),
  fatura_numero text,
  parcela text,
  processo text,
  fornecedor text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energia_solar_geracao (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.energia_import_runs(id) on delete cascade,
  ufv_nome text not null,
  data_referencia date,
  ano integer,
  mes integer check (mes is null or (mes between 1 and 12)),
  granularidade text not null default 'anual' check (granularidade in ('anual', 'mensal')),
  energia_gerada_kwh numeric(15, 3),
  observacao text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energia_contratos (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.energia_import_runs(id) on delete cascade,
  fonte text not null check (fonte in ('cosern', 'mercatto', 'solar')),
  modalidade text,
  fornecedor text,
  contrato_numero text,
  inicio date,
  termino date,
  volume_contratado_kwh numeric(15, 3),
  valor_contratado numeric(15, 2),
  situacao text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.energia_contrato_execucoes (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid references public.energia_import_runs(id) on delete cascade,
  fonte text not null check (fonte in ('cosern', 'mercatto', 'solar')),
  contrato_numero text,
  parcela text,
  competencia date,
  valor_executado numeric(15, 2),
  valor_previsto numeric(15, 2),
  percentual_execucao numeric(8, 4),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists energia_import_runs_imported_at_idx
  on public.energia_import_runs (imported_at desc);

create index if not exists energia_consumo_faturas_fonte_competencia_idx
  on public.energia_consumo_faturas (fonte, competencia);

create index if not exists energia_consumo_faturas_import_run_idx
  on public.energia_consumo_faturas (import_run_id);

create index if not exists energia_solar_geracao_periodo_idx
  on public.energia_solar_geracao (granularidade, ano, mes);

create index if not exists energia_solar_geracao_import_run_idx
  on public.energia_solar_geracao (import_run_id);

create index if not exists energia_contratos_import_run_idx
  on public.energia_contratos (import_run_id);

create index if not exists energia_contrato_execucoes_import_run_idx
  on public.energia_contrato_execucoes (import_run_id);

drop trigger if exists trg_update_energia_consumo_faturas_updated_at on public.energia_consumo_faturas;
create trigger trg_update_energia_consumo_faturas_updated_at
before update on public.energia_consumo_faturas
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_energia_solar_geracao_updated_at on public.energia_solar_geracao;
create trigger trg_update_energia_solar_geracao_updated_at
before update on public.energia_solar_geracao
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_energia_contratos_updated_at on public.energia_contratos;
create trigger trg_update_energia_contratos_updated_at
before update on public.energia_contratos
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_energia_contrato_execucoes_updated_at on public.energia_contrato_execucoes;
create trigger trg_update_energia_contrato_execucoes_updated_at
before update on public.energia_contrato_execucoes
for each row
execute function update_updated_at_column();

alter table public.energia_import_runs enable row level security;
alter table public.energia_consumo_faturas enable row level security;
alter table public.energia_solar_geracao enable row level security;
alter table public.energia_contratos enable row level security;
alter table public.energia_contrato_execucoes enable row level security;

drop policy if exists "Authenticated users can read energia import runs" on public.energia_import_runs;
create policy "Authenticated users can read energia import runs"
  on public.energia_import_runs
  for select
  to authenticated
  using (true);

drop policy if exists "Superadmin can write energia import runs" on public.energia_import_runs;
create policy "Superadmin can write energia import runs"
  on public.energia_import_runs
  for all
  to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

drop policy if exists "Authenticated users can read energia consumo" on public.energia_consumo_faturas;
create policy "Authenticated users can read energia consumo"
  on public.energia_consumo_faturas
  for select
  to authenticated
  using (true);

drop policy if exists "Superadmin can write energia consumo" on public.energia_consumo_faturas;
create policy "Superadmin can write energia consumo"
  on public.energia_consumo_faturas
  for all
  to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

drop policy if exists "Authenticated users can read energia solar" on public.energia_solar_geracao;
create policy "Authenticated users can read energia solar"
  on public.energia_solar_geracao
  for select
  to authenticated
  using (true);

drop policy if exists "Superadmin can write energia solar" on public.energia_solar_geracao;
create policy "Superadmin can write energia solar"
  on public.energia_solar_geracao
  for all
  to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

drop policy if exists "Authenticated users can read energia contratos" on public.energia_contratos;
create policy "Authenticated users can read energia contratos"
  on public.energia_contratos
  for select
  to authenticated
  using (true);

drop policy if exists "Superadmin can write energia contratos" on public.energia_contratos;
create policy "Superadmin can write energia contratos"
  on public.energia_contratos
  for all
  to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

drop policy if exists "Authenticated users can read energia execucoes" on public.energia_contrato_execucoes;
create policy "Authenticated users can read energia execucoes"
  on public.energia_contrato_execucoes
  for select
  to authenticated
  using (true);

drop policy if exists "Superadmin can write energia execucoes" on public.energia_contrato_execucoes;
create policy "Superadmin can write energia execucoes"
  on public.energia_contrato_execucoes
  for all
  to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

grant select on public.energia_import_runs to authenticated;
grant select on public.energia_consumo_faturas to authenticated;
grant select on public.energia_solar_geracao to authenticated;
grant select on public.energia_contratos to authenticated;
grant select on public.energia_contrato_execucoes to authenticated;

grant insert, update, delete on public.energia_import_runs to authenticated;
grant insert, update, delete on public.energia_consumo_faturas to authenticated;
grant insert, update, delete on public.energia_solar_geracao to authenticated;
grant insert, update, delete on public.energia_contratos to authenticated;
grant insert, update, delete on public.energia_contrato_execucoes to authenticated;

insert into public.screen_groups (id, name, sort_order)
values ('energia', 'Energia', 37)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values
  ('energia-visao-geral', 'energia', 'Visão Geral', '/energia', 10, false, true),
  ('energia-cosern', 'energia', 'COSERN', '/energia/cosern', 20, false, true),
  ('energia-mercatto', 'energia', 'Mercatto', '/energia/mercatto', 30, false, true),
  ('energia-geracao-solar', 'energia', 'Geração Solar', '/energia/geracao-solar', 40, false, true),
  ('energia-contratos', 'energia', 'Contratos de Energia', '/energia/contratos', 50, false, true),
  ('energia-financeiro', 'energia', 'Financeiro de Energia', '/energia/financeiro', 60, false, true),
  ('energia-esg', 'energia', 'Indicadores ESG', '/energia/esg', 70, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, screens.id, true
from public.user_groups groups
cross join (
  values
    ('energia-visao-geral'),
    ('energia-cosern'),
    ('energia-mercatto'),
    ('energia-geracao-solar'),
    ('energia-contratos'),
    ('energia-financeiro'),
    ('energia-esg')
) as screens(id)
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();
