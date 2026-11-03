-- Storage objects must only be removed through the Storage API. These RPCs
-- expose candidates and clear references after deletion. Active work is spared.
create or replace function public.suap_expired_pdf_candidates(p_limit integer default 50, p_name text default null)
returns table(object_name text, object_updated_at timestamptz, object_size bigint)
language sql security definer set search_path = public, storage as $$
  select o.name, greatest(o.created_at, coalesce(o.updated_at, o.created_at)),
         coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where o.bucket_id = 'suap-pdfs'
    and (p_name is null or o.name = p_name)
    and lower(o.name) like '%.pdf'
    and greatest(o.created_at, coalesce(o.updated_at, o.created_at)) < now() - interval '3 days'
    and not exists (
      select 1 from public.processos p
      where (p.pdf_url = o.name or (p.tenant_id::text = split_part(o.name, '/', 1)
              and p.suap_id = regexp_replace(split_part(o.name, '/', 2), '[.]pdf$', '', 'i')) or exists (
        select 1 from public.suap_processo_documentos d
        where d.processo_id = p.id and d.tenant_id = p.tenant_id
          and d.storage_path = o.name
      ))
        and (exists (
          select 1 from public.process_extraction_jobs j
          where j.tenant_id = p.tenant_id and j.suap_id = p.suap_id
            and j.status in ('queued', 'processing', 'retryable')
            and (j.lease_expires_at > now() or j.updated_at > now() - interval '30 minutes')
        ) or exists (
          select 1 from public.suap_processo_documentos d
          where d.processo_id = p.id and d.tenant_id = p.tenant_id and d.download_status = 'downloading'
            and d.updated_at > now() - interval '30 minutes'
        ) or (p.status in ('pending_extraction', 'pdf_uploaded', 'queued_extraction', 'processing_extraction', 'processing_chunks', 'consolidating_extraction')
              and p.updated_at > now() - interval '30 minutes'))
    )
  order by greatest(o.created_at, coalesce(o.updated_at, o.created_at)), o.name
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
create or replace function public.suap_clear_deleted_pdf_reference(p_name text)
returns void language plpgsql security definer set search_path = public, storage as $$
begin
  -- A newly uploaded object at the same path must retain its reference.
  if exists (select 1 from storage.objects where bucket_id = 'suap-pdfs' and name = p_name) then
    return;
  end if;
  -- Fail interrupted jobs so they do not resume using a removed input.
  update public.process_extraction_runs r
    set status = 'failed', error_code = 'pdf_expired',
        error_message = 'PDF removido após o prazo de retenção; baixe-o novamente.', finished_at = now()
    from public.process_extraction_jobs j, public.processos p
    where r.id = j.current_run_id and j.tenant_id = p.tenant_id and j.suap_id = p.suap_id
      and (p.pdf_url = p_name or exists (select 1 from public.suap_processo_documentos d where d.processo_id = p.id and d.storage_path = p_name))
      and j.status in ('queued', 'processing', 'retryable') and coalesce(j.lease_expires_at, '-infinity') <= now()
      and j.updated_at <= now() - interval '30 minutes' and r.status in ('queued', 'processing');
  update public.process_extraction_jobs j
    set status = 'failed', lease_expires_at = null, finished_at = now(), updated_at = now(),
        last_error_code = 'pdf_expired', last_error_message = 'PDF removido após o prazo de retenção; baixe-o novamente.'
    from public.processos p
    where j.tenant_id = p.tenant_id and j.suap_id = p.suap_id
      and (p.pdf_url = p_name or exists (select 1 from public.suap_processo_documentos d where d.processo_id = p.id and d.storage_path = p_name))
      and j.status in ('queued', 'processing', 'retryable') and coalesce(j.lease_expires_at, '-infinity') <= now()
      and j.updated_at <= now() - interval '30 minutes';
  update public.processos p set pdf_url = case when p.pdf_url = p_name then null else p.pdf_url end,
    status = case when p.status in ('pending_extraction', 'pdf_uploaded', 'queued_extraction', 'processing_extraction', 'processing_chunks', 'consolidating_extraction')
                       then 'extraction_failed' else p.status end
    where p.pdf_url = p_name or exists (select 1 from public.suap_processo_documentos d where d.processo_id = p.id and d.storage_path = p_name);
  update public.suap_processo_documentos
    set storage_path = null, download_status = 'pending', byte_size = null,
        page_count = null, downloaded_at = null, download_error = null
    where storage_path = p_name and download_status = 'downloaded';
end;
$$;
create or replace function public.suap_reconcile_missing_pdf_references()
returns void language plpgsql security definer set search_path = public, storage as $$
declare v_name text;
begin
  for v_name in
    select p.pdf_url from public.processos p where p.pdf_url is not null and p.updated_at < now() - interval '3 days'
      and not exists (select 1 from storage.objects o where o.bucket_id = 'suap-pdfs' and o.name = p.pdf_url)
    union
    select d.storage_path from public.suap_processo_documentos d where d.storage_path is not null and d.download_status = 'downloaded'
      and d.downloaded_at < now() - interval '3 days'
      and not exists (select 1 from storage.objects o where o.bucket_id = 'suap-pdfs' and o.name = d.storage_path)
  loop
    perform public.suap_clear_deleted_pdf_reference(v_name);
  end loop;
end;
$$;
revoke all on function public.suap_expired_pdf_candidates(integer, text) from public, anon, authenticated;
revoke all on function public.suap_clear_deleted_pdf_reference(text) from public, anon, authenticated;
revoke all on function public.suap_reconcile_missing_pdf_references() from public, anon, authenticated;
grant execute on function public.suap_expired_pdf_candidates(integer, text) to service_role;
grant execute on function public.suap_clear_deleted_pdf_reference(text) to service_role;
grant execute on function public.suap_reconcile_missing_pdf_references() to service_role;
-- A dedicated shared secret must exist both in Vault and Edge Function secrets.
create or replace function public.dispatch_suap_pdf_retention()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_secret text; v_request bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name = 'suap_pdf_retention_secret' limit 1;
  if coalesce(v_secret, '') = '' then raise exception 'Missing suap_pdf_retention_secret'; end if;
  select net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/cleanup-suap-pdfs',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-retention-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 120000
  ) into v_request;
  return v_request;
end;
$$;
revoke all on function public.dispatch_suap_pdf_retention() from public, anon, authenticated;
grant execute on function public.dispatch_suap_pdf_retention() to service_role;
select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-suap-pdfs';
select cron.schedule('cleanup-suap-pdfs', '15 * * * *', $$select public.dispatch_suap_pdf_retention();$$);
