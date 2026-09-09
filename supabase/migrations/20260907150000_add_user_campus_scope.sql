-- Escopo de campus IFRN dentro do órgão atual.
-- Todos os registros legados são preservados e classificados como Currais Novos.

CREATE TABLE IF NOT EXISTS public.user_campus_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  campus_uasg text NOT NULL DEFAULT '158366' REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_campus_preferences_uasg_format CHECK (campus_uasg ~ '^\d{6}$'),
  CONSTRAINT user_campus_preferences_ifrn_uasg CHECK (campus_uasg IN (
    '152711', '152756', '152757', '154582', '154838', '154839', '154840',
    '158155', '158365', '158366', '158367', '158368', '158369', '158370',
    '158371', '158372', '158373', '158374', '158375'
  ))
);

ALTER TABLE public.user_campus_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_campus_preferences_select_own ON public.user_campus_preferences;
CREATE POLICY user_campus_preferences_select_own
  ON public.user_campus_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin_jwt());

DROP POLICY IF EXISTS user_campus_preferences_insert_own ON public.user_campus_preferences;
CREATE POLICY user_campus_preferences_insert_own
  ON public.user_campus_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_superadmin_jwt());

DROP POLICY IF EXISTS user_campus_preferences_update_own ON public.user_campus_preferences;
CREATE POLICY user_campus_preferences_update_own
  ON public.user_campus_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_superadmin_jwt())
  WITH CHECK (user_id = auth.uid() OR public.is_superadmin_jwt());

CREATE OR REPLACE FUNCTION public.current_user_campus_uasg()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT campus_uasg FROM public.user_campus_preferences WHERE user_id = auth.uid()),
    '158366'
  );
$$;

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
    '158371', '158372', '158373', '158374', '158375'
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

INSERT INTO public.user_campus_preferences (user_id, campus_uasg)
SELECT id, '158366'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'atividades',
    'empenhos',
    'descentralizacoes',
    'descentralizacoes_conta_saldos',
    'creditos_disponiveis',
    'creditos_disponiveis_detalhes',
    'rap_historico_anual',
    'contratos',
    'contratos_empenhos',
    'data_import_runs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS campus_uasg text', target_table);
    EXECUTE format('UPDATE public.%I SET campus_uasg = ''158366'' WHERE campus_uasg IS NULL', target_table);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN campus_uasg SET DEFAULT public.current_user_campus_uasg()', target_table);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN campus_uasg SET NOT NULL', target_table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (campus_uasg)', target_table || '_campus_uasg_idx', target_table);
  END LOOP;
END;
$$;

ALTER TABLE public.contratos_empenhos ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE RESTRICT DEFAULT public.default_org_id();
UPDATE public.contratos_empenhos SET org_id = public.default_org_id() WHERE org_id IS NULL;
ALTER TABLE public.contratos_empenhos ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.contratos_empenhos ADD COLUMN IF NOT EXISTS campus_uasg text;
UPDATE public.contratos_empenhos SET campus_uasg = '158366' WHERE campus_uasg IS NULL;
ALTER TABLE public.contratos_empenhos ALTER COLUMN campus_uasg SET DEFAULT public.current_user_campus_uasg();
ALTER TABLE public.contratos_empenhos ALTER COLUMN campus_uasg SET NOT NULL;
CREATE INDEX IF NOT EXISTS contratos_empenhos_campus_uasg_idx ON public.contratos_empenhos (campus_uasg);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contratos_empenhos_campus_uasg_fkey') THEN
    ALTER TABLE public.contratos_empenhos
      ADD CONSTRAINT contratos_empenhos_campus_uasg_fkey
      FOREIGN KEY (campus_uasg) REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg);
  END IF;
END;
$$;
DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_empenhos" ON public.contratos_empenhos;
DROP POLICY IF EXISTS "Permitir todas operações authenticated contratos_empenhos" ON public.contratos_empenhos;
CREATE POLICY contratos_empenhos_campus_select ON public.contratos_empenhos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_empenhos_campus_insert ON public.contratos_empenhos FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_empenhos_campus_update ON public.contratos_empenhos FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_empenhos_campus_delete ON public.contratos_empenhos FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DO $$
DECLARE
  target_table text;
  constraint_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'atividades',
    'empenhos',
    'descentralizacoes',
    'descentralizacoes_conta_saldos',
    'creditos_disponiveis',
    'creditos_disponiveis_detalhes',
    'rap_historico_anual',
    'contratos',
    'data_import_runs'
  ] LOOP
    constraint_name := target_table || '_campus_uasg_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (campus_uasg) REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg)',
        target_table,
        constraint_name
      );
    END IF;
  END LOOP;
END;
$$;

-- O PTRES deixa de ser global: o mesmo PTRES pode existir em campi diferentes.
ALTER TABLE public.creditos_disponiveis DROP CONSTRAINT IF EXISTS creditos_disponiveis_ptres_key;
DROP INDEX IF EXISTS public.creditos_disponiveis_ptres_key;
CREATE UNIQUE INDEX IF NOT EXISTS creditos_disponiveis_campus_ptres_key
  ON public.creditos_disponiveis (campus_uasg, ptres);

DROP INDEX IF EXISTS public.descentralizacoes_conta_saldos_ptres_key;
CREATE UNIQUE INDEX IF NOT EXISTS descentralizacoes_conta_saldos_campus_ptres_key
  ON public.descentralizacoes_conta_saldos (campus_uasg, ptres);

ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_numero_key;
CREATE UNIQUE INDEX IF NOT EXISTS contratos_campus_numero_key
  ON public.contratos (campus_uasg, numero);

-- Substitui as políticas de leitura/escrita do escopo orçamentário por versões
-- que mantêm o isolamento por órgão e acrescentam o isolamento por campus.
DROP POLICY IF EXISTS atividades_rls_org ON public.atividades;
DROP POLICY IF EXISTS atividades_rls_org_insert ON public.atividades;
DROP POLICY IF EXISTS atividades_rls_org_update ON public.atividades;
DROP POLICY IF EXISTS atividades_rls_org_delete ON public.atividades;
CREATE POLICY atividades_campus_select ON public.atividades FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY atividades_campus_insert ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY atividades_campus_update ON public.atividades FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY atividades_campus_delete ON public.atividades FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt());

DROP POLICY IF EXISTS empenhos_rls_org ON public.empenhos;
DROP POLICY IF EXISTS empenhos_rls_org_insert ON public.empenhos;
DROP POLICY IF EXISTS empenhos_rls_org_update ON public.empenhos;
DROP POLICY IF EXISTS empenhos_rls_org_delete ON public.empenhos;
DROP POLICY IF EXISTS "Permitir leitura anonima em empenhos" ON public.empenhos;
DROP POLICY IF EXISTS "Usuarios autenticados podem ler empenhos" ON public.empenhos;
CREATE POLICY empenhos_campus_select ON public.empenhos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY empenhos_campus_insert ON public.empenhos FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY empenhos_campus_update ON public.empenhos FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY empenhos_campus_delete ON public.empenhos FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt());

DROP POLICY IF EXISTS descentralizacoes_rls_org ON public.descentralizacoes;
DROP POLICY IF EXISTS descentralizacoes_rls_org_insert ON public.descentralizacoes;
DROP POLICY IF EXISTS descentralizacoes_rls_org_update ON public.descentralizacoes;
DROP POLICY IF EXISTS "Descentralizacoes são visíveis para todos" ON public.descentralizacoes;
DROP POLICY IF EXISTS "Descentralizacoes podem ser inseridas por todos (temporário)" ON public.descentralizacoes;
DROP POLICY IF EXISTS "Descentralizacoes podem ser atualizadas por todos (temporário)" ON public.descentralizacoes;
CREATE POLICY descentralizacoes_campus_select ON public.descentralizacoes FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY descentralizacoes_campus_insert ON public.descentralizacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY descentralizacoes_campus_update ON public.descentralizacoes FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS descentralizacoes_conta_saldos_rls_org ON public.descentralizacoes_conta_saldos;
DROP POLICY IF EXISTS descentralizacoes_conta_saldos_rls_org_insert ON public.descentralizacoes_conta_saldos;
DROP POLICY IF EXISTS descentralizacoes_conta_saldos_rls_org_update ON public.descentralizacoes_conta_saldos;
CREATE POLICY descentralizacoes_conta_saldos_campus_select ON public.descentralizacoes_conta_saldos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY descentralizacoes_conta_saldos_campus_insert ON public.descentralizacoes_conta_saldos FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY descentralizacoes_conta_saldos_campus_update ON public.descentralizacoes_conta_saldos FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS creditos_disponiveis_rls_org ON public.creditos_disponiveis;
DROP POLICY IF EXISTS creditos_disponiveis_rls_org_insert ON public.creditos_disponiveis;
DROP POLICY IF EXISTS creditos_disponiveis_rls_org_update ON public.creditos_disponiveis;
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.creditos_disponiveis;
DROP POLICY IF EXISTS "Permitir tudo para todos" ON public.creditos_disponiveis;
CREATE POLICY creditos_disponiveis_campus_select ON public.creditos_disponiveis FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY creditos_disponiveis_campus_insert ON public.creditos_disponiveis FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY creditos_disponiveis_campus_update ON public.creditos_disponiveis FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS creditos_disponiveis_detalhes_rls_org ON public.creditos_disponiveis_detalhes;
DROP POLICY IF EXISTS creditos_disponiveis_detalhes_rls_org_insert ON public.creditos_disponiveis_detalhes;
CREATE POLICY creditos_disponiveis_detalhes_campus_select ON public.creditos_disponiveis_detalhes FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY creditos_disponiveis_detalhes_campus_insert ON public.creditos_disponiveis_detalhes FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS contratos_rls_org ON public.contratos;
DROP POLICY IF EXISTS contratos_rls_org_insert ON public.contratos;
DROP POLICY IF EXISTS contratos_rls_org_update ON public.contratos;
DROP POLICY IF EXISTS contratos_rls_org_delete ON public.contratos;
DROP POLICY IF EXISTS "Permitir leitura anonima em contratos" ON public.contratos;
DROP POLICY IF EXISTS "Permitir todas operações authenticated contratos" ON public.contratos;
CREATE POLICY contratos_campus_select ON public.contratos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_campus_insert ON public.contratos FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_campus_update ON public.contratos FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY contratos_campus_delete ON public.contratos FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS data_import_runs_select_org ON public.data_import_runs;
DROP POLICY IF EXISTS data_import_runs_insert_org ON public.data_import_runs;
DROP POLICY IF EXISTS data_import_runs_update_org ON public.data_import_runs;
DROP POLICY IF EXISTS data_import_runs_delete_org ON public.data_import_runs;
CREATE POLICY data_import_runs_campus_select ON public.data_import_runs FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY data_import_runs_campus_insert ON public.data_import_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY data_import_runs_campus_update ON public.data_import_runs FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()))
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

DROP POLICY IF EXISTS rap_historico_anual_anon_select ON public.rap_historico_anual;
DROP POLICY IF EXISTS rap_historico_anual_select ON public.rap_historico_anual;
DROP POLICY IF EXISTS rap_historico_anual_insert ON public.rap_historico_anual;
DROP POLICY IF EXISTS rap_historico_anual_rls_org ON public.rap_historico_anual;
DROP POLICY IF EXISTS rap_historico_anual_rls_org_insert ON public.rap_historico_anual;
REVOKE SELECT ON public.rap_historico_anual FROM anon;
CREATE POLICY rap_historico_anual_campus_select ON public.rap_historico_anual FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));
CREATE POLICY rap_historico_anual_campus_insert ON public.rap_historico_anual FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR (org_id = public.current_user_org_id() AND campus_uasg = public.current_user_campus_uasg()));

COMMENT ON COLUMN public.atividades.campus_uasg IS 'Campus IFRN ao qual o planejamento pertence.';
COMMENT ON COLUMN public.empenhos.campus_uasg IS 'Campus IFRN ao qual o empenho pertence.';
COMMENT ON COLUMN public.descentralizacoes.campus_uasg IS 'Campus IFRN ao qual a descentralização pertence.';

-- Um contrato originado na Reitoria pode atender mais de um campus. A tabela
-- de escopo evita perder essa relação quando a sincronização de cada UASG
-- acontece em momentos diferentes.
CREATE TABLE IF NOT EXISTS public.contratos_api_campus_scope (
  contrato_api_id uuid NOT NULL REFERENCES public.contratos_api(id) ON DELETE CASCADE,
  campus_uasg text NOT NULL,
  scope_reason text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contrato_api_id, campus_uasg),
  CONSTRAINT contratos_api_campus_scope_uasg_format CHECK (campus_uasg ~ '^\d{6}$')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contratos_api_campus_scope_uasg_fkey'
      AND conrelid = 'public.contratos_api_campus_scope'::regclass
  ) THEN
    ALTER TABLE public.contratos_api_campus_scope
      ADD CONSTRAINT contratos_api_campus_scope_uasg_fkey
      FOREIGN KEY (campus_uasg) REFERENCES public.licitacoes_pncp_uasgs(codigo_uasg);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contratos_api_campus_scope_campus_idx
  ON public.contratos_api_campus_scope (campus_uasg, contrato_api_id);

ALTER TABLE public.contratos_api_campus_scope ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contratos_api_campus_scope_select_authenticated ON public.contratos_api_campus_scope;
CREATE POLICY contratos_api_campus_scope_select_authenticated
  ON public.contratos_api_campus_scope FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR campus_uasg = public.current_user_campus_uasg());

INSERT INTO public.contratos_api_campus_scope (contrato_api_id, campus_uasg, scope_reason)
SELECT id, '158366', COALESCE(campus_scope_reason, 'ug_campus')
FROM public.contratos_api
WHERE campus_scope_reason IN ('ug_campus', 'reitoria_com_empenho_campus', 'reitoria_com_fatura_campus')
ON CONFLICT (contrato_api_id, campus_uasg) DO UPDATE
  SET scope_reason = EXCLUDED.scope_reason, updated_at = now();

-- Os contratos públicos deixam de ser uma exceção ao isolamento por campus.
-- O service_role continua podendo sincronizar e os usuários autenticados
-- passam a enxergar somente contratos e dependências associados ao campus ativo.
ALTER TABLE public.contratos_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_fatura_empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_api_instrumentos_cobranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api" ON public.contratos_api;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api" ON public.contratos_api;
CREATE POLICY contratos_api_campus_select ON public.contratos_api FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api.id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_empenhos" ON public.contratos_api_empenhos;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_empenhos" ON public.contratos_api_empenhos;
CREATE POLICY contratos_api_empenhos_campus_select ON public.contratos_api_empenhos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_empenhos.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_faturas" ON public.contratos_api_faturas;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_faturas" ON public.contratos_api_faturas;
CREATE POLICY contratos_api_faturas_campus_select ON public.contratos_api_faturas FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_faturas.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_itens" ON public.contratos_api_itens;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_itens" ON public.contratos_api_itens;
CREATE POLICY contratos_api_itens_campus_select ON public.contratos_api_itens FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_itens.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_fatura_itens" ON public.contratos_api_fatura_itens;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_fatura_itens" ON public.contratos_api_fatura_itens;
CREATE POLICY contratos_api_fatura_itens_campus_select ON public.contratos_api_fatura_itens FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_fatura_itens.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_fatura_empenhos" ON public.contratos_api_fatura_empenhos;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_fatura_empenhos" ON public.contratos_api_fatura_empenhos;
CREATE POLICY contratos_api_fatura_empenhos_campus_select ON public.contratos_api_fatura_empenhos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_fatura_empenhos.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura anonima em contratos_api_historico" ON public.contratos_api_historico;
DROP POLICY IF EXISTS "Permitir todas operacoes authenticated contratos_api_historico" ON public.contratos_api_historico;
CREATE POLICY contratos_api_historico_campus_select ON public.contratos_api_historico FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_historico.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura de documentos de contratos para todos" ON public.contratos_api_documentos;
CREATE POLICY contratos_api_documentos_campus_select ON public.contratos_api_documentos FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_documentos.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));

DROP POLICY IF EXISTS "Permitir leitura de instrumentos de cobranca para todos" ON public.contratos_api_instrumentos_cobranca;
CREATE POLICY contratos_api_instrumentos_campus_select ON public.contratos_api_instrumentos_cobranca FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR EXISTS (
    SELECT 1 FROM public.contratos_api_campus_scope scope
    WHERE scope.contrato_api_id = public.contratos_api_instrumentos_cobranca.contrato_api_id
      AND scope.campus_uasg = public.current_user_campus_uasg()
  ));
