create table if not exists public.descentralizacoes (
  id uuid default gen_random_uuid() primary key,
  dimensao text not null,
  origem_recurso text not null,
  plano_interno text,
  valor numeric not null default 0.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.descentralizacoes enable row level security;

-- Políticas de RLS
create policy "Descentralizacoes são visíveis para todos"
  on public.descentralizacoes for select
  using (true);

create policy "Descentralizacoes podem ser inseridas por todos (temporário)"
  on public.descentralizacoes for insert
  with check (true);

create policy "Descentralizacoes podem ser atualizadas por todos (temporário)"
  on public.descentralizacoes for update
  using (true);

create policy "Descentralizacoes podem ser deletadas por todos (temporário)"
  on public.descentralizacoes for delete
  using (true);
