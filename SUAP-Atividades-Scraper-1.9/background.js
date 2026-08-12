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
      if (!response.ok) throw new Error('A sessão da extensão não pôde ser renovada agora. Tente novamente em instantes.');

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
  if (message.type === 'get-session') return { session: await refreshSessionIfNeeded() };
  if (message.type === 'sign-in') {
    const email = String(message.email || '').trim();
    const password = String(message.password || '');
    if (!email || !password) throw new Error('Informe o e-mail e a senha cadastrados no SIAGES.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Use o e-mail cadastrado no SIAGES. A matrícula do SUAP não autentica neste campo.');
    return { session: await signIn(email, password) };
  }
  if (message.type === 'sign-out') {
    sessionGeneration += 1;
    await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    return { session: null };
  }
  throw new Error('Operação de autenticação desconhecida.');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.source !== AUTH_MESSAGE_SOURCE) return undefined;
  void handleAuthMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Falha na autenticação da extensão.' }));
  return true;
});

function scheduleSessionRefresh() {
  chrome.alarms.create(SESSION_REFRESH_ALARM, { periodInMinutes: 15 });
  void refreshSessionIfNeeded().catch(() => undefined);
}

chrome.runtime.onInstalled.addListener(scheduleSessionRefresh);
chrome.runtime.onStartup.addListener(scheduleSessionRefresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SESSION_REFRESH_ALARM) void refreshSessionIfNeeded().catch(() => undefined);
});
