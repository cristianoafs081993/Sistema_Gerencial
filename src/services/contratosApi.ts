import { supabase } from '@/lib/supabase';
import {
  getFaturaEmpenhos,
  getFaturaItens,
  mapFatura,
  toDate,
  toNumber,
  type ApiContrato,
  type ApiEmpenho,
  type ApiFatura,
} from '@/services/contratosApiMappers';
import { isContratoApiCampusEmpenho } from '@/utils/contratosApiStatus';
import { buildEmpenhoLookupKeys, normalizeContratoNumero } from '@/utils/contratosSync';


const CONTRATOS_API_BASE = '/api-contratos/api';
const DEFAULT_UASG = '158366';
const DEFAULT_PUBLIC_LIQUIDACOES_UASGS = [DEFAULT_UASG, '158155'];
const DEFAULT_DISPLAY_UNIDADE_CODIGO = DEFAULT_UASG;
const CONTRATOS_API_SYNC_RUNS_SELECT = 'id,unidade_codigo,started_at,finished_at,status,contratos_ativos,contratos_inativos,contratos_upserted,empenhos_upserted,faturas_upserted,itens_upserted,historicos_upserted,fatura_itens_upserted,fatura_empenhos_upserted,error_message,details';
const CONTRATOS_API_HISTORICO_SELECT = 'id, contrato_api_id, api_historico_id, numero, tipo, qualificacao_termo, observacao, ug, codigo_unidade_origem, nome_unidade_origem, data_assinatura, data_publicacao, vigencia_inicio, vigencia_fim, valor_inicial, valor_global, num_parcelas, valor_parcela, novo_valor_global, novo_num_parcelas, novo_valor_parcela, data_inicio_novo_valor, retroativo, retroativo_valor, situacao_contrato';
const MIGRATION_REQUIRED_MESSAGE =
  'MIGRATION_REQUIRED: tabelas do módulo de contratos API ainda não existem no banco. Aplique as migrations do Supabase.';

const PUBLIC_CONTRATOS_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_EMPENHOS_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_LIQUIDACOES_CACHE_TTL_MS = 2 * 60 * 1000;
export const LIQUIDACOES_CACHE_UPDATED_EVENT = 'siages:liquidacoes-cache-updated';
const LIQUIDACOES_CACHE_STATUS_SELECT = 'empenho_lookup_key, empenho_numero, status, rows_count, fetched_at, expires_at, error_message';
const LIQUIDACOES_CACHE_ROWS_SELECT = 'id, empenho_lookup_key, empenho_numero, empenho_numero_api, unidade_contrato, contrato_api_id, contrato_numero, contrato_objeto, fatura_id, numero_instrumento_cobranca, situacao, valor_bruto, valor_liquido, data_emissao, data_vencimento, data_pagamento, data_liquidacao, processo, valor_empenho, subelemento, raw_data, fetched_at';

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type ContratoApiPublicoResumo = {
  api_contrato_id: number;
  numero: string | null;
  objeto: string | null;
  situacao: boolean;
};

type LiquidacoesCacheStatus = {
  empenho_lookup_key: string;
  empenho_numero: string;
  status: 'found' | 'not_found' | 'error';
  rows_count: number;
  fetched_at: string;
  expires_at: string;
  error_message: string | null;
};

type LiquidacoesCacheRow = {
  id: string;
  empenho_lookup_key: string;
  empenho_numero: string;
  empenho_numero_api: string | null;
  unidade_contrato: string | null;
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
  raw_data?: Record<string, unknown> | null;
  fetched_at: string;
};

type LiquidacoesCacheLookup =
  | { available: false }
  | {
      available: true;
      hasStatus: boolean;
      status: LiquidacoesCacheStatus['status'] | 'missing';
      isFresh: boolean;
      rowsCount: number;
      rows: ContratoApiPublicLiquidacaoRow[];
    };

type ContratoApiPublicoCompativel = {
  contrato: ContratoApiPublicoResumo;
  empenhos: ApiEmpenho[];
  empenhoIds: Set<string>;
};

export interface ContratoApiRow {
  id: string;
  api_contrato_id: number;
  numero: string;
  fornecedor_nome: string | null;
  fornecedor_documento?: string | null;
  unidade_codigo: string | null;
  unidade_nome: string | null;
  unidade_origem_codigo: string | null;
  unidade_origem_nome: string | null;
  objeto: string | null;
  processo: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  vigencia_inicio_derivada?: string | null;
  vigencia_fim_derivada?: string | null;
  valor_global: number | null;
  valor_acumulado: number | null;
  situacao: boolean | null;
  situacao_derivada?: boolean | null;
  situacao_derivada_motivo?: string | null;
  campus_scope_reason?: string | null;
  updated_at: string;
  categoria?: string | null;
  prorrogavel?: string | null;
  pncp_sequencial?: number | null;
  pncp_ano?: number | null;
  pncp_control_number?: string | null;
  pncp_has_record?: boolean | null;
  pncp_documentos_checked_at?: string | null;
  pncp_documentos_count?: number | null;
  pncp_instrumentos_checked_at?: string | null;
  pncp_instrumentos_count?: number | null;
  pncp_sync_error?: string | null;
}

export interface ContratoApiEmpenhoRow {
  id: string;
  contrato_api_id: string;
  api_empenho_id: number;
  numero: string;
  unidade_gestora: string | null;
  gestao: string | null;
  data_emissao: string | null;
  credor: string | null;
  fonte_recurso: string | null;
  plano_interno: string | null;
  natureza_despesa: string | null;
  valor_empenhado: number | null;
  valor_a_liquidar: number | null;
  valor_liquidado: number | null;
  valor_pago: number | null;
  rp_inscrito: number | null;
  rp_a_liquidar?: number | null;
  rp_liquidado?: number | null;
  rp_pago?: number | null;
  rp_a_pagar: number | null;
  raw_data?: Record<string, unknown> | null;
}

export interface ContratoApiFaturaRow {
  id: string;
  contrato_api_id: string;
  api_fatura_id: number;
  numero_instrumento_cobranca: string | null;
  mes_referencia?: string | null;
  ano_referencia?: string | null;
  situacao: string | null;
  valor_bruto: number | null;
  valor_liquido: number | null;
  data_emissao: string | null;
  data_pagamento: string | null;
  raw_data?: Record<string, unknown> | null;
}

export interface ContratoApiItemRow {
  id: string;
  contrato_api_id: string;
  api_item_id: number;
  catmatseritem_id: string | null;
  descricao_complementar: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  numero_item_compra: string | null;
  historico_item?: Array<Record<string, unknown>> | null;
}

export interface ContratoApiFaturaItemRow {
  id: string;
  contrato_api_id: string;
  contrato_api_fatura_id: string;
  contrato_api_item_id: string | null;
  api_item_id: number;
  quantidade_faturado: number | null;
  valor_unitario_faturado: number | null;
  valor_total_faturado: number | null;
}

export interface ContratoApiFaturaEmpenhoRow {
  id: string;
  contrato_api_id: string;
  contrato_api_fatura_id: string;
  contrato_api_empenho_id: string | null;
  api_empenho_id: number | null;
  numero_empenho: string | null;
  valor_empenho: number | null;
  subelemento: string | null;
}

export interface ContratoApiHistoricoRow {
  id: string;
  contrato_api_id: string;
  api_historico_id: number;
  numero: string | null;
  tipo: string | null;
  qualificacao_termo: Array<Record<string, unknown>> | null;
  observacao: string | null;
  ug: string | null;
  codigo_unidade_origem: string | null;
  nome_unidade_origem: string | null;
  data_assinatura: string | null;
  data_publicacao: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  valor_inicial: number | null;
  valor_global: number | null;
  num_parcelas: number | null;
  valor_parcela: number | null;
  novo_valor_global: number | null;
  novo_num_parcelas: number | null;
  novo_valor_parcela: number | null;
  data_inicio_novo_valor: string | null;
  retroativo: string | null;
  retroativo_valor: number | null;
  situacao_contrato: string | null;
}

export interface ContratoApiDocumentoRow {
  id: string;
  contrato_api_id: string;
  sequencial_documento: number;
  titulo: string;
  tipo_documento_id?: number | null;
  tipo_documento_nome: string;
  url: string;
  uri?: string | null;
  data_publicacao_pncp?: string | null;
  tamanho?: number | null;
  raw_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContratoApiInstrumentoCobrancaRow {
  id: string;
  contrato_api_id: string;
  sequencial_instrumento_cobranca: number;
  tipo_id?: number | null;
  tipo_nome: string;
  tipo_descricao?: string | null;
  numero_instrumento_cobranca: string;
  data_emissao?: string | null;
  chave_nfe?: string | null;
  data_consulta_nfe?: string | null;
  status_response_nfe?: string | null;
  valor_nota_fiscal?: number | null;
  serie?: string | null;
  tipo_evento_mais_recente?: string | null;
  data_tipo_evento_mais_recente?: string | null;
  nome_fornecedor?: string | null;
  cnpj_fornecedor?: string | null;
  municipio_fornecedor?: string | null;
  itens?: Array<{
    numeroProduto: string;
    descricaoProdutoServico: string;
    codigoNcmSh?: string | null;
    ncmSh?: string | null;
    cfop?: string | null;
    quantidade: string | number;
    unidade: string;
    valorUnitario: string | number;
    valor: string | number;
  }>;
  eventos?: Array<{
    codigoEvento?: string;
    descricaoEvento?: string;
    dataEvento?: string;
    sequencialEvento?: number;
  }>;
  raw_data?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContratoApiDetails {
  historico: ContratoApiHistoricoRow[];
  empenhos: ContratoApiEmpenhoRow[];
  itens: ContratoApiItemRow[];
  faturas: ContratoApiFaturaRow[];
  faturaItens: ContratoApiFaturaItemRow[];
  faturaEmpenhos: ContratoApiFaturaEmpenhoRow[];
  documentos?: ContratoApiDocumentoRow[];
  instrumentosCobranca?: ContratoApiInstrumentoCobrancaRow[];
}

export interface ContratoApiSyncRun {
  id: string;
  unidade_codigo: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  contratos_ativos: number;
  contratos_inativos: number;
  contratos_upserted: number;
  empenhos_upserted: number;
  faturas_upserted: number;
  itens_upserted?: number;
  historicos_upserted?: number;
  fatura_itens_upserted?: number;
  fatura_empenhos_upserted?: number;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

export interface ContratoApiPublicLiquidacaoRow {
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
  empenho_numero: string;
  valor_empenho: number | null;
  subelemento: string | null;
}

const contratosPublicosCache = new Map<string, CacheEntry<ContratoApiPublicoResumo[]>>();
const contratosPublicosInFlight = new Map<string, Promise<ContratoApiPublicoResumo[]>>();
const empenhosPublicosPorContratoCache = new Map<number, CacheEntry<ApiEmpenho[]>>();
const empenhosPublicosPorContratoInFlight = new Map<number, Promise<ApiEmpenho[]>>();
const liquidacoesPublicasPorEmpenhoCache = new Map<string, CacheEntry<ContratoApiPublicLiquidacaoRow[]>>();
const liquidacoesPublicasPorEmpenhoInFlight = new Map<string, Promise<ContratoApiPublicLiquidacaoRow[]>>();

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status} em ${url}`);
  }
  return res.json() as Promise<T>;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 6
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  const runners = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const result = await worker(item);
      results.push(result);
    }
  });

  await Promise.all(runners);
  return results;
}

function getCachedValue<K extends string | number, T>(cache: Map<K, CacheEntry<T>>, key: K) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

async function getOrLoadCached<K extends string | number, T>(
  cache: Map<K, CacheEntry<T>>,
  inflight: Map<K, Promise<T>>,
  key: K,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cachedValue = getCachedValue(cache, key);
  if (cachedValue !== null) return cachedValue;

  const inFlightValue = inflight.get(key);
  if (inFlightValue) return inFlightValue;

  const promise = loader()
    .then((value) => {
      cache.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
      });
      inflight.delete(key);
      return value;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

function mapContratoPublico(raw: ApiContrato, situacao: boolean): ContratoApiPublicoResumo | null {
  const apiContratoId = Number(raw.id);
  if (!Number.isFinite(apiContratoId) || apiContratoId <= 0) return null;

  const numero = String(raw.numero ?? '').trim();
  const objeto = raw.objeto == null ? null : String(raw.objeto);

  return {
    api_contrato_id: apiContratoId,
    numero: numero || null,
    objeto,
    situacao,
  };
}

function buildEmpenhoKeySet(raw: unknown) {
  return new Set(buildEmpenhoLookupKeys(raw));
}

function buildCanonicalEmpenhoLookupKey(raw: unknown) {
  const keys = buildEmpenhoLookupKeys(raw);
  return keys.find((key) => /^\d{4}NE\d+$/i.test(key)) ?? keys[0] ?? '';
}

function hasEmpenhoMatch(targetKeys: Set<string>, raw: unknown) {
  return buildEmpenhoLookupKeys(raw).some((key) => targetKeys.has(key));
}

function normalizeUnidadeCodigos(raw: string | string[]) {
  const values = Array.isArray(raw) ? raw : [raw];
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function getFaturaContratanteCodigo(rawFatura: unknown) {
  if (!rawFatura || typeof rawFatura !== 'object') return null;
  const record = rawFatura as Record<string, unknown>;
  const value = record.contratante ?? record.contratante_codigo ?? record.unidade_contrato;
  const match = String(value ?? '').match(/\b\d{6}\b/);
  return match?.[0] ?? null;
}

function isFaturaVisibleForDisplayUnidade(rawFatura: unknown, unidadeCodigo = DEFAULT_DISPLAY_UNIDADE_CODIGO) {
  const codigoContratante = getFaturaContratanteCodigo(rawFatura);
  return !codigoContratante || codigoContratante === unidadeCodigo;
}

export type ContratoApiFaturasPeriod = {
  dataEmissaoInicio?: string;
  dataEmissaoFim?: string;
};

function getEmpenhoUnidadeGestora(rawEmpenho: unknown) {
  if (!rawEmpenho || typeof rawEmpenho !== 'object') return null;
  const record = rawEmpenho as Record<string, unknown>;
  const value =
    record.unidade_gestora ??
    record.unidadeGestora ??
    record.codigo_unidade_emitente ??
    record.unidade_emitente ??
    record.ug;
  const match = String(value ?? '').match(/\b\d{6}\b/);
  return match?.[0] ?? null;
}

function isEmpenhoFromDisplayUnidade(rawEmpenho: unknown) {
  const unidadeGestora = getEmpenhoUnidadeGestora(rawEmpenho);
  return !unidadeGestora || unidadeGestora === DEFAULT_DISPLAY_UNIDADE_CODIGO;
}

function getEmpenhoApiId(rawEmpenho: unknown) {
  if (!rawEmpenho || typeof rawEmpenho !== 'object') return '';
  const record = rawEmpenho as Record<string, unknown>;
  return String(record.id_empenho ?? record.id ?? '').trim();
}

function isLiquidacaoCacheRowVisible(row: LiquidacoesCacheRow) {
  const rawData = row.raw_data && typeof row.raw_data === 'object' ? row.raw_data : {};
  return (
    isFaturaVisibleForDisplayUnidade((rawData as Record<string, unknown>).fatura) ||
    isEmpenhoFromDisplayUnidade((rawData as Record<string, unknown>).contratoEmpenho)
  );
}

function isDefaultPublicLiquidacoesUnidades(unidadeCodigos: string | string[]) {
  const received = normalizeUnidadeCodigos(unidadeCodigos).sort();
  const defaults = [...DEFAULT_PUBLIC_LIQUIDACOES_UASGS].sort();
  return received.length === defaults.length && received.every((value, index) => value === defaults[index]);
}

function mapCacheRowToLiquidacao(row: LiquidacoesCacheRow): ContratoApiPublicLiquidacaoRow {
  return {
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
}

async function getCachedLiquidacoesPublicasPorEmpenho(numeroEmpenho: string): Promise<LiquidacoesCacheLookup> {
  const lookupKey = buildCanonicalEmpenhoLookupKey(numeroEmpenho);
  if (!lookupKey) return { available: true, hasStatus: false, status: 'not_found', isFresh: false, rowsCount: 0, rows: [] };

  const { data: status, error: statusError } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache_status')
    .select(LIQUIDACOES_CACHE_STATUS_SELECT)
    .eq('empenho_lookup_key', lookupKey)
    .maybeSingle();

  if (statusError) {
    if (isMissingTableError(statusError)) return { available: false };
    throw statusError;
  }

  if (!status) return { available: true, hasStatus: false, status: 'missing', isFresh: false, rowsCount: 0, rows: [] };

  const typedStatus = status as LiquidacoesCacheStatus;
  const isFresh = new Date(typedStatus.expires_at).getTime() > Date.now();
  if (typedStatus.status === 'not_found') {
    return {
      available: true,
      hasStatus: true,
      status: typedStatus.status,
      isFresh,
      rowsCount: Number(typedStatus.rows_count ?? 0),
      rows: [] as ContratoApiPublicLiquidacaoRow[],
    };
  }

  const { data: rows, error: rowsError } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache')
    .select(LIQUIDACOES_CACHE_ROWS_SELECT)
    .eq('empenho_lookup_key', lookupKey)
    .order('data_emissao', { ascending: false });

  if (rowsError) {
    if (isMissingTableError(rowsError)) return { available: false };
    throw rowsError;
  }

  const rawRows = (rows ?? []) as LiquidacoesCacheRow[];
  const visibleRows = rawRows.filter(isLiquidacaoCacheRowVisible);
  const rowsCount = rawRows.length > 0 ? visibleRows.length : Number(typedStatus.rows_count ?? 0);

  return {
    available: true,
    hasStatus: true,
    status: typedStatus.status,
    isFresh,
    rowsCount,
    rows: visibleRows.map(mapCacheRowToLiquidacao),
  };
}

async function getLiquidacoesCacheRowsViaFunction(
  numeroEmpenho: string,
  options: { readCacheOnly?: boolean; source: string },
) {
  const { data, error } = await supabase.functions.invoke('refresh-comprasnet-liquidacoes-cache', {
    body: {
      empenhoNumero: numeroEmpenho,
      returnRows: true,
      ...(options.readCacheOnly ? { readCacheOnly: true } : {}),
      source: options.source,
    },
  });

  if (error) {
    console.warn('Contratos API: falha ao ler cache de liquidacoes pela Edge Function', error);
    return null;
  }

  const firstResult = (data as { results?: Array<{ rows?: LiquidacoesCacheRow[] }> } | null)?.results?.[0];
  return (firstResult?.rows ?? []).filter(isLiquidacaoCacheRowVisible).map(mapCacheRowToLiquidacao);
}

function triggerLiquidacoesCacheRefresh(numeroEmpenho: string, source = 'frontend-cache-miss') {
  void supabase.functions
    .invoke('refresh-comprasnet-liquidacoes-cache', {
      body: {
        empenhoNumero: numeroEmpenho,
        source,
      },
    })
    .then((result) => {
      const error = result?.error;
      if (error) {
        console.warn('Contratos API: falha ao acionar refresh do cache de liquidacoes', error);
        return;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(LIQUIDACOES_CACHE_UPDATED_EVENT, {
          detail: { numeroEmpenho },
        }));
      }
    })
    .catch((error) => {
      console.warn('Contratos API: falha ao acionar refresh do cache de liquidacoes', error);
    });
}

async function getContratosPublicos(unidadeCodigo: string) {
  return getOrLoadCached(
    contratosPublicosCache,
    contratosPublicosInFlight,
    unidadeCodigo,
    PUBLIC_CONTRATOS_CACHE_TTL_MS,
    async () => {
      const [ativos, inativos] = await Promise.all([
        fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/ug/${unidadeCodigo}`),
        fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/inativo/ug/${unidadeCodigo}`),
      ]);

      const contratosMap = new Map<number, ContratoApiPublicoResumo>();

      for (const contrato of inativos ?? []) {
        const mapped = mapContratoPublico(contrato, false);
        if (mapped) contratosMap.set(mapped.api_contrato_id, mapped);
      }

      for (const contrato of ativos ?? []) {
        const mapped = mapContratoPublico(contrato, true);
        if (mapped) contratosMap.set(mapped.api_contrato_id, mapped);
      }

      return Array.from(contratosMap.values());
    },
  );
}

async function getEmpenhosPublicosPorContrato(contratoApiId: number) {
  return getOrLoadCached(
    empenhosPublicosPorContratoCache,
    empenhosPublicosPorContratoInFlight,
    contratoApiId,
    PUBLIC_EMPENHOS_CACHE_TTL_MS,
    async () => {
      const data = await fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contratoApiId}/empenhos`);
      return data ?? [];
    },
  );
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  return (
    e.status === 404 ||
    e.code === 'PGRST205' ||
    e.message?.toLowerCase().includes('could not find the table') === true ||
    e.message?.toLowerCase().includes('relation') === true ||
    e.details?.toLowerCase().includes('does not exist') === true
  );
}

function throwMigrationRequired(error: unknown): never {
  if (isMissingTableError(error)) {
    throw new Error(MIGRATION_REQUIRED_MESSAGE);
  }
  throw error;
}

export const contratosApiService = {
  async getContratosApi(onlyVigentes = true): Promise<ContratoApiRow[]> {
    const today = new Date().toISOString().slice(0, 10);
    let query = supabase
      .from('contratos_api')
      .select('id, api_contrato_id, numero, fornecedor_nome, fornecedor_documento, unidade_codigo, unidade_nome, unidade_origem_codigo, unidade_origem_nome, objeto, processo, vigencia_inicio, vigencia_fim, vigencia_inicio_derivada, vigencia_fim_derivada, valor_global, valor_acumulado, situacao, situacao_derivada, situacao_derivada_motivo, campus_scope_reason, updated_at, categoria, prorrogavel:raw_data->>prorrogavel, pncp_sequencial, pncp_ano, pncp_control_number, pncp_has_record, pncp_documentos_checked_at, pncp_documentos_count, pncp_instrumentos_checked_at, pncp_instrumentos_count, pncp_sync_error')
      .in('campus_scope_reason', ['ug_campus', 'reitoria_com_empenho_campus', 'reitoria_com_fatura_campus'])
      .order('numero', { ascending: true });

    if (onlyVigentes) {
      const hundredTwentyDaysAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      query = query.or(
        `situacao_derivada.eq.true,and(vigencia_fim_derivada.gte.${hundredTwentyDaysAgo},vigencia_fim_derivada.lt.${today})`
      );
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    return (data ?? []) as ContratoApiRow[];
  },

  async getContratoApiByNumeroOrId(numeroOrId: string): Promise<ContratoApiRow | null> {
    const clean = String(numeroOrId || '').trim();
    if (!clean) return null;

    // 1. Tenta encontrar por UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
      const { data } = await supabase
        .from('contratos_api')
        .select('id, api_contrato_id, numero, fornecedor_nome, fornecedor_documento, unidade_codigo, unidade_nome, unidade_origem_codigo, unidade_origem_nome, objeto, processo, vigencia_inicio, vigencia_fim, vigencia_inicio_derivada, vigencia_fim_derivada, valor_global, valor_acumulado, situacao, situacao_derivada, situacao_derivada_motivo, campus_scope_reason, updated_at, categoria, prorrogavel:raw_data->>prorrogavel')
        .eq('id', clean)
        .maybeSingle();
      if (data) return data as ContratoApiRow;
    }

    // 2. Tenta por número normalizado (ex: 00280/2024 ou 280/2024)
    const normalized = normalizeContratoNumero(clean);
    const { data: byNumero } = await supabase
      .from('contratos_api')
      .select('id, api_contrato_id, numero, fornecedor_nome, fornecedor_documento, unidade_codigo, unidade_nome, unidade_origem_codigo, unidade_origem_nome, objeto, processo, vigencia_inicio, vigencia_fim, vigencia_inicio_derivada, vigencia_fim_derivada, valor_global, valor_acumulado, situacao, situacao_derivada, situacao_derivada_motivo, campus_scope_reason, updated_at, categoria, prorrogavel:raw_data->>prorrogavel')
      .or(`numero.eq.${normalized},numero.eq.${clean},numero.ilike.%${clean}%`)
      .limit(1)
      .maybeSingle();

    if (byNumero) return byNumero as ContratoApiRow;

    return null;
  },

  async getEmpenhosApi(contratoApiIds?: string[]): Promise<ContratoApiEmpenhoRow[]> {

    let query = supabase
      .from('contratos_api_empenhos')
      .select('id, contrato_api_id, api_empenho_id, numero, unidade_gestora, gestao, data_emissao, credor, fonte_recurso, plano_interno, natureza_despesa, valor_empenhado, valor_a_liquidar, valor_liquidado, valor_pago, rp_inscrito, rp_a_pagar, raw_data');

    if (contratoApiIds && contratoApiIds.length > 0 && contratoApiIds.length <= 100) {
      query = query.in('contrato_api_id', contratoApiIds);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    const all = (data ?? []) as ContratoApiEmpenhoRow[];
    if (!contratoApiIds || contratoApiIds.length === 0 || contratoApiIds.length <= 100) return all;
    const set = new Set(contratoApiIds);
    return all.filter((row) => set.has(row.contrato_api_id));
  },

  async getHistoricosApi(contratoApiIds?: string[]): Promise<ContratoApiHistoricoRow[]> {
    let query = supabase
      .from('contratos_api_historico')
      .select(CONTRATOS_API_HISTORICO_SELECT)
      .order('data_assinatura', { ascending: true, nullsFirst: false });

    if (contratoApiIds && contratoApiIds.length > 0 && contratoApiIds.length <= 100) {
      query = query.in('contrato_api_id', contratoApiIds);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    const all = (data ?? []) as ContratoApiHistoricoRow[];
    if (!contratoApiIds || contratoApiIds.length === 0 || contratoApiIds.length <= 100) return all;
    const set = new Set(contratoApiIds);
    return all.filter((row) => set.has(row.contrato_api_id));
  },

  async getFaturasApi(contratoApiIds?: string[], period?: ContratoApiFaturasPeriod): Promise<ContratoApiFaturaRow[]> {
    let query = supabase
      .from('contratos_api_faturas')
      .select('id, contrato_api_id, api_fatura_id, numero_instrumento_cobranca, mes_referencia, ano_referencia, situacao, valor_bruto, valor_liquido, data_emissao, data_pagamento, raw_data');

    if (contratoApiIds && contratoApiIds.length > 0 && contratoApiIds.length <= 100) {
      query = query.in('contrato_api_id', contratoApiIds);
    }

    if (period?.dataEmissaoInicio) {
      query = query.gte('data_emissao', period.dataEmissaoInicio);
    }

    if (period?.dataEmissaoFim) {
      query = query.lte('data_emissao', period.dataEmissaoFim);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    const all = (data ?? []) as ContratoApiFaturaRow[];
    if (!contratoApiIds || contratoApiIds.length === 0 || contratoApiIds.length <= 100) return all;
    const set = new Set(contratoApiIds);
    return all.filter((row) => set.has(row.contrato_api_id));
  },

  async getDocumentosApi(contratoApiIds?: string[]): Promise<ContratoApiDocumentoRow[]> {
    let query = supabase
      .from('contratos_api_documentos')
      .select('id, contrato_api_id, sequencial_documento, titulo, tipo_documento_id, tipo_documento_nome, url, uri, data_publicacao_pncp, tamanho, raw_data, created_at, updated_at')
      .order('sequencial_documento', { ascending: true });

    if (contratoApiIds && contratoApiIds.length > 0 && contratoApiIds.length <= 100) {
      query = query.in('contrato_api_id', contratoApiIds);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    const all = (data ?? []) as ContratoApiDocumentoRow[];
    if (!contratoApiIds || contratoApiIds.length === 0 || contratoApiIds.length <= 100) return all;
    const set = new Set(contratoApiIds);
    return all.filter((row) => set.has(row.contrato_api_id));
  },

  async getContratoApiDetails(contratoApiId: string): Promise<ContratoApiDetails> {
    const [historicoResult, empenhosResult, itensResult, faturasResult, faturaItensResult, faturaEmpenhosResult, documentosResult, instrumentosResult] = await Promise.all([
      supabase
        .from('contratos_api_historico')
        .select(CONTRATOS_API_HISTORICO_SELECT)
        .eq('contrato_api_id', contratoApiId)
        .order('data_assinatura', { ascending: true, nullsFirst: false }),
      supabase
        .from('contratos_api_empenhos')
        .select('id, contrato_api_id, api_empenho_id, numero, unidade_gestora, gestao, data_emissao, credor, fonte_recurso, plano_interno, natureza_despesa, valor_empenhado, valor_a_liquidar, valor_liquidado, valor_pago, rp_inscrito, rp_a_pagar, raw_data')
        .eq('contrato_api_id', contratoApiId)
        .order('data_emissao', { ascending: false, nullsFirst: false }),
      supabase
        .from('contratos_api_itens')
        .select('id, contrato_api_id, api_item_id, catmatseritem_id, descricao_complementar, quantidade, valor_unitario, valor_total, numero_item_compra, historico_item')
        .eq('contrato_api_id', contratoApiId)
        .order('numero_item_compra', { ascending: true }),
      supabase
        .from('contratos_api_faturas')
        .select('id, contrato_api_id, api_fatura_id, numero_instrumento_cobranca, mes_referencia, ano_referencia, situacao, valor_bruto, valor_liquido, data_emissao, data_pagamento, raw_data')
        .eq('contrato_api_id', contratoApiId)
        .order('data_emissao', { ascending: false }),
      supabase
        .from('contratos_api_fatura_itens')
        .select('id, contrato_api_id, contrato_api_fatura_id, contrato_api_item_id, api_item_id, quantidade_faturado, valor_unitario_faturado, valor_total_faturado')
        .eq('contrato_api_id', contratoApiId),
      supabase
        .from('contratos_api_fatura_empenhos')
        .select('id, contrato_api_id, contrato_api_fatura_id, contrato_api_empenho_id, api_empenho_id, numero_empenho, valor_empenho, subelemento')
        .eq('contrato_api_id', contratoApiId),
      supabase
        .from('contratos_api_documentos')
        .select('id, contrato_api_id, sequencial_documento, titulo, tipo_documento_id, tipo_documento_nome, url, uri, data_publicacao_pncp, tamanho, raw_data, created_at, updated_at')
        .eq('contrato_api_id', contratoApiId)
        .order('sequencial_documento', { ascending: true }),
      supabase
        .from('contratos_api_instrumentos_cobranca')
        .select('id, contrato_api_id, sequencial_instrumento_cobranca, tipo_id, tipo_nome, tipo_descricao, numero_instrumento_cobranca, data_emissao, chave_nfe, data_consulta_nfe, status_response_nfe, valor_nota_fiscal, serie, tipo_evento_mais_recente, data_tipo_evento_mais_recente, nome_fornecedor, cnpj_fornecedor, municipio_fornecedor, itens, eventos, raw_data, created_at, updated_at')
        .eq('contrato_api_id', contratoApiId)
        .order('sequencial_instrumento_cobranca', { ascending: true }),
    ]);

    const firstError =
      historicoResult.error ||
      empenhosResult.error ||
      itensResult.error ||
      faturasResult.error ||
      faturaItensResult.error ||
      faturaEmpenhosResult.error ||
      documentosResult.error ||
      instrumentosResult.error;
    const empenhos = (empenhosResult.data ?? []) as ContratoApiEmpenhoRow[];
    const empenhoIds = new Set(empenhos.map((empenho) => empenho.id));
    const apiEmpenhoIds = new Set(empenhos.map((empenho) => Number(empenho.api_empenho_id)));

    const faturaEmpenhos = ((faturaEmpenhosResult.data ?? []) as ContratoApiFaturaEmpenhoRow[]).filter((row) =>
      (row.contrato_api_empenho_id != null && empenhoIds.has(row.contrato_api_empenho_id)) ||
      (row.api_empenho_id != null && apiEmpenhoIds.has(Number(row.api_empenho_id))),
    );
    const linkedFaturaIds = new Set(faturaEmpenhos.map((fe) => fe.contrato_api_fatura_id));

    const faturas = ((faturasResult.data ?? []) as ContratoApiFaturaRow[]).filter((fatura) =>
      isFaturaVisibleForDisplayUnidade(fatura.raw_data ?? fatura) || linkedFaturaIds.has(fatura.id)
    );
    const faturaIds = new Set(faturas.map((fatura) => fatura.id));
    const faturaItens = ((faturaItensResult.data ?? []) as ContratoApiFaturaItemRow[]).filter((item) =>
      faturaIds.has(item.contrato_api_fatura_id),
    );

    return {
      historico: (historicoResult.data ?? []) as ContratoApiHistoricoRow[],
      empenhos,
      itens: (itensResult.data ?? []) as ContratoApiItemRow[],
      faturas,
      faturaItens,
      faturaEmpenhos,
      documentos: (documentosResult.data ?? []) as ContratoApiDocumentoRow[],
      instrumentosCobranca: (instrumentosResult.data ?? []) as ContratoApiInstrumentoCobrancaRow[],
    };
  },

  async getLiquidacoesPublicasPorEmpenho(
    numeroEmpenho: string,
    unidadeCodigos: string | string[] = DEFAULT_PUBLIC_LIQUIDACOES_UASGS,
  ): Promise<ContratoApiPublicLiquidacaoRow[]> {
    if (isDefaultPublicLiquidacoesUnidades(unidadeCodigos)) {
      const cached = await getCachedLiquidacoesPublicasPorEmpenho(numeroEmpenho);
      if (!cached.available) return [];
      if (cached.isFresh && cached.rows.length === 0 && cached.rowsCount > 0) {
        const privilegedRows = await getLiquidacoesCacheRowsViaFunction(numeroEmpenho, {
          readCacheOnly: true,
          source: 'frontend-cache-read-fallback',
        });
        if (privilegedRows) return privilegedRows;
      }
      if (cached.isFresh && cached.status !== 'error') return cached.rows;

      // Linhas antigas sao preferiveis a bloquear a tela aguardando a API publica.
      // A atualizacao continua em background e sera refletida na proxima consulta.
      if (cached.rows.length > 0) {
        triggerLiquidacoesCacheRefresh(numeroEmpenho, 'frontend-cache-stale');
        return cached.rows;
      }

      // O carregamento inicial nunca deve esperar a API publica. O cache é
      // atualizado em background e a tela é invalidada quando terminar.
      triggerLiquidacoesCacheRefresh(
        numeroEmpenho,
        cached.hasStatus ? 'frontend-cache-stale' : 'frontend-cache-miss',
      );
      return [];
    }

    const targetKeys = buildEmpenhoKeySet(numeroEmpenho);
    if (targetKeys.size === 0) return [];

    const unidadeLista = normalizeUnidadeCodigos(unidadeCodigos);
    if (unidadeLista.length === 0) return [];

    const cacheKey = `${[...unidadeLista].sort().join(',')}:${Array.from(targetKeys).sort().join('|')}`;

    return getOrLoadCached(
      liquidacoesPublicasPorEmpenhoCache,
      liquidacoesPublicasPorEmpenhoInFlight,
      cacheKey,
      PUBLIC_LIQUIDACOES_CACHE_TTL_MS,
      async () => {
        const contratosPorUnidade = await mapWithConcurrency(
          unidadeLista,
          (unidadeCodigo) => getContratosPublicos(unidadeCodigo),
          2,
        );
        const contratosMap = new Map<number, ContratoApiPublicoResumo>();
        for (const contrato of contratosPorUnidade.flat()) {
          contratosMap.set(contrato.api_contrato_id, contrato);
        }

        const contratos = Array.from(contratosMap.values());
        if (contratos.length === 0) return [];

        const contratosCompativeis = (
          await mapWithConcurrency(
            contratos,
            async (contrato) => {
              try {
                const empenhos = await getEmpenhosPublicosPorContrato(contrato.api_contrato_id);
                const matchingEmpenhos = empenhos.filter((empenho) =>
                  hasEmpenhoMatch(targetKeys, empenho.numero ?? empenho.numero_empenho) && isEmpenhoFromDisplayUnidade(empenho),
                );

                if (matchingEmpenhos.length === 0) return null;

                return {
                  contrato,
                  empenhos: matchingEmpenhos,
                  empenhoIds: new Set(matchingEmpenhos.map(getEmpenhoApiId).filter(Boolean)),
                };
              } catch (error) {
                console.warn(
                  `Contratos API: falha ao consultar empenhos publicos do contrato ${contrato.api_contrato_id}`,
                  error,
                );
                return null;
              }
            },
            6,
          )
        ).filter((contrato): contrato is ContratoApiPublicoCompativel => Boolean(contrato));

        if (contratosCompativeis.length === 0) return [];

        const liquidacoes = (
          await mapWithConcurrency(
            contratosCompativeis,
            async ({ contrato, empenhos: contratoEmpenhos, empenhoIds }) => {
              try {
                const faturas = await fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contrato.api_contrato_id}/faturas`);

                return (faturas ?? []).flatMap((rawFatura) => {
                  const matchingEmpenhos = getFaturaEmpenhos(rawFatura).filter((rawEmpenho) =>
                    hasEmpenhoMatch(targetKeys, rawEmpenho.numero_empenho ?? rawEmpenho.numero) &&
                    (!getEmpenhoApiId(rawEmpenho) || empenhoIds.has(getEmpenhoApiId(rawEmpenho)) || isFaturaVisibleForDisplayUnidade(rawFatura)),
                  );

                  if (matchingEmpenhos.length === 0) return [];

                  const faturaMapeada = mapFatura(String(contrato.api_contrato_id), rawFatura);
                  const rawFaturaRecord = rawFatura as Record<string, unknown>;
                  const processo = rawFaturaRecord.processo == null ? null : String(rawFaturaRecord.processo);
                  // `data_liquidacao` apareceu em payloads reais, mas nao esta documentado no schema OpenAPI.
                  const dataLiquidacao = toDate(rawFaturaRecord.data_liquidacao);

                  return matchingEmpenhos.map((matchingEmpenho) => ({
                    contrato_api_id: contrato.api_contrato_id,
                    contrato_numero: contrato.numero,
                    contrato_objeto: contrato.objeto,
                    fatura_id: Number(rawFatura.id) || faturaMapeada.api_fatura_id,
                    numero_instrumento_cobranca: faturaMapeada.numero_instrumento_cobranca,
                    situacao: faturaMapeada.situacao,
                    valor_bruto: faturaMapeada.valor_bruto,
                    valor_liquido: faturaMapeada.valor_liquido,
                    data_emissao: faturaMapeada.data_emissao,
                    data_vencimento: faturaMapeada.data_vencimento,
                    data_pagamento: faturaMapeada.data_pagamento,
                    data_liquidacao: dataLiquidacao,
                    processo,
                    empenho_numero: String(matchingEmpenho.numero_empenho ?? matchingEmpenho.numero ?? '').trim(),
                    valor_empenho: toNumber(matchingEmpenho.valor_empenho),
                    subelemento: matchingEmpenho.subelemento == null ? null : String(matchingEmpenho.subelemento),
                  }));
                });
              } catch (error) {
                console.warn(
                  `Contratos API: falha ao consultar faturas publicas do contrato ${contrato.api_contrato_id}`,
                  error,
                );
                return [];
              }
            },
            4,
          )
        ).flat();

        const uniqueLiquidacoes = new Map<string, ContratoApiPublicLiquidacaoRow>();
        for (const liquidacao of liquidacoes) {
          const key = `${liquidacao.contrato_api_id}:${liquidacao.fatura_id}:${liquidacao.empenho_numero}`;
          if (!uniqueLiquidacoes.has(key)) {
            uniqueLiquidacoes.set(key, liquidacao);
          }
        }

        return Array.from(uniqueLiquidacoes.values()).sort((a, b) => {
          const dateA = a.data_emissao ? new Date(a.data_emissao).getTime() : 0;
          const dateB = b.data_emissao ? new Date(b.data_emissao).getTime() : 0;
          return dateB - dateA;
        });
      },
    );
  },

  async getLastSyncRun(unidadeCodigo?: string): Promise<ContratoApiSyncRun | null> {
    let query = supabase
      .from('contratos_api_sync_runs')
      .select(CONTRATOS_API_SYNC_RUNS_SELECT)
      .order('started_at', { ascending: false })
      .limit(1);

    if (unidadeCodigo) {
      query = query.eq('unidade_codigo', unidadeCodigo);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throwMigrationRequired(error);
    return (data as ContratoApiSyncRun | null) ?? null;
  },

  async runSync(unidadeCodigos?: string[]) {
    const { data, error } = await supabase.functions.invoke('sync-contratos-comprasnet', {
      body: {
        unidadeCodigos,
        source: 'frontend-manual',
      },
    });

    if (error) throw error;
    return data;
  },
};
