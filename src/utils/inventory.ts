export type StockMovementType =
  | 'receipt'
  | 'issue'
  | 'transfer'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_in'
  | 'return_out';

export type StockLevelStatus = 'out' | 'low' | 'available';

export const stockMovementLabels: Record<StockMovementType, string> = {
  receipt: 'Entrada',
  issue: 'Saída',
  transfer: 'Transferência',
  adjustment_in: 'Ajuste de entrada',
  adjustment_out: 'Ajuste de saída',
  return_in: 'Devolução de entrada',
  return_out: 'Devolução de saída',
};

export function getStockLevelStatus(quantity: number, minimumStock: number): StockLevelStatus {
  if (quantity <= 0) return 'out';
  if (minimumStock > 0 && quantity <= minimumStock) return 'low';
  return 'available';
}

export function movementRequiresSource(type: StockMovementType) {
  return ['issue', 'transfer', 'adjustment_out', 'return_out'].includes(type);
}

export function movementRequiresDestination(type: StockMovementType) {
  return ['receipt', 'transfer', 'adjustment_in', 'return_in'].includes(type);
}

export function validateStockMovementInput(input: {
  type: StockMovementType;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  itemId?: string;
  quantity: number;
  unitCost: number;
}) {
  if (!input.itemId) return 'Selecione um item.';
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return 'Informe uma quantidade maior que zero.';
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) return 'O custo unitário não pode ser negativo.';
  if (movementRequiresSource(input.type) && !input.sourceWarehouseId) return 'Selecione o depósito de origem.';
  if (movementRequiresDestination(input.type) && !input.destinationWarehouseId) return 'Selecione o depósito de destino.';
  if (
    input.type === 'transfer'
    && input.sourceWarehouseId === input.destinationWarehouseId
  ) return 'Origem e destino devem ser diferentes.';
  return null;
}
