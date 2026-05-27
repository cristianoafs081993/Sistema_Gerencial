create table if not exists public.atas_registro_precos_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial_success', 'error')),
  unidade_codigos text[] not null default '{}'::text[],
  data_inicial date not null,
  data_final date not null,
  total_fetched integer not null default 0,
  total_upserted integer not null default 0,
  error_message text,
  details jsonb not null default '{}'::jsonb
);

create table if not exists public.atas_registro_precos (
  id uuid primary key default gen_random_uuid(),
  ata_key text not null unique,
  numero_ata text not null,
  numero_compra text,
  ano_compra integer,
  modalidade_codigo text,
  modalidade_nome text,
  unidade_gerenciadora_codigo text not null,
  unidade_gerenciadora_nome text,
  objeto text,
  data_assinatura timestamptz,
  data_vigencia_inicial timestamptz,
  data_vigencia_final timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  sync_run_id uuid references public.atas_registro_precos_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atas_registro_precos_itens (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  ata_key text not null references public.atas_registro_precos(ata_key) on delete cascade,
  numero_ata text not null,
  unidade_gerenciadora_codigo text not null,
  numero_item text not null,
  codigo_item text,
  tipo_item text,
  descricao_item text,
  fornecedor_nome text,
  fornecedor_ni text,
  quantidade_homologada numeric(15, 4),
  valor_unitario numeric(15, 4),
  valor_total numeric(15, 2),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atas_registro_precos_unidades (
  id uuid primary key default gen_random_uuid(),
  unidade_item_key text not null unique,
  item_key text not null references public.atas_registro_precos_itens(item_key) on delete cascade,
  ata_key text not null references public.atas_registro_precos(ata_key) on delete cascade,
  unidade_codigo text not null,
  unidade_nome text,
  quantidade_autorizada numeric(15, 4),
  quantidade_utilizada numeric(15, 4),
  saldo_quantidade numeric(15, 4),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atas_registro_precos_adesoes (
  id uuid primary key default gen_random_uuid(),
  adesao_key text not null unique,
  item_key text not null references public.atas_registro_precos_itens(item_key) on delete cascade,
  ata_key text not null references public.atas_registro_precos(ata_key) on delete cascade,
  unidade_codigo text not null,
  unidade_nome text,
  quantidade_aderida numeric(15, 4),
  valor_aderido numeric(15, 2),
  data_adesao timestamptz,
  situacao text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_atas_rp_gerenciadora_vigencia
  on public.atas_registro_precos (unidade_gerenciadora_codigo, data_vigencia_inicial desc);

create index if not exists idx_atas_rp_vigencia_final
  on public.atas_registro_precos (data_vigencia_final desc);

create index if not exists idx_atas_rp_itens_ata
  on public.atas_registro_precos_itens (ata_key);

create index if not exists idx_atas_rp_unidades_unidade
  on public.atas_registro_precos_unidades (unidade_codigo, ata_key);

create index if not exists idx_atas_rp_adesoes_unidade
  on public.atas_registro_precos_adesoes (unidade_codigo, ata_key);

create index if not exists idx_atas_rp_sync_started
  on public.atas_registro_precos_sync_runs (started_at desc);

drop trigger if exists trg_update_atas_registro_precos_updated_at on public.atas_registro_precos;
create trigger trg_update_atas_registro_precos_updated_at
before update on public.atas_registro_precos
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_atas_registro_precos_itens_updated_at on public.atas_registro_precos_itens;
create trigger trg_update_atas_registro_precos_itens_updated_at
before update on public.atas_registro_precos_itens
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_atas_registro_precos_unidades_updated_at on public.atas_registro_precos_unidades;
create trigger trg_update_atas_registro_precos_unidades_updated_at
before update on public.atas_registro_precos_unidades
for each row
execute function update_updated_at_column();

drop trigger if exists trg_update_atas_registro_precos_adesoes_updated_at on public.atas_registro_precos_adesoes;
create trigger trg_update_atas_registro_precos_adesoes_updated_at
before update on public.atas_registro_precos_adesoes
for each row
execute function update_updated_at_column();

create or replace view public.atas_registro_precos_resumo as
select
  atas.*,
  coalesce(item_counts.total_itens, 0) as total_itens,
  coalesce(participacoes.unidades_participantes, '{}'::text[]) as unidades_participantes,
  coalesce(participacoes.total_unidades_participantes, 0) as total_unidades_participantes,
  coalesce(adesoes.unidades_aderentes, '{}'::text[]) as unidades_aderentes,
  coalesce(adesoes.total_adesoes, 0) as total_adesoes
from public.atas_registro_precos atas
left join (
  select ata_key, count(*)::integer as total_itens
  from public.atas_registro_precos_itens
  group by ata_key
) item_counts on item_counts.ata_key = atas.ata_key
left join (
  select
    ata_key,
    array_agg(distinct unidade_codigo order by unidade_codigo) as unidades_participantes,
    count(distinct unidade_codigo)::integer as total_unidades_participantes
  from public.atas_registro_precos_unidades
  group by ata_key
) participacoes on participacoes.ata_key = atas.ata_key
left join (
  select
    ata_key,
    array_agg(distinct unidade_codigo order by unidade_codigo) as unidades_aderentes,
    count(*)::integer as total_adesoes
  from public.atas_registro_precos_adesoes
  group by ata_key
) adesoes on adesoes.ata_key = atas.ata_key;

alter table public.atas_registro_precos enable row level security;
alter table public.atas_registro_precos_itens enable row level security;
alter table public.atas_registro_precos_unidades enable row level security;
alter table public.atas_registro_precos_adesoes enable row level security;
alter table public.atas_registro_precos_sync_runs enable row level security;

drop policy if exists "Authenticated users can read atas registro precos" on public.atas_registro_precos;
create policy "Authenticated users can read atas registro precos"
  on public.atas_registro_precos
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read atas registro precos itens" on public.atas_registro_precos_itens;
create policy "Authenticated users can read atas registro precos itens"
  on public.atas_registro_precos_itens
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read atas registro precos unidades" on public.atas_registro_precos_unidades;
create policy "Authenticated users can read atas registro precos unidades"
  on public.atas_registro_precos_unidades
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read atas registro precos adesoes" on public.atas_registro_precos_adesoes;
create policy "Authenticated users can read atas registro precos adesoes"
  on public.atas_registro_precos_adesoes
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read atas registro precos sync runs" on public.atas_registro_precos_sync_runs;
create policy "Authenticated users can read atas registro precos sync runs"
  on public.atas_registro_precos_sync_runs
  for select
  to authenticated
  using (true);

grant select on public.atas_registro_precos to authenticated;
grant select on public.atas_registro_precos_itens to authenticated;
grant select on public.atas_registro_precos_unidades to authenticated;
grant select on public.atas_registro_precos_adesoes to authenticated;
grant select on public.atas_registro_precos_sync_runs to authenticated;
grant select on public.atas_registro_precos_resumo to authenticated;

insert into public.screen_groups (id, name, sort_order)
values ('licitacoes', 'Licitacoes', 25)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values
  ('licitacoes-pregoes', 'licitacoes', 'Pregoes por UASG', '/licitacoes-pregoes', 10, false, true),
  ('atas-registro-precos', 'licitacoes', 'Atas e ARP', '/atas-registro-precos', 20, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, screens.screen_id, true
from public.user_groups groups
cross join (
  values ('licitacoes-pregoes'), ('atas-registro-precos')
) as screens(screen_id)
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();
