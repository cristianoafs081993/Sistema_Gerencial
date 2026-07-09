-- Fornecedores vinculados a uma pesquisa de preços
-- Permite reutilizar e-mails cadastrados em futuras cotações da mesma pesquisa
create table if not exists public.price_research_suppliers (
  id          uuid    primary key default gen_random_uuid(),
  research_id uuid    not null references public.price_researches(id) on delete cascade,
  name        text    not null,
  document    text,                  -- CNPJ/CPF do fornecedor (opcional)
  email       text    not null,
  phone       text,
  contact_name text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_price_research_suppliers_research
  on public.price_research_suppliers (research_id);

drop trigger if exists trg_update_price_research_suppliers_updated_at
  on public.price_research_suppliers;
create trigger trg_update_price_research_suppliers_updated_at
  before update on public.price_research_suppliers
  for each row execute function update_updated_at_column();

-- Registro de disparos de cotação por e-mail
-- Trilha de auditoria para cada e-mail enviado a partir de uma pesquisa
create table if not exists public.price_research_email_dispatches (
  id               uuid    primary key default gen_random_uuid(),
  research_id      uuid    not null references public.price_researches(id) on delete cascade,
  supplier_id      uuid    references public.price_research_suppliers(id) on delete set null,
  modality         text    not null
    check (modality in ('direct', 'express', 'batch', 'custom', 'manual')),
  recipient_email  text    not null,
  recipient_name   text,
  subject          text,
  body_html        text,
  status           text    not null default 'sent'
    check (status in ('sent', 'failed', 'cancelled')),
  error_message    text,
  sent_at          timestamptz,
  sent_by          uuid    references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_price_research_email_dispatches_research
  on public.price_research_email_dispatches (research_id, created_at desc);

-- RLS: price_research_suppliers
alter table public.price_research_suppliers enable row level security;

drop policy if exists "Users can read own price research suppliers"
  on public.price_research_suppliers;
create policy "Users can read own price research suppliers"
  on public.price_research_suppliers for select to authenticated
  using (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can create own price research suppliers"
  on public.price_research_suppliers;
create policy "Users can create own price research suppliers"
  on public.price_research_suppliers for insert to authenticated
  with check (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can update own price research suppliers"
  on public.price_research_suppliers;
create policy "Users can update own price research suppliers"
  on public.price_research_suppliers for update to authenticated
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

drop policy if exists "Users can delete own price research suppliers"
  on public.price_research_suppliers;
create policy "Users can delete own price research suppliers"
  on public.price_research_suppliers for delete to authenticated
  using (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_suppliers.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

-- RLS: price_research_email_dispatches
alter table public.price_research_email_dispatches enable row level security;

drop policy if exists "Users can read own price research email dispatches"
  on public.price_research_email_dispatches;
create policy "Users can read own price research email dispatches"
  on public.price_research_email_dispatches for select to authenticated
  using (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_email_dispatches.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

drop policy if exists "Users can create own price research email dispatches"
  on public.price_research_email_dispatches;
create policy "Users can create own price research email dispatches"
  on public.price_research_email_dispatches for insert to authenticated
  with check (
    exists (
      select 1 from public.price_researches r
      where r.id = price_research_email_dispatches.research_id
        and (r.created_by = auth.uid() or public.is_superadmin_jwt())
    )
  );

grant select, insert, update, delete on public.price_research_suppliers
  to authenticated;
grant select, insert on public.price_research_email_dispatches
  to authenticated;
