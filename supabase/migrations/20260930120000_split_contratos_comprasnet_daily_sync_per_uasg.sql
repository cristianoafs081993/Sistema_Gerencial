-- O job diario unico chamava sync-contratos-comprasnet para as 19 UASGs em uma unica requisicao.
-- A Edge Function estourava o tempo limite depois de ~2 unidades (deixando a execucao em 'running'),
-- entao a UASG do campus (158366) nunca era alcancada e o dado parou em 07/09/2026.
-- Agora cada UASG tem seu proprio job, escalonado de 5 em 5 minutos a partir das 06:00 UTC (03:00 Brasilia),
-- com o campus (158366) e a Reitoria (158155) primeiro.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname = 'sync-contratos-comprasnet-daily' OR jobname LIKE 'sync-contratos-comprasnet-uasg-%';

DO $$
DECLARE
  uasgs text[] := ARRAY[
    '158366', '158155', '152711', '152756', '152757', '154582', '154838', '154839', '154840',
    '158365', '158367', '158368', '158369', '158370', '158371', '158372', '158373', '158374', '158375'
  ];
  uasg text;
  idx int := 0;
  total_min int;
BEGIN
  FOREACH uasg IN ARRAY uasgs LOOP
    total_min := idx * 5;
    PERFORM cron.schedule(
      'sync-contratos-comprasnet-uasg-' || uasg,
      ((total_min % 60)::text || ' ' || (6 + total_min / 60)::text || ' * * *'),
      format(
        $job$SELECT net.http_post(
          url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-contratos-comprasnet',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{"source": "supabase-cron-daily", "unidadeCodigo": "%s"}'::jsonb,
          timeout_milliseconds := 300000
        );$job$,
        uasg
      )
    );
    idx := idx + 1;
  END LOOP;
END $$;

-- Execucoes abandonadas pelo estouro de tempo ficam eternamente 'running'; fecha-as como erro.
UPDATE public.contratos_api_sync_runs
SET status = 'error',
    finished_at = COALESCE(finished_at, now()),
    error_message = COALESCE(error_message, 'Execucao interrompida por tempo limite (job unico de 19 UASGs).')
WHERE status = 'running' AND started_at < now() - interval '1 hour';
