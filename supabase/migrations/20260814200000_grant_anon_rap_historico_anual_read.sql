-- Permitir leitura anônima/pública do histórico anual de RAP no Dashboard
GRANT SELECT ON public.rap_historico_anual TO anon;

DROP POLICY IF EXISTS "rap_historico_anual_anon_select" ON public.rap_historico_anual;
CREATE POLICY "rap_historico_anual_anon_select" ON public.rap_historico_anual
  FOR SELECT TO anon
  USING (true);
