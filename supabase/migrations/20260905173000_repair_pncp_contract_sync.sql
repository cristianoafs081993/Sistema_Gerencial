-- Track attempts separately from successful document/invoice checks.
ALTER TABLE public.contratos_api
  ADD COLUMN IF NOT EXISTS pncp_sync_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pncp_sync_error text;
CREATE INDEX IF NOT EXISTS idx_contratos_api_pncp_sync_attempt
  ON public.contratos_api (pncp_sync_attempted_at ASC NULLS FIRST, id);

-- Recheck legacy results, including false negatives, without deleting any documents.
UPDATE public.contratos_api SET pncp_documentos_checked_at = NULL,
  pncp_instrumentos_checked_at = NULL, pncp_sync_attempted_at = NULL;

-- Configure the service_role JWT in Supabase Vault as pncp_sync_service_role_key
-- (or reuse service_role_key). Never put a credential in migration source/cron text.
CREATE OR REPLACE FUNCTION public.enqueue_pncp_contract_sync()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  token text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets
    WHERE name IN ('pncp_sync_service_role_key', 'service_role_key')
    ORDER BY CASE name WHEN 'pncp_sync_service_role_key' THEN 0 ELSE 1 END LIMIT 1;
  IF token IS NULL OR token = '' THEN
    RAISE EXCEPTION 'Configure pncp_sync_service_role_key in Supabase Vault before running PNCP sync';
  END IF;
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-contratos-pncp-documentos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || token),
    body := '{"source":"supabase-cron","limit":5}'::jsonb,
    timeout_milliseconds := 110000
  ) INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_pncp_contract_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_pncp_contract_sync() TO service_role;
SELECT cron.unschedule(jobid) FROM cron.job
  WHERE jobname IN ('sync-contratos-pncp-documentos-daily', 'sync-contratos-pncp-documentos-batch');
SELECT cron.schedule('sync-contratos-pncp-documentos-batch', '*/5 * * * *',
  'SELECT public.enqueue_pncp_contract_sync();');
