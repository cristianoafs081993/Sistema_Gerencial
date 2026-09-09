-- Permitir leitura anônima de descentralizações no Dashboard e Notificações Mobile
GRANT SELECT ON public.descentralizacoes TO anon;
DROP POLICY IF EXISTS "descentralizacoes_anon_select" ON public.descentralizacoes;
CREATE POLICY "descentralizacoes_anon_select" ON public.descentralizacoes
  FOR SELECT TO anon
  USING (true);

-- Permitir leitura anônima de requisições de compra nas Notificações Mobile
GRANT SELECT ON public.requisicoes_compra TO anon;
DROP POLICY IF EXISTS "requisicoes_compra_anon_select" ON public.requisicoes_compra;
CREATE POLICY "requisicoes_compra_anon_select" ON public.requisicoes_compra
  FOR SELECT TO anon
  USING (true);

-- Permitir leitura anônima de itens de requisição de compra nas Notificações Mobile
GRANT SELECT ON public.requisicao_compra_itens TO anon;
DROP POLICY IF EXISTS "requisicao_compra_itens_anon_select" ON public.requisicao_compra_itens;
CREATE POLICY "requisicao_compra_itens_anon_select" ON public.requisicao_compra_itens
  FOR SELECT TO anon
  USING (true);
