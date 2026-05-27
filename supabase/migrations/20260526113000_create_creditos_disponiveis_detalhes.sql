create table if not exists public.creditos_disponiveis_detalhes (
  id uuid primary key default gen_random_uuid(),
  ptres text not null,
  plano_interno text,
  descricao text,
  metrica text,
  valor numeric(16, 2) not null default 0,
  import_batch_id uuid not null,
  source_file text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists creditos_disponiveis_detalhes_import_batch_idx
  on public.creditos_disponiveis_detalhes (import_batch_id, ptres, plano_interno);

create index if not exists creditos_disponiveis_detalhes_latest_idx
  on public.creditos_disponiveis_detalhes (imported_at desc);

alter table public.creditos_disponiveis_detalhes enable row level security;

create policy "Leitura autenticada de creditos disponiveis detalhados"
  on public.creditos_disponiveis_detalhes for select to authenticated using (true);

create policy "Importacao superadmin de creditos disponiveis detalhados"
  on public.creditos_disponiveis_detalhes for insert to authenticated
  with check (public.is_superadmin_jwt());

grant select, insert on public.creditos_disponiveis_detalhes to authenticated;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values ('credito-disponivel', 'orcamentario', 'Crédito disponível', '/credito-disponivel', 35, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, 'credito-disponivel', true
from public.user_groups groups
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();
