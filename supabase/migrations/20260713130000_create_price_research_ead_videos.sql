create table if not exists public.price_research_ead_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  youtube_url text not null,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_price_research_ead_videos_active_order
  on public.price_research_ead_videos (is_active, sort_order, created_at);

drop trigger if exists trg_update_price_research_ead_videos_updated_at on public.price_research_ead_videos;
create trigger trg_update_price_research_ead_videos_updated_at
before update on public.price_research_ead_videos
for each row execute function update_updated_at_column();

alter table public.price_research_ead_videos enable row level security;

drop policy if exists "Authenticated users can read active price research EAD videos"
  on public.price_research_ead_videos;
create policy "Authenticated users can read active price research EAD videos"
  on public.price_research_ead_videos for select to authenticated
  using (is_active or public.is_superadmin_jwt());

drop policy if exists "Superadmins can create price research EAD videos"
  on public.price_research_ead_videos;
create policy "Superadmins can create price research EAD videos"
  on public.price_research_ead_videos for insert to authenticated
  with check (public.is_superadmin_jwt());

drop policy if exists "Superadmins can update price research EAD videos"
  on public.price_research_ead_videos;
create policy "Superadmins can update price research EAD videos"
  on public.price_research_ead_videos for update to authenticated
  using (public.is_superadmin_jwt())
  with check (public.is_superadmin_jwt());

drop policy if exists "Superadmins can delete price research EAD videos"
  on public.price_research_ead_videos;
create policy "Superadmins can delete price research EAD videos"
  on public.price_research_ead_videos for delete to authenticated
  using (public.is_superadmin_jwt());

grant select on public.price_research_ead_videos to authenticated;
grant insert, update, delete on public.price_research_ead_videos to authenticated;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values ('pesquisa-precos-ead', 'licitacoes', 'Capacitacao EAD', '/pesquisa-precos/ead', 6, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;
