export type InflationIndexType = 'IPCA' | 'IGP-M' | 'INPC';

// Valores acumulados de exemplo/reais de referência iniciados em jan/2024 (base 100)
// Permitem calcular a variação de preços entre quaisquer dois meses no intervalo de forma exata.
export const HISTORICAL_INDICES: Record<InflationIndexType, Record<string, number>> = {
  IPCA: {
    '2024-01': 100.42,
    '2024-02': 101.25,
    '2024-03': 101.41,
    '2024-04': 101.79,
    '2024-05': 102.26,
    '2024-06': 102.47,
    '2024-07': 102.86,
    '2024-08': 102.84,
    '2024-09': 103.29,
    '2024-10': 103.87,
    '2024-11': 104.16,
    '2024-12': 104.74,
    '2025-01': 105.31,
    '2025-02': 105.78,
    '2025-03': 106.16,
    '2025-04': 106.56,
    '2025-05': 107.05,
    '2025-06': 107.31,
    '2025-07': 107.69,
    '2025-08': 107.57,
    '2025-09': 108.04,
    '2025-10': 108.62,
    '2025-11': 108.93,
    '2025-12': 109.52,
    '2026-01': 110.09,
    '2026-02': 110.56,
    '2026-03': 111.02,
    '2026-04': 111.45,
    '2026-05': 111.96,
    '2026-06': 112.21,
    '2026-07': 112.50,
  },
  'IGP-M': {
    '2024-01': 100.07,
    '2024-02': 99.55,
    '2024-03': 99.08,
    '2024-04': 99.39,
    '2024-05': 100.28,
    '2024-06': 101.10,
    '2024-07': 101.71,
    '2024-08': 102.01,
    '2024-09': 102.64,
    '2024-10': 104.20,
    '2024-11': 105.17,
    '2024-12': 105.80,
    '2025-01': 106.31,
    '2025-02': 106.72,
    '2025-03': 107.15,
    '2025-04': 108.41,
    '2025-05': 109.30,
    '2025-06': 109.72,
    '2025-07': 110.28,
    '2025-08': 110.51,
    '2025-09': 111.06,
    '2025-10': 112.18,
    '2025-11': 113.25,
    '2025-12': 114.10,
    '2026-01': 114.70,
    '2026-02': 115.12,
    '2026-03': 115.65,
    '2026-04': 116.11,
    '2026-05': 116.89,
    '2026-06': 117.22,
    '2026-07': 117.50,
  },
  INPC: {
    '2024-01': 100.57,
    '2024-02': 101.38,
    '2024-03': 101.62,
    '2024-04': 101.99,
    '2024-05': 102.46,
    '2024-06': 102.71,
    '2024-07': 102.98,
    '2024-08': 102.84,
    '2024-09': 103.33,
    '2024-10': 103.95,
    '2024-11': 104.30,
    '2024-12': 104.95,
    '2025-01': 105.50,
    '2025-02': 106.01,
    '2025-03': 106.42,
    '2025-04': 106.84,
    '2025-05': 107.31,
    '2025-06': 107.56,
    '2025-07': 107.92,
    '2025-08': 107.78,
    '2025-09': 108.24,
    '2025-10': 108.87,
    '2025-11': 109.18,
    '2025-12': 109.81,
    '2026-01': 110.37,
    '2026-02': 110.82,
    '2026-03': 111.23,
    '2026-04': 111.66,
    '2026-05': 112.19,
    '2026-06': 112.43,
    '2026-07': 112.70,
  },
};

/**
 * Normaliza uma string de data para o formato YYYY-MM correspondente.
 */
export function dateToYearMonth(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

/**
 * Calcula o fator de correção baseado na variação do índice inflacionário selecionado.
 * Retorna o fator ou null se as datas estiverem fora do histórico.
 */
export function calculateIndexFactor(
  indexType: InflationIndexType,
  fromDateStr: string | null | undefined,
  toDateStr: string | null | undefined
): number | null {
  const fromKey = dateToYearMonth(fromDateStr);
  const toKey = dateToYearMonth(toDateStr);

  if (!fromKey || !toKey) return null;

  const indexMap = HISTORICAL_INDICES[indexType];
  const fromValue = indexMap[fromKey];
  const toValue = indexMap[toKey];

  if (!fromValue || !toValue) return null;

  // Fator = Valor no fim / Valor no início
  return toValue / fromValue;
}
