const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const SAVINGS_EVENT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/record-automation-savings-event`;
const SECRET_STORAGE_KEY = 'automation-event-secret';
const PLAN_PREVIEW_STORAGE_KEY = 'siages-suap-plan-preview';

const statusEl = document.getElementById('status');
const btnExtractEn = document.getElementById('btn-extract-en');
const btnExtractAll = document.getElementById('btn-extract-all');
const btnApplyPlan = document.getElementById('btn-apply-plan');
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

async function getStoredExtensionSession() {
  if (!globalThis.SiagesExtensionAuth?.getSession) throw new Error('O serviço de autenticação da extensão não está disponível.');
  return globalThis.SiagesExtensionAuth.getSession();
}

async function updateExtensionAuthStatus() {
  try {
    const session = await getStoredExtensionSession();
    if (session) {
      setExtensionAuthStatus('Sessão ativa. A renovação é automática; a extensão só sai quando você clicar em Sair.');
    } else {
      setExtensionAuthStatus('Entre para permitir que a extensao consulte o banco de dados.');
    }
  } catch (error) {
    setExtensionAuthStatus(error instanceof Error ? error.message : 'Não foi possível renovar a sessão agora. A sessão continua salva para uma nova tentativa.', true);
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
    if (!globalThis.SiagesExtensionAuth?.signIn) throw new Error('O serviço de autenticação da extensão não está disponível.');
    await globalThis.SiagesExtensionAuth.signIn(email, password);
    setExtensionAuthStatus('Sessão ativa. A renovação é automática; só será encerrada quando você clicar em Sair. Recarregue a página atual do SUAP para consultar os dados.');
    extensionAuthPasswordInput.value = '';
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionSignInButton.disabled = false;
  }
}

extensionSignInButton.addEventListener('click', () => { void signInExtension(); });
extensionSignOutButton.addEventListener('click', async () => {
  try {
    if (!globalThis.SiagesExtensionAuth?.signOut) throw new Error('O serviço de autenticação da extensão não está disponível.');
    await globalThis.SiagesExtensionAuth.signOut();
    setExtensionAuthStatus('Sessão da extensão encerrada.');
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  }
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

async function capturePlanHtml(tab) {
  if (!tab?.id) throw new Error('Nao foi possivel acessar a aba do SUAP.');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ url: window.location.href, html: document.documentElement?.outerHTML || '' }),
  });
  const captured = results?.[0]?.result;
  if (!captured?.html) throw new Error('A pagina do SUAP ainda nao terminou de carregar. Recarregue e tente novamente.');
  return captured;
}

async function sendCapturedPlanSync(captured) {
  const session = await getStoredExtensionSession();
  if (!session?.accessToken) throw new Error('Entre no SIAGES no popup da extensao antes de sincronizar.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'sync-html',
      html: captured.html,
      sourceUrl: captured.url,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha no sincronizador SUAP (HTTP ${response.status}).`);
  return payload;
}

async function setPlanPreview(run) {
  if (run?.runId) {
    await chrome.storage.local.set({ [PLAN_PREVIEW_STORAGE_KEY]: run });
  } else {
    await chrome.storage.local.remove(PLAN_PREVIEW_STORAGE_KEY);
  }
  await updatePlanPreviewButton();
}

async function updatePlanPreviewButton() {
  const stored = await chrome.storage.local.get(PLAN_PREVIEW_STORAGE_KEY);
  let preview = stored[PLAN_PREVIEW_STORAGE_KEY];
  if (!preview?.runId) {
    try {
      const session = await getStoredExtensionSession();
      if (session?.accessToken) {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'status' }),
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload?.run?.status === 'preview') {
          preview = { ...payload.run, runId: payload.run.id };
          await chrome.storage.local.set({ [PLAN_PREVIEW_STORAGE_KEY]: preview });
        }
      }
    } catch {
      // O botao continua oculto quando nao ha sessao ou a consulta de status falha.
    }
  }
  const hasPreview = Boolean(preview?.runId || preview?.id);
  btnApplyPlan.hidden = !hasPreview;
  btnApplyPlan.disabled = !hasPreview;
}
async function applyPlanPreview() {
  const stored = await chrome.storage.local.get(PLAN_PREVIEW_STORAGE_KEY);
  const preview = stored[PLAN_PREVIEW_STORAGE_KEY];
  const runId = preview?.runId || preview?.id;
  if (!runId) throw new Error('Nenhuma conferencia pendente para aplicar.');
  const session = await getStoredExtensionSession();
  if (!session?.accessToken) throw new Error('Entre no SIAGES no popup da extensao antes de aplicar.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'apply', runId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha ao aplicar a conferencia (HTTP ${response.status}).`);
  await setPlanPreview(null);
  return payload;
}
async function requestCampusSync(tab) {
  if (!tab?.id) throw new Error('Nao foi possivel acessar a pagina Campus do SIAGES.');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'siages:suap-plan-sync-request' });
  } catch {
    // A carga inicial do script ja dispara a sincronizacao; a mensagem pode chegar antes do listener.
  }
}

async function handleExtraction() {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    btnApplyPlan.disabled = true;
    statusEl.innerHTML = '';
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url || (!isSuapPlanUrl(activeTab.url) && !isCampusUrl(activeTab.url))) {
      throw new Error('Abra o Plano 8 do SUAP ou a pagina Campus do SIAGES antes de sincronizar.');
    }

    if (isSuapPlanUrl(activeTab.url)) {
      log('Capturando o HTML do Plano 8 na aba SUAP ja autenticada...', 'info');
      const captured = await capturePlanHtml(activeTab);
      const result = await sendCapturedPlanSync(captured);
      if (result.status === 'preview') {
        log(`${result.sourceCount || 0} atividades encontradas: ${result.inserted || 0} novas, ${result.updated || 0} atualizadas, ${result.archived || 0} serao arquivadas.`, 'success');
        await setPlanPreview(result);
        log('A captura foi registrada em modo de conferencia. Clique em Aplicar conferencia para atualizar o SIAGES.', 'info');
      } else {
        log(`Sincronizacao concluida: ${result.inserted || 0} novas, ${result.updated || 0} atualizadas, ${result.archived || 0} arquivadas.`, 'success');
      }
      return;
    }

    log('Solicitando sincronizacao ao card do Campus...', 'info');
    await requestCampusSync(activeTab);
    log('Solicitacao enviada. Acompanhe a previa e a aplicacao no card do Campus.', 'success');
  } catch (error) {
    console.error('Sync request error:', error);
    log(error instanceof Error ? error.message : 'Nao foi possivel solicitar a sincronizacao.', 'error');
  } finally {
    btnExtractEn.disabled = false;
    btnExtractAll.disabled = false;
    await updatePlanPreviewButton();
  }
}
btnExtractEn.addEventListener('click', () => { void handleExtraction(); });
btnExtractAll.addEventListener('click', () => { void handleExtraction(); });
btnApplyPlan.addEventListener('click', async () => {
  try {
    btnApplyPlan.disabled = true;
    statusEl.innerHTML = '';
    log('Aplicando a conferencia no SIAGES...', 'info');
    const result = await applyPlanPreview();
    log(`Aplicacao concluida: ${result.inserted || 0} novas, ${result.updated || 0} atualizadas, ${result.archived || 0} arquivadas.`, 'success');
  } catch (error) {
    console.error('Apply preview error:', error);
    log(error instanceof Error ? error.message : 'Nao foi possivel aplicar a conferencia.', 'error');
    await updatePlanPreviewButton();
  }
});
void updatePlanPreviewButton();
