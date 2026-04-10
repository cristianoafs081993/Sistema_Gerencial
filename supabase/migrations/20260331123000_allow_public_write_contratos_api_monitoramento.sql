-- Permite escrita via chave anon/public no novo modulo de acompanhamento de contratos.
-- Necessario porque a sincronizacao e executada no frontend.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public contratos_api') THEN
    CREATE POLICY "Permitir todas operacoes public contratos_api"
    ON contratos_api FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public contratos_api_empenhos') THEN
    CREATE POLICY "Permitir todas operacoes public contratos_api_empenhos"
    ON contratos_api_empenhos FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public contratos_api_faturas') THEN
    CREATE POLICY "Permitir todas operacoes public contratos_api_faturas"
    ON contratos_api_faturas FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir todas operacoes public contratos_api_sync_runs') THEN
    CREATE POLICY "Permitir todas operacoes public contratos_api_sync_runs"
    ON contratos_api_sync_runs FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

