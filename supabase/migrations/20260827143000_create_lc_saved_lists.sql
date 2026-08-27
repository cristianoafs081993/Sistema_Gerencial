-- Listas de trabalho da LC compartilhadas entre usuarios do mesmo orgao.

CREATE TABLE IF NOT EXISTS public.lc_saved_lists (
  id                uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT public.default_org_id()
                    REFERENCES public.orgs(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  source_pdf_names  jsonb NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(source_pdf_names) = 'array'),
  rows              jsonb NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(rows) = 'array'),
  created_by        uuid NOT NULL DEFAULT auth.uid()
                    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lc_saved_lists_org_updated_idx
  ON public.lc_saved_lists (org_id, updated_at DESC);

ALTER TABLE public.lc_saved_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lc_saved_lists_select_org ON public.lc_saved_lists;
CREATE POLICY lc_saved_lists_select_org
  ON public.lc_saved_lists FOR SELECT TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS lc_saved_lists_insert_org ON public.lc_saved_lists;
CREATE POLICY lc_saved_lists_insert_org
  ON public.lc_saved_lists FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS lc_saved_lists_update_org ON public.lc_saved_lists;
CREATE POLICY lc_saved_lists_update_org
  ON public.lc_saved_lists FOR UPDATE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id())
  WITH CHECK (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP POLICY IF EXISTS lc_saved_lists_delete_org ON public.lc_saved_lists;
CREATE POLICY lc_saved_lists_delete_org
  ON public.lc_saved_lists FOR DELETE TO authenticated
  USING (public.is_superadmin_jwt() OR org_id = public.current_user_org_id());

DROP TRIGGER IF EXISTS trg_lc_saved_lists_updated_at ON public.lc_saved_lists;
CREATE TRIGGER trg_lc_saved_lists_updated_at
  BEFORE UPDATE ON public.lc_saved_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lc_saved_lists TO authenticated;

COMMENT ON TABLE public.lc_saved_lists IS
  'Listas de trabalho da Lista de Credores compartilhadas entre usuarios do mesmo orgao.';
