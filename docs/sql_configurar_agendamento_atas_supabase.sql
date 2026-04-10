-- 1. Salve os segredos necessarios no Vault
-- Ajuste os valores antes de executar.
select vault.create_secret('https://mnqhwyrzhgykjlyyqodd.supabase.co', 'project_url', 'URL do projeto Supabase');
select vault.create_secret('COLE_AQUI_A_PUBLISHABLE_KEY_DO_SUPABASE', 'publishable_key', 'Publishable key para invocar Edge Functions');
select vault.create_secret('COLE_AQUI_UM_SEGREDO_FORTE_PARA_CRON', 'atas_cron_secret', 'Segredo interno para o cron da ingestao de atas');

-- 2. Agenda a ingestao diaria as 06:15
select util.schedule_atas_ingestao(
  '15 6 * * *',
  jsonb_build_object(
    'trigger', 'cron',
    'pageSize', 100,
    'maxPages', 5
  )
);

-- 3. Consulta os jobs configurados
select
  jobid,
  jobname,
  schedule,
  command,
  active
from cron.job
where jobname = 'atas-ingestao-diaria';

-- 4. Consulta as ultimas execucoes do cron
select
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
from cron.job_run_details
where jobid in (
  select jobid
  from cron.job
  where jobname = 'atas-ingestao-diaria'
)
order by start_time desc
limit 20;
