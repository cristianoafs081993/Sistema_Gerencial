import { describe, expect, it } from 'vitest';

import {
  getStockLevelStatus,
  movementRequiresDestination,
  movementRequiresSource,
  validateStockMovementInput,
} from '@/utils/inventory';

describe('inventory domain rules', () => {
  it('classifies stock levels without treating zero minimum as low stock', () => {
    expect(getStockLevelStatus(0, 10)).toBe('out');
    expect(getStockLevelStatus(5, 10)).toBe('low');
    expect(getStockLevelStatus(5, 0)).toBe('available');
    expect(getStockLevelStatus(11, 10)).toBe('available');
  });

  it('maps source and destination requirements by movement type', () => {
    expect(movementRequiresSource('issue')).toBe(true);
    expect(movementRequiresSource('receipt')).toBe(false);
    expect(movementRequiresDestination('receipt')).toBe(true);
    expect(movementRequiresDestination('issue')).toBe(false);
  });

  it('rejects invalid transfers and quantities', () => {
    expect(validateStockMovementInput({
      type: 'transfer',
      sourceWarehouseId: 'same',
      destinationWarehouseId: 'same',
      itemId: 'item',
      quantity: 1,
      unitCost: 10,
    })).toBe('Origem e destino devem ser diferentes.');

    expect(validateStockMovementInput({
      type: 'receipt',
      destinationWarehouseId: 'warehouse',
      itemId: 'item',
      quantity: 0,
      unitCost: 10,
    })).toBe('Informe uma quantidade maior que zero.');
  });

  it('accepts a valid receipt', () => {
    expect(validateStockMovementInput({
      type: 'receipt',
      destinationWarehouseId: 'warehouse',
      itemId: 'item',
      quantity: 4,
      unitCost: 2.5,
    })).toBeNull();
  });
});
