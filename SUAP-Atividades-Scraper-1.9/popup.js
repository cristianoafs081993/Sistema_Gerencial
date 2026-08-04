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

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase Error (${response.status}): ${errorText}`);
  }

  return response.status !== 204 ? await response.json() : null;
}

async function recordSavingsEvent(count) {
  const secret = automationSecretInput.value.trim();
  localStorage.setItem(SECRET_STORAGE_KEY, secret);

  if (!secret || count <= 0) {
    log('Evento de economia de tempo não registrado: segredo não configurado.', 'info');
    return;
  }

  const response = await fetch(SAVINGS_EVENT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-automation-event-secret': secret,
    },
    body: JSON.stringify({
      scenarioId: 'suap-processos',
      source: 'suap-atividades-extension',
      eventName: 'atividades_sincronizadas',
      occurredAt: new Date().toISOString(),
      metadata: { count },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao registrar economia de tempo (${response.status}): ${errorText}`);
  }

  log(`Evento de economia registrado para ${count} atividade(s).`, 'success');
}

async function getExistingActivities() {
  const data = await supabaseFetch('atividades?select=dimensao,atividade,componente_funcional');
  const set = new Set();
  if (data) {
    data.forEach((item) => {
      set.add(`${item.dimensao}|${item.componente_funcional}|${item.atividade}`.trim().toLowerCase());
    });
  }
  return set;
}

async function insertActivities(activities) {
  if (activities.length === 0) return 0;

  const now = new Date().toISOString();
  const payload = activities.map((activity) => ({
    dimensao: activity.dimensao,
    componente_funcional: activity.componenteFuncional,
    processo: activity.processo || '',
    atividade: activity.atividade,
    descricao: activity.descricao,
    valor_total: activity.valorTotal,
    origem_recurso: activity.origemRecurso,
    natureza_despesa: activity.naturezaDespesa,
    plano_interno: activity.planoInterno,
    created_at: now,
    updated_at: now,
  }));

  const result = await supabaseFetch('atividades', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result ? result.length : 0;
}

async function handleExtraction(filterDimension = null) {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    statusEl.innerHTML = '';

    log('Verificando aba ativa...', 'info');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('suap.ifrn.edu.br')) {
      throw new Error('Você precisa estar na página do SUAP.');
    }

    log('Injetando script...', 'info');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Nenhum dado retornado do SUAP.');
    }

    let scrapedData = results[0].result;

    if (filterDimension) {
      scrapedData = scrapedData.filter((activity) => activity.dimensao.includes(filterDimension));
      log(`Filtradas ${scrapedData.length} atividades para a dimensão ${filterDimension}.`, 'info');
    } else {
      log(`Encontradas ${scrapedData.length} atividades em todas as dimensões.`, 'info');
    }

    if (scrapedData.length === 0) {
      throw new Error('Nenhuma atividade encontrada na página.');
    }

    log('Buscando atividades existentes...', 'info');
    const existingSet = await getExistingActivities();
    const newActivities = [];
    const skippedActivities = [];

    scrapedData.forEach((item) => {
      const key = `${item.dimensao}|${item.componenteFuncional}|${item.atividade}`.trim().toLowerCase();
      if (existingSet.has(key)) {
        skippedActivities.push(item);
      } else {
        newActivities.push(item);
      }
    });

    log(`Foi verificado que ${skippedActivities.length} atividades já existem no banco.`, 'info');

    if (newActivities.length > 0) {
      log(`Inserindo ${newActivities.length} novas atividades...`, 'info');
      const insertedCount = await insertActivities(newActivities);
      log(`Sucesso! ${insertedCount} novas atividades foram cadastradas.`, 'success');
      await recordSavingsEvent(insertedCount);
    } else {
      log('Nenhuma nova atividade para inserir. Todas já estão no banco.', 'success');
    }
  } catch (error) {
    console.error('Extraction error:', error);
    log(error.message, 'error');
  } finally {
    btnExtractEn.disabled = false;
    btnExtractAll.disabled = false;
  }
}

btnExtractEn.addEventListener('click', () => handleExtraction('EN - Ensino'));
btnExtractAll.addEventListener('click', () => handleExtraction(null));
