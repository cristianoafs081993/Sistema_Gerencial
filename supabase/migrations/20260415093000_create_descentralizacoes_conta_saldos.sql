create table if not exists public.descentralizacoes_conta_saldos (
    id uuid primary key default gen_random_uuid(),
    ptres text not null,
    metrica text,
    valor numeric not null default 0,
    updated_at timestamptz not null default now()
);

create unique index if not exists descentralizacoes_conta_saldos_ptres_key
    on public.descentralizacoes_conta_saldos (ptres);
