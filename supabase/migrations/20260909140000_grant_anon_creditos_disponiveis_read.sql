-- Permitir leitura anônima/pública de crédito disponível no Dashboard e Mobile
GRANT SELECT ON public.creditos_disponiveis TO anon;
GRANT SELECT ON public.creditos_disponiveis_detalhes TO anon;

DROP POLICY IF EXISTS "creditos_disponiveis_anon_select" ON public.creditos_disponiveis;
CREATE POLICY "creditos_disponiveis_anon_select" ON public.creditos_disponiveis
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "creditos_disponiveis_detalhes_anon_select" ON public.creditos_disponiveis_detalhes;
CREATE POLICY "creditos_disponiveis_detalhes_anon_select" ON public.creditos_disponiveis_detalhes
  FOR SELECT TO anon
  USING (true);
