CREATE TABLE IF NOT EXISTS contratos_api_empenho_liquidacoes_cache_status (
  empenho_lookup_key TEXT PRIMARY KEY,
  empenho_numero TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('found', 'not_found', 'error')),
  unidades_consultadas TEXT[] DEFAULT '{}'::text[],
  rows_count INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_liq_cache_status_expires
  ON contratos_api_empenho_liquidacoes_cache_status(status, expires_at);

CREATE TABLE IF NOT EXISTS contratos_api_empenho_liquidacoes_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empenho_lookup_key TEXT NOT NULL REFERENCES contratos_api_empenho_liquidacoes_cache_status(empenho_lookup_key) ON DELETE CASCADE,
  empenho_numero TEXT NOT NULL,
  empenho_numero_api TEXT,
  unidade_contrato TEXT,
  contrato_api_id BIGINT NOT NULL,
  contrato_numero TEXT,
  contrato_objeto TEXT,
  fatura_id BIGINT NOT NULL,
  numero_instrumento_cobranca TEXT,
  situacao TEXT,
  valor_bruto NUMERIC(15, 2) DEFAULT 0,
  valor_liquido NUMERIC(15, 2) DEFAULT 0,
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  data_liquidacao DATE,
  processo TEXT,
  valor_empenho NUMERIC(15, 2) DEFAULT 0,
  subelemento TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empenho_lookup_key, contrato_api_id, fatura_id, empenho_numero_api)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_liq_cache_lookup
  ON contratos_api_empenho_liquidacoes_cache(empenho_lookup_key);
CREATE INDEX IF NOT EXISTS idx_contratos_api_liq_cache_contrato
  ON contratos_api_empenho_liquidacoes_cache(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_liq_cache_fatura
  ON contratos_api_empenho_liquidacoes_cache(fatura_id);

CREATE TRIGGER trg_update_contratos_api_liq_cache_status_updated_at
BEFORE UPDATE ON contratos_api_empenho_liquidacoes_cache_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE contratos_api_empenho_liquidacoes_cache_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_empenho_liquidacoes_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_empenho_liquidacoes_cache_status') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_empenho_liquidacoes_cache_status"
    ON contratos_api_empenho_liquidacoes_cache_status FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_empenho_liquidacoes_cache_status') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_empenho_liquidacoes_cache_status"
    ON contratos_api_empenho_liquidacoes_cache_status FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_empenho_liquidacoes_cache') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_empenho_liquidacoes_cache"
    ON contratos_api_empenho_liquidacoes_cache FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_empenho_liquidacoes_cache') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_empenho_liquidacoes_cache"
    ON contratos_api_empenho_liquidacoes_cache FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('refresh-comprasnet-liquidacoes-cache-hourly')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'refresh-comprasnet-liquidacoes-cache-hourly'
);

SELECT cron.schedule(
  'refresh-comprasnet-liquidacoes-cache-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/refresh-comprasnet-liquidacoes-cache',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"refreshDue": true, "limit": 50, "source": "supabase-cron"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
