-- ==============================================================================
-- Agendamento diário do job de sincronização de preços de referência (últimas 24h/48h)
-- Executa todas as noites às 04:00 UTC (01:00 Horário de Brasília)
-- ==============================================================================

select cron.unschedule('sync-precos-referencia-daily')
where exists (
  select 1 from cron.job where jobname = 'sync-precos-referencia-daily'
);

select cron.schedule(
  'sync-precos-referencia-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-precos-referencia',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"mode": "daily_delta", "scope": "federal_rn_nordeste", "generateEmbeddings": true}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
