-- Processos abertos no SUAP compartilhados entre perfis do navegador (Alt+V da extensão).
-- Cada perfil grava os próprios registros; o Alt+V de outro perfil lê os do mesmo usuário.
CREATE TABLE public.extension_process_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id text NOT NULL CHECK (profile_id ~ '^[0-9a-f-]{36}$'),
  process_key text NOT NULL CHECK (length(process_key) BETWEEN 1 AND 80),
  suap_id text NOT NULL DEFAULT '' CHECK (length(suap_id) <= 20),
  process_number text NOT NULL DEFAULT '' CHECK (length(process_number) <= 80),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 262144),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id, process_key)
);
CREATE INDEX extension_process_registry_recent_idx ON public.extension_process_registry(tenant_id, updated_at DESC);

ALTER TABLE public.extension_process_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY extension_process_registry_select ON public.extension_process_registry FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());
CREATE POLICY extension_process_registry_insert ON public.extension_process_registry FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY extension_process_registry_update ON public.extension_process_registry FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY extension_process_registry_delete ON public.extension_process_registry FOR DELETE TO authenticated
  USING (tenant_id = auth.uid());

REVOKE ALL ON public.extension_process_registry FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extension_process_registry TO authenticated;
GRANT ALL ON public.extension_process_registry TO service_role;

-- O relógio do servidor define a recência; o cliente não consegue antecipar nem prolongar registros.
CREATE FUNCTION public.stamp_extension_process_registry() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER extension_process_registry_stamp BEFORE INSERT OR UPDATE ON public.extension_process_registry
  FOR EACH ROW EXECUTE FUNCTION public.stamp_extension_process_registry();
