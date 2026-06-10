create table if not exists public.price_researches (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Pesquisa de preços',
  process_number text,
  object_description text not null,
  responsible_name text not null,
  research_date date not null default current_date,
  calculation_method text not null default 'median'
    check (calculation_method in ('median', 'mean', 'minimum')),
  methodology_justification text,
  notes text,
  source_file text,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'completed')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_by_email text default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_research_items (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.price_researches(id) on delete cascade,
  local_id text not null,
  item_number text not null,
  description text not null,
  catalog_type text not null check (catalog_type in ('material', 'service')),
  catalog_code text not null,
  quantity numeric(18, 6) not null default 1,
  unit text not null default 'UN',
  target_capacity numeric(18, 6),
  target_measure_unit text,
  reference_unit_cost numeric(18, 6),
  candidates jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (research_id, local_id)
);

create index if not exists idx_price_researches_owner_updated
  on public.price_researches (created_by, updated_at desc);

create index if not exists idx_price_research_items_research_order
  on public.price_research_items (research_id, sort_order);

drop trigger if exists trg_update_price_researches_updated_at on public.price_researches;
create trigger trg_update_price_researches_updated_at
before update on public.price_researches
for each row execute function update_updated_at_column();

drop trigger if exists trg_update_price_research_items_updated_at on public.price_research_items;
create trigger trg_update_price_research_items_updated_at
before update on public.price_research_items
for each row execute function update_updated_at_column();

alter table public.price_researches enable row level security;
alter table public.price_research_items enable row level security;

drop policy if exists "Users can read own price researches" on public.price_researches;
create policy "Users can read own price researches"
  on public.price_researches for select to authenticated
  using (created_by = auth.uid() or public.is_superadmin_jwt());

drop policy if exists "Users can create own price researches" on public.price_researches;
create policy "Users can create own price researches"
  on public.price_researches for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Users can update own price researches" on public.price_researches;
create policy "Users can update own price researches"
  on public.price_researches for update to authenticated
  using (created_by = auth.uid() or public.is_superadmin_jwt())
  with check (created_by = auth.uid() or public.is_superadmin_jwt());

drop policy if exists "Users can delete own price researches" on public.price_researches;
create policy "Users can delete own price researches"
  on public.price_researches for delete to authenticated
  using (created_by = auth.uid() or public.is_superadmin_jwt());

drop policy if exists "Users can read own price research items" on public.price_research_items;
create policy "Users can read own price research items"
  on public.price_research_items for select to authenticated
  using (
    exists (
      select 1
      from public.price_researches researches
      where researches.id = price_research_items.research_id
        and (researches.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can create own price research items" on public.price_research_items;
create policy "Users can create own price research items"
  on public.price_research_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.price_researches researches
      where researches.id = price_research_items.research_id
        and (researches.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can update own price research items" on public.price_research_items;
create policy "Users can update own price research items"
  on public.price_research_items for update to authenticated
  using (
    exists (
      select 1
      from public.price_researches researches
      where researches.id = price_research_items.research_id
        and (researches.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  )
  with check (
    exists (
      select 1
      from public.price_researches researches
      where researches.id = price_research_items.research_id
        and (researches.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can delete own price research items" on public.price_research_items;
create policy "Users can delete own price research items"
  on public.price_research_items for delete to authenticated
  using (
    exists (
      select 1
      from public.price_researches researches
      where researches.id = price_research_items.research_id
        and (researches.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

grant select, insert, update, delete on public.price_researches to authenticated;
grant select, insert, update, delete on public.price_research_items to authenticated;

insert into public.screen_groups (id, name, sort_order)
values ('licitacoes', 'Licitações', 35)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values ('pesquisa-precos', 'licitacoes', 'Pesquisa de Preços', '/pesquisa-precos', 5, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, 'pesquisa-precos', true
from public.user_groups groups
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();
