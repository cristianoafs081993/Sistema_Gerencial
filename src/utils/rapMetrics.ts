import type { Empenho } from '@/types';

const normalizeRapValue = (value?: number) => {
  if (value == null || Number.isNaN(value)) return undefined;
  return Math.max(0, value);
};

export const getRapAnoEmpenho = (empenho: Empenho) => {
  const match = empenho.numero.match(/^(\d{4})NE/i);
  if (match) return Number(match[1]);

  if (empenho.dataEmpenho instanceof Date && !Number.isNaN(empenho.dataEmpenho.getTime())) {
    return empenho.dataEmpenho.getFullYear();
  }

  const parsedDate = new Date(empenho.dataEmpenho);
  return Number.isNaN(parsedDate.getTime()) ? new Date().getFullYear() : parsedDate.getFullYear();
};

export const getRapReferenceYear = (empenhos: Empenho[]) => {
  const currentYear = new Date().getFullYear();
  const years = empenhos.map(getRapAnoEmpenho).filter((year) => Number.isFinite(year));

  if (years.length === 0) return currentYear;

  return Math.max(currentYear, ...years);
};

export const isRapReinscrito = (empenho: Empenho, referenceYear: number) =>
  getRapAnoEmpenho(empenho) <= referenceYear - 2;

export const getRapLiquidadoNoAno = (empenho: Empenho) => normalizeRapValue(empenho.rapPago) ?? 0;

export const getRapBaseVigente = (empenho: Empenho, referenceYear: number) => {
  const saldoAtual = normalizeRapValue(empenho.saldoRapOficial);
  const liquidadoNoAno = getRapLiquidadoNoAno(empenho);
  const rapInscrito = normalizeRapValue(empenho.rapInscrito) ?? 0;
  const rapALiquidar = normalizeRapValue(empenho.rapALiquidar) ?? 0;

  if (isRapReinscrito(empenho, referenceYear)) {
    if (rapALiquidar > 0) return rapALiquidar;
    if (saldoAtual != null || liquidadoNoAno > 0) return liquidadoNoAno + (saldoAtual ?? 0);
    return rapInscrito;
  }

  if (rapInscrito > 0) return rapInscrito;
  if (saldoAtual != null || liquidadoNoAno > 0) return liquidadoNoAno + (saldoAtual ?? 0);
  return rapALiquidar;
};

export const getRapSaldoAtual = (empenho: Empenho, referenceYear: number) => {
  const saldoAtual = normalizeRapValue(empenho.saldoRapOficial);
  if (saldoAtual != null) return saldoAtual;

  return Math.max(0, getRapBaseVigente(empenho, referenceYear) - getRapLiquidadoNoAno(empenho));
};
