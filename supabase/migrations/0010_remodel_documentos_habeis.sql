-- Remodelação de Documentos Hábeis e Situações
-- Esta migração adiciona colunas de estado e valor original à tabela principal e cria a tabela de situações detalhadas.

-- 1. Atualizar documentos_habeis com novas colunas
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS valor_original DECIMAL(15,2);
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS processo TEXT;

-- 2. Criar tabela de situações (Despesas e Retenções)
CREATE TABLE IF NOT EXISTS documentos_habeis_situacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_habil_id TEXT REFERENCES documentos_habeis(id) ON DELETE CASCADE,
    situacao_codigo TEXT NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    is_retencao BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Restrição de unicidade para evitar duplicatas na carga
    CONSTRAINT uq_documento_situacao_valor UNIQUE (documento_habil_id, situacao_codigo, valor)
);

-- 3. Habilitar RLS e Políticas
ALTER TABLE documentos_habeis_situacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de situações" 
ON documentos_habeis_situacoes FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção via service role" 
ON documentos_habeis_situacoes FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir delete via service role" 
ON documentos_habeis_situacoes FOR DELETE 
USING (true);
