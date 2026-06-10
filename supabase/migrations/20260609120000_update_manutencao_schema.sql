-- Migration to update manutencao module for zone mapping and material tracking
ALTER TABLE manutencao_ambientes ADD COLUMN IF NOT EXISTS zona TEXT CHECK (zona IN ('academico', 'administrativo', 'esportivo', 'servicos', 'convivencia', 'apoio_tecnico'));

-- Migrate existing rooms to their corresponding zones
UPDATE manutencao_ambientes SET zona = 'academico' WHERE codigo IN ('SALA-101', 'SALA-102', 'LAB-INFO-1');
UPDATE manutencao_ambientes SET zona = 'servicos' WHERE codigo IN ('BANHEIRO-MASC-A', 'BANHEIRO-FEM-A');
UPDATE manutencao_ambientes SET zona = 'convivencia' WHERE codigo IN ('CORREDOR-CENTRAL');
UPDATE manutencao_ambientes SET zona = 'academico' WHERE zona IS NULL;

-- Modify manutencao_checkins to use acoes_realizadas text array
ALTER TABLE manutencao_checkins ADD COLUMN IF NOT EXISTS acoes_realizadas TEXT[] DEFAULT '{}'::text[];

-- Migrate single actions to multiple actions array
UPDATE manutencao_checkins SET acoes_realizadas = ARRAY[acao_realizada] WHERE acao_realizada IS NOT NULL AND (acoes_realizadas IS NULL OR cardinality(acoes_realizadas) = 0);

-- Safely drop old acao_realizada column
ALTER TABLE manutencao_checkins DROP COLUMN IF EXISTS acao_realizada;

-- Create materials usage table
CREATE TABLE IF NOT EXISTS manutencao_checkin_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID REFERENCES manutencao_checkins(id) ON DELETE CASCADE NOT NULL,
  material TEXT CHECK (material IN ('papel_higienico', 'sabonete_liquido', 'papel_toalha', 'saco_lixo', 'outros')) NOT NULL,
  quantidade INTEGER CHECK (quantidade >= 0) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE manutencao_checkin_materiais ENABLE ROW LEVEL SECURITY;

-- Policies for manutencao_checkin_materiais
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir insercao publica em manutencao_checkin_materiais') THEN
    CREATE POLICY "Permitir insercao publica em manutencao_checkin_materiais"
    ON manutencao_checkin_materiais FOR INSERT
    TO public
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated em manutencao_checkin_materiais') THEN
    CREATE POLICY "Permitir leitura authenticated em manutencao_checkin_materiais"
    ON manutencao_checkin_materiais FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
