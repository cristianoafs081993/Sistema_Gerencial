import type { Empenho } from '@/types';
import { matchesDimensionFilter } from '@/utils/dimensionFilters';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapReferenceYear,
  getRapSaldoAtual,
} from '@/utils/rapMetrics';

export type EmpenhosFilters = {
  searchTerm: string;
  filterStatus: string;
  filterDimensao: string;
  filterComponente: string;
  filterOrigem: string;
  filterPlanoInterno: string;
  dataInicio: string;
  dataFim: string;
};

export const normalizeEmpenhoSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const getRapBase = (empenho: Empenho, referenceYear = getRapReferenceYear([empenho])): number =>
  getRapBaseVigente(empenho, referenceYear);

export const getRapSaldo = (empenho: Empenho, referenceYear = getRapReferenceYear([empenho])): number =>
  getRapSaldoAtual(empenho, referenceYear);

export const getRapLiquidado = (empenho: Empenho): number => getRapLiquidadoNoAno(empenho);

export const matchesEmpenhoStatusFilter = (
  empenho: Empenho,
  filterStatus: string,
  referenceYear = getRapReferenceYear([empenho]),
) => {
  if (filterStatus === 'all') return true;

  if (empenho.tipo === 'rap') {
    const saldoAtual = getRapSaldo(empenho, referenceYear);
    const liquidadoNoAno = getRapLiquidado(empenho);
    const isCompletamentePago = saldoAtual <= 0 && liquidadoNoAno > 0;

    if (filterStatus === 'pago') return isCompletamentePago;
    if (filterStatus === 'liquidado') return liquidadoNoAno > 0 && !isCompletamentePago;
    if (filterStatus === 'pendente') return !isCompletamentePago;
  }

  return empenho.status === filterStatus;
};

export const matchesEmpenhoDateRange = (empenho: Empenho, dataInicio: string, dataFim: string) => {
  if (!dataInicio || !dataFim) return true;

  const data = new Date(empenho.dataEmpenho);
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  fim.setHours(23, 59, 59, 999);

  return data >= inicio && data <= fim;
};

export const filterEmpenhos = (empenhos: Empenho[], filters: EmpenhosFilters) => {
  const searchNormalized = normalizeEmpenhoSearch(filters.searchTerm);
  const searchDigits = filters.searchTerm.replace(/\D/g, '');
  const rapReferenceYear = getRapReferenceYear(empenhos);

  return empenhos.filter((empenho) => {
    const matchesSearch =
      normalizeEmpenhoSearch(empenho.numero).includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.descricao).includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.componenteFuncional || '').includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.favorecidoNome || '').includes(searchNormalized) ||
      (searchDigits !== '' &&
        (empenho.favorecidoDocumento || '').replace(/\D/g, '').includes(searchDigits));

    const matchesStatus = matchesEmpenhoStatusFilter(empenho, filters.filterStatus, rapReferenceYear);
    const matchesDimensao = matchesDimensionFilter({
      dimensionValue: empenho.dimensao,
      planInternal: empenho.planoInterno,
      description: empenho.descricao,
      filterValue: filters.filterDimensao,
    });
    const matchesComponente =
      filters.filterComponente === 'all' || empenho.componenteFuncional?.trim() === filters.filterComponente;
    const matchesOrigem =
      filters.filterOrigem === 'all' || empenho.origemRecurso?.trim() === filters.filterOrigem;
    const matchesPlano =
      filters.filterPlanoInterno === 'all' || empenho.planoInterno?.trim() === filters.filterPlanoInterno;
    const matchesData = matchesEmpenhoDateRange(empenho, filters.dataInicio, filters.dataFim);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesDimensao &&
      matchesComponente &&
      matchesOrigem &&
      matchesPlano &&
      matchesData
    );
  });
};
