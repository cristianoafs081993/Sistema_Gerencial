-- Reconcile activities previously inserted by the legacy extension extractor.

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

  IF v_run.status <> 'running' THEN
    RAISE EXCEPTION 'SUAP sync run is not running.';
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

  -- Rows inserted by the old popup have no stable SUAP id. Once a canonical
  -- row exists, archive legacy rows with the same dimension and activity.
  UPDATE public.atividades legacy
  SET sync_active = false, updated_at = now()
  WHERE legacy.org_id = v_run.org_id
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

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'archived', v_archived
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_suap_plan_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_suap_plan_snapshot(uuid) TO service_role;
