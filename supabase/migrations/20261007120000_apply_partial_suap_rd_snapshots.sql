-- Allow an administrator to publish captured RDs while the extension continues
-- collecting a changing SUAP inventory. Keep the first pre-application value so
-- the partial publication remains reversible.
CREATE TABLE public.suap_rd_partial_apply_backups (
  run_id uuid NOT NULL,
  org_id uuid NOT NULL,
  campus_uasg text NOT NULL,
  suap_unit_code text NOT NULL,
  suap_rd_id text NOT NULL,
  had_previous boolean NOT NULL,
  previous_run_id uuid,
  previous_payload jsonb,
  previous_captured_at timestamptz,
  previous_active boolean,
  applied_checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, suap_rd_id),
  FOREIGN KEY (run_id, org_id, campus_uasg, suap_unit_code)
    REFERENCES public.suap_rd_sync_runs(id, org_id, campus_uasg, suap_unit_code),
  CHECK (
    (had_previous AND previous_run_id IS NOT NULL AND previous_payload IS NOT NULL
      AND previous_captured_at IS NOT NULL AND previous_active IS NOT NULL)
    OR (NOT had_previous AND previous_run_id IS NULL AND previous_payload IS NULL
      AND previous_captured_at IS NULL AND previous_active IS NULL)
  )
);
ALTER TABLE public.suap_rd_partial_apply_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suap_rd_partial_apply_backups FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.suap_rd_partial_apply_backups TO service_role;

CREATE OR REPLACE FUNCTION public.apply_suap_rd_snapshot(p_run_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.suap_rd_sync_runs; n integer;
BEGIN
 SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'Execução RD não autorizada.'; END IF;
 IF r.status='applied' THEN RETURN r.summary; END IF;
 IF r.status<>'preview' OR NOT r.complete THEN RAISE EXCEPTION 'Captura RD incompleta ou sem prévia.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.org_id::text||':'||r.suap_unit_code,0));
 IF EXISTS(SELECT 1 FROM public.suap_rd_sync_runs WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code
   AND status='applied' AND started_at>r.started_at) THEN RAISE EXCEPTION 'Prévia obsoleta.'; END IF;
 SELECT count(*) INTO n FROM public.suap_rd_snapshots WHERE run_id=r.id;
 IF n<>r.source_count THEN RAISE EXCEPTION 'Cobertura de RDs divergente.'; END IF;
 IF EXISTS(SELECT 1 FROM public.suap_rd_snapshots s WHERE s.run_id=r.id AND
  (s.payload->>'suapUnitCode' IS DISTINCT FROM r.suap_unit_code OR s.payload->>'campusUasg' IS DISTINCT FROM r.campus_uasg
   OR s.payload->>'rdId' IS DISTINCT FROM s.suap_rd_id)) THEN RAISE EXCEPTION 'Snapshot fora do escopo.'; END IF;
 UPDATE public.suap_requisicoes_despesa SET active=false
  WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code AND campus_uasg=r.campus_uasg;
 INSERT INTO public.suap_requisicoes_despesa(org_id,campus_uasg,suap_unit_code,suap_rd_id,run_id,payload,captured_at,active)
 SELECT org_id,campus_uasg,suap_unit_code,suap_rd_id,run_id,payload,captured_at,true FROM public.suap_rd_snapshots WHERE run_id=r.id
 ON CONFLICT(org_id,suap_unit_code,suap_rd_id) DO UPDATE
  SET run_id=excluded.run_id,payload=excluded.payload,captured_at=excluded.captured_at,active=true;
 DELETE FROM public.suap_rd_partial_apply_backups WHERE run_id=r.id;
 UPDATE public.suap_rd_sync_runs SET status='applied',applied_at=now(),updated_at=now() WHERE id=r.id;
 RETURN r.summary;
END $$;
REVOKE ALL ON FUNCTION public.apply_suap_rd_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_suap_rd_snapshot(uuid,uuid) TO service_role;

CREATE FUNCTION public.apply_suap_rd_partial_snapshots(p_run_id uuid, p_user_id uuid, p_limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.suap_rd_sync_runs;
  s public.suap_rd_snapshots;
  prior public.suap_requisicoes_despesa;
  n integer := 0;
  total integer := 0;
  current_applied integer := 0;
  pending integer := 0;
BEGIN
  SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id;
  IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'Execução RD não autorizada.'; END IF;
  IF r.status NOT IN ('collecting','partial','awaiting_auth') THEN
    RAISE EXCEPTION 'A aplicação incremental só está disponível durante uma coleta incompleta.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.org_id::text||':'||r.suap_unit_code,0));
  SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id;
  IF r.status NOT IN ('collecting','partial','awaiting_auth') THEN
    RAISE EXCEPTION 'A execução deixou de aceitar aplicação incremental.';
  END IF;
  IF EXISTS(SELECT 1 FROM public.suap_rd_sync_runs WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code
    AND status='applied' AND started_at>r.started_at) THEN RAISE EXCEPTION 'Conferência obsoleta.'; END IF;

  FOR s IN
    SELECT snap.* FROM public.suap_rd_snapshots snap
    LEFT JOIN public.suap_rd_partial_apply_backups backup
      ON backup.run_id=snap.run_id AND backup.suap_rd_id=snap.suap_rd_id
    WHERE snap.run_id=r.id AND backup.applied_checksum IS DISTINCT FROM snap.checksum
    ORDER BY snap.suap_rd_id
    LIMIT LEAST(GREATEST(COALESCE(p_limit,1000),1),1000)
  LOOP
    IF s.org_id<>r.org_id OR s.campus_uasg<>r.campus_uasg OR s.suap_unit_code<>r.suap_unit_code
      OR s.payload->>'suapUnitCode' IS DISTINCT FROM r.suap_unit_code
      OR s.payload->>'campusUasg' IS DISTINCT FROM r.campus_uasg
      OR s.payload->>'rdId' IS DISTINCT FROM s.suap_rd_id THEN
      RAISE EXCEPTION 'Snapshot fora do escopo.';
    END IF;

    SELECT * INTO prior FROM public.suap_requisicoes_despesa
      WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code AND suap_rd_id=s.suap_rd_id
      FOR UPDATE;
    INSERT INTO public.suap_rd_partial_apply_backups(run_id,org_id,campus_uasg,suap_unit_code,suap_rd_id,
      had_previous,previous_run_id,previous_payload,previous_captured_at,previous_active,applied_checksum)
    VALUES (r.id,r.org_id,r.campus_uasg,r.suap_unit_code,s.suap_rd_id,FOUND,
      CASE WHEN FOUND THEN prior.run_id END,CASE WHEN FOUND THEN prior.payload END,
      CASE WHEN FOUND THEN prior.captured_at END,CASE WHEN FOUND THEN prior.active END,s.checksum)
    ON CONFLICT (run_id,suap_rd_id) DO UPDATE SET applied_checksum=EXCLUDED.applied_checksum;
    INSERT INTO public.suap_requisicoes_despesa(org_id,campus_uasg,suap_unit_code,suap_rd_id,run_id,payload,captured_at,active)
    VALUES(s.org_id,s.campus_uasg,s.suap_unit_code,s.suap_rd_id,s.run_id,s.payload,s.captured_at,true)
    ON CONFLICT(org_id,suap_unit_code,suap_rd_id) DO UPDATE
      SET run_id=EXCLUDED.run_id,payload=EXCLUDED.payload,captured_at=EXCLUDED.captured_at,active=true;
    n := n+1;
  END LOOP;

  SELECT count(*)::integer INTO total FROM public.suap_rd_snapshots WHERE run_id=r.id;
  SELECT count(*)::integer INTO current_applied
    FROM public.suap_rd_snapshots snap JOIN public.suap_rd_partial_apply_backups backup
      ON backup.run_id=snap.run_id AND backup.suap_rd_id=snap.suap_rd_id
      AND backup.applied_checksum=snap.checksum
    WHERE snap.run_id=r.id;
  pending := total-current_applied;
  RETURN jsonb_build_object('appliedNow',n,'appliedSnapshots',current_applied,'snapshotCount',total,'pendingSnapshots',pending);
END $$;
REVOKE ALL ON FUNCTION public.apply_suap_rd_partial_snapshots(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_suap_rd_partial_snapshots(uuid,uuid,integer) TO service_role;

CREATE FUNCTION public.revert_suap_rd_partial_snapshots(p_run_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.suap_rd_sync_runs; restored integer := 0; removed integer := 0;
BEGIN
  SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'Execução RD não autorizada.'; END IF;
  IF r.status='reverted' THEN RETURN jsonb_build_object('restored',0,'removed',0); END IF;
  IF r.status NOT IN ('collecting','partial','awaiting_auth','failed') THEN
    RAISE EXCEPTION 'Somente aplicação incremental pode ser revertida por esta ação.';
  END IF;
  IF r.lease_until IS NOT NULL AND r.lease_until>now() THEN RAISE EXCEPTION 'A coleta ainda está em andamento.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.org_id::text||':'||r.suap_unit_code,0));
  UPDATE public.suap_requisicoes_despesa rd SET run_id=b.previous_run_id,payload=b.previous_payload,
    captured_at=b.previous_captured_at,active=b.previous_active
    FROM public.suap_rd_partial_apply_backups b
    WHERE b.run_id=r.id AND b.had_previous AND rd.org_id=b.org_id AND rd.suap_unit_code=b.suap_unit_code
      AND rd.suap_rd_id=b.suap_rd_id AND rd.run_id=r.id;
  GET DIAGNOSTICS restored=ROW_COUNT;
  DELETE FROM public.suap_requisicoes_despesa rd USING public.suap_rd_partial_apply_backups b
    WHERE b.run_id=r.id AND NOT b.had_previous AND rd.org_id=b.org_id AND rd.suap_unit_code=b.suap_unit_code
      AND rd.suap_rd_id=b.suap_rd_id AND rd.run_id=r.id;
  GET DIAGNOSTICS removed=ROW_COUNT;
  DELETE FROM public.suap_rd_partial_apply_backups WHERE run_id=r.id;
  UPDATE public.suap_rd_sync_runs SET status='reverted',complete=false,lease_token=NULL,lease_until=NULL,
    updated_at=now(),error_message='Aplicação incremental revertida pelo administrador.' WHERE id=r.id;
  RETURN jsonb_build_object('restored',restored,'removed',removed);
END $$;
REVOKE ALL ON FUNCTION public.revert_suap_rd_partial_snapshots(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revert_suap_rd_partial_snapshots(uuid,uuid) TO service_role;
