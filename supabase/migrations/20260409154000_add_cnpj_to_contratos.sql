ALTER TABLE contratos
ADD COLUMN IF NOT EXISTS cnpj TEXT;

CREATE INDEX IF NOT EXISTS idx_contratos_cnpj
ON contratos(cnpj);
