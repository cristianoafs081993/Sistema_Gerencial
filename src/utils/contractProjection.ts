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

const EXECUTED_FATURA_STATUSES = new Set(['pago', 'siafi apropriado', 'pagamento parcial']);

export const isExecutedFatura = (situacao?: string | null): boolean => {
  const normalized = String(situacao ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return EXECUTED_FATURA_STATUSES.has(normalized);
};

export interface ContractInstallmentMetrics {
  totalParcelasPrevistas: number;
  qtdApropriadas: number;
  qtdPendentes: number;
  parcelasNaoEmitidas: number;
  parcelasRestantesContrato: number;
  faturasApropriadas: ContratoApiFaturaRow[];
  faturasPendentes: ContratoApiFaturaRow[];
  valorLiquidadoTotal: number;
  valorPendenteTotal: number;
}

export const getContractTotalExpectedInstallments = (
  contrato: {
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
    vigencia_inicio_derivada?: string | null;
    vigencia_fim_derivada?: string | null;
    categoria?: string | null;
  },
  historico?: Array<{
    tipo?: string | null;
    num_parcelas?: number | null;
    novo_num_parcelas?: number | null;
    data_assinatura?: string | null;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
  }> | null,
): number => {
  const inicioStr = contrato.vigencia_inicio_derivada ?? contrato.vigencia_inicio;
  const fimStr = contrato.vigencia_fim_derivada ?? contrato.vigencia_fim;

  let monthsFromValidity = 0;
  if (inicioStr && fimStr) {
    const dInicio = dateFromValue(inicioStr);
    const dFim = dateFromValue(fimStr);
    if (dInicio && dFim && dFim.getTime() >= dInicio.getTime()) {
      const diffMonths = (dFim.getUTCFullYear() - dInicio.getUTCFullYear()) * 12 + dFim.getUTCMonth() - dInicio.getUTCMonth();
      monthsFromValidity = Math.max(1, diffMonths);
    }
  }

  if (historico && historico.length > 0) {
    const sorted = [...historico].sort((a, b) => {
      const timeA = a.data_assinatura ? new Date(a.data_assinatura).getTime() : 0;
      const timeB = b.data_assinatura ? new Date(b.data_assinatura).getTime() : 0;
      return timeB - timeA;
    });

    for (const term of sorted) {
      const termParcelas = term.novo_num_parcelas ?? term.num_parcelas;
      if (termParcelas && termParcelas > 0) {
        return Math.max(termParcelas, monthsFromValidity);
      }
    }
  }

  return monthsFromValidity > 0 ? monthsFromValidity : 12;
};

export const calculateContractInstallmentMetrics = (
  contrato: {
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
    vigencia_inicio_derivada?: string | null;
    vigencia_fim_derivada?: string | null;
    categoria?: string | null;
  },
  faturas: ContratoApiFaturaRow[],
  historico?: Array<{
    tipo?: string | null;
    num_parcelas?: number | null;
    novo_num_parcelas?: number | null;
    data_assinatura?: string | null;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
  }> | null,
): ContractInstallmentMetrics => {
  const totalParcelasPrevistas = getContractTotalExpectedInstallments(contrato, historico);

  const faturasApropriadas: ContratoApiFaturaRow[] = [];
  const faturasPendentes: ContratoApiFaturaRow[] = [];
  let valorLiquidadoTotal = 0;
  let valorPendenteTotal = 0;

  faturas.forEach((fatura) => {
    const val = Number(fatura.valor_liquido ?? fatura.valor_bruto ?? 0) || 0;
    if (val <= 0) return;

    if (isExecutedFatura(fatura.situacao)) {
      faturasApropriadas.push(fatura);
      valorLiquidadoTotal += val;
    } else {
      faturasPendentes.push(fatura);
      valorPendenteTotal += val;
    }
  });

  const qtdApropriadas = faturasApropriadas.length;
  const qtdPendentes = faturasPendentes.length;
  const parcelasRestantesContrato = Math.max(0, totalParcelasPrevistas - qtdApropriadas);
  const parcelasNaoEmitidas = Math.max(0, parcelasRestantesContrato - qtdPendentes);

  return {
    totalParcelasPrevistas,
    qtdApropriadas,
    qtdPendentes,
    parcelasNaoEmitidas,
    parcelasRestantesContrato,
    faturasApropriadas,
    faturasPendentes,
    valorLiquidadoTotal,
    valorPendenteTotal,
  };
};
