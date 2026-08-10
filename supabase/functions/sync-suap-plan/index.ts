import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { parseSuapPlanHtml, type SuapPlanActivity } from '../../../src/services/suapPlanParser.ts';

const SUAP_BASE_URL = 'https://suap.ifrn.edu.br';
const PLAN_PATH = '/plan_estrategico/plano_concluido/8/';
const SOURCE_URL = `${SUAP_BASE_URL}${PLAN_PATH}`;
const CONNECTION_TTL_MS = 8 * 60 * 60 * 1000;
const LOCK_TTL_MS = 10 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SyncBody = {
  action?: 'connect' | 'connect-cookie' | 'sync' | 'apply' | 'status' | 'disconnect';
  username?: string;
  password?: string;
  sessionId?: string;
  runId?: string;
  mode?: 'preview' | 'apply';
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
  const response = await fetch(SOURCE_URL, {
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

function toSnapshot(activity: SuapPlanActivity, orgId: string, runId: string) {
  return {
    run_id: runId,
    org_id: orgId,
    suap_plan_id: 8,
    suap_activity_id: activity.suapActivityId,
    dimensao: activity.dimensao,
    atividade: activity.atividade,
    componente_funcional: activity.componenteFuncional,
    origem_recurso: activity.origemRecurso,
    origem_recurso_raw: activity.origemRecursoRaw,
    plano_interno: activity.planoInterno,
    valor_total: activity.valorTotal,
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

async function previewDiff(service: ReturnType<typeof createClient>, user: AuthenticatedUser, activities: SuapPlanActivity[]) {
  const ids = activities.map((activity) => activity.suapActivityId);
  const incoming = new Set(ids);
  const incomingKeys = new Set(activities.map((activity) => syncKey(activity.dimensao, activity.atividade)));
  const { data, error } = await service
    .from('atividades')
    .select('suap_activity_id,sync_active,sync_source,dimensao,atividade')
    .eq('org_id', user.orgId)
    .eq('tipo_atividade', 'campus');
  if (error) throw error;

  const rows = data ?? [];
  const canonical = rows.filter((row) => row.sync_source === 'suap_plan_8' && row.suap_activity_id);
  const current = new Set(canonical.map((row) => String(row.suap_activity_id)));
  const legacyArchived = rows.filter((row) =>
    row.sync_active && !row.suap_activity_id && row.sync_source !== 'suap_plan_8' &&
    incomingKeys.has(syncKey(String(row.dimensao ?? ''), String(row.atividade ?? ''))),
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
        .select('id,status,mode,source_count,inserted_count,updated_count,archived_count,started_at,finished_at,error_code,error_message')
        .eq('user_id', user.id)
        .eq('org_id', user.orgId)
        .eq('plan_id', 8)
        .eq('scope', 'campus')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ run: data ?? null });
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

    if (action !== 'sync') return jsonResponse({ error: 'Ação desconhecida.' }, 400);

    const connection = await getConnection(service, user);
    if (!connection) return jsonResponse({ status: 'reauth_required', error: 'Conecte-se ao SUAP para sincronizar.' }, 401);

    const { data: running } = await service
      .from('suap_plan_sync_runs')
      .select('id,started_at')
      .eq('user_id', user.id)
      .eq('org_id', user.orgId)
      .eq('plan_id', 8)
      .eq('scope', 'campus')
      .eq('status', 'running')
      .gt('started_at', new Date(Date.now() - LOCK_TTL_MS).toISOString())
      .limit(1)
      .maybeSingle();
    if (running) return jsonResponse({ status: 'already_running', runId: running.id }, 409);

    const sessionId = await decryptSession(connection.session_ciphertext);
    const response = await fetch(SOURCE_URL, {
      headers: { Cookie: `sessionid=${sessionId}`, Accept: 'text/html', 'User-Agent': 'SIAGES SUAP Sync/1.0' },
    });
    const html = await response.text();
    if (!response.ok || /<input[^>]+type=["']password["']/i.test(html) || /\/accounts\/login\//i.test(html)) {
      await service.from('suap_connections').update({ revoked_at: new Date().toISOString() }).eq('id', connection.id);
      return jsonResponse({ status: 'reauth_required', error: 'Sessão do SUAP expirada.' }, 401);
    }

    const parsed = parseSuapPlanHtml(html);
    const checksum = hex(await sha256Text(JSON.stringify(parsed.activities)));
    const hasAppliedRun = Boolean((await service
      .from('suap_plan_sync_runs')
      .select('id')
      .eq('user_id', user.id)
      .eq('org_id', user.orgId)
      .eq('plan_id', 8)
      .eq('scope', 'campus')
      .eq('status', 'success')
      .limit(1)
      .maybeSingle()).data);
    const isPreview = body.mode === 'preview' || !hasAppliedRun;

    const { data: run, error: runError } = await service
      .from('suap_plan_sync_runs')
      .insert({
        org_id: user.orgId,
        user_id: user.id,
        plan_id: 8,
        scope: 'campus',
        mode: isPreview ? 'preview' : 'apply',
        status: 'running',
        source_url: SOURCE_URL,
        source_count: parsed.activities.length,
        checksum,
        metadata: { dimensions: parsed.dimensions },
      })
      .select('id')
      .single();
    if (runError || !run) throw runError ?? new Error('Não foi possível criar a execução.');

    try {
      await writeSnapshots(service, parsed.activities.map((activity) => toSnapshot(activity, user.orgId, run.id)));
      const diff = await previewDiff(service, user, parsed.activities);
      if (isPreview) {
        await service.from('suap_plan_sync_runs').update({
          status: 'preview', mode: 'preview', finished_at: new Date().toISOString(),
          inserted_count: diff.inserted, updated_count: diff.updated, archived_count: diff.archived,
        }).eq('id', run.id);
        return jsonResponse({ status: 'preview', runId: run.id, sourceCount: parsed.activities.length, ...diff });
      }

      const { data: applied, error: applyError } = await service.rpc('apply_suap_plan_snapshot', { p_run_id: run.id });
      if (applyError) throw applyError;
      await service.from('suap_connections').update({ last_validated_at: new Date().toISOString() }).eq('id', connection.id);
      return jsonResponse({ status: 'success', runId: run.id, sourceCount: parsed.activities.length, ...(applied ?? {}) });
    } catch (error) {
      await service.from('suap_plan_sync_runs').update({
        status: 'failed', finished_at: new Date().toISOString(), error_code: 'SYNC_FAILED',
        error_message: error instanceof Error ? error.message : String(error),
      }).eq('id', run.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return new Response(error.body, { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    console.error('sync-suap-plan', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Falha inesperada na sincronização.' }, 500);
  }
});
