-- =============================================
-- Migration: 0009_create_documentos_habeis_itens.sql
-- Description: Criação da tabela relacional 1:N para os itens (NS, OB) vinculados ao Documento Hábil.
-- =============================================

-- 1. Criação da tabela de itens
CREATE TABLE IF NOT EXISTS documentos_habeis_itens (
  id TEXT PRIMARY KEY, -- O ID do documento filho (ex: 158366264352026OB000176)
  documento_habil_id TEXT NOT NULL, -- FK referenciando o pai (NP/RP)
  doc_tipo TEXT, -- Ex: OB, NS
  data_emissao DATE,
  valor DECIMAL(15, 2) DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign Key com ON DELETE CASCADE para garantir integridade
  CONSTRAINT fk_item_documento_habil 
    FOREIGN KEY (documento_habil_id) 
    REFERENCES documentos_habeis(id) 
    ON DELETE CASCADE
);

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_doc_habeis_itens_pai ON documentos_habeis_itens(documento_habil_id);
CREATE INDEX IF NOT EXISTS idx_doc_habeis_itens_tipo ON documentos_habeis_itens(doc_tipo);

-- 3. RLS Policies
ALTER TABLE documentos_habeis_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir tudo para todos itens" ON documentos_habeis_itens;
CREATE POLICY "Permitir tudo para todos itens" 
ON documentos_habeis_itens FOR ALL 
TO public 
USING (true)
WITH CHECK (true);

-- 4. Trigger para updated_at (reaproveitando a função já existente)
DROP TRIGGER IF EXISTS trg_update_documentos_habeis_itens_updated_at ON documentos_habeis_itens;
CREATE TRIGGER trg_update_documentos_habeis_itens_updated_at
BEFORE UPDATE ON documentos_habeis_itens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Remover a coluna depreciada da tabela principal
-- É uma boa prática dropar apenas se ela existir (idempotência)
ALTER TABLE documentos_habeis DROP COLUMN IF EXISTS documentos_relacionados;
