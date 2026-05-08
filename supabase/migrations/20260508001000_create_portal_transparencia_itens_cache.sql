CREATE TABLE IF NOT EXISTS portal_transparencia_empenho_itens_cache_status (
  empenho_lookup_key TEXT PRIMARY KEY,
  empenho_numero TEXT NOT NULL,
  codigo_documento TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('found', 'not_found', 'error')),
  rows_count INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_itens_cache_status_expires
  ON portal_transparencia_empenho_itens_cache_status(status, expires_at);

CREATE TABLE IF NOT EXISTS portal_transparencia_empenho_itens_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empenho_lookup_key TEXT NOT NULL REFERENCES portal_transparencia_empenho_itens_cache_status(empenho_lookup_key) ON DELETE CASCADE,
  empenho_numero TEXT NOT NULL,
  codigo_documento TEXT NOT NULL,
  codigo_item_empenho TEXT,
  sequencial INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  codigo_subelemento TEXT,
  descricao_subelemento TEXT,
  valor_atual NUMERIC(15, 2) DEFAULT 0,
  historico JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empenho_lookup_key, codigo_item_empenho, sequencial)
);

CREATE INDEX IF NOT EXISTS idx_portal_itens_cache_lookup
  ON portal_transparencia_empenho_itens_cache(empenho_lookup_key);

CREATE TRIGGER trg_update_portal_itens_cache_status_updated_at
BEFORE UPDATE ON portal_transparencia_empenho_itens_cache_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE portal_transparencia_empenho_itens_cache_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_transparencia_empenho_itens_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_status_select_public') THEN
    CREATE POLICY "portal_itens_status_select_public"
    ON portal_transparencia_empenho_itens_cache_status FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_status_all_auth') THEN
    CREATE POLICY "portal_itens_status_all_auth"
    ON portal_transparencia_empenho_itens_cache_status FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_rows_select_public') THEN
    CREATE POLICY "portal_itens_rows_select_public"
    ON portal_transparencia_empenho_itens_cache FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_rows_all_auth') THEN
    CREATE POLICY "portal_itens_rows_all_auth"
    ON portal_transparencia_empenho_itens_cache FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('refresh-portal-transparencia-itens-cache-hourly')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'refresh-portal-transparencia-itens-cache-hourly'
);

SELECT cron.schedule(
  'refresh-portal-transparencia-itens-cache-hourly',
  '25 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/refresh-portal-transparencia-itens-cache',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"refreshDue": true, "limit": 50, "source": "supabase-cron"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
