-- Isola o Plano 8 por unidade selecionada no SUAP e permite sincronização em lote.

CREATE TABLE IF NOT EXISTS public.suap_plan_sync_batches (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id integer NOT NULL CHECK (plan_id = 8),
  scope text NOT NULL CHECK (scope = 'campus'),
  mode text NOT NULL DEFAULT 'apply' CHECK (mode IN ('preview', 'apply')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'preview', 'success', 'partial', 'failed')),
  requested_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  preview_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS suap_plan_sync_batches_lookup_idx
  ON public.suap_plan_sync_batches (org_id, plan_id, started_at DESC);

ALTER TABLE public.suap_plan_sync_runs
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.suap_plan_sync_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suap_unit_code text NOT NULL DEFAULT '19',
  ADD COLUMN IF NOT EXISTS campus_uasg text NOT NULL DEFAULT '158366';

ALTER TABLE public.suap_plan_activity_snapshots
  ADD COLUMN IF NOT EXISTS suap_unit_code text NOT NULL DEFAULT '19',
  ADD COLUMN IF NOT EXISTS campus_uasg text NOT NULL DEFAULT '158366';

ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS suap_unit_code text;

UPDATE public.atividades
SET suap_unit_code = '19'
WHERE sync_source = 'suap_plan_8'
  AND suap_plan_id = 8
  AND suap_unit_code IS NULL;

ALTER TABLE public.suap_plan_sync_runs
  DROP CONSTRAINT IF EXISTS suap_plan_sync_runs_unit_code_check;

ALTER TABLE public.suap_plan_sync_runs
  ADD CONSTRAINT suap_plan_sync_runs_unit_code_check
  CHECK (suap_unit_code ~ '^[0-9]+$');

ALTER TABLE public.suap_plan_activity_snapshots
  DROP CONSTRAINT IF EXISTS suap_plan_activity_snapshots_unit_code_check;

ALTER TABLE public.suap_plan_activity_snapshots
  ADD CONSTRAINT suap_plan_activity_snapshots_unit_code_check
  CHECK (suap_unit_code ~ '^[0-9]+$');

ALTER TABLE public.atividades
  DROP CONSTRAINT IF EXISTS atividades_suap_activity_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'atividades_suap_unit_activity_unique'
      AND conrelid = 'public.atividades'::regclass
  ) THEN
    ALTER TABLE public.atividades
      ADD CONSTRAINT atividades_suap_unit_activity_unique
      UNIQUE (org_id, suap_plan_id, suap_unit_code, suap_activity_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS suap_plan_sync_runs_unit_lookup_idx
  ON public.suap_plan_sync_runs (org_id, plan_id, suap_unit_code, started_at DESC);

CREATE INDEX IF NOT EXISTS atividades_suap_unit_lookup_idx
  ON public.atividades (org_id, sync_source, suap_plan_id, suap_unit_code, sync_active);

ALTER TABLE public.suap_plan_sync_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suap_plan_sync_batches_owner ON public.suap_plan_sync_batches;
CREATE POLICY suap_plan_sync_batches_owner ON public.suap_plan_sync_batches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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
  v_legacy_archived integer := 0;
BEGIN
  SELECT * INTO v_run
  FROM public.suap_plan_sync_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUAP sync run not found.';
  END IF;

  IF v_run.status NOT IN ('running', 'preview') THEN
    RAISE EXCEPTION 'SUAP sync run is not running or awaiting preview.';
  END IF;

  SELECT count(*) INTO v_inserted
  FROM public.suap_plan_activity_snapshots snapshot
  WHERE snapshot.run_id = p_run_id
    AND NOT EXISTS (
      SELECT 1 FROM public.atividades activity
      WHERE activity.org_id = v_run.org_id
        AND activity.suap_plan_id = snapshot.suap_plan_id
        AND activity.suap_unit_code = snapshot.suap_unit_code
        AND activity.suap_activity_id = snapshot.suap_activity_id
    );

  SELECT count(*) INTO v_updated
  FROM public.suap_plan_activity_snapshots snapshot
  JOIN public.atividades activity
    ON activity.org_id = v_run.org_id
   AND activity.suap_plan_id = snapshot.suap_plan_id
   AND activity.suap_unit_code = snapshot.suap_unit_code
   AND activity.suap_activity_id = snapshot.suap_activity_id
  WHERE snapshot.run_id = p_run_id;

  INSERT INTO public.atividades (
    org_id, campus_uasg, dimensao, componente_funcional, tipo_atividade, atividade, descricao,
    valor_total, saldo_disponivel, origem_recurso, natureza_despesa, plano_interno, processo,
    sync_source, suap_plan_id, suap_unit_code, suap_activity_id, sync_active, sync_last_seen_run_id,
    dimensao_id, created_at, updated_at
  )
  SELECT
    snapshot.org_id,
    snapshot.campus_uasg,
    snapshot.dimensao,
    snapshot.componente_funcional,
    'campus',
    snapshot.atividade,
    snapshot.atividade,
    snapshot.valor_total,
    snapshot.saldo_disponivel,
    snapshot.origem_recurso,
    '',
    snapshot.plano_interno,
    '',
    'suap_plan_8',
    snapshot.suap_plan_id,
    snapshot.suap_unit_code,
    snapshot.suap_activity_id,
    true,
    p_run_id,
    dimensao.id,
    now(),
    now()
  FROM public.suap_plan_activity_snapshots snapshot
  LEFT JOIN public.dimensoes dimensao ON dimensao.codigo = split_part(snapshot.dimensao, ' - ', 1)
  WHERE snapshot.run_id = p_run_id
  ON CONFLICT (org_id, suap_plan_id, suap_unit_code, suap_activity_id) DO UPDATE SET
    campus_uasg = EXCLUDED.campus_uasg,
    dimensao = EXCLUDED.dimensao,
    dimensao_id = EXCLUDED.dimensao_id,
    componente_funcional = EXCLUDED.componente_funcional,
    tipo_atividade = EXCLUDED.tipo_atividade,
    atividade = EXCLUDED.atividade,
    descricao = EXCLUDED.descricao,
    valor_total = EXCLUDED.valor_total,
    saldo_disponivel = EXCLUDED.saldo_disponivel,
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
    AND activity.campus_uasg = v_run.campus_uasg
    AND activity.sync_source = 'suap_plan_8'
    AND activity.suap_plan_id = v_run.plan_id
    AND activity.suap_unit_code = v_run.suap_unit_code
    AND activity.tipo_atividade = v_run.scope
    AND activity.sync_active
    AND NOT EXISTS (
      SELECT 1
      FROM public.suap_plan_activity_snapshots snapshot
      WHERE snapshot.run_id = p_run_id
        AND snapshot.suap_plan_id = activity.suap_plan_id
        AND snapshot.suap_unit_code = activity.suap_unit_code
        AND snapshot.suap_activity_id = activity.suap_activity_id
    );

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  UPDATE public.atividades legacy
  SET sync_active = false, updated_at = now()
  WHERE legacy.org_id = v_run.org_id
    AND legacy.campus_uasg = v_run.campus_uasg
    AND legacy.tipo_atividade = v_run.scope
    AND legacy.sync_active
    AND legacy.suap_activity_id IS NULL
    AND COALESCE(legacy.sync_source, '') <> 'suap_plan_8'
    AND EXISTS (
      SELECT 1
      FROM public.suap_plan_activity_snapshots snapshot
      WHERE snapshot.run_id = p_run_id
        AND lower(trim(snapshot.dimensao)) = lower(trim(legacy.dimensao))
        AND lower(trim(snapshot.atividade)) = lower(trim(legacy.atividade))
    );

  GET DIAGNOSTICS v_legacy_archived = ROW_COUNT;
  v_archived := v_archived + v_legacy_archived;

  UPDATE public.suap_plan_sync_runs
  SET status = 'success', mode = 'apply', finished_at = now(),
      source_count = (SELECT count(*) FROM public.suap_plan_activity_snapshots WHERE run_id = p_run_id),
      inserted_count = v_inserted, updated_count = v_updated, archived_count = v_archived
  WHERE id = p_run_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'archived', v_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_suap_plan_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_suap_plan_snapshot(uuid) TO service_role;

COMMENT ON COLUMN public.atividades.suap_unit_code IS 'Valor da unidade_gestora selecionada no Plano 8 do SUAP.';
