CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  version_label text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  template_base64 text NOT NULL,
  template_text text NOT NULL,
  editable_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_templates_code_idx
  ON public.document_templates (code, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS document_templates_active_code_idx
  ON public.document_templates (code)
  WHERE status = 'active';

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_document_templates_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_document_templates_updated_at
      BEFORE UPDATE ON public.document_templates
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated document_templates') THEN
    CREATE POLICY "Permitir leitura authenticated document_templates"
      ON public.document_templates
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir escrita superadmin document_templates') THEN
    CREATE POLICY "Permitir escrita superadmin document_templates"
      ON public.document_templates
      FOR ALL
      TO authenticated
      USING (public.is_superadmin_jwt())
      WITH CHECK (public.is_superadmin_jwt());
  END IF;
END $$;

INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES ('modelos-documentos', 'administracao', 'Modelos de documentos', '/modelos-documentos', 30, true, true)
ON CONFLICT (id) DO UPDATE
SET screen_group_id = EXCLUDED.screen_group_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    sort_order = EXCLUDED.sort_order,
    is_admin_only = EXCLUDED.is_admin_only,
    is_active = EXCLUDED.is_active;
