-- Sincronização do Plano 8 do SUAP com o planejamento Campus.

CREATE TABLE IF NOT EXISTS public.suap_connections (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_ciphertext text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_validated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suap_connections_user_idx
  ON public.suap_connections (user_id, org_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.suap_plan_sync_runs (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id integer NOT NULL CHECK (plan_id = 8),
  scope text NOT NULL CHECK (scope = 'campus'),
  mode text NOT NULL DEFAULT 'preview' CHECK (mode IN ('preview', 'apply')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'preview', 'success', 'failed', 'reauth_required')),
  source_url text NOT NULL,
  source_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  archived_count integer NOT NULL DEFAULT 0,
  checksum text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS suap_plan_sync_runs_lookup_idx
  ON public.suap_plan_sync_runs (org_id, plan_id, scope, started_at DESC);

CREATE TABLE IF NOT EXISTS public.suap_plan_activity_snapshots (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.suap_plan_sync_runs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  suap_plan_id integer NOT NULL CHECK (suap_plan_id = 8),
  suap_activity_id text NOT NULL,
  dimensao text NOT NULL,
  atividade text NOT NULL,
  componente_funcional text NOT NULL,
  origem_recurso text NOT NULL,
  origem_recurso_raw text NOT NULL,
  plano_interno text NOT NULL,
  valor_total numeric(16,2) NOT NULL DEFAULT 0,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, suap_activity_id)
);

CREATE INDEX IF NOT EXISTS suap_plan_activity_snapshots_lookup_idx
  ON public.suap_plan_activity_snapshots (run_id, suap_activity_id);

ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS sync_source text,
  ADD COLUMN IF NOT EXISTS suap_plan_id integer,
  ADD COLUMN IF NOT EXISTS suap_activity_id text,
  ADD COLUMN IF NOT EXISTS sync_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_last_seen_run_id uuid REFERENCES public.suap_plan_sync_runs(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'atividades_suap_activity_unique'
      AND conrelid = 'public.atividades'::regclass
  ) THEN
    ALTER TABLE public.atividades
      ADD CONSTRAINT atividades_suap_activity_unique
      UNIQUE (org_id, suap_plan_id, suap_activity_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS atividades_sync_lookup_idx
  ON public.atividades (org_id, sync_source, suap_plan_id, sync_active);

ALTER TABLE public.suap_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_plan_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_plan_activity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suap_connections_owner ON public.suap_connections;
CREATE POLICY suap_connections_owner ON public.suap_connections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS suap_plan_sync_runs_owner ON public.suap_plan_sync_runs;
CREATE POLICY suap_plan_sync_runs_owner ON public.suap_plan_sync_runs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS suap_plan_activity_snapshots_owner ON public.suap_plan_activity_snapshots;
CREATE POLICY suap_plan_activity_snapshots_owner ON public.suap_plan_activity_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suap_plan_sync_runs run
    WHERE run.id = run_id AND run.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.apply_suap_plan_snapshot(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.suap_plan_sync_runs%ROWTYPE;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_archived integer := 0;
BEGIN
  SELECT * INTO v_run
  FROM public.suap_plan_sync_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Execução SUAP não encontrada.';
  END IF;

  IF v_run.status <> 'running' THEN
    RAISE EXCEPTION 'Execução SUAP não está em andamento.';
  END IF;

  SELECT count(*) INTO v_inserted
  FROM public.suap_plan_activity_snapshots snapshot
  WHERE snapshot.run_id = p_run_id
    AND NOT EXISTS (
      SELECT 1 FROM public.atividades activity
      WHERE activity.org_id = v_run.org_id
        AND activity.suap_plan_id = snapshot.suap_plan_id
        AND activity.suap_activity_id = snapshot.suap_activity_id
    );

  SELECT count(*) INTO v_updated
  FROM public.suap_plan_activity_snapshots snapshot
  JOIN public.atividades activity
    ON activity.org_id = v_run.org_id
   AND activity.suap_plan_id = snapshot.suap_plan_id
   AND activity.suap_activity_id = snapshot.suap_activity_id
  WHERE snapshot.run_id = p_run_id;

  INSERT INTO public.atividades (
    org_id, dimensao, componente_funcional, tipo_atividade, atividade, descricao,
    valor_total, origem_recurso, natureza_despesa, plano_interno, processo,
    sync_source, suap_plan_id, suap_activity_id, sync_active, sync_last_seen_run_id,
    dimensao_id, created_at, updated_at
  )
  SELECT
    snapshot.org_id,
    snapshot.dimensao,
    snapshot.componente_funcional,
    'campus',
    snapshot.atividade,
    snapshot.atividade,
    snapshot.valor_total,
    snapshot.origem_recurso,
    '',
    snapshot.plano_interno,
    '',
    'suap_plan_8',
    snapshot.suap_plan_id,
    snapshot.suap_activity_id,
    true,
    p_run_id,
    dimensao.id,
    now(),
    now()
  FROM public.suap_plan_activity_snapshots snapshot
  LEFT JOIN public.dimensoes dimensao ON dimensao.codigo = split_part(snapshot.dimensao, ' - ', 1)
  WHERE snapshot.run_id = p_run_id
  ON CONFLICT (org_id, suap_plan_id, suap_activity_id) DO UPDATE SET
    dimensao = EXCLUDED.dimensao,
    dimensao_id = EXCLUDED.dimensao_id,
    componente_funcional = EXCLUDED.componente_funcional,
    tipo_atividade = EXCLUDED.tipo_atividade,
    atividade = EXCLUDED.atividade,
    descricao = EXCLUDED.descricao,
    valor_total = EXCLUDED.valor_total,
    origem_recurso = EXCLUDED.origem_recurso,
    natureza_despesa = EXCLUDED.natureza_despesa,
    plano_interno = EXCLUDED.plano_interno,
    processo = EXCLUDED.processo,
    sync_source = EXCLUDED.sync_source,
    sync_active = true,
    sync_last_seen_run_id = EXCLUDED.sync_last_seen_run_id,
    updated_at = now();

  UPDATE public.atividades activity
  SET sync_active = false, updated_at = now()
  WHERE activity.org_id = v_run.org_id
    AND activity.sync_source = 'suap_plan_8'
    AND activity.suap_plan_id = v_run.plan_id
    AND activity.tipo_atividade = v_run.scope
    AND activity.sync_active
    AND NOT EXISTS (
      SELECT 1
      FROM public.suap_plan_activity_snapshots snapshot
      WHERE snapshot.run_id = p_run_id
        AND snapshot.suap_plan_id = activity.suap_plan_id
        AND snapshot.suap_activity_id = activity.suap_activity_id
    );

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  UPDATE public.suap_plan_sync_runs
  SET status = 'success', mode = 'apply', finished_at = now(),
      source_count = (SELECT count(*) FROM public.suap_plan_activity_snapshots WHERE run_id = p_run_id),
      inserted_count = v_inserted, updated_count = v_updated, archived_count = v_archived
  WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'archived', v_archived
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_suap_plan_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_suap_plan_snapshot(uuid) TO service_role;

COMMENT ON TABLE public.suap_plan_sync_runs IS 'Histórico das sincronizações do Plano 8 do SUAP.';
COMMENT ON TABLE public.suap_plan_activity_snapshots IS 'Snapshot bruto e normalizado de cada captura do Plano 8.';
