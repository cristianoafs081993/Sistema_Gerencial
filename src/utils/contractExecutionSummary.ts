import type {
  ContratoApiEmpenhoRow,
  ContratoApiFaturaRow,
  ContratoApiHistoricoRow,
  ContratoApiRow,
} from '@/services/contratosApi';
import type { ContratoEmpenho, Empenho } from '@/types';
import { contractDaysRemaining } from '@/utils/contractPresentation';
import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import { buildEmpenhoLookupKeys } from '@/utils/contratosSync';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapReferenceYear,
  getRapSaldoAtual,
} from '@/utils/rapMetrics';

export const REITORIA_UG = '158155';

export const normalizeEmpenhoRef = (value: string) =>
  (value || '')
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const buildEmpenhoRefKeys = (value: unknown) => {
  const keys = new Set(buildEmpenhoLookupKeys(value));
  const normalized = normalizeEmpenhoRef(String(value ?? ''));
  if (normalized) keys.add(normalized);
  if (normalized.length >= 12) keys.add(normalized.slice(-12));
  return keys;
};

export const getEmpenhoSortParts = (value: unknown) => {
  const normalized = normalizeEmpenhoRef(String(value ?? ''));
  const match = normalized.match(/(\d{4})NE(\d+)/);
  return {
    year: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
    sequence: match ? Number(match[2]) : Number.MAX_SAFE_INTEGER,
    normalized,
  };
};

export const compareEmpenhoRefs = (a: unknown, b: unknown) => {
  const left = getEmpenhoSortParts(a);
  const right = getEmpenhoSortParts(b);

  if (left.year !== right.year) return left.year - right.year;
  if (left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.normalized.localeCompare(right.normalized);
};

export const vigenciaVariant = (
  dataTermino: string | Date | null | undefined,
  apiContrato?: { situacao_derivada?: boolean | null } | null,
): 'success' | 'warning' | 'danger' | 'secondary' => {
  const days = contractDaysRemaining(dataTermino);
  if (days === null) return 'secondary';
  if (days < 0 || apiContrato?.situacao_derivada === false) return 'danger';
  return days <= 90 ? 'warning' : 'success';
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

export const getApiEmpenhoNumber = (
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

export const getApiEmpenhoYear = (empenho: ContratoApiEmpenhoRow) => {
  const match = empenho.numero.match(/^(\d{4})NE/i);
  if (match) return Number(match[1]);
  if (!empenho.data_emissao) return new Date().getFullYear();
  const parsed = new Date(empenho.data_emissao);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

export const getApiRapLiquidadoPago = (empenho: ContratoApiEmpenhoRow) => {
  const rpLiquidadoApi = getApiEmpenhoNumber(empenho, 'rp_liquidado', 'rpliquidado') ?? 0;
  const rpPagoApi = getApiEmpenhoNumber(empenho, 'rp_pago', 'rppago') ?? 0;
  return rpLiquidadoApi + rpPagoApi;
};

export const getApiRapBase = (empenho: ContratoApiEmpenhoRow) => {
  const rpInscritoApi = getApiEmpenhoNumber(empenho, 'rp_inscrito', 'rpinscrito') ?? 0;
  const rpALiquidarApi = getApiEmpenhoNumber(empenho, 'rp_a_liquidar', 'rpaliquidar') ?? 0;
  const rpAPagarApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar') ?? 0;
  const rpLiquidadoPagoApi = getApiRapLiquidadoPago(empenho);

  if (rpInscritoApi > 0) return rpInscritoApi;
  if (rpALiquidarApi > 0) return rpALiquidarApi;
  return rpLiquidadoPagoApi + rpAPagarApi;
};

export const isApiRapEmpenho = (empenho: ContratoApiEmpenhoRow) =>
  getApiEmpenhoYear(empenho) < new Date().getFullYear() ||
  getApiRapBase(empenho) > 0 ||
  getApiRapLiquidadoPago(empenho) > 0;

export const getApiRapSaldoAtual = (empenho: ContratoApiEmpenhoRow) => {
  const rpAPagarDbApi = getApiEmpenhoNumber(empenho, 'rp_a_pagar', 'rpapagar');
  if (rpAPagarDbApi !== undefined) return rpAPagarDbApi;
  return Math.max(0, getApiRapBase(empenho) - getApiRapLiquidadoPago(empenho));
};

export const getSaldoEmpenhoApi = (empenho: ContratoApiEmpenhoRow) => {
  if (isApiRapEmpenho(empenho)) return getApiRapSaldoAtual(empenho);
  return getApiEmpenhoNumber(empenho, 'valor_a_liquidar', 'valoraliquidar') ?? 0;
};

export const getSaldoEmpenhoLocal = (empenho: Empenho, rapReferenceYear?: number) => {
  if (empenho.tipo === 'rap') return getRapSaldoAtual(empenho, rapReferenceYear);
  const liquidado = (empenho.valorLiquidadoAPagar || 0) + (empenho.valorPagoOficial || 0);
  return Math.max(0, empenho.valor - liquidado);
};

export interface ContractExecutionRow {
  id: string;
  numero: string;
  valor: number;
  saldo: number;
  liquidado: number;
  fonte: string;
  tipo: string;
  local?: Empenho;
}

export interface ContractExecutionSummary {
  valorGlobal: number;
  empenhado: number;
  aLiquidar: number;
  empenhosCount: number;
  openFaturas: ContratoApiFaturaRow[];
  hasReitoriaOrigin: boolean;
  rows: ContractExecutionRow[];
}

export function buildLocalEmpenhoLookupMap(empenhos: Empenho[]) {
  const map = new Map<string, Empenho>();
  for (const empenho of empenhos) {
    for (const key of buildEmpenhoRefKeys(empenho.numero)) {
      if (!map.has(key)) map.set(key, empenho);
    }
  }
  return map;
}

export function resolveContractLocalEmpenhos(
  localContratoId: string | null | undefined,
  empenhos: Empenho[],
  contratosEmpenhos: ContratoEmpenho[],
  localEmpenhoByLookupKey: Map<string, Empenho>,
): Empenho[] {
  if (!localContratoId) return [];
  const linkIds = contratosEmpenhos
    .filter((link) => link.contrato_id === localContratoId)
    .map((link) => link.empenho_id);

  const byId = new Map(empenhos.map((e) => [e.id, e] as const));
  const byNumero = new Map(empenhos.map((e) => [e.numero, e] as const));
  const resolved: Empenho[] = [];
  const seen = new Set<string>();

  for (const ref of linkIds) {
    const refStr = (ref || '').toString().trim();
    const emp =
      byId.get(refStr) ||
      byNumero.get(refStr) ||
      Array.from(buildEmpenhoRefKeys(refStr))
        .map((key) => localEmpenhoByLookupKey.get(key))
        .find(Boolean);
    if (!emp || seen.has(emp.id)) continue;
    seen.add(emp.id);
    resolved.push(emp);
  }

  return resolved;
}

export function buildContractExecutionSummary(params: {
  localContratoId?: string | null;
  fallbackValor?: number | null;
  apiContrato?: ContratoApiRow | null;
  empenhos: Empenho[];
  contratosEmpenhos: ContratoEmpenho[];
  localEmpenhoByLookupKey?: Map<string, Empenho>;
  apiEmpenhos?: ContratoApiEmpenhoRow[];
  historico?: ContratoApiHistoricoRow[];
  faturas?: ContratoApiFaturaRow[];
  rapReferenceYear?: number;
}): ContractExecutionSummary {
  const {
    localContratoId,
    fallbackValor,
    apiContrato,
    empenhos,
    contratosEmpenhos,
    localEmpenhoByLookupKey = buildLocalEmpenhoLookupMap(empenhos),
    apiEmpenhos = [],
    historico = [],
    faturas = [],
    rapReferenceYear = getRapReferenceYear(empenhos),
  } = params;

  const getLocalForApi = (empenhoApi: ContratoApiEmpenhoRow) => {
    for (const key of buildEmpenhoRefKeys(empenhoApi.numero)) {
      const local = localEmpenhoByLookupKey.get(key);
      if (local) return local;
    }
    return undefined;
  };

  const getSaldoApiPreferLocal = (empenhoApi: ContratoApiEmpenhoRow) => {
    const local = getLocalForApi(empenhoApi);
    return local ? getSaldoEmpenhoLocal(local, rapReferenceYear) : getSaldoEmpenhoApi(empenhoApi);
  };

  const localEmpenhos = resolveContractLocalEmpenhos(
    localContratoId,
    empenhos,
    contratosEmpenhos,
    localEmpenhoByLookupKey,
  );

  const localKeys = new Set(localEmpenhos.flatMap((e) => Array.from(buildEmpenhoRefKeys(e.numero))));
  const apiOnlyEmpenhos = apiEmpenhos.filter((empenhoApi) => {
    const apiKeys = Array.from(buildEmpenhoRefKeys(empenhoApi.numero));
    return apiKeys.length > 0 && !apiKeys.some((key) => localKeys.has(key));
  });

  const valorHistorico = getValorTotalFromHistorico(historico);
  const valorGlobal =
    valorHistorico > 0
      ? valorHistorico
      : Math.max(
          fallbackValor ?? 0,
          Number(apiContrato?.valor_acumulado) || 0,
          Number(apiContrato?.valor_global) || 0,
        );

  const apiEmpenhadoTotal = apiEmpenhos.reduce((sum, e) => sum + (Number(e.valor_empenhado) || 0), 0);
  const localEmpenhadoTotal = localEmpenhos.reduce((sum, e) => sum + (e.valor || 0), 0);
  const apiOnlyEmpenhadoTotal = apiOnlyEmpenhos.reduce((sum, e) => sum + (Number(e.valor_empenhado) || 0), 0);
  const empenhado =
    (apiEmpenhadoTotal > 0 ? apiEmpenhadoTotal : localEmpenhadoTotal) || apiOnlyEmpenhadoTotal;

  const aLiquidar =
    localEmpenhos.reduce((sum, e) => sum + getSaldoEmpenhoLocal(e, rapReferenceYear), 0) +
    apiOnlyEmpenhos.reduce((sum, e) => sum + getSaldoApiPreferLocal(e), 0);

  const rows: ContractExecutionRow[] = [
    ...localEmpenhos.map((e) => ({
      id: e.id,
      numero: e.numero,
      valor: e.tipo === 'rap' ? getRapBaseVigente(e, rapReferenceYear) : e.valor,
      saldo: getSaldoEmpenhoLocal(e, rapReferenceYear),
      liquidado: e.tipo === 'rap' ? getRapLiquidadoNoAno(e) : e.valorLiquidado || 0,
      fonte: 'SIAFI local',
      tipo: e.tipo === 'rap' ? 'RAP' : 'Exercício',
      local: e,
    })),
    ...apiOnlyEmpenhos.map((e) => {
      const local = getLocalForApi(e);
      const rap = local ? local.tipo === 'rap' : isApiRapEmpenho(e);
      return {
        id: e.id,
        numero: e.numero,
        valor: rap
          ? local
            ? getRapBaseVigente(local, rapReferenceYear)
            : getApiRapBase(e)
          : Number(e.valor_empenhado) || 0,
        liquidado: rap
          ? local
            ? getRapLiquidadoNoAno(local)
            : getApiRapLiquidadoPago(e)
          : local?.valorLiquidado ?? (Number(e.valor_liquidado) || 0),
        saldo: getSaldoApiPreferLocal(e),
        tipo: rap ? 'RAP' : 'Exercício',
        local,
        fonte: local ? 'SIAFI local + vínculo API Comprasnet' : 'API Comprasnet',
      };
    }),
  ].sort((a, b) => compareEmpenhoRefs(a.numero, b.numero));

  const openFaturas = faturas.filter((f) => {
    const status = (f.situacao || '').trim().toLowerCase();
    return status !== 'pago' && status !== 'siafi apropriado';
  });

  const hasReitoriaOrigin = Boolean(
    apiContrato &&
      (apiContrato.unidade_origem_codigo === REITORIA_UG || apiContrato.unidade_codigo === REITORIA_UG),
  );

  return {
    valorGlobal,
    empenhado,
    aLiquidar,
    empenhosCount: rows.length,
    openFaturas,
    hasReitoriaOrigin,
    rows,
  };
}
