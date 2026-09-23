-- Permitir leitura anonima das tabelas de energia na aba de Infraestrutura do app Mobile
GRANT SELECT ON public.energia_consumo_faturas TO anon;
DROP POLICY IF EXISTS "energia_consumo_faturas_anon_select" ON public.energia_consumo_faturas;
CREATE POLICY "energia_consumo_faturas_anon_select" ON public.energia_consumo_faturas
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.energia_solar_geracao TO anon;
DROP POLICY IF EXISTS "energia_solar_geracao_anon_select" ON public.energia_solar_geracao;
CREATE POLICY "energia_solar_geracao_anon_select" ON public.energia_solar_geracao
  FOR SELECT TO anon
  USING (true);

GRANT SELECT ON public.energia_contratos TO anon;
DROP POLICY IF EXISTS "energia_contratos_anon_select" ON public.energia_contratos;
CREATE POLICY "energia_contratos_anon_select" ON public.energia_contratos
  FOR SELECT TO anon
  USING (true);
