-- Ensure inserts that omit org_id still land in the current tenant.
-- Browser requests use the authenticated user's org. Service-role jobs
-- without an auth.uid(), such as e-mail CSV ingestion, fall back to the
-- legacy/default IFRN Currais Novos org.

CREATE OR REPLACE FUNCTION public.default_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.current_user_org_id(),
    (SELECT id FROM public.orgs WHERE slug = 'ifrn-cn' LIMIT 1),
    (SELECT id FROM public.orgs WHERE is_active = true ORDER BY created_at LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.default_org_id() IS
  'Returns the org_id used as default for tenant-scoped data inserts. Prefers the authenticated user org and falls back to the legacy IFRN-CN org for service-role jobs.';

DO $$
DECLARE
  target_table text;
  tables_with_org text[] := ARRAY[
    'atividades',
    'empenhos',
    'descentralizacoes',
    'descentralizacoes_conta_saldos',
    'creditos_disponiveis',
    'creditos_disponiveis_detalhes',
    'rap_historico_anual',
    'documentos_habeis',
    'retencoes',
    'pf_solicitacao',
    'pf_aprovacao',
    'pf_liberacao',
    'contratos',
    'requisicoes_compra',
    'financeiro_fonte_vinculacao',
    'lc_credores',
    'retencoes_efd_reinf',
    'energia_import_runs',
    'energia_consumo_faturas',
    'energia_solar_geracao',
    'energia_contratos',
    'energia_contrato_execucoes',
    'price_researches',
    'suppliers'
  ];
BEGIN
  FOREACH target_table IN ARRAY tables_with_org LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_table
        AND column_name = 'org_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT public.default_org_id()',
        target_table
      );

      EXECUTE format(
        'UPDATE public.%I SET org_id = public.default_org_id() WHERE org_id IS NULL',
        target_table
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS descentralizacoes_conta_saldos_org_ptres_idx
  ON public.descentralizacoes_conta_saldos (org_id, ptres);

