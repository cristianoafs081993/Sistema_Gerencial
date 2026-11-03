-- Do not reconcile a missing old reference while its process is in use.
create or replace function public.suap_reconcile_missing_pdf_references()
returns void language plpgsql security definer set search_path = public, storage as $$
declare v_name text;
begin
  for v_name in
    select p.pdf_url from public.processos p
      where p.pdf_url is not null and p.updated_at < now() - interval '3 days'
        and not exists (select 1 from storage.objects o where o.bucket_id = 'suap-pdfs' and o.name = p.pdf_url)
        and not exists (
          select 1 from public.process_extraction_jobs j
          where j.tenant_id = p.tenant_id and j.suap_id = p.suap_id
            and j.status in ('queued', 'processing', 'retryable')
            and (j.lease_expires_at > now() or j.updated_at > now() - interval '30 minutes')
        )
        and not exists (
          select 1 from public.suap_processo_documentos d
          where d.processo_id = p.id and d.tenant_id = p.tenant_id
            and d.download_status = 'downloading' and d.updated_at > now() - interval '30 minutes'
        )
    union
    select d.storage_path from public.suap_processo_documentos d
      join public.processos p on p.id = d.processo_id and p.tenant_id = d.tenant_id
      where d.storage_path is not null and d.download_status = 'downloaded'
        and d.downloaded_at < now() - interval '3 days'
        and not exists (select 1 from storage.objects o where o.bucket_id = 'suap-pdfs' and o.name = d.storage_path)
        and not exists (
          select 1 from public.process_extraction_jobs j
          where j.tenant_id = p.tenant_id and j.suap_id = p.suap_id
            and j.status in ('queued', 'processing', 'retryable')
            and (j.lease_expires_at > now() or j.updated_at > now() - interval '30 minutes')
        )
        and not exists (
          select 1 from public.suap_processo_documentos downloading
          where downloading.processo_id = p.id and downloading.tenant_id = p.tenant_id
            and downloading.download_status = 'downloading' and downloading.updated_at > now() - interval '30 minutes'
        )
        and not (p.status in ('pending_extraction', 'pdf_uploaded', 'queued_extraction', 'processing_extraction', 'processing_chunks', 'consolidating_extraction')
                 and p.updated_at > now() - interval '30 minutes')
  loop
    perform public.suap_clear_deleted_pdf_reference(v_name);
  end loop;
end;
$$;
revoke all on function public.suap_reconcile_missing_pdf_references() from public, anon, authenticated;
grant execute on function public.suap_reconcile_missing_pdf_references() to service_role;
