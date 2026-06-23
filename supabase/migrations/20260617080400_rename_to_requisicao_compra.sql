-- Migration: Rename Service Orders to Purchase Requisitions & Create Terceirizados Table
-- Created: 2026-06-17

-- 1. Drop Old Tables (if they exist) to avoid constraint/trigger conflicts
DROP TABLE IF EXISTS public.service_order_items CASCADE;
DROP TABLE IF EXISTS public.service_orders CASCADE;

-- 2. Create public.terceirizados Table
CREATE TABLE IF NOT EXISTS public.terceirizados (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('limpeza_manutencao', 'refeitorio')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create public.requisicoes_compra Table
CREATE TABLE IF NOT EXISTS public.requisicoes_compra (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  title text NOT NULL DEFAULT 'Requisição de Compra',
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

-- 4. Create public.requisicao_compra_itens Table
CREATE TABLE IF NOT EXISTS public.requisicao_compra_itens (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  requisicao_compra_id uuid NOT NULL REFERENCES public.requisicoes_compra(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(18, 6) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'UN',
  unit_price numeric(18, 6) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_requisicoes_compra_created_by ON public.requisicoes_compra(created_by);
CREATE INDEX IF NOT EXISTS idx_requisicao_compra_items_parent ON public.requisicao_compra_itens(requisicao_compra_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_terceirizados_email ON public.terceirizados(email);

-- 6. Trigger for updated_at
DROP TRIGGER IF EXISTS trg_update_terceirizados_updated_at ON public.terceirizados;
CREATE TRIGGER trg_update_terceirizados_updated_at
BEFORE UPDATE ON public.terceirizados
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_requisicoes_compra_updated_at ON public.requisicoes_compra;
CREATE TRIGGER trg_update_requisicoes_compra_updated_at
BEFORE UPDATE ON public.requisicoes_compra
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_requisicao_compra_itens_updated_at ON public.requisicao_compra_itens;
CREATE TRIGGER trg_update_requisicao_compra_itens_updated_at
BEFORE UPDATE ON public.requisicao_compra_itens
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Modify terceirizado_permissions user_id to be nullable
ALTER TABLE public.terceirizado_permissions ALTER COLUMN user_id DROP NOT NULL;

-- 8. Trigger to resolve user_id by email
CREATE OR REPLACE FUNCTION public.fn_sync_terceirizado_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_terceirizado_user_id ON public.terceirizados;
CREATE TRIGGER trg_sync_terceirizado_user_id
BEFORE INSERT OR UPDATE ON public.terceirizados
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_terceirizado_user_id();

CREATE OR REPLACE FUNCTION public.fn_sync_permission_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE lower(email) = lower(NEW.user_email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_permission_user_id ON public.terceirizado_permissions;
CREATE TRIGGER trg_sync_permission_user_id
BEFORE INSERT OR UPDATE ON public.terceirizado_permissions
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_permission_user_id();

-- 9. Trigger to sync user_id when new auth user registers
CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user_sync()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.terceirizados
  SET user_id = NEW.id
  WHERE lower(email) = lower(NEW.email) AND user_id IS NULL;

  UPDATE public.terceirizado_permissions
  SET user_id = NEW.id
  WHERE lower(user_email) = lower(NEW.email) AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_new_auth_user_sync ON auth.users;
CREATE TRIGGER trg_handle_new_auth_user_sync
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_auth_user_sync();

-- 10. Register App Screens
DELETE FROM public.user_group_screen_permissions WHERE screen_id = 'ordem-servico';
DELETE FROM public.app_screens WHERE id = 'ordem-servico';

INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES 
  ('requisicao-compra', 'contratos', 'Requisição de Compra', '/requisicao-compra', 20, false, true),
  ('cadastro-terceirizados', 'contratos', 'Cadastro de Terceirizados', '/cadastro-terceirizados', 25, false, true)
ON CONFLICT (id) DO UPDATE
SET screen_group_id = EXCLUDED.screen_group_id,
    name = EXCLUDED.name,
    path = EXCLUDED.path,
    sort_order = EXCLUDED.sort_order,
    is_admin_only = EXCLUDED.is_admin_only,
    is_active = EXCLUDED.is_active;

-- Setup Screen Permissions
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'cadastro-terceirizados', true
FROM public.user_groups
WHERE slug IN ('fiscal-contratos', 'diretores', 'teste')
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'requisicao-compra', true
FROM public.user_groups
WHERE slug IN ('fiscal-contratos', 'diretores', 'teste', 'terceirizado')
ON CONFLICT (group_id, screen_id) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();

-- 11. Row Level Security Policies
ALTER TABLE public.terceirizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisicao_compra_itens ENABLE ROW LEVEL SECURITY;

-- 11.1 terceirizados Policies
DROP POLICY IF EXISTS "Leitura de terceirizados" ON public.terceirizados;
CREATE POLICY "Leitura de terceirizados"
  ON public.terceirizados FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

DROP POLICY IF EXISTS "Gestores total controle terceirizados" ON public.terceirizados;
CREATE POLICY "Gestores total controle terceirizados"
  ON public.terceirizados FOR ALL TO authenticated
  USING (
    public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1 FROM public.user_group_memberships m
      JOIN public.user_groups g ON m.group_id = g.id
      WHERE m.user_id = auth.uid()
        AND g.slug IN ('diretores', 'fiscal-contratos', 'teste')
    )
  );

-- 11.2 requisicoes_compra Policies
DROP POLICY IF EXISTS "Leitura de requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Leitura de requisicoes_compra"
  ON public.requisicoes_compra FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "Criar own requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Criar own requisicoes_compra"
  ON public.requisicoes_compra FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Atualizar requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Atualizar requisicoes_compra"
  ON public.requisicoes_compra FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Excluir requisicoes_compra" ON public.requisicoes_compra;
CREATE POLICY "Excluir requisicoes_compra"
  ON public.requisicoes_compra FOR DELETE TO authenticated
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

-- 11.3 requisicao_compra_itens Policies
DROP POLICY IF EXISTS "Leitura de requisicao_compra_itens" ON public.requisicao_compra_itens;
CREATE POLICY "Leitura de requisicao_compra_itens"
  ON public.requisicao_compra_itens FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
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

DROP POLICY IF EXISTS "Manipular requisicao_compra_itens" ON public.requisicao_compra_itens;
CREATE POLICY "Manipular requisicao_compra_itens"
  ON public.requisicao_compra_itens FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requisicoes_compra parent
      WHERE parent.id = requisicao_compra_itens.requisicao_compra_id
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

-- 12. Table Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terceirizados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicao_compra_itens TO authenticated;
