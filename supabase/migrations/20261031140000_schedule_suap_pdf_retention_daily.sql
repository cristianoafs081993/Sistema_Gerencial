-- pg_cron uses UTC: 06:15 UTC corresponds to 03:15 in Brasilia.
do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'cleanup-suap-pdfs';
  if v_job_id is null then
    raise exception 'Job cleanup-suap-pdfs não encontrado';
  end if;
  perform cron.alter_job(v_job_id, schedule := '15 6 * * *');
end;
$$;
