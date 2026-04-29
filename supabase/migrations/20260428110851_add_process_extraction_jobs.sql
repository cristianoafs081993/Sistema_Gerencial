create extension if not exists pgcrypto;
create table if not exists public.process_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  suap_id text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'retryable', 'completed', 'failed')),
  attempt_count integer not null default 0,
  lease_expires_at timestamptz null,
  context_text text null,
  provider_order jsonb not null default '["gemini","openrouter"]'::jsonb,
  last_error_code text null,
  last_error_message text null,
  result_provider text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz null,
  finished_at timestamptz null,
  constraint process_extraction_jobs_tenant_suap_unique unique (tenant_id, suap_id)
);
create index if not exists process_extraction_jobs_status_idx
  on public.process_extraction_jobs (status, updated_at desc);
create table if not exists public.process_extraction_job_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.process_extraction_jobs (id) on delete cascade,
  chunk_index integer not null,
  page_start integer not null,
  page_end integer not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  provider text null,
  partial_result jsonb null,
  last_error_code text null,
  last_error_message text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint process_extraction_job_chunks_job_chunk_unique unique (job_id, chunk_index)
);
create index if not exists process_extraction_job_chunks_job_status_idx
  on public.process_extraction_job_chunks (job_id, status, chunk_index);
alter table public.process_extraction_jobs enable row level security;
alter table public.process_extraction_job_chunks enable row level security;
drop policy if exists "Users can read own extraction jobs" on public.process_extraction_jobs;
create policy "Users can read own extraction jobs"
  on public.process_extraction_jobs
  for select
  to authenticated
  using (auth.uid() = tenant_id);
drop policy if exists "Users can read own extraction job chunks" on public.process_extraction_job_chunks;
create policy "Users can read own extraction job chunks"
  on public.process_extraction_job_chunks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.process_extraction_jobs jobs
      where jobs.id = process_extraction_job_chunks.job_id
        and jobs.tenant_id = auth.uid()
    )
  );
create or replace function public.enqueue_process_extraction_job(
  p_tenant_id uuid,
  p_suap_id text,
  p_context_text text,
  p_provider_order jsonb default '["gemini","openrouter"]'::jsonb
)
returns public.process_extraction_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.process_extraction_jobs;
begin
  insert into public.process_extraction_jobs (
    tenant_id,
    suap_id,
    status,
    attempt_count,
    lease_expires_at,
    context_text,
    provider_order,
    last_error_code,
    last_error_message,
    result_provider,
    created_at,
    updated_at,
    started_at,
    finished_at
  )
  values (
    p_tenant_id,
    p_suap_id,
    'queued',
    0,
    null,
    nullif(trim(coalesce(p_context_text, '')), ''),
    coalesce(p_provider_order, '["gemini","openrouter"]'::jsonb),
    null,
    null,
    null,
    timezone('utc', now()),
    timezone('utc', now()),
    null,
    null
  )
  on conflict (tenant_id, suap_id) do update
    set context_text = excluded.context_text,
        provider_order = excluded.provider_order,
        updated_at = timezone('utc', now()),
        status = case
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then 'queued'
          when public.process_extraction_jobs.status = 'processing'
            and (public.process_extraction_jobs.lease_expires_at is null or public.process_extraction_jobs.lease_expires_at < timezone('utc', now()))
            then 'queued'
          else public.process_extraction_jobs.status
        end,
        attempt_count = case
          when public.process_extraction_jobs.status in ('completed', 'failed')
            then 0
          else public.process_extraction_jobs.attempt_count
        end,
        lease_expires_at = case
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then null
          when public.process_extraction_jobs.status = 'processing'
            and (public.process_extraction_jobs.lease_expires_at is null or public.process_extraction_jobs.lease_expires_at < timezone('utc', now()))
            then null
          else public.process_extraction_jobs.lease_expires_at
        end,
        last_error_code = case
          when public.process_extraction_jobs.status = 'processing'
            and (public.process_extraction_jobs.lease_expires_at is null or public.process_extraction_jobs.lease_expires_at < timezone('utc', now()))
            then 'worker_limit'
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then null
          else public.process_extraction_jobs.last_error_code
        end,
        last_error_message = case
          when public.process_extraction_jobs.status = 'processing'
            and (public.process_extraction_jobs.lease_expires_at is null or public.process_extraction_jobs.lease_expires_at < timezone('utc', now()))
            then 'Worker lease expired before completion; retrying job.'
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then null
          else public.process_extraction_jobs.last_error_message
        end,
        result_provider = case
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then null
          else public.process_extraction_jobs.result_provider
        end,
        started_at = case
          when public.process_extraction_jobs.status in ('completed', 'failed')
            then null
          else public.process_extraction_jobs.started_at
        end,
        finished_at = case
          when public.process_extraction_jobs.status in ('completed', 'failed', 'retryable')
            then null
          else public.process_extraction_jobs.finished_at
        end
  returning * into v_job;

  return v_job;
end;
$$;
grant execute on function public.enqueue_process_extraction_job(uuid, text, text, jsonb) to authenticated, service_role;
create or replace function public.claim_process_extraction_job(
  p_job_id uuid,
  p_lease_seconds integer default 180,
  p_max_attempts integer default 3
)
returns setof public.process_extraction_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.process_extraction_jobs
     set status = 'processing',
         attempt_count = public.process_extraction_jobs.attempt_count + 1,
         lease_expires_at = timezone('utc', now()) + make_interval(secs => greatest(p_lease_seconds, 60)),
         started_at = coalesce(public.process_extraction_jobs.started_at, timezone('utc', now())),
         updated_at = timezone('utc', now()),
         last_error_code = null,
         last_error_message = null,
         finished_at = null
   where public.process_extraction_jobs.id = p_job_id
     and public.process_extraction_jobs.attempt_count < greatest(p_max_attempts, 1)
     and (
       public.process_extraction_jobs.status in ('queued', 'retryable')
       or (
         public.process_extraction_jobs.status = 'processing'
         and (
           public.process_extraction_jobs.lease_expires_at is null
           or public.process_extraction_jobs.lease_expires_at < timezone('utc', now())
         )
       )
     )
  returning *;
end;
$$;
grant execute on function public.claim_process_extraction_job(uuid, integer, integer) to service_role;
