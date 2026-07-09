import { supabase } from '@/lib/supabase';
import type { StockMovementType } from '@/utils/inventory';

export type OperationalEntityContext = {
  id: string;
  code: string;
  name: string;
  role: 'admin' | 'warehouse_manager' | 'operator' | 'auditor';
};

export type MeasurementUnit = { id: string; code: string; name: string; decimalPlaces: number };
export type Warehouse = { id: string; code: string; name: string };
export type CatalogItem = {
  id: string;
  code: string;
  name: string;
  itemType: 'consumption' | 'permanent' | 'service';
  unitId: string;
  unitCode: string;
};
export type StockBalance = {
  warehouseId: string;
  warehouseName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unitCode: string;
  quantity: number;
  inventoryValue: number;
  minimumStock: number;
  isBlocked: boolean;
};
export type StockMovement = {
  id: string;
  type: StockMovementType;
  sourceWarehouseId: string | null;
  destinationWarehouseId: string | null;
  referenceNumber: string;
  occurredAt: string;
  notes: string;
};

type MembershipRow = { entity_id: string; role: OperationalEntityContext['role'] };
type EntityRow = { id: string; code: string; name: string };
type UnitRow = { id: string; code: string; name: string; decimal_places: number };
type WarehouseRow = { id: string; code: string; name: string };
type ItemRow = {
  id: string;
  code: string;
  name: string;
  item_type: CatalogItem['itemType'];
  unit_id: string;
  measurement_units: { code: string } | { code: string }[] | null;
};
type BalanceRow = {
  warehouse_id: string;
  item_id: string;
  quantity_on_hand: number | string;
  inventory_value: number | string;
};
type WarehouseItemRow = { warehouse_id: string; item_id: string; minimum_stock: number | string; is_blocked: boolean };
type MovementRow = {
  id: string;
  movement_type: StockMovementType;
  source_warehouse_id: string | null;
  destination_warehouse_id: string | null;
  reference_number: string | null;
  occurred_at: string;
  notes: string | null;
};

function relationCode(relation: ItemRow['measurement_units']) {
  if (Array.isArray(relation)) return relation[0]?.code || '';
  return relation?.code || '';
}

export const inventoryService = {
  async getContext(): Promise<OperationalEntityContext | null> {
    const { data: membership, error: membershipError } = await supabase
      .from('operational_entity_memberships')
      .select('entity_id,role')
      .limit(1)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) return null;

    const typedMembership = membership as MembershipRow;
    const { data: entity, error: entityError } = await supabase
      .from('operational_entities')
      .select('id,code,name')
      .eq('id', typedMembership.entity_id)
      .single();
    if (entityError) throw entityError;
    const row = entity as EntityRow;
    return { ...row, role: typedMembership.role };
  },

  async getWorkspace(entityId: string) {
    const [unitsResult, warehousesResult, itemsResult, balancesResult, settingsResult, movementsResult] = await Promise.all([
      supabase.from('measurement_units').select('id,code,name,decimal_places').eq('entity_id', entityId).eq('is_active', true).order('code'),
      supabase.from('warehouses').select('id,code,name').eq('entity_id', entityId).eq('is_active', true).order('name'),
      supabase.from('catalog_items').select('id,code,name,item_type,unit_id,measurement_units(code)').eq('entity_id', entityId).eq('is_active', true).order('name'),
      supabase.from('stock_balances').select('warehouse_id,item_id,quantity_on_hand,inventory_value').eq('entity_id', entityId),
      supabase.from('warehouse_items').select('warehouse_id,item_id,minimum_stock,is_blocked').eq('entity_id', entityId),
      supabase.from('stock_movements').select('id,movement_type,source_warehouse_id,destination_warehouse_id,reference_number,occurred_at,notes').eq('entity_id', entityId).order('occurred_at', { ascending: false }).limit(50),
    ]);
    const error = [unitsResult, warehousesResult, itemsResult, balancesResult, settingsResult, movementsResult]
      .find((result) => result.error)?.error;
    if (error) throw error;

    const units = ((unitsResult.data || []) as UnitRow[]).map((row) => ({
      id: row.id, code: row.code, name: row.name, decimalPlaces: row.decimal_places,
    }));
    const warehouses = (warehousesResult.data || []) as WarehouseRow[];
    const items = ((itemsResult.data || []) as ItemRow[]).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      itemType: row.item_type,
      unitId: row.unit_id,
      unitCode: relationCode(row.measurement_units),
    }));
    const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const settingMap = new Map(((settingsResult.data || []) as WarehouseItemRow[])
      .map((row) => [`${row.warehouse_id}:${row.item_id}`, row]));
    const balances = ((balancesResult.data || []) as BalanceRow[]).map((row): StockBalance => {
      const item = itemMap.get(row.item_id);
      const setting = settingMap.get(`${row.warehouse_id}:${row.item_id}`);
      return {
        warehouseId: row.warehouse_id,
        warehouseName: warehouseMap.get(row.warehouse_id)?.name || 'Depósito',
        itemId: row.item_id,
        itemCode: item?.code || '',
        itemName: item?.name || 'Item',
        unitCode: item?.unitCode || '',
        quantity: Number(row.quantity_on_hand),
        inventoryValue: Number(row.inventory_value),
        minimumStock: Number(setting?.minimum_stock || 0),
        isBlocked: setting?.is_blocked || false,
      };
    });
    const movements = ((movementsResult.data || []) as MovementRow[]).map((row): StockMovement => ({
      id: row.id,
      type: row.movement_type,
      sourceWarehouseId: row.source_warehouse_id,
      destinationWarehouseId: row.destination_warehouse_id,
      referenceNumber: row.reference_number || '',
      occurredAt: row.occurred_at,
      notes: row.notes || '',
    }));
    return { units, warehouses, items, balances, movements };
  },

  async createCatalogItem(input: {
    entityId: string;
    unitId: string;
    code: string;
    name: string;
    itemType: CatalogItem['itemType'];
  }) {
    const { error } = await supabase.from('catalog_items').insert({
      entity_id: input.entityId,
      unit_id: input.unitId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      item_type: input.itemType,
    });
    if (error) throw error;
  },

  async postMovement(input: {
    entityId: string;
    type: StockMovementType;
    sourceWarehouseId?: string;
    destinationWarehouseId?: string;
    referenceNumber?: string;
    notes?: string;
    itemId: string;
    quantity: number;
    unitCost: number;
  }) {
    const { data, error } = await supabase.rpc('post_stock_movement', {
      p_entity_id: input.entityId,
      p_movement_type: input.type,
      p_source_warehouse_id: input.sourceWarehouseId || null,
      p_destination_warehouse_id: input.destinationWarehouseId || null,
      p_reference_number: input.referenceNumber || null,
      p_notes: input.notes || null,
      p_idempotency_key: crypto.randomUUID(),
      p_items: [{ item_id: input.itemId, quantity: input.quantity, unit_cost: input.unitCost }],
    });
    if (error) throw error;
    return data as string;
  },
};
