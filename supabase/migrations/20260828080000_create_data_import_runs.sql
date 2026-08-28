-- =============================================================
-- Central de Observabilidade: Tabela de Execuções de Importação
-- Permite rastrear uploads manuais (CSV/XLSX/JSON), volume de dados,
-- status de ingestão, falhas e histórico de atualizações por órgão.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.data_import_runs (
  id              UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE DEFAULT public.default_org_id(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  pipeline        TEXT NOT NULL,
  pipeline_name   TEXT NOT NULL,
  source_type     TEXT NOT NULL DEFAULT 'manual_upload' CHECK (source_type IN ('manual_upload', 'email_csv', 'api_sync')),
  source_name     TEXT,
  status          TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'warning', 'failed', 'skipped')),
  rows_detected   INTEGER NOT NULL DEFAULT 0,
  rows_written    INTEGER NOT NULL DEFAULT 0,
  rows_skipped    INTEGER NOT NULL DEFAULT 0,
  rows_updated    INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_import_runs IS 'Histórico e auditoria de uploads manuais e execuções de importação de dados por órgão.';

CREATE INDEX IF NOT EXISTS idx_data_import_runs_org_created
  ON public.data_import_runs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_import_runs_pipeline_created
  ON public.data_import_runs (pipeline, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_import_runs_status
  ON public.data_import_runs (status);

CREATE INDEX IF NOT EXISTS idx_data_import_runs_source_type
  ON public.data_import_runs (source_type);

ALTER TABLE public.data_import_runs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_data_import_runs_updated_at ON public.data_import_runs;
CREATE TRIGGER trg_data_import_runs_updated_at
  BEFORE UPDATE ON public.data_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Políticas de RLS para data_import_runs
DROP POLICY IF EXISTS data_import_runs_select_org ON public.data_import_runs;
CREATE POLICY data_import_runs_select_org
  ON public.data_import_runs FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS data_import_runs_insert_org ON public.data_import_runs;
CREATE POLICY data_import_runs_insert_org
  ON public.data_import_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS data_import_runs_update_org ON public.data_import_runs;
CREATE POLICY data_import_runs_update_org
  ON public.data_import_runs FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id())
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS data_import_runs_delete_org ON public.data_import_runs;
CREATE POLICY data_import_runs_delete_org
  ON public.data_import_runs FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_import_runs TO authenticated;

-- Garantir políticas de leitura em email_csv_ingestion_runs para usuários autenticados
DROP POLICY IF EXISTS email_csv_ingestion_runs_select_authenticated ON public.email_csv_ingestion_runs;
CREATE POLICY email_csv_ingestion_runs_select_authenticated
  ON public.email_csv_ingestion_runs FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.email_csv_ingestion_runs TO authenticated;
