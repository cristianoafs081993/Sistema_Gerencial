-- Atalhos de texto (/cn, /ifrn...) da extensão compartilhados entre perfis do navegador.
-- chrome.storage.sync não chega a perfis sem sincronização do Google; o SIAGES mantém uma cópia por usuário.
CREATE TABLE public.extension_snippets (
  tenant_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  snippets jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(snippets) = 'object' AND octet_length(snippets::text) <= 262144),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extension_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY extension_snippets_select ON public.extension_snippets FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());
CREATE POLICY extension_snippets_insert ON public.extension_snippets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());
CREATE POLICY extension_snippets_update ON public.extension_snippets FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());

REVOKE ALL ON public.extension_snippets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.extension_snippets TO authenticated;
GRANT ALL ON public.extension_snippets TO service_role;

CREATE FUNCTION public.stamp_extension_snippets() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER extension_snippets_stamp BEFORE INSERT OR UPDATE ON public.extension_snippets
  FOR EACH ROW EXECUTE FUNCTION public.stamp_extension_snippets();
