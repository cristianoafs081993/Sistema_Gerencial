-- Pause the PNCP batch while its Vault service-role credential is unavailable.
-- This only removes the pg_cron schedule; it preserves the function, queue state,
-- cached documents, and allows explicit authenticated refreshes from the UI.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'sync-contratos-pncp-documentos-batch';
