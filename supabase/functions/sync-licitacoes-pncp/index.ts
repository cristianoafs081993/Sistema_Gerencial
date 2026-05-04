import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  DEFAULT_PNCP_UASG,
  IFRN_CNPJ,
  PREGAO_ELETRONICO_MODALIDADE_ID,
  mapPncpCompra,
  normalizePncpDate,
  splitPncpDateRange,
  type LicitacaoPncpPayload,
  type PncpCompraRaw,
} from '../../../src/lib/licitacoesPncp.ts';

const PNCP_API_BASE = 'https://pncp.gov.br/api/consulta';
const COMPRAS_DADOS_ABERTOS_BASE = 'https://dadosabertos.compras.gov.br';
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_LOOKBACK_DAYS = 364;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-licitacoes-pncp-sync-secret',
};

type SupabaseClient = ReturnType<typeof createClient>;

type SyncRequest = {
  cnpjOrgao?: string;
  unidadeCodigo?: string;
  unidadeCodigos?: string[];
  dataInicial?: string;
  dataFinal?: string;
  modalidadeId?: number;
  source?: string;
  enrichUasgs?: boolean;
};

type PncpPage = {
  data?: PncpCompraRaw[];
  totalPaginas?: number;
  paginasRestantes?: number;
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

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  }
  return value;
}

function assertOptionalSharedSecret(request: Request) {
  const expectedSecret = Deno.env.get('LICITACOES_PNCP_SYNC_SECRET');
  if (!expectedSecret) return;

  const providedSecret = request.headers.get('x-licitacoes-pncp-sync-secret');
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

function isoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
  return {
    dataInicial: isoDateOnly(start),
    dataFinal: isoDateOnly(end),
  };
}

function normalizeUnidadeCodigos(body: SyncRequest) {
  const configured = Deno.env.get('LICITACOES_PNCP_UASGS')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const requested = body.unidadeCodigos?.length
    ? body.unidadeCodigos
    : body.unidadeCodigo
      ? [body.unidadeCodigo]
      : configured?.length
        ? configured
        : [DEFAULT_PNCP_UASG];

  return Array.from(new Set(requested.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

async function fetchWithTimeout(url: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, timeoutMs = 30000): Promise<T | null> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status} em ${url}: ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4,
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

async function upsertInChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
) {
  let count = 0;
  for (const rowChunk of chunk(rows, 500)) {
    const { data, error } = await supabase
      .from(table)
      .upsert(rowChunk, { onConflict })
      .select('id');
    if (error) throw error;
    count += data?.length ?? rowChunk.length;
  }
  return count;
}

async function fetchPncpPage(params: {
  cnpj: string;
  unidadeCodigo: string;
  dataInicial: string;
  dataFinal: string;
  modalidadeId: number;
  pagina: number;
}) {
  const search = new URLSearchParams({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: String(params.modalidadeId),
    cnpj: params.cnpj,
    codigoUnidadeAdministrativa: params.unidadeCodigo,
    pagina: String(params.pagina),
    tamanhoPagina: String(DEFAULT_PAGE_SIZE),
  });

  return fetchJson<PncpPage>(`${PNCP_API_BASE}/v1/contratacoes/publicacao?${search.toString()}`, 45000);
}

async function fetchPncpDetail(cnpj: string, compra: PncpCompraRaw) {
  const ano = compra.anoCompra;
  const sequencial = compra.sequencialCompra;
  if (!ano || !sequencial) return compra;

  try {
    return await fetchJson<PncpCompraRaw>(
      `${PNCP_API_BASE}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      30000,
    ) ?? compra;
  } catch {
    return compra;
  }
}

async function fetchComprasUasg(unidadeCodigo: string) {
  const search = new URLSearchParams({
    codigoUasg: unidadeCodigo,
    statusUasg: 'true',
    pagina: '1',
  });

  try {
    const response = await fetchJson<{ resultado?: Array<Record<string, unknown>> }>(
      `${COMPRAS_DADOS_ABERTOS_BASE}/modulo-uasg/1_consultarUasg?${search.toString()}`,
      15000,
    );
    const row = response?.resultado?.[0];
    if (!row) return null;

    return {
      codigo_uasg: String(row.codigoUasg ?? unidadeCodigo),
      nome_uasg: row.nomeUasg ? String(row.nomeUasg) : null,
      codigo_orgao: row.codigoOrgao ? String(row.codigoOrgao) : null,
      cnpj_orgao: row.cnpjCpfOrgao ? String(row.cnpjCpfOrgao) : null,
      sigla_uf: row.siglaUf ? String(row.siglaUf) : null,
      codigo_municipio_ibge: row.codigoMunicipioIbge ? String(row.codigoMunicipioIbge) : null,
      nome_municipio_ibge: row.nomeMunicipioIbge ? String(row.nomeMunicipioIbge) : null,
      codigo_unidade_polo: row.codigoUnidadePolo ? String(row.codigoUnidadePolo) : null,
      nome_unidade_polo: row.nomeUnidadePolo ? String(row.nomeUnidadePolo) : null,
      raw_data: row,
    };
  } catch {
    return null;
  }
}

async function collectPncpCompras(params: {
  cnpj: string;
  unidadeCodigo: string;
  dataInicial: string;
  dataFinal: string;
  modalidadeId: number;
}) {
  const collected: PncpCompraRaw[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const page = await fetchPncpPage({ ...params, pagina });
    const rows = page?.data ?? [];
    collected.push(...rows);
    totalPaginas = page?.totalPaginas ?? (page?.paginasRestantes ? pagina + page.paginasRestantes : pagina);
    pagina += 1;
  } while (pagina <= totalPaginas);

  return collected;
}

async function runSync(supabase: SupabaseClient, body: SyncRequest) {
  const cnpj = String(body.cnpjOrgao ?? Deno.env.get('LICITACOES_PNCP_CNPJ') ?? IFRN_CNPJ).replace(/\D/g, '');
  const unidadeCodigos = normalizeUnidadeCodigos(body);
  const defaults = defaultDateRange();
  const dataInicial = normalizePncpDate(body.dataInicial ?? defaults.dataInicial);
  const dataFinal = normalizePncpDate(body.dataFinal ?? defaults.dataFinal);
  const modalidadeId = Number(body.modalidadeId ?? PREGAO_ELETRONICO_MODALIDADE_ID);
  const windows = splitPncpDateRange(dataInicial, dataFinal);
  const errors: Array<{ scope: string; message: string }> = [];

  const { data: runInsert, error: runInsertError } = await supabase
    .from('licitacoes_pncp_sync_runs')
    .insert({
      cnpj_orgao: cnpj,
      unidade_codigos: unidadeCodigos,
      data_inicial: `${dataInicial.slice(0, 4)}-${dataInicial.slice(4, 6)}-${dataInicial.slice(6, 8)}`,
      data_final: `${dataFinal.slice(0, 4)}-${dataFinal.slice(4, 6)}-${dataFinal.slice(6, 8)}`,
      modalidade_id: modalidadeId,
      total_windows: windows.length * unidadeCodigos.length,
      details: {
        source: body.source ?? 'manual',
        enrichUasgs: body.enrichUasgs !== false,
      },
    })
    .select('id')
    .single();

  if (runInsertError) throw runInsertError;
  const runId = String(runInsert.id);

  try {
    if (body.enrichUasgs !== false) {
      const uasgRows = (await mapWithConcurrency(unidadeCodigos, fetchComprasUasg, 3)).filter(Boolean);
      if (uasgRows.length > 0) {
        await upsertInChunks(supabase, 'licitacoes_pncp_uasgs', uasgRows as Record<string, unknown>[], 'codigo_uasg');
      }
    }

    const listRows: PncpCompraRaw[] = [];
    for (const unidadeCodigo of unidadeCodigos) {
      for (const window of windows) {
        try {
          const rows = await collectPncpCompras({
            cnpj,
            unidadeCodigo,
            dataInicial: window.dataInicial,
            dataFinal: window.dataFinal,
            modalidadeId,
          });
          listRows.push(...rows);
        } catch (error) {
          errors.push({
            scope: `${unidadeCodigo}:${window.dataInicial}-${window.dataFinal}`,
            message: errorToMessage(error),
          });
        }
      }
    }

    const uniqueByNumeroControle = new Map<string, PncpCompraRaw>();
    for (const row of listRows) {
      const key = typeof row.numeroControlePNCP === 'string' ? row.numeroControlePNCP : null;
      if (key) uniqueByNumeroControle.set(key, row);
    }

    const detailedRows = await mapWithConcurrency(
      Array.from(uniqueByNumeroControle.values()),
      (row) => fetchPncpDetail(cnpj, row),
      4,
    );

    const payloadRows: Array<LicitacaoPncpPayload & { sync_run_id: string }> = [];
    for (const row of detailedRows) {
      try {
        payloadRows.push({
          ...mapPncpCompra(row),
          sync_run_id: runId,
        });
      } catch (error) {
        errors.push({
          scope: String(row.numeroControlePNCP ?? 'unknown'),
          message: errorToMessage(error),
        });
      }
    }

    const upserted = payloadRows.length
      ? await upsertInChunks(
        supabase,
        'licitacoes_pncp',
        payloadRows as Array<Record<string, unknown>>,
        'numero_controle_pncp',
      )
      : 0;

    const status = errors.length > 0 ? (upserted > 0 ? 'partial_success' : 'error') : 'success';
    const { error: finishError } = await supabase
      .from('licitacoes_pncp_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status,
        total_fetched: listRows.length,
        total_upserted: upserted,
        error_message: errors.length ? `${errors.length} escopo(s) com falha.` : null,
        details: {
          source: body.source ?? 'manual',
          errors,
          uniqueRows: uniqueByNumeroControle.size,
          unidadeCodigos,
          windows,
        },
      })
      .eq('id', runId);

    if (finishError) throw finishError;

    return {
      runId,
      status,
      fetched: listRows.length,
      uniqueRows: uniqueByNumeroControle.size,
      upserted,
      errors,
    };
  } catch (error) {
    await supabase
      .from('licitacoes_pncp_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: errorToMessage(error),
        details: {
          source: body.source ?? 'manual',
          errors,
        },
      })
      .eq('id', runId);

    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    assertOptionalSharedSecret(request);

    const body = await request.json().catch(() => ({})) as SyncRequest;
    const supabase = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    return jsonResponse(await runSync(supabase, body));
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: errorToMessage(error) }, 500);
  }
});
