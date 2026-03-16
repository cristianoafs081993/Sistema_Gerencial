-- =============================================
-- Migration: 0008_create_documentos_habeis.sql
-- Description: Criação da tabela Documento Hábil e limpeza de estruturas legadas.
-- =============================================

-- 0. Garantir que a função de atualização de data exista
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Remover tabela anterior se necessário (opcional)
-- DROP TABLE IF EXISTS transparencia_documentos;

-- 2. Criar tabela Documento Hábil
CREATE TABLE IF NOT EXISTS documentos_habeis (
  id TEXT PRIMARY KEY, -- O Documento Origem (NP/RP)
  data_emissao DATE NOT NULL,
  favorecido_documento TEXT,
  favorecido_nome TEXT,
  valor_liquidado DECIMAL(15, 2) NOT NULL DEFAULT 0,
  valor_pago DECIMAL(15, 2) NOT NULL DEFAULT 0,
  doc_tipo TEXT, -- Ex: DR, GR, NS, OB
  documentos_relacionados TEXT, -- Concatenação de OBs vinculadas ou outros documentos
  fonte_sof TEXT,
  empenho_numero TEXT, -- Referência amigável ao empenho (NE CCor)
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.1 Garantir relacionamento formal com chave estrangeira
DO $$ 
BEGIN
  -- Garantir que empenhos(numero) é único para poder ser referenciado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'empenhos_numero_unique') THEN
    ALTER TABLE empenhos ADD CONSTRAINT empenhos_numero_unique UNIQUE(numero);
  END IF;
  
  -- Adicionar a Foreign Key
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_doc_habil_empenho') THEN
    ALTER TABLE documentos_habeis ADD CONSTRAINT fk_doc_habil_empenho 
      FOREIGN KEY (empenho_numero) REFERENCES empenhos(numero) ON DELETE SET NULL;
  END IF;
END $$;

-- 2.2 Adicionar colunas caso a tabela já exista
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS doc_tipo TEXT;
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS documentos_relacionados TEXT;
ALTER TABLE documentos_habeis ADD COLUMN IF NOT EXISTS fonte_sof TEXT;
ALTER TABLE documentos_habeis DROP COLUMN IF EXISTS empenho_id; -- Remover o anterior pois usuário prefere número

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_documentos_habeis_data ON documentos_habeis(data_emissao);
CREATE INDEX IF NOT EXISTS idx_documentos_habeis_empenho ON documentos_habeis(empenho_numero);

-- 4. RLS policies
ALTER TABLE documentos_habeis ENABLE ROW LEVEL SECURITY;

-- Permitir tudo para todos (Desenvolvimento local)
DROP POLICY IF EXISTS "Permitir tudo para todos" ON documentos_habeis;
CREATE POLICY "Permitir tudo para todos" 
ON documentos_habeis FOR ALL 
TO public 
USING (true)
WITH CHECK (true);

-- 5. Trigger para updated_at
DROP TRIGGER IF EXISTS trg_update_documentos_habeis_updated_at ON documentos_habeis;
CREATE TRIGGER trg_update_documentos_habeis_updated_at
BEFORE UPDATE ON documentos_habeis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
