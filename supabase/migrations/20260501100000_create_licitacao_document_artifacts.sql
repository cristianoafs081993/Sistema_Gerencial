create table if not exists public.licitacao_document_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_type text not null check (artifact_type in ('etp', 'mapa_riscos', 'termo_referencia', 'minuta_contrato')),
  process_id uuid references public.processos(id) on delete set null,
  process_number text,
  manual_object text,
  title text not null,
  subtitle text,
  html_content text not null,
  plain_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  source_artifact_ids uuid[] not null default '{}'::uuid[],
  template_id uuid references public.document_templates(id) on delete set null,
  docx_export_plan jsonb,
  docx_file_name text,
  created_by uuid default auth.uid(),
  created_by_email text default lower(coalesce(auth.jwt() ->> 'email', '')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_licitacao_document_artifacts_type
  on public.licitacao_document_artifacts (artifact_type, updated_at desc);

create index if not exists idx_licitacao_document_artifacts_process
  on public.licitacao_document_artifacts (process_id, artifact_type, version desc);

create index if not exists idx_licitacao_document_artifacts_process_number
  on public.licitacao_document_artifacts (process_number);

alter table public.licitacao_document_artifacts enable row level security;

drop policy if exists "Authenticated users can read licitacao artifacts" on public.licitacao_document_artifacts;
create policy "Authenticated users can read licitacao artifacts"
  on public.licitacao_document_artifacts
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert own licitacao artifacts" on public.licitacao_document_artifacts;
create policy "Authenticated users can insert own licitacao artifacts"
  on public.licitacao_document_artifacts
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Creators and superadmins can update licitacao artifacts" on public.licitacao_document_artifacts;
create policy "Creators and superadmins can update licitacao artifacts"
  on public.licitacao_document_artifacts
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_superadmin_jwt()
  )
  with check (
    created_by = auth.uid()
    or public.is_superadmin_jwt()
  );

drop policy if exists "Creators and superadmins can delete licitacao artifacts" on public.licitacao_document_artifacts;
create policy "Creators and superadmins can delete licitacao artifacts"
  on public.licitacao_document_artifacts
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_superadmin_jwt()
  );

grant select, insert, update, delete on public.licitacao_document_artifacts to authenticated;

insert into public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
values ('artefatos-licitacao', 'documentos', 'Artefatos de Licitacao', '/artefatos-licitacao', 25, false, true)
on conflict (id) do update
set screen_group_id = excluded.screen_group_id,
    name = excluded.name,
    path = excluded.path,
    sort_order = excluded.sort_order,
    is_admin_only = excluded.is_admin_only,
    is_active = excluded.is_active;

insert into public.user_group_screen_permissions (group_id, screen_id, can_access)
select groups.id, 'artefatos-licitacao', true
from public.user_groups groups
where groups.slug = 'diretores'
on conflict (group_id, screen_id) do update
set can_access = excluded.can_access,
    updated_at = now();
