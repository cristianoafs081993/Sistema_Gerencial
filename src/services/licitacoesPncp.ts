import { supabase } from '@/lib/supabase';
import {
  DEFAULT_PNCP_UASG,
  DEFAULT_PNCP_UASGS,
  IFRN_CNPJ,
  IFRN_UASG_CATALOG,
  buildComprasGovCompraKey,
  buildPncpCompraUrl,
} from '@/lib/licitacoesPncp';

const SYNC_FUNCTION_UNAVAILABLE_MESSAGE = [
  'Nao foi possivel acessar a Edge Function sync-licitacoes-pncp.',
  'Verifique se a function foi publicada no Supabase remoto e se o preflight CORS responde HTTP 200.',
].join(' ');

const LICITACOES_SELECT = [
  'id',
  'numero_controle_pncp',
  'cnpj_orgao',
  'razao_social_orgao',
  'ano_compra',
  'sequencial_compra',
  'numero_compra',
  'processo',
  'objeto_compra',
  'modalidade_id',
  'modalidade_nome',
  'modo_disputa_id',
  'modo_disputa_nome',
  'situacao_compra_id',
  'situacao_compra_nome',
  'uasg_codigo',
  'uasg_nome',
  'unidade_uf',
  'unidade_municipio',
  'unidade_codigo_ibge',
  'valor_total_estimado',
  'valor_total_homologado',
  'srp',
  'data_publicacao_pncp',
  'data_abertura_proposta',
  'data_encerramento_proposta',
  'data_inclusao',
  'data_atualizacao',
  'data_atualizacao_global',
  'amparo_legal_codigo',
  'amparo_legal_nome',
  'amparo_legal_descricao',
  'tipo_instrumento_convocatorio_codigo',
  'tipo_instrumento_convocatorio_nome',
  'usuario_nome',
  'informacao_complementar',
  'link_sistema_origem',
  'link_processo_eletronico',
  'raw_data',
  'compras_gov_data',
  'updated_at',
].join(',');

const SYNC_RUNS_SELECT = 'id,started_at,finished_at,status,cnpj_orgao,unidade_codigos,data_inicial,data_final,modalidade_id,total_windows,total_fetched,total_upserted,error_message,details';

export type LicitacaoPncpProposalStatus = 'todos' | 'abertas' | 'encerradas' | 'futuras';
export type LicitacaoPncpSrpFilter = 'todos' | 'sim' | 'nao';

export type LicitacoesPncpListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  objetoBusca?: string;
  itemBusca?: string;
  uasgCodigo?: string;
  situacao?: string;
  srp?: LicitacaoPncpSrpFilter;
  proposalStatus?: LicitacaoPncpProposalStatus;
  dataInicial?: string;
  dataFinal?: string;
};

export type LicitacaoPncpRow = {
  id: string;
  numeroControlePncp: string;
  cnpjOrgao: string;
  razaoSocialOrgao: string | null;
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra: string | null;
  processo: string | null;
  objetoCompra: string | null;
  modalidadeId: number | null;
  modalidadeNome: string | null;
  modoDisputaId: number | null;
  modoDisputaNome: string | null;
  situacaoCompraId: number | null;
  situacaoCompraNome: string | null;
  uasgCodigo: string | null;
  uasgNome: string | null;
  unidadeUf: string | null;
  unidadeMunicipio: string | null;
  unidadeCodigoIbge: string | null;
  valorTotalEstimado: number | null;
  valorTotalHomologado: number | null;
  srp: boolean | null;
  dataPublicacaoPncp: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  dataInclusao: string | null;
  dataAtualizacao: string | null;
  dataAtualizacaoGlobal: string | null;
  amparoLegalCodigo: number | null;
  amparoLegalNome: string | null;
  amparoLegalDescricao: string | null;
  tipoInstrumentoConvocatorioCodigo: number | null;
  tipoInstrumentoConvocatorioNome: string | null;
  usuarioNome: string | null;
  informacaoComplementar: string | null;
  linkSistemaOrigem: string | null;
  linkProcessoEletronico: string | null;
  rawData: Record<string, unknown>;
  comprasGovData: Record<string, unknown>;
  updatedAt: string;
};

export type LicitacaoPncpUasgOption = {
  codigo: string;
  nome: string | null;
};

export type LicitacoesPncpListResult = {
  rows: LicitacaoPncpRow[];
  count: number;
};

export type LicitacoesPncpSyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'partial_success' | 'error';
  cnpjOrgao: string;
  unidadeCodigos: string[];
  dataInicial: string;
  dataFinal: string;
  modalidadeId: number;
  totalWindows: number;
  totalFetched: number;
  totalUpserted: number;
  errorMessage: string | null;
  details: Record<string, unknown>;
};

type DbLicitacaoRow = Record<string, unknown>;
type DbSyncRunRow = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value);
  return normalized.trim() ? normalized : null;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

function normalizeUasgCodigo(value?: string) {
  const normalized = value?.replace(/\D/g, '') ?? '';
  return normalized || null;
}

function getUnknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function normalizeLicitacoesPncpSyncError(error: unknown): Error {
  const record = getUnknownRecord(error);
  const message = error instanceof Error ? error.message : stringOrNull(record?.message) ?? String(error);
  const name = stringOrNull(record?.name);
  const context = getUnknownRecord(record?.context);
  const status = Number(context?.status ?? record?.status);

  if (
    name === 'FunctionsFetchError'
    || status === 404
    || /failed to fetch|fetch failed|networkerror|cors/i.test(message)
  ) {
    return new Error(SYNC_FUNCTION_UNAVAILABLE_MESSAGE);
  }

  return error instanceof Error ? error : new Error(message);
}

export function mapLicitacaoPncpRow(row: DbLicitacaoRow): LicitacaoPncpRow {
  const match = String(row.numero_controle_pncp || '').match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
  const cnpjFromCtrl = match ? match[1] : '';
  const seqFromCtrl = match ? Number(match[2]) : 0;
  const yearFromCtrl = match ? Number(match[3]) : 0;

  return {
    id: String(row.id),
    numeroControlePncp: String(row.numero_controle_pncp),
    cnpjOrgao: (row.cnpj_orgao && String(row.cnpj_orgao) !== 'null')
      ? String(row.cnpj_orgao)
      : (cnpjFromCtrl || IFRN_CNPJ),
    razaoSocialOrgao: stringOrNull(row.razao_social_orgao),
    anoCompra: Number(row.ano_compra) || yearFromCtrl,
    sequencialCompra: Number(row.sequencial_compra) || seqFromCtrl,
    numeroCompra: stringOrNull(row.numero_compra),
    processo: stringOrNull(row.processo),
    objetoCompra: stringOrNull(row.objeto_compra),
    modalidadeId: numberOrNull(row.modalidade_id),
    modalidadeNome: stringOrNull(row.modalidade_nome),
    modoDisputaId: numberOrNull(row.modo_disputa_id),
    modoDisputaNome: stringOrNull(row.modo_disputa_nome),
    situacaoCompraId: numberOrNull(row.situacao_compra_id),
    situacaoCompraNome: stringOrNull(row.situacao_compra_nome),
    uasgCodigo: stringOrNull(row.uasg_codigo),
    uasgNome: stringOrNull(row.uasg_nome),
    unidadeUf: stringOrNull(row.unidade_uf),
    unidadeMunicipio: stringOrNull(row.unidade_municipio),
    unidadeCodigoIbge: stringOrNull(row.unidade_codigo_ibge),
    valorTotalEstimado: numberOrNull(row.valor_total_estimado),
    valorTotalHomologado: numberOrNull(row.valor_total_homologado),
    srp: typeof row.srp === 'boolean' ? row.srp : null,
    dataPublicacaoPncp: stringOrNull(row.data_publicacao_pncp),
    dataAberturaProposta: stringOrNull(row.data_abertura_proposta),
    dataEncerramentoProposta: stringOrNull(row.data_encerramento_proposta),
    dataInclusao: stringOrNull(row.data_inclusao),
    dataAtualizacao: stringOrNull(row.data_atualizacao),
    dataAtualizacaoGlobal: stringOrNull(row.data_atualizacao_global),
    amparoLegalCodigo: numberOrNull(row.amparo_legal_codigo),
    amparoLegalNome: stringOrNull(row.amparo_legal_nome),
    amparoLegalDescricao: stringOrNull(row.amparo_legal_descricao),
    tipoInstrumentoConvocatorioCodigo: numberOrNull(row.tipo_instrumento_convocatorio_codigo),
    tipoInstrumentoConvocatorioNome: stringOrNull(row.tipo_instrumento_convocatorio_nome),
    usuarioNome: stringOrNull(row.usuario_nome),
    informacaoComplementar: stringOrNull(row.informacao_complementar),
    linkSistemaOrigem: stringOrNull(row.link_sistema_origem),
    linkProcessoEletronico: stringOrNull(row.link_processo_eletronico),
    rawData: recordOrEmpty(row.raw_data),
    comprasGovData: recordOrEmpty(row.compras_gov_data),
    updatedAt: String(row.updated_at),
  };
}

export function mapLicitacaoPncpSyncRun(row: DbSyncRunRow): LicitacoesPncpSyncRun {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: stringOrNull(row.finished_at),
    status: String(row.status) as LicitacoesPncpSyncRun['status'],
    cnpjOrgao: String(row.cnpj_orgao),
    unidadeCodigos: Array.isArray(row.unidade_codigos) ? row.unidade_codigos.map(String) : [],
    dataInicial: String(row.data_inicial),
    dataFinal: String(row.data_final),
    modalidadeId: Number(row.modalidade_id),
    totalWindows: Number(row.total_windows ?? 0),
    totalFetched: Number(row.total_fetched ?? 0),
    totalUpserted: Number(row.total_upserted ?? 0),
    errorMessage: stringOrNull(row.error_message),
    details: recordOrEmpty(row.details),
  };
}

export function getProposalStatus(row: Pick<LicitacaoPncpRow, 'dataAberturaProposta' | 'dataEncerramentoProposta'>, now = new Date()) {
  const abertura = row.dataAberturaProposta ? new Date(row.dataAberturaProposta) : null;
  const encerramento = row.dataEncerramentoProposta ? new Date(row.dataEncerramentoProposta) : null;

  if (abertura && now < abertura) return 'Futura';
  if (abertura && encerramento && now >= abertura && now <= encerramento) return 'Aberta';
  if (encerramento && now > encerramento) return 'Encerrada';
  return 'Sem prazo';
}

export function getLicitacaoLinks(row: LicitacaoPncpRow) {
  const pncpUrl = buildPncpCompraUrl(row.cnpjOrgao || IFRN_CNPJ, row.anoCompra, row.sequencialCompra);
  const comprasKey = buildComprasGovCompraKey(row.uasgCodigo, row.modalidadeId, row.numeroCompra, row.anoCompra);

  return {
    pncpUrl,
    comprasGovUrl: row.linkSistemaOrigem,
    comprasKey,
  };
}

export const licitacoesPncpService = {
  async list(params: LicitacoesPncpListParams = {}): Promise<LicitacoesPncpListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(10, params.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('licitacoes_pncp')
      .select(LICITACOES_SELECT, { count: 'exact' });

    const uasgCodigo = normalizeUasgCodigo(params.uasgCodigo);
    if (uasgCodigo) {
      query = query.eq('uasg_codigo', uasgCodigo);
    }

    if (params.situacao && params.situacao !== 'todos') {
      query = query.eq('situacao_compra_nome', params.situacao);
    }

    if (params.srp === 'sim') query = query.eq('srp', true);
    if (params.srp === 'nao') query = query.eq('srp', false);

    if (params.dataInicial) {
      query = query.gte('data_publicacao_pncp', `${params.dataInicial}T00:00:00.000Z`);
    }
    if (params.dataFinal) {
      query = query.lte('data_publicacao_pncp', `${params.dataFinal}T23:59:59.999Z`);
    }

    const now = new Date().toISOString();
    if (params.proposalStatus === 'abertas') {
      query = query.lte('data_abertura_proposta', now).gte('data_encerramento_proposta', now);
    } else if (params.proposalStatus === 'encerradas') {
      query = query.lt('data_encerramento_proposta', now);
    } else if (params.proposalStatus === 'futuras') {
      query = query.gt('data_abertura_proposta', now);
    }

    const objetoBusca = params.objetoBusca?.trim();
    if (objetoBusca) {
      query = query.ilike('objeto_compra', `%${escapeIlike(objetoBusca)}%`);
    }

    const itemBusca = params.itemBusca?.trim();
    if (itemBusca) {
      query = query.filter('raw_data->>itens', 'ilike', `%${escapeIlike(itemBusca)}%`);
    }

    const search = params.search?.trim();
    if (search) {
      const escaped = escapeIlike(search);
      query = query.or([
        `numero_controle_pncp.ilike.%${escaped}%`,
        `numero_compra.ilike.%${escaped}%`,
        `processo.ilike.%${escaped}%`,
        `uasg_nome.ilike.%${escaped}%`,
      ].join(','));
    }

    const { data, error, count } = await query
      .order('data_publicacao_pncp', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) throw error;
    return {
      rows: (data ?? []).map((row) => mapLicitacaoPncpRow(row as DbLicitacaoRow)),
      count: count ?? 0,
    };
  },

  async listUasgs(): Promise<LicitacaoPncpUasgOption[]> {
    const { data, error } = await supabase
      .from('licitacoes_pncp')
      .select('uasg_codigo,uasg_nome')
      .not('uasg_codigo', 'is', null)
      .order('uasg_codigo');

    if (error) throw error;

    const options = new Map<string, LicitacaoPncpUasgOption>();
    for (const row of data ?? []) {
      const codigo = stringOrNull((row as DbLicitacaoRow).uasg_codigo);
      if (!codigo) continue;
      if (!options.has(codigo)) {
        options.set(codigo, {
          codigo,
          nome: stringOrNull((row as DbLicitacaoRow).uasg_nome),
        });
      }
    }

    if (!options.has(DEFAULT_PNCP_UASG)) {
      options.set(DEFAULT_PNCP_UASG, {
        codigo: DEFAULT_PNCP_UASG,
        nome: 'Campus Currais Novos',
      });
    }

    for (const item of IFRN_UASG_CATALOG) {
      if (!options.has(item.codigo)) {
        options.set(item.codigo, {
          codigo: item.codigo,
          nome: item.aliases?.length ? `${item.nome} (${item.aliases.join(', ')})` : item.nome,
        });
      }
    }

    return Array.from(options.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  },

  async listSituacoes(): Promise<string[]> {
    const { data, error } = await supabase
      .from('licitacoes_pncp')
      .select('situacao_compra_nome')
      .not('situacao_compra_nome', 'is', null)
      .order('situacao_compra_nome');

    if (error) throw error;

    return Array.from(new Set((data ?? [])
      .map((row) => stringOrNull((row as DbLicitacaoRow).situacao_compra_nome))
      .filter(Boolean) as string[]));
  },

  async getLastSyncRun(): Promise<LicitacoesPncpSyncRun | null> {
    const { data, error } = await supabase
      .from('licitacoes_pncp_sync_runs')
      .select(SYNC_RUNS_SELECT)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapLicitacaoPncpSyncRun(data as DbSyncRunRow) : null;
  },

  async sync(input: {
    unidadeCodigos?: string[];
    objetoBusca?: string;
    itemBusca?: string;
    dataInicial?: string;
    dataFinal?: string;
    source?: string;
  } = {}) {
    const unidadeCodigos = input.unidadeCodigos
      ?.map((codigo) => normalizeUasgCodigo(codigo))
      .filter(Boolean) as string[] | undefined;

    const { data, error } = await supabase.functions.invoke('sync-licitacoes-pncp', {
      body: {
        unidadeCodigos: unidadeCodigos?.length ? unidadeCodigos : undefined,
        objetoBusca: input.objetoBusca?.trim() || undefined,
        itemBusca: input.itemBusca?.trim() || undefined,
        dataInicial: input.dataInicial,
        dataFinal: input.dataFinal,
        source: input.source ?? 'frontend-manual',
      },
    });

    if (error) throw normalizeLicitacoesPncpSyncError(error);
    const result = data as {
      runId: string;
      status: string;
      fetched: number;
      uniqueRows: number;
      matchedRows?: number;
      upserted: number;
      errors?: Array<{ scope: string; message: string }>;
    };
    if (result.status === 'error') {
      const firstError = result.errors?.[0];
      throw new Error(firstError
        ? `Falha ao buscar no PNCP (${firstError.scope}): ${firstError.message}`
        : 'Falha ao buscar no PNCP.');
    }
    return result;
  },

  async syncInternalUasgs(input: {
    dataInicial?: string;
    dataFinal?: string;
    source?: string;
  } = {}) {
    const results = [];
    for (const unidadeCodigo of DEFAULT_PNCP_UASGS) {
      results.push(await this.sync({
        unidadeCodigos: [unidadeCodigo],
        dataInicial: input.dataInicial,
        dataFinal: input.dataFinal,
        source: input.source ?? 'frontend-ifrn-cache',
      }));
    }

    const errors = results.flatMap((result) => result.errors ?? []);
    const hasPartial = results.some((result) => result.status === 'partial_success');
    return {
      runId: results.at(-1)?.runId ?? '',
      status: errors.length || hasPartial ? 'partial_success' : 'success',
      fetched: results.reduce((sum, result) => sum + result.fetched, 0),
      uniqueRows: results.reduce((sum, result) => sum + result.uniqueRows, 0),
      matchedRows: results.reduce((sum, result) => sum + (result.matchedRows ?? 0), 0),
      upserted: results.reduce((sum, result) => sum + result.upserted, 0),
      errors,
    };
  },

  async enrichExistingItems() {
    const { data, error } = await supabase.functions.invoke('sync-licitacoes-pncp', {
      body: {
        enrichExistingItems: true,
      },
    });

    if (error) throw normalizeLicitacoesPncpSyncError(error);
    return data as {
      status: string;
      totalChecked: number;
      totalEligible: number;
      enrichedCount: number;
      errors?: Array<{ numeroControle: string; message: string }>;
    };
  },

  async fetchItems(cnpj: string, anoCompra: number, sequencialCompra: number): Promise<Record<string, unknown>[]> {
    const url = buildPncpItemsUrl({ cnpj, anoCompra, sequencialCompra });
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.data ?? data?.itens ?? []);
    } catch {
      return [];
    }
  },
};
