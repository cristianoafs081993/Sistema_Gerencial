import { supabase } from '@/lib/supabase';
import { DEFAULT_PNCP_UASGS } from '@/lib/licitacoesPncp';
import { normalizeAtaUasg } from '@/lib/atasRegistroPrecos';

const ATAS_SELECT = [
  'id',
  'ata_key',
  'numero_ata',
  'numero_compra',
  'ano_compra',
  'modalidade_codigo',
  'modalidade_nome',
  'unidade_gerenciadora_codigo',
  'unidade_gerenciadora_nome',
  'objeto',
  'data_assinatura',
  'data_vigencia_inicial',
  'data_vigencia_final',
  'raw_data',
  'updated_at',
  'total_itens',
  'unidades_participantes',
  'total_unidades_participantes',
  'unidades_aderentes',
  'total_adesoes',
].join(',');

const SYNC_RUNS_SELECT = 'id,started_at,finished_at,status,unidade_codigos,data_inicial,data_final,total_fetched,total_upserted,error_message,details';
const ITEMS_SELECT = 'id,item_key,ata_key,numero_item,codigo_item,tipo_item,descricao_item,fornecedor_nome,fornecedor_ni,quantidade_homologada,valor_unitario,valor_total';

export type AtaRegistroPrecoVinculoFilter = 'todos' | 'gerenciadora' | 'participante' | 'aderente' | 'qualquer-vinculo';

export type AtasRegistroPrecosListParams = {
  page?: number;
  pageSize?: number;
  uasgCodigo?: string;
  vinculo?: AtaRegistroPrecoVinculoFilter;
  search?: string;
  dataInicial?: string;
  dataFinal?: string;
  apenasVigentes?: boolean;
};

export type AtaRegistroPrecoRow = {
  id: string;
  ataKey: string;
  numeroAta: string;
  numeroCompra: string | null;
  anoCompra: number | null;
  modalidadeCodigo: string | null;
  modalidadeNome: string | null;
  unidadeGerenciadoraCodigo: string;
  unidadeGerenciadoraNome: string | null;
  objeto: string | null;
  dataAssinatura: string | null;
  dataVigenciaInicial: string | null;
  dataVigenciaFinal: string | null;
  rawData: Record<string, unknown>;
  updatedAt: string;
  totalItens: number;
  unidadesParticipantes: string[];
  totalUnidadesParticipantes: number;
  unidadesAderentes: string[];
  totalAdesoes: number;
  itemCorrespondente: AtaRegistroPrecoItemRow | null;
};

export type AtaRegistroPrecoItemRow = {
  id: string;
  itemKey: string;
  ataKey: string;
  numeroItem: string;
  codigoItem: string | null;
  tipoItem: string | null;
  descricaoItem: string | null;
  fornecedorNome: string | null;
  fornecedorNi: string | null;
  quantidadeHomologada: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
};

export type AtaRegistroPrecoUnidadeRow = {
  id: string;
  unidadeItemKey: string;
  itemKey: string;
  ataKey: string;
  unidadeCodigo: string;
  unidadeNome: string | null;
  quantidadeAutorizada: number | null;
  quantidadeUtilizada: number | null;
  saldoQuantidade: number | null;
  tipoUnidade: string | null;
  quantidadeRegistrada: number | null;
  saldoRemanejamento: number | null;
  numeroItem: string | null;
  rawData: Record<string, unknown>;
};

export type AtasRegistroPrecosSyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'partial_success' | 'error';
  unidadeCodigos: string[];
  dataInicial: string;
  dataFinal: string;
  totalFetched: number;
  totalUpserted: number;
  errorMessage: string | null;
  details: Record<string, unknown>;
};

export type AtasRegistroPrecosSyncResult = {
  runId: string;
  status: 'success' | 'partial_success' | 'error';
  fetched: number;
  upserted: number;
  counts?: Record<string, number>;
  errors?: Array<{ scope: string; message: string }>;
};

type DbRow = Record<string, unknown>;

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function escapeIlike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

export function buildAtaSearchFilter(value: string) {
  const escaped = escapeIlike(value.trim());
  return [
    `numero_ata.ilike.%${escaped}%`,
    `numero_compra.ilike.%${escaped}%`,
    `objeto.ilike.%${escaped}%`,
    `unidade_gerenciadora_nome.ilike.%${escaped}%`,
    `itens_texto_pesquisa.ilike.%${escaped}%`,
  ].join(',');
}

export function buildAtaItemSearchFilter(value: string) {
  const escaped = escapeIlike(value.trim());
  return [
    `numero_item.ilike.%${escaped}%`,
    `codigo_item.ilike.%${escaped}%`,
    `descricao_item.ilike.%${escaped}%`,
    `fornecedor_nome.ilike.%${escaped}%`,
    `fornecedor_ni.ilike.%${escaped}%`,
  ].join(',');
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error ?? 'Erro desconhecido');
}

export function mapAtaRegistroPrecoRow(row: DbRow): AtaRegistroPrecoRow {
  return {
    id: String(row.id),
    ataKey: String(row.ata_key),
    numeroAta: String(row.numero_ata),
    numeroCompra: stringOrNull(row.numero_compra),
    anoCompra: numberOrNull(row.ano_compra),
    modalidadeCodigo: stringOrNull(row.modalidade_codigo),
    modalidadeNome: stringOrNull(row.modalidade_nome),
    unidadeGerenciadoraCodigo: String(row.unidade_gerenciadora_codigo),
    unidadeGerenciadoraNome: stringOrNull(row.unidade_gerenciadora_nome),
    objeto: stringOrNull(row.objeto),
    dataAssinatura: stringOrNull(row.data_assinatura),
    dataVigenciaInicial: stringOrNull(row.data_vigencia_inicial),
    dataVigenciaFinal: stringOrNull(row.data_vigencia_final),
    rawData: recordOrEmpty(row.raw_data),
    updatedAt: String(row.updated_at),
    totalItens: Number(row.total_itens ?? 0),
    unidadesParticipantes: stringArray(row.unidades_participantes),
    totalUnidadesParticipantes: Number(row.total_unidades_participantes ?? 0),
    unidadesAderentes: stringArray(row.unidades_aderentes),
    totalAdesoes: Number(row.total_adesoes ?? 0),
    itemCorrespondente: null,
  };
}

export function mapAtaRegistroPrecoItemRow(row: DbRow): AtaRegistroPrecoItemRow {
  return {
    id: String(row.id),
    itemKey: String(row.item_key),
    ataKey: String(row.ata_key),
    numeroItem: String(row.numero_item),
    codigoItem: stringOrNull(row.codigo_item),
    tipoItem: stringOrNull(row.tipo_item),
    descricaoItem: stringOrNull(row.descricao_item),
    fornecedorNome: stringOrNull(row.fornecedor_nome),
    fornecedorNi: stringOrNull(row.fornecedor_ni),
    quantidadeHomologada: numberOrNull(row.quantidade_homologada),
    valorUnitario: numberOrNull(row.valor_unitario),
    valorTotal: numberOrNull(row.valor_total),
  };
}

export function mapAtaRegistroPrecoUnidadeRow(row: DbRow): AtaRegistroPrecoUnidadeRow {
  const raw = recordOrEmpty(row.raw_data);
  return {
    id: String(row.id),
    unidadeItemKey: String(row.unidade_item_key),
    itemKey: String(row.item_key),
    ataKey: String(row.ata_key),
    unidadeCodigo: String(row.unidade_codigo),
    unidadeNome: stringOrNull(row.unidade_nome),
    quantidadeAutorizada: numberOrNull(row.quantidade_autorizada),
    quantidadeUtilizada: numberOrNull(row.quantidade_utilizada),
    saldoQuantidade: numberOrNull(row.saldo_quantidade),
    tipoUnidade: stringOrNull(raw.tipoUnidade || raw.tipo_unidade),
    quantidadeRegistrada: numberOrNull(raw.quantidadeRegistrada || raw.quantidade_registrada) ?? numberOrNull(row.quantidade_autorizada),
    saldoRemanejamento: numberOrNull(raw.saldoRemanejamentoEmpenho || raw.saldo_remanejamento_empenho) ?? numberOrNull(row.saldo_quantidade),
    numeroItem: stringOrNull(raw.numeroItem || raw.numero_item),
    rawData: raw,
  };
}

export function mapAtaRegistroPrecoSyncRun(row: DbRow): AtasRegistroPrecosSyncRun {
  return {
    id: String(row.id),
    startedAt: String(row.started_at),
    finishedAt: stringOrNull(row.finished_at),
    status: String(row.status) as AtasRegistroPrecosSyncRun['status'],
    unidadeCodigos: stringArray(row.unidade_codigos),
    dataInicial: String(row.data_inicial),
    dataFinal: String(row.data_final),
    totalFetched: Number(row.total_fetched ?? 0),
    totalUpserted: Number(row.total_upserted ?? 0),
    errorMessage: stringOrNull(row.error_message),
    details: recordOrEmpty(row.details),
  };
}

export const atasRegistroPrecosService = {
  async list(params: AtasRegistroPrecosListParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.max(10, params.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const uasgCodigo = normalizeAtaUasg(params.uasgCodigo);

    let query = supabase
      .from('atas_registro_precos_resumo')
      .select(ATAS_SELECT, { count: 'exact' });

    if (uasgCodigo) {
      if (params.vinculo === 'gerenciadora') {
        query = query.eq('unidade_gerenciadora_codigo', uasgCodigo);
      } else if (params.vinculo === 'participante') {
        query = query.contains('unidades_participantes', [uasgCodigo]);
      } else if (params.vinculo === 'aderente') {
        query = query.contains('unidades_aderentes', [uasgCodigo]);
      } else if (params.vinculo === 'qualquer-vinculo') {
        query = query.or([
          `unidade_gerenciadora_codigo.eq.${uasgCodigo}`,
          `unidades_participantes.cs.{${uasgCodigo}}`,
          `unidades_aderentes.cs.{${uasgCodigo}}`,
        ].join(','));
      }
    }

    if (params.dataInicial) query = query.gte('data_vigencia_inicial', `${params.dataInicial}T00:00:00.000Z`);
    if (params.dataFinal) query = query.lte('data_vigencia_inicial', `${params.dataFinal}T23:59:59.999Z`);
    if (params.apenasVigentes) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte('data_vigencia_final', `${today}T00:00:00.000Z`);
    }

    const search = params.search?.trim();
    if (search) {
      query = query.or(buildAtaSearchFilter(search));
    }

    const { data, error, count } = await query
      .order('data_vigencia_inicial', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) throw error;
    let rows = (data ?? []).map((row) => mapAtaRegistroPrecoRow(row as DbRow));
    if (search && rows.length > 0) {
      const { data: matchedItems, error: matchedItemsError } = await supabase
        .from('atas_registro_precos_itens')
        .select(ITEMS_SELECT)
        .in('ata_key', rows.map((row) => row.ataKey))
        .or(buildAtaItemSearchFilter(search))
        .order('numero_item');

      if (matchedItemsError) throw matchedItemsError;

      const firstMatchByAta = new Map<string, AtaRegistroPrecoItemRow>();
      for (const rawItem of matchedItems ?? []) {
        const item = mapAtaRegistroPrecoItemRow(rawItem as DbRow);
        if (!firstMatchByAta.has(item.ataKey)) {
          firstMatchByAta.set(item.ataKey, item);
        }
      }

      rows = rows.map((row) => ({
        ...row,
        itemCorrespondente: firstMatchByAta.get(row.ataKey) ?? null,
      }));
    }

    return {
      rows,
      count: count ?? 0,
    };
  },

  async listItems(ataKey: string): Promise<AtaRegistroPrecoItemRow[]> {
    const { data, error } = await supabase
      .from('atas_registro_precos_itens')
      .select(ITEMS_SELECT)
      .eq('ata_key', ataKey)
      .order('numero_item');

    if (error) throw error;
    return (data ?? []).map((row) => mapAtaRegistroPrecoItemRow(row as DbRow));
  },

  async listUnidades(ataKey: string): Promise<AtaRegistroPrecoUnidadeRow[]> {
    if (!ataKey) return [];
    const { data, error } = await supabase
      .from('atas_registro_precos_unidades')
      .select('id,unidade_item_key,item_key,ata_key,unidade_codigo,unidade_nome,quantidade_autorizada,quantidade_utilizada,saldo_quantidade,raw_data')
      .eq('ata_key', ataKey);

    if (error) throw error;
    return (data ?? []).map((row) => mapAtaRegistroPrecoUnidadeRow(row as DbRow));
  },

  async getLastSyncRun(): Promise<AtasRegistroPrecosSyncRun | null> {
    const { data, error } = await supabase
      .from('atas_registro_precos_sync_runs')
      .select(SYNC_RUNS_SELECT)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapAtaRegistroPrecoSyncRun(data as DbRow) : null;
  },

  async sync(input: {
    unidadeCodigos?: string[];
    dataInicial?: string;
    dataFinal?: string;
    objetoBusca?: string;
    numeroAta?: string;
    includeDetalhes?: boolean;
    includeParticipantes?: boolean;
    includeAdesoes?: boolean;
    adesaoUnidadeCodigos?: string[];
    source?: string;
  } = {}) {
    const unidadeCodigos = input.unidadeCodigos
      ?.map((codigo) => normalizeAtaUasg(codigo))
      .filter(Boolean) as string[] | undefined;
    const adesaoUnidadeCodigos = input.adesaoUnidadeCodigos
      ?.map((codigo) => normalizeAtaUasg(codigo))
      .filter(Boolean) as string[] | undefined;

    const { data, error } = await supabase.functions.invoke('sync-atas-registro-precos', {
      body: {
        unidadeCodigos: unidadeCodigos?.length ? unidadeCodigos : undefined,
        adesaoUnidadeCodigos: adesaoUnidadeCodigos?.length ? adesaoUnidadeCodigos : undefined,
        dataInicial: input.dataInicial,
        dataFinal: input.dataFinal,
        objetoBusca: input.objetoBusca?.trim() || undefined,
        numeroAta: input.numeroAta?.trim() || undefined,
        includeDetalhes: input.includeDetalhes,
        includeParticipantes: input.includeParticipantes,
        includeAdesoes: input.includeAdesoes,
        source: input.source ?? 'frontend-manual',
      },
    });

    if (error) throw error;
    const result = data as AtasRegistroPrecosSyncResult;
    return result;
  },

  async syncInternalUasgs(input: {
    dataInicial?: string;
    dataFinal?: string;
    objetoBusca?: string;
    includeParticipantes?: boolean;
    includeAdesoes?: boolean;
    adesaoUnidadeCodigos?: string[];
    source?: string;
  } = {}) {
    const results = [];
    for (const unidadeCodigo of DEFAULT_PNCP_UASGS) {
      try {
        results.push(await this.sync({
          unidadeCodigos: [unidadeCodigo],
          dataInicial: input.dataInicial,
          dataFinal: input.dataFinal,
          objetoBusca: input.objetoBusca,
          adesaoUnidadeCodigos: input.adesaoUnidadeCodigos,
          includeDetalhes: false,
          includeParticipantes: input.includeParticipantes,
          includeAdesoes: input.includeAdesoes,
          source: input.source ?? 'frontend-ifrn-cache',
        }));
      } catch (error) {
        results.push({
          runId: '',
          status: 'error' as const,
          fetched: 0,
          upserted: 0,
          counts: {},
          errors: [{
            scope: `${unidadeCodigo}:invoke`,
            message: errorToMessage(error),
          }],
        });
      }
    }

    const errors = results.flatMap((result) => result.errors ?? []);
    const hasPartial = results.some((result) => result.status === 'partial_success');
    return {
      runId: results.at(-1)?.runId ?? '',
      status: errors.length || hasPartial ? 'partial_success' : 'success',
      fetched: results.reduce((sum, result) => sum + result.fetched, 0),
      upserted: results.reduce((sum, result) => sum + result.upserted, 0),
      counts: results.reduce<Record<string, number>>((acc, result) => {
        for (const [key, value] of Object.entries(result.counts ?? {})) {
          acc[key] = (acc[key] ?? 0) + value;
        }
        return acc;
      }, {}),
      errors,
    };
  },
};
