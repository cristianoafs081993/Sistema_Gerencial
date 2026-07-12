-- =============================================================
-- Multi-Org (Multi-Tenant) Foundation
-- Requisito: Sistema multi-empresa/multi-órgão com controle de
-- módulos por órgão e trilha de auditoria (inciso V)
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Tabela de órgãos (tenants)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orgs (
  id          uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug        text        NOT NULL UNIQUE,
  name        text        NOT NULL,
  cnpj        text,
  logo_url    text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orgs IS 'Cadastro de órgãos/empresas (tenants) do sistema multi-órgão';

-- ---------------------------------------------------------------
-- 2. Associação usuário ↔ órgão (1 usuário = 1 órgão)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_users (
  id         uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Um usuário pertence a exatamente um órgão
  UNIQUE (user_id)
);

COMMENT ON TABLE public.org_users IS '1 usuário pertence a exatamente 1 órgão (tenant)';

CREATE INDEX IF NOT EXISTS org_users_user_id_idx ON public.org_users (user_id);
CREATE INDEX IF NOT EXISTS org_users_org_id_idx  ON public.org_users (org_id);

-- ---------------------------------------------------------------
-- 3. Permissões de módulo por órgão
-- O superadmin define quais telas (módulos) cada órgão pode usar.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_module_permissions (
  org_id     uuid    NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  screen_id  text    NOT NULL REFERENCES public.app_screens(id) ON DELETE CASCADE,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, screen_id)
);

COMMENT ON TABLE public.org_module_permissions IS 'Módulos (telas) habilitados por órgão — controlado pelo superadmin';

-- ---------------------------------------------------------------
-- 4. Trilha de auditoria — inciso V (login e logout por ora)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  org_id        uuid        REFERENCES public.orgs(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text        NOT NULL,
  event_type    text        NOT NULL CHECK (event_type IN (
    'login', 'logout',
    'admin_action', 'permission_change',
    'user_created', 'user_invited',
    'org_created', 'org_updated',
    'module_permission_changed'
  )),
  resource_type text,
  resource_id   text,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
  'Trilha de auditoria individual — requisito legal inciso V. '
  'Registra logins, logouts e ações administrativas do superadmin.';

CREATE INDEX IF NOT EXISTS audit_log_org_id_idx     ON public.audit_log (org_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_event_idx      ON public.audit_log (event_type);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);

-- ---------------------------------------------------------------
-- 5. Função auxiliar: org_id do usuário corrente (usada em RLS)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT org_id
  FROM public.org_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_org_id() IS
  'Retorna o org_id do usuário autenticado. Usada nas políticas RLS de isolamento de dados.';

-- ---------------------------------------------------------------
-- 6. Triggers de updated_at
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orgs_updated_at') THEN
    CREATE TRIGGER trg_orgs_updated_at
      BEFORE UPDATE ON public.orgs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_org_module_permissions_updated_at') THEN
    CREATE TRIGGER trg_org_module_permissions_updated_at
      BEFORE UPDATE ON public.org_module_permissions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------
ALTER TABLE public.orgs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- orgs: autenticados leem tudo (lista de órgãos é necessária para o superadmin)
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'orgs_select_authenticated') THEN
    CREATE POLICY "orgs_select_authenticated"
      ON public.orgs FOR SELECT TO authenticated USING (true);
  END IF;

  -- org_users: superadmin vê todos; usuário vê apenas o próprio vínculo
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'org_users_select_own') THEN
    CREATE POLICY "org_users_select_own"
      ON public.org_users FOR SELECT TO authenticated
      USING (public.is_superadmin_jwt() OR user_id = auth.uid());
  END IF;

  -- org_module_permissions: leitura para autenticados
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'org_module_permissions_select_authenticated') THEN
    CREATE POLICY "org_module_permissions_select_authenticated"
      ON public.org_module_permissions FOR SELECT TO authenticated USING (true);
  END IF;

  -- audit_log: superadmin vê todos; usuário vê apenas os próprios
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_log_select_own_or_superadmin') THEN
    CREATE POLICY "audit_log_select_own_or_superadmin"
      ON public.audit_log FOR SELECT TO authenticated
      USING (public.is_superadmin_jwt() OR user_id = auth.uid());
  END IF;

  -- audit_log: usuário autenticado pode inserir seus próprios registros
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'audit_log_insert_authenticated') THEN
    CREATE POLICY "audit_log_insert_authenticated"
      ON public.audit_log FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 8. Seed: órgão padrão IFRN Campus Currais Novos
-- ---------------------------------------------------------------
INSERT INTO public.orgs (slug, name, cnpj, is_active)
VALUES ('ifrn-cn', 'IFRN Campus Currais Novos', '10877412000168', true)
ON CONFLICT (slug) DO UPDATE
  SET name      = EXCLUDED.name,
      is_active = EXCLUDED.is_active,
      updated_at = now();

-- ---------------------------------------------------------------
-- 9. Seed: associar todos os usuários existentes ao órgão padrão
-- ---------------------------------------------------------------
INSERT INTO public.org_users (org_id, user_id, role)
SELECT o.id, u.id,
  CASE WHEN lower(u.email) = 'cristiano.cnrn@gmail.com' THEN 'admin' ELSE 'member' END
FROM public.orgs o
CROSS JOIN auth.users u
WHERE o.slug = 'ifrn-cn'
  AND u.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------
-- 10. Seed: habilitar todos os módulos ativos para o órgão padrão
-- ---------------------------------------------------------------
INSERT INTO public.org_module_permissions (org_id, screen_id, can_access)
SELECT o.id, s.id, true
FROM public.orgs o
CROSS JOIN public.app_screens s
WHERE o.slug = 'ifrn-cn'
  AND s.is_active = true
ON CONFLICT (org_id, screen_id) DO UPDATE
  SET can_access = EXCLUDED.can_access,
      updated_at = now();

-- ---------------------------------------------------------------
-- 11. Registrar novas telas administrativas no catálogo
-- ---------------------------------------------------------------
INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES
  ('controle-orgaos', 'administracao', 'Controle de Órgãos',   '/controle-orgaos', 5,  true, true),
  ('audit-log',       'administracao', 'Trilha de Auditoria',   '/audit-log',       15, true, true)
ON CONFLICT (id) DO UPDATE
  SET screen_group_id = EXCLUDED.screen_group_id,
      name            = EXCLUDED.name,
      path            = EXCLUDED.path,
      sort_order      = EXCLUDED.sort_order,
      is_admin_only   = EXCLUDED.is_admin_only,
      is_active       = EXCLUDED.is_active;
