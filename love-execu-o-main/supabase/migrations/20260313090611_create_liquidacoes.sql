-- =============================================
-- Migration: 0007_create_liquidacoes.sql
-- Description: Criação das tabelas para o carregamento e gerenciamento de Liquidações, 
--  seus vínculos associativos com Empenhos, e os resgistros de Documentos Gerados (NS/OB)
-- =============================================

-- =============================================
-- 1. TABELAS DE DOMÍNIO E NÚCLEO
-- =============================================

-- 1.1 Tabela Principal de Liquidações (Notas de Pagamento e Recibos de Pagamento)
CREATE TABLE IF NOT EXISTS liquidacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL, -- Ex: 2026NP000042 ou 2026RP000010
  tipo TEXT NOT NULL CHECK (tipo IN ('NP', 'RP')),
  data_emissao DATE NOT NULL,
  favorecido_cnpj_cpf TEXT, 
  favorecido_nome TEXT,
  processo TEXT,
  observacao TEXT,
  valor_total DECIMAL(15, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.2 Tabela Associativa: Liquidações <-> Empenhos (0 to N)
CREATE TABLE IF NOT EXISTS liquidacoes_empenhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidacao_id UUID NOT NULL REFERENCES liquidacoes(id) ON DELETE CASCADE,
  empenho_id UUID NOT NULL REFERENCES empenhos(id) ON DELETE CASCADE,
  valor_vinculado DECIMAL(15, 2), -- Valor da liquidação atribuído a este empenho específico
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(liquidacao_id, empenho_id)
);

-- 1.3 Tabela de Documentos Gerados a partir da Liquidação (NS, OB)
CREATE TABLE IF NOT EXISTS documentos_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL, -- Ex: 158366264352026OB000001
  liquidacao_id UUID NOT NULL REFERENCES liquidacoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('NS', 'OB')),
  data_lancamento DATE,
  valor DECIMAL(15, 2),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 2. ÍNDICES DE PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_liquidacoes_numero ON liquidacoes(numero);
CREATE INDEX IF NOT EXISTS idx_liquidacoes_data_emissao ON liquidacoes(data_emissao);
CREATE INDEX IF NOT EXISTS idx_liquidacoes_empenhos_liquidacao_id ON liquidacoes_empenhos(liquidacao_id);
CREATE INDEX IF NOT EXISTS idx_liquidacoes_empenhos_empenho_id ON liquidacoes_empenhos(empenho_id);
CREATE INDEX IF NOT EXISTS idx_documentos_gerados_liquidacao_id ON documentos_gerados(liquidacao_id);
CREATE INDEX IF NOT EXISTS idx_documentos_gerados_numero ON documentos_gerados(numero);


-- =============================================
-- 3. RLS - Row Level Security (KISS Policy)
-- =============================================

-- Habilita RLS
ALTER TABLE liquidacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacoes_empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_gerados ENABLE ROW LEVEL SECURITY;

-- Politicas Simples: Permitimos leituras para authenticated (só leitura neste app dashboard). 
-- As inserções devem ser feitas com role de serviço ou, para flexibilidade inicial no painel, permitimos 
-- as de authenticated. A documentação indica políticas abrangentes por padrão.

-- 3.1 liquidacoes
CREATE POLICY "Permitir leitura anonima em liquidacoes" 
ON liquidacoes FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir todas operações authenticated liquidacoes" 
ON liquidacoes FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 3.2 liquidacoes_empenhos
CREATE POLICY "Permitir leitura anonima em liquidacoes_empenhos" 
ON liquidacoes_empenhos FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir todas operações authenticated liquidacoes_empenhos" 
ON liquidacoes_empenhos FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 3.3 documentos_gerados
CREATE POLICY "Permitir leitura anonima em documentos_gerados" 
ON documentos_gerados FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir todas operações authenticated documentos_gerados" 
ON documentos_gerados FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- =============================================
-- 4. Função Atualização updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_update_liquidacoes_updated_at
BEFORE UPDATE ON liquidacoes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_documentos_gerados_updated_at
BEFORE UPDATE ON documentos_gerados
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
