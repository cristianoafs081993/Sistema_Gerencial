-- Catálogo versionado de mapeamentos BPMN publicados para a extensão do SUAP.
-- A definição completa permanece em JSON para preservar a flexibilidade do editor.

CREATE TABLE IF NOT EXISTS public.process_mappings (
  id            uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id        uuid        NOT NULL DEFAULT public.default_org_id() REFERENCES public.orgs(id) ON DELETE CASCADE,
  code          text        NOT NULL,
  slug          text        NOT NULL,
  title         text        NOT NULL,
  description   text,
  category      text,
  version       text        NOT NULL DEFAULT '1.0',
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  definition    jsonb       NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  UNIQUE (org_id, slug, version)
);

CREATE INDEX IF NOT EXISTS process_mappings_org_status_idx
  ON public.process_mappings (org_id, status, updated_at DESC);

ALTER TABLE public.process_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_process_mappings_updated_at') THEN
    CREATE TRIGGER trg_process_mappings_updated_at
      BEFORE UPDATE ON public.process_mappings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'process_mappings_select_org') THEN
    CREATE POLICY process_mappings_select_org
      ON public.process_mappings FOR SELECT TO authenticated
      USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'process_mappings_insert_admin') THEN
    CREATE POLICY process_mappings_insert_admin
      ON public.process_mappings FOR INSERT TO authenticated
      WITH CHECK (
        public.is_superadmin_jwt()
        OR EXISTS (
          SELECT 1 FROM public.org_users membership
          WHERE membership.user_id = auth.uid()
            AND membership.org_id = process_mappings.org_id
            AND membership.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'process_mappings_update_admin') THEN
    CREATE POLICY process_mappings_update_admin
      ON public.process_mappings FOR UPDATE TO authenticated
      USING (
        public.is_superadmin_jwt()
        OR EXISTS (
          SELECT 1 FROM public.org_users membership
          WHERE membership.user_id = auth.uid()
            AND membership.org_id = process_mappings.org_id
            AND membership.role = 'admin'
        )
      )
      WITH CHECK (
        public.is_superadmin_jwt()
        OR EXISTS (
          SELECT 1 FROM public.org_users membership
          WHERE membership.user_id = auth.uid()
            AND membership.org_id = process_mappings.org_id
            AND membership.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'process_mappings_delete_admin') THEN
    CREATE POLICY process_mappings_delete_admin
      ON public.process_mappings FOR DELETE TO authenticated
      USING (
        public.is_superadmin_jwt()
        OR EXISTS (
          SELECT 1 FROM public.org_users membership
          WHERE membership.user_id = auth.uid()
            AND membership.org_id = process_mappings.org_id
            AND membership.role = 'admin'
        )
      );
  END IF;
END $$;

COMMENT ON TABLE public.process_mappings IS 'Mapeamentos BPMN versionados usados pelo visualizador do SIAGES e pela extensão do SUAP.';
