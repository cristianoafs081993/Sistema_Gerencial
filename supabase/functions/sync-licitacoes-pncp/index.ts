import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import {
  DEFAULT_PNCP_UASG,
  DEFAULT_PNCP_UASGS,
  IFRN_UASG_CATALOG,
  IFRN_CNPJ,
  PREGAO_ELETRONICO_MODALIDADE_ID,
  buildPncpItemsUrl,
  buildPncpPublicationUrl,
  mapPncpCompra,
  normalizePncpDate,
  pncpCompraMatchesItemSearch,
  splitPncpDateRange,
  type LicitacaoPncpPayload,
  type PncpCompraRaw,
  type PncpItemRaw,
} from '../../../src/lib/licitacoesPncp.ts';

const PNCP_API_BASE = 'https://pncp.gov.br/api/consulta';
const COMPRAS_DADOS_ABERTOS_BASE = 'https://dadosabertos.compras.gov.br';
const DEFAULT_LOOKBACK_DAYS = 364;
const PNCP_PAGE_TIMEOUT_MS = 120000;
const PNCP_DETAIL_TIMEOUT_MS = 60000;
const INTERNAL_UASG_CATALOG = new Map(IFRN_UASG_CATALOG.map((item) => [item.codigo, item]));

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
  objetoBusca?: string;
  itemBusca?: string;
  enrichUasgs?: boolean;
  fetchItens?: boolean;
  enrichExistingItems?: boolean;
  resolveIndividual?: boolean;
  query?: string;
};

type PncpPage = {
  data?: PncpCompraRaw[];
  totalPaginas?: number;
  paginasRestantes?: number;
};

type PncpItemsPage = {
  data?: PncpItemRaw[];
  itens?: PncpItemRaw[];
  totalPaginas?: number;
  paginasRestantes?: number;
};

type ComprasUasgRow = {
  codigo_uasg: string;
  nome_uasg: string | null;
  codigo_orgao: string | null;
  cnpj_orgao: string | null;
  sigla_uf: string | null;
  codigo_municipio_ibge: string | null;
  nome_municipio_ibge: string | null;
  codigo_unidade_polo: string | null;
  nome_unidade_polo: string | null;
  raw_data: Record<string, unknown>;
};

type UnidadeContext = {
  unidadeCodigo: string | null;
  cnpj: string;
  uasgData: ComprasUasgRow | null;
};

type CollectedPncpCompra = {
  cnpj: string;
  row: PncpCompraRaw;
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
  const requested = body.unidadeCodigos?.length
    ? body.unidadeCodigos
    : body.unidadeCodigo
      ? [body.unidadeCodigo]
      : [];

  const list = Array.from(new Set(requested.map((value) => String(value ?? '').trim()).filter(Boolean)));
  if (list.length > 0) return list;
  if (!body.cnpjOrgao || onlyDigits(body.cnpjOrgao) === IFRN_CNPJ) {
    return DEFAULT_PNCP_UASGS;
  }
  return [];
}

function onlyDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function matchesObjetoBusca(row: PncpCompraRaw, objetoBusca?: string) {
  const needle = normalizeSearchText(objetoBusca);
  if (!needle) return true;
  return normalizeSearchText(row.objetoCompra).includes(needle);
}

async function fetchWithTimeout(url: string, timeoutMs = 30000, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
  };
  try {
    return await fetch(url, {
      headers: { ...defaultHeaders, ...headers },
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

async function fetchJsonWithRetry<T>(url: string, timeoutMs = 30000, attempts = 2): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson<T>(url, timeoutMs);
    } catch (error) {
      lastError = error;
      const message = errorToMessage(error);
      const retryable = /aborted|timeout|fetch failed|network/i.test(message);
      if (!retryable || attempt === attempts) break;
    }
  }
  throw lastError;
}

async function fetchText(url: string, timeoutMs = 30000): Promise<string | null> {
  const response = await fetchWithTimeout(url, timeoutMs, {
    'Accept': 'text/csv, text/plain, */*'
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status} em ${url}: ${body.slice(0, 300)}`);
  }
  return response.text();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, index) => ({ item, index }));

  const runners = Array.from({ length: Math.min(concurrency, items.length) }).map(async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      results[next.index] = await worker(next.item);
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
    const { error } = await supabase
      .from(table)
      .upsert(rowChunk, { onConflict });
    if (error) throw error;
    count += rowChunk.length;
  }
  return count;
}

async function fetchPncpPage(params: {
  cnpj: string;
  unidadeCodigo?: string | null;
  dataInicial: string;
  dataFinal: string;
  modalidadeId: number;
  pagina: number;
}) {
  return fetchJsonWithRetry<PncpPage>(
    buildPncpPublicationUrl(params),
    PNCP_PAGE_TIMEOUT_MS,
    2,
  );
}

async function fetchPncpDetail(cnpj: string, compra: PncpCompraRaw) {
  const ano = compra.anoCompra;
  const sequencial = compra.sequencialCompra;
  if (!ano || !sequencial) return compra;

  try {
    return await fetchJson<PncpCompraRaw>(
      `${PNCP_API_BASE}/v1/orgaos/${cnpj}/compras/${ano}/${sequencial}`,
      PNCP_DETAIL_TIMEOUT_MS,
    ) ?? compra;
  } catch {
    return compra;
  }
}

function getPncpItemsFromPage(page: PncpItemsPage | PncpItemRaw[] | null) {
  if (!page) return [];
  if (Array.isArray(page)) return page;
  if (Array.isArray(page.data)) return page.data;
  if (Array.isArray(page.itens)) return page.itens;
  return [];
}

async function fetchPncpItemsPage(params: {
  cnpj: string;
  anoCompra: number;
  sequencialCompra: number;
  pagina: number;
}) {
  const withPageSize = buildPncpItemsUrl({
    ...params,
    tamanhoPagina: 100,
  });

  try {
    return await fetchJsonWithRetry<PncpItemsPage | PncpItemRaw[]>(
      withPageSize,
      PNCP_DETAIL_TIMEOUT_MS,
      2,
    );
  } catch (error) {
    if (!/API 400/i.test(errorToMessage(error))) throw error;
    return fetchJsonWithRetry<PncpItemsPage | PncpItemRaw[]>(
      buildPncpItemsUrl(params),
      PNCP_DETAIL_TIMEOUT_MS,
      2,
    );
  }
}

async function fetchPncpItems(cnpj: string, compra: PncpCompraRaw) {
  const anoCompra = Number(compra.anoCompra);
  const sequencialCompra = Number(compra.sequencialCompra);
  if (!anoCompra || !sequencialCompra) return [];

  const items: PncpItemRaw[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const page = await fetchPncpItemsPage({ cnpj, anoCompra, sequencialCompra, pagina });
    items.push(...getPncpItemsFromPage(page));

    if (page && !Array.isArray(page)) {
      totalPaginas = page.totalPaginas ?? (page.paginasRestantes ? pagina + page.paginasRestantes : pagina);
    } else {
      totalPaginas = pagina;
    }
    pagina += 1;
  } while (pagina <= totalPaginas);

  return items;
}

async function fetchComprasUasg(unidadeCodigo: string) {
  const cached = INTERNAL_UASG_CATALOG.get(unidadeCodigo);
  if (cached) {
    return {
      codigo_uasg: cached.codigo,
      nome_uasg: cached.aliases?.length ? `${cached.nome} (${cached.aliases.join(', ')})` : cached.nome,
      codigo_orgao: cached.codigoOrgao,
      cnpj_orgao: cached.cnpj,
      sigla_uf: 'RN',
      codigo_municipio_ibge: null,
      nome_municipio_ibge: null,
      codigo_unidade_polo: null,
      nome_unidade_polo: null,
      raw_data: {
        source: 'internal-ifrn-catalog',
        codigo_uasg: cached.codigo,
        nome_uasg: cached.nome,
        aliases: cached.aliases ?? [],
        cnpj_orgao: cached.cnpj,
        codigo_orgao: cached.codigoOrgao,
      },
    } satisfies ComprasUasgRow;
  }

  const csvSearch = new URLSearchParams({
    codigoUasg: unidadeCodigo,
    statusUasg: 'true',
    pagina: '1',
  });

  try {
    const csv = await fetchText(
      `${COMPRAS_DADOS_ABERTOS_BASE}/modulo-uasg/1.1_consultarUasg_CSV?${csvSearch.toString()}`,
      15000,
    );
    const row = parseComprasUasgCsv(csv ?? '', unidadeCodigo);
    if (row) return row;
  } catch {
    // O endpoint JSON tem oscilado com 400 para UASGs ativas; manter fallback abaixo.
  }

  const jsonSearch = new URLSearchParams({
    codigoUasg: unidadeCodigo,
    statusUasg: 'false',
    pagina: '1',
  });

  try {
    const response = await fetchJson<{ resultado?: Array<Record<string, unknown>> }>(
      `${COMPRAS_DADOS_ABERTOS_BASE}/modulo-uasg/1_consultarUasg?${jsonSearch.toString()}`,
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
    } satisfies ComprasUasgRow;
  } catch {
    return null;
  }
}

function parseComprasUasgCsv(csv: string, unidadeCodigo: string): ComprasUasgRow | null {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('totalRegistros:'));
  if (lines.length < 2) return null;

  const headers = lines[0].split(';').map((header) => header.trim());
  const values = lines[1].split(';');
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']));

  return {
    codigo_uasg: row.codigo_uasg || unidadeCodigo,
    nome_uasg: row.nome_uasg || null,
    codigo_orgao: row.codigo_orgao || null,
    cnpj_orgao: row.cnpj_cpf_orgao || null,
    sigla_uf: row.sigla_uf || null,
    codigo_municipio_ibge: row.codigo_municipio_ibge || null,
    nome_municipio_ibge: row.nome_municipio_ibge || null,
    codigo_unidade_polo: row.codigo_unidade_polo || null,
    nome_unidade_polo: row.nome_unidade_polo || null,
    raw_data: row,
  };
}

async function resolveUnidadeContexts(params: {
  unidadeCodigos: string[];
  requestedCnpj?: string;
  defaultCnpj: string;
  errors: Array<{ scope: string; message: string }>;
}) {
  if (params.unidadeCodigos.length === 0) {
    return [{ unidadeCodigo: null, cnpj: params.requestedCnpj || params.defaultCnpj, uasgData: null }];
  }

  const uasgRows = await mapWithConcurrency(params.unidadeCodigos, fetchComprasUasg, 3);
  const contexts: UnidadeContext[] = [];

  for (let index = 0; index < params.unidadeCodigos.length; index += 1) {
    const unidadeCodigo = params.unidadeCodigos[index];
    const uasgData = uasgRows[index] ?? null;
    const cached = INTERNAL_UASG_CATALOG.get(unidadeCodigo);
    const resolvedCnpj = onlyDigits(params.requestedCnpj || cached?.cnpj || uasgData?.cnpj_orgao);

    if (!resolvedCnpj) {
      if (unidadeCodigo === DEFAULT_PNCP_UASG) {
        contexts.push({ unidadeCodigo, cnpj: params.defaultCnpj, uasgData });
      } else {
        params.errors.push({
          scope: unidadeCodigo,
          message: 'Nao foi possivel resolver o CNPJ da UASG no Compras.gov.br.',
        });
      }
      continue;
    }

    contexts.push({ unidadeCodigo, cnpj: resolvedCnpj, uasgData });
  }

  return contexts;
}

async function collectPncpCompras(params: {
  cnpj: string;
  unidadeCodigo?: string | null;
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
  const requestedCnpj = body.cnpjOrgao ? onlyDigits(body.cnpjOrgao) : undefined;
  const defaultCnpj = onlyDigits(Deno.env.get('LICITACOES_PNCP_CNPJ') ?? IFRN_CNPJ);
  const unidadeCodigos = normalizeUnidadeCodigos(body);
  const defaults = defaultDateRange();
  const dataInicial = normalizePncpDate(body.dataInicial ?? defaults.dataInicial);
  const dataFinal = normalizePncpDate(body.dataFinal ?? defaults.dataFinal);
  const modalidadeId = Number(body.modalidadeId ?? PREGAO_ELETRONICO_MODALIDADE_ID);
  const objetoBusca = body.objetoBusca?.trim() || undefined;
  const itemBusca = body.itemBusca?.trim() || undefined;
  const windows = splitPncpDateRange(dataInicial, dataFinal);
  const errors: Array<{ scope: string; message: string }> = [];
  const unidadeContexts = await resolveUnidadeContexts({
    unidadeCodigos,
    requestedCnpj,
    defaultCnpj,
    errors,
  });
  const runCnpj = requestedCnpj || unidadeContexts[0]?.cnpj || defaultCnpj;

  const { data: runInsert, error: runInsertError } = await supabase
    .from('licitacoes_pncp_sync_runs')
    .insert({
      cnpj_orgao: runCnpj,
      unidade_codigos: unidadeCodigos,
      data_inicial: `${dataInicial.slice(0, 4)}-${dataInicial.slice(4, 6)}-${dataInicial.slice(6, 8)}`,
      data_final: `${dataFinal.slice(0, 4)}-${dataFinal.slice(4, 6)}-${dataFinal.slice(6, 8)}`,
      modalidade_id: modalidadeId,
      total_windows: windows.length * unidadeContexts.length,
      details: {
        source: body.source ?? 'manual',
        enrichUasgs: body.enrichUasgs !== false,
        objetoBusca,
        itemBusca,
        scope: unidadeCodigos.length ? 'uasgs' : 'cnpj',
        resolvedCnpjs: Object.fromEntries(unidadeContexts.map((context) => [context.unidadeCodigo ?? 'cnpj', context.cnpj])),
      },
    })
    .select('id')
    .single();

  if (runInsertError) throw runInsertError;
  const runId = String(runInsert.id);

  try {
    if (body.enrichUasgs !== false) {
      const uasgRows = unidadeContexts.map((context) => context.uasgData).filter(Boolean);
      if (uasgRows.length > 0) {
        await upsertInChunks(supabase, 'licitacoes_pncp_uasgs', uasgRows as Record<string, unknown>[], 'codigo_uasg');
      }
    }

    const listRows: CollectedPncpCompra[] = [];
    for (const context of unidadeContexts) {
      for (const window of windows) {
        try {
          const rows = await collectPncpCompras({
            cnpj: context.cnpj,
            unidadeCodigo: context.unidadeCodigo,
            dataInicial: window.dataInicial,
            dataFinal: window.dataFinal,
            modalidadeId,
          });
          listRows.push(...rows.map((row) => ({ cnpj: context.cnpj, row })));
        } catch (error) {
          errors.push({
            scope: `${context.unidadeCodigo ?? 'cnpj'}:${window.dataInicial}-${window.dataFinal}`,
            message: errorToMessage(error),
          });
        }
      }
    }

    const uniqueByNumeroControle = new Map<string, CollectedPncpCompra>();
    for (const item of listRows) {
      const key = typeof item.row.numeroControlePNCP === 'string' ? item.row.numeroControlePNCP : null;
      if (key) uniqueByNumeroControle.set(key, item);
    }

    const detailedRows = await mapWithConcurrency(
      Array.from(uniqueByNumeroControle.values()),
      async (item) => {
        const detail = await fetchPncpDetail(item.cnpj, item.row);
        const shouldFetchItens = body.fetchItens !== false;
        if (!shouldFetchItens && !itemBusca) return { cnpj: item.cnpj, row: detail };

        const itens = await fetchPncpItems(item.cnpj, detail).catch(() => []);
        return {
          cnpj: item.cnpj,
          row: {
            ...detail,
            itens,
          },
        };
      },
      5,
    );
    const matchedRows = detailedRows.filter((item) => (
      matchesObjetoBusca(item.row, objetoBusca)
      && pncpCompraMatchesItemSearch(item.row, itemBusca)
    ));

    const payloadRows: Array<LicitacaoPncpPayload & { sync_run_id: string }> = [];
    for (const item of matchedRows) {
      try {
        payloadRows.push({
          ...mapPncpCompra(item.row),
          sync_run_id: runId,
        });
      } catch (error) {
        errors.push({
          scope: String(item.row.numeroControlePNCP ?? 'unknown'),
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
          matchedRows: matchedRows.length,
          objetoBusca,
          itemBusca,
          unidadeCodigos,
          scope: unidadeCodigos.length ? 'uasgs' : 'cnpj',
          resolvedCnpjs: Object.fromEntries(unidadeContexts.map((context) => [context.unidadeCodigo ?? 'cnpj', context.cnpj])),
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
      matchedRows: matchedRows.length,
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

    const body = await request.json().catch(() => ({})) as any;
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

    if (body.enrichExistingItems === true) {
      console.log('[enrichExistingItems] Verificando licitacoes sem itens no banco...');
      const { data: licitacoes, error: licErr } = await supabase
        .from('licitacoes_pncp')
        .select('id, numero_controle_pncp, cnpj_orgao, ano_compra, sequencial_compra, raw_data')
        .order('data_publicacao_pncp', { ascending: false, nullsFirst: false });

      if (licErr) throw licErr;

      const toEnrich = (licitacoes ?? []).filter((lic: any) => {
        const raw = lic.raw_data as Record<string, unknown> | null;
        return !Array.isArray(raw?.itens) || (raw?.itens as unknown[]).length === 0;
      });

      console.log(`[enrichExistingItems] Total para enriquecer: ${toEnrich.length} de ${licitacoes?.length ?? 0}`);

      let enrichedCount = 0;
      const errors: Array<{ numeroControle: string; message: string }> = [];

      await mapWithConcurrency(
        toEnrich,
        async (lic: any) => {
          const cnpj = onlyDigits(lic.cnpj_orgao) || IFRN_CNPJ;
          const ano = Number(lic.ano_compra);
          const seq = Number(lic.sequencial_compra);
          if (!ano || !seq) return;

          try {
            const itens = await fetchPncpItems(cnpj, { anoCompra: ano, sequencialCompra: seq });
            if (Array.isArray(itens) && itens.length > 0) {
              const updatedRawData = {
                ...(typeof lic.raw_data === 'object' && lic.raw_data ? lic.raw_data : {}),
                itens,
              };

              const { error: updateErr } = await supabase
                .from('licitacoes_pncp')
                .update({ raw_data: updatedRawData, updated_at: new Date().toISOString() })
                .eq('id', lic.id);

              if (updateErr) {
                errors.push({ numeroControle: lic.numero_controle_pncp, message: updateErr.message });
              } else {
                enrichedCount += 1;
              }
            }
          } catch (err) {
            errors.push({ numeroControle: lic.numero_controle_pncp, message: errorToMessage(err) });
          }
        },
        5,
      );

      return jsonResponse({
        status: 'success',
        totalChecked: licitacoes?.length ?? 0,
        totalEligible: toEnrich.length,
        enrichedCount,
        errors,
      });
    }

    if (body.resolveIndividual === true && body.query) {
      console.log(`[resolveIndividual] Buscando no Elasticsearch do PNCP: ${body.query}`);
      const searchUrl = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(body.query)}&tipos_documento=edital&pagina=1&tam_pagina=10`;
      
      const response = await fetchWithTimeout(searchUrl, 15000);
      if (!response.ok) {
        throw new Error(`PNCP Search API returned ${response.status}`);
      }
      
      const searchData = await response.json();
      const items = Array.isArray(searchData?.items) ? searchData.items : [];
      const insertedRows = [];

      for (const item of items) {
        if (!item.numero_controle_pncp || !item.unidade_codigo) continue;
        
        const match = item.title.match(/n[ºo]\s*(\d+)\/(\d{4})/i);
        if (match) {
          const num = match[1];

          const row1 = {
            numero_controle_pncp: item.numero_controle_pncp,
            cnpj_orgao: item.orgao_cnpj,
            ano_compra: Number(item.ano),
            sequencial_compra: Number(item.numero_sequencial),
            numero_compra: num,
            uasg_codigo: item.unidade_codigo,
            objeto_compra: item.description || '',
            raw_data: item,
            compras_gov_data: {}
          };
          
          const { error: err1 } = await supabase
            .from('licitacoes_pncp')
            .upsert(row1, { onConflict: 'numero_controle_pncp' });
            
          if (err1) {
            console.error('Error inserting row:', err1);
          } else {
            insertedRows.push(row1);
          }
        }
      }

      return jsonResponse({
        status: 'success',
        resolvedCount: insertedRows.length,
        resolved: insertedRows
      });
    }

    return jsonResponse(await runSync(supabase, body));
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: errorToMessage(error) }, 500);
  }
});
