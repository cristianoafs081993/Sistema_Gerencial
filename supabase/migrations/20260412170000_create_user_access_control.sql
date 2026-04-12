CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.screen_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_screens (
  id text PRIMARY KEY,
  screen_group_id text NOT NULL REFERENCES public.screen_groups(id) ON DELETE RESTRICT,
  name text NOT NULL,
  path text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_admin_only boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_groups (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_group_screen_permissions (
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  screen_id text NOT NULL REFERENCES public.app_screens(id) ON DELETE CASCADE,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, screen_id)
);

CREATE TABLE IF NOT EXISTS public.user_group_memberships (
  user_id uuid NOT NULL,
  email text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_group_memberships_email_group_id_idx
  ON public.user_group_memberships (lower(email), group_id);

CREATE OR REPLACE FUNCTION public.is_superadmin_jwt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'cristiano.cnrn@gmail.com'
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'superadmin'
    OR coalesce((auth.jwt() -> 'app_metadata' ->> 'is_superadmin')::boolean, false)
$$;

ALTER TABLE public.screen_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_screen_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated screen_groups') THEN
    CREATE POLICY "Permitir leitura authenticated screen_groups"
      ON public.screen_groups FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated app_screens') THEN
    CREATE POLICY "Permitir leitura authenticated app_screens"
      ON public.app_screens FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated user_groups') THEN
    CREATE POLICY "Permitir leitura authenticated user_groups"
      ON public.user_groups FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura authenticated group_permissions') THEN
    CREATE POLICY "Permitir leitura authenticated group_permissions"
      ON public.user_group_screen_permissions FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Permitir leitura propria memberships') THEN
    CREATE POLICY "Permitir leitura propria memberships"
      ON public.user_group_memberships FOR SELECT TO authenticated
      USING (public.is_superadmin_jwt() OR user_id = auth.uid());
  END IF;
END $$;

INSERT INTO public.screen_groups (id, name, sort_order)
VALUES
  ('orcamentario', 'Orçamentário', 10),
  ('financeiro', 'Financeiro', 20),
  ('contratos', 'Contratos', 30),
  ('documentos', 'Documentos', 40),
  ('administracao', 'Administração', 90)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES
  ('dashboard', 'orcamentario', 'Dashboard', '/', 10, false, true),
  ('planejamento', 'orcamentario', 'Planejamento', '/planejamento', 20, false, true),
  ('descentralizacoes', 'orcamentario', 'Descentralizações', '/descentralizacoes', 30, false, true),
  ('empenhos', 'orcamentario', 'Empenhos', '/empenhos', 40, false, true),
  ('liquidacoes-pagamentos', 'financeiro', 'Liquidações', '/liquidacoes-pagamentos', 10, false, true),
  ('financeiro', 'financeiro', 'Financeiro', '/financeiro', 20, false, true),
  ('lc', 'financeiro', 'Lista de Credores', '/lc', 30, false, true),
  ('retencoes-efd-reinf', 'financeiro', 'Retenções EFD-Reinf', '/retencoes-efd-reinf', 40, false, true),
  ('rastreabilidade-pfs', 'financeiro', 'Rastreabilidade de PFs', '/rastreabilidade-pfs', 50, false, true),
  ('conciliacao-pfs', 'financeiro', 'Conciliação de PFs', '/conciliacao-pfs', 60, false, true),
  ('contratos', 'contratos', 'Contratos', '/contratos', 10, false, true),
  ('gerador-documentos', 'documentos', 'Gerador de Documentos', '/gerador-documentos', 10, false, true),
  ('editor-documentos', 'documentos', 'Editor de Documentos', '/editor-documentos', 20, false, true),
  ('consultor', 'documentos', 'Consultor Jurídico', '/consultor', 30, false, true),
  ('suap', 'documentos', 'SUAP', '/suap', 40, false, true),
  ('controle-usuarios', 'administracao', 'Controle de usuários', '/controle-usuarios', 10, true, true),
  ('design-system-preview', 'administracao', 'Design System', '/design-system-preview', 20, true, true)
ON CONFLICT (id) DO UPDATE
SET screen_group_id = EXCLUDED.screen_group_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    sort_order = EXCLUDED.sort_order,
    is_admin_only = EXCLUDED.is_admin_only,
    is_active = EXCLUDED.is_active;

INSERT INTO public.user_groups (slug, name, description, is_system)
VALUES ('diretores', 'Diretores', 'Acesso de leitura às telas de produção, sem controle de usuários e sem uploads.', true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    updated_at = now();

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT groups.id, screens.id, true
FROM public.user_groups groups
CROSS JOIN public.app_screens screens
WHERE groups.slug = 'diretores'
  AND screens.is_active = true
  AND screens.is_admin_only = false
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

INSERT INTO public.user_group_memberships (user_id, email, group_id)
SELECT users.id, lower(users.email), groups.id
FROM auth.users users
CROSS JOIN public.user_groups groups
WHERE groups.slug = 'diretores'
  AND users.email IS NOT NULL
  AND lower(users.email) <> 'cristiano.cnrn@gmail.com'
ON CONFLICT (user_id, group_id) DO UPDATE
SET email = EXCLUDED.email,
    updated_at = now();
