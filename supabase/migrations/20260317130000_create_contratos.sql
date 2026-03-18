-- Create contracts table
CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  contratada TEXT NOT NULL,
  data_inicio DATE,
  data_termino DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add updated_at trigger
CREATE TRIGGER trg_update_contratos_updated_at
BEFORE UPDATE ON contratos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Permitir leitura anonima em contratos" 
ON contratos FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Permitir todas operações authenticated contratos" 
ON contratos FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);
