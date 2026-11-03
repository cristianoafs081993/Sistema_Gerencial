-- Internal, project-specific secret, created in Vault and never embedded in source/cron text.
do $$begin
  if not exists(select 1 from vault.secrets where name='suap_pdf_retention_secret') then
    perform vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'suap_pdf_retention_secret','Autenticação interna da retenção de PDFs SUAP');
  end if;
end $$;
create function public.validate_suap_pdf_retention_secret(p_secret text) returns boolean
language sql security definer set search_path='' as $$
  select length(coalesce(p_secret,''))>=64 and exists(select 1 from vault.decrypted_secrets where name='suap_pdf_retention_secret' and decrypted_secret=p_secret);
$$;
revoke all on function public.validate_suap_pdf_retention_secret(text) from public,anon,authenticated;
grant execute on function public.validate_suap_pdf_retention_secret(text) to service_role;
create function public.dispatch_suap_pdf_retention() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text;request_id bigint;
begin
  select decrypted_secret into token from vault.decrypted_secrets where name='suap_pdf_retention_secret' limit 1;
  if coalesce(token,'')='' then raise exception 'Segredo da retenção não configurado'; end if;
  select net.http_post(url:='https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/cleanup-suap-pdfs',
    headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-secret',token),
    body:='{}'::jsonb,timeout_milliseconds:=120000) into request_id;
  return request_id;
end $$;
revoke all on function public.dispatch_suap_pdf_retention() from public,anon,authenticated;
grant execute on function public.dispatch_suap_pdf_retention() to service_role;
select cron.unschedule(jobid) from cron.job where jobname='suap-pdf-retention-hourly';
select cron.schedule('suap-pdf-retention-hourly','17 * * * *','select public.dispatch_suap_pdf_retention();');
