DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_rows_select_public') THEN
    CREATE POLICY "portal_itens_rows_select_public"
    ON portal_transparencia_empenho_itens_cache FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_rows_all_auth') THEN
    CREATE POLICY "portal_itens_rows_all_auth"
    ON portal_transparencia_empenho_itens_cache FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_status_select_public') THEN
    CREATE POLICY "portal_itens_status_select_public"
    ON portal_transparencia_empenho_itens_cache_status FOR SELECT
    TO public
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'portal_itens_status_all_auth') THEN
    CREATE POLICY "portal_itens_status_all_auth"
    ON portal_transparencia_empenho_itens_cache_status FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
