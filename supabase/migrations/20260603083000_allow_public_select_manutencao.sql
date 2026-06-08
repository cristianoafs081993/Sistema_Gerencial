-- Add SELECT policies for public on manutencao_ocorrencias and manutencao_checkins
-- This is required to allow anonymous inserts to return the inserted row representation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura publica em manutencao_ocorrencias') THEN
    CREATE POLICY "Permitir leitura publica em manutencao_ocorrencias"
    ON manutencao_ocorrencias FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura publica em manutencao_checkins') THEN
    CREATE POLICY "Permitir leitura publica em manutencao_checkins"
    ON manutencao_checkins FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;
