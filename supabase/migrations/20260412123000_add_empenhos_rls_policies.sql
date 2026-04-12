ALTER TABLE public.empenhos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura anonima em empenhos'
  ) THEN
    CREATE POLICY "Permitir leitura anonima em empenhos"
      ON public.empenhos FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Permitir escrita superadmin em empenhos'
  ) THEN
    CREATE POLICY "Permitir escrita superadmin em empenhos"
      ON public.empenhos FOR ALL TO authenticated
      USING (
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'cristiano.cnrn@gmail.com'
        OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
        OR coalesce((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean, false)
      )
      WITH CHECK (
        lower(coalesce(auth.jwt() ->> 'email', '')) = 'cristiano.cnrn@gmail.com'
        OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
        OR coalesce((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean, false)
      );
  END IF;
END $$;
