CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-portal-transparencia-itens-cache-daily') THEN
    PERFORM cron.unschedule('refresh-portal-transparencia-itens-cache-daily');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-portal-transparencia-itens-cache-rap-daily') THEN
    PERFORM cron.unschedule('refresh-portal-transparencia-itens-cache-rap-daily');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-portal-transparencia-itens-cache-exercicio-daily') THEN
    PERFORM cron.unschedule('refresh-portal-transparencia-itens-cache-exercicio-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-portal-transparencia-itens-cache-rap-daily',
  '10 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/refresh-portal-transparencia-itens-cache',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"refreshPositiveEmpenhos": true, "empenhoTipo": "rap", "refreshDue": true, "refreshLinkedRequisicaoEmpenhos": true, "limit": 200, "source": "supabase-cron-rap-daily"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);

SELECT cron.schedule(
  'refresh-portal-transparencia-itens-cache-exercicio-daily',
  '30 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/refresh-portal-transparencia-itens-cache',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"refreshPositiveEmpenhos": true, "empenhoTipo": "exercicio", "limit": 200, "source": "supabase-cron-exercicio-daily"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
