import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isSuperAdminEmail } from '../../../src/lib/authz.ts';
import { mapReference, syncWindow, validatePage, type RawRow } from './core.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const bounded = (value: unknown, fallback: number, max: number) => Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET','POST'].includes(req.method)) return json({ error: 'Método não permitido.' }, 405);
  const url = Deno.env.get('SUPABASE_URL') || '', key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const db = createClient(url, key, { auth: { persistSession: false } });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const secret = Deno.env.get('PRICE_SYNC_SECRET');
  const job = (secret && req.headers.get('x-sync-secret') === secret) || (key && token === key);
  if (!job) {
    if (!token) return json({ error: 'Autenticação obrigatória.' }, 401);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Sessão inválida.' }, 401);
    if (req.method === 'POST' && !isSuperAdminEmail(data.user.email) && data.user.app_metadata?.role !== 'superadmin' && data.user.app_metadata?.is_superadmin !== true) return json({ error: 'Sincronização restrita ao superadministrador.' }, 403);
  }
  if (req.method === 'GET') {
    const [total, pending, runs] = await Promise.all([
      db.from('preco_referencia_itens').select('id', { count: 'exact', head: true }),
      db.from('preco_referencia_itens').select('id', { count: 'exact', head: true }).or('embedding.is.null,embedding_model.is.null'),
      db.from('preco_referencia_sync_runs').select('*').order('started_at', { ascending: false }).limit(10),
    ]);
    if (total.error || pending.error || runs.error) return json({ error: 'Não foi possível consultar o status.' }, 500);
    // Lease credentials are never returned to the browser.
    return json({ status: 'online', totalItens: total.count, itensSemEmbedding: pending.count,
      recentRuns: runs.data?.map(({ lease_token: _token, ...run }) => run) });
  }
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || '';
  const model = Deno.env.get('PRICE_EMBEDDING_MODEL') || 'gemini-embedding-001';
  const deadline = Date.now() + 105000;
  async function processEmbeddings(limit: number) {
    if (!apiKey) return 0;
    const { data, error } = await db.from('preco_referencia_itens').select('id,descricao_item,descricao_detalhada,marca,updated_at')
      .or('embedding.is.null,embedding_model.is.null').order('created_at', { ascending: true }).limit(limit);
    if (error) throw error;
    let updated = 0;
    for (let start = 0; start < (data || []).length && Date.now() < deadline - 20000; start += 25) {
      const batch = data!.slice(start, start + 25);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ requests: batch.map(r => ({ model: `models/${model}`, outputDimensionality: 768,
          taskType: 'RETRIEVAL_DOCUMENT', content: { parts: [{ text: [r.descricao_item,r.descricao_detalhada,r.marca].filter(Boolean).join(' ').slice(0, 12000) }] } })) }),
      });
      if (!response.ok) throw new Error(`Embeddings HTTP ${response.status}; lote permanece pendente.`);
      const payload = await response.json();
      if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== batch.length) throw new Error('Resposta de embeddings incompleta.');
      for (let n = 0; n < batch.length; n++) {
        const values = payload.embeddings[n]?.values;
        if (!Array.isArray(values) || values.length !== 768 || !values.every(Number.isFinite)) throw new Error('Dimensão de embedding inválida.');
        // Optimistic concurrency: never attach a vector to a description changed meanwhile.
        const result = await db.from('preco_referencia_itens').update({ embedding: values, embedding_model: model })
          .eq('id', batch[n].id).eq('updated_at', batch[n].updated_at).select('id');
        if (result.error) throw result.error;
        updated += result.data?.length || 0;
      }
    }
    return updated;
  }
  let run: RawRow | null = null;
  try {
    const body = await req.json() as RawRow;
    const mode = String(body.mode || 'daily_delta'), scope = String(body.scope || 'federal_rn_nordeste');
    if (!['daily_delta','backfill_mensal','generate_embeddings'].includes(mode) || !['federal_rn_nordeste','nacional'].includes(scope)) return json({ error: 'Modo ou escopo inválido.' }, 400);
    if (mode === 'generate_embeddings') {
      if (!apiKey) return json({ error: 'Chave Gemini não configurada; embeddings continuam pendentes.' }, 503);
      return json({ totalEmbeddingsGerados: await processEmbeddings(bounded(body.batchSize, 300, 500)) });
    }
    const window = syncWindow(body);
    if (mode === 'daily_delta') {
      const { data, error } = await db.from('preco_referencia_sync_runs').select('data_final')
        .eq('tipo_sync','daily_delta').eq('escopo',scope).eq('status','completed').eq('cursor_data->>version','2')
        .order('data_final', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (data) window.start = new Date(Date.parse(data.data_final) - 2 * 86400000).toISOString().slice(0, 10);
    }
    const claim = await db.rpc('claim_preco_sync', { mode, scope, date_start: window.start, date_end: window.end,
      page_size: Math.max(10, bounded(body.tamanhoPagina, 100, 500)), resume_id: body.resumeRunId || null });
    if (claim.error) throw claim.error;
    run = claim.data as RawRow;
    const cursor = run.cursor_data as RawRow;
    let page = Number(cursor.page), totalPages = Number(cursor.totalPaginas ?? page);
    let completed = cursor.totalPaginas !== undefined && page > totalPages;
    let inserted = 0, updated = 0, skipped = 0;
    const maxPages = bounded(body.maxPages, mode === 'backfill_mensal' ? 10 : 5, 50);
    for (let count = 0; !completed && count < maxPages && Date.now() < deadline - 20000; count++) {
      const params = new URLSearchParams({ dataInclusaoPncpInicial: String(run.data_inicial), dataInclusaoPncpFinal: String(run.data_final),
        pagina: String(page), tamanhoPagina: String(cursor.pageSize), temResultado: 'true' });
      const response = await fetch(`https://dadosabertos.compras.gov.br/modulo-contratacoes/2_consultarItensContratacoes_PNCP_14133?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Compras.gov HTTP ${response.status}; página ${page} não avançou.`);
      const parsed = validatePage(await response.json(), page); totalPages = parsed.totalPages;
      const unique = new Map<string, RawRow>();
      for (const raw of parsed.items) {
        const mapped = mapReference(raw, scope);
        if (mapped) unique.set(String(mapped.source_id), mapped); else skipped++;
      }
      const commit = await db.rpc('ingest_preco_page', { run_id: run.id, token: run.lease_token, page,
        records: [...unique.values()], consulted: parsed.items.length, total_pages: totalPages });
      if (commit.error) throw commit.error;
      inserted += Number(commit.data.inserted); updated += Number(commit.data.updated);
      page++;
      if (page > totalPages) { completed = true; break; }
    }
    const status = completed ? 'completed' : 'partial_success';
    const finish = await db.from('preco_referencia_sync_runs').update({ status, lease_until: null,
      finished_at: new Date().toISOString(), details: { skippedLastBatch: skipped } }).eq('id',run.id).eq('lease_token',run.lease_token);
    if (finish.error) throw finish.error;
    let generated = 0; let embeddingWarning: string | undefined;
    if (body.generateEmbeddings !== false) {
      try { generated = await processEmbeddings(300); }
      catch { embeddingWarning = 'Embeddings pendentes; retome com generate_embeddings.'; }
      await db.from('preco_referencia_sync_runs').update({ total_embeddings_gerados: Number(run.total_embeddings_gerados || 0) + generated }).eq('id',run.id).eq('lease_token',run.lease_token);
    }
    return json({ success: true, status, syncRunId: run.id, nextPage: completed ? null : page, totalPages,
      periodo: { dataInicial: run.data_inicial, dataFinal: run.data_final }, totalItensNovos: inserted,
      totalItensAtualizados: updated, totalItensIngeridos: inserted + updated, totalDescartados: skipped,
      totalEmbeddingsGerados: generated, warning: embeddingWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : String((error as RawRow)?.message || 'Falha na sincronização.');
    if (run) await db.from('preco_referencia_sync_runs').update({ status: 'error', error_message: message,
      lease_until: null, finished_at: new Date().toISOString() }).eq('id',run.id).eq('lease_token',run.lease_token);
    return json({ error: message, syncRunId: run?.id, resumable: !!run }, 500);
  }
});
