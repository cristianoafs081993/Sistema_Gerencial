ALTER TABLE contratos_api_sync_runs
  ADD COLUMN IF NOT EXISTS historicos_upserted INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS contratos_api_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  api_historico_id BIGINT NOT NULL,
  numero TEXT,
  receita_despesa TEXT,
  tipo TEXT,
  qualificacao_termo JSONB DEFAULT '[]'::jsonb,
  observacao TEXT,
  ug TEXT,
  gestao TEXT,
  codigo_tipo TEXT,
  categoria TEXT,
  processo TEXT,
  objeto TEXT,
  fundamento_legal_aditivo TEXT,
  informacao_complementar TEXT,
  modalidade TEXT,
  licitacao_numero TEXT,
  codigo_unidade_origem TEXT,
  nome_unidade_origem TEXT,
  data_assinatura DATE,
  data_publicacao DATE,
  data_proposta_comercial DATE,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  valor_inicial NUMERIC(15, 2) DEFAULT 0,
  valor_global NUMERIC(15, 2) DEFAULT 0,
  num_parcelas INTEGER,
  valor_parcela NUMERIC(15, 2) DEFAULT 0,
  novo_valor_global NUMERIC(15, 2) DEFAULT 0,
  novo_num_parcelas INTEGER,
  novo_valor_parcela NUMERIC(15, 2) DEFAULT 0,
  data_inicio_novo_valor DATE,
  retroativo TEXT,
  retroativo_mesref_de TEXT,
  retroativo_anoref_de TEXT,
  retroativo_mesref_ate TEXT,
  retroativo_anoref_ate TEXT,
  retroativo_vencimento DATE,
  retroativo_valor NUMERIC(15, 2) DEFAULT 0,
  situacao_contrato TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, api_historico_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_historico_contrato_api_id
  ON contratos_api_historico(contrato_api_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_historico_api_historico_id
  ON contratos_api_historico(api_historico_id);
CREATE INDEX IF NOT EXISTS idx_contratos_api_historico_ug
  ON contratos_api_historico(ug);
CREATE INDEX IF NOT EXISTS idx_contratos_api_historico_unidade_origem
  ON contratos_api_historico(codigo_unidade_origem);
CREATE INDEX IF NOT EXISTS idx_contratos_api_historico_data_assinatura
  ON contratos_api_historico(data_assinatura);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_contratos_api_historico_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_contratos_api_historico_updated_at
    BEFORE UPDATE ON contratos_api_historico
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE contratos_api_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_api_historico') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_api_historico"
    ON contratos_api_historico FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes authenticated contratos_api_historico') THEN
    CREATE POLICY "Permitir todas operacoes authenticated contratos_api_historico"
    ON contratos_api_historico FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
