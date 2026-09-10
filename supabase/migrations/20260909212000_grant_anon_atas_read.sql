-- Permitir leitura anônima de atas de registro de preços no app mobile
GRANT SELECT ON public.atas_registro_precos TO anon;
DROP POLICY IF EXISTS "atas_registro_precos_anon_select" ON public.atas_registro_precos;
CREATE POLICY "atas_registro_precos_anon_select" ON public.atas_registro_precos
  FOR SELECT TO anon
  USING (true);

-- Permitir leitura anônima dos itens de atas no app mobile
GRANT SELECT ON public.atas_registro_precos_itens TO anon;
DROP POLICY IF EXISTS "atas_registro_precos_itens_anon_select" ON public.atas_registro_precos_itens;
CREATE POLICY "atas_registro_precos_itens_anon_select" ON public.atas_registro_precos_itens
  FOR SELECT TO anon
  USING (true);

-- Permitir leitura anônima de unidades participantes no app mobile
GRANT SELECT ON public.atas_registro_precos_unidades TO anon;
DROP POLICY IF EXISTS "atas_registro_precos_unidades_anon_select" ON public.atas_registro_precos_unidades;
CREATE POLICY "atas_registro_precos_unidades_anon_select" ON public.atas_registro_precos_unidades
  FOR SELECT TO anon
  USING (true);

-- Permitir leitura anônima de adesões (carona) no app mobile
GRANT SELECT ON public.atas_registro_precos_adesoes TO anon;
DROP POLICY IF EXISTS "atas_registro_precos_adesoes_anon_select" ON public.atas_registro_precos_adesoes;
CREATE POLICY "atas_registro_precos_adesoes_anon_select" ON public.atas_registro_precos_adesoes
  FOR SELECT TO anon
  USING (true);
