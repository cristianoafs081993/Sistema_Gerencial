import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  getFaturaEmpenhos,
  mapFatura,
  toDate,
  toNumber,
  type ApiContrato,
  type ApiEmpenho,
  type ApiFatura,
} from '../../../src/services/contratosApiMappers.ts';
import { buildEmpenhoLookupKeys } from '../../../src/utils/contratosSync.ts';

const CONTRATOS_API_BASE = 'https://contratos.comprasnet.gov.br/api';
const DEFAULT_UNIDADES = ['158366', '158155'];
const FOUND_TTL_MS = 12 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 15 * 60 * 1000;
const CACHE_ROWS_SELECT = [
  'id',
  'empenho_lookup_key',
  'empenho_numero',
  'empenho_numero_api',
  'unidade_contrato',
  'contrato_api_id',
  'contrato_numero',
  'contrato_objeto',
  'fatura_id',
  'numero_instrumento_cobranca',
  'situacao',
  'valor_bruto',
  'valor_liquido',
  'data_emissao',
  'data_vencimento',
  'data_pagamento',
  'data_liquidacao',
  'processo',
  'valor_empenho',
  'subelemento',
  'fetched_at',
].join(',');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-contratos-sync-secret',
};

type SupabaseClient = ReturnType<typeof createClient>;

type RefreshRequest = {
  empenhoNumero?: string;
  empenhos?: string[];
  refreshDue?: boolean;
  readCacheOnly?: boolean;
  returnRows?: boolean;
  limit?: number;
  unidades?: string[];
  source?: string;
};

type ContratoResumo = {
  api_contrato_id: number;
  numero: string | null;
  objeto: string | null;
  unidade_contrato: string;
};

type LiquidacaoCacheRow = {
  empenho_lookup_key: string;
  empenho_numero: string;
  empenho_numero_api: string;
  unidade_contrato: string;
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
  raw_data: Record<string, unknown>;
  fetched_at: string;
};

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
  const expectedSecret = Deno.env.get('CONTRATOS_LIQUIDACOES_CACHE_SECRET');
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API ${response.status} em ${url}`);
  }
  return response.json() as Promise<T>;
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
      results.push(await worker(item));
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

function canonicalEmpenhoKey(raw: unknown) {
  const keys = buildEmpenhoLookupKeys(raw);
  return keys.find((key) => /^\d{4}NE\d+$/i.test(key)) ?? keys[0] ?? '';
}

function hasEmpenhoMatch(targetKeys: Set<string>, raw: unknown) {
  return buildEmpenhoLookupKeys(raw).some((key) => targetKeys.has(key));
}

function normalizeUnidades(raw: unknown) {
  const values = Array.isArray(raw) ? raw : DEFAULT_UNIDADES;
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function addMilliseconds(date: Date, amount: number) {
  return new Date(date.getTime() + amount).toISOString();
}

async function getContratosPublicos(unidadeCodigo: string): Promise<ContratoResumo[]> {
  const [ativos, inativos] = await Promise.all([
    fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/ug/${unidadeCodigo}`),
    fetchJson<ApiContrato[]>(`${CONTRATOS_API_BASE}/contrato/inativo/ug/${unidadeCodigo}`),
  ]);

  const contratos = new Map<number, ContratoResumo>();
  for (const contrato of [...(inativos ?? []), ...(ativos ?? [])]) {
    const apiContratoId = Number(contrato.id);
    if (!Number.isFinite(apiContratoId) || apiContratoId <= 0) continue;
    contratos.set(apiContratoId, {
      api_contrato_id: apiContratoId,
      numero: String(contrato.numero ?? '').trim() || null,
      objeto: contrato.objeto == null ? null : String(contrato.objeto),
      unidade_contrato: unidadeCodigo,
    });
  }

  return Array.from(contratos.values());
}

async function discoverLiquidacoes(
  empenhoNumero: string,
  unidades: string[],
): Promise<LiquidacaoCacheRow[]> {
  const lookupKey = canonicalEmpenhoKey(empenhoNumero);
  const targetKeys = new Set(buildEmpenhoLookupKeys(empenhoNumero));
  if (!lookupKey || targetKeys.size === 0) return [];

  const contratosPorUnidade = await mapWithConcurrency(
    unidades,
    (unidade) => getContratosPublicos(unidade),
    2,
  );

  const contratosMap = new Map<number, ContratoResumo>();
  for (const contrato of contratosPorUnidade.flat()) {
    contratosMap.set(contrato.api_contrato_id, contrato);
  }

  const contratosCompativeis = (
    await mapWithConcurrency(
      Array.from(contratosMap.values()),
      async (contrato) => {
        try {
          const empenhos = await fetchJson<ApiEmpenho[]>(`${CONTRATOS_API_BASE}/contrato/${contrato.api_contrato_id}/empenhos`);
          const found = (empenhos ?? []).some((empenho) =>
            hasEmpenhoMatch(targetKeys, empenho.numero ?? empenho.numero_empenho),
          );
          return found ? contrato : null;
        } catch (error) {
          console.warn(`Falha ao consultar empenhos do contrato ${contrato.api_contrato_id}`, error);
          return null;
        }
      },
      8,
    )
  ).filter((contrato): contrato is ContratoResumo => Boolean(contrato));

  const fetchedAt = new Date().toISOString();
  const rows = (
    await mapWithConcurrency(
      contratosCompativeis,
      async (contrato) => {
        try {
          const faturas = await fetchJson<ApiFatura[]>(`${CONTRATOS_API_BASE}/contrato/${contrato.api_contrato_id}/faturas`);
          return (faturas ?? []).flatMap((rawFatura) => {
            const matchingEmpenhos = getFaturaEmpenhos(rawFatura).filter((rawEmpenho) =>
              hasEmpenhoMatch(targetKeys, rawEmpenho.numero_empenho ?? rawEmpenho.numero),
            );

            if (matchingEmpenhos.length === 0) return [];

            const mappedFatura = mapFatura(String(contrato.api_contrato_id), rawFatura);
            const rawFaturaRecord = rawFatura as Record<string, unknown>;
            const processo = rawFaturaRecord.processo == null ? null : String(rawFaturaRecord.processo);
            const dataLiquidacao = toDate(rawFaturaRecord.data_liquidacao);
            const faturaId = Number(rawFatura.id) || mappedFatura.api_fatura_id;

            return matchingEmpenhos.map((matchingEmpenho) => ({
              empenho_lookup_key: lookupKey,
              empenho_numero: empenhoNumero,
              empenho_numero_api: String(matchingEmpenho.numero_empenho ?? matchingEmpenho.numero ?? '').trim(),
              unidade_contrato: contrato.unidade_contrato,
              contrato_api_id: contrato.api_contrato_id,
              contrato_numero: contrato.numero,
              contrato_objeto: contrato.objeto,
              fatura_id: faturaId,
              numero_instrumento_cobranca: mappedFatura.numero_instrumento_cobranca || null,
              situacao: mappedFatura.situacao || null,
              valor_bruto: mappedFatura.valor_bruto,
              valor_liquido: mappedFatura.valor_liquido,
              data_emissao: mappedFatura.data_emissao,
              data_vencimento: mappedFatura.data_vencimento,
              data_pagamento: mappedFatura.data_pagamento,
              data_liquidacao: dataLiquidacao,
              processo,
              valor_empenho: toNumber(matchingEmpenho.valor_empenho),
              subelemento: matchingEmpenho.subelemento == null ? null : String(matchingEmpenho.subelemento),
              raw_data: {
                fatura: rawFatura,
                empenho: matchingEmpenho,
              },
              fetched_at: fetchedAt,
            }));
          });
        } catch (error) {
          console.warn(`Falha ao consultar faturas do contrato ${contrato.api_contrato_id}`, error);
          return [];
        }
      },
      6,
    )
  ).flat();

  const uniqueRows = new Map<string, LiquidacaoCacheRow>();
  for (const row of rows) {
    uniqueRows.set(`${row.contrato_api_id}:${row.fatura_id}:${row.empenho_numero_api}`, row);
  }

  return Array.from(uniqueRows.values());
}

async function replaceCacheRows(
  supabase: SupabaseClient,
  empenhoNumero: string,
  unidades: string[],
  returnRows = false,
) {
  const lookupKey = canonicalEmpenhoKey(empenhoNumero);
  if (!lookupKey) {
    return { empenhoNumero, lookupKey, status: 'not_found', rowsCount: 0 };
  }

  try {
    const rows = await discoverLiquidacoes(empenhoNumero, unidades);
    const now = new Date();
    const status = rows.length > 0 ? 'found' : 'not_found';

    const { error: statusError } = await supabase
      .from('contratos_api_empenho_liquidacoes_cache_status')
      .upsert({
        empenho_lookup_key: lookupKey,
        empenho_numero: empenhoNumero,
        status,
        unidades_consultadas: unidades,
        rows_count: rows.length,
        fetched_at: now.toISOString(),
        expires_at: addMilliseconds(now, rows.length > 0 ? FOUND_TTL_MS : NOT_FOUND_TTL_MS),
        error_message: null,
      }, { onConflict: 'empenho_lookup_key' });
    if (statusError) throw statusError;

    const { error: deleteError } = await supabase
      .from('contratos_api_empenho_liquidacoes_cache')
      .delete()
      .eq('empenho_lookup_key', lookupKey);
    if (deleteError) throw deleteError;

    for (const rowChunk of chunk(rows, 500)) {
      if (rowChunk.length === 0) continue;
      const { error: insertError } = await supabase
        .from('contratos_api_empenho_liquidacoes_cache')
        .insert(rowChunk);
      if (insertError) throw insertError;
    }

    return { empenhoNumero, lookupKey, status, rowsCount: rows.length, ...(returnRows ? { rows } : {}) };
  } catch (error) {
    const now = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const { error: statusError } = await supabase
      .from('contratos_api_empenho_liquidacoes_cache_status')
      .upsert({
        empenho_lookup_key: lookupKey,
        empenho_numero: empenhoNumero,
        status: 'error',
        unidades_consultadas: unidades,
        rows_count: 0,
        fetched_at: now.toISOString(),
        expires_at: addMilliseconds(now, ERROR_TTL_MS),
        error_message: message,
      }, { onConflict: 'empenho_lookup_key' });
    if (statusError) throw statusError;
    return { empenhoNumero, lookupKey, status: 'error', rowsCount: 0, error: message };
  }
}

async function readCacheRows(
  supabase: SupabaseClient,
  empenhoNumero: string,
  returnRows = false,
) {
  const lookupKey = canonicalEmpenhoKey(empenhoNumero);
  if (!lookupKey) {
    return { empenhoNumero, lookupKey, status: 'not_found', rowsCount: 0, rows: [] };
  }

  const { data: statusRow, error: statusError } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache_status')
    .select('empenho_lookup_key, empenho_numero, status, rows_count, fetched_at, expires_at, error_message')
    .eq('empenho_lookup_key', lookupKey)
    .maybeSingle();
  if (statusError) throw statusError;

  if (!statusRow) {
    return { empenhoNumero, lookupKey, status: 'missing', rowsCount: 0, rows: [] };
  }

  const { data: rows, error: rowsError } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache')
    .select(CACHE_ROWS_SELECT)
    .eq('empenho_lookup_key', lookupKey)
    .order('data_emissao', { ascending: false });
  if (rowsError) throw rowsError;

  return {
    empenhoNumero,
    lookupKey,
    status: statusRow.status,
    rowsCount: Number(statusRow.rows_count ?? 0),
    fetchedAt: statusRow.fetched_at,
    expiresAt: statusRow.expires_at,
    error: statusRow.error_message,
    ...(returnRows ? { rows: rows ?? [] } : {}),
  };
}

async function getDueEmpenhos(supabase: SupabaseClient, limit: number) {
  const { data, error } = await supabase
    .from('contratos_api_empenho_liquidacoes_cache_status')
    .select('empenho_numero')
    .lte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row: { empenho_numero: string }) => row.empenho_numero).filter(Boolean);
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
    const body = (await request.json().catch(() => ({}))) as RefreshRequest;
    const unidades = normalizeUnidades(body.unidades);
    const limit = Math.max(1, Math.min(Number(body.limit) || 25, 200));

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requestedEmpenhos = new Set<string>();
    if (body.empenhoNumero) requestedEmpenhos.add(String(body.empenhoNumero));
    for (const empenho of body.empenhos ?? []) {
      requestedEmpenhos.add(String(empenho));
    }

    if (body.refreshDue) {
      for (const empenho of await getDueEmpenhos(supabase, limit)) {
        requestedEmpenhos.add(empenho);
      }
    }

    const empenhos = Array.from(requestedEmpenhos).filter((empenho) => canonicalEmpenhoKey(empenho));
    if (empenhos.length === 0) {
      return jsonResponse({ status: 'nothing_to_refresh', source: body.source ?? 'manual' });
    }

    const results = [];
    for (const empenho of empenhos.slice(0, limit)) {
      results.push(
        body.readCacheOnly
          ? await readCacheRows(supabase, empenho, Boolean(body.returnRows))
          : await replaceCacheRows(supabase, empenho, unidades, Boolean(body.returnRows)),
      );
    }

    return jsonResponse({
      status: 'processed',
      source: body.source ?? 'manual',
      unidades,
      processed: results.length,
      results,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error('refresh-comprasnet-liquidacoes-cache', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao atualizar cache de liquidacoes do Comprasnet.',
      },
      500,
    );
  }
});
