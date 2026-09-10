import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { DOMParser as LinkedomDOMParser } from 'npm:linkedom@0.18.13';

import { parseSuapPlanHtml, type SuapPlanActivity } from '../../../src/services/suapPlanParser.ts';
import {
  buildSuapPlanSourceUrl,
  DEFAULT_SUAP_PLAN_UNIT,
  getSuapPlanUnit,
  getSuapPlanUnitForCampus,
  parseSuapPlanUnitFromSourceUrl,
  SUAP_PLAN_UNITS,
} from '../../../src/lib/suapPlanUnits.ts';

const SUAP_BASE_URL = 'https://suap.ifrn.edu.br';
const CONNECTION_TTL_MS = 8 * 60 * 60 * 1000;
const LOCK_TTL_MS = 30 * 60 * 1000;
const BATCH_RUN_LOCK_TTL_MS = 5 * 60 * 1000;
const HTML_LIMIT = 15 * 1024 * 1024;
const BATCH_CHUNK_SIZE = 4;
const BATCH_CONCURRENCY = 2;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SyncBody = {
  action?: 'connect' | 'connect-cookie' | 'sync' | 'sync-all' | 'sync-html' | 'apply' | 'apply-batch' | 'status' | 'disconnect';
  username?: string;
  password?: string;
  sessionId?: string;
  runId?: string;
  batchId?: string;
  suapUnitCode?: string;
  campusUasg?: string;
  mode?: 'preview' | 'apply';
  html?: string;
  sourceUrl?: string;
};

type AuthenticatedUser = { id: string; orgId: string };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`A variável ${name} precisa estar configurada.`);
  return value;
}

async function authenticate(request: Request): Promise<AuthenticatedUser> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Response(JSON.stringify({ error: 'Autorização ausente.' }), { status: 401 });

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) throw new Response(JSON.stringify({ error: 'Sessão do SIAGES inválida.' }), { status: 401 });

  const service = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await service
    .from('org_users')
    .select('org_id')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (membershipError || !membership?.org_id) {
    throw new Response(JSON.stringify({ error: 'Usuário não está associado a um órgão.' }), { status: 403 });
  }

  return { id: data.user.id, orgId: membership.org_id };
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUAP_SESSION_ENCRYPTION_KEY') ?? requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSession(sessionId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    new TextEncoder().encode(sessionId),
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return base64Encode(payload);
}

async function decryptSession(ciphertext: string): Promise<string> {
  const payload = base64Decode(ciphertext);
  const iv = payload.slice(0, 12);
  const encrypted = payload.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encrypted);
  return new TextDecoder().decode(decrypted);
}

async function loginSuap(username: string, password: string): Promise<string> {
  const loginUrl = `${SUAP_BASE_URL}/accounts/login/`;
  const getResponse = await fetch(loginUrl, {
    headers: { 'User-Agent': 'SIAGES SUAP Sync/1.0' },
  });
  const getHtml = await getResponse.text();
  const setCookie = getResponse.headers.get('Set-Cookie') ?? '';
  const csrf = setCookie.match(/csrftoken=([^;]+)/)?.[1]
    ?? getHtml.match(/name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/)?.[1];
  if (!csrf) throw new Error('Não foi possível obter o token CSRF do SUAP.');

  const initialSession = setCookie.match(/sessionid=([^;]+)/)?.[1];
  const cookies = [`csrftoken=${csrf}`, ...(initialSession ? [`sessionid=${initialSession}`] : [])].join('; ');
  const params = new URLSearchParams({
    username,
    password,
    csrfmiddlewaretoken: csrf,
    this_is_the_login_form: '1',
    next: '/',
    auth_code: '',
  });
  const response = await fetch(loginUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Cookie: cookies,
      Referer: loginUrl,
      Origin: SUAP_BASE_URL,
      'User-Agent': 'SIAGES SUAP Sync/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (response.status !== 301 && response.status !== 302) {
    throw new Error('Matrícula ou senha inválidas no SUAP.');
  }
  const sessionId = response.headers.get('Set-Cookie')?.match(/sessionid=([^;]+)/)?.[1] ?? initialSession;
  if (!sessionId) throw new Error('O SUAP não retornou uma sessão válida.');
  return sessionId;
}

async function validateSession(sessionId: string): Promise<void> {
  const response = await fetch(buildSuapPlanSourceUrl(DEFAULT_SUAP_PLAN_UNIT), {
    headers: { Cookie: `sessionid=${sessionId}`, Accept: 'text/html', 'User-Agent': 'SIAGES SUAP Sync/1.0' },
  });
  const html = await response.text();
  if (!response.ok || /<input[^>]+type=["']password["']/i.test(html) || /\/accounts\/login\//i.test(html)) {
    throw new Error('Sessão do SUAP expirada ou inválida.');
  }
}

function sha256Text(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toSnapshot(activity: SuapPlanActivity, orgId: string, runId: string, suapUnitCode: string, campusUasg: string) {
  return {
    run_id: runId,
    org_id: orgId,
    suap_plan_id: 8,
    suap_unit_code: suapUnitCode,
    campus_uasg: campusUasg,
    suap_activity_id: activity.suapActivityId,
    dimensao: activity.dimensao,
    atividade: activity.atividade,
    componente_funcional: activity.componenteFuncional,
    origem_recurso: activity.origemRecurso,
    origem_recurso_raw: activity.origemRecursoRaw,
    plano_interno: activity.planoInterno,
    valor_total: activity.valorTotal,
    saldo_disponivel: activity.saldoDisponivel ?? null,
    raw_data: activity.rawData,
  };
}

async function getServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getConnection(service: ReturnType<typeof createClient>, user: AuthenticatedUser) {
  const { data, error } = await service
    .from('suap_connections')
    .select('id,session_ciphertext,expires_at')
    .eq('user_id', user.id)
    .eq('org_id', user.orgId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createConnection(
  service: ReturnType<typeof createClient>,
  user: AuthenticatedUser,
  sessionId: string,
) {
  await validateSession(sessionId);
  const expiresAt = new Date(Date.now() + CONNECTION_TTL_MS).toISOString();
  await service
    .from('suap_connections')
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('org_id', user.orgId)
    .is('revoked_at', null);

  const { data, error } = await service
    .from('suap_connections')
    .insert({
      org_id: user.orgId,
      user_id: user.id,
      session_ciphertext: await encryptSession(sessionId),
      expires_at: expiresAt,
    })
    .select('id,expires_at')
    .single();
  if (error) throw error;
  return data;
}

function syncKey(dimensao: string, atividade: string): string {
  const fold = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return `${fold(dimensao)}|${fold(atividade)}`;
}

function sourceUrlForUnit(unitCode: string): string {
  return buildSuapPlanSourceUrl(unitCode);
}

function resolveUnitCode(value: string | null | undefined): string {
  const unit = getSuapPlanUnit(value);
  if (!unit) throw new Error(`Unidade SUAP inválida: ${value ?? ''}.`);
  return unit.value;
}

function resolveUnitForSync(body: SyncBody): string {
  if (body.suapUnitCode) return resolveUnitCode(body.suapUnitCode);
  if (body.campusUasg) return getSuapPlanUnitForCampus(body.campusUasg).value;
  return DEFAULT_SUAP_PLAN_UNIT;
}

function parseSourceUnit(sourceUrl: string): string {
  const unit = parseSuapPlanUnitFromSourceUrl(sourceUrl);
  if (!unit) throw new Error('A URL de origem precisa ser o Plano 8 do SUAP com uma unidade_gestora válida.');
  return unit;
}

async function previewDiff(
  service: ReturnType<typeof createClient>,
  user: AuthenticatedUser,
  activities: SuapPlanActivity[],
  suapUnitCode: string,
) {
  const ids = activities.map((activity) => activity.suapActivityId);
  const incoming = new Set(ids);
  const incomingKeys = new Set(activities.map((activity) => syncKey(activity.dimensao, activity.atividade)));
  const { data, error } = await service
    .from('atividades')
    .select('suap_activity_id,suap_unit_code,sync_active,sync_source,dimensao,atividade')
    .eq('org_id', user.orgId)
    .eq('tipo_atividade', 'campus')
    .eq('campus_uasg', getSuapPlanUnit(suapUnitCode)?.parentUasg ?? '158366');
  if (error) throw error;

  const rows = data ?? [];
  const canonical = rows.filter((row) => row.sync_source === 'suap_plan_8'
    && row.suap_activity_id && String(row.suap_unit_code ?? DEFAULT_SUAP_PLAN_UNIT) === suapUnitCode);
  const current = new Set(canonical.map((row) => String(row.suap_activity_id)));
  const legacyArchived = rows.filter((row) =>
    row.sync_active && !row.suap_activity_id && row.sync_source !== 'suap_plan_8' &&
    incomingKeys.has(syncKey(String(row.dimensao ?? ''), String(row.atividade ?? '')))
      && String(row.suap_unit_code ?? DEFAULT_SUAP_PLAN_UNIT) === suapUnitCode,
  ).length;

  return {
    inserted: ids.filter((id) => !current.has(id)).length,
    updated: ids.filter((id) => current.has(id)).length,
    archived: Array.from(current).filter((id) => !incoming.has(id)).length + legacyArchived,
  };
}

async function writeSnapshots(service: ReturnType<typeof createClient>, rows: ReturnType<typeof toSnapshot>[]) {
  for (let index = 0; index < rows.length; index += 250) {
    const { error } = await service.from('suap_plan_activity_snapshots').insert(rows.slice(index, index + 250));
    if (error) throw error;
  }
}

type PlanRunResult = {
  status: 'preview' | 'success';
  runId: string;
  suapUnitCode: string;
  sourceCount: number;
  inserted: number;
  updated: number;
  archived: number;
};

class SuapReauthRequiredError extends Error {
  constructor() {
    super('Sessão do SUAP expirada.');
    this.name = 'SuapReauthRequiredError';
  }
}

async function fetchPlanHtml(sessionId: string, suapUnitCode: string): Promise<{ html: string; sourceUrl: string }> {
  const sourceUrl = sourceUrlForUnit(suapUnitCode);
  const response = await fetch(sourceUrl, {
    headers: { Cookie: `sessionid=${sessionId}`, Accept: 'text/html', 'User-Agent': 'SIAGES SUAP Sync/1.0' },
  });
  const html = await response.text();
  if (!response.ok || /<input[^>]+type=["']password["']/i.test(html) || /\/accounts\/login\//i.test(html)) {
    throw new SuapReauthRequiredError();
  }
  if (!html || html.length > HTML_LIMIT) throw new Error('HTML do Plano 8 ausente ou maior que o limite permitido.');
  return { html, sourceUrl };
}

async function hasAppliedRun(
  service: ReturnType<typeof createClient>,
  user: AuthenticatedUser,
  suapUnitCode: string,
): Promise<boolean> {
  const { data, error } = await service
    .from('suap_plan_sync_runs')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', user.orgId)
    .eq('plan_id', 8)
    .eq('scope', 'campus')
    .eq('suap_unit_code', suapUnitCode)
    .eq('status', 'success')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function syncOneUnit(params: {
  service: ReturnType<typeof createClient>;
  user: AuthenticatedUser;
  sessionId?: string;
  html?: string;
  sourceUrl?: string;
  suapUnitCode: string;
  mode?: 'preview' | 'apply';
  batchId?: string;
}): Promise<PlanRunResult> {
  const { service, user, suapUnitCode, mode, batchId } = params;
  const unit = getSuapPlanUnit(suapUnitCode);
  if (!unit) throw new Error(`Unidade SUAP inválida: ${suapUnitCode}.`);
  let html = params.html ?? '';
  let sourceUrl = params.sourceUrl ?? sourceUrlForUnit(suapUnitCode);
  if (!html) {
    if (!params.sessionId) throw new Error('Sessão do SUAP não informada.');
    const fetched = await fetchPlanHtml(params.sessionId, suapUnitCode);
    html = fetched.html;
    sourceUrl = fetched.sourceUrl;
  }

  const parsed = parseSuapPlanHtml(html, LinkedomDOMParser);
  const checksum = hex(await sha256Text(JSON.stringify(parsed.activities)));
  const isPreview = mode === 'preview' || !(await hasAppliedRun(service, user, suapUnitCode));
  const { data: run, error: runError } = await service
    .from('suap_plan_sync_runs')
    .insert({
      org_id: user.orgId,
      user_id: user.id,
      plan_id: 8,
      scope: 'campus',
      suap_unit_code: suapUnitCode,
      campus_uasg: unit.parentUasg,
      batch_id: batchId ?? null,
      mode: isPreview ? 'preview' : 'apply',
      status: 'running',
      source_url: sourceUrl,
      source_count: parsed.activities.length,
      checksum,
      metadata: { dimensions: parsed.dimensions, suap_unit_code: suapUnitCode },
    })
    .select('id')
    .single();
  if (runError || !run) throw runError ?? new Error('Não foi possível criar a execução.');

  try {
    await writeSnapshots(service, parsed.activities.map((activity) => toSnapshot(activity, user.orgId, run.id, suapUnitCode, unit.parentUasg)));
    const diff = await previewDiff(service, user, parsed.activities, suapUnitCode);
    if (isPreview) {
      await service.from('suap_plan_sync_runs').update({
        status: 'preview', mode: 'preview', finished_at: new Date().toISOString(),
        inserted_count: diff.inserted, updated_count: diff.updated, archived_count: diff.archived,
      }).eq('id', run.id);
      return { status: 'preview', runId: run.id, suapUnitCode, sourceCount: parsed.activities.length, ...diff };
    }

    const { data: applied, error: applyError } = await service.rpc('apply_suap_plan_snapshot', { p_run_id: run.id });
    if (applyError) throw applyError;
    return {
      status: 'success',
      runId: run.id,
      suapUnitCode,
      sourceCount: parsed.activities.length,
      inserted: Number(applied?.inserted ?? diff.inserted),
      updated: Number(applied?.updated ?? diff.updated),
      archived: Number(applied?.archived ?? diff.archived),
    };
  } catch (error) {
    await service.from('suap_plan_sync_runs').update({
      status: 'failed', finished_at: new Date().toISOString(), error_code: 'SYNC_FAILED',
      error_message: error instanceof Error ? error.message : String(error),
    }).eq('id', run.id);
    throw error;
  }
}

async function runWithConcurrency<T>(items: string[], concurrency: number, worker: (item: string) => Promise<T>) {
  const results: Array<T | undefined> = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results as T[];
}

async function updateBatchStatus(service: ReturnType<typeof createClient>, batchId: string) {
  const { data: batch, error: batchError } = await service
    .from('suap_plan_sync_batches')
    .select('requested_count')
    .eq('id', batchId)
    .maybeSingle();
  if (batchError) throw batchError;

  const { data: runs, error } = await service
    .from('suap_plan_sync_runs')
    .select('suap_unit_code,status,started_at')
    .eq('batch_id', batchId);
  if (error) throw error;

  const latestRuns = new Map<string, string>();
  for (const run of [...(runs ?? [])].sort((left, right) =>
    new Date(String(right.started_at)).getTime() - new Date(String(left.started_at)).getTime())) {
    const unitCode = String(run.suap_unit_code ?? '');
    if (unitCode && !latestRuns.has(unitCode)) latestRuns.set(unitCode, run.status);
  }
  const statuses = [...latestRuns.values()];
  const failed = statuses.filter((status) => status === 'failed').length;
  const previews = statuses.filter((status) => status === 'preview').length;
  const successful = statuses.filter((status) => status === 'success').length;
  const requestedCount = Number(batch?.requested_count ?? SUAP_PLAN_UNITS.length);
  const completedCount = statuses.length;
  const status = completedCount < requestedCount
    ? 'running'
    : failed === completedCount
      ? 'failed'
      : failed > 0
        ? 'partial'
        : previews > 0
          ? 'preview'
          : successful === completedCount
            ? 'success'
            : 'running';
  await service.from('suap_plan_sync_batches').update({
    status,
    success_count: successful,
    failed_count: failed,
    preview_count: previews,
    finished_at: status === 'running' ? null : new Date().toISOString(),
  }).eq('id', batchId);
  return {
    status,
    requestedCount,
    completedCount,
    remainingCount: Math.max(requestedCount - completedCount, 0),
    successCount: successful,
    failedCount: failed,
    previewCount: previews,
  };
}

async function failStaleBatchRuns(service: ReturnType<typeof createClient>, batchId: string) {
  const cutoff = new Date(Date.now() - BATCH_RUN_LOCK_TTL_MS).toISOString();
  const { data: staleRuns, error: staleRunsError } = await service
    .from('suap_plan_sync_runs')
    .select('id')
    .eq('batch_id', batchId)
    .eq('status', 'running')
    .lt('started_at', cutoff);
  if (staleRunsError) throw staleRunsError;
  const staleIds = (staleRuns ?? []).map((run) => run.id).filter(Boolean);
  if (!staleIds.length) return;

  const { error } = await service
    .from('suap_plan_sync_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_code: 'BATCH_TIMEOUT_RECOVERED',
      error_message: 'Execução recuperada após o timeout da chamada anterior.',
    })
    .in('id', staleIds);
  if (error) throw error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não suportado.' }, 405);

  try {
    const user = await authenticate(request);
    const service = await getServiceClient();
    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const action = body.action ?? 'sync';

    if (action === 'connect' || action === 'connect-cookie') {
      const sessionId = action === 'connect'
        ? await loginSuap(String(body.username ?? '').trim(), String(body.password ?? ''))
        : String(body.sessionId ?? '').trim();
      if (!sessionId) return jsonResponse({ error: 'Sessão SUAP não informada.' }, 400);
      const connection = await createConnection(service, user, sessionId);
      return jsonResponse({ status: 'connected', connectionId: connection.id, expiresAt: connection.expires_at });
    }

    if (action === 'disconnect') {
      const { error } = await service
        .from('suap_connections')
        .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .is('revoked_at', null);
      if (error) throw error;
      return jsonResponse({ status: 'disconnected' });
    }

    if (action === 'status') {
      const { data, error } = await service
        .from('suap_plan_sync_runs')
        .select('id,status,mode,suap_unit_code,batch_id,source_count,inserted_count,updated_count,archived_count,started_at,finished_at,error_code,error_message')
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .eq('plan_id', 8)
        .eq('scope', 'campus')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const { data: batch } = await service
        .from('suap_plan_sync_batches')
        .select('id,status,requested_count,success_count,failed_count,preview_count,started_at,finished_at')
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .eq('plan_id', 8)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return jsonResponse({ run: data ?? null, batch: batch ?? null });
    }

    if (action === 'apply') {
      if (!body.runId) return jsonResponse({ error: 'runId é obrigatório.' }, 400);
      const { data: run, error: runError } = await service
        .from('suap_plan_sync_runs')
        .select('id,status,user_id,org_id,plan_id,scope')
        .eq('id', body.runId)
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .maybeSingle();
      if (runError) throw runError;
      if (!run || run.status !== 'preview') return jsonResponse({ error: 'Prévia de sincronização não encontrada.' }, 404);
      const { data, error } = await service.rpc('apply_suap_plan_snapshot', { p_run_id: body.runId });
      if (error) throw error;
      return jsonResponse({ status: 'success', runId: body.runId, ...(data ?? {}) });
    }

    if (action === 'apply-batch') {
      if (!body.batchId) return jsonResponse({ error: 'batchId é obrigatório.' }, 400);
      const { data: runs, error: runsError } = await service
        .from('suap_plan_sync_runs')
        .select('id,status')
        .eq('batch_id', body.batchId)
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .eq('status', 'preview');
      if (runsError) throw runsError;
      const applied: Record<string, unknown>[] = [];
      const failures: Array<{ runId: string; error: string }> = [];
      for (const run of runs ?? []) {
        try {
          const { data, error } = await service.rpc('apply_suap_plan_snapshot', { p_run_id: run.id });
          if (error) throw error;
          applied.push({ runId: run.id, ...(data ?? {}) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push({ runId: run.id, error: message });
          await service.from('suap_plan_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_code: 'APPLY_FAILED', error_message: message }).eq('id', run.id);
        }
      }
      const batch = await updateBatchStatus(service, body.batchId);
      return jsonResponse({ status: failures.length ? 'partial' : 'success', batchId: body.batchId, applied, failures, ...batch });
    }

    const htmlSync = action === 'sync-html';
    const batchSync = action === 'sync-all';
    if (action !== 'sync' && !htmlSync && !batchSync) return jsonResponse({ error: 'Acao desconhecida.' }, 400);

    let connection: Awaited<ReturnType<typeof getConnection>> = null;
    let html = '';
    let suapUnitCode: string;
    try {
      suapUnitCode = resolveUnitForSync(body);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Unidade SUAP inválida.' }, 400);
    }
    if (htmlSync) {
      const sourceUrl = String(body.sourceUrl ?? sourceUrlForUnit(DEFAULT_SUAP_PLAN_UNIT));
      try {
        suapUnitCode = parseSourceUnit(sourceUrl);
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : 'URL de origem inválida.' }, 400);
      }
      if (body.suapUnitCode && resolveUnitCode(body.suapUnitCode) !== suapUnitCode) return jsonResponse({ error: 'A unidade informada não corresponde à URL capturada.' }, 400);
      html = String(body.html ?? '');
      if (!html || html.length > HTML_LIMIT) return jsonResponse({ error: 'HTML do Plano 8 ausente ou maior que o limite permitido.' }, 413);
    } else {
      connection = await getConnection(service, user);
      if (!connection) return jsonResponse({ status: 'reauth_required', error: 'Conecte-se ao SUAP para sincronizar.' }, 401);
    }
    if (batchSync) {
      let recoverBatchId = body.batchId;
      if (!recoverBatchId) {
        const { data: latestRunningBatch, error: latestRunningBatchError } = await service
          .from('suap_plan_sync_batches')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', user.orgId)
          .eq('plan_id', 8)
          .eq('scope', 'campus')
          .eq('status', 'running')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestRunningBatchError) throw latestRunningBatchError;
        recoverBatchId = latestRunningBatch?.id;
      }
      if (recoverBatchId) await failStaleBatchRuns(service, recoverBatchId);
    }

    const { data: running } = await service
      .from('suap_plan_sync_runs')
      .select('id,started_at,batch_id')
      .eq('user_id', user.id)
      .eq('org_id', user.orgId)
      .eq('plan_id', 8)
      .eq('scope', 'campus')
      .eq('status', 'running')
      .gt('started_at', new Date(Date.now() - LOCK_TTL_MS).toISOString())
      .limit(1)
      .maybeSingle();
    if (running) {
      if (batchSync && running.batch_id) {
        const batchStatus = await updateBatchStatus(service, running.batch_id);
        return jsonResponse({ status: 'running', batchId: running.batch_id, units: [], ...batchStatus });
      }
      return jsonResponse({ status: 'already_running', runId: running.id }, 409);
    }
    const sessionId = connection ? await decryptSession(connection.session_ciphertext) : undefined;
    if (batchSync) {
      let batch: { id: string } | null = null;
      if (body.batchId) {
        const { data: existingBatch, error: existingBatchError } = await service
          .from('suap_plan_sync_batches')
          .select('id,status')
          .eq('id', body.batchId)
          .eq('user_id', user.id)
          .eq('org_id', user.orgId)
          .maybeSingle();
        if (existingBatchError) throw existingBatchError;
        if (!existingBatch) return jsonResponse({ error: 'Lote de sincronização não encontrado.' }, 404);
        if (existingBatch.status !== 'running') {
          const batchStatus = await updateBatchStatus(service, existingBatch.id);
          return jsonResponse({ status: batchStatus.status, batchId: existingBatch.id, units: [], ...batchStatus });
        }
        batch = { id: existingBatch.id };
      } else {
        const { data: runningBatch, error: runningBatchError } = await service
          .from('suap_plan_sync_batches')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', user.orgId)
          .eq('plan_id', 8)
          .eq('scope', 'campus')
          .eq('status', 'running')
          .gt('started_at', new Date(Date.now() - LOCK_TTL_MS).toISOString())
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (runningBatchError) throw runningBatchError;
        if (runningBatch) {
          const batchStatus = await updateBatchStatus(service, runningBatch.id);
          return jsonResponse({ status: batchStatus.status, batchId: runningBatch.id, units: [], ...batchStatus });
        }

        const { data: createdBatch, error: batchError } = await service.from('suap_plan_sync_batches').insert({
          org_id: user.orgId,
          user_id: user.id,
          plan_id: 8,
          scope: 'campus',
          mode: body.mode ?? 'apply',
          status: 'running',
          requested_count: SUAP_PLAN_UNITS.length,
        }).select('id').single();
        if (batchError || !createdBatch) throw batchError ?? new Error('Não foi possível criar o lote.');
        batch = { id: createdBatch.id };
      }

      const { data: existingRuns, error: existingRunsError } = await service
        .from('suap_plan_sync_runs')
        .select('suap_unit_code,status,started_at')
        .eq('batch_id', batch.id);
      if (existingRunsError) throw existingRunsError;
      const latestRuns = new Map<string, string>();
      for (const run of [...(existingRuns ?? [])].sort((left, right) =>
        new Date(String(right.started_at)).getTime() - new Date(String(left.started_at)).getTime())) {
        const unitCode = String(run.suap_unit_code ?? '');
        if (unitCode && !latestRuns.has(unitCode)) latestRuns.set(unitCode, run.status);
      }
      const completedUnits = new Set([...latestRuns.entries()]
        .filter(([, status]) => status === 'preview' || status === 'success')
        .map(([unitCode]) => unitCode));
      const pendingUnits = SUAP_PLAN_UNITS
        .map((unit) => unit.value)
        .filter((unitCode) => !completedUnits.has(unitCode))
        .slice(0, BATCH_CHUNK_SIZE);

      if (!pendingUnits.length) {
        const batchStatus = await updateBatchStatus(service, batch.id);
        return jsonResponse({ status: batchStatus.status, batchId: batch.id, units: [], ...batchStatus });
      }

      const results: Array<PlanRunResult | { suapUnitCode: string; status: 'failed'; error: string }> = [];
      await runWithConcurrency(pendingUnits, BATCH_CONCURRENCY, async (unitCode) => {
        try {
          results.push(await syncOneUnit({ service, user, sessionId, suapUnitCode: unitCode, mode: body.mode, batchId: batch.id }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await service.from('suap_plan_sync_runs').insert({
            org_id: user.orgId,
            user_id: user.id,
            plan_id: 8,
            scope: 'campus',
            suap_unit_code: unitCode,
            campus_uasg: getSuapPlanUnit(unitCode)?.parentUasg ?? '158366',
            batch_id: batch.id,
            mode: body.mode ?? 'apply',
            status: 'failed',
            source_url: sourceUrlForUnit(unitCode),
            error_code: error instanceof SuapReauthRequiredError ? 'REAUTH_REQUIRED' : 'SYNC_FAILED',
            error_message: message,
            finished_at: new Date().toISOString(),
          });
          results.push({ suapUnitCode: unitCode, status: 'failed', error: message });
        }
      });
      if (results.some((result) => result.status === 'failed' && result.error === 'Sessão do SUAP expirada.')) {
        await service.from('suap_connections').update({ revoked_at: new Date().toISOString() }).eq('id', connection!.id);
      }
      const batchStatus = await updateBatchStatus(service, batch.id);
      return jsonResponse({ status: batchStatus.status, batchId: batch.id, units: results, ...batchStatus });
    }

    try {
      const result = await syncOneUnit({ service, user, sessionId, html, sourceUrl: htmlSync ? String(body.sourceUrl ?? sourceUrlForUnit(suapUnitCode)) : undefined, suapUnitCode, mode: body.mode });
      if (connection) await service.from('suap_connections').update({ last_validated_at: new Date().toISOString() }).eq('id', connection.id);
      return jsonResponse({ ...result, runId: result.runId, sourceCount: result.sourceCount });
    } catch (error) {
      if (error instanceof SuapReauthRequiredError) {
        if (connection) await service.from('suap_connections').update({ revoked_at: new Date().toISOString() }).eq('id', connection.id);
        return jsonResponse({ status: 'reauth_required', error: error.message }, 401);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return new Response(error.body, { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    console.error('sync-suap-plan', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Falha inesperada na sincronização.' }, 500);
  }
});
