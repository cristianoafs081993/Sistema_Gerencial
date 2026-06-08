create table if not exists public.rap_historico_anual (
  id uuid primary key default gen_random_uuid(),
  ug_executora text not null,
  ug_nome text,
  ano integer not null,
  metrica text,
  item_informacao_codigo text not null,
  item_informacao_nome text not null,
  valor numeric(16, 2) not null default 0,
  import_batch_id uuid not null,
  source_file text,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rap_historico_anual_import_batch_idx
  on public.rap_historico_anual (import_batch_id, ug_executora, ano);

create index if not exists rap_historico_anual_ug_ano_idx
  on public.rap_historico_anual (ug_executora, ano);

create index if not exists rap_historico_anual_latest_idx
  on public.rap_historico_anual (imported_at desc);

alter table public.rap_historico_anual enable row level security;

create policy "Leitura autenticada do historico anual de RAP"
  on public.rap_historico_anual for select to authenticated using (true);

create policy "Importacao superadmin do historico anual de RAP"
  on public.rap_historico_anual for insert to authenticated
  with check (public.is_superadmin_jwt());

grant select, insert on public.rap_historico_anual to authenticated;
