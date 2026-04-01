-- Novo modulo: acompanhamento de contratos via API (sem substituir o modulo legado)

CREATE TABLE IF NOT EXISTS contratos_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_contrato_id BIGINT UNIQUE NOT NULL,
  numero TEXT NOT NULL,
  receita_despesa TEXT,
  orgao_codigo TEXT,
  orgao_nome TEXT,
  unidade_codigo TEXT,
  unidade_nome TEXT,
  unidade_nome_resumido TEXT,
  unidade_origem_codigo TEXT,
  unidade_origem_nome TEXT,
  fornecedor_tipo TEXT,
  fornecedor_documento TEXT,
  fornecedor_nome TEXT,
  categoria TEXT,
  objeto TEXT,
  processo TEXT,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  valor_global NUMERIC(15, 2),
  valor_acumulado NUMERIC(15, 2),
  situacao BOOLEAN DEFAULT true,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_numero ON contratos_api(numero);
CREATE INDEX IF NOT EXISTS idx_contratos_api_unidade_codigo ON contratos_api(unidade_codigo);
CREATE INDEX IF NOT EXISTS idx_contratos_api_situacao ON contratos_api(situacao);

CREATE TABLE IF NOT EXISTS contratos_api_empenhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  api_empenho_id BIGINT NOT NULL,
  numero TEXT NOT NULL,
  unidade_gestora TEXT,
  gestao TEXT,
  data_emissao DATE,
  credor TEXT,
  fonte_recurso TEXT,
  plano_interno TEXT,
  natureza_despesa TEXT,
  valor_empenhado NUMERIC(15, 2) DEFAULT 0,
  valor_a_liquidar NUMERIC(15, 2) DEFAULT 0,
  valor_liquidado NUMERIC(15, 2) DEFAULT 0,
  valor_pago NUMERIC(15, 2) DEFAULT 0,
  rp_inscrito NUMERIC(15, 2) DEFAULT 0,
  rp_a_pagar NUMERIC(15, 2) DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, api_empenho_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_empenhos_contrato_api_id ON contratos_api_empenhos(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_empenhos_numero ON contratos_api_empenhos(numero);

CREATE TABLE IF NOT EXISTS contratos_api_faturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  api_fatura_id BIGINT NOT NULL,
  tipo_lista_fatura TEXT,
  tipo_instrumento_cobranca TEXT,
  numero_instrumento_cobranca TEXT,
  mes_referencia TEXT,
  ano_referencia TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  situacao TEXT,
  valor_bruto NUMERIC(15, 2) DEFAULT 0,
  valor_liquido NUMERIC(15, 2) DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, api_fatura_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_faturas_contrato_api_id ON contratos_api_faturas(contrato_api_id);

CREATE TABLE IF NOT EXISTS contratos_api_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_codigo TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  contratos_ativos INTEGER DEFAULT 0,
  contratos_inativos INTEGER DEFAULT 0,
  contratos_upserted INTEGER DEFAULT 0,
  empenhos_upserted INTEGER DEFAULT 0,
  faturas_upserted INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_sync_runs_started_at ON contratos_api_sync_runs(started_at DESC);

CREATE TRIGGER trg_update_contratos_api_updated_at
BEFORE UPDATE ON contratos_api
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_contratos_api_empenhos_updated_at
BEFORE UPDATE ON contratos_api_empenhos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_contratos_api_faturas_updated_at
BEFORE UPDATE ON contratos_api_faturas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE contratos_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_api_sync_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api"
    ON contratos_api FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api"
    ON contratos_api FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_empenhos') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_empenhos"
    ON contratos_api_empenhos FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_empenhos') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_empenhos"
    ON contratos_api_empenhos FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_faturas') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_faturas"
    ON contratos_api_faturas FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_faturas') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_faturas"
    ON contratos_api_faturas FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_sync_runs') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_sync_runs"
    ON contratos_api_sync_runs FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_sync_runs') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_sync_runs"
    ON contratos_api_sync_runs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
