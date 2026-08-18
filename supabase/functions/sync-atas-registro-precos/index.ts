import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { DEFAULT_PNCP_UASGS } from '../../../src/lib/licitacoesPncp.ts';
import {
  asRecord,
  buildAtaKey,
  firstString,
  mapAtaRegistroPreco,
  mapAtaRegistroPrecoAdesao,
  mapAtaRegistroPrecoItem,
  mapAtaRegistroPrecoUnidade,
  normalizeAtaUasg,
  type AtaRegistroPrecoPayload,
  type AtaRegistroPrecoRaw,
} from '../../../src/lib/atasRegistroPrecos.ts';

const COMPRAS_DADOS_ABERTOS_BASE = 'https://dadosabertos.compras.gov.br';
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_LOOKBACK_DAYS = 364;
const PAGE_TIMEOUT_MS = 25000;
const DETAIL_TIMEOUT_MS = 12000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-atas-rp-sync-secret',
};

type SupabaseClient = ReturnType<typeof createClient>;

type SyncRequest = {
  unidadeCodigo?: string;
  unidadeCodigos?: string[];
  dataInicial?: string;
  dataFinal?: string;
  source?: string;
  objetoBusca?: string;
  numeroAta?: string;
  includeDetalhes?: boolean;
  includeParticipantes?: boolean;
  includeAdesoes?: boolean;
  adesaoUnidadeCodigos?: string[];
};

type ComprasPage = {
  resultado?: AtaRegistroPrecoRaw[];
  totalPaginas?: number;
  paginasRestantes?: number;
};

type AtaWithItems = {
  ata: AtaRegistroPrecoPayload;
  items: ReturnType<typeof mapAtaRegistroPrecoItem>[];
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
  if (!value) throw new Error(`A variavel ${name} precisa estar configurada no ambiente do Supabase.`);
  return value;
}

function assertOptionalSharedSecret(request: Request) {
  const expectedSecret = Deno.env.get('ATAS_RP_SYNC_SECRET');
  if (!expectedSecret) return;

  const providedSecret = request.headers.get('x-atas-rp-sync-secret');
  if (!providedSecret || providedSecret !== expectedSecret) {
    throw new Response(JSON.stringify({ error: 'Segredo de sincronizacao ausente ou invalido.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

function normalizeDateInput(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Data invalida: ${value}`);
  return isoDateOnly(parsed);
}

function normalizeUnidadeCodigos(body: SyncRequest) {
  const configured = Deno.env.get('ATAS_RP_UASGS')
    ?.split(',')
    .map((value) => normalizeAtaUasg(value))
    .filter(Boolean) as string[] | undefined;

  const requested = body.unidadeCodigos?.length
    ? body.unidadeCodigos
    : body.unidadeCodigo
      ? [body.unidadeCodigo]
      : configured?.length
        ? configured
        : DEFAULT_PNCP_UASGS;

  return Array.from(new Set((requested ?? []).map((value) => normalizeAtaUasg(value)).filter(Boolean) as string[]));
}

function normalizeAdesaoUnidadeCodigos(body: SyncRequest, fallbackUnidadeCodigos: string[]) {
  const requested = body.adesaoUnidadeCodigos?.length ? body.adesaoUnidadeCodigos : fallbackUnidadeCodigos;
  return Array.from(new Set(requested.map((value) => normalizeAtaUasg(value)).filter(Boolean) as string[]));
}

function normalizeSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function matchesObjetoBusca(ata: AtaRegistroPrecoPayload, objetoBusca?: string) {
  const needle = normalizeSearchText(objetoBusca);
  if (!needle) return true;
  return normalizeSearchText(ata.objeto).includes(needle)
    || normalizeSearchText(ata.raw_data).includes(needle);
}

async function fetchWithTimeout(url: string, timeoutMs = PAGE_TIMEOUT_MS) {
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

async function fetchJson<T>(url: string, timeoutMs = PAGE_TIMEOUT_MS): Promise<T | null> {
  const response = await fetchWithTimeout(url, timeoutMs);
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status} em ${url}: ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency = 4): Promise<R[]> {
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
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function upsertInChunks(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string) {
  let count = 0;
  for (const rowChunk of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(rowChunk, { onConflict });
    if (error) throw error;
    count += rowChunk.length;
  }
  return count;
}

async function collectComprasPages(path: string, params: Record<string, string>, timeoutMs = PAGE_TIMEOUT_MS) {
  const collected: AtaRegistroPrecoRaw[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const search = new URLSearchParams({
      ...params,
      pagina: String(pagina),
      tamanhoPagina: String(DEFAULT_PAGE_SIZE),
    });
    const page = await fetchJson<ComprasPage>(`${COMPRAS_DADOS_ABERTOS_BASE}${path}?${search.toString()}`, timeoutMs);
    const rows = page?.resultado ?? [];
    collected.push(...rows);
    totalPaginas = page?.totalPaginas ?? (page?.paginasRestantes ? pagina + page.paginasRestantes : pagina);
    pagina += 1;
  } while (pagina <= totalPaginas);

  return collected;
}

async function fetchAtasGerenciadas(unidadeCodigo: string, dataInicial: string, dataFinal: string, numeroAta?: string | null) {
  const params: Record<string, string> = {
    codigoUnidadeGerenciadora: unidadeCodigo,
    dataVigenciaInicialMin: dataInicial,
    dataVigenciaInicialMax: dataFinal,
  };
  if (numeroAta) params.numeroAtaRegistroPreco = numeroAta;
  return collectComprasPages('/modulo-arp/1_consultarARP', params);
}

async function fetchAtaItems(unidadeGerenciadoraCodigo: string, dataInicial: string, dataFinal: string, numeroAta?: string | null) {
  const params: Record<string, string> = {
    codigoUnidadeGerenciadora: unidadeGerenciadoraCodigo,
    dataVigenciaInicialMin: dataInicial,
    dataVigenciaInicialMax: dataFinal,
  };
  if (numeroAta) params.numeroAtaRegistroPreco = numeroAta;
  return collectComprasPages('/modulo-arp/2_consultarARPItem', params);
}

async function fetchUnidadesItem(item: { numero_ata: string; unidade_gerenciadora_codigo: string; numero_item: string }) {
  return collectComprasPages('/modulo-arp/3_consultarUnidadesItem', {
    numeroAta: item.numero_ata,
    unidadeGerenciadora: item.unidade_gerenciadora_codigo,
    numeroItem: item.numero_item,
  }, DETAIL_TIMEOUT_MS);
}

async function fetchAdesoesItem(item: { numero_ata: string; unidade_gerenciadora_codigo: string; numero_item: string }, unidadeCodigo: string) {
  return collectComprasPages('/modulo-arp/5_consultarAdesoesItem', {
    numeroAta: item.numero_ata,
    unidadeGerenciadora: item.unidade_gerenciadora_codigo,
    numeroItem: item.numero_item,
    unidade: unidadeCodigo,
  }, DETAIL_TIMEOUT_MS);
}

async function runSync(supabase: SupabaseClient, body: SyncRequest) {
  const defaults = defaultDateRange();
  const dataInicial = normalizeDateInput(body.dataInicial ?? defaults.dataInicial);
  const dataFinal = normalizeDateInput(body.dataFinal ?? defaults.dataFinal);
  const unidadeCodigos = normalizeUnidadeCodigos(body);
  const adesaoUnidadeCodigos = normalizeAdesaoUnidadeCodigos(body, unidadeCodigos);
  const includeDetalhes = body.includeDetalhes === true;
  const includeParticipantes = includeDetalhes || body.includeParticipantes === true;
  const includeAdesoes = includeDetalhes || body.includeAdesoes === true;
  const numeroAta = body.numeroAta?.trim() || undefined;
  const errors: Array<{ scope: string; message: string }> = [];

  const { data: runInsert, error: runInsertError } = await supabase
    .from('atas_registro_precos_sync_runs')
    .insert({
      unidade_codigos: unidadeCodigos,
      data_inicial: dataInicial,
      data_final: dataFinal,
      details: {
        source: body.source ?? 'manual',
        includeDetalhes,
        includeParticipantes,
        includeAdesoes,
        adesaoUnidadeCodigos,
        numeroAta: numeroAta ?? null,
        objetoBusca: body.objetoBusca?.trim() || null,
      },
    })
    .select('id')
    .single();

  if (runInsertError) throw runInsertError;
  const runId = String(runInsert.id);

  try {
    const atasByKey = new Map<string, AtaRegistroPrecoPayload>();
    const detailOnlyAtaKeys = new Set<string>();
    const itemsByKey = new Map<string, ReturnType<typeof mapAtaRegistroPrecoItem>>();
    const unidadesByKey = new Map<string, ReturnType<typeof mapAtaRegistroPrecoUnidade>>();
    const adesoesByKey = new Map<string, ReturnType<typeof mapAtaRegistroPrecoAdesao>>();

    for (const unidadeCodigo of unidadeCodigos) {
      if (includeDetalhes && numeroAta) {
        const ata = mapAtaRegistroPreco({
          codigoUnidadeGerenciadora: unidadeCodigo,
          numeroAtaRegistroPreco: numeroAta,
          dataVigenciaInicial: dataInicial,
          dataVigenciaFinal: dataFinal,
        });
        atasByKey.set(ata.ata_key, ata);
        detailOnlyAtaKeys.add(ata.ata_key);
        continue;
      }

      try {
        const rawAtas = await fetchAtasGerenciadas(unidadeCodigo, dataInicial, dataFinal, numeroAta);
        for (const rawAta of rawAtas) {
          const ata = mapAtaRegistroPreco(rawAta);
          if (numeroAta && ata.numero_ata !== numeroAta) continue;
          if (matchesObjetoBusca(ata, body.objetoBusca)) atasByKey.set(ata.ata_key, ata);
        }
      } catch (error) {
        errors.push({ scope: `${unidadeCodigo}:atas`, message: errorToMessage(error) });
      }
    }

    const atas = Array.from(atasByKey.values());
    if (includeParticipantes || includeAdesoes) {
      await mapWithConcurrency(unidadeCodigos, async (unidadeCodigo) => {
        try {
          const rawItems = await fetchAtaItems(unidadeCodigo, dataInicial, dataFinal, numeroAta);
          for (const rawItem of rawItems) {
            const raw = asRecord(rawItem);
            const rawNumAta = firstString(raw, ['numeroAtaRegistroPreco', 'numeroAta', 'numero_ata']);
            if (!rawNumAta) continue;

            const targetAtaKey = buildAtaKey(unidadeCodigo, rawNumAta);
            const parentAta = atasByKey.get(targetAtaKey);
            if (!parentAta) continue;

            const rawIdCompra = firstString(raw, ['idCompra', 'id_compra']);
            const ataIdCompra = firstString(parentAta.raw_data, ['idCompra', 'id_compra']);
            if (rawIdCompra && ataIdCompra && rawIdCompra !== ataIdCompra) continue;

            const rawPncpAta = firstString(raw, ['numeroControlePncpAta', 'numeroControlePncp']);
            const ataPncpAta = firstString(parentAta.raw_data, ['numeroControlePncpAta', 'numeroControlePncp']);
            if (rawPncpAta && ataPncpAta && rawPncpAta !== ataPncpAta) continue;

            const rawNumCompra = firstString(raw, ['numeroCompra', 'numero_compra']);
            if (rawNumCompra && parentAta.numero_compra && rawNumCompra !== parentAta.numero_compra) continue;

            try {
              const mappedItem = mapAtaRegistroPrecoItem(rawItem, parentAta);
              itemsByKey.set(mappedItem.item_key, mappedItem);
            } catch {
              // Ignora item divergente
            }
          }
        } catch (error) {
          errors.push({ scope: `${unidadeCodigo}:itens`, message: errorToMessage(error) });
        }
      }, 3);

      await mapWithConcurrency(Array.from(itemsByKey.values()), async (item) => {
        if (includeParticipantes) {
          try {
            const rawUnidades = await fetchUnidadesItem(item);
            for (const rawUnidade of rawUnidades) {
              const unidade = mapAtaRegistroPrecoUnidade(rawUnidade, item);
              unidadesByKey.set(unidade.unidade_item_key, unidade);
            }
          } catch (error) {
            errors.push({ scope: `${item.item_key}:unidades`, message: errorToMessage(error) });
          }
        }

        if (includeAdesoes) {
          for (const unidadeCodigo of adesaoUnidadeCodigos) {
            try {
              const rawAdesoes = await fetchAdesoesItem(item, unidadeCodigo);
              for (const rawAdesao of rawAdesoes) {
                const adesao = mapAtaRegistroPrecoAdesao(rawAdesao, item);
                adesoesByKey.set(adesao.adesao_key, adesao);
              }
            } catch (error) {
              errors.push({ scope: `${item.item_key}:adesoes:${unidadeCodigo}`, message: errorToMessage(error) });
            }
          }
        }
      }, 4);
    }

    const ataRows = atas
      .filter((ata) => !detailOnlyAtaKeys.has(ata.ata_key))
      .map((ata) => ({ ...ata, sync_run_id: runId }));
    const upsertedAtas = ataRows.length
      ? await upsertInChunks(supabase, 'atas_registro_precos', ataRows as Record<string, unknown>[], 'ata_key')
      : 0;
    const upsertedItems = itemsByKey.size
      ? await upsertInChunks(supabase, 'atas_registro_precos_itens', Array.from(itemsByKey.values()) as unknown as Record<string, unknown>[], 'item_key')
      : 0;
    const upsertedUnidades = unidadesByKey.size
      ? await upsertInChunks(supabase, 'atas_registro_precos_unidades', Array.from(unidadesByKey.values()) as unknown as Record<string, unknown>[], 'unidade_item_key')
      : 0;
    const upsertedAdesoes = adesoesByKey.size
      ? await upsertInChunks(supabase, 'atas_registro_precos_adesoes', Array.from(adesoesByKey.values()) as unknown as Record<string, unknown>[], 'adesao_key')
      : 0;

    const totalUpserted = upsertedAtas + upsertedItems + upsertedUnidades + upsertedAdesoes;
    const status = errors.length > 0 ? (totalUpserted > 0 ? 'partial_success' : 'error') : 'success';

    const { error: finishError } = await supabase
      .from('atas_registro_precos_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status,
        total_fetched: atas.length + itemsByKey.size + unidadesByKey.size + adesoesByKey.size,
        total_upserted: totalUpserted,
        error_message: errors.length ? `${errors.length} escopo(s) com falha.` : null,
        details: {
          source: body.source ?? 'manual',
          includeDetalhes,
          includeParticipantes,
          includeAdesoes,
          adesaoUnidadeCodigos,
          numeroAta: numeroAta ?? null,
          objetoBusca: body.objetoBusca?.trim() || null,
          errors,
          counts: {
            atas: atas.length,
            itens: itemsByKey.size,
            unidades: unidadesByKey.size,
            adesoes: adesoesByKey.size,
          },
        },
      })
      .eq('id', runId);

    if (finishError) throw finishError;

    return {
      runId,
      status,
      fetched: atas.length + itemsByKey.size + unidadesByKey.size + adesoesByKey.size,
      upserted: totalUpserted,
      counts: {
        atas: atas.length,
        itens: itemsByKey.size,
        unidades: unidadesByKey.size,
        adesoes: adesoesByKey.size,
      },
      errors,
    };
  } catch (error) {
    await supabase
      .from('atas_registro_precos_sync_runs')
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

  if (request.method !== 'POST') return jsonResponse({ error: 'Metodo nao permitido.' }, 405);

  try {
    assertOptionalSharedSecret(request);
    const body = await request.json().catch(() => ({})) as SyncRequest;
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return jsonResponse(await runSync(supabase, body));
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonResponse({ error: errorToMessage(error) }, 500);
  }
});
