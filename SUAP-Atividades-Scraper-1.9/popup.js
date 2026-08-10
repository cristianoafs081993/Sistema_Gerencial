const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const SAVINGS_EVENT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/record-automation-savings-event`;
const SECRET_STORAGE_KEY = 'automation-event-secret';
const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session';

const statusEl = document.getElementById('status');
const btnExtractEn = document.getElementById('btn-extract-en');
const btnExtractAll = document.getElementById('btn-extract-all');
const automationSecretInput = document.getElementById('automation-secret');
const extensionAuthEmailInput = document.getElementById('extension-auth-email');
const extensionAuthPasswordInput = document.getElementById('extension-auth-password');
const extensionAuthStatus = document.getElementById('extension-auth-status');
const extensionSignInButton = document.getElementById('btn-extension-sign-in');
const extensionSignOutButton = document.getElementById('btn-extension-sign-out');

function setExtensionAuthStatus(message, isError = false) {
  extensionAuthStatus.textContent = message;
  extensionAuthStatus.style.color = isError ? '#fca5a5' : '#b8c5d1';
}

function isExtensionContextInvalidated(error) {
  return String(error?.message || error || '').toLowerCase().includes('extension context invalidated');
}

function formatExtensionAuthError(error) {
  if (isExtensionContextInvalidated(error)) return 'A extens\u00e3o foi atualizada. Reabra o popup e recarregue a p\u00e1gina do SUAP.';
  return error instanceof Error ? error.message : 'Nao foi possivel autenticar a extensao.';
}

function getInvalidCredentialsMessage() {
  return 'E-mail ou senha do SIAGES inv\u00e1lidos. Confirme o acesso no SIAGES ou redefina a senha.';
}

async function refreshExtensionSession(session) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error('A sessao da extensao expirou ou foi revogada. Entre novamente.');
  }

  const updatedSession = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
  };
  await chrome.storage.local.set({ [EXTENSION_SESSION_STORAGE_KEY]: updatedSession });
  return updatedSession;
}

async function getStoredExtensionSession() {
  const stored = await chrome.storage.local.get(EXTENSION_SESSION_STORAGE_KEY);
  const session = stored[EXTENSION_SESSION_STORAGE_KEY];
  if (!session?.accessToken || !session?.refreshToken) return null;
  if (Number(session.expiresAt || 0) > (Date.now() / 1000) + (5 * 60)) return session;
  return refreshExtensionSession(session);
}

async function updateExtensionAuthStatus() {
  try {
    const session = await getStoredExtensionSession();
    if (session) {
      setExtensionAuthStatus('Sessao da extensao ativa. Os dados respeitam as suas permissoes no SIAGES.');
    } else {
      setExtensionAuthStatus('Entre para permitir que a extensao consulte o banco de dados.');
    }
  } catch (error) {
    await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
    setExtensionAuthStatus(error instanceof Error ? error.message : 'Nao foi possivel renovar a sessao da extensao.', true);
  }
}
async function signInExtension() {
  const email = extensionAuthEmailInput.value.trim();
  const password = extensionAuthPasswordInput.value;
  if (!email || !password) {
    setExtensionAuthStatus('Informe e-mail e senha do SIAGES.', true);
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setExtensionAuthStatus('Use o e-mail cadastrado no SIAGES. A matrícula do SUAP não autentica neste campo.', true);
    return;
  }

  try {
    extensionSignInButton.disabled = true;
    setExtensionAuthStatus('Autenticando a extensão...');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = String(payload?.error || payload?.code || '').toLowerCase();
      if (response.status === 400 || response.status === 401 || code === 'invalid_grant' || code === 'invalid_credentials') throw new Error(getInvalidCredentialsMessage());
      throw new Error(`Não foi possível autenticar no SIAGES (HTTP ${response.status}).`);
    }
    if (!payload.access_token || !payload.refresh_token) throw new Error('O SIAGES não devolveu uma sessão válida.');
    await chrome.storage.local.set({
      [EXTENSION_SESSION_STORAGE_KEY]: {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
      },
    });
    extensionAuthPasswordInput.value = '';
    setExtensionAuthStatus('Sessão ativa. Recarregue a página atual do SUAP para consultar os dados.');
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionSignInButton.disabled = false;
  }
}

extensionSignInButton.addEventListener('click', () => { void signInExtension(); });
extensionSignOutButton.addEventListener('click', async () => {
  await chrome.storage.local.remove(EXTENSION_SESSION_STORAGE_KEY);
  setExtensionAuthStatus('Sessão da extensão removida.');
});
void updateExtensionAuthStatus();

automationSecretInput.value = localStorage.getItem(SECRET_STORAGE_KEY) || '';
automationSecretInput.addEventListener('change', () => {
  localStorage.setItem(SECRET_STORAGE_KEY, automationSecretInput.value.trim());
});

function log(msg, type = 'info') {
  statusEl.style.display = 'block';
  const div = document.createElement('div');
  div.className = `status-line status-${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  statusEl.appendChild(div);
  statusEl.scrollTop = statusEl.scrollHeight;
}

function isCampusUrl(url) {
  return /^https:\/\/www\.siages\.com\.br\/planejamento\/campus(?:[?#].*)?$/.test(url || '');
}

function isSuapPlanUrl(url) {
  try {
    const parsed = new URL(url || '');
    return parsed.hostname === 'suap.ifrn.edu.br' && /^\/plan_estrategico\/plano_concluido\/8\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestCampusSync() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url || (!isSuapPlanUrl(activeTab.url) && !isCampusUrl(activeTab.url))) {
    throw new Error('Abra o Plano 8 do SUAP ou a pagina Campus do SIAGES antes de sincronizar.');
  }

  let campusTab = isCampusUrl(activeTab.url) ? activeTab : null;
  if (!campusTab) {
    const campusTabs = await chrome.tabs.query({ url: ['https://www.siages.com.br/planejamento/campus*'] });
    campusTab = campusTabs[0] || await chrome.tabs.create({ url: 'https://www.siages.com.br/planejamento/campus' });
  }

  if (!campusTab?.id) throw new Error('Nao foi possivel abrir a pagina Campus do SIAGES.');
  await chrome.tabs.update(campusTab.id, { active: true });
  await delay(900);

  try {
    await chrome.tabs.sendMessage(campusTab.id, { type: 'siages:suap-plan-sync-request' });
  } catch {
    // A carga inicial do script ja dispara a sincronizacao; a mensagem pode chegar antes do listener.
  }
}

async function handleExtraction() {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    statusEl.innerHTML = '';
    log('Abrindo o Campus do SIAGES...', 'info');
    await requestCampusSync();
    log('Solicitacao enviada. Acompanhe a previa e a aplicacao no card de sincronizacao do Campus.', 'success');
  } catch (error) {
    console.error('Sync request error:', error);
    log(error instanceof Error ? error.message : 'Nao foi possivel solicitar a sincronizacao.', 'error');
  } finally {
    btnExtractEn.disabled = false;
    btnExtractAll.disabled = false;
  }
}

btnExtractEn.addEventListener('click', () => { void handleExtraction(); });
btnExtractAll.addEventListener('click', () => { void handleExtraction(); });
