import { supabase } from '@/lib/supabase';

const CONTRATOS_API_BASE = '/api-contratos/api';
const DEFAULT_UASG = '158366';
const MIGRATION_REQUIRED_MESSAGE =
  'MIGRATION_REQUIRED: tabelas do módulo de contratos API ainda não existem no banco. Aplique as migrations do Supabase.';

type ApiContrato = Record<string, unknown>;
type ApiEmpenho = Record<string, unknown>;
type ApiFatura = Record<string, unknown>;

export interface ContratoApiRow {
  id: string;
  api_contrato_id: number;
  numero: string;
  fornecedor_nome: string | null;
  objeto: string | null;
  processo: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  valor_global: number | null;
  valor_acumulado: number | null;
  situacao: boolean | null;
  updated_at: string;
}

export interface ContratoApiEmpenhoRow {
  id: string;
  contrato_api_id: string;
  numero: string;
  valor_empenhado: number | null;
  valor_a_liquidar: number | null;
  valor_liquidado: number | null;
  valor_pago: number | null;
}

export interface ContratoApiFaturaRow {
  id: string;
  contrato_api_id: string;
  numero_instrumento_cobranca: string | null;
  situacao: string | null;
  valor_bruto: number | null;
  valor_liquido: number | null;
  data_emissao: string | null;
  data_pagamento: string | null;
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
  error_message: string | null;
  details: Record<string, unknown> | null;
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  return Number(cleaned) || 0;
}

function toDate(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API ${res.status} em ${url}`);
  }
  return res.json() as Promise<T>;
}

function mapContrato(raw: ApiContrato, situacao: boolean) {
  const contratante = (raw.contratante as Record<string, unknown> | undefined) ?? {};
  const unidadeOrigem = (contratante.unidade_gestora_origem as Record<string, unknown> | undefined) ?? {};
  const orgaoOrigem = (contratante.orgao_origem as Record<string, unknown> | undefined) ?? {};
  const fornecedor = (raw.fornecedor as Record<string, unknown> | undefined) ?? {};

  return {
    api_contrato_id: Number(raw.id),
    numero: String(raw.numero ?? '').trim(),
    receita_despesa: String(raw.receita_despesa ?? ''),
    orgao_codigo: String(raw.orgao_codigo ?? orgaoOrigem.codigo ?? ''),
    orgao_nome: String(raw.orgao_nome ?? orgaoOrigem.nome ?? ''),
    unidade_codigo: String(raw.unidade_codigo ?? unidadeOrigem.codigo ?? ''),
    unidade_nome: String(raw.unidade_nome ?? unidadeOrigem.nome ?? ''),
    unidade_nome_resumido: String(raw.unidade_nome_resumido ?? unidadeOrigem.nome_resumido ?? ''),
    unidade_origem_codigo: String(raw.unidade_origem_codigo ?? unidadeOrigem.codigo ?? ''),
    unidade_origem_nome: String(raw.unidade_origem_nome ?? unidadeOrigem.nome ?? ''),
    fornecedor_tipo: String(raw.fornecedor_tipo ?? fornecedor.tipo ?? ''),
    fornecedor_documento: String(raw.fonecedor_cnpj_cpf_idgener ?? raw.fornecedor_cnpj_cpf_idgener ?? fornecedor.cnpj_cpf_idgener ?? ''),
    fornecedor_nome: String(raw.fornecedor_nome ?? fornecedor.nome ?? ''),
    categoria: String(raw.categoria ?? ''),
    objeto: String(raw.objeto ?? ''),
    processo: String(raw.processo ?? ''),
    vigencia_inicio: toDate(raw.vigencia_inicio),
    vigencia_fim: toDate(raw.vigencia_fim),
    valor_global: toNumber(raw.valor_global),
    valor_acumulado: toNumber(raw.valor_acumulado),
    situacao,
    raw_data: raw,
  };
}

function mapEmpenho(contratoApiId: string, raw: ApiEmpenho) {
  return {
    contrato_api_id: contratoApiId,
    api_empenho_id: Number(raw.id),
    numero: String(raw.numero ?? '').trim(),
    unidade_gestora: String(raw.unidade_gestora ?? ''),
    gestao: String(raw.gestao ?? ''),
    data_emissao: toDate(raw.data_emissao),
    credor: String(raw.credor ?? ''),
    fonte_recurso: String(raw.fonte_recurso ?? ''),
    plano_interno: String(raw.planointerno ?? ''),
    natureza_despesa: String(raw.naturezadespesa ?? ''),
    valor_empenhado: toNumber(raw.empenhado),
    valor_a_liquidar: toNumber(raw.aliquidar),
    valor_liquidado: toNumber(raw.liquidado),
    valor_pago: toNumber(raw.pago),
    rp_inscrito: toNumber(raw.rpinscrito),
    rp_a_pagar: toNumber(raw.rpapagar),
    raw_data: raw,
  };
}

function mapFatura(contratoApiId: string, raw: ApiFatura) {
  return {
    contrato_api_id: contratoApiId,
    api_fatura_id: Number(raw.id),
    tipo_lista_fatura: String(raw.tipolistafatura_id ?? ''),
    tipo_instrumento_cobranca: String(raw.tipo_instrumento_cobranca ?? ''),
    numero_instrumento_cobranca: String(raw.numero_instrumento_cobranca ?? ''),
    mes_referencia: String(raw.mes_referencia ?? ''),
    ano_referencia: String(raw.ano_referencia ?? ''),
    data_emissao: toDate(raw.data_emissao),
    data_vencimento: toDate(raw.data_vencimento),
    data_pagamento: toDate(raw.data_pagamento),
    situacao: String(raw.situacao ?? ''),
    valor_bruto: toNumber(raw.valor_bruto),
    valor_liquido: toNumber(raw.valor_liquido),
    raw_data: raw,
  };
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

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string };
  return (
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
      .select('id, api_contrato_id, numero, fornecedor_nome, objeto, processo, vigencia_inicio, vigencia_fim, valor_global, valor_acumulado, situacao, updated_at')
      .order('numero', { ascending: true });

    if (onlyVigentes) {
      query = query
        .eq('situacao', true)
        .or(`vigencia_fim.is.null,vigencia_fim.gte.${today}`);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    return (data ?? []) as ContratoApiRow[];
  },

  async getEmpenhosApi(contratoApiIds?: string[]): Promise<ContratoApiEmpenhoRow[]> {
    let query = supabase
      .from('contratos_api_empenhos')
      .select('id, contrato_api_id, numero, valor_empenhado, valor_a_liquidar, valor_liquidado, valor_pago');

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

  async getFaturasApi(contratoApiIds?: string[]): Promise<ContratoApiFaturaRow[]> {
    let query = supabase
      .from('contratos_api_faturas')
      .select('id, contrato_api_id, numero_instrumento_cobranca, situacao, valor_bruto, valor_liquido, data_emissao, data_pagamento');

    if (contratoApiIds && contratoApiIds.length > 0 && contratoApiIds.length <= 100) {
      query = query.in('contrato_api_id', contratoApiIds);
    }

    const { data, error } = await query;

    if (error) throwMigrationRequired(error);
    const all = (data ?? []) as ContratoApiFaturaRow[];
    if (!contratoApiIds || contratoApiIds.length === 0 || contratoApiIds.length <= 100) return all;
    const set = new Set(contratoApiIds);
    return all.filter((row) => set.has(row.contrato_api_id));
  },

  async getLastSyncRun(unidadeCodigo = DEFAULT_UASG): Promise<ContratoApiSyncRun | null> {
    const { data, error } = await supabase
      .from('contratos_api_sync_runs')
      .select('*')
      .eq('unidade_codigo', unidadeCodigo)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throwMigrationRequired(error);
    return (data as ContratoApiSyncRun | null) ?? null;
  },

  async runSync(unidadeCodigo = DEFAULT_UASG) {
    const { data: runInsert, error: runInsertError } = await supabase
      .from('contratos_api_sync_runs')
      .insert({
        unidade_codigo: unidadeCodigo,
        status: 'running',
      })
      .select('id')
      .single();

    if (runInsertError) throwMigrationRequired(runInsertError);
    const runId = runInsert.id as string;

    try {
      const [ativos, inativos] = await Promise.all([
        fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/ug/${unidadeCodigo}`),
        fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/inativo/ug/${unidadeCodigo}`),
      ]);

      const mergedMap = new Map<number, ReturnType<typeof mapContrato>>();
      for (const c of inativos ?? []) {
        const mapped = mapContrato(c, false);
        if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
      }
      for (const c of ativos ?? []) {
        const mapped = mapContrato(c, true);
        if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
      }
      const contratosPayload = Array.from(mergedMap.values());

      const { data: upserted, error: upsertError } = await supabase
        .from('contratos_api')
        .upsert(contratosPayload, { onConflict: 'api_contrato_id' })
        .select('id, api_contrato_id');
      if (upsertError) throw upsertError;

      const mappedContratos = (upserted ?? []) as { id: string; api_contrato_id: number }[];

      const remoteByApiId = new Map<number, ReturnType<typeof mapContrato>>();
      for (const c of contratosPayload) remoteByApiId.set(c.api_contrato_id, c);

      const contractWork = mappedContratos.filter((c) => remoteByApiId.has(c.api_contrato_id));

      const contractData = await mapWithConcurrency(
        contractWork,
        async (contractDb) => {
          const [apiEmpenhos, apiFaturas] = await Promise.all([
            fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/empenhos`).catch(() => []),
            fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/faturas`).catch(() => []),
          ]);

          return {
            contratoApiId: contractDb.id,
            empenhos: (apiEmpenhos ?? []).map((e) => mapEmpenho(contractDb.id, e)).filter((e) => e.api_empenho_id),
            faturas: (apiFaturas ?? []).map((f) => mapFatura(contractDb.id, f)).filter((f) => f.api_fatura_id),
          };
        },
        6
      );

      const contratoApiIds = contractWork.map((c) => c.id);

      for (const idChunk of chunk(contratoApiIds, 200)) {
        const { error: delEmpError } = await supabase
          .from('contratos_api_empenhos')
          .delete()
          .in('contrato_api_id', idChunk);
        if (delEmpError) throw delEmpError;

        const { error: delFatError } = await supabase
          .from('contratos_api_faturas')
          .delete()
          .in('contrato_api_id', idChunk);
        if (delFatError) throw delFatError;
      }

      const empenhosPayload = contractData.flatMap((item) => item.empenhos);
      const faturasPayload = contractData.flatMap((item) => item.faturas);

      for (const empChunk of chunk(empenhosPayload, 500)) {
        if (empChunk.length === 0) continue;
        const { error } = await supabase.from('contratos_api_empenhos').insert(empChunk);
        if (error) throw error;
      }

      for (const fatChunk of chunk(faturasPayload, 500)) {
        if (fatChunk.length === 0) continue;
        const { error } = await supabase.from('contratos_api_faturas').insert(fatChunk);
        if (error) throw error;
      }

      const { error: doneError } = await supabase
        .from('contratos_api_sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'success',
          contratos_ativos: ativos?.length ?? 0,
          contratos_inativos: inativos?.length ?? 0,
          contratos_upserted: contratosPayload.length,
          empenhos_upserted: empenhosPayload.length,
          faturas_upserted: faturasPayload.length,
          details: {
            unidade_codigo: unidadeCodigo,
            processed_contracts: contractWork.length,
          },
        })
        .eq('id', runId);
      if (doneError) throw doneError;

      return {
        contratos_ativos: ativos?.length ?? 0,
        contratos_inativos: inativos?.length ?? 0,
        contratos_upserted: contratosPayload.length,
        empenhos_upserted: empenhosPayload.length,
        faturas_upserted: faturasPayload.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase
        .from('contratos_api_sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error_message: message,
        })
        .eq('id', runId);
      throw error;
    }
  },
};
