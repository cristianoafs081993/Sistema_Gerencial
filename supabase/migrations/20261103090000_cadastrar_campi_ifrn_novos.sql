-- Cadastra as UGs de campi novos/avançados do IFRN que já emitem NE no SIAFI:
--   158882 Parelhas, 158887 Lajes, 158896 Touros, 158897 São Miguel, 158898 Umarizal.
-- Sem o cadastro, as NEs dessas UGs eram ignoradas na importação de empenhos (campus_uasg tem FK para
-- licitacoes_pncp_uasgs e a escolha de campus é restrita à lista abaixo).

INSERT INTO public.licitacoes_pncp_uasgs (
  codigo_uasg,
  nome_uasg,
  codigo_orgao,
  cnpj_orgao,
  sigla_uf,
  raw_data
)
VALUES
  ('158882', 'Parelhas', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158887', 'Lajes', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158896', 'Touros', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158897', 'Sao Miguel', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb),
  ('158898', 'Umarizal', '26435', '10877412000168', 'RN', '{"source":"internal-ifrn-catalog","aliases":[]}'::jsonb)
ON CONFLICT (codigo_uasg) DO UPDATE
SET nome_uasg = EXCLUDED.nome_uasg,
    codigo_orgao = EXCLUDED.codigo_orgao,
    cnpj_orgao = EXCLUDED.cnpj_orgao,
    sigla_uf = EXCLUDED.sigla_uf,
    raw_data = EXCLUDED.raw_data,
    updated_at = now();

ALTER TABLE public.user_campus_preferences
  DROP CONSTRAINT IF EXISTS user_campus_preferences_ifrn_uasg;
ALTER TABLE public.user_campus_preferences
  ADD CONSTRAINT user_campus_preferences_ifrn_uasg CHECK (campus_uasg IN (
    '152711', '152756', '152757', '154582', '154838', '154839', '154840',
    '158155', '158365', '158366', '158367', '158368', '158369', '158370',
    '158371', '158372', '158373', '158374', '158375',
    '158882', '158887', '158896', '158897', '158898'
  ));

CREATE OR REPLACE FUNCTION public.set_user_campus_uasg(target_uasg text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_uasg IS NULL OR target_uasg !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Campus IFRN inválido.' USING ERRCODE = '22023';
  END IF;

  IF target_uasg NOT IN (
    '152711', '152756', '152757', '154582', '154838', '154839', '154840',
    '158155', '158365', '158366', '158367', '158368', '158369', '158370',
    '158371', '158372', '158373', '158374', '158375',
    '158882', '158887', '158896', '158897', '158898'
  ) OR NOT EXISTS (SELECT 1 FROM public.licitacoes_pncp_uasgs WHERE codigo_uasg = target_uasg) THEN
    RAISE EXCEPTION 'Campus IFRN não cadastrado.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_campus_preferences (user_id, campus_uasg)
  VALUES (auth.uid(), target_uasg)
  ON CONFLICT (user_id) DO UPDATE
    SET campus_uasg = EXCLUDED.campus_uasg, updated_at = now();

  RETURN target_uasg;
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_campus_uasg(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_campus_uasg(text) TO authenticated;
