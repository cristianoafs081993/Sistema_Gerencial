import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeaderActions } from '@/components/HeaderParts';
import { DashboardContractExecutionTab } from '@/components/dashboard/DashboardContractExecutionTab';
import { DashboardCurrentTab } from '@/components/dashboard/DashboardCurrentTab';
import { DashboardFiltersSheet } from '@/components/dashboard/DashboardFiltersSheet';
import { DashboardRapTab } from '@/components/dashboard/DashboardRapTab';
import { getReadableTextColor, mixHexColors } from '@/components/dashboard/utils';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapReferenceYear,
  getRapSaldoAtual,
  isRapReinscrito,
} from '@/utils/rapMetrics';
import { useData } from '@/contexts/DataContext';
import { extractDimensionCode, getDimensionLabel, matchesDimensionFilter } from '@/utils/dimensionFilters';
import {
  buildDescentralizacaoSummaryRows,
  getFilteredDescentralizacaoSummaryTotal,
} from '@/utils/descentralizacoesContaSaldos';
import { normalizeEmpenhoNumero, transparenciaService, type LiquidacaoPorEmpenho } from '@/services/transparencia';
import {
  contratosApiService,
  type ContratoApiEmpenhoRow,
  type ContratoApiFaturaRow,
  type ContratoApiPublicLiquidacaoRow,
  type ContratoApiRow,
} from '@/services/contratosApi';
import { isContratoApiDisplayFatura } from '@/utils/contratosApiStatus';
import type { Atividade, Empenho, Contrato, ContratoEmpenho } from '@/types';
import {
  buildEmpenhoLookupKeys,
  normalizeContratoNumero,
  shouldIgnoreContratoNumero,
} from '@/utils/contratosSync';



type MonthlyExecutionBucket = {
  date: Date;
  planejado: number;
  empenhado: number;
  liquidado: number;
};

export type ContractExpenseStatus = 'executado' | 'pendente';

export type ContractExpenseOption = {
  id: string;
  numero: string;
  fornecedorNome: string;
  objeto: string;
  total: number;
  color: string;
  label: string;
};

export type ContractExpenseDataPoint = {
  name: string;
  monthKey: string;
  total: number;
  [key: string]: string | number;
};

export type ContractExpenseSeries = {
  contratoId: string;
  label: string;
  color: string;
  dataKey: string;
};

export type ContractProjectionBulletItem = {
  id: string;
  label: string;
  color: string;
  empenhado: number;
  liquidado: number;
  projetado: number;
  saldoEmpenhos: number;
  mesesConsiderados: number;
  percentualLiquidado: number;
  percentualProjetado: number;
  liquidacoes: ContractProjectionLiquidacaoTrace[];
  empenhos: ContractProjectionEmpenhoTrace[];
  coberturaMes: string | null;
  necessidadeEmpenho: number;
  isCapped: boolean;
  isRenewalAllowed: boolean;
  valorTotalContrato: number;
  exceedsValiditySugestion?: boolean;
  vigenciaFim?: string | null;
  categoria?: string | null;
  prorrogavel?: string | null;
  objeto?: string | null;
};

export type ContractProjectionLiquidacaoTrace = {
  id: string;
  numeroInstrumento: string;
  situacao: string;
  dataEmissao: string | null;
  dataPagamento: string | null;
  valor: number;
};

export type ContractProjectionEmpenhoTrace = {
  id: string;
  numero: string;
  dataEmissao: string | null;
  valorEmpenhado: number;
  valorLiquidado: number;
  valorPago: number;
  saldo: number;
  saldoFonte: 'api' | 'calculado';
};

type ContractExpenseAggregation = {
  options: ContractExpenseOption[];
  data: ContractExpenseDataPoint[];
  series: ContractExpenseSeries[];
};

const CONTRACT_EXPENSE_COLORS = ['#2563eb', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];
const EXECUTED_CONTRACT_EXPENSE_STATUSES = new Set(['pago', 'siafi apropriado']);

const getCurrentYearExpensePeriod = () => {
  const year = new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
};

const toValidDate = (value?: Date | string | null): Date | null => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeStatusText = (value?: string | null) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getContractExpenseStatus = (situacao?: string | null): ContractExpenseStatus =>
  EXECUTED_CONTRACT_EXPENSE_STATUSES.has(normalizeStatusText(situacao)) ? 'executado' : 'pendente';

const getContractExpenseValue = (fatura: Pick<ContratoApiFaturaRow, 'valor_liquido' | 'valor_bruto'>) =>
  Number(fatura.valor_liquido ?? fatura.valor_bruto ?? 0) || 0;

const getContractCommitmentValue = (empenho: Pick<ContratoApiEmpenhoRow, 'valor_empenhado'>) =>
  Math.max(0, Number(empenho.valor_empenhado) || 0);

const getApiEmpenhoYear = (empenho: ContratoApiEmpenhoRow) => {
  const match = (empenho.numero || '').match(/^(\d{4})NE/i);
  if (match) return Number(match[1]);
  if (!empenho.data_emissao) return new Date().getFullYear();
  const parsed = new Date(empenho.data_emissao);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

const toApiCurrencyNumber = (value: unknown) => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number(
    String(value)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getApiEmpenhoNumber = (
  empenho: ContratoApiEmpenhoRow,
  dbKey: keyof ContratoApiEmpenhoRow,
  rawKey: string,
) => {
  const fromDb = toApiCurrencyNumber(empenho[dbKey]);
  if (fromDb !== undefined) return Math.max(0, fromDb);

  const raw = empenho.raw_data && typeof empenho.raw_data === 'object' ? empenho.raw_data : {};
  const fromRaw = toApiCurrencyNumber((raw as Record<string, unknown>)[rawKey]);
  return fromRaw === undefined ? undefined : Math.max(0, fromRaw);
};

const getApiRapLiquidadoPago = (empenho: ContratoApiEmpenhoRow) => {
  const rpLiquidadoApi = getApiEmpenhoNumber(empenho, 'rp_liquidado', 'rpliquidado') ?? 0;
  const rpPagoApi = getApiEmpenhoNumber(empenho, 'rp_pago', 'rppago') ?? 0;
  return rpLiquidadoApi + rpPagoApi;
};

const getApiRapBase = (empenho: ContratoApiEmpenhoRow) => {
  const rpInscritoApi = getApiEmpenhoNumber(empenho, 'rp_inscrito', 'rpinscrito') ?? 0;
  const rpALiquidarApi = getApiEmpenhoNumber(empenho, 'rp_a_liquidar', 'rpaliquidar') ?? 0;
  const rpAPagarApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar') ?? 0;
  const rpLiquidadoPagoApi = getApiRapLiquidadoPago(empenho);

  if (rpInscritoApi > 0) return rpInscritoApi;
  if (rpALiquidarApi > 0) return rpALiquidarApi;
  return rpLiquidadoPagoApi + rpAPagarApi;
};

const isApiRapEmpenho = (empenho: ContratoApiEmpenhoRow) =>
  getApiEmpenhoYear(empenho) < new Date().getFullYear() ||
  getApiRapBase(empenho) > 0 ||
  getApiRapLiquidadoPago(empenho) > 0;

const getApiRapSaldoAtual = (empenho: ContratoApiEmpenhoRow) => {
  const rpAPagarDbApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar');
  if (rpAPagarDbApi !== undefined) return rpAPagarDbApi;
  return Math.max(0, getApiRapBase(empenho) - getApiRapLiquidadoPago(empenho));
};

const getContractCommitmentBalanceTrace = (
  empenho: ContratoApiEmpenhoRow,
): Pick<ContractProjectionEmpenhoTrace, 'saldo' | 'saldoFonte'> => {
  if (isApiRapEmpenho(empenho)) {
    return {
      saldo: getApiRapSaldoAtual(empenho),
      saldoFonte: 'api',
    };
  }

  const apiBalance = Number(empenho.valor_a_liquidar);
  if (Number.isFinite(apiBalance) && empenho.valor_a_liquidar !== null && empenho.valor_a_liquidar !== undefined) {
    return {
      saldo: Math.max(0, apiBalance),
      saldoFonte: 'api',
    };
  }

  const valorEmpenhado = getContractCommitmentValue(empenho);
  const valorExecutado = Math.max(Number(empenho.valor_liquidado ?? empenho.valor_pago ?? 0) || 0, 0);

  return {
    saldo: Math.max(0, valorEmpenhado - valorExecutado),
    saldoFonte: 'calculado',
  };
};

const getContractExpenseFieldKey = (contratoId: string) =>
  `contract_${contratoId.replace(/[^a-zA-Z0-9]/g, '_')}`;

const getContractExpenseLabel = (contrato: Pick<ContratoApiRow, 'numero' | 'fornecedor_nome' | 'objeto'>) => {
  const fornecedor = contrato.fornecedor_nome?.trim();
  if (fornecedor) return `${fornecedor} - ${contrato.numero}`;
  return contrato.objeto ? `${contrato.objeto} - ${contrato.numero}` : contrato.numero;
};

const isDateInsideOptionalRange = (date: Date, startDate?: Date | null, endDate?: Date | null) => {
  if (startDate && date < startOfDay(startDate)) return false;
  if (endDate && date > endOfDay(endDate)) return false;
  return true;
};

const toValidOperationDate = (value?: string | null): Date | null => {
  if (!value) return null;

  const trimmedValue = value.trim();
  const brazilianDateMatch = trimmedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brazilianDateMatch) {
    const [, day, month, year] = brazilianDateMatch;
    return toValidDate(`${year}-${month}-${day}`);
  }

  return toValidDate(trimmedValue);
};

const getSignedOperationValue = (operacao: string | undefined, valor: number) => {
  if (!Number.isFinite(valor)) return 0;

  return operacao?.toUpperCase().includes('ANULACAO') ? -Math.abs(valor) : valor;
};

const buildApiEmpenhoDateMap = (apiEmpenhos: ContratoApiEmpenhoRow[] | unknown) => {
  const map = new Map<string, Date>();

  if (!Array.isArray(apiEmpenhos)) return map;

  apiEmpenhos.forEach((apiEmpenho) => {
    const numero = normalizeEmpenhoNumero(apiEmpenho.numero);
    const date = toValidDate(apiEmpenho.data_emissao);
    if (!numero || !date) return;

    const existing = map.get(numero);
    if (!existing || date.getTime() < existing.getTime()) {
      map.set(numero, date);
    }
  });

  return map;
};

const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const getMonthlyBucket = (buckets: Map<string, MonthlyExecutionBucket>, date: Date) => {
  const key = monthKey(date);
  const existing = buckets.get(key);

  if (existing) return existing;

  const bucket = {
    date: new Date(date.getUTCFullYear(), date.getUTCMonth(), 1),
    planejado: 0,
    empenhado: 0,
    liquidado: 0,
  };
  buckets.set(key, bucket);
  return bucket;
};

const monthStart = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), 1);

const countProjectionMonths = (startDate: Date, endDate: Date, today = new Date()) => {
  const effectiveEnd = endDate.getTime() > today.getTime() ? today : endDate;
  if (effectiveEnd.getTime() < startDate.getTime()) return 0;

  return (
    (effectiveEnd.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    effectiveEnd.getUTCMonth() -
    startDate.getUTCMonth() +
    1
  );
};

const addEmptyMonthlyBuckets = (
  buckets: Map<string, MonthlyExecutionBucket>,
  startDate: Date | null,
  endDate: Date,
) => {
  const existingDates = Array.from(buckets.values()).map((bucket) => bucket.date);
  const firstDate = startDate || existingDates.sort((left, right) => left.getTime() - right.getTime())[0] || endDate;
  const start = monthStart(firstDate);
  const end = monthStart(endDate);

  for (
    let cursor = start;
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
  ) {
    getMonthlyBucket(buckets, cursor);
  }
};

const buildDadosMensais = (
  atividades: Atividade[],
  empenhosCorrente: Empenho[],
  liquidacoesPorEmpenho: LiquidacaoPorEmpenho[],
  liquidacoesApiPorEmpenho: ContratoApiPublicLiquidacaoRow[],
  contratosApiEmpenhos: ContratoApiEmpenhoRow[],
  options: {
    startDate?: Date | null;
    endDate: Date;
  },
) => {
  const buckets = new Map<string, MonthlyExecutionBucket>();
  const apiEmpenhoDateMap = buildApiEmpenhoDateMap(contratosApiEmpenhos);
  const totalPlanejado = atividades.reduce((total, atividade) => total + (atividade.valorTotal || 0), 0);
  const totalLiquidadoOficial = empenhosCorrente.reduce(
    (total, empenho) => total + (empenho.valorLiquidadoOficial ?? empenho.valorLiquidado ?? 0),
    0,
  );

  atividades.forEach((atividade) => {
    const date = toValidDate(atividade.createdAt) || toValidDate(atividade.updatedAt);
    if (!date) return;

    getMonthlyBucket(buckets, date);
  });

  empenhosCorrente.forEach((empenho) => {
    const apiDataEmpenho = apiEmpenhoDateMap.get(normalizeEmpenhoNumero(empenho.numero));
    if (apiDataEmpenho) {
      getMonthlyBucket(buckets, apiDataEmpenho).empenhado += empenho.valor || 0;
      return;
    }

    const operacoesComData = (empenho.historicoOperacoes || [])
      .map((operacao) => ({
        date: toValidOperationDate(operacao.data),
        value: getSignedOperationValue(operacao.operacao, Number(operacao.valorTotal) || 0),
      }))
      .filter((operacao): operacao is { date: Date; value: number } => !!operacao.date && operacao.value !== 0);
    const valorOperacoes = operacoesComData.reduce((total, operacao) => total + operacao.value, 0);
    const valorEmpenho = empenho.valor || 0;

    if (operacoesComData.length > 0 && Math.abs(valorOperacoes - valorEmpenho) < 0.01) {
      operacoesComData.forEach((operacao) => {
        getMonthlyBucket(buckets, operacao.date).empenhado += operacao.value;
      });
      return;
    }

    const dataEmpenho = toValidDate(empenho.dataEmpenho);
    if (!dataEmpenho) return;

    getMonthlyBucket(buckets, dataEmpenho).empenhado += empenho.valor || 0;
  });

  const liquidacaoBuckets = new Map<string, { date: Date; valor: number }>();
  const empenhoNumeros = new Set(empenhosCorrente.map((empenho) => normalizeEmpenhoNumero(empenho.numero)));
  const empenhosComLiquidacaoDh = new Set<string>();
  const addLiquidacaoMensal = (date: Date, valor: number) => {
    if (!valor) return;

    const key = monthKey(date);
    const existing = liquidacaoBuckets.get(key);
    if (existing) {
      existing.valor += valor;
      return;
    }

    liquidacaoBuckets.set(key, { date: monthStart(date), valor });
  };

  if (liquidacoesPorEmpenho.length > 0) {
    liquidacoesPorEmpenho.forEach((liquidacao) => {
      if (!empenhoNumeros.has(liquidacao.empenhoNumeroNormalizado)) return;

      const dataLiquidacao = toValidDate(liquidacao.dataEmissao);
      if (!dataLiquidacao) return;

      addLiquidacaoMensal(dataLiquidacao, liquidacao.valor || 0);
      empenhosComLiquidacaoDh.add(liquidacao.empenhoNumeroNormalizado);
    });
  }

  liquidacoesApiPorEmpenho.forEach((liquidacao) => {
    const empenhoNumero = normalizeEmpenhoNumero(liquidacao.empenho_numero);
    if (!empenhoNumeros.has(empenhoNumero) || empenhosComLiquidacaoDh.has(empenhoNumero)) return;

    const dataLiquidacao = toValidDate(liquidacao.data_liquidacao || liquidacao.data_emissao);
    if (!dataLiquidacao) return;

    addLiquidacaoMensal(dataLiquidacao, liquidacao.valor_liquido ?? liquidacao.valor_bruto ?? 0);
  });

  const totalLiquidadoComData = Array.from(liquidacaoBuckets.values()).reduce((total, bucket) => total + bucket.valor, 0);
  const liquidadoScale = totalLiquidadoOficial > 0 && totalLiquidadoComData > 0
    ? totalLiquidadoOficial / totalLiquidadoComData
    : 1;

  liquidacaoBuckets.forEach((bucket) => {
    getMonthlyBucket(buckets, bucket.date).liquidado += bucket.valor * liquidadoScale;
  });

  addEmptyMonthlyBuckets(buckets, options.startDate || null, options.endDate);

  const sortedBuckets = Array.from(buckets.values()).sort((left, right) => left.date.getTime() - right.date.getTime());
  if (sortedBuckets.length > 0 && totalPlanejado > 0) {
    sortedBuckets[0].planejado = totalPlanejado;
  }

  let accPlanejado = 0;
  let accEmpenhado = 0;
  let accLiquidado = 0;

  return sortedBuckets.map((bucket) => {
      accPlanejado += bucket.planejado;
      accEmpenhado += bucket.empenhado;
      accLiquidado += bucket.liquidado;

      return {
        name: format(bucket.date, 'MMM/yy', { locale: ptBR }),
        planejado: accPlanejado,
        empenhado: accEmpenhado,
        liquidado: accLiquidado,
      };
    });
};

export const buildContractExpenseAggregation = (
  contratos: ContratoApiRow[],
  faturas: ContratoApiFaturaRow[],
  options: {
    startDate?: Date | null;
    endDate?: Date | null;
  } = {},
): ContractExpenseAggregation => {
  const contratosById = new Map(contratos.map((contrato) => [contrato.id, contrato]));
  const totalsByContract = new Map<string, number>();
  const buckets = new Map<string, ContractExpenseDataPoint>();

  faturas.forEach((fatura) => {
    const contrato = contratosById.get(fatura.contrato_api_id);
    if (!contrato || !isContratoApiDisplayFatura(fatura)) return;

    const date = toValidDate(fatura.data_emissao);
    const value = getContractExpenseValue(fatura);
    if (!date || value <= 0 || !isDateInsideOptionalRange(date, options.startDate, options.endDate)) return;

    const key = getContractExpenseFieldKey(contrato.id);
    const bucketKey = monthKey(date);
    const bucket =
      buckets.get(bucketKey) ||
      ({
        name: format(monthStart(date), 'MMM/yy', { locale: ptBR }),
        monthKey: bucketKey,
        total: 0,
      } as ContractExpenseDataPoint);

    bucket[key] = Number(bucket[key] || 0) + value;
    bucket.total += value;
    buckets.set(bucketKey, bucket);
    totalsByContract.set(contrato.id, (totalsByContract.get(contrato.id) || 0) + value);
  });

  const optionsList = contratos
    .map((contrato, index) => ({
      id: contrato.id,
      numero: contrato.numero,
      fornecedorNome: contrato.fornecedor_nome || '',
      objeto: contrato.objeto || '',
      total: totalsByContract.get(contrato.id) || 0,
      color: CONTRACT_EXPENSE_COLORS[index % CONTRACT_EXPENSE_COLORS.length],
      label: getContractExpenseLabel(contrato),
    }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));

  const colorByContractId = new Map(optionsList.map((option, index) => [option.id, CONTRACT_EXPENSE_COLORS[index % CONTRACT_EXPENSE_COLORS.length]]));
  const normalizedOptions = optionsList.map((option) => ({
    ...option,
    color: colorByContractId.get(option.id) || option.color,
  }));

  const series = normalizedOptions.map((option) => ({
    contratoId: option.id,
    label: option.label,
    color: option.color,
    dataKey: getContractExpenseFieldKey(option.id),
  }));

  return {
    options: normalizedOptions,
    data: Array.from(buckets.values()).sort((left, right) => left.monthKey.localeCompare(right.monthKey)),
    series,
  };
};

const normalizeEmpenhoRef = (value: string) =>
  (value || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const buildEmpenhoRefKeys = (value: unknown) => {
  const keys = new Set(buildEmpenhoLookupKeys(value));
  const normalized = normalizeEmpenhoRef(String(value ?? ''));
  if (normalized) keys.add(normalized);
  if (normalized.length >= 12) keys.add(normalized.slice(-12));
  return keys;
};

const getSaldoEmpenhoApi = (empenho: ContratoApiEmpenhoRow) => {
  if (isApiRapEmpenho(empenho)) return getApiRapSaldoAtual(empenho);
  const apiBalance = getApiEmpenhoNumber(empenho, 'valor_a_liquidar', 'valoraliquidar');
  if (apiBalance !== undefined) return apiBalance;

  const valorEmpenhado = getContractCommitmentValue(empenho);
  const valorExecutado = Math.max(Number(empenho.valor_liquidado ?? empenho.valor_pago ?? 0) || 0, 0);
  return Math.max(0, valorEmpenhado - valorExecutado);
};

export const buildContractProjectionBullets = (
  contratos: ContratoApiRow[],
  faturas: ContratoApiFaturaRow[],
  empenhos: ContratoApiEmpenhoRow[],
  selectedContratoIds: string[],
  options: {
    startDate: Date;
    endDate: Date;
    today?: Date;
    projectionTargetMonths?: number;
    allowedRenewalContractIds?: string[];
  },
  localData?: {
    empenhos: Empenho[];
    contratos: Contrato[];
    contratosEmpenhos: ContratoEmpenho[];
  },
): ContractProjectionBulletItem[] => {
  const selectedIds = new Set(selectedContratoIds);
  const contratosById = new Map(contratos.map((contrato) => [contrato.id, contrato]));
  const elapsedMonths = countProjectionMonths(options.startDate, options.endDate, options.today);
  const liquidadoByContrato = new Map<string, number>();
  const empenhadoByContrato = new Map<string, number>();
  const liquidacoesByContrato = new Map<string, ContractProjectionLiquidacaoTrace[]>();
  const empenhosByContrato = new Map<string, ContractProjectionEmpenhoTrace[]>();

  faturas.forEach((fatura) => {
    if (!selectedIds.has(fatura.contrato_api_id) || !isContratoApiDisplayFatura(fatura)) return;

    const date = toValidDate(fatura.data_emissao);
    const value = getContractExpenseValue(fatura);
    if (
      !date ||
      value <= 0 ||
      !isDateInsideOptionalRange(date, options.startDate, options.endDate) ||
      getContractExpenseStatus(fatura.situacao) !== 'executado'
    ) {
      return;
    }

    liquidadoByContrato.set(fatura.contrato_api_id, (liquidadoByContrato.get(fatura.contrato_api_id) || 0) + value);
    const currentLiquidacoes = liquidacoesByContrato.get(fatura.contrato_api_id) || [];
    currentLiquidacoes.push({
      id: fatura.id,
      numeroInstrumento: fatura.numero_instrumento_cobranca || 'Sem instrumento',
      situacao: fatura.situacao || 'Sem situacao',
      dataEmissao: fatura.data_emissao,
      dataPagamento: fatura.data_pagamento,
      valor: value,
    });
    liquidacoesByContrato.set(fatura.contrato_api_id, currentLiquidacoes);
  });

  empenhos.forEach((empenho) => {
    if (!selectedIds.has(empenho.contrato_api_id)) return;

    const value = getContractCommitmentValue(empenho);
    if (value <= 0) return;

    empenhadoByContrato.set(empenho.contrato_api_id, (empenhadoByContrato.get(empenho.contrato_api_id) || 0) + value);
    const balance = getContractCommitmentBalanceTrace(empenho);
    const currentEmpenhos = empenhosByContrato.get(empenho.contrato_api_id) || [];
    currentEmpenhos.push({
      id: empenho.id,
      numero: empenho.numero || 'Sem numero',
      dataEmissao: empenho.data_emissao,
      valorEmpenhado: value,
      valorLiquidado: Math.max(Number(empenho.valor_liquidado) || 0, 0),
      valorPago: Math.max(Number(empenho.valor_pago) || 0, 0),
      saldo: balance.saldo,
      saldoFonte: balance.saldoFonte,
    });
    empenhosByContrato.set(empenho.contrato_api_id, currentEmpenhos);
  });

  return selectedContratoIds
    .map((contratoId) => {
      const contrato = contratosById.get(contratoId);
      if (!contrato) return null;

      const liquidado = liquidadoByContrato.get(contratoId) || 0;
      const liquidacoes = (liquidacoesByContrato.get(contratoId) || []).sort((left, right) =>
        String(right.dataEmissao || '').localeCompare(String(left.dataEmissao || '')),
      );

      let valorTotal = 0;
      if (localData) {
        // Find corresponding local contract
        const localContrato = localData.contratos.find((c) => {
          if (shouldIgnoreContratoNumero(c.numero)) return false;
          return normalizeContratoNumero(c.numero) === normalizeContratoNumero(contrato.numero);
        });
        valorTotal = localContrato?.valor ?? contrato.valor_acumulado ?? contrato.valor_global ?? 0;
      } else {
        valorTotal = contrato.valor_acumulado ?? contrato.valor_global ?? 0;
      }

      const targetMonths = options.projectionTargetMonths ?? 12;
      const isRenewalAllowed = options.allowedRenewalContractIds?.includes(contratoId) ?? false;
      const rawProjetado = elapsedMonths > 0 ? (liquidado / elapsedMonths) * targetMonths : liquidado;
      const isCapped = valorTotal > 0 && rawProjetado > valorTotal;
      let projetado = rawProjetado;
      if (valorTotal > 0 && !isRenewalAllowed) {
        projetado = Math.min(rawProjetado, valorTotal);
      }

      const vigenciaFimStr = contrato.vigencia_fim_derivada ?? contrato.vigencia_fim;
      let exceedsValiditySugestion = false;
      if (vigenciaFimStr) {
        const vigenciaFim = toValidDate(vigenciaFimStr);
        if (vigenciaFim && options.endDate.getTime() > vigenciaFim.getTime()) {
          exceedsValiditySugestion = true;
        }
      }

      let empenhosTrace: ContractProjectionEmpenhoTrace[] = [];
      let empenhado = 0;
      let saldoEmpenhos = 0;

      if (localData) {
        // Find corresponding local contract
        const localContrato = localData.contratos.find((c) => {
          if (shouldIgnoreContratoNumero(c.numero)) return false;
          return normalizeContratoNumero(c.numero) === normalizeContratoNumero(contrato.numero);
        });

        // 1. Build localEmpenhoByLookupKey
        const localEmpenhoByLookupKey = new Map<string, Empenho>();
        for (const empenho of localData.empenhos) {
          for (const key of buildEmpenhoRefKeys(empenho.numero)) {
            if (!localEmpenhoByLookupKey.has(key)) {
              localEmpenhoByLookupKey.set(key, empenho);
            }
          }
        }

        // 2. Find linked local empenhos
        const empenhosVinculados: Empenho[] = [];
        if (localContrato) {
          const linkIds = localData.contratosEmpenhos
            .filter((l) => l.contrato_id === localContrato.id)
            .map((l) => l.empenho_id);

          const byId = new Map(localData.empenhos.map((e) => [e.id, e] as const));
          const byNumero = new Map(localData.empenhos.map((e) => [e.numero, e] as const));
          const seen = new Set<string>();

          for (const ref of linkIds) {
            const refStr = (ref || '').toString().trim();
            const emp =
              byId.get(refStr) ||
              byNumero.get(refStr) ||
              Array.from(buildEmpenhoRefKeys(refStr))
                .map((key) => localEmpenhoByLookupKey.get(key))
                .find(Boolean);
            if (!emp) continue;
            if (seen.has(emp.id)) continue;
            seen.add(emp.id);
            empenhosVinculados.push(emp);
          }
        }

        // 3. Find API empenhos that are only API
        const localEmpenhosKeys = new Set(empenhosVinculados.flatMap((e) => Array.from(buildEmpenhoRefKeys(e.numero))));
        const apiEmpenhosForThisContrato = empenhos.filter(e => e.contrato_api_id === contratoId);

        const empenhosApiSomente = apiEmpenhosForThisContrato.filter((empenhoApi) => {
          if (!empenhoApi.numero) return true;
          const apiKeys = Array.from(buildEmpenhoRefKeys(empenhoApi.numero));
          return apiKeys.length === 0 || !apiKeys.some((key) => localEmpenhosKeys.has(key));
        });

        // 4. Define local calculations helpers
        const rapReferenceYear = getRapReferenceYear(localData.empenhos);

        const getSaldoEmpenhoLocal = (emp: Empenho) => {
          if (emp.tipo === 'rap') return getRapSaldoAtual(emp, rapReferenceYear);
          const liquidadoVal = (emp.valorLiquidadoAPagar || 0) + (emp.valorPagoOficial || 0);
          return Math.max(0, emp.valor - liquidadoVal);
        };

        const getLocalEmpenhoForApi = (empApi: ContratoApiEmpenhoRow) => {
          for (const key of buildEmpenhoRefKeys(empApi.numero)) {
            const local = localEmpenhoByLookupKey.get(key);
            if (local) return local;
          }
          return undefined;
        };

        const getSaldoEmpenhoApiPreferLocal = (empApi: ContratoApiEmpenhoRow) => {
          const local = getLocalEmpenhoForApi(empApi);
          return local ? getSaldoEmpenhoLocal(local) : getSaldoEmpenhoApi(empApi);
        };

        // 5. Build empenhosTrace
        const mappedVinculados: ContractProjectionEmpenhoTrace[] = empenhosVinculados.map((e) => ({
          id: e.id,
          numero: e.numero,
          dataEmissao: e.dataEmpenho ? new Date(e.dataEmpenho).toISOString() : null,
          valorEmpenhado: e.valor,
          valorPago: e.valorPagoOficial ?? 0,
          valorLiquidado: e.valorLiquidadoAPagar ?? 0,
          saldo: getSaldoEmpenhoLocal(e),
          saldoFonte: 'calculado',
        }));

        const mappedApiSomente: ContractProjectionEmpenhoTrace[] = empenhosApiSomente.map((empenhoApi) => {
          const val = getContractCommitmentValue(empenhoApi);
          const hasLocal = getLocalEmpenhoForApi(empenhoApi);
          return {
            id: empenhoApi.id,
            numero: empenhoApi.numero || 'Sem numero',
            dataEmissao: empenhoApi.data_emissao,
            valorEmpenhado: val,
            valorPago: Math.max(Number(empenhoApi.valor_pago) || 0, 0),
            valorLiquidado: Math.max(Number(empenhoApi.valor_liquidado) || 0, 0),
            saldo: getSaldoEmpenhoApiPreferLocal(empenhoApi),
            saldoFonte: hasLocal ? 'calculado' : 'api',
          };
        });

        empenhosTrace = [...mappedVinculados, ...mappedApiSomente].sort((left, right) =>
          String(right.dataEmissao || '').localeCompare(String(left.dataEmissao || '')),
        );

        empenhado =
          empenhosVinculados.reduce((sum, e) => sum + (e.valor || 0), 0) +
          empenhosApiSomente.reduce((sum, e) => sum + getContractCommitmentValue(e), 0);

        saldoEmpenhos =
          empenhosVinculados.reduce((sum, e) => sum + getSaldoEmpenhoLocal(e), 0) +
          empenhosApiSomente.reduce((sum, e) => sum + getSaldoEmpenhoApiPreferLocal(e), 0);
      } else {
        empenhosTrace = (empenhosByContrato.get(contratoId) || []).sort((left, right) =>
          String(right.dataEmissao || '').localeCompare(String(left.dataEmissao || '')),
        );
        empenhado = empenhadoByContrato.get(contratoId) || 0;
        const saldoApi = empenhosTrace.reduce((sum, empenho) => sum + empenho.saldo, 0);
        saldoEmpenhos = empenhosTrace.length > 0 ? saldoApi : Math.max(0, empenhado - liquidado);
      }

      const gastoMensalMedio = elapsedMonths > 0 ? liquidado / elapsedMonths : 0;
      let coberturaMes: string | null = null;
      if (gastoMensalMedio > 0) {
        const totalMeses = (liquidado + saldoEmpenhos) / gastoMensalMedio;
        const targetDate = addMonths(options.startDate, Math.max(0, totalMeses - 0.001));
        const mes = format(targetDate, 'MMMM', { locale: ptBR });
        const ano = format(targetDate, 'yy', { locale: ptBR });
        coberturaMes = `${mes.charAt(0).toUpperCase() + mes.slice(1)}/${ano}`;
      } else {
        coberturaMes = saldoEmpenhos > 0 ? 'Ilimitada' : 'Nenhuma';
      }

      const necessidadeEmpenho = Math.max(0, projetado - (liquidado + saldoEmpenhos));

      return {
        id: contratoId,
        label: getContractExpenseLabel(contrato),
        color: CONTRACT_EXPENSE_COLORS[selectedContratoIds.indexOf(contratoId) % CONTRACT_EXPENSE_COLORS.length],
        empenhado,
        liquidado,
        projetado,
        saldoEmpenhos,
        mesesConsiderados: elapsedMonths,
        percentualLiquidado: saldoEmpenhos > 0 ? (liquidado / saldoEmpenhos) * 100 : 0,
        percentualProjetado: saldoEmpenhos > 0 ? (projetado / saldoEmpenhos) * 100 : 0,
        liquidacoes,
        empenhos: empenhosTrace,
        coberturaMes,
        necessidadeEmpenho,
        isCapped,
        isRenewalAllowed,
        valorTotalContrato: valorTotal,
        exceedsValiditySugestion,
        vigenciaFim: vigenciaFimStr,
        categoria: contrato.categoria || null,
        prorrogavel: contrato.prorrogavel || null,
        objeto: contrato.objeto || null,
      };
    })
    .filter((item): item is ContractProjectionBulletItem => Boolean(item))
    .filter((item) => item.saldoEmpenhos > 0 || item.liquidado > 0 || item.projetado > 0);
};

const EMPTY_ARRAY: any[] = [];

export default function Dashboard() {
  const { atividades, empenhos, contratos, contratosEmpenhos, descentralizacoes, contaDescentralizacoes, isLoading } = useData();
  const [hoveredBudgetDimension, setHoveredBudgetDimension] = useState<string | null>(null);
  const [selectedBudgetDimensionCode, setSelectedBudgetDimensionCode] = useState<string | null>(null);
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'corrente' | 'contratos' | 'rap'>('corrente');
  const [selectedContractExpenseIds, setSelectedContractExpenseIds] = useState<string[]>([]);
  const [contractExpenseSelectionTouched, setContractExpenseSelectionTouched] = useState(false);
  const [projectionTargetMonths, setProjectionTargetMonths] = useState(12);
  const [contractsWithRenewalAllowed, setContractsWithRenewalAllowed] = useState<string[]>([]);
  const isContractExecutionTabActive = activeTab === 'contratos';

  const effectiveFilterDimensao = useMemo(() => {
    if (filterDimensao === 'all') return 'all';
    return extractDimensionCode(filterDimensao) || 'all';
  }, [filterDimensao]);

  useEffect(() => {
    if (filterDimensao !== 'all' && effectiveFilterDimensao === 'all') {
      setFilterDimensao('all');
    }
  }, [filterDimensao, effectiveFilterDimensao]);

  const origensDisponiveis = useMemo(() => {
    const origens = new Set<string>();

    atividades.forEach((atividade) => {
      if (atividade.origemRecurso) origens.add(atividade.origemRecurso);
    });
    empenhos.forEach((empenho) => {
      if (empenho.origemRecurso) origens.add(empenho.origemRecurso);
    });
    descentralizacoes.forEach((descentralizacao) => {
      if (descentralizacao.origemRecurso) origens.add(descentralizacao.origemRecurso);
    });
    contaDescentralizacoes.forEach((saldo) => {
      if (saldo.ptres) origens.add(saldo.ptres);
    });
    return Array.from(origens).sort();
  }, [atividades, empenhos, descentralizacoes, contaDescentralizacoes]);

  const filteredData = useMemo(() => {
    const filteredAtividades = atividades.filter((atividade) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: atividade.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || atividade.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem;
    });

    const empenhosCorrente = empenhos.filter((empenho) => empenho.tipo === 'exercicio');
    const empenhosRap = empenhos.filter((empenho) => empenho.tipo === 'rap');

    const matchDateRange = (data: string) => {
      if (!dateStart || !dateEnd) return true;

      const start = startOfDay(parseISO(dateStart));
      const end = endOfDay(parseISO(dateEnd));

      return isWithinInterval(new Date(data), { start, end });
    };

    const filteredEmpenhosCorrente = empenhosCorrente.filter((empenho) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: empenho.dimensao,
        planInternal: empenho.planoInterno,
        description: empenho.descricao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || empenho.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem && matchDateRange(empenho.dataEmpenho) && empenho.status !== 'cancelado';
    });

    const filteredEmpenhosRap = empenhosRap.filter((empenho) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: empenho.dimensao,
        planInternal: empenho.planoInterno,
        description: empenho.descricao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || empenho.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem && matchDateRange(empenho.dataEmpenho) && empenho.status !== 'cancelado';
    });

    const filteredDescentralizacoes = descentralizacoes.filter((descentralizacao) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: descentralizacao.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || descentralizacao.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem;
    });

    return {
      atividades: filteredAtividades,
      empenhosCorrente: filteredEmpenhosCorrente,
      empenhosRap: filteredEmpenhosRap,
      descentralizacoes: filteredDescentralizacoes,
    };
  }, [atividades, empenhos, descentralizacoes, effectiveFilterDimensao, filterOrigem, dateStart, dateEnd]);

  const resumoDescentralizacoes = useMemo(
    () =>
      buildDescentralizacaoSummaryRows({
        descentralizacoes,
        contaSaldos: contaDescentralizacoes,
      }),
    [descentralizacoes, contaDescentralizacoes],
  );

  const totalDescentralizado = getFilteredDescentralizacaoSummaryTotal({
    rows: resumoDescentralizacoes,
    filterDimensao: effectiveFilterDimensao,
    filterOrigem,
  });

  const totalPlanejado = filteredData.atividades.reduce((total, atividade) => total + atividade.valorTotal, 0);
  const totalEmpenhado = filteredData.empenhosCorrente.reduce((total, empenho) => total + empenho.valor, 0);
  const aDescentralizar = totalPlanejado - totalDescentralizado;
  const percentualExecutado = totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0;
  const totalLiquidado = filteredData.empenhosCorrente.reduce(
    (total, empenho) => total + (empenho.valorLiquidadoOficial ?? empenho.valorLiquidado ?? 0),
    0,
  );
  const totalPago = filteredData.empenhosCorrente.reduce(
    (total, empenho) => total + (empenho.valorPagoOficial ?? empenho.valorPago ?? 0),
    0,
  );

  const rapReferenceYear = useMemo(() => getRapReferenceYear(empenhos), [empenhos]);

  const rapTotalInscrito = filteredData.empenhosRap.reduce((total, empenho) => {
    if (isRapReinscrito(empenho, rapReferenceYear)) return total;
    return total + getRapBaseVigente(empenho, rapReferenceYear);
  }, 0);
  const rapTotalReinscrito = filteredData.empenhosRap.reduce((total, empenho) => {
    if (!isRapReinscrito(empenho, rapReferenceYear)) return total;
    return total + getRapBaseVigente(empenho, rapReferenceYear);
  }, 0);
  const rapTotalLiquidadoNoAno = filteredData.empenhosRap.reduce(
    (total, empenho) => total + getRapLiquidadoNoAno(empenho),
    0,
  );
  const rapTotalSaldoAtual = filteredData.empenhosRap.reduce(
    (total, empenho) => total + getRapSaldoAtual(empenho, rapReferenceYear),
    0,
  );

  const dadosPorOrigem = useMemo(() => {
    const map = new Map<string, { planejado: number; empenhado: number }>();

    filteredData.atividades.forEach((atividade) => {
      const item = map.get(atividade.origemRecurso) || { planejado: 0, empenhado: 0 };
      item.planejado += atividade.valorTotal;
      map.set(atividade.origemRecurso, item);
    });

    filteredData.empenhosCorrente.forEach((empenho) => {
      const item = map.get(empenho.origemRecurso) || { planejado: 0, empenhado: 0 };
      item.empenhado += empenho.valor;
      map.set(empenho.origemRecurso, item);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        planejado: values.planejado,
        empenhado: values.empenhado,
        saldo: values.planejado - values.empenhado,
        percentual: values.planejado > 0 ? (values.empenhado / values.planejado) * 100 : 0,
      }))
      .filter((item) => item.planejado > 0 || item.empenhado > 0)
      .sort((a, b) => b.planejado - a.planejado);
  }, [filteredData]);

  const dadosPorNatureza = useMemo(() => {
    const map = new Map<string, number>();

    filteredData.empenhosCorrente.forEach((empenho) => {
      const natureza = empenho.naturezaDespesa.split(' - ')[0];
      map.set(natureza, (map.get(natureza) || 0) + empenho.valor);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filteredData]);

  const empenhoNumerosCorrente = useMemo(
    () => Array.from(new Set(filteredData.empenhosCorrente.map((empenho) => normalizeEmpenhoNumero(empenho.numero)).filter(Boolean))).sort(),
    [filteredData.empenhosCorrente],
  );

  const { data: liquidacoesPorEmpenho = EMPTY_ARRAY } = useQuery({
    queryKey: ['dashboard-liquidacoes-por-empenho', empenhoNumerosCorrente],
    queryFn: () => transparenciaService.getLiquidacoesPorEmpenhos(empenhoNumerosCorrente),
    enabled: empenhoNumerosCorrente.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: contratosApiEmpenhos = EMPTY_ARRAY } = useQuery({
    queryKey: ['dashboard-contratos-api-empenhos'],
    queryFn: async () => {
      try {
        return await contratosApiService.getEmpenhosApi();
      } catch {
        return EMPTY_ARRAY;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: liquidacoesApiPorEmpenho = EMPTY_ARRAY } = useQuery({
    queryKey: ['dashboard-contratos-api-liquidacoes', empenhoNumerosCorrente],
    queryFn: async () => {
      try {
        const rows = await Promise.all(
          empenhoNumerosCorrente.map((numero) => contratosApiService.getLiquidacoesPublicasPorEmpenho(numero)),
        );
        return rows.flat();
      } catch {
        return EMPTY_ARRAY;
      }
    },
    enabled: empenhoNumerosCorrente.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: contratosApiAtivos = EMPTY_ARRAY, isLoading: isContratosApiAtivosLoading = false } = useQuery({
    queryKey: ['dashboard-contratos-api-ativos'],
    queryFn: async () => {
      try {
        return await contratosApiService.getContratosApi(true);
      } catch {
        return EMPTY_ARRAY;
      }
    },
    enabled: isContractExecutionTabActive,
    staleTime: 5 * 60 * 1000,
  });

  const contratosApiAtivosIds = useMemo(
    () => contratosApiAtivos.map((contrato) => contrato.id),
    [contratosApiAtivos],
  );

  const contractExpensePeriod = useMemo(() => {
    const currentYearPeriod = getCurrentYearExpensePeriod();
    const startDate = dateStart || currentYearPeriod.startDate;
    const endDate = dateEnd || currentYearPeriod.endDate;

    if (startDate > endDate) {
      return { startDate: endDate, endDate: startDate };
    }

    return { startDate, endDate };
  }, [dateStart, dateEnd]);

  // Keep projectionTargetMonths in sync with contractExpensePeriod date range
  useEffect(() => {
    const start = parseISO(contractExpensePeriod.startDate);
    const end = parseISO(contractExpensePeriod.endDate);
    const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
    const target = months > 0 ? months : 12;
    setProjectionTargetMonths((prev) => (prev === target ? prev : target));
  }, [contractExpensePeriod]);

  const { data: contratosApiFaturas = EMPTY_ARRAY, isLoading: isContractExpenseLoading = false } = useQuery({
    queryKey: ['dashboard-contratos-api-faturas', contratosApiAtivosIds, contractExpensePeriod.startDate, contractExpensePeriod.endDate],
    queryFn: async () => {
      try {
        return await contratosApiService.getFaturasApi(contratosApiAtivosIds, {
          dataEmissaoInicio: contractExpensePeriod.startDate,
          dataEmissaoFim: contractExpensePeriod.endDate,
        });
      } catch {
        return EMPTY_ARRAY;
      }
    },
    enabled: isContractExecutionTabActive && contratosApiAtivosIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const contractExpenseAggregation = useMemo(
    () =>
      buildContractExpenseAggregation(contratosApiAtivos, contratosApiFaturas, {
        startDate: parseISO(contractExpensePeriod.startDate),
        endDate: parseISO(contractExpensePeriod.endDate),
      }),
    [contratosApiAtivos, contratosApiFaturas, contractExpensePeriod],
  );

  const contractExpenseTopIds = useMemo(() => {
    return EMPTY_ARRAY;
  }, []);

  useEffect(() => {
    const availableIds = new Set(contractExpenseAggregation.options.map((option) => option.id));

    setSelectedContractExpenseIds((currentIds) => {
      if (!contractExpenseSelectionTouched) {
        const isSame =
          currentIds.length === contractExpenseTopIds.length &&
          currentIds.every((id, index) => id === contractExpenseTopIds[index]);
        if (isSame) {
          return currentIds;
        }
        return contractExpenseTopIds;
      }

      const filteredIds = currentIds.filter((id) => availableIds.has(id));
      const isSame =
        currentIds.length === filteredIds.length &&
        currentIds.every((id, index) => id === filteredIds[index]);
      if (isSame) {
        return currentIds;
      }
      return filteredIds;
    });
  }, [contractExpenseAggregation.options, contractExpenseSelectionTouched, contractExpenseTopIds]);

  const selectedContractExpenseSet = useMemo(
    () => new Set(selectedContractExpenseIds),
    [selectedContractExpenseIds],
  );

  const selectedContractExpenseSeries = useMemo(
    () => contractExpenseAggregation.series.filter((serie) => selectedContractExpenseSet.has(serie.contratoId)),
    [contractExpenseAggregation.series, selectedContractExpenseSet],
  );

  const selectedContractExpenseData = useMemo(() => {
    if (selectedContractExpenseSeries.length === 0) return [];

    const selectedKeys = new Set(
      selectedContractExpenseSeries.map((serie) => serie.dataKey),
    );

    return contractExpenseAggregation.data
      .map((bucket) => {
        const nextBucket: ContractExpenseDataPoint = {
          name: bucket.name,
          monthKey: bucket.monthKey,
          total: 0,
        };

        selectedKeys.forEach((key) => {
          const value = Number(bucket[key] || 0);
          nextBucket[key] = value;
          nextBucket.total += value;
        });

        return nextBucket;
      })
      .filter((bucket) => bucket.total > 0);
  }, [contractExpenseAggregation.data, selectedContractExpenseSeries]);

  const selectedContractProjectionBullets = useMemo(
    () =>
      buildContractProjectionBullets(
        contratosApiAtivos,
        contratosApiFaturas,
        contratosApiEmpenhos,
        selectedContractExpenseIds,
        {
          startDate: parseISO(contractExpensePeriod.startDate),
          endDate: parseISO(contractExpensePeriod.endDate),
          projectionTargetMonths,
          allowedRenewalContractIds: contractsWithRenewalAllowed,
        },
        {
          empenhos,
          contratos,
          contratosEmpenhos,
        },
      ),
    [
      contratosApiAtivos,
      contratosApiFaturas,
      contratosApiEmpenhos,
      selectedContractExpenseIds,
      contractExpensePeriod,
      empenhos,
      contratos,
      contratosEmpenhos,
      projectionTargetMonths,
      contractsWithRenewalAllowed,
    ],
  );

  const allContractProjectionBullets = useMemo(
    () =>
      buildContractProjectionBullets(
        contratosApiAtivos,
        contratosApiFaturas,
        contratosApiEmpenhos,
        contratosApiAtivosIds,
        {
          startDate: parseISO(contractExpensePeriod.startDate),
          endDate: parseISO(contractExpensePeriod.endDate),
          projectionTargetMonths,
          allowedRenewalContractIds: contractsWithRenewalAllowed,
        },
        {
          empenhos,
          contratos,
          contratosEmpenhos,
        },
      ),
    [
      contratosApiAtivos,
      contratosApiFaturas,
      contratosApiEmpenhos,
      contratosApiAtivosIds,
      contractExpensePeriod,
      empenhos,
      contratos,
      contratosEmpenhos,
      projectionTargetMonths,
      contractsWithRenewalAllowed,
    ],
  );

  const toggleContractExpenseSelection = (contratoId: string) => {
    setContractExpenseSelectionTouched(true);
    setSelectedContractExpenseIds((currentIds) =>
      currentIds.includes(contratoId)
        ? currentIds.filter((id) => id !== contratoId)
        : [...currentIds, contratoId],
    );
  };

  const dadosMensais = useMemo(
    () =>
      buildDadosMensais(filteredData.atividades, filteredData.empenhosCorrente, liquidacoesPorEmpenho, liquidacoesApiPorEmpenho, contratosApiEmpenhos, {
        startDate: dateStart ? parseISO(dateStart) : null,
        endDate: dateEnd ? parseISO(dateEnd) : new Date(),
      }),
    [filteredData.atividades, filteredData.empenhosCorrente, liquidacoesPorEmpenho, liquidacoesApiPorEmpenho, contratosApiEmpenhos, dateStart, dateEnd],
  );

  const budgetTreemapData = useMemo(() => {
    const dimensionPalette = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];
    const dimensionMap = new Map<string, Record<string, string | number>>();

    filteredData.atividades.forEach((atividade) => {
      const dimensao = atividade.dimensao || 'Sem Dimensao';
      const componente = atividade.componenteFuncional?.trim();

      if (!componente || componente.toLowerCase() === 'sem componente') return;

      const dimensionItem = dimensionMap.get(dimensao) || { name: dimensao };
      dimensionItem[componente] = ((dimensionItem[componente] as number) || 0) + atividade.valorTotal;
      dimensionMap.set(dimensao, dimensionItem);
    });

    return Array.from(dimensionMap.values())
      .map((dimension, index) => {
        const fill = dimensionPalette[index % dimensionPalette.length];
        const entries = Object.entries(dimension).filter(([key]) => key !== 'name');
        const total = entries.reduce((sum, [, value]) => sum + (value as number), 0);

        return {
          name: dimension.name as string,
          dimensionCode: extractDimensionCode(dimension.name as string) || '',
          value: total,
          fill,
          textColor: getReadableTextColor(fill),
          nodeType: 'dimensao',
          children: entries
            .map(([componente, valor], componentIndex) => {
              const componentFill = mixHexColors(
                fill,
                '#ffffff',
                entries.length === 1 ? 0.12 : 0.12 + (componentIndex / Math.max(entries.length - 1, 1)) * 0.38,
              );

              return {
                name: componente,
                dimensionCode: extractDimensionCode(dimension.name as string) || '',
                value: valor as number,
                fill: componentFill,
                textColor: getReadableTextColor(componentFill),
                nodeType: 'componente',
                parentName: dimension.name as string,
              };
            })
            .sort((a, b) => (b.value || 0) - (a.value || 0)),
        };
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [filteredData]);

  const filteredBudgetDimension = useMemo(() => {
    if (effectiveFilterDimensao === 'all') return null;

    return (
      budgetTreemapData.find((item) => item.dimensionCode === effectiveFilterDimensao)?.name ||
      getDimensionLabel(effectiveFilterDimensao) ||
      null
    );
  }, [budgetTreemapData, effectiveFilterDimensao]);

  const selectedBudgetDimension = useMemo(() => {
    if (!selectedBudgetDimensionCode) return null;

    return (
      budgetTreemapData.find((item) => item.dimensionCode === selectedBudgetDimensionCode)?.name ||
      getDimensionLabel(selectedBudgetDimensionCode) ||
      null
    );
  }, [budgetTreemapData, selectedBudgetDimensionCode]);

  const activeBudgetDimension = selectedBudgetDimension || filteredBudgetDimension;
  const highlightedBudgetDimension = hoveredBudgetDimension || activeBudgetDimension;

  const handleBudgetDimensionSelect = (dimensionValue?: string | null) => {
    const nextValue = extractDimensionCode(dimensionValue) || 'all';
    if (nextValue === 'all') return;

    setSelectedBudgetDimensionCode((currentValue) => (currentValue === nextValue ? null : nextValue));
    setHoveredBudgetDimension(null);
  };

  const { dadosDescentralizacao, uniqueOrigens } = useMemo(() => {
    const dimensionMap = new Map<string, Record<string, string | number>>();
    const origemSet = new Set<string>();

    resumoDescentralizacoes.forEach((descentralizacao) => {
      const matchesDimensao = matchesDimensionFilter({
        dimensionValue: descentralizacao.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchesOrigem = filterOrigem === 'all' || descentralizacao.origemRecurso === filterOrigem;

      if (!matchesDimensao || !matchesOrigem) return;

      const dimensao = descentralizacao.dimensao || 'Sem Dimensao';
      const origem = descentralizacao.origemRecurso || 'Sem Origem';

      origemSet.add(origem);

      const dimensionItem = dimensionMap.get(dimensao) || { name: dimensao };
      dimensionItem[origem] = ((dimensionItem[origem] as number) || 0) + descentralizacao.valor;
      dimensionMap.set(dimensao, dimensionItem);
    });

    return {
      dadosDescentralizacao: Array.from(dimensionMap.values()).sort((left, right) => {
        const totalLeft = Object.entries(left)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);
        const totalRight = Object.entries(right)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);

        return totalRight - totalLeft;
      }),
      uniqueOrigens: Array.from(origemSet).sort(),
    };
  }, [resumoDescentralizacoes, effectiveFilterDimensao, filterOrigem]);

  const dadosRapPorOrigem = useMemo(() => {
    const map = new Map<string, { baseVigente: number; liquidadoNoAno: number; saldoAtual: number }>();

    filteredData.empenhosRap.forEach((empenho) => {
      const origem = empenho.origemRecurso || 'Sem origem';
      const item = map.get(origem) || { baseVigente: 0, liquidadoNoAno: 0, saldoAtual: 0 };

      item.baseVigente += getRapBaseVigente(empenho, rapReferenceYear);
      item.liquidadoNoAno += getRapLiquidadoNoAno(empenho);
      item.saldoAtual += getRapSaldoAtual(empenho, rapReferenceYear);

      map.set(origem, item);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        baseVigente: values.baseVigente,
        liquidadoNoAno: values.liquidadoNoAno,
        saldoAtual: values.saldoAtual,
        percentual: values.baseVigente > 0 ? (values.liquidadoNoAno / values.baseVigente) * 100 : 0,
      }))
      .filter((item) => item.baseVigente > 0)
      .sort((a, b) => b.saldoAtual - a.saldoAtual);
  }, [filteredData, rapReferenceYear]);

  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterOrigem('all');
    setDateStart('');
    setDateEnd('');
    setHoveredBudgetDimension(null);
    setSelectedBudgetDimensionCode(null);
  };

  const hasActiveFilters =
    filterDimensao !== 'all' || filterOrigem !== 'all' || dateStart !== '' || dateEnd !== '';
  const activeFiltersCount = [filterDimensao !== 'all', filterOrigem !== 'all', dateStart !== '' || dateEnd !== ''].filter(Boolean).length;
  const activeDimensionLabel = getDimensionLabel(effectiveFilterDimensao);

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'corrente' | 'contratos' | 'rap')}
      >
        <HeaderActions>
          <div className="hidden h-9 items-center gap-2 md:flex">
            <TabsList className="h-8 rounded-lg border border-border-default/60 bg-surface-card p-0.5 shadow-sm sm:h-9">
              <TabsTrigger
                value="corrente"
                className="h-7 rounded-md px-3 text-[11px] font-semibold text-slate-600 transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white sm:h-8 sm:px-4 sm:text-xs"
              >
                Orçamento
              </TabsTrigger>
              <TabsTrigger
                value="rap"
                className="h-7 rounded-md px-3 text-[11px] font-semibold text-slate-600 transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white sm:h-8 sm:px-4 sm:text-xs"
              >
                RAP
              </TabsTrigger>
              <TabsTrigger
                value="contratos"
                className="h-7 rounded-md px-3 text-[11px] font-semibold text-slate-600 transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white sm:h-8 sm:px-4 sm:text-xs"
              >
                Contratos
              </TabsTrigger>
            </TabsList>

            <DashboardFiltersSheet
              buttonClassName="relative h-8 gap-2 border-border-default bg-surface-card text-xs text-text-primary shadow-sm transition-all hover:bg-surface-subtle sm:h-9 sm:text-sm"
              filterDimensao={filterDimensao}
              filterOrigem={filterOrigem}
              dateStart={dateStart}
              dateEnd={dateEnd}
              origensDisponiveis={origensDisponiveis}
              hasActiveFilters={hasActiveFilters}
              activeFiltersCount={activeFiltersCount}
              onFilterDimensaoChange={setFilterDimensao}
              onFilterOrigemChange={setFilterOrigem}
              onDateStartChange={setDateStart}
              onDateEndChange={setDateEnd}
              onClearFilters={clearFilters}
            />
          </div>
        </HeaderActions>

        <div className="mb-2 flex flex-col items-start gap-4 md:hidden sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-auto flex-wrap rounded-lg bg-slate-100 p-1">
            <TabsTrigger
              value="corrente"
              className="rounded-md px-6 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Orçamento
            </TabsTrigger>
            <TabsTrigger
              value="rap"
              className="rounded-md px-6 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              RAP
            </TabsTrigger>
            <TabsTrigger
              value="contratos"
              className="rounded-md px-6 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Contratos
            </TabsTrigger>
          </TabsList>

          <DashboardFiltersSheet
            buttonClassName="relative gap-2 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            filterDimensao={filterDimensao}
            filterOrigem={filterOrigem}
            dateStart={dateStart}
            dateEnd={dateEnd}
            origensDisponiveis={origensDisponiveis}
            hasActiveFilters={hasActiveFilters}
            activeFiltersCount={activeFiltersCount}
            onFilterDimensaoChange={setFilterDimensao}
            onFilterOrigemChange={setFilterOrigem}
            onDateStartChange={setDateStart}
            onDateEndChange={setDateEnd}
            onClearFilters={clearFilters}
          />
        </div>

        {activeTab !== 'contratos' && activeDimensionLabel ? (
          <div className="mb-6 flex items-center gap-3">
            <Badge
              variant="secondary"
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-ui text-xs font-semibold text-primary"
            >
              Dimensao ativa: {activeDimensionLabel}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-muted hover:text-text-primary"
              onClick={() => setFilterDimensao('all')}
            >
              Limpar selecao
            </Button>
          </div>
        ) : null}

        <TabsContent value="corrente" className="mt-0 space-y-6 border-none p-0">
          <DashboardCurrentTab
            isLoading={isLoading}
            filteredData={filteredData}
            totalPlanejado={totalPlanejado}
            totalEmpenhado={totalEmpenhado}
            totalDescentralizado={totalDescentralizado}
            aDescentralizar={aDescentralizar}
            percentualExecutado={percentualExecutado}
            totalLiquidado={totalLiquidado}
            totalPago={totalPago}
            dadosPorOrigem={dadosPorOrigem}
            dadosMensais={dadosMensais}
            budgetTreemapData={budgetTreemapData}
            activeBudgetDimension={activeBudgetDimension}
            highlightedBudgetDimension={highlightedBudgetDimension}
            hoveredBudgetDimension={hoveredBudgetDimension}
            onHoverBudgetDimension={setHoveredBudgetDimension}
            onSelectBudgetDimension={handleBudgetDimensionSelect}
            dadosDescentralizacao={dadosDescentralizacao}
            uniqueOrigens={uniqueOrigens}
            dadosPorNatureza={dadosPorNatureza}
          />
        </TabsContent>

        <TabsContent value="rap" className="mt-0 space-y-6 border-none p-0">
          <DashboardRapTab
            isLoading={isLoading}
            rapTotalInscrito={rapTotalInscrito}
            rapTotalReinscrito={rapTotalReinscrito}
            rapTotalLiquidadoNoAno={rapTotalLiquidadoNoAno}
            rapTotalSaldoAtual={rapTotalSaldoAtual}
            filteredRapCount={filteredData.empenhosRap.length}
            dadosRapPorOrigem={dadosRapPorOrigem}
          />
        </TabsContent>

        <TabsContent value="contratos" className="mt-0 space-y-6 border-none p-0">
          <DashboardContractExecutionTab
            isLoading={isLoading}
            contractExpenseData={selectedContractExpenseData}
            contractExpenseOptions={contractExpenseAggregation.options}
            contractExpenseSeries={selectedContractExpenseSeries}
            selectedContractExpenseIds={selectedContractExpenseIds}
            contractProjectionBullets={selectedContractProjectionBullets}
            allContractProjectionBullets={allContractProjectionBullets}
            isContractExpenseLoading={isContratosApiAtivosLoading || isContractExpenseLoading}
            onToggleContractExpense={toggleContractExpenseSelection}
            projectionTargetMonths={projectionTargetMonths}
            onProjectionTargetMonthsChange={setProjectionTargetMonths}
            contractExpensePeriod={contractExpensePeriod}
            contractsWithRenewalAllowed={contractsWithRenewalAllowed}
            onToggleContractRenewal={(id) => {
              setContractsWithRenewalAllowed((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
