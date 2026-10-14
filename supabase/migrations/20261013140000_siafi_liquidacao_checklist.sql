-- Runs are server-owned; reviews append events without changing the AI verdict.
CREATE TABLE public.siafi_liquidacao_analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  capture_id text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  progresso text NOT NULL DEFAULT 'Aguardando análise',
  input_snapshot jsonb NOT NULL,
  input_hash text NOT NULL,
  regras_versao text NOT NULL,
  result_snapshot jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (tenant_id,processo_id,capture_id,input_hash)
);
CREATE INDEX siafi_liquidacao_analises_processo_idx ON public.siafi_liquidacao_analises(tenant_id,processo_id,created_at DESC);
ALTER TABLE public.siafi_liquidacao_analises ENABLE ROW LEVEL SECURITY;
CREATE POLICY siafi_analises_read ON public.siafi_liquidacao_analises FOR SELECT TO authenticated
  USING (tenant_id=auth.uid() AND EXISTS (SELECT 1 FROM public.processos p WHERE p.id=processo_id AND p.tenant_id=auth.uid()));
REVOKE ALL ON public.siafi_liquidacao_analises FROM anon,authenticated;
GRANT SELECT ON public.siafi_liquidacao_analises TO authenticated;
GRANT ALL ON public.siafi_liquidacao_analises TO service_role;

CREATE TABLE public.siafi_liquidacao_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid NOT NULL REFERENCES public.siafi_liquidacao_analises(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  conferido boolean NOT NULL,
  feedback text CHECK (feedback IN ('confirmo_divergencia','falso_positivo','falta_de_dados')),
  motivo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (feedback IS DISTINCT FROM 'falso_positivo' OR length(trim(motivo)) >= 5),
  CHECK (length(motivo) <= 4000)
);
CREATE INDEX siafi_liquidacao_revisoes_analise_idx ON public.siafi_liquidacao_revisoes(analise_id,created_at,id);
ALTER TABLE public.siafi_liquidacao_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY siafi_revisoes_read ON public.siafi_liquidacao_revisoes FOR SELECT TO authenticated
  USING (tenant_id=auth.uid() AND EXISTS (SELECT 1 FROM public.siafi_liquidacao_analises a WHERE a.id=analise_id));
CREATE POLICY siafi_revisoes_insert ON public.siafi_liquidacao_revisoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id=auth.uid() AND EXISTS (
    SELECT 1 FROM public.siafi_liquidacao_analises a
    WHERE a.id=analise_id AND a.tenant_id=auth.uid() AND a.status='completed'
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.result_snapshot->'checklist') item WHERE item->>'id'=item_id)
  ));
REVOKE ALL ON public.siafi_liquidacao_revisoes FROM anon,authenticated;
GRANT SELECT,INSERT ON public.siafi_liquidacao_revisoes TO authenticated;
GRANT ALL ON public.siafi_liquidacao_revisoes TO service_role;

CREATE FUNCTION public.stamp_siafi_review() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.created_at=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER siafi_review_stamp BEFORE INSERT ON public.siafi_liquidacao_revisoes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_siafi_review();

CREATE FUNCTION public.protect_siafi_analysis_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR OLD.processo_id IS DISTINCT FROM NEW.processo_id
    OR OLD.input_snapshot IS DISTINCT FROM NEW.input_snapshot OR OLD.input_hash IS DISTINCT FROM NEW.input_hash
    OR OLD.capture_id IS DISTINCT FROM NEW.capture_id OR OLD.regras_versao IS DISTINCT FROM NEW.regras_versao
    OR (OLD.status='completed' AND OLD IS DISTINCT FROM NEW) THEN
    RAISE EXCEPTION 'O snapshot da análise é imutável';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER siafi_analysis_immutable BEFORE UPDATE ON public.siafi_liquidacao_analises
  FOR EACH ROW EXECUTE FUNCTION public.protect_siafi_analysis_snapshot();

CREATE FUNCTION public.claim_siafi_analysis(p_id uuid)
RETURNS SETOF public.siafi_liquidacao_analises LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.siafi_liquidacao_analises SET status='processing',progresso='Lendo evidências',
    attempts=attempts+1,started_at=coalesce(started_at,now()),lease_expires_at=now()+interval '8 minutes'
  WHERE id=p_id AND attempts<3 AND (status IN ('queued','failed') OR (status='processing' AND lease_expires_at<now()))
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_siafi_analysis(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_siafi_analysis(uuid) TO service_role;
