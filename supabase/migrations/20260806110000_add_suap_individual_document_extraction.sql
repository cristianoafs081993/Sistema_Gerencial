-- Piloto de extracao SUAP por documentos individuais.
CREATE TABLE IF NOT EXISTS public.suap_processo_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  suap_documento_id text NOT NULL,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  titulo text NOT NULL,
  tipo text NULL,
  url_original text NOT NULL,
  classificacao text NOT NULL CHECK (classificacao IN ('included', 'excluded')),
  motivo_classificacao text NULL,
  download_status text NOT NULL DEFAULT 'pending' CHECK (download_status IN ('pending', 'downloading', 'downloaded', 'failed')),
  storage_path text NULL,
  byte_size bigint NULL CHECK (byte_size IS NULL OR byte_size >= 0),
  page_count integer NULL CHECK (page_count IS NULL OR page_count >= 0),
  download_error text NULL,
  downloaded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT suap_processo_documentos_unique UNIQUE (tenant_id, processo_id, suap_documento_id)
);

CREATE INDEX IF NOT EXISTS suap_processo_documentos_processo_idx
  ON public.suap_processo_documentos (tenant_id, processo_id, ordem);

ALTER TABLE public.suap_processo_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own SUAP process documents" ON public.suap_processo_documentos;
CREATE POLICY "Users can manage own SUAP process documents"
  ON public.suap_processo_documentos
  FOR ALL TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

ALTER TABLE public.process_extraction_jobs
  ADD COLUMN IF NOT EXISTS input_strategy text NOT NULL DEFAULT 'full'
    CHECK (input_strategy IN ('full', 'eligible_documents')),
  ADD COLUMN IF NOT EXISTS input_document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_run_id uuid NULL;

CREATE TABLE IF NOT EXISTS public.process_extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.process_extraction_jobs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suap_id text NOT NULL,
  input_strategy text NOT NULL CHECK (input_strategy IN ('full', 'eligible_documents')),
  input_document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  input_document_count integer NULL CHECK (input_document_count IS NULL OR input_document_count >= 0),
  input_byte_size bigint NULL CHECK (input_byte_size IS NULL OR input_byte_size >= 0),
  input_page_count integer NULL CHECK (input_page_count IS NULL OR input_page_count >= 0),
  stage_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text NULL,
  used_fallback boolean NOT NULL DEFAULT false,
  result_snapshot jsonb NULL,
  error_code text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  started_at timestamptz NULL,
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS process_extraction_runs_tenant_suap_idx
  ON public.process_extraction_runs (tenant_id, suap_id, created_at DESC);

ALTER TABLE public.process_extraction_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own extraction runs" ON public.process_extraction_runs;
CREATE POLICY "Users can read own extraction runs"
  ON public.process_extraction_runs
  FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'process_extraction_jobs_current_run_fkey'
  ) THEN
    ALTER TABLE public.process_extraction_jobs
      ADD CONSTRAINT process_extraction_jobs_current_run_fkey
      FOREIGN KEY (current_run_id) REFERENCES public.process_extraction_runs(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.enqueue_process_extraction_job(uuid, text, text, jsonb);

CREATE FUNCTION public.enqueue_process_extraction_job(
  p_tenant_id uuid,
  p_suap_id text,
  p_context_text text,
  p_provider_order jsonb DEFAULT '["gemini","openrouter"]'::jsonb,
  p_input_strategy text DEFAULT 'full',
  p_input_document_ids jsonb DEFAULT '[]'::jsonb,
  p_stage_metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS public.process_extraction_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.process_extraction_jobs;
  v_run_id uuid;
BEGIN
  IF p_input_strategy NOT IN ('full', 'eligible_documents') THEN
    RAISE EXCEPTION 'Unsupported process PDF input strategy: %', p_input_strategy;
  END IF;

  SELECT * INTO v_job
  FROM public.process_extraction_jobs
  WHERE tenant_id = p_tenant_id
    AND suap_id = p_suap_id
  FOR UPDATE;

  IF FOUND AND v_job.status = 'processing'
    AND v_job.lease_expires_at IS NOT NULL
    AND v_job.lease_expires_at >= timezone('utc', now()) THEN
    RETURN v_job;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.process_extraction_jobs (
      tenant_id, suap_id, status, attempt_count, lease_expires_at, context_text,
      provider_order, input_strategy, input_document_ids
    ) VALUES (
      p_tenant_id, p_suap_id, 'queued', 0, NULL, nullif(trim(coalesce(p_context_text, '')), ''),
      coalesce(p_provider_order, '["gemini","openrouter"]'::jsonb), p_input_strategy,
      coalesce(p_input_document_ids, '[]'::jsonb)
    ) RETURNING * INTO v_job;
  ELSE
    UPDATE public.process_extraction_jobs
      SET status = 'queued',
          attempt_count = CASE WHEN v_job.status IN ('completed', 'failed') THEN 0 ELSE v_job.attempt_count END,
          lease_expires_at = NULL,
          context_text = nullif(trim(coalesce(p_context_text, '')), ''),
          provider_order = coalesce(p_provider_order, '["gemini","openrouter"]'::jsonb),
          input_strategy = p_input_strategy,
          input_document_ids = coalesce(p_input_document_ids, '[]'::jsonb),
          last_error_code = NULL,
          last_error_message = NULL,
          result_provider = NULL,
          started_at = NULL,
          finished_at = NULL,
          updated_at = timezone('utc', now())
    WHERE id = v_job.id
    RETURNING * INTO v_job;
  END IF;

  INSERT INTO public.process_extraction_runs (
    job_id, tenant_id, suap_id, input_strategy, input_document_ids, stage_metrics
  ) VALUES (
    v_job.id, p_tenant_id, p_suap_id, p_input_strategy,
    coalesce(p_input_document_ids, '[]'::jsonb), coalesce(p_stage_metrics, '{}'::jsonb)
  ) RETURNING id INTO v_run_id;

  UPDATE public.process_extraction_jobs
    SET current_run_id = v_run_id,
        updated_at = timezone('utc', now())
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_process_extraction_job(uuid, text, text, jsonb, text, jsonb, jsonb)
  TO authenticated, service_role;
