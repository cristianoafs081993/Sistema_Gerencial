-- PDFs operacionais são cache recuperável do SUAP; dados extraídos e evidências ficam preservados.
alter table public.processos add column if not exists pdf_last_used_at timestamptz;

create table public.suap_pdf_retention_leases (
  object_id uuid primary key,
  object_path text not null unique,
  object_updated_at timestamptz not null,
  process_ids uuid[] not null,
  expires_at timestamptz not null default now()+interval '10 minutes'
);
create table public.suap_pdf_retention_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  deleted_count integer not null default 0,
  deleted_bytes bigint not null default 0,
  failed_count integer not null default 0,
  status text not null default 'running' check(status in ('running','completed','partial','failed')),
  error_message text
);
alter table public.suap_pdf_retention_leases enable row level security;
alter table public.suap_pdf_retention_runs enable row level security;
revoke all on public.suap_pdf_retention_leases,public.suap_pdf_retention_runs from public,anon,authenticated;
grant all on public.suap_pdf_retention_leases,public.suap_pdf_retention_runs to service_role;

create function public.touch_suap_process_pdf(p_processo_id uuid default null,p_storage_path text default null,p_suap_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.processos; touched boolean:=false;
begin
  perform pg_advisory_xact_lock(731901019::bigint);
  for item in select p.* from public.processos p
    where (p.tenant_id=auth.uid() or auth.role()='service_role') and (
      p.id=p_processo_id or p.pdf_url=p_storage_path or p.suap_id=p_suap_id
      or (p_storage_path is not null and split_part(p_storage_path,'/',1)=p.tenant_id::text
        and regexp_replace(split_part(p_storage_path,'/',2),'\.pdf$','')=p.suap_id))
    for update
  loop
    if exists(select 1 from public.suap_pdf_retention_leases l where l.expires_at>now()
      and (item.id=any(l.process_ids) or l.object_path=p_storage_path)) then
      raise exception 'O PDF está sendo liberado do cache. Tente novamente em instantes.' using errcode='55P03';
    end if;
    update public.processos set pdf_last_used_at=clock_timestamp()
      where id=item.id and (pdf_last_used_at is null or pdf_last_used_at<now()-interval '15 minutes');
    touched:=true;
  end loop;
  return touched;
end $$;
revoke all on function public.touch_suap_process_pdf(uuid,text,text) from public,anon;
grant execute on function public.touch_suap_process_pdf(uuid,text,text) to authenticated,service_role;

create function public.suap_pdf_retention_candidates()
returns table(object_id uuid,object_path text,object_updated_at timestamptz,byte_size bigint,process_ids uuid[])
language sql security definer set search_path='' as $$
  with objects as (
    select o.id,o.name,o.updated_at,coalesce((o.metadata->>'size')::bigint,0) bytes,
      array(select p.id from public.processos p where p.pdf_url=o.name or (
        p.tenant_id::text=split_part(o.name,'/',1)
        and p.suap_id=regexp_replace(split_part(o.name,'/',2),'\.pdf$',''))) ids
    from storage.objects o
    where o.bucket_id='suap-pdfs'
      and o.name ~ '^[0-9a-f-]{36}/[0-9]+(\.pdf|/documents/[0-9]+\.pdf)$'
      and greatest(o.created_at,o.updated_at,o.last_accessed_at)<now()-interval '7 days'
  )
  select o.id,o.name,o.updated_at,o.bytes,o.ids from objects o
  where not exists(select 1 from public.processos p where p.id=any(o.ids)
    and coalesce(p.pdf_last_used_at,p.updated_at,p.created_at)>=now()-interval '7 days')
  and not exists(select 1 from public.process_extraction_jobs j join public.processos p
    on p.tenant_id=j.tenant_id and p.suap_id=j.suap_id
    where p.id=any(o.ids) and j.status in ('queued','processing')
    and (j.lease_expires_at>now() or j.updated_at>now()-interval '1 day'))
  and not exists(select 1 from public.siafi_liquidacao_analises a where a.processo_id=any(o.ids)
    and (a.created_at>=now()-interval '7 days' or (a.status in ('queued','processing')
      and (a.lease_expires_at>now() or a.created_at>now()-interval '1 day'))))
  and not exists(select 1 from public.extension_process_registry r join public.processos p
    on r.tenant_id=p.tenant_id and r.suap_id=p.suap_id
    where p.id=any(o.ids) and r.updated_at>=now()-interval '1 day');
$$;
revoke all on function public.suap_pdf_retention_candidates() from public,anon,authenticated;
grant execute on function public.suap_pdf_retention_candidates() to service_role;

create function public.claim_suap_pdf_retention(p_limit integer default 50)
returns table(object_id uuid,object_path text,object_updated_at timestamptz,byte_size bigint,process_ids uuid[])
language plpgsql security definer set search_path='' as $$
declare candidate record;
begin
  perform pg_advisory_xact_lock(731901019::bigint);
  for candidate in select c.* from public.suap_pdf_retention_candidates() c
    where not exists(select 1 from public.suap_pdf_retention_leases l where l.object_id=c.object_id and l.expires_at>now())
    order by c.object_updated_at,c.object_id limit greatest(1,least(coalesce(p_limit,50),100))
  loop
    insert into public.suap_pdf_retention_leases as existing(object_id,object_path,object_updated_at,process_ids,expires_at)
      values(candidate.object_id,candidate.object_path,candidate.object_updated_at,candidate.process_ids,now()+interval '10 minutes')
      on conflict on constraint suap_pdf_retention_leases_pkey do update set
        object_updated_at=excluded.object_updated_at,process_ids=excluded.process_ids,expires_at=excluded.expires_at;
    return query select candidate.object_id,candidate.object_path,candidate.object_updated_at,candidate.byte_size,candidate.process_ids;
  end loop;
end $$;

create function public.confirm_suap_pdf_retention(p_object_id uuid)
returns boolean language sql security definer set search_path='' as $$
  select exists(select 1 from public.suap_pdf_retention_leases l
    join public.suap_pdf_retention_candidates() c on c.object_id=l.object_id
      and c.object_path=l.object_path and c.object_updated_at=l.object_updated_at
    where l.object_id=p_object_id and l.expires_at>now());
$$;

create function public.finish_suap_pdf_retention(p_object_id uuid,p_deleted boolean)
returns void language plpgsql security definer set search_path='' as $$
declare item public.suap_pdf_retention_leases;
begin
  perform pg_advisory_xact_lock(731901019::bigint);
  select * into item from public.suap_pdf_retention_leases where object_id=p_object_id for update;
  if not found then return; end if;
  if p_deleted then
    if exists(select 1 from storage.objects where bucket_id='suap-pdfs' and name=item.object_path) then
      raise exception 'O objeto ainda existe no Storage; referências preservadas';
    end if;
    update public.processos set pdf_last_used_at=coalesce(pdf_last_used_at,updated_at,created_at),pdf_url=null
      where pdf_url=item.object_path;
    update public.suap_processo_documentos set storage_path=null,download_status='pending',byte_size=null,
      downloaded_at=null,download_error='PDF liberado após 7 dias sem uso; pode ser obtido novamente do SUAP.'
      where storage_path=item.object_path;
  end if;
  delete from public.suap_pdf_retention_leases where object_id=p_object_id;
end $$;
revoke all on function public.claim_suap_pdf_retention(integer),public.confirm_suap_pdf_retention(uuid),public.finish_suap_pdf_retention(uuid,boolean) from public,anon,authenticated;
grant execute on function public.claim_suap_pdf_retention(integer),public.confirm_suap_pdf_retention(uuid),public.finish_suap_pdf_retention(uuid,boolean) to service_role;

-- Recover references if the worker stops after Storage deletion but before finalization.
create function public.reconcile_suap_pdf_retention() returns integer
language plpgsql security definer set search_path='' as $$
declare item record; repaired integer:=0;
begin
  for item in select l.object_id from public.suap_pdf_retention_leases l where l.expires_at<now()
    and not exists(select 1 from storage.objects o where o.bucket_id='suap-pdfs' and o.name=l.object_path)
  loop
    perform public.finish_suap_pdf_retention(item.object_id,true); repaired:=repaired+1;
  end loop;
  return repaired;
end $$;
revoke all on function public.reconcile_suap_pdf_retention() from public,anon,authenticated;
grant execute on function public.reconcile_suap_pdf_retention() to service_role;
