create table if not exists public.suap_document_reviews (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  suap_id text not null,
  document_id text not null,
  document_type text not null check (document_type in ('tr', 'etp')),
  document_title text not null,
  process_number text,
  checked_at timestamptz not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_suap_document_reviews_lookup
  on public.suap_document_reviews (created_by, suap_id, document_id, checked_at desc);

alter table public.suap_document_reviews enable row level security;

drop policy if exists "Users can read own SUAP document reviews" on public.suap_document_reviews;
create policy "Users can read own SUAP document reviews"
  on public.suap_document_reviews
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "Users can insert own SUAP document reviews" on public.suap_document_reviews;
create policy "Users can insert own SUAP document reviews"
  on public.suap_document_reviews
  for insert
  to authenticated
  with check (created_by = auth.uid());

grant select, insert on public.suap_document_reviews to authenticated;
