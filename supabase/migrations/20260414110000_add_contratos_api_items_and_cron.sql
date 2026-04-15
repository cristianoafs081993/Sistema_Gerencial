ALTER TABLE contratos_api_sync_runs
  ADD COLUMN IF NOT EXISTS itens_upserted INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatura_itens_upserted INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatura_empenhos_upserted INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS contratos_api_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  api_item_id BIGINT NOT NULL,
  tipo_id TEXT,
  tipo_material TEXT,
  grupo_id TEXT,
  catmatseritem_id TEXT,
  descricao_complementar TEXT,
  quantidade NUMERIC(15, 5) DEFAULT 0,
  valor_unitario NUMERIC(15, 4) DEFAULT 0,
  valor_total NUMERIC(15, 2) DEFAULT 0,
  numero_item_compra TEXT,
  data_inicio_item DATE,
  historico_item JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, api_item_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_itens_contrato_api_id
  ON contratos_api_itens(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_itens_api_item_id
  ON contratos_api_itens(api_item_id);

CREATE TABLE IF NOT EXISTS contratos_api_fatura_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  contrato_api_fatura_id UUID NOT NULL REFERENCES contratos_api_faturas(id) ON DELETE CASCADE,
  contrato_api_item_id UUID REFERENCES contratos_api_itens(id) ON DELETE SET NULL,
  api_item_id BIGINT NOT NULL,
  quantidade_faturado NUMERIC(15, 5) DEFAULT 0,
  valor_unitario_faturado NUMERIC(15, 4) DEFAULT 0,
  valor_total_faturado NUMERIC(15, 2) DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_itens_contrato_api_id
  ON contratos_api_fatura_itens(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_itens_fatura_id
  ON contratos_api_fatura_itens(contrato_api_fatura_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_itens_item_id
  ON contratos_api_fatura_itens(contrato_api_item_id);

CREATE TABLE IF NOT EXISTS contratos_api_fatura_empenhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  contrato_api_fatura_id UUID NOT NULL REFERENCES contratos_api_faturas(id) ON DELETE CASCADE,
  contrato_api_empenho_id UUID REFERENCES contratos_api_empenhos(id) ON DELETE SET NULL,
  api_empenho_id BIGINT,
  numero_empenho TEXT,
  valor_empenho NUMERIC(15, 2) DEFAULT 0,
  subelemento TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_empenhos_contrato_api_id
  ON contratos_api_fatura_empenhos(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_empenhos_fatura_id
  ON contratos_api_fatura_empenhos(contrato_api_fatura_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_fatura_empenhos_empenho_id
  ON contratos_api_fatura_empenhos(contrato_api_empenho_id);

CREATE TRIGGER trg_update_contratos_api_itens_updated_at
BEFORE UPDATE ON contratos_api_itens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE contratos_api_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_fatura_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_fatura_empenhos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_itens') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_itens"
    ON contratos_api_itens FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_itens') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_itens"
    ON contratos_api_itens FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_fatura_itens') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_fatura_itens"
    ON contratos_api_fatura_itens FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_fatura_itens') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_fatura_itens"
    ON contratos_api_fatura_itens FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_fatura_empenhos') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_fatura_empenhos"
    ON contratos_api_fatura_empenhos FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_fatura_empenhos') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_fatura_empenhos"
    ON contratos_api_fatura_empenhos FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('sync-contratos-comprasnet-6h')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'sync-contratos-comprasnet-6h'
);

SELECT cron.schedule(
  'sync-contratos-comprasnet-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mnqhwyrzhgykjlyyqodd.supabase.co/functions/v1/sync-contratos-comprasnet',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"unidadeCodigo": "158366", "source": "supabase-cron"}'::jsonb,
    timeout_milliseconds := 600000
  );
  $$
);
