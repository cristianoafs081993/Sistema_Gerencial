do $$
begin
  if not exists (select 1 from pg_type where typname = 'status_sessao_batch_atas') then
    create type public.status_sessao_batch_atas as enum ('em_andamento', 'concluida', 'pausada');
  end if;

  if not exists (select 1 from pg_type where typname = 'status_item_batch_atas') then
    create type public.status_item_batch_atas as enum ('pendente', 'em_foco', 'concluido', 'erro');
  end if;
end $$;

create table if not exists public.sessoes_batch_atas (
  id uuid primary key default gen_random_uuid(),
  modulo public.modulo_busca_atas not null,
  titulo text not null,
  filtros jsonb not null default '{}'::jsonb,
  status public.status_sessao_batch_atas not null default 'em_andamento',
  total_itens integer not null default 0,
  total_concluidos integer not null default 0,
  item_atual_ordem integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itens_sessao_batch_atas (
  id uuid primary key default gen_random_uuid(),
  sessao_batch_id uuid not null references public.sessoes_batch_atas(id) on delete cascade,
  ordem integer not null,
  consulta_item text not null,
  status public.status_item_batch_atas not null default 'pendente',
  sessao_busca_id uuid references public.sessoes_busca_atas(id) on delete set null,
  resumo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sessao_batch_id, ordem)
);

create index if not exists idx_sessoes_batch_atas_modulo_status
  on public.sessoes_batch_atas (modulo, status, created_at desc);

create index if not exists idx_itens_sessao_batch_atas_batch_ordem
  on public.itens_sessao_batch_atas (sessao_batch_id, ordem);

alter table public.sessoes_batch_atas enable row level security;
alter table public.itens_sessao_batch_atas enable row level security;

do $$
declare
  current_table text;
begin
  foreach current_table in array array['sessoes_batch_atas', 'itens_sessao_batch_atas']
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = current_table
        and policyname = 'Permitir leitura publica'
    ) then
      execute format(
        'create policy "Permitir leitura publica" on public.%I for select using (true)',
        current_table
      );
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = current_table
        and policyname = 'Permitir escrita publica'
    ) then
      execute format(
        'create policy "Permitir escrita publica" on public.%I for all using (true) with check (true)',
        current_table
      );
    end if;
  end loop;
end $$;
