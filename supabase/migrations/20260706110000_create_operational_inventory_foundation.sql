-- Phase 4.0: shared operational entity, master data and immutable inventory ledger.

CREATE TABLE public.operational_entities (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.operational_entity_memberships (
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'warehouse_manager', 'operator', 'auditor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, user_id)
);

CREATE INDEX operational_entity_memberships_user_idx
  ON public.operational_entity_memberships (user_id, entity_id);

CREATE OR REPLACE FUNCTION public.can_access_operational_entity(
  p_entity_id uuid,
  p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_superadmin_jwt()
    OR EXISTS (
      SELECT 1
      FROM public.operational_entity_memberships membership
      WHERE membership.entity_id = p_entity_id
        AND membership.user_id = (SELECT auth.uid())
        AND (p_roles IS NULL OR membership.role = ANY (p_roles))
    )
$$;

CREATE TABLE public.operational_units (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  CONSTRAINT operational_units_parent_fk FOREIGN KEY (entity_id, parent_id)
    REFERENCES public.operational_units(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  unit_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  CONSTRAINT cost_centers_unit_fk FOREIGN KEY (entity_id, unit_id)
    REFERENCES public.operational_units(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.physical_locations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  parent_id uuid,
  location_type text NOT NULL DEFAULT 'other'
    CHECK (location_type IN ('building', 'block', 'room', 'warehouse', 'garage', 'worksite', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  CONSTRAINT physical_locations_parent_fk FOREIGN KEY (entity_id, parent_id)
    REFERENCES public.physical_locations(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.measurement_units (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  decimal_places smallint NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id)
);

CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  item_type text NOT NULL CHECK (item_type IN ('consumption', 'permanent', 'service')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  CONSTRAINT catalog_items_unit_fk FOREIGN KEY (entity_id, unit_id)
    REFERENCES public.measurement_units(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  unit_id uuid,
  location_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  CONSTRAINT warehouses_unit_fk FOREIGN KEY (entity_id, unit_id)
    REFERENCES public.operational_units(entity_id, id) ON DELETE RESTRICT,
  CONSTRAINT warehouses_location_fk FOREIGN KEY (entity_id, location_id)
    REFERENCES public.physical_locations(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.warehouse_items (
  entity_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  item_id uuid NOT NULL,
  minimum_stock numeric(18,6) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  is_blocked boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (warehouse_id, item_id),
  CONSTRAINT warehouse_items_warehouse_fk FOREIGN KEY (entity_id, warehouse_id)
    REFERENCES public.warehouses(entity_id, id) ON DELETE CASCADE,
  CONSTRAINT warehouse_items_item_fk FOREIGN KEY (entity_id, item_id)
    REFERENCES public.catalog_items(entity_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.operational_entities(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN (
    'receipt', 'issue', 'transfer', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out'
  )),
  source_warehouse_id uuid,
  destination_warehouse_id uuid,
  reference_number text,
  notes text,
  idempotency_key text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, idempotency_key),
  CONSTRAINT stock_movements_source_fk FOREIGN KEY (entity_id, source_warehouse_id)
    REFERENCES public.warehouses(entity_id, id) ON DELETE RESTRICT,
  CONSTRAINT stock_movements_destination_fk FOREIGN KEY (entity_id, destination_warehouse_id)
    REFERENCES public.warehouses(entity_id, id) ON DELETE RESTRICT,
  CONSTRAINT stock_movements_warehouses_check CHECK (
    (movement_type IN ('receipt', 'adjustment_in', 'return_in') AND source_warehouse_id IS NULL AND destination_warehouse_id IS NOT NULL)
    OR (movement_type IN ('issue', 'adjustment_out', 'return_out') AND source_warehouse_id IS NOT NULL AND destination_warehouse_id IS NULL)
    OR (movement_type = 'transfer' AND source_warehouse_id IS NOT NULL AND destination_warehouse_id IS NOT NULL AND source_warehouse_id <> destination_warehouse_id)
  )
);

CREATE TABLE public.stock_movement_items (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  item_id uuid NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(18,6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (movement_id, item_id)
);

CREATE INDEX operational_units_entity_parent_idx ON public.operational_units (entity_id, parent_id);
CREATE INDEX cost_centers_entity_unit_idx ON public.cost_centers (entity_id, unit_id);
CREATE INDEX physical_locations_entity_parent_idx ON public.physical_locations (entity_id, parent_id);
CREATE INDEX catalog_items_entity_type_name_idx ON public.catalog_items (entity_id, item_type, name);
CREATE INDEX warehouses_entity_name_idx ON public.warehouses (entity_id, name);
CREATE INDEX warehouse_items_entity_item_idx ON public.warehouse_items (entity_id, item_id);
CREATE INDEX stock_movements_entity_occurred_idx ON public.stock_movements (entity_id, occurred_at DESC);
CREATE INDEX stock_movements_source_idx ON public.stock_movements (source_warehouse_id) WHERE source_warehouse_id IS NOT NULL;
CREATE INDEX stock_movements_destination_idx ON public.stock_movements (destination_warehouse_id) WHERE destination_warehouse_id IS NOT NULL;
CREATE INDEX stock_movement_items_item_idx ON public.stock_movement_items (item_id, movement_id);

CREATE TRIGGER operational_entities_updated_at BEFORE UPDATE ON public.operational_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER operational_units_updated_at BEFORE UPDATE ON public.operational_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cost_centers_updated_at BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER physical_locations_updated_at BEFORE UPDATE ON public.physical_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER measurement_units_updated_at BEFORE UPDATE ON public.measurement_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER catalog_items_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER warehouse_items_updated_at BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.stock_balances
WITH (security_invoker = true)
AS
WITH ledger AS (
  SELECT movement.entity_id, movement.destination_warehouse_id AS warehouse_id,
    item.item_id, item.quantity AS quantity_delta,
    item.quantity * item.unit_cost AS value_delta
  FROM public.stock_movements movement
  JOIN public.stock_movement_items item ON item.movement_id = movement.id
  WHERE movement.destination_warehouse_id IS NOT NULL
  UNION ALL
  SELECT movement.entity_id, movement.source_warehouse_id AS warehouse_id,
    item.item_id, -item.quantity AS quantity_delta,
    -(item.quantity * item.unit_cost) AS value_delta
  FROM public.stock_movements movement
  JOIN public.stock_movement_items item ON item.movement_id = movement.id
  WHERE movement.source_warehouse_id IS NOT NULL
)
SELECT entity_id, warehouse_id, item_id,
  sum(quantity_delta)::numeric(18,6) AS quantity_on_hand,
  sum(value_delta)::numeric(18,6) AS inventory_value
FROM ledger
GROUP BY entity_id, warehouse_id, item_id;

CREATE OR REPLACE FUNCTION public.post_stock_movement(
  p_entity_id uuid,
  p_movement_type text,
  p_source_warehouse_id uuid,
  p_destination_warehouse_id uuid,
  p_reference_number text,
  p_notes text,
  p_idempotency_key text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_movement_id uuid;
  v_item record;
  v_balance numeric(18,6);
BEGIN
  IF NOT public.can_access_operational_entity(p_entity_id, ARRAY['admin', 'warehouse_manager', 'operator']) THEN
    RAISE EXCEPTION 'Usuário sem acesso à entidade operacional' USING ERRCODE = '42501';
  END IF;

  IF p_movement_type NOT IN ('receipt', 'issue', 'transfer', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item';
  END IF;

  IF (p_movement_type IN ('receipt', 'adjustment_in', 'return_in') AND (p_source_warehouse_id IS NOT NULL OR p_destination_warehouse_id IS NULL))
    OR (p_movement_type IN ('issue', 'adjustment_out', 'return_out') AND (p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NOT NULL))
    OR (p_movement_type = 'transfer' AND (p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NULL OR p_source_warehouse_id = p_destination_warehouse_id))
  THEN
    RAISE EXCEPTION 'Origem e destino incompatíveis com o tipo de movimento';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[p_source_warehouse_id, p_destination_warehouse_id]) warehouse_id
    WHERE warehouse_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.warehouses warehouse
        WHERE warehouse.id = warehouse_id
          AND warehouse.entity_id = p_entity_id
          AND warehouse.is_active
      )
  ) THEN
    RAISE EXCEPTION 'Depósito inválido ou inativo';
  END IF;

  IF jsonb_array_length(p_items) <> (
    SELECT count(DISTINCT parsed.item_id)
    FROM jsonb_to_recordset(p_items) AS parsed(item_id uuid)
  ) THEN
    RAISE EXCEPTION 'Não repita o mesmo item no movimento';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_movement_id
    FROM public.stock_movements
    WHERE entity_id = p_entity_id AND idempotency_key = p_idempotency_key;
    IF v_movement_id IS NOT NULL THEN
      RETURN v_movement_id;
    END IF;
  END IF;

  FOR v_item IN
    SELECT parsed.item_id, parsed.quantity, parsed.unit_cost
    FROM jsonb_to_recordset(p_items) AS parsed(item_id uuid, quantity numeric, unit_cost numeric)
    ORDER BY parsed.item_id
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 OR coalesce(v_item.unit_cost, 0) < 0 THEN
      RAISE EXCEPTION 'Quantidade ou custo inválido';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.catalog_items catalog
      WHERE catalog.id = v_item.item_id AND catalog.entity_id = p_entity_id
        AND catalog.is_active AND catalog.item_type <> 'service'
    ) THEN
      RAISE EXCEPTION 'Item inválido ou não estocável: %', v_item.item_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.warehouse_items setting
      WHERE setting.entity_id = p_entity_id
        AND setting.item_id = v_item.item_id
        AND setting.warehouse_id IN (p_source_warehouse_id, p_destination_warehouse_id)
        AND setting.is_blocked
    ) THEN
      RAISE EXCEPTION 'Item bloqueado para movimentação: %', v_item.item_id;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_entity_id::text || ':' || coalesce(p_source_warehouse_id, p_destination_warehouse_id)::text || ':' || v_item.item_id::text,
      0
    ));

    IF p_source_warehouse_id IS NOT NULL THEN
      SELECT coalesce(balance.quantity_on_hand, 0) INTO v_balance
      FROM (SELECT 1) seed
      LEFT JOIN public.stock_balances balance
        ON balance.entity_id = p_entity_id
       AND balance.warehouse_id = p_source_warehouse_id
       AND balance.item_id = v_item.item_id;

      IF v_balance < v_item.quantity THEN
        RAISE EXCEPTION 'Saldo insuficiente para o item %: disponível %, solicitado %',
          v_item.item_id, v_balance, v_item.quantity;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.stock_movements (
    entity_id, movement_type, source_warehouse_id, destination_warehouse_id,
    reference_number, notes, idempotency_key, created_by
  ) VALUES (
    p_entity_id, p_movement_type, p_source_warehouse_id, p_destination_warehouse_id,
    nullif(trim(p_reference_number), ''), nullif(trim(p_notes), ''), p_idempotency_key, (SELECT auth.uid())
  ) RETURNING id INTO v_movement_id;

  INSERT INTO public.stock_movement_items (movement_id, item_id, quantity, unit_cost)
  SELECT v_movement_id, parsed.item_id, parsed.quantity,
    CASE
      WHEN p_source_warehouse_id IS NULL THEN coalesce(parsed.unit_cost, 0)
      ELSE coalesce((
        SELECT balance.inventory_value / nullif(balance.quantity_on_hand, 0)
        FROM public.stock_balances balance
        WHERE balance.entity_id = p_entity_id
          AND balance.warehouse_id = p_source_warehouse_id
          AND balance.item_id = parsed.item_id
      ), 0)
    END
  FROM jsonb_to_recordset(p_items) AS parsed(item_id uuid, quantity numeric, unit_cost numeric);

  INSERT INTO public.warehouse_items (entity_id, warehouse_id, item_id)
  SELECT DISTINCT p_entity_id, warehouse_id, parsed.item_id
  FROM jsonb_to_recordset(p_items) AS parsed(item_id uuid, quantity numeric, unit_cost numeric)
  CROSS JOIN LATERAL unnest(ARRAY[p_source_warehouse_id, p_destination_warehouse_id]) AS warehouse_id
  WHERE warehouse_id IS NOT NULL
  ON CONFLICT (warehouse_id, item_id) DO NOTHING;

  RETURN v_movement_id;
END;
$$;

ALTER TABLE public.operational_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_entity_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_entities_read ON public.operational_entities FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(id)));
CREATE POLICY operational_entities_admin ON public.operational_entities FOR ALL TO authenticated
  USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());
CREATE POLICY operational_memberships_read ON public.operational_entity_memberships FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_superadmin_jwt());
CREATE POLICY operational_memberships_admin ON public.operational_entity_memberships FOR ALL TO authenticated
  USING (public.is_superadmin_jwt()) WITH CHECK (public.is_superadmin_jwt());

CREATE POLICY operational_units_read ON public.operational_units FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY operational_units_write ON public.operational_units FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY cost_centers_read ON public.cost_centers FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY cost_centers_write ON public.cost_centers FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY physical_locations_read ON public.physical_locations FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY physical_locations_write ON public.physical_locations FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY measurement_units_read ON public.measurement_units FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY measurement_units_write ON public.measurement_units FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY catalog_items_read ON public.catalog_items FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY catalog_items_write ON public.catalog_items FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY warehouses_read ON public.warehouses FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY warehouses_write ON public.warehouses FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY warehouse_items_read ON public.warehouse_items FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY warehouse_items_write ON public.warehouse_items FOR ALL TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])))
  WITH CHECK ((SELECT public.can_access_operational_entity(entity_id, ARRAY['admin', 'warehouse_manager'])));
CREATE POLICY stock_movements_read ON public.stock_movements FOR SELECT TO authenticated
  USING ((SELECT public.can_access_operational_entity(entity_id)));
CREATE POLICY stock_movement_items_read ON public.stock_movement_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stock_movements movement
    WHERE movement.id = movement_id
      AND (SELECT public.can_access_operational_entity(movement.entity_id))
  ));

REVOKE ALL ON public.operational_entities, public.operational_entity_memberships,
  public.operational_units, public.cost_centers, public.physical_locations,
  public.measurement_units, public.catalog_items, public.warehouses,
  public.warehouse_items, public.stock_movements, public.stock_movement_items FROM anon, authenticated;
GRANT SELECT ON public.operational_entities, public.operational_entity_memberships,
  public.operational_units, public.cost_centers, public.physical_locations,
  public.measurement_units, public.catalog_items, public.warehouses,
  public.warehouse_items, public.stock_movements, public.stock_movement_items,
  public.stock_balances TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.operational_units, public.cost_centers,
  public.physical_locations, public.measurement_units, public.catalog_items,
  public.warehouses, public.warehouse_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_stock_movement(uuid, text, uuid, uuid, text, text, text, jsonb) TO authenticated;

INSERT INTO public.operational_entities (id, code, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'DEFAULT', 'Entidade principal');

INSERT INTO public.operational_entity_memberships (entity_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', users.id,
  CASE WHEN lower(users.email) = 'cristiano.cnrn@gmail.com' THEN 'admin' ELSE 'operator' END
FROM auth.users users
ON CONFLICT (entity_id, user_id) DO NOTHING;

INSERT INTO public.operational_units (id, entity_id, code, name)
VALUES ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'GERAL', 'Unidade Geral');
INSERT INTO public.physical_locations (id, entity_id, code, name, location_type)
VALUES ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000001', 'ALMOX-CENTRAL', 'Almoxarifado Central', 'warehouse');
INSERT INTO public.warehouses (id, entity_id, unit_id, location_id, code, name)
VALUES (
  '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001',
  'CENTRAL', 'Almoxarifado Central'
);
INSERT INTO public.measurement_units (entity_id, code, name, decimal_places)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'UN', 'Unidade', 0),
  ('00000000-0000-0000-0000-000000000001', 'KG', 'Quilograma', 3),
  ('00000000-0000-0000-0000-000000000001', 'L', 'Litro', 3),
  ('00000000-0000-0000-0000-000000000001', 'CX', 'Caixa', 0);

INSERT INTO public.screen_groups (id, name, sort_order)
VALUES ('operacoes', 'Operações', 38)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;
INSERT INTO public.app_screens (id, screen_group_id, name, path, sort_order, is_admin_only, is_active)
VALUES ('almoxarifado', 'operacoes', 'Almoxarifado', '/almoxarifado', 10, false, true)
ON CONFLICT (id) DO UPDATE SET screen_group_id = EXCLUDED.screen_group_id,
  name = EXCLUDED.name, path = EXCLUDED.path, sort_order = EXCLUDED.sort_order,
  is_admin_only = EXCLUDED.is_admin_only, is_active = EXCLUDED.is_active;
INSERT INTO public.user_group_screen_permissions (group_id, screen_id, can_access)
SELECT id, 'almoxarifado', true FROM public.user_groups WHERE slug IN ('diretores', 'teste')
ON CONFLICT (group_id, screen_id) DO UPDATE SET can_access = true, updated_at = now();
