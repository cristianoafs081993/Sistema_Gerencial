-- 1. Limpeza das tabelas locais anteriores
drop table if exists public.price_research_suppliers cascade;

alter table public.price_research_email_dispatches 
  drop constraint if exists price_research_email_dispatches_supplier_id_fkey;

-- 2. Criação da tabela global de fornecedores
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text unique,                 -- CNPJ ou CPF (opcional, porém único)
  email text not null,
  phone text,
  contact_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suppliers_name_trgm on public.suppliers (name);

-- Trigger para updated_at
drop trigger if exists trg_update_suppliers_updated_at on public.suppliers;
create trigger trg_update_suppliers_updated_at
  before update on public.suppliers
  for each row execute function update_updated_at_column();

-- 3. Recriação da tabela associativa pesquisa-fornecedor
create table if not exists public.price_research_suppliers (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.price_researches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(research_id, supplier_id)
);

-- 4. Ajuste da constraint em dispatches para apontar para a tabela global
alter table public.price_research_email_dispatches
  add constraint price_research_email_dispatches_supplier_id_fkey
    foreign key (supplier_id) references public.suppliers(id) on delete set null;

-- 5. RLS Policies
alter table public.suppliers enable row level security;

drop policy if exists "Users can read all suppliers" on public.suppliers;
create policy "Users can read all suppliers"
  on public.suppliers for select to authenticated
  using (true);

drop policy if exists "Users can manage all suppliers" on public.suppliers;
create policy "Users can manage all suppliers"
  on public.suppliers for all to authenticated
  using (true)
  with check (true);

alter table public.price_research_suppliers enable row level security;

drop policy if exists "Users can read research suppliers" on public.price_research_suppliers;
create policy "Users can read research suppliers"
  on public.price_research_suppliers for select to authenticated
  using (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can manage research suppliers" on public.price_research_suppliers;
create policy "Users can manage research suppliers"
  on public.price_research_suppliers for all to authenticated
  using (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  )
  with check (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, delete on public.price_research_suppliers to authenticated;
