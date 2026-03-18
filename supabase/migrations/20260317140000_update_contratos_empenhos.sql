-- Add valor column to contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor NUMERIC(15, 2);

-- Create join table for contracts and empenhos
CREATE TABLE IF NOT EXISTS contratos_empenhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  empenho_id UUID NOT NULL REFERENCES empenhos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contrato_id, empenho_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_contratos_empenhos_contrato_id ON contratos_empenhos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_empenhos_empenho_id ON contratos_empenhos(empenho_id);

-- Enable RLS
ALTER TABLE contratos_empenhos ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em contratos_empenhos') THEN
    CREATE POLICY "Permitir leitura anonima em contratos_empenhos" 
    ON contratos_empenhos FOR SELECT 
    TO public 
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operações authenticated contratos_empenhos') THEN
    CREATE POLICY "Permitir todas operações authenticated contratos_empenhos" 
    ON contratos_empenhos FOR ALL 
    TO authenticated 
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
