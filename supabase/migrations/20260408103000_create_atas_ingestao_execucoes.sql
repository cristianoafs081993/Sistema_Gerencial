create table if not exists public.atas_ingestao_execucoes (
  id uuid primary key default gen_random_uuid(),
  origem_tipo text not null,
  origem_referencia text,
  status text not null default 'iniciada',
  mensagem text,
  total_atas integer not null default 0,
  total_itens integer not null default 0,
  total_erros integer not null default 0,
  dry_run boolean not null default false,
  detalhes jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_atas_ingestao_execucoes_status_started_at
  on public.atas_ingestao_execucoes (status, started_at desc);

alter table public.atas_ingestao_execucoes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'atas_ingestao_execucoes'
      and policyname = 'Permitir leitura publica'
  ) then
    create policy "Permitir leitura publica"
      on public.atas_ingestao_execucoes
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'atas_ingestao_execucoes'
      and policyname = 'Permitir escrita publica'
  ) then
    create policy "Permitir escrita publica"
      on public.atas_ingestao_execucoes
      for all
      using (true)
      with check (true);
  end if;
end $$;
