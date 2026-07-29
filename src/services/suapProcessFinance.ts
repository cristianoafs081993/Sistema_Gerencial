import { supabase } from '@/lib/supabase';
import { contratosApiService, type ContratoApiEmpenhoRow, type ContratoApiPublicLiquidacaoRow, type ContratoApiRow } from '@/services/contratosApi';
import { contratosService } from '@/services/contratos';
import { empenhosService } from '@/services/empenhos';
import type { Contrato, ContratoEmpenho, Empenho, SuapProcesso } from '@/types';
import { buildEmpenhoLookupKeys, normalizeContratoNumero } from '@/utils/contratosSync';

export type SuapProcessFinanceSummaryStatus =
  | 'ready'
  | 'missing-process'
  | 'missing-beneficiary'
  | 'empty';

export type SuapProcessFinanceSummary = {
  status: SuapProcessFinanceSummaryStatus;
  processo?: {
    id: string;
    suapId: string;
    numero?: string;
  };
  beneficiario?: {
    nome?: string;
    documento?: string;
  };
  contrato?: {
    numero: string;
  };
  escopoContrato: boolean;
  totais: {
    empenhado: number;
    liquidado: number;
    pago: number;
    saldo: number;
  };
  empenhos: SuapProcessFinanceEmpenho[];
};

export type SuapProcessFinanceEmpenho = {
  id: string;
  numero: string;
  origem: 'local' | 'contratos_api';
  descricao?: string;
  contratoNumero?: string;
  dataEmissao?: string;
  empenhado: number;
  liquidado: number;
  pago: number;
  saldo: number;
  liquidacoes: SuapProcessFinanceLiquidacao[];
};

export type SuapProcessFinanceLiquidacao = {
  id: string;
  numero?: string;
  situacao?: string;
  valor?: number;
  data?: string;
};

type BuildFinanceSummaryInput = {
  processo: SuapProcesso | null;
  empenhos: Empenho[];
  contratos: Contrato[];
  contratosEmpenhos: ContratoEmpenho[];
  contratosApi: ContratoApiRow[];
  contratosApiEmpenhos: ContratoApiEmpenhoRow[];
  liquidacoesPorEmpenho?: Map<string, ContratoApiPublicLiquidacaoRow[]>;
};

const normalizeDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeEmpenhoRef = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const buildEmpenhoRefKeys = (value: unknown) => {
  const keys = new Set(buildEmpenhoLookupKeys(value));
  const normalized = normalizeEmpenhoRef(value);
  if (normalized) keys.add(normalized);
  if (normalized.length >= 12) keys.add(normalized.slice(-12));
  return keys;
};

const toNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(
    String(value)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  );
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalNumber = (value: unknown) => {
  const parsed = toNumber(value);
  return parsed === 0 && (value == null || value === '') ? undefined : parsed;
};

const getRawNumber = (rawData: Record<string, unknown> | null | undefined, key: string) =>
  rawData && typeof rawData === 'object' ? toOptionalNumber(rawData[key]) : undefined;

const getApiEmpenhoNumber = (
  empenho: ContratoApiEmpenhoRow,
  dbKey: keyof ContratoApiEmpenhoRow,
  rawKey: string,
) => {
  const fromDb = toOptionalNumber(empenho[dbKey]);
  if (fromDb !== undefined) return Math.max(0, fromDb);
  const fromRaw = getRawNumber(empenho.raw_data, rawKey);
  return fromRaw === undefined ? undefined : Math.max(0, fromRaw);
};

const getApiEmpenhoYear = (empenho: ContratoApiEmpenhoRow) => {
  const match = empenho.numero.match(/^(\d{4})NE/i);
  if (match) return Number(match[1]);
  if (!empenho.data_emissao) return new Date().getFullYear();
  const parsed = new Date(empenho.data_emissao);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

const getApiRapLiquidadoPago = (empenho: ContratoApiEmpenhoRow) =>
  (getApiEmpenhoNumber(empenho, 'rp_liquidado', 'rpliquidado') ?? 0) +
  (getApiEmpenhoNumber(empenho, 'rp_pago', 'rppago') ?? 0);

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

const getApiSaldo = (empenho: ContratoApiEmpenhoRow) => {
  if (isApiRapEmpenho(empenho)) {
    const rpAPagarDbApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar');
    if (rpAPagarDbApi !== undefined) return rpAPagarDbApi;
    return Math.max(0, getApiRapBase(empenho) - getApiRapLiquidadoPago(empenho));
  }

  return getApiEmpenhoNumber(empenho, 'valor_a_liquidar', 'valoraliquidar') ?? 0;
};

const getLocalLiquidado = (empenho: Empenho) =>
  empenho.valorLiquidadoOficial ?? empenho.valorLiquidado ?? 0;

const getLocalPago = (empenho: Empenho) =>
  empenho.valorPagoOficial ?? empenho.valorPago ?? empenho.rapPago ?? 0;

const getLocalSaldo = (empenho: Empenho) => {
  if (empenho.tipo === 'rap') {
    if (empenho.saldoRapOficial !== undefined) return Math.max(0, empenho.saldoRapOficial);
    if (empenho.rapALiquidar !== undefined) return Math.max(0, empenho.rapALiquidar);
  }

  return Math.max(0, (empenho.valor || 0) - getLocalLiquidado(empenho));
};

const getProcessContratoNumero = (processo: SuapProcesso) =>
  normalizeContratoNumero(processo.contrato || processo.dadosCompletos?.contrato_numero || '');

const isSameBeneficiario = (
  candidateName: unknown,
  candidateDocument: unknown,
  beneficiaryName: string | undefined,
  beneficiaryDocument: string | undefined,
) => {
  const candidateDocumentDigits = normalizeDigits(candidateDocument);
  if (beneficiaryDocument && candidateDocumentDigits) return candidateDocumentDigits === beneficiaryDocument;

  const candidateText = normalizeText(candidateName);
  const beneficiaryText = normalizeText(beneficiaryName);
  if (!candidateText || !beneficiaryText) return false;
  return candidateText === beneficiaryText || candidateText.includes(beneficiaryText) || beneficiaryText.includes(candidateText);
};

const resolveLocalContrato = (contratos: Contrato[], contratoNumero: string) => {
  if (!contratoNumero) return null;
  return contratos.find((contrato) => normalizeContratoNumero(contrato.numero) === contratoNumero) ?? null;
};

const resolveLocalEmpenhosForContrato = (
  contrato: Contrato | null,
  empenhos: Empenho[],
  contratosEmpenhos: ContratoEmpenho[],
  suapEmpenhoRefs: string[],
) => {
  const explicitRefs = new Set(suapEmpenhoRefs.flatMap((ref) => Array.from(buildEmpenhoRefKeys(ref))));
  const linkedRefs = new Set(
    contrato
      ? contratosEmpenhos
        .filter((link) => link.contrato_id === contrato.id)
        .flatMap((link) => [String(link.empenho_id ?? '').trim(), ...Array.from(buildEmpenhoRefKeys(link.empenho_id))])
        .filter(Boolean)
      : [],
  );

  if (explicitRefs.size === 0 && linkedRefs.size === 0) return [];

  return empenhos.filter((empenho) => {
    const keys = buildEmpenhoRefKeys(empenho.numero);
    return Array.from(keys).some((key) => explicitRefs.has(key) || linkedRefs.has(key)) ||
      (contrato ? linkedRefs.has(empenho.id) : false);
  });
};

const resolveApiContratos = (
  contratosApi: ContratoApiRow[],
  contratoNumero: string,
  beneficiaryName: string | undefined,
  beneficiaryDocument: string | undefined,
) => {
  return contratosApi.filter((contrato) => {
    if (contratoNumero && normalizeContratoNumero(contrato.numero) !== contratoNumero) return false;
    return isSameBeneficiario(contrato.fornecedor_nome, contrato.fornecedor_documento, beneficiaryName, beneficiaryDocument);
  });
};

const getLiquidacoesForEmpenho = (
  liquidacoesPorEmpenho: Map<string, ContratoApiPublicLiquidacaoRow[]> | undefined,
  numero: string,
  contratoNumero: string,
) => {
  const rows = liquidacoesPorEmpenho?.get(normalizeEmpenhoRef(numero)) ?? [];
  return rows
    .filter((row) => !contratoNumero || normalizeContratoNumero(row.contrato_numero) === contratoNumero)
    .slice(0, 6)
    .map((row) => ({
      id: `${row.contrato_api_id}:${row.fatura_id}:${row.empenho_numero}:${row.numero_instrumento_cobranca ?? ''}`,
      numero: row.numero_instrumento_cobranca ?? undefined,
      situacao: row.situacao ?? undefined,
      valor: row.valor_liquido ?? row.valor_bruto ?? row.valor_empenho ?? undefined,
      data: row.data_liquidacao ?? row.data_emissao ?? row.data_pagamento ?? undefined,
    }));
};

const byEmpenhoSort = (left: SuapProcessFinanceEmpenho, right: SuapProcessFinanceEmpenho) =>
  right.saldo - left.saldo || right.empenhado - left.empenhado || left.numero.localeCompare(right.numero);

export function buildSuapProcessFinanceSummary(input: BuildFinanceSummaryInput): SuapProcessFinanceSummary {
  const { processo } = input;
  const emptyTotals = { empenhado: 0, liquidado: 0, pago: 0, saldo: 0 };
  if (!processo) return { status: 'missing-process', escopoContrato: false, totais: emptyTotals, empenhos: [] };

  const beneficiaryDocument = normalizeDigits(processo.cpfCnpj) || undefined;
  const beneficiaryName = processo.beneficiario?.trim() || undefined;
  const contratoNumero = getProcessContratoNumero(processo);

  const base = {
    processo: { id: processo.id, suapId: processo.suapId, numero: processo.numProcesso },
    beneficiario: { nome: beneficiaryName, documento: beneficiaryDocument },
    contrato: contratoNumero ? { numero: contratoNumero } : undefined,
    escopoContrato: Boolean(contratoNumero),
  };

  if (!beneficiaryDocument && !beneficiaryName) {
    return { ...base, status: 'missing-beneficiary', totais: emptyTotals, empenhos: [] };
  }

  const localContrato = resolveLocalContrato(input.contratos, contratoNumero);
  const suapEmpenhoRefs = processo.dadosCompletos?.empenhos ?? [];
  const localEmpenhos = contratoNumero
    ? resolveLocalEmpenhosForContrato(localContrato, input.empenhos, input.contratosEmpenhos, suapEmpenhoRefs)
    : input.empenhos.filter((empenho) =>
      isSameBeneficiario(empenho.favorecidoNome, empenho.favorecidoDocumento, beneficiaryName, beneficiaryDocument),
    );

  const localEmpenhoKeys = new Set(localEmpenhos.flatMap((empenho) => Array.from(buildEmpenhoRefKeys(empenho.numero))));
  const apiContratos = resolveApiContratos(input.contratosApi, contratoNumero, beneficiaryName, beneficiaryDocument);
  const apiContratoIds = new Set(apiContratos.map((contrato) => contrato.id));
  const contratoNumeroByApiId = new Map(apiContratos.map((contrato) => [contrato.id, normalizeContratoNumero(contrato.numero)] as const));

  const apiEmpenhos = input.contratosApiEmpenhos.filter((empenho) => {
    if (!apiContratoIds.has(empenho.contrato_api_id)) return false;
    const keys = buildEmpenhoRefKeys(empenho.numero);
    return !Array.from(keys).some((key) => localEmpenhoKeys.has(key));
  });

  const mappedLocal: SuapProcessFinanceEmpenho[] = localEmpenhos.map((empenho) => ({
    id: empenho.id,
    numero: empenho.numero,
    origem: 'local',
    descricao: empenho.descricao,
    contratoNumero: contratoNumero || undefined,
    dataEmissao: empenho.dataEmpenho instanceof Date ? empenho.dataEmpenho.toISOString().slice(0, 10) : undefined,
    empenhado: empenho.valor || 0,
    liquidado: getLocalLiquidado(empenho),
    pago: getLocalPago(empenho),
    saldo: getLocalSaldo(empenho),
    liquidacoes: getLiquidacoesForEmpenho(input.liquidacoesPorEmpenho, empenho.numero, contratoNumero),
  }));

  const mappedApi: SuapProcessFinanceEmpenho[] = apiEmpenhos.map((empenho) => {
    const empenhado = getApiEmpenhoNumber(empenho, 'valor_empenhado', 'valorempenhado') ?? 0;
    return {
      id: empenho.id,
      numero: empenho.numero,
      origem: 'contratos_api',
      descricao: empenho.credor ?? undefined,
      contratoNumero: contratoNumeroByApiId.get(empenho.contrato_api_id) || undefined,
      dataEmissao: empenho.data_emissao ?? undefined,
      empenhado,
      liquidado: getApiEmpenhoNumber(empenho, 'valor_liquidado', 'valorliquidado') ?? 0,
      pago: getApiEmpenhoNumber(empenho, 'valor_pago', 'valorpago') ?? 0,
      saldo: getApiSaldo(empenho),
      liquidacoes: getLiquidacoesForEmpenho(input.liquidacoesPorEmpenho, empenho.numero, contratoNumero),
    };
  });

  const empenhos = [...mappedLocal, ...mappedApi].sort(byEmpenhoSort);
  const totais = empenhos.reduce((acc, empenho) => ({
    empenhado: acc.empenhado + empenho.empenhado,
    liquidado: acc.liquidado + empenho.liquidado,
    pago: acc.pago + empenho.pago,
    saldo: acc.saldo + empenho.saldo,
  }), emptyTotals);

  return { ...base, status: empenhos.length > 0 ? 'ready' : 'empty', totais, empenhos };
}

function buildCanonicalEmpenhoLookupKey(raw: unknown) {
  const keys = buildEmpenhoLookupKeys(raw);
  return keys.find((key) => /^\d{4}NE\d+$/i.test(key)) ?? keys[0] ?? '';
}

type LiquidacoesCacheRow = {
  id: string;
  empenho_numero: string;
  empenho_numero_api: string | null;
  contrato_api_id: number;
  contrato_numero: string | null;
  contrato_objeto: string | null;
  fatura_id: number;
  numero_instrumento_cobranca: string | null;
  situacao: string | null;
  valor_bruto: number | null;
  valor_liquido: number | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  data_liquidacao: string | null;
  processo: string | null;
  valor_empenho: number | null;
  subelemento: string | null;
};

const LIQUIDACOES_CACHE_SELECT = 'id, empenho_numero, empenho_numero_api, contrato_api_id, contrato_numero, contrato_objeto, fatura_id, numero_instrumento_cobranca, situacao, valor_bruto, valor_liquido, data_emissao, data_vencimento, data_pagamento, data_liquidacao, processo, valor_empenho, subelemento';

async function loadCachedLiquidacoesForEmpenhos(empenhoNumeros: string[]) {
  const lookupKeys = Array.from(new Set(empenhoNumeros.map(buildCanonicalEmpenhoLookupKey).filter(Boolean)));
  if (lookupKeys.length === 0) return new Map<string, ContratoApiPublicLiquidacaoRow[]>();

  const { data, error } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache')
    .select(LIQUIDACOES_CACHE_SELECT)
    .in('empenho_lookup_key', lookupKeys)
    .order('data_emissao', { ascending: false });

  if (error) {
    console.warn('suapProcessFinanceService: cache de liquidacoes indisponivel', error);
    return new Map<string, ContratoApiPublicLiquidacaoRow[]>();
  }

  const rowsByEmpenho = new Map<string, ContratoApiPublicLiquidacaoRow[]>();
  for (const row of (data ?? []) as LiquidacoesCacheRow[]) {
    const mapped: ContratoApiPublicLiquidacaoRow = {
      contrato_api_id: Number(row.contrato_api_id),
      contrato_numero: row.contrato_numero,
      contrato_objeto: row.contrato_objeto,
      fatura_id: Number(row.fatura_id),
      numero_instrumento_cobranca: row.numero_instrumento_cobranca,
      situacao: row.situacao,
      valor_bruto: row.valor_bruto == null ? null : Number(row.valor_bruto),
      valor_liquido: row.valor_liquido == null ? null : Number(row.valor_liquido),
      data_emissao: row.data_emissao,
      data_vencimento: row.data_vencimento,
      data_pagamento: row.data_pagamento,
      data_liquidacao: row.data_liquidacao,
      processo: row.processo,
      empenho_numero: row.empenho_numero_api || row.empenho_numero,
      valor_empenho: row.valor_empenho == null ? null : Number(row.valor_empenho),
      subelemento: row.subelemento,
    };
    const key = normalizeEmpenhoRef(mapped.empenho_numero);
    rowsByEmpenho.set(key, [...(rowsByEmpenho.get(key) ?? []), mapped]);
  }

  return rowsByEmpenho;
}

export const suapProcessFinanceService = {
  async getSummaryBySuapId(suapId: string): Promise<SuapProcessFinanceSummary> {
    const { suapProcessosService } = await import('@/services/suapProcessos');
    const processo = await suapProcessosService.getBySuapId(suapId);
    if (!processo) return buildSuapProcessFinanceSummary({
      processo: null,
      empenhos: [],
      contratos: [],
      contratosEmpenhos: [],
      contratosApi: [],
      contratosApiEmpenhos: [],
    });

    const [empenhos, contratos, contratosEmpenhos, contratosApi] = await Promise.all([
      empenhosService.getAll(),
      contratosService.getContratos(),
      contratosService.getContratosEmpenhos(),
      contratosApiService.getContratosApi(false),
    ]);
    const contratoNumero = getProcessContratoNumero(processo);
    const beneficiaryDocument = normalizeDigits(processo.cpfCnpj) || undefined;
    const beneficiaryName = processo.beneficiario?.trim() || undefined;
    const matchingApiContratos = resolveApiContratos(contratosApi, contratoNumero, beneficiaryName, beneficiaryDocument);
    const contratosApiEmpenhos = await contratosApiService.getEmpenhosApi(matchingApiContratos.map((contrato) => contrato.id));
    const preliminary = buildSuapProcessFinanceSummary({
      processo,
      empenhos,
      contratos,
      contratosEmpenhos,
      contratosApi,
      contratosApiEmpenhos,
    });
    const liquidacoesPorEmpenho = await loadCachedLiquidacoesForEmpenhos(preliminary.empenhos.map((empenho) => empenho.numero));

    return buildSuapProcessFinanceSummary({
      processo,
      empenhos,
      contratos,
      contratosEmpenhos,
      contratosApi,
      contratosApiEmpenhos,
      liquidacoesPorEmpenho,
    });
  },

  async ping() {
    const { error } = await supabase.from('processos').select('id').limit(1);
    if (error) throw error;
  },
};
