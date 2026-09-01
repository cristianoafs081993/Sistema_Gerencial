-- Migration: Tabela de instrumentos de cobranca (NF-e) do PNCP e colunas de controle

-- 1. Colunas de rastreamento de instrumentos de cobranca na tabela contratos_api
ALTER TABLE contratos_api
  ADD COLUMN IF NOT EXISTS pncp_instrumentos_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pncp_instrumentos_count INTEGER DEFAULT 0;

-- 2. Tabela de instrumentos de cobranca (NF-e) vinculados aos contratos da API
CREATE TABLE IF NOT EXISTS contratos_api_instrumentos_cobranca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_api_id UUID NOT NULL REFERENCES contratos_api(id) ON DELETE CASCADE,
  sequencial_instrumento_cobranca INTEGER NOT NULL,
  tipo_id INTEGER,
  tipo_nome TEXT NOT NULL DEFAULT 'Nota Fiscal Eletrônica (NF-e)',
  tipo_descricao TEXT,
  numero_instrumento_cobranca TEXT NOT NULL,
  data_emissao DATE,
  chave_nfe TEXT,
  data_consulta_nfe TIMESTAMPTZ,
  status_response_nfe TEXT,
  valor_nota_fiscal NUMERIC(15,2),
  serie TEXT,
  tipo_evento_mais_recente TEXT,
  data_tipo_evento_mais_recente TIMESTAMPTZ,
  nome_fornecedor TEXT,
  cnpj_fornecedor TEXT,
  municipio_fornecedor TEXT,
  itens JSONB DEFAULT '[]'::jsonb,
  eventos JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_api_id, sequencial_instrumento_cobranca, numero_instrumento_cobranca)
);

CREATE INDEX IF NOT EXISTS idx_contratos_api_inst_cobranca_contrato_id
  ON contratos_api_instrumentos_cobranca(contrato_api_id);

CREATE INDEX IF NOT EXISTS idx_contratos_api_inst_cobranca_numero
  ON contratos_api_instrumentos_cobranca(numero_instrumento_cobranca);

CREATE INDEX IF NOT EXISTS idx_contratos_api_inst_cobranca_chave_nfe
  ON contratos_api_instrumentos_cobranca(chave_nfe);

CREATE INDEX IF NOT EXISTS idx_contratos_api_inst_cobranca_data_emissao
  ON contratos_api_instrumentos_cobranca(data_emissao DESC NULLS LAST);

-- 3. Habilita RLS e politicas de leitura publica/autenticada
ALTER TABLE contratos_api_instrumentos_cobranca ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contratos_api_instrumentos_cobranca' AND policyname = 'Permitir leitura de instrumentos de cobranca para todos'
  ) THEN
    CREATE POLICY "Permitir leitura de instrumentos de cobranca para todos"
      ON contratos_api_instrumentos_cobranca FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contratos_api_instrumentos_cobranca' AND policyname = 'Permitir gerenciamento de instrumentos de cobranca para service_role'
  ) THEN
    CREATE POLICY "Permitir gerenciamento de instrumentos de cobranca para service_role"
      ON contratos_api_instrumentos_cobranca FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
