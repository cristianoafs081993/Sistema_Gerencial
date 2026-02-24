-- Add empenho_documento column to transparencia_documentos table
ALTER TABLE transparencia_documentos
ADD COLUMN IF NOT EXISTS empenho_documento TEXT;

-- Create an index to improve performance for joins
CREATE INDEX IF NOT EXISTS idx_transparencia_documentos_empenho_documento 
ON transparencia_documentos(empenho_documento);

-- Optional: Add comment
COMMENT ON COLUMN transparencia_documentos.empenho_documento IS 'Número resumido do empenho associado (ex: 2026NE000001)';
