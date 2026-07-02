-- Grant select to anon and authenticated, and allow public select access on licitacoes_pncp tables
alter table public.licitacoes_pncp enable row level security;
alter table public.licitacoes_pncp_sync_runs enable row level security;
alter table public.licitacoes_pncp_uasgs enable row level security;

drop policy if exists "Authenticated users can read licitacoes pncp" on public.licitacoes_pncp;
drop policy if exists "Allow read access for all users on licitacoes pncp" on public.licitacoes_pncp;
create policy "Allow read access for all users on licitacoes pncp"
  on public.licitacoes_pncp for select using (true);

drop policy if exists "Authenticated users can read licitacoes pncp sync runs" on public.licitacoes_pncp_sync_runs;
drop policy if exists "Allow read access for all users on licitacoes pncp sync runs" on public.licitacoes_pncp_sync_runs;
create policy "Allow read access for all users on licitacoes pncp sync runs"
  on public.licitacoes_pncp_sync_runs for select using (true);

drop policy if exists "Authenticated users can read licitacoes pncp uasgs" on public.licitacoes_pncp_uasgs;
drop policy if exists "Allow read access for all users on licitacoes pncp uasgs" on public.licitacoes_pncp_uasgs;
create policy "Allow read access for all users on licitacoes pncp uasgs"
  on public.licitacoes_pncp_uasgs for select using (true);

grant select on public.licitacoes_pncp to authenticated, anon;
grant select on public.licitacoes_pncp_sync_runs to authenticated, anon;
grant select on public.licitacoes_pncp_uasgs to authenticated, anon;
