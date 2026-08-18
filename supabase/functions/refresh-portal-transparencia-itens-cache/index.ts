import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  DEFAULT_UASG,
  PROCESSO_PREFIX_TO_UASG,
  extractUasgFromDescricao,
  extractUasgFromProcesso,
  getPortalEmpenhoAvailableBalance,
  matchesPortalEmpenhoCacheStage,
  type PortalEmpenhoBalanceRow,
  type PortalEmpenhoCacheStage,
} from '../_shared/portal_itens_cache.ts';

const PORTAL_API_BASE = 'https://api.portaldatransparencia.gov.br/api-de-dados/despesas';
const DEFAULT_PORTAL_TRANSPARENCIA_API_KEY = '931d4d57337bef94e775337c318342e9';
const UNIDADE_GESTORA = DEFAULT_UASG;
const GESTAO = '26435';
const FOUND_TTL_MS = 12 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 15 * 60 * 1000;
const PORTAL_PAGE_LIMIT = 30;
const CACHE_ROWS_SELECT = [
  'id',
  'empenho_lookup_key',
  'empenho_numero',
  'codigo_documento',
  'codigo_item_empenho',
  'sequencial',
  'descricao',
  'codigo_subelemento',
  'descricao_subelemento',
  'valor_atual',
  'historico',
  'raw_data',
  'fetched_at',
].join(',');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-portal-transparencia-cache-secret',
};

type SupabaseClient = ReturnType<typeof createClient>;

type RefreshRequest = {
  empenhoNumero?: string;
  empenhos?: string[];
  unidadeCodigo?: string;
  refreshDue?: boolean;
  refreshPositiveEmpenhos?: boolean;
  empenhoTipo?: PortalEmpenhoCacheStage;
  refreshLinkedRequisicaoEmpenhos?: boolean;
  readCacheOnly?: boolean;
  returnRows?: boolean;
  limit?: number;
  source?: string;
};

type PortalItemCacheRow = {
  empenho_lookup_key: string;
  empenho_numero: string;
  codigo_documento: string;
  codigo_item_empenho: string | null;
  sequencial: number;
  descricao: string | null;
  codigo_subelemento: string | null;
  descricao_subelemento: string | null;
  valor_atual: number | null;
  historico: unknown[];
  raw_data: Record<string, unknown>;
  fetched_at: string;
};
type EmpenhoBalanceCacheRow = PortalEmpenhoBalanceRow & {
  id: string;
  numero: string;
  status?: string | null;
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

function getPortalApiKey() {
  return (
    Deno.env.get('PORTAL_TRANSPARENCIA_API_KEY') ||
    Deno.env.get('VITE_PORTAL_TRANSPARENCIA_API_KEY') ||
    DEFAULT_PORTAL_TRANSPARENCIA_API_KEY
  );
}

function assertOptionalSharedSecret(request: Request) {
  const expectedSecret = Deno.env.get('PORTAL_TRANSPARENCIA_CACHE_SECRET');
  if (!expectedSecret) return;

  const providedSecret = request.headers.get('x-portal-transparencia-cache-secret');
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

function normalizeEmpenhoNumero(raw: unknown) {
  const normalized = String(raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const match = normalized.match(/(\d{4}NE\d{6})$/);
  return match?.[1] ?? normalized;
}

async function resolveEmpenhoUasg(
  supabase: SupabaseClient,
  empenhoNumero: string,
  explicitUasg?: string | null,
): Promise<string> {
  if (explicitUasg && explicitUasg.length === 6) return explicitUasg;

  const normalized = normalizeEmpenhoNumero(empenhoNumero);

  // 1. Fonte primária de verdade: tabela empenhos do campus
  const { data: empRows } = await supabase
    .from('empenhos')
    .select('processo, descricao')
    .ilike('numero', `%${normalized}%`)
    .limit(1);

  if (empRows && empRows.length > 0) {
    const emp = empRows[0] as any;
    const uasgFromProcesso = extractUasgFromProcesso(emp.processo);
    if (uasgFromProcesso) return uasgFromProcesso;

    const uasgFromDesc = extractUasgFromDescricao(emp.descricao);
    if (uasgFromDesc) return uasgFromDesc;
  }

  // 2. Consulta complementar em contratos_api_empenhos (apenas se não encontrado em empenhos)
  const { data: ceRows } = await supabase
    .from('contratos_api_empenhos')
    .select('unidade_gestora, raw_data')
    .eq('numero', normalized)
    .limit(10);

  if (ceRows && ceRows.length > 0) {
    const defaultRow = ceRows.find((ce: any) => ce.unidade_gestora === UNIDADE_GESTORA);
    if (defaultRow) return UNIDADE_GESTORA;

    const reitoriaRow = ceRows.find((ce: any) => ce.unidade_gestora === '158155');
    if (reitoriaRow) return '158155';

    for (const ce of ceRows as any[]) {
      if (ce.unidade_gestora && ce.unidade_gestora.length === 6) return ce.unidade_gestora;
      const info = ce.raw_data?.informacao_complementar || '';
      const uasgFromInfo = extractUasgFromDescricao(info);
      if (uasgFromInfo) return uasgFromInfo;
    }
  }

  return UNIDADE_GESTORA;
}


function buildCodigoDocumento(empenhoNumero: string, uasg = UNIDADE_GESTORA) {
  const normalized = normalizeEmpenhoNumero(empenhoNumero);
  return normalized ? `${uasg}${GESTAO}${normalized}` : '';
}

function parseCurrency(raw: unknown) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const normalized = String(raw ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addMilliseconds(date: Date, amount: number) {
  return new Date(date.getTime() + amount).toISOString();
}

async function fetchPortalPage<T = unknown>(url: string): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'chave-api-dados': getPortalApiKey(),
    },
  });

  if (!response.ok) {
    throw new Error(`Portal da Transparencia retornou HTTP ${response.status} em ${url}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

async function fetchPortalPaginated<T = unknown>(buildUrl: (page: number) => string): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 1; page <= PORTAL_PAGE_LIMIT; page += 1) {
    const pageRows = await fetchPortalPage<T>(buildUrl(page));
    rows.push(...pageRows);
    if (pageRows.length === 0) break;
  }

  return rows;
}

function mapPortalItem(
  empenhoNumero: string,
  codigoDocumento: string,
  fetchedAt: string,
  row: Record<string, unknown>,
): PortalItemCacheRow {
  return {
    empenho_lookup_key: normalizeEmpenhoNumero(empenhoNumero),
    empenho_numero: empenhoNumero,
    codigo_documento: codigoDocumento,
    codigo_item_empenho: String(row.codigoItemEmpenho ?? '').trim() || null,
    sequencial: Number(row.sequencial ?? 0) || 0,
    descricao: String(row.descricao ?? '').trim() || null,
    codigo_subelemento: String(row.codigoSubelemento ?? '').trim() || null,
    descricao_subelemento: String(row.descricaoSubelemento ?? '').trim() || null,
    valor_atual: parseCurrency(row.valorAtual),
    historico: [],
    raw_data: row,
    fetched_at: fetchedAt,
  };
}

async function discoverItens(empenhoNumero: string, uasg = UNIDADE_GESTORA): Promise<PortalItemCacheRow[]> {
  const lookupKey = normalizeEmpenhoNumero(empenhoNumero);
  const codigoDocumento = buildCodigoDocumento(empenhoNumero, uasg);
  if (!lookupKey || !codigoDocumento) return [];

  const rows = await fetchPortalPaginated<Record<string, unknown>>(
    (page) => `${PORTAL_API_BASE}/itens-de-empenho?codigoDocumento=${encodeURIComponent(codigoDocumento)}&pagina=${page}`,
  );
  const fetchedAt = new Date().toISOString();
  return rows.map((row) => mapPortalItem(empenhoNumero, codigoDocumento, fetchedAt, row));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function replaceCacheRows(
  supabase: SupabaseClient,
  empenhoNumero: string,
  returnRows = false,
  explicitUasg?: string | null,
) {
  const lookupKey = normalizeEmpenhoNumero(empenhoNumero);
  const uasg = await resolveEmpenhoUasg(supabase, empenhoNumero, explicitUasg);
  const codigoDocumento = buildCodigoDocumento(empenhoNumero, uasg);
  if (!lookupKey || !codigoDocumento) {
    return { empenhoNumero, lookupKey, status: 'not_found', rowsCount: 0 };
  }

  try {
    const rows = await discoverItens(empenhoNumero, uasg);
    const now = new Date();
    const status = rows.length > 0 ? 'found' : 'not_found';

    const { error: statusError } = await supabase
      .from('portal_transparencia_empenho_itens_cache_status')
      .upsert({
        empenho_lookup_key: lookupKey,
        empenho_numero: empenhoNumero,
        codigo_documento: codigoDocumento,
        status,
        rows_count: rows.length,
        fetched_at: now.toISOString(),
        expires_at: addMilliseconds(now, rows.length > 0 ? FOUND_TTL_MS : NOT_FOUND_TTL_MS),
        error_message: null,
      }, { onConflict: 'empenho_lookup_key' });
    if (statusError) throw statusError;

    const { error: deleteError } = await supabase
      .from('portal_transparencia_empenho_itens_cache')
      .delete()
      .eq('empenho_lookup_key', lookupKey);
    if (deleteError) throw deleteError;

    for (const rowChunk of chunk(rows, 500)) {
      if (rowChunk.length === 0) continue;
      const { error: insertError } = await supabase
        .from('portal_transparencia_empenho_itens_cache')
        .insert(rowChunk);
      if (insertError) throw insertError;
    }

    return { empenhoNumero, lookupKey, status, rowsCount: rows.length, ...(returnRows ? { rows } : {}) };
  } catch (error) {
    const now = new Date();
    const message = error instanceof Error ? error.message : String(error);
    const { error: statusError } = await supabase
      .from('portal_transparencia_empenho_itens_cache_status')
      .upsert({
        empenho_lookup_key: lookupKey,
        empenho_numero: empenhoNumero,
        codigo_documento: codigoDocumento,
        status: 'error',
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
  const lookupKey = normalizeEmpenhoNumero(empenhoNumero);
  if (!lookupKey) {
    return { empenhoNumero, lookupKey, status: 'not_found', rowsCount: 0, rows: [] };
  }

  const { data: statusRow, error: statusError } = await supabase
    .from('portal_transparencia_empenho_itens_cache_status')
    .select('empenho_lookup_key, empenho_numero, codigo_documento, status, rows_count, fetched_at, expires_at, error_message')
    .eq('empenho_lookup_key', lookupKey)
    .maybeSingle();
  if (statusError) throw statusError;

  if (!statusRow) {
    return { empenhoNumero, lookupKey, status: 'missing', rowsCount: 0, rows: [] };
  }

  const { data: rows, error: rowsError } = await supabase
    .from('portal_transparencia_empenho_itens_cache')
    .select(CACHE_ROWS_SELECT)
    .eq('empenho_lookup_key', lookupKey)
    .order('sequencial', { ascending: true });
  if (rowsError) throw rowsError;

  return {
    empenhoNumero,
    lookupKey,
    status: statusRow.status,
    rowsCount: rows && rows.length > 0 ? rows.length : Number(statusRow.rows_count ?? 0),
    fetchedAt: statusRow.fetched_at,
    expiresAt: statusRow.expires_at,
    error: statusRow.error_message,
    ...(returnRows ? { rows: rows ?? [] } : {}),
  };
}

async function getDueEmpenhos(supabase: SupabaseClient, limit: number) {
  const { data, error } = await supabase
    .from('portal_transparencia_empenho_itens_cache_status')
    .select('empenho_numero')
    .lte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row: { empenho_numero: string }) => row.empenho_numero).filter(Boolean);
}
async function getPositiveEmpenhos(
  supabase: SupabaseClient,
  stage: PortalEmpenhoCacheStage,
  pageSize: number,
) {
  const numbers = new Set<string>();
  const select = 'id,numero,tipo,status,valor,valor_liquidado_a_pagar,valor_pago_oficial,saldo_rap_oficial,rap_a_liquidar,rap_inscrito,rap_pago';
  let offset = 0;

  while (true) {
    let query = supabase
      .from('empenhos')
      .select(select)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    query = stage === 'rap'
      ? query.eq('tipo', 'rap')
      : query.or('tipo.eq.exercicio,tipo.is.null');

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as EmpenhoBalanceCacheRow[];
    for (const row of page) {
      if (String(row.status ?? '').trim().toLowerCase() === 'cancelado') continue;
      if (getPortalEmpenhoAvailableBalance(row) <= 0) continue;
      const numero = normalizeEmpenhoNumero(row.numero);
      if (numero && matchesPortalEmpenhoCacheStage(row, stage)) numbers.add(numero);
    }

    if (page.length < pageSize) break;
    offset += page.length;
  }

  return Array.from(numbers);
}


async function getLinkedRequisicaoEmpenhos(supabase: SupabaseClient, limit: number) {
  const empenhoIds = new Set<string>();
  const empenhoNumeros = new Set<string>();

  const { data: permissionRows, error: permissionError } = await supabase
    .from('terceirizado_permissions')
    .select('empenho_id')
    .not('empenho_id', 'is', null)
    .limit(limit * 3);
  if (permissionError) throw permissionError;

  for (const row of permissionRows ?? []) {
    const empenhoId = String((row as { empenho_id?: string | null }).empenho_id ?? '').trim();
    if (empenhoId) empenhoIds.add(empenhoId);
  }

  const { data: requisicaoEmpenhoRows, error: requisicaoEmpenhoError } = await supabase
    .from('requisicao_compra_empenhos')
    .select('empenho_id, empenho_numero, requisicoes_compra!inner(status)')
    .in('requisicoes_compra.status', ['draft', 'review'])
    .limit(limit * 3);
  if (requisicaoEmpenhoError) throw requisicaoEmpenhoError;

  for (const row of requisicaoEmpenhoRows ?? []) {
    const requisicaoEmpenho = row as { empenho_id?: string | null; empenho_numero?: string | null };
    const empenhoId = String(requisicaoEmpenho.empenho_id ?? '').trim();
    const empenhoNumero = normalizeEmpenhoNumero(requisicaoEmpenho.empenho_numero);
    if (empenhoId) empenhoIds.add(empenhoId);
    if (empenhoNumero) empenhoNumeros.add(empenhoNumero);
  }

  const { data: requisicaoRows, error: requisicaoError } = await supabase
    .from('requisicoes_compra')
    .select('empenho_id, empenho_numero, updated_at')
    .in('status', ['draft', 'review'])
    .not('empenho_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (requisicaoError) throw requisicaoError;

  for (const row of requisicaoRows ?? []) {
    const requisicao = row as { empenho_id?: string | null; empenho_numero?: string | null };
    const empenhoId = String(requisicao.empenho_id ?? '').trim();
    const empenhoNumero = normalizeEmpenhoNumero(requisicao.empenho_numero);
    if (empenhoId) empenhoIds.add(empenhoId);
    if (empenhoNumero) empenhoNumeros.add(empenhoNumero);
  }

  for (const idChunk of chunk(Array.from(empenhoIds), 100)) {
    if (idChunk.length === 0) continue;
    const { data: empenhoRows, error: empenhoError } = await supabase
      .from('empenhos')
      .select('id, numero')
      .in('id', idChunk);
    if (empenhoError) throw empenhoError;

    for (const row of empenhoRows ?? []) {
      const empenhoNumero = normalizeEmpenhoNumero((row as { numero?: string | null }).numero);
      if (empenhoNumero) empenhoNumeros.add(empenhoNumero);
    }
  }

  return Array.from(empenhoNumeros).slice(0, limit);
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

    if (body.refreshLinkedRequisicaoEmpenhos) {
      for (const empenho of await getLinkedRequisicaoEmpenhos(supabase, limit)) {
        requestedEmpenhos.add(empenho);
      }
    }

    if (body.refreshPositiveEmpenhos) {
      const stages: PortalEmpenhoCacheStage[] = body.empenhoTipo
        ? [body.empenhoTipo]
        : ['rap', 'exercicio'];
      for (const stage of stages) {
        for (const empenho of await getPositiveEmpenhos(supabase, stage, limit)) {
          requestedEmpenhos.add(empenho);
        }
      }
    }

    if (requestedEmpenhos.size === 0) {
      return jsonResponse({ status: 'noop', results: [] });
    }

    const results = [];
    const empenhosToProcess = body.refreshPositiveEmpenhos
      ? Array.from(requestedEmpenhos)
      : Array.from(requestedEmpenhos).slice(0, limit);
    for (const empenho of empenhosToProcess) {
      if (body.readCacheOnly) {
        results.push(await readCacheRows(supabase, empenho, Boolean(body.returnRows)));
      } else {
        results.push(await replaceCacheRows(supabase, empenho, Boolean(body.returnRows), body.unidadeCodigo));
      }
    }

    return jsonResponse({
      status: 'processed',
      source: body.source ?? null,
      results,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
