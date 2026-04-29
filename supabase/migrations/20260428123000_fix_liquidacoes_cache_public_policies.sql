DROP POLICY IF EXISTS liq_cache_status_select_public
  ON public.contratos_api_empenho_liquidacoes_cache_status;
DROP POLICY IF EXISTS liq_cache_rows_select_public
  ON public.contratos_api_empenho_liquidacoes_cache;

CREATE POLICY liq_cache_status_select_public
  ON public.contratos_api_empenho_liquidacoes_cache_status
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY liq_cache_rows_select_public
  ON public.contratos_api_empenho_liquidacoes_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.contratos_api_empenho_liquidacoes_cache_status TO anon, authenticated;
GRANT SELECT ON public.contratos_api_empenho_liquidacoes_cache TO anon, authenticated;
