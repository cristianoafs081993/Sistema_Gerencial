-- Mantem os vinculos ativos entre processos e caixas do SUAP por usuario.
CREATE TABLE IF NOT EXISTS public.suap_processo_caixas (
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  caixa_id uuid NOT NULL REFERENCES public.suap_caixas(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (processo_id, caixa_id)
);

CREATE INDEX IF NOT EXISTS idx_suap_processo_caixas_tenant_caixa
  ON public.suap_processo_caixas (tenant_id, caixa_id);

CREATE INDEX IF NOT EXISTS idx_suap_processo_caixas_tenant_processo
  ON public.suap_processo_caixas (tenant_id, processo_id);

ALTER TABLE public.suap_processo_caixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own SUAP process box memberships" ON public.suap_processo_caixas;
CREATE POLICY "Users can manage own SUAP process box memberships"
  ON public.suap_processo_caixas
  FOR ALL
  TO authenticated
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- Preserva a visibilidade dos processos legados enquanto seus inventarios
-- passam a ser reconciliados pelas caixas cadastradas atuais.
INSERT INTO public.suap_processo_caixas (processo_id, caixa_id, tenant_id, last_seen_at)
SELECT
  processo.id,
  caixa.id,
  processo.tenant_id,
  COALESCE(processo.updated_at, processo.created_at, timezone('utc', now()))
FROM public.processos AS processo
INNER JOIN public.suap_caixas AS caixa
  ON caixa.tenant_id = processo.tenant_id
 AND caixa.nome = processo.caixa
WHERE processo.caixa IS NOT NULL
ON CONFLICT (processo_id, caixa_id)
DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
