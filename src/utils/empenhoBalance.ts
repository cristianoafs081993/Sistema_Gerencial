import type { Empenho } from '@/types';
import { getRapReferenceYear, getRapSaldoAtual } from '@/utils/rapMetrics';

export function getEmpenhoAvailableBalance(empenho: Empenho, referenceYear?: number) {
  if (empenho.tipo === 'rap') {
    return getRapSaldoAtual(empenho, referenceYear ?? getRapReferenceYear([empenho]));
  }

  const executed = (empenho.valorLiquidadoAPagar || 0) + (empenho.valorPagoOficial || 0);
  return Math.max(0, empenho.valor - executed);
}

export function hasSufficientEmpenhoBalance(empenho: Empenho, requestedTotal: number, referenceYear?: number) {
  return requestedTotal <= getEmpenhoAvailableBalance(empenho, referenceYear);
}
