-- Migration to create Service Orders (Ordem de Serviço) and Terceirizado Permissions
-- Created: 2026-06-12

-- 1. Create User Groups for Terceirizados, Fiscal de Contratos, and Teste
INSERT INTO public.user_groups (slug, name, description, is_system)
VALUES 
  ('terceirizado', 'Terceirizado', 'Perfil de Terceirizados com acesso exclusivo a Ordens de Serviço.', true),
  ('fiscal-contratos', 'Fiscal de Contratos', 'Perfil de Fiscais de Contratos para gerenciar vínculos e Ordens de Serviço.', true),
  ('teste', 'Teste', 'Perfil de testes.', true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    updated_at = now();

-- 2. Register 'ordem-servico' Screen
INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES ('ordem-servico', 'contratos', 'Ordem de Serviço', '/ordem-servico', 20, false, true)
ON CONFLICT (id) DO UPDATE
SET screen_group_id = EXCLUDED.screen_group_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    sort_order = EXCLUDED.sort_order,
    is_admin_only = EXCLUDED.is_admin_only,
    is_active = EXCLUDED.is_active;

-- 3. Set Up Screen Permissions for the Groups
-- Terceirizados get access ONLY to 'ordem-servico'
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'ordem-servico', true
FROM public.user_groups
WHERE slug = 'terceirizado'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

-- Fiscais de Contratos get access to all production screens
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT groups.id, screens.id, true
FROM public.user_groups groups
CROSS JOIN public.app_screens screens
WHERE groups.slug = 'fiscal-contratos'
  AND screens.is_active = true
  AND screens.is_admin_only = false
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

-- Test users get access to all production screens
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT groups.id, screens.id, true
FROM public.user_groups groups
CROSS JOIN public.app_screens screens
WHERE groups.slug = 'teste'
  AND screens.is_active = true
  AND screens.is_admin_only = false
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

-- Diretores group also gets access to the new 'ordem-servico' screen
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'ordem-servico', true
FROM public.user_groups
WHERE slug = 'diretores'
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();


-- 4. Create terceirizado_permissions Table
CREATE TABLE IF NOT EXISTS public.terceirizado_permissions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE CASCADE,
  empenho_id uuid REFERENCES public.empenhos(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_only_one_entity CHECK (
    (contrato_id IS NOT NULL AND empenho_id IS NULL) OR
    (contrato_id IS NULL AND empenho_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_terceirizado_contrato 
  ON public.terceirizado_permissions (user_id, contrato_id) 
  WHERE contrato_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_terceirizado_empenho 
  ON public.terceirizado_permissions (user_id, empenho_id) 
  WHERE empenho_id IS NOT NULL;


-- 5. Create service_orders Table
CREATE TABLE IF NOT EXISTS public.service_orders (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL DEFAULT 'Ordem de Serviço',
  number text NOT NULL,
  process_number text,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  contrato_numero text,
  empenho_id uuid REFERENCES public.empenhos(id) ON DELETE SET NULL,
  empenho_numero text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'rejected')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_email text DEFAULT lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- 6. Create service_order_items Table
CREATE TABLE IF NOT EXISTS public.service_order_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(18, 6) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'UN',
  unit_price numeric(18, 6) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_service_orders_created_by ON public.service_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_service_order_items_parent ON public.service_order_items(service_order_id, sort_order);


-- 8. Timestamps Triggers
DROP TRIGGER IF EXISTS trg_update_service_orders_updated_at ON public.service_orders;
CREATE TRIGGER trg_update_service_orders_updated_at
BEFORE UPDATE ON public.service_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_service_order_items_updated_at ON public.service_order_items;
CREATE TRIGGER trg_update_service_order_items_updated_at
BEFORE UPDATE ON public.service_order_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 9. Row Level Security Policies
ALTER TABLE public.terceirizado_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;

-- 9.1 user_group_memberships Read Policy Enrichment for Managers
DROP POLICY IF EXISTS "Permitir gestores lerem memberships" ON public.user_group_memberships;
CREATE POLICY "Permitir gestores lerem memberships"
  ON public.user_group_memberships FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

-- 9.2 terceirizado_permissions Policies
DROP POLICY IF EXISTS "Leitura de terceirizado_permissions" ON public.terceirizado_permissions;
CREATE POLICY "Leitura de terceirizado_permissions"
  ON public.terceirizado_permissions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestores total controle terceirizado_permissions" ON public.terceirizado_permissions;
CREATE POLICY "Gestores total controle terceirizado_permissions"
  ON public.terceirizado_permissions FOR ALL TO authenticated
  USING (
    public.is_superadmin_jwt() OR
    EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

-- 9.3 service_orders Policies
DROP POLICY IF EXISTS "Leitura de service_orders" ON public.service_orders;
CREATE POLICY "Leitura de service_orders"
  ON public.service_orders FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Criar own service_orders" ON public.service_orders;
CREATE POLICY "Criar own service_orders"
  ON public.service_orders FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Atualizar service_orders" ON public.service_orders;
CREATE POLICY "Atualizar service_orders"
  ON public.service_orders FOR UPDATE TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('draft', 'review'))
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Excluir service_orders" ON public.service_orders;
CREATE POLICY "Excluir service_orders"
  ON public.service_orders FOR DELETE TO authenticated
  USING (
    (created_by = auth.uid() AND status = 'draft')
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

-- 9.4 service_order_items Policies
DROP POLICY IF EXISTS "Leitura de service_order_items" ON public.service_order_items;
CREATE POLICY "Leitura de service_order_items"
  ON public.service_order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_orders parent
      WHERE parent.id = service_order_items.service_order_id
        AND (
          parent.created_by = auth.uid()
          OR public.is_superadmin_jwt()
          OR EXISTS (
            SELECT 1 FROM public.user_group_memberships m
            JOIN public.user_groups g ON m.group_id = g.id
            WHERE m.user_id = auth.uid()
              AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manipular service_order_items" ON public.service_order_items;
CREATE POLICY "Manipular service_order_items"
  ON public.service_order_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_orders parent
      WHERE parent.id = service_order_items.service_order_id
        AND (
          (parent.created_by = auth.uid() AND parent.status IN ('draft', 'review'))
          OR public.is_superadmin_jwt()
          OR EXISTS (
            SELECT 1 FROM public.user_group_memberships m
            JOIN public.user_groups g ON m.group_id = g.id
            WHERE m.user_id = auth.uid()
              AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
          )
        )
    )
  );


-- 10. Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terceirizado_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_items TO authenticated;
