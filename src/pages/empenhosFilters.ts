import type { Empenho } from '@/types';
import { matchesDimensionFilter } from '@/utils/dimensionFilters';

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

export const getRapSaldo = (empenho: Empenho): number => {
  const aLiquidar = empenho.rapALiquidar || 0;
  if (aLiquidar > 0) return aLiquidar;
  return empenho.saldoRapOficial || 0;
};

export const getRapLiquidado = (empenho: Empenho): number => {
  const inscrito = empenho.rapInscrito || 0;
  return Math.max(0, inscrito - getRapSaldo(empenho));
};

export const matchesEmpenhoStatusFilter = (empenho: Empenho, filterStatus: string) => {
  if (filterStatus === 'all') return true;

  if (empenho.tipo === 'rap') {
    const isCompletamentePago = getRapSaldo(empenho) <= 0 && (empenho.rapPago || 0) > 0;

    if (filterStatus === 'pago') return isCompletamentePago;
    if (filterStatus === 'liquidado') return getRapLiquidado(empenho) > 0 && !isCompletamentePago;
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

  return empenhos.filter((empenho) => {
    const matchesSearch =
      normalizeEmpenhoSearch(empenho.numero).includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.descricao).includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.componenteFuncional || '').includes(searchNormalized) ||
      normalizeEmpenhoSearch(empenho.favorecidoNome || '').includes(searchNormalized) ||
      (searchDigits !== '' &&
        (empenho.favorecidoDocumento || '').replace(/\D/g, '').includes(searchDigits));

    const matchesStatus = matchesEmpenhoStatusFilter(empenho, filters.filterStatus);
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
