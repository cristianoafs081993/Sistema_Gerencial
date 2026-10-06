-- RDs are an auditable source of relationships/movements, never SIAFI balances.
CREATE TABLE public.suap_rd_units (
  suap_unit_code text PRIMARY KEY, campus_uasg text NOT NULL, code text NOT NULL,
  UNIQUE (suap_unit_code, campus_uasg)
);
INSERT INTO public.suap_rd_units VALUES
 ('1','158155','PROPI/RE'),('2','158155','PROEN/RE'),('3','158155','PROEX/RE'),('4','158155','PRODES/RE'),
 ('5','158155','PROAD/RE'),('6','158155','DIGPE/RE'),('7','158155','DIAE/RE'),('8','158155','DITIC/RE'),
 ('9','158155','DICI/RE'),('10','158155','DINT/RE'),('11','158155','DINFRA/RE'),('12','158155','DG/ZL'),
 ('13','158371','DG/AP'),('14','158370','DG/CA'),('15','158365','DG/MC'),('16','158374','DG/PF'),
 ('17','154838','DG/CM'),('18','154839','DG/CANG'),('19','158366','DG/CN'),('20','158367','DG/IP'),
 ('21','158155','DG/LAJ'),('22','154840','DG/SPP'),('23','158375','DG/MO'),('24','158373','DG/JC'),
 ('25','158366','DG/JUC'),('26','154582','DG/SGA'),('27','158372','DG/SC'),('28','152756','DG/PAR'),
 ('29','158366','DG/PAAS'),('30','152711','DG/CH'),('31','152757','DG/NC'),('32','158368','DG/ZN'),
 ('33','158369','DG/CNAT'),('34','158155','GABIN/RE'),('35','158155','SECOL'),('36','158366','DG/CTM'),
 ('37','158155','OUV/RE'),('38','158155','AUDGE'),('39','158155','CONTROL/RE'),('40','158155','CORREG/RE'),
 ('41','158155','PROJU/RE'),('42','158155','DG/SM'),('43','158155','DG/TOU'),('44','158155','DG/UMZ');

CREATE TABLE public.suap_rd_sync_runs (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.orgs(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 campus_uasg text NOT NULL, suap_unit_code text NOT NULL, plan_id integer NOT NULL DEFAULT 8 CHECK (plan_id = 8),
 status text NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting','partial','awaiting_auth','preview','applied','failed','reverted')),
 state jsonb NOT NULL DEFAULT '{}'::jsonb, summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 source_count integer NOT NULL DEFAULT 0, complete boolean NOT NULL DEFAULT false,
 lease_token uuid, lease_until timestamptz, error_message text,
 started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
 FOREIGN KEY (suap_unit_code,campus_uasg) REFERENCES public.suap_rd_units(suap_unit_code,campus_uasg),
 UNIQUE(id,org_id,campus_uasg,suap_unit_code)
);
CREATE UNIQUE INDEX suap_rd_one_collecting_scope ON public.suap_rd_sync_runs(org_id,suap_unit_code)
 WHERE status IN ('collecting','partial','awaiting_auth');

CREATE TABLE public.suap_rd_snapshots (
 run_id uuid NOT NULL, org_id uuid NOT NULL, campus_uasg text NOT NULL, suap_unit_code text NOT NULL,
 suap_rd_id text NOT NULL CHECK(suap_rd_id ~ '^[0-9]+$'), payload jsonb NOT NULL,
 checksum text NOT NULL, captured_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,suap_rd_id),
 FOREIGN KEY(run_id,org_id,campus_uasg,suap_unit_code) REFERENCES public.suap_rd_sync_runs(id,org_id,campus_uasg,suap_unit_code)
);

-- An entire RD revision is replaced atomically. Ordinality is local to that revision.
CREATE TABLE public.suap_requisicoes_despesa (
 org_id uuid NOT NULL, campus_uasg text NOT NULL, suap_unit_code text NOT NULL,
 suap_rd_id text NOT NULL, run_id uuid NOT NULL, payload jsonb NOT NULL,
 captured_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(org_id,suap_unit_code,suap_rd_id),
 FOREIGN KEY(run_id,org_id,campus_uasg,suap_unit_code) REFERENCES public.suap_rd_sync_runs(id,org_id,campus_uasg,suap_unit_code)
);

ALTER TABLE public.suap_rd_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY suap_rd_units_read ON public.suap_rd_units FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.suap_rd_units TO authenticated;
ALTER TABLE public.suap_rd_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_rd_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suap_requisicoes_despesa ENABLE ROW LEVEL SECURITY;
CREATE POLICY suap_rd_runs_read ON public.suap_rd_sync_runs FOR SELECT TO authenticated
 USING (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg());
CREATE POLICY suap_rd_snapshots_read ON public.suap_rd_snapshots FOR SELECT TO authenticated
 USING (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg());
CREATE POLICY suap_rd_read ON public.suap_requisicoes_despesa FOR SELECT TO authenticated
 USING (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg());
GRANT SELECT ON public.suap_rd_sync_runs, public.suap_rd_snapshots, public.suap_requisicoes_despesa TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.suap_rd_sync_runs, public.suap_rd_snapshots, public.suap_requisicoes_despesa,public.suap_rd_units FROM authenticated,anon;
GRANT ALL ON public.suap_rd_sync_runs, public.suap_rd_snapshots, public.suap_requisicoes_despesa,public.suap_rd_units TO service_role;

CREATE VIEW public.suap_rd_movimentacoes WITH (security_invoker = true) AS
 SELECT rd.org_id,rd.campus_uasg,rd.suap_unit_code,rd.run_id,rd.suap_rd_id,rd.captured_at,
 rd.payload->>'numero' AS rd_numero,rd.payload->>'tipo' AS tipo,
 rd.payload->>'situacao' AS rd_situacao,rd.payload->>'sourceUrl' AS source_url,
 rd.payload->>'activityName' AS atividade_nome,rd.payload->>'processo' AS processo,
 line.ordinality AS line_index,line.value->>'naturezaDespesa' AS natureza_despesa,
 (line.value->>'valor')::numeric(16,2) AS valor,line.value->>'empenhoNumero' AS empenho_numero,
 line.value->>'empenhoCompleto' AS empenho_completo,line.value->>'gestao' AS gestao,
 line.value->>'ro' AS ro,line.value->>'situacao' AS linha_situacao,
 source.value->>'activityId' AS suap_activity_id,(source.value->>'planId')::integer AS suap_plan_id,
 source.value->>'sourceUrl' AS activity_source_url,
 activity.id AS atividade_id,
 CASE WHEN ne.matches = 1 THEN ne.local_id ELSE NULL END AS empenho_id,
 CASE WHEN jsonb_array_length(rd.payload->'sources') > 1 THEN 'conflito_atividade'
      WHEN ne.matches > 1 THEN 'ne_ambigua'
      WHEN source.value IS NULL THEN 'historica_ou_sem_atividade'
      WHEN activity.id IS NULL THEN 'atividade_ausente'
      WHEN ne.matches = 0 THEN 'empenho_ausente'
      WHEN manual.atividade_id IS NOT NULL AND manual.atividade_id <> activity.id THEN 'conflito_manual'
      ELSE 'resolvido' END AS resolution,
 (rd.payload->>'situacao' = 'Concluída' AND line.value->>'situacao' = 'Confirmada'
   AND rd.payload->>'tipo' IN ('dotacao','reforco','anulacao')
   AND line.value->>'ug' = rd.campus_uasg AND line.value->>'empenhoNumero' IS NOT NULL) AS confirmed
 FROM public.suap_requisicoes_despesa rd
 CROSS JOIN LATERAL jsonb_array_elements(rd.payload->'linhas') WITH ORDINALITY AS line(value,ordinality)
 LEFT JOIN LATERAL jsonb_array_elements(rd.payload->'sources') AS source(value) ON true
 LEFT JOIN public.atividades activity ON activity.org_id=rd.org_id AND activity.campus_uasg=rd.campus_uasg
  AND activity.suap_unit_code=rd.suap_unit_code AND activity.suap_plan_id=(source.value->>'planId')::integer
  AND activity.suap_activity_id=source.value->>'activityId'
 LEFT JOIN LATERAL (
  SELECT count(*) AS matches,min(e.id::text)::uuid AS local_id FROM public.empenhos e
  WHERE e.org_id=rd.org_id AND e.campus_uasg=rd.campus_uasg
    AND upper(trim(e.numero)) IN (line.value->>'empenhoNumero',line.value->>'empenhoCompleto')
 ) ne ON true
 LEFT JOIN public.empenhos manual ON manual.id=ne.local_id AND ne.matches=1
 WHERE rd.active;

CREATE VIEW public.atividade_empenho_vinculos WITH (security_invoker = true) AS
 SELECT org_id,campus_uasg,suap_unit_code,suap_plan_id,suap_activity_id,atividade_id,empenho_id,empenho_numero,
 sum(valor)::numeric(16,2) AS valor_rd,
 array_agg(DISTINCT rd_numero) AS rds,
 bool_and(resolution='resolvido') AS resolved,
 max(captured_at) AS captured_at
 FROM public.suap_rd_movimentacoes WHERE confirmed AND suap_activity_id IS NOT NULL AND resolution <> 'conflito_atividade'
 GROUP BY org_id,campus_uasg,suap_unit_code,suap_plan_id,suap_activity_id,atividade_id,empenho_id,empenho_numero;
GRANT SELECT ON public.suap_rd_movimentacoes, public.atividade_empenho_vinculos TO authenticated,service_role;

CREATE FUNCTION public.apply_suap_rd_snapshot(p_run_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.suap_rd_sync_runs; n integer;
BEGIN
 SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'Execução RD não autorizada.'; END IF;
 IF r.status='applied' THEN RETURN r.summary; END IF;
 IF r.status<>'preview' OR NOT r.complete THEN RAISE EXCEPTION 'Captura RD incompleta ou sem prévia.'; END IF;
 -- Serialize the projection even across different completed previews of one unit.
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
 UPDATE public.suap_rd_sync_runs SET status='applied',applied_at=now(),updated_at=now() WHERE id=r.id;
 RETURN r.summary;
END $$;
REVOKE ALL ON FUNCTION public.apply_suap_rd_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_suap_rd_snapshot(uuid,uuid) TO service_role;

CREATE FUNCTION public.revert_suap_rd_snapshot(p_run_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.suap_rd_sync_runs; previous_id uuid;
BEGIN
 SELECT * INTO r FROM public.suap_rd_sync_runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND OR r.user_id<>p_user_id THEN RAISE EXCEPTION 'Execução RD não autorizada.'; END IF;
 IF r.status='reverted' THEN RETURN r.summary; END IF;
 IF r.status<>'applied' THEN RAISE EXCEPTION 'Somente execução aplicada pode ser revertida.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.org_id::text||':'||r.suap_unit_code,0));
 IF EXISTS(SELECT 1 FROM public.suap_rd_sync_runs WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code
   AND status='applied' AND applied_at>r.applied_at) THEN RAISE EXCEPTION 'Existe aplicação mais recente; reverta-a primeiro.'; END IF;
 SELECT id INTO previous_id FROM public.suap_rd_sync_runs WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code
   AND status='applied' AND id<>r.id ORDER BY applied_at DESC LIMIT 1;
 UPDATE public.suap_requisicoes_despesa SET active=false WHERE org_id=r.org_id AND suap_unit_code=r.suap_unit_code;
 IF previous_id IS NOT NULL THEN
  INSERT INTO public.suap_requisicoes_despesa(org_id,campus_uasg,suap_unit_code,suap_rd_id,run_id,payload,captured_at,active)
  SELECT org_id,campus_uasg,suap_unit_code,suap_rd_id,run_id,payload,captured_at,true FROM public.suap_rd_snapshots WHERE run_id=previous_id
  ON CONFLICT(org_id,suap_unit_code,suap_rd_id) DO UPDATE
   SET run_id=excluded.run_id,payload=excluded.payload,captured_at=excluded.captured_at,active=true;
 END IF;
 UPDATE public.suap_rd_sync_runs SET status='reverted',updated_at=now() WHERE id=r.id;
 RETURN r.summary;
END $$;
REVOKE ALL ON FUNCTION public.revert_suap_rd_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.revert_suap_rd_snapshot(uuid,uuid) TO service_role;
