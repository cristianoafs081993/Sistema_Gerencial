-- Configure the same secret in Supabase Vault (price_sync_secret) and
-- Edge Function secrets (PRICE_SYNC_SECRET) before the first scheduled run.
create or replace function public.dispatch_price_sync(mode text) returns bigint
language plpgsql security definer set search_path = public as $$
declare sync_secret text; request_id bigint;
begin
  if mode not in ('daily_delta','generate_embeddings') then raise exception 'Invalid mode'; end if;
  select decrypted_secret into sync_secret from vault.decrypted_secrets where name = 'price_sync_secret' limit 1;
  if coalesce(sync_secret,'') = '' then raise exception 'Configure price_sync_secret in Vault and PRICE_SYNC_SECRET in Edge secrets'; end if;
  select net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-precos-referencia',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-secret',sync_secret),
    body := jsonb_build_object('mode',mode,'scope','federal_rn_nordeste','generateEmbeddings',true),
    timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end; $$;
revoke all on function public.dispatch_price_sync(text) from public, anon, authenticated;
grant execute on function public.dispatch_price_sync(text) to service_role;
select cron.unschedule(jobid) from cron.job where jobname in ('sync-precos-referencia-daily','sync-precos-referencia-resume','precos-embeddings-pending');
select cron.schedule('sync-precos-referencia-daily','0 4 * * *', $$select public.dispatch_price_sync('daily_delta');$$);
select cron.schedule('sync-precos-referencia-resume','*/10 * * * *', $$
  select public.dispatch_price_sync('daily_delta') where exists (
    select 1 from public.preco_referencia_sync_runs where tipo_sync='daily_delta'
      and cursor_data->>'version'='2' and status in ('partial_success','error','running')
      and (lease_until is null or lease_until < now())
  );$$);
select cron.schedule('precos-embeddings-pending','15 * * * *', $$
  select public.dispatch_price_sync('generate_embeddings') where exists (
    select 1 from public.preco_referencia_itens where embedding is null or embedding_model is null
  );$$);
