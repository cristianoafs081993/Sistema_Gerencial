ALTER TABLE contratos_api
  ADD COLUMN IF NOT EXISTS situacao_derivada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vigencia_inicio_derivada DATE,
  ADD COLUMN IF NOT EXISTS vigencia_fim_derivada DATE,
  ADD COLUMN IF NOT EXISTS situacao_derivada_motivo TEXT,
  ADD COLUMN IF NOT EXISTS campus_scope_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_contratos_api_situacao_derivada
  ON contratos_api(situacao_derivada, vigencia_fim_derivada);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('sync-contratos-comprasnet-6h')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-contratos-comprasnet-6h'
);

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
