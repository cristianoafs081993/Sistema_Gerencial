CREATE TABLE IF NOT EXISTS public.automation_savings_scenarios (
  id text PRIMARY KEY,
  interaction_name text NOT NULL,
  module_name text NOT NULL,
  source text NOT NULL,
  baseline_minutes numeric(10,2) NOT NULL CHECK (baseline_minutes >= 0),
  automated_minutes numeric(10,2) NOT NULL CHECK (automated_minutes >= 0),
  estimated_monthly_runs integer NOT NULL DEFAULT 0 CHECK (estimated_monthly_runs >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_savings_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  scenario_id text NOT NULL REFERENCES public.automation_savings_scenarios(id) ON DELETE RESTRICT,
  source text NOT NULL,
  event_name text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_email text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_minutes numeric(10,2) NOT NULL CHECK (baseline_minutes >= 0),
  automated_minutes numeric(10,2) NOT NULL CHECK (automated_minutes >= 0),
  saved_minutes numeric(10,2) NOT NULL CHECK (saved_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_savings_events_scenario_occurred_idx
  ON public.automation_savings_events (scenario_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS automation_savings_events_occurred_idx
  ON public.automation_savings_events (occurred_at DESC);

ALTER TABLE public.automation_savings_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_savings_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_automation_savings_scenarios_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_automation_savings_scenarios_updated_at
      BEFORE UPDATE ON public.automation_savings_scenarios
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated automation_savings_scenarios') THEN
    CREATE POLICY "Permitir leitura authenticated automation_savings_scenarios"
      ON public.automation_savings_scenarios
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated automation_savings_events') THEN
    CREATE POLICY "Permitir leitura authenticated automation_savings_events"
      ON public.automation_savings_events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

INSERT INTO public.screen_groups (id, name, sort_order)
VALUES ('automacoes', 'Automações', 50)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES ('economia-tempo', 'automacoes', 'Economia de Tempo', '/economia-tempo', 10, false, true)
ON CONFLICT (id) DO UPDATE
SET screen_group_id = EXCLUDED.screen_group_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    sort_order = EXCLUDED.sort_order,
    is_admin_only = EXCLUDED.is_admin_only,
    is_active = EXCLUDED.is_active;

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT groups.id, 'economia-tempo', true
FROM public.user_groups groups
WHERE groups.slug = 'diretores'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

INSERT INTO public.automation_savings_scenarios (
  id,
  interaction_name,
  module_name,
  source,
  baseline_minutes,
  automated_minutes,
  estimated_monthly_runs,
  status,
  sort_order
)
VALUES
  ('siafi-login', 'Login e preparação no SIAFI', 'SIAFI', 'Sistema + extensão', 8, 2, 40, 'active', 10),
  ('relatorios-gerenciais', 'Montagem de relatório gerencial', 'Relatórios', 'Sistema Gerencial', 45, 5, 12, 'active', 20),
  ('documentos-liquidacoes', 'Consulta de documentos/liquidações', 'Financeiro', 'Sistema Gerencial', 25, 4, 30, 'active', 30),
  ('conciliacao-pfs-lc', 'Conciliação de PFs/LC', 'PFs e LC', 'Sistema Gerencial', 60, 10, 8, 'active', 40),
  ('contratos-comprasnet', 'Consulta de contratos/Comprasnet', 'Contratos', 'API Comprasnet', 40, 6, 10, 'active', 50),
  ('suap-processos', 'Sincronização SUAP/processos/PDFs', 'SUAP', 'Extensão SUAP Scraper', 35, 6, 20, 'active', 60),
  ('importacoes-arquivos', 'Importações CSV/XLSX/PDF', 'Importações', 'Uploads e Gmail', 30, 5, 10, 'active', 70),
  ('geracao-documentos', 'Geração assistida de documentos', 'Documentos', 'IA e modelos', 90, 20, 6, 'active', 80)
ON CONFLICT (id) DO UPDATE
SET interaction_name = EXCLUDED.interaction_name,
    module_name = EXCLUDED.module_name,
    source = EXCLUDED.source,
    baseline_minutes = EXCLUDED.baseline_minutes,
    automated_minutes = EXCLUDED.automated_minutes,
    estimated_monthly_runs = EXCLUDED.estimated_monthly_runs,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
