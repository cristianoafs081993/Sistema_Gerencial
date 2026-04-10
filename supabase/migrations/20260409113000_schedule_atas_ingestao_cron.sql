create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists vault;

create schema if not exists util;

create or replace function util.invoke_atas_ingestao(request_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
as $$
declare
  project_url text;
  publishable_key text;
  cron_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into publishable_key
  from vault.decrypted_secrets
  where name = 'publishable_key';

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'atas_cron_secret';

  if project_url is null or project_url = '' then
    raise exception 'Secret project_url nao encontrada no vault.';
  end if;

  if publishable_key is null or publishable_key = '' then
    raise exception 'Secret publishable_key nao encontrada no vault.';
  end if;

  if cron_secret is null or cron_secret = '' then
    raise exception 'Secret atas_cron_secret nao encontrada no vault.';
  end if;

  return net.http_post(
    url := project_url || '/functions/v1/atas-ingest-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || publishable_key,
      'x-cron-secret', cron_secret
    ),
    body := request_body,
    timeout_milliseconds := 120000
  );
end;
$$;

create or replace function util.unschedule_atas_ingestao()
returns void
language plpgsql
security definer
as $$
declare
  job_record record;
begin
  for job_record in
    select jobid
    from cron.job
    where jobname = 'atas-ingestao-diaria'
  loop
    perform cron.unschedule(job_record.jobid);
  end loop;
end;
$$;

create or replace function util.schedule_atas_ingestao(
  cron_expression text default '15 6 * * *',
  request_body jsonb default '{"trigger":"cron"}'::jsonb
)
returns bigint
language plpgsql
security definer
as $$
declare
  scheduled_job_id bigint;
begin
  perform util.unschedule_atas_ingestao();

  select cron.schedule(
    'atas-ingestao-diaria',
    cron_expression,
    format(
      $sql$
        select util.invoke_atas_ingestao(%L::jsonb);
      $sql$,
      request_body::text
    )
  )
  into scheduled_job_id;

  return scheduled_job_id;
end;
$$;
