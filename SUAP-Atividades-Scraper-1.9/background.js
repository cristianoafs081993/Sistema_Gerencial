if (typeof importScripts === 'function') importScripts('scheduled-process-sync.js');

const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const AUTH_MESSAGE_SOURCE = 'siages-extension-auth';
const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session';
const SESSION_REFRESH_ALARM = 'siages-extension-session-refresh';
const REFRESH_AHEAD_SECONDS = 20 * 60;
const PROCESS_BOX_SYNC_SOURCE = 'siages-extension-process-box-sync';
const PROCESS_BOX_SYNC_ALARM = 'siages-extension-process-box-sync';
const PROCESS_BOX_SYNC_STORAGE_KEY = 'siages-process-box-sync-state';
const PROCESS_BOX_SYNC = globalThis.SuapeScheduledProcessSync;

let refreshInFlight = null;
let sessionGeneration = 0;

function buildSession(payload) {
  if (!payload?.access_token || !payload?.refresh_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
  };
}

function toPublicSession(session) {
  if (!session?.accessToken) return null;
  return { accessToken: session.accessToken, expiresAt: session.expiresAt };
}

async function readStoredSession() {
  const stored = await chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY);
  const session = stored[EXTENSION_SESSION_STORAGE_KEY];
  return session?.accessToken && session?.refreshToken ? session : null;
}

function getAuthErrorMessage(response, payload, grantType) {
  const code = String(payload?.error || payload?.code || '').toLowerCase();
  if (grantType === 'password' && (response.status === 400 || response.status === 401 || code === 'invalid_grant' || code === 'invalid_credentials')) {
    return 'E-mail ou senha do SIAGES inválidos. Confirme o acesso no SIAGES ou redefina a senha.';
  }
  return `Não foi possível autenticar no SIAGES (HTTP ${response.status}).`;
}

function isTerminalRefreshFailure(response, payload) {
  const code = String(payload?.error || payload?.code || '').toLowerCase();
  return response.status === 401 ||
    code === 'refresh_token_not_found' ||
    code === 'refresh_token_already_used' ||
    code === 'session_expired' ||
    code === 'invalid_grant';
}

function getRefreshErrorMessage(response, payload) {
  if (isTerminalRefreshFailure(response, payload)) {
    return 'A sessão da extensão foi encerrada pelo SIAGES. Entre novamente para continuar.';
  }
  return 'Não foi possível renovar a sessão agora. Ela continua salva e a extensão tentará novamente.';
}

async function signIn(email, password) {
  sessionGeneration += 1;
  const generation = sessionGeneration;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getAuthErrorMessage(response, payload, 'password'));

  const session = buildSession(payload);
  if (!session) throw new Error('O SIAGES não devolveu uma sessão válida.');
  if (generation !== sessionGeneration) return readStoredSession();
  await chrome.storage.local.set({ [EXTENSION_SESSION_STORAGE_KEY]: session });
  if (generation !== sessionGeneration) {
    const latestSession = await readStoredSession();
    if (latestSession?.refreshToken === session.refreshToken) await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    return latestSession;
  }
  return session;
}

async function refreshSessionIfNeeded() {
  const run = async () => {
    const session = await readStoredSession();
    if (!session) return null;
    if (Number(session.expiresAt || 0) > (Date.now() / 1000) + REFRESH_AHEAD_SECONDS) return session;
    const generation = sessionGeneration;

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (isTerminalRefreshFailure(response, payload)) {
          const latestSession = await readStoredSession();
          if (latestSession?.refreshToken === session.refreshToken) {
            sessionGeneration += 1;
            await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
          }
        }
        throw new Error(getRefreshErrorMessage(response, payload));
      }

      const nextSession = buildSession(payload);
      if (!nextSession) throw new Error('O SIAGES não devolveu uma sessão renovada válida.');
      if (generation !== sessionGeneration) return readStoredSession();

      // A saída ou um novo login podem ter acontecido enquanto a renovação estava em trânsito.
      // Nesse caso, nunca recrie uma sessão que o usuário já substituiu ou encerrou.
      const latestSession = await readStoredSession();
      if (!latestSession || latestSession.refreshToken !== session.refreshToken) return latestSession;
      await chrome.storage.local.set({ [EXTENSION_SESSION_STORAGE_KEY]: nextSession });
      if (generation !== sessionGeneration) {
        const currentSession = await readStoredSession();
        if (currentSession?.refreshToken === nextSession.refreshToken) await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
        return currentSession;
      }
      return nextSession;
    } catch (error) {
      // Falhas de rede ou uma resposta recusada não equivalem a um pedido de logout.
      // Mantemos a sessão para que uma nova tentativa possa renová-la sem novo login.
      const latestSession = await readStoredSession();
      if (latestSession && Number(latestSession.expiresAt || 0) > Date.now() / 1000) return latestSession;
      throw error;
    }
  };

  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = run().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function handleAuthMessage(message) {
  if (message.type === 'get-session') {
    await ensureSessionRefreshAlarm();
    return { session: toPublicSession(await refreshSessionIfNeeded()) };
  }
  if (message.type === 'sign-in') {
    const email = String(message.email || '').trim();
    const password = String(message.password || '');
    if (!email || !password) throw new Error('Informe o e-mail e a senha cadastrados no SIAGES.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Use o e-mail cadastrado no SIAGES. A matrícula do SUAP não autentica neste campo.');
    return { session: toPublicSession(await signIn(email, password)) };
  }
  if (message.type === 'sign-out') {
    sessionGeneration += 1;
    await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    return { session: null };
  }
  throw new Error('Operação de autenticação desconhecida.');
}

const PROCESS_REGISTRY_SOURCE = 'suape-process-registry';
const STORAGE_ACTIVE_PROCESSES = 'suape_active_processes';
const STORAGE_RECENT_PROCESSES = 'suape_recent_processes';

async function handleProcessRegistryMessage(message, sender) {
  if (message.type === 'register-process' || message.type === 'process-updated') {
    const tabId = sender?.tab?.id || message.payload?.tabId || ('tab_' + (message.payload?.suapId || Date.now()));
    const suapId = message.payload?.suapId;
    const processNumber = message.payload?.processNumber;
    if (!suapId && !processNumber) return { ok: false, error: 'Identificadores do processo ausentes.' };

    const stored = await chrome.storage.local.get([STORAGE_ACTIVE_PROCESSES, STORAGE_RECENT_PROCESSES]);
    const activeMap = stored?.[STORAGE_ACTIVE_PROCESSES] || {};
    let recentList = stored?.[STORAGE_RECENT_PROCESSES] || [];

    const now = Date.now();
    const processRecord = {
      tabId,
      suapId,
      processNumber,
      process: message.payload?.process || null,
      fields: message.payload?.fields || [],
      url: message.payload?.url || sender?.tab?.url || '',
      title: message.payload?.title || sender?.tab?.title || '',
      updatedAt: now,
      activeAt: now,
    };

    activeMap[tabId] = processRecord;

    // Atualiza recentList deduplicando por suapId
    recentList = recentList.filter((item) => item.suapId !== suapId);
    recentList.unshift(processRecord);
    if (recentList.length > 8) recentList = recentList.slice(0, 8);

    await chrome.storage.local.set({
      [STORAGE_ACTIVE_PROCESSES]: activeMap,
      [STORAGE_RECENT_PROCESSES]: recentList,
    });

    return { ok: true, registered: true };
  }

  if (message.type === 'get-active-processes') {
    const stored = await chrome.storage.local.get(null).catch(() => ({}));
    const activeMap = stored?.[STORAGE_ACTIVE_PROCESSES] || {};
    let recentList = stored?.[STORAGE_RECENT_PROCESSES] || [];

    // 1. Descobre ativamente abas abertas no SUAP via chrome.tabs.query
    if (chrome?.tabs?.query) {
      try {
        const allTabs = await new Promise((res) => {
          chrome.tabs.query({}, (tabs) => {
            if (chrome.runtime?.lastError || !Array.isArray(tabs)) return res([]);
            res(tabs);
          });
        });

        if (Array.isArray(allTabs) && allTabs.length > 0) {
          const openTabIds = new Set(allTabs.map((t) => t.id));

          // Limpa abas que foram fechadas
          for (const key of Object.keys(activeMap)) {
            if (typeof activeMap[key]?.tabId === 'number' && !openTabIds.has(activeMap[key].tabId)) {
              delete activeMap[key];
            }
          }

          // Percorre todas as abas abertas do SUAP procurando processos
          allTabs.forEach((tab) => {
            const url = tab.url || '';
            const title = tab.title || '';
            const isSuapProcess = /suap\.ifrn\.edu\.br\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)/i.test(url);

            if (isSuapProcess) {
              const suapIdMatch = url.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)/i);
              const suapId = suapIdMatch ? suapIdMatch[1] : '';
              const procMatch = `${title} ${url}`.match(/\b\d{5}\.\d{6}(?:[./])\d{4}-\d{2}\b/);
              const processNumber = procMatch ? procMatch[0] : (suapId ? `Processo #${suapId}` : '');

              if (suapId || processNumber) {
                const existing = activeMap[tab.id];
                activeMap[tab.id] = {
                  tabId: tab.id,
                  suapId: existing?.suapId || suapId,
                  processNumber: existing?.processNumber || processNumber,
                  process: existing?.process || null,
                  fields: existing?.fields || [],
                  url,
                  title,
                  updatedAt: existing?.updatedAt || Date.now(),
                  activeAt: tab.active ? Date.now() + 5000 : (existing?.activeAt || Date.now()),
                };

                // Tenta buscar dados em tempo real da aba do SUAP
                try {
                  chrome.tabs.sendMessage(tab.id, { source: 'suape-process-registry', type: 'get-process-data' }, (res) => {
                    if (res?.processData) {
                      activeMap[tab.id] = {
                        ...activeMap[tab.id],
                        ...res.processData,
                        tabId: tab.id,
                        updatedAt: Date.now(),
                      };
                      void chrome.storage.local.set({ [STORAGE_ACTIVE_PROCESSES]: activeMap });
                    }
                  });
                } catch {
                  // Ignora abas sem content script ativo
                }
              }
            }
          });

          await chrome.storage.local.set({ [STORAGE_ACTIVE_PROCESSES]: activeMap });
        }
      } catch {
        // Ignora erro
      }
    }

    // 2. Busca e acopla dados de processos persistidos por siages-process-state:*
    for (const [key, val] of Object.entries(stored || {})) {
      if (key.startsWith('siages-process-state:') && val && typeof val === 'object') {
        const suapId = val.suapId;
        const snapshotProc = val.snapshot?.process;
        const fallbackProc = val.snapshot?.fallback;
        const procNum = snapshotProc?.numProcesso || fallbackProc?.processNumber;

        const activeEntry = Object.values(activeMap).find((p) => p.suapId === suapId);
        if (activeEntry) {
          if (!activeEntry.process && snapshotProc) activeEntry.process = snapshotProc;
          if (!activeEntry.processNumber && procNum) activeEntry.processNumber = procNum;
        } else if (suapId || procNum) {
          if (!recentList.some((r) => r.suapId === suapId)) {
            recentList.push({
              suapId: suapId || '',
              processNumber: procNum || `Processo #${suapId}`,
              process: snapshotProc || null,
              fields: [],
              updatedAt: Date.now() - 10000,
              activeAt: Date.now() - 10000,
            });
          }
        }
      }
    }

    let processList = Object.values(activeMap);

    if (processList.length > 0) {
      // Ordena: o processo na aba ativa/mais recente vem em primeiro lugar!
      processList.sort((a, b) => (b.activeAt || b.updatedAt || 0) - (a.activeAt || a.updatedAt || 0));
      return { ok: true, processes: processList };
    }

    // Fallback para recentList se não houver abas ativas detectadas
    if (recentList.length > 0) {
      recentList.sort((a, b) => (b.activeAt || b.updatedAt || 0) - (a.activeAt || a.updatedAt || 0));
      return { ok: true, processes: recentList };
    }

    return { ok: true, processes: [] };
  }

  throw new Error('Operação de registro de processo desconhecida.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source === AUTH_MESSAGE_SOURCE) {
    void handleAuthMessage(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Falha na autenticação da extensão.' }));
    return true;
  }
  if (message?.source === PROCESS_REGISTRY_SOURCE) {
    void handleProcessRegistryMessage(message, sender)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Falha no registro de processos.' }));
    return true;
  }
  if (message?.source === PROCESS_BOX_SYNC_SOURCE) {
    void handleProcessBoxSyncMessage(message, sender)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Falha na sincronização das caixas do SUAP.' }));
    return true;
  }
  return undefined;
});

if (chrome?.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const stored = await chrome.storage.local.get(STORAGE_ACTIVE_PROCESSES);
      const activeMap = stored?.[STORAGE_ACTIVE_PROCESSES];
      if (activeMap && activeMap[activeInfo.tabId]) {
        activeMap[activeInfo.tabId].activeAt = Date.now();
        await chrome.storage.local.set({ [STORAGE_ACTIVE_PROCESSES]: activeMap });
      }
    } catch {
      // Ignora erro
    }
  });
}

if (chrome?.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const stored = await chrome.storage.local.get(STORAGE_ACTIVE_PROCESSES);
      const activeMap = stored?.[STORAGE_ACTIVE_PROCESSES];
      if (activeMap && activeMap[tabId]) {
        delete activeMap[tabId];
        await chrome.storage.local.set({ [STORAGE_ACTIVE_PROCESSES]: activeMap });
      }
    } catch {
      // Ignora erro
    }
  });
}

if (chrome?.commands?.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-process-paste') {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'open-process-paste' });
        }
      } catch {
        // Ignora erro
      }
    }
  });
}

async function ensureSessionRefreshAlarm() {
  const existingAlarm = await chrome.alarms.get?.(SESSION_REFRESH_ALARM);
  if (!existingAlarm) chrome.alarms.create(SESSION_REFRESH_ALARM, { periodInMinutes: 15 });
}

function getProcessBoxSyncStatus(state = {}) {
  const nextRunAt = PROCESS_BOX_SYNC?.getNextRunAt?.();
  return {
    phase: state.phase || 'idle',
    startedAt: state.startedAt || null,
    finishedAt: state.finishedAt || null,
    nextRunAt: nextRunAt?.toISOString?.() || state.nextRunAt || null,
    message: state.message || 'Sincronização programada para dias úteis às 07h, 10h, 13h e 15h.',
    boxesRead: Number(state.boxesRead || 0),
    processCount: Number(state.processCount || 0),
    completedCount: Number(state.completedCount || 0),
    errorCount: Number(state.errorCount || 0),
    lastError: state.lastError || null,
    currentProcess: state.currentProcess || null,
  };
}

async function readProcessBoxSyncState() {
  const stored = await chrome.storage.local.get(PROCESS_BOX_SYNC_STORAGE_KEY);
  return stored?.[PROCESS_BOX_SYNC_STORAGE_KEY] || {};
}

async function writeProcessBoxSyncState(state) {
  await chrome.storage.local.set({ [PROCESS_BOX_SYNC_STORAGE_KEY]: state });
}

async function ensureProcessBoxSyncAlarm() {
  if (!PROCESS_BOX_SYNC?.getNextRunAt || !chrome?.alarms?.create) return;
  const nextRunAt = PROCESS_BOX_SYNC.getNextRunAt();
  if (!nextRunAt) return;
  const existing = await chrome.alarms.get?.(PROCESS_BOX_SYNC_ALARM);
  if (!existing || Math.abs(Number(existing.scheduledTime || 0) - nextRunAt.getTime()) > 60_000) {
    chrome.alarms.create(PROCESS_BOX_SYNC_ALARM, { when: nextRunAt.getTime() });
  }
  const state = await readProcessBoxSyncState().catch(() => ({}));
  await writeProcessBoxSyncState({ ...state, nextRunAt: nextRunAt.toISOString() });
}

function supabaseHeaders(accessToken, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function fetchSupabaseRest(path, accessToken, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: supabaseHeaders(accessToken, options.headers || {}),
  });
  const body = await response.text().catch(() => '');
  if (!response.ok) {
    let detail = '';
    try { detail = JSON.parse(body)?.message || ''; } catch { /* Resposta sem JSON. */ }
    throw new Error(detail || `O SIAGES recusou a sincronização (HTTP ${response.status}).`);
  }
  if (!body) return null;
  try { return JSON.parse(body); } catch { return body; }
}

function safeProcessSyncError(error, secrets = []) {
  let message = error instanceof Error ? error.message : String(error || 'Falha ao sincronizar as caixas do SUAP.');
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join('[oculto]');
  }
  return message.slice(0, 300);
}

async function getAuthenticatedTenant(accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Entre novamente na extensão para sincronizar as caixas do SUAP.');
  const user = await response.json();
  if (!user?.id) throw new Error('Não foi possível identificar o usuário do SIAGES.');
  return user.id;
}

function normalizeProcessBoxIdentity(value) {
  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.search);
    return `${url.origin}${url.pathname}?${[...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${key}=${val}`).join('&')}`;
  } catch {
    return String(value || '').trim();
  }
}

async function loadOrCreateDefaultProcessBoxes(tenantId, accessToken) {
  const defaults = PROCESS_BOX_SYNC?.DEFAULT_PROCESS_BOXES || [];
  const existing = await fetchSupabaseRest(
    `suap_caixas?select=id,nome,url,sync_automatica&tenant_id=eq.${encodeURIComponent(tenantId)}`,
    accessToken,
  );
  const rows = Array.isArray(existing) ? existing : [];
  const byIdentity = new Map(rows.map((box) => [normalizeProcessBoxIdentity(box.url), box]));

  for (const box of defaults) {
    const identity = normalizeProcessBoxIdentity(box.url);
    if (byIdentity.has(identity)) continue;
    const inserted = await fetchSupabaseRest('suap_caixas?select=id,nome,url,sync_automatica', accessToken, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ tenant_id: tenantId, nome: box.name, url: box.url, sync_automatica: true }),
    });
    const row = Array.isArray(inserted) ? inserted[0] : null;
    if (row) {
      rows.push(row);
      byIdentity.set(identity, row);
    }
  }
  return defaults
    .map((box) => byIdentity.get(normalizeProcessBoxIdentity(box.url)))
    .filter((box) => box?.id && box.sync_automatica !== false);
}

async function getSuapSessionCookie() {
  if (!chrome?.cookies?.get) throw new Error('Permissão para consultar a sessão do SUAP indisponível. Recarregue a extensão.');
  const cookie = await chrome.cookies.get({ url: 'https://suap.ifrn.edu.br/', name: 'sessionid' });
  if (!cookie?.value) throw new Error('Faça login no SUAP no Chrome para sincronizar as caixas.');
  return cookie.value;
}

async function fetchProcessBoxHtml(url, sessionId, accessToken) {
  const parsedUrl = new URL(url);
  const path = `${parsedUrl.pathname}${parsedUrl.search}`;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/suap-proxy`, {
    method: 'POST',
    headers: supabaseHeaders(accessToken),
    body: JSON.stringify({ path, method: 'GET', suapSessionId: sessionId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `Falha ao ler uma caixa do SUAP (HTTP ${response.status}).`);
  if (typeof payload?.text !== 'string') throw new Error('O SUAP não devolveu o conteúdo da caixa de processos.');
  if (!payload.text.trim()) throw new Error('O SUAP devolveu uma caixa vazia; o inventário anterior foi preservado.');
  return PROCESS_BOX_SYNC.parseProcessBoxHtml(payload.text);
}

async function fetchAllTenantProcesses(tenantId, accessToken) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await fetchSupabaseRest(
      `processos?select=id,suap_id,status,num_processo,pdf_url&tenant_id=eq.${encodeURIComponent(tenantId)}&order=created_at.asc`,
      accessToken,
      { headers: { Range: `${offset}-${offset + 999}`, 'Range-Unit': 'items' } },
    );
    const rows = Array.isArray(page) ? page : [];
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

async function reconcileProcessBox(box, scraped, rowsBySuapId, tenantId, accessToken) {
  const processIds = [...new Set(scraped.map((process) => rowsBySuapId.get(process.suapId)?.id).filter(Boolean))];
  const encodedBoxId = encodeURIComponent(box.id);
  const encodedTenantId = encodeURIComponent(tenantId);
  const current = await fetchSupabaseRest(
    `suap_processo_caixas?select=processo_id&tenant_id=eq.${encodedTenantId}&caixa_id=eq.${encodedBoxId}`,
    accessToken,
  );
  const observed = new Set(processIds);
  const stale = (Array.isArray(current) ? current : []).map((row) => row.processo_id).filter((id) => !observed.has(id));
  for (let offset = 0; offset < stale.length; offset += 100) {
    const staleBatch = stale.slice(offset, offset + 100);
    await fetchSupabaseRest(
      `suap_processo_caixas?tenant_id=eq.${encodedTenantId}&caixa_id=eq.${encodedBoxId}&processo_id=in.(${staleBatch.map(encodeURIComponent).join(',')})`,
      accessToken,
      { method: 'DELETE' },
    );
  }
  if (processIds.length) {
    const memberships = processIds.map((processo_id) => ({ processo_id, caixa_id: box.id, tenant_id: tenantId, last_seen_at: new Date().toISOString() }));
    await fetchSupabaseRest(
      'suap_processo_caixas?on_conflict=processo_id,caixa_id',
      accessToken,
      { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(memberships) },
    );
  }
  await fetchSupabaseRest(`suap_caixas?id=eq.${encodedBoxId}&tenant_id=eq.${encodedTenantId}`, accessToken, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_sync_at: new Date().toISOString() }),
  });
}

let processBoxSyncInFlight = null;
let processQueueAdvanceInFlight = null;

async function startNextQueuedProcess() {
  if (processQueueAdvanceInFlight) return processQueueAdvanceInFlight;
  processQueueAdvanceInFlight = (async () => {
    let state = await readProcessBoxSyncState();
    if (state.phase !== 'processing' || state.activeTabId != null) return;
    const queue = Array.isArray(state.queue) ? state.queue : [];
    while (Number(state.queueIndex || 0) < queue.length) {
      const index = Number(state.queueIndex || 0);
      const process = queue[index];
      await writeProcessBoxSyncState({ ...state, currentProcess: process.numProcesso || `Processo ${process.suapId}`, message: `Processando ${process.numProcesso || process.suapId} (${index + 1}/${queue.length})...` });
      try {
        const tab = await chrome.tabs.create({ url: process.url, active: false });
        await writeProcessBoxSyncState({ ...state, activeTabId: tab.id, activeSuapId: process.suapId, currentProcess: process.numProcesso || `Processo ${process.suapId}`, message: `Processando ${process.numProcesso || process.suapId} (${index + 1}/${queue.length})...` });
        return;
      } catch {
        state = { ...state, queueIndex: index + 1, errorCount: Number(state.errorCount || 0) + 1, lastError: `Não foi possível abrir o processo ${process.suapId}.` };
        await writeProcessBoxSyncState(state);
      }
    }

    {
      const finished = {
        ...state,
        phase: state.errorCount ? 'completed_with_errors' : 'completed',
        finishedAt: new Date().toISOString(),
        message: `Sincronização concluída: ${state.completedCount || 0} processo(s) processado(s), ${state.errorCount || 0} erro(s).`,
        currentProcess: null,
        queue: [],
        queueIndex: 0,
        activeTabId: null,
      };
      delete finished.lastError;
      await writeProcessBoxSyncState(finished);
    }
  })().finally(() => { processQueueAdvanceInFlight = null; });
  return processQueueAdvanceInFlight;
}

async function finishActiveQueuedProcess(status, sender) {
  const state = await readProcessBoxSyncState();
  if (state.phase !== 'processing' || state.activeTabId !== sender?.tab?.id || String(state.activeSuapId) !== String(status?.suapId)) return { accepted: false };
  if (!['ready', 'error'].includes(status?.status)) return { accepted: true };

  const updated = {
    ...state,
    activeTabId: null,
    activeSuapId: null,
    queueIndex: Number(state.queueIndex || 0) + 1,
    completedCount: Number(state.completedCount || 0) + (status.status === 'ready' ? 1 : 0),
    errorCount: Number(state.errorCount || 0) + (status.status === 'error' ? 1 : 0),
    lastError: status.status === 'error' ? String(status.message || 'Falha no processamento do processo.').slice(0, 300) : state.lastError,
    currentProcess: null,
  };
  await writeProcessBoxSyncState(updated);
  chrome.tabs.remove(sender.tab.id, () => void chrome.runtime.lastError);
  await startNextQueuedProcess();
  return { accepted: true };
}

async function runProcessBoxSync(trigger = 'scheduled') {
  if (processBoxSyncInFlight) return processBoxSyncInFlight;
  processBoxSyncInFlight = (async () => {
    const previous = await readProcessBoxSyncState();
    if (previous.phase === 'processing') return { started: false, message: 'A sincronização já está em andamento.' };

    const startedAt = new Date().toISOString();
    let state = {
      phase: 'inventory',
      trigger,
      startedAt,
      finishedAt: null,
      message: 'Lendo as caixas de processos do SUAP...',
      boxesRead: 0,
      processCount: 0,
      completedCount: 0,
      errorCount: 0,
      queue: [],
      queueIndex: 0,
      activeTabId: null,
      activeSuapId: null,
      nextRunAt: PROCESS_BOX_SYNC?.getNextRunAt?.()?.toISOString?.() || null,
    };
    await writeProcessBoxSyncState(state);
    const secrets = [];
    try {
      const session = await refreshSessionIfNeeded();
      if (!session?.accessToken) throw new Error('Entre na extensão com a conta do SIAGES para sincronizar as caixas.');
      secrets.push(session.accessToken);
      const tenantId = await getAuthenticatedTenant(session.accessToken);
      const boxes = await loadOrCreateDefaultProcessBoxes(tenantId, session.accessToken);
      if (!boxes.length) throw new Error('Ative a sincronização automática em pelo menos uma das duas caixas padrão do SUAP.');
      const suapSessionId = await getSuapSessionCookie();
      secrets.push(suapSessionId);
      const scrapedByBox = new Map();
      let boxErrors = 0;

      for (const box of boxes) {
        try {
          const scraped = await fetchProcessBoxHtml(box.url, suapSessionId, session.accessToken);
          scrapedByBox.set(box.id, { box, processes: scraped.map((process) => ({ ...process, caixa: box.nome })) });
          state = { ...state, boxesRead: state.boxesRead + 1, message: `Caixa lida: ${box.nome} (${scraped.length} processo(s)).` };
          await writeProcessBoxSyncState(state);
        } catch (error) {
          boxErrors += 1;
          state = { ...state, errorCount: boxErrors, lastError: safeProcessSyncError(error, secrets) };
          await writeProcessBoxSyncState(state);
        }
      }
      if (!scrapedByBox.size) throw new Error(state.lastError || 'Nenhuma das caixas padrão pôde ser lida.');

      const allProcesses = [...scrapedByBox.values()].flatMap(({ processes }) => processes);
      const uniqueProcesses = [...new Map(allProcesses.map((process) => [process.suapId, process])).values()];
      const existingRows = await fetchAllTenantProcesses(tenantId, session.accessToken);
      const rowsBySuapId = new Map(existingRows.map((row) => [String(row.suap_id), row]));
      const missingProcesses = uniqueProcesses.filter((process) => !rowsBySuapId.has(process.suapId));
      for (let offset = 0; offset < missingProcesses.length; offset += 100) {
        const batch = missingProcesses.slice(offset, offset + 100);
        const insertedPayload = batch.map((process) => ({
          tenant_id: tenantId,
          suap_id: process.suapId,
          url: process.url,
          status: 'pending_extraction',
          updated_at: new Date().toISOString(),
          ...(process.numProcesso ? { num_processo: process.numProcesso } : {}),
          ...(process.caixa ? { caixa: process.caixa } : {}),
        }));
        try {
          const insertedRows = await fetchSupabaseRest('processos?select=id,suap_id,status,num_processo,pdf_url', session.accessToken, {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(insertedPayload),
          });
          for (const row of Array.isArray(insertedRows) ? insertedRows : []) rowsBySuapId.set(String(row.suap_id), row);
          if (batch.some((process) => !rowsBySuapId.has(process.suapId))) {
            throw new Error('O SIAGES não confirmou todos os processos novos.');
          }
        } catch (error) {
          const refreshed = await fetchAllTenantProcesses(tenantId, session.accessToken);
          for (const row of refreshed) rowsBySuapId.set(String(row.suap_id), row);
          if (batch.some((process) => !rowsBySuapId.has(process.suapId))) throw error;
        }
      }
      for (const { box, processes } of scrapedByBox.values()) {
        await reconcileProcessBox(box, processes, rowsBySuapId, tenantId, session.accessToken);
      }

      const processQueue = uniqueProcesses
        .map((process) => ({ process, row: rowsBySuapId.get(process.suapId) }))
        .filter(({ row }) => ['pending_extraction', 'pdf_uploaded'].includes(row?.status))
        .map(({ process, row }) => ({ suapId: process.suapId, numProcesso: process.numProcesso || row.num_processo || '', url: process.url }));
      state = {
        ...state,
        phase: 'processing',
        processCount: uniqueProcesses.length,
        errorCount: boxErrors,
        lastError: boxErrors ? state.lastError : null,
        queue: processQueue,
        queueIndex: 0,
        activeTabId: null,
        activeSuapId: null,
        message: `${uniqueProcesses.length} processo(s) sincronizado(s); ${processQueue.length} pendente(s) de PDF/IA.`,
      };
      await writeProcessBoxSyncState(state);
      await startNextQueuedProcess();
      return { started: true };
    } catch (error) {
      const failed = {
        ...state,
        phase: 'error',
        finishedAt: new Date().toISOString(),
        message: safeProcessSyncError(error, secrets),
        lastError: safeProcessSyncError(error, secrets),
        queue: [],
        activeTabId: null,
        activeSuapId: null,
      };
      await writeProcessBoxSyncState(failed);
      return { started: false, error: failed.message };
    }
  })().finally(() => { processBoxSyncInFlight = null; });
  return processBoxSyncInFlight;
}

async function handleProcessBoxSyncMessage(message, sender) {
  if (message.type === 'get-status') return { status: getProcessBoxSyncStatus(await readProcessBoxSyncState()) };
  if (message.type === 'sync-now') {
    void runProcessBoxSync('manual').catch(() => undefined);
    return { started: true, message: 'Sincronização solicitada. Acompanhe o andamento no popup da extensão.' };
  }
  if (message.type === 'process-status') return finishActiveQueuedProcess(message.payload || {}, sender);
  throw new Error('Operação de sincronização de caixas desconhecida.');
}

async function resumeQueuedProcessSync() {
  const state = await readProcessBoxSyncState().catch(() => ({}));
  if (state.phase !== 'processing') return;
  if (state.activeTabId != null) {
    try {
      await chrome.tabs.get(state.activeTabId);
      return;
    } catch {
      await writeProcessBoxSyncState({ ...state, activeTabId: null, activeSuapId: null, errorCount: Number(state.errorCount || 0) + 1, lastError: 'O Chrome encerrou uma aba durante o processamento; retomando a fila.' });
    }
  }
  await startNextQueuedProcess();
}

if (chrome?.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const state = await readProcessBoxSyncState().catch(() => ({}));
    if (state.phase !== 'processing' || state.activeTabId !== tabId) return;
    await writeProcessBoxSyncState({ ...state, activeTabId: null, activeSuapId: null, queueIndex: Number(state.queueIndex || 0) + 1, errorCount: Number(state.errorCount || 0) + 1, lastError: 'A aba de um processo foi fechada antes da conclusão.' });
    await startNextQueuedProcess();
  });
}

async function scheduleProcessBoxSync() {
  await ensureProcessBoxSyncAlarm();
  const state = await readProcessBoxSyncState().catch(() => ({}));
  if (state.phase === 'inventory') {
    void runProcessBoxSync('resume').catch(() => undefined);
    return;
  }
  await resumeQueuedProcessSync();
}

function scheduleSessionRefresh() {
  void ensureSessionRefreshAlarm();
  void refreshSessionIfNeeded().catch(() => undefined);
}

void ensureSessionRefreshAlarm();
void scheduleProcessBoxSync().catch(() => undefined);
chrome.runtime.onInstalled.addListener(scheduleSessionRefresh);
chrome.runtime.onStartup.addListener(scheduleSessionRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_REFRESH_ALARM) void refreshSessionIfNeeded().catch(() => undefined);
  if (alarm.name === PROCESS_BOX_SYNC_ALARM) {
    void ensureProcessBoxSyncAlarm().catch(() => undefined);
    void runProcessBoxSync('scheduled').catch(() => undefined);
  }
});
