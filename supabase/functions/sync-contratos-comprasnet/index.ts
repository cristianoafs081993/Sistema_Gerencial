import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  getFaturaEmpenhos,
  getFaturaItens,
  mapContrato,
  mapEmpenho,
  mapFatura,
  mapFaturaEmpenho,
  mapFaturaItem,
  mapHistorico,
  mapItem,
  type ApiContrato,
  type ApiContratoHistorico,
  type ApiContratoItem,
  type ApiEmpenho,
  type ApiFatura,
} from '../../../src/services/contratosApiMappers.ts';

const CONTRATOS_API_BASE = 'https://contratos.comprasnet.gov.br/api';
const DEFAULT_UASG = '158366';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-contratos-sync-secret',
};

type SyncRequest = {
  unidadeCodigo?: string;
  source?: string;
};

type SupabaseClient = ReturnType<typeof createClient>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function assertOptionalSharedSecret(request: Request) {
  const expectedSecret = Deno.env.get('CONTRATOS_SYNC_SECRET');
  if (!expectedSecret) return;

  const providedSecret = request.headers.get('x-contratos-sync-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Response(
      JSON.stringify({ error: 'Segredo de sincronizacao ausente ou invalido.' }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}

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
  concurrency = 6,
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
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function insertInChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  selectColumns?: string,
) {
  const inserted: Record<string, unknown>[] = [];
  for (const rowChunk of chunk(rows, 500)) {
    if (rowChunk.length === 0) continue;
    let query = supabase.from(table).insert(rowChunk);
    if (selectColumns) {
      query = query.select(selectColumns);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (Array.isArray(data)) inserted.push(...(data as Record<string, unknown>[]));
  }
  return inserted;
}

async function deleteChildrenForContracts(supabase: SupabaseClient, contratoApiIds: string[]) {
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

    const { error: delItemError } = await supabase
      .from('contratos_api_itens')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delItemError) throw delItemError;

    const { error: delHistError } = await supabase
      .from('contratos_api_historico')
      .delete()
      .in('contrato_api_id', idChunk);
    if (delHistError) throw delHistError;
  }
}

async function runSync(supabase: SupabaseClient, unidadeCodigo: string, source: string) {
  const { data: runInsert, error: runInsertError } = await supabase
    .from('contratos_api_sync_runs')
    .insert({
      unidade_codigo: unidadeCodigo,
      status: 'running',
      details: { source },
    })
    .select('id')
    .single();

  if (runInsertError) throw runInsertError;
  const runId = String(runInsert.id);

  try {
    const [ativos, inativos] = await Promise.all([
      fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/ug/${unidadeCodigo}`),
      fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/inativo/ug/${unidadeCodigo}`),
    ]);

    const mergedMap = new Map<number, ReturnType<typeof mapContrato>>();
    for (const contrato of inativos ?? []) {
      const mapped = mapContrato(contrato, false);
      if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
    }
    for (const contrato of ativos ?? []) {
      const mapped = mapContrato(contrato, true);
      if (mapped.api_contrato_id) mergedMap.set(mapped.api_contrato_id, mapped);
    }
    const contratosPayload = Array.from(mergedMap.values());

    const { data: upserted, error: upsertError } = await supabase
      .from('contratos_api')
      .upsert(contratosPayload, { onConflict: 'api_contrato_id' })
      .select('id, api_contrato_id');
    if (upsertError) throw upsertError;

    const mappedContratos = (upserted ?? []) as { id: string; api_contrato_id: number }[];
    const remoteByApiId = new Map(contratosPayload.map((contrato) => [contrato.api_contrato_id, contrato]));
    const contractWork = mappedContratos.filter((contrato) => remoteByApiId.has(contrato.api_contrato_id));

    const contractData = await mapWithConcurrency(
      contractWork,
      async (contractDb) => {
        const [apiEmpenhos, apiFaturas, apiItens, apiHistorico] = await Promise.all([
          fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/empenhos`).catch(() => []),
          fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/faturas`).catch(() => []),
          fetchJson<ApiContratoItem[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/itens`).catch(() => []),
          fetchJson<ApiContratoHistorico[]>(`${CONTRATOS_API_BASE}/contrato/${contractDb.api_contrato_id}/historico`).catch(() => []),
        ]);

        return {
          contratoApiId: contractDb.id,
          rawFaturas: apiFaturas ?? [],
          empenhos: (apiEmpenhos ?? []).map((empenho) => mapEmpenho(contractDb.id, empenho)).filter((empenho) => empenho.api_empenho_id),
          faturas: (apiFaturas ?? []).map((fatura) => mapFatura(contractDb.id, fatura)).filter((fatura) => fatura.api_fatura_id),
          itens: (apiItens ?? []).map((item) => mapItem(contractDb.id, item)).filter((item) => item.api_item_id),
          historico: (apiHistorico ?? []).map((historico) => mapHistorico(contractDb.id, historico)).filter((historico) => historico.api_historico_id),
        };
      },
      6,
    );

    const contratoApiIds = contractWork.map((contrato) => contrato.id);
    await deleteChildrenForContracts(supabase, contratoApiIds);

    const empenhosPayload = contractData.flatMap((item) => item.empenhos);
    const faturasPayload = contractData.flatMap((item) => item.faturas);
    const itensPayload = contractData.flatMap((item) => item.itens);
    const historicoPayload = contractData.flatMap((item) => item.historico);

    const insertedEmpenhos = await insertInChunks(
      supabase,
      'contratos_api_empenhos',
      empenhosPayload,
      'id, contrato_api_id, api_empenho_id',
    ) as Array<{ id: string; contrato_api_id: string; api_empenho_id: number }>;
    const insertedFaturas = await insertInChunks(
      supabase,
      'contratos_api_faturas',
      faturasPayload,
      'id, contrato_api_id, api_fatura_id',
    ) as Array<{ id: string; contrato_api_id: string; api_fatura_id: number }>;
    const insertedItens = await insertInChunks(
      supabase,
      'contratos_api_itens',
      itensPayload,
      'id, contrato_api_id, api_item_id',
    ) as Array<{ id: string; contrato_api_id: string; api_item_id: number }>;
    await insertInChunks(supabase, 'contratos_api_historico', historicoPayload);

    const empenhoByKey = new Map(insertedEmpenhos.map((row) => [`${row.contrato_api_id}:${row.api_empenho_id}`, row.id]));
    const faturaByKey = new Map(insertedFaturas.map((row) => [`${row.contrato_api_id}:${row.api_fatura_id}`, row.id]));
    const itemByKey = new Map(insertedItens.map((row) => [`${row.contrato_api_id}:${row.api_item_id}`, row.id]));

    const faturaItensPayload = contractData.flatMap((contract) =>
      contract.rawFaturas.flatMap((rawFatura) => {
        const faturaId = faturaByKey.get(`${contract.contratoApiId}:${Number(rawFatura.id)}`);
        if (!faturaId) return [];
        return getFaturaItens(rawFatura)
          .filter((rawItem) => Number(rawItem.id_item_contrato))
          .map((rawItem) =>
            mapFaturaItem(
              contract.contratoApiId,
              faturaId,
              itemByKey.get(`${contract.contratoApiId}:${Number(rawItem.id_item_contrato)}`) ?? null,
              rawItem,
            ),
          );
      }),
    );
    const faturaEmpenhosPayload = contractData.flatMap((contract) =>
      contract.rawFaturas.flatMap((rawFatura) => {
        const faturaId = faturaByKey.get(`${contract.contratoApiId}:${Number(rawFatura.id)}`);
        if (!faturaId) return [];
        return getFaturaEmpenhos(rawFatura)
          .filter((rawEmpenho) => Number(rawEmpenho.id_empenho))
          .map((rawEmpenho) =>
            mapFaturaEmpenho(
              contract.contratoApiId,
              faturaId,
              empenhoByKey.get(`${contract.contratoApiId}:${Number(rawEmpenho.id_empenho)}`) ?? null,
              rawEmpenho,
            ),
          );
      }),
    );

    await insertInChunks(supabase, 'contratos_api_fatura_itens', faturaItensPayload);
    await insertInChunks(supabase, 'contratos_api_fatura_empenhos', faturaEmpenhosPayload);

    const result = {
      contratos_ativos: ativos?.length ?? 0,
      contratos_inativos: inativos?.length ?? 0,
      contratos_upserted: contratosPayload.length,
      empenhos_upserted: empenhosPayload.length,
      faturas_upserted: faturasPayload.length,
      itens_upserted: itensPayload.length,
      historicos_upserted: historicoPayload.length,
      fatura_itens_upserted: faturaItensPayload.length,
      fatura_empenhos_upserted: faturaEmpenhosPayload.length,
    };

    const { error: doneError } = await supabase
      .from('contratos_api_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'success',
        ...result,
        details: {
          unidade_codigo: unidadeCodigo,
          processed_contracts: contractWork.length,
          source,
        },
      })
      .eq('id', runId);
    if (doneError) throw doneError;

    return { runId, ...result };
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
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  try {
    assertOptionalSharedSecret(request);
    const body = (await request.json().catch(() => ({}))) as SyncRequest;
    const unidadeCodigo = String(body.unidadeCodigo || DEFAULT_UASG);
    if (unidadeCodigo !== DEFAULT_UASG) {
      return jsonResponse({ error: `UG ${unidadeCodigo} nao habilitada nesta versao.` }, 400);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await runSync(supabase, unidadeCodigo, body.source || 'manual');
    return jsonResponse({ status: 'processed', ...result });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('sync-contratos-comprasnet', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao sincronizar contratos do Comprasnet.',
      },
      500,
    );
  }
});
