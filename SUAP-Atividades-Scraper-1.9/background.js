const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const AUTH_MESSAGE_SOURCE = 'siages-extension-auth';
const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session';
const SESSION_REFRESH_ALARM = 'siages-extension-session-refresh';
const REFRESH_AHEAD_SECONDS = 20 * 60;

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

function scheduleSessionRefresh() {
  void ensureSessionRefreshAlarm();
  void refreshSessionIfNeeded().catch(() => undefined);
}

void ensureSessionRefreshAlarm();
chrome.runtime.onInstalled.addListener(scheduleSessionRefresh);
chrome.runtime.onStartup.addListener(scheduleSessionRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_REFRESH_ALARM) void refreshSessionIfNeeded().catch(() => undefined);
});
