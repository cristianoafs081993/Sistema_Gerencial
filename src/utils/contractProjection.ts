import type { ContratoApiFaturaRow } from '@/services/contratosApi';

const ROBUST_Z_THRESHOLD = 3.5;

type ReferenceRecord = Record<string, unknown>;

const asRecord = (value: unknown): ReferenceRecord | null =>
  value && typeof value === 'object' ? (value as ReferenceRecord) : null;

const firstNonEmpty = (...values: unknown[]) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');

const parseYearMonth = (yearValue: unknown, monthValue: unknown): Date | null => {
  const year = Number(String(yearValue ?? '').trim());
  const month = Number(String(monthValue ?? '').trim());
  if (!Number.isInteger(year) || year < 1900 || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, 1));
};

const dateFromValue = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const maxDate = (dates: Date[]) =>
  dates.reduce<Date | null>((latest, date) => (!latest || date.getTime() > latest.getTime() ? date : latest), null);

/**
 * Resolve the billing competence exposed by the Comprasnet API.
 * Real payloads may leave top-level mesref/anoref empty and provide the
 * competence only inside dados_referencia[].
 */
export const resolveFaturaCompetencia = (fatura: Pick<ContratoApiFaturaRow, 'mes_referencia' | 'ano_referencia' | 'raw_data'>): Date | null => {
  const raw = asRecord(fatura.raw_data);
  const dates: Date[] = [];

  const addCandidate = (record: ReferenceRecord | null) => {
    if (!record) return;
    const date = parseYearMonth(
      firstNonEmpty(record.ano_referencia, record.anoref),
      firstNonEmpty(record.mes_referencia, record.mesref),
    );
    if (date) dates.push(date);
  };

  addCandidate({
    mes_referencia: fatura.mes_referencia,
    ano_referencia: fatura.ano_referencia,
  });
  addCandidate(raw);

  const references = raw?.dados_referencia;
  if (Array.isArray(references)) {
    references.forEach((reference) => addCandidate(asRecord(reference)));
  }

  return maxDate(dates);
};

export const getFaturaActivityDate = (
  fatura: Pick<ContratoApiFaturaRow, 'data_emissao' | 'mes_referencia' | 'ano_referencia' | 'raw_data'>,
) => dateFromValue(fatura.data_emissao) || resolveFaturaCompetencia(fatura);

export const getProjectionHistoryPeriod = (today: Date) => {
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const historyStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 1));
  const historyEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));

  const toIsoDate = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

  return {
    startDate: toIsoDate(historyStart),
    endDate: toIsoDate(historyEnd),
    currentMonth: dateKey(currentMonthStart),
  };
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

export type RobustInvoiceBaseline = {
  mediaNota: number;
  medianaNota: number;
  notasTotais: number;
  notasUtilizadas: number;
  notasDesconsideradas: number;
  usouFallbackMediana: boolean;
};

export const calculateRobustInvoiceBaseline = (rawValues: number[]): RobustInvoiceBaseline => {
  const values = rawValues.filter((value) => Number.isFinite(value) && value > 0);
  const notasTotais = values.length;
  if (notasTotais === 0) {
    return {
      mediaNota: 0,
      medianaNota: 0,
      notasTotais: 0,
      notasUtilizadas: 0,
      notasDesconsideradas: 0,
      usouFallbackMediana: false,
    };
  }

  const medianaNota = median(values);
  if (values.length < 3) {
    return {
      mediaNota: medianaNota,
      medianaNota,
      notasTotais,
      notasUtilizadas: notasTotais,
      notasDesconsideradas: 0,
      usouFallbackMediana: true,
    };
  }

  const mad = median(values.map((value) => Math.abs(value - medianaNota)));
  if (mad === 0) {
    return {
      mediaNota: medianaNota,
      medianaNota,
      notasTotais,
      notasUtilizadas: notasTotais,
      notasDesconsideradas: 0,
      usouFallbackMediana: true,
    };
  }

  const usedValues = values.filter((value) => (0.6745 * Math.abs(value - medianaNota)) / mad <= ROBUST_Z_THRESHOLD);
  if (usedValues.length === 0) {
    return {
      mediaNota: medianaNota,
      medianaNota,
      notasTotais,
      notasUtilizadas: notasTotais,
      notasDesconsideradas: 0,
      usouFallbackMediana: true,
    };
  }

  return {
    mediaNota: usedValues.reduce((sum, value) => sum + value, 0) / usedValues.length,
    medianaNota,
    notasTotais,
    notasUtilizadas: usedValues.length,
    notasDesconsideradas: notasTotais - usedValues.length,
    usouFallbackMediana: false,
  };
};
