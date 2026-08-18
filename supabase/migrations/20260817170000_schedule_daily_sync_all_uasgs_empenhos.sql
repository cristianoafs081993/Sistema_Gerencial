-- Migration: Sincronização diária de contratos e empenhos de todas as 19 UASGs do IFRN via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Reagenda o job diário de contratos e empenhos do Comprasnet para todas as UASGs às 06:00 UTC (03:00 Brasília)
SELECT cron.unschedule('sync-contratos-comprasnet-daily')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-contratos-comprasnet-daily'
);

SELECT cron.schedule(
  'sync-contratos-comprasnet-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-contratos-comprasnet',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "supabase-cron-daily"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
