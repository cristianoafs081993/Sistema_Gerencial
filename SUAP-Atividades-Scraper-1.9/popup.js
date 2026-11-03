const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const PLAN_PREVIEW_STORAGE_KEY = 'siages-suap-plan-preview';
const PLAN_BATCH_PREVIEW_STORAGE_KEY = 'siages-suap-plan-batch-preview';
const SIAFI_LISTS_QUERY = 'select=id,name,updated_at,rows&order=updated_at.desc';
const SIAFI_MESSAGE_SOURCE = 'siages';
const SIAFI_MESSAGE_TYPE = 'siafi:fill-favorecidos';
const SIAFI_MESSAGE_VERSION = 4;
const SIAFI_BATCH_SIZE = 10;
const SIAFI_BATCH_PROGRESS_STORAGE_KEY = 'siages-siafi-batch-progress';

const statusEl = document.getElementById('status');
const btnExtractEn = document.getElementById('btn-extract-en');
const btnExtractAll = document.getElementById('btn-extract-all');
const btnApplyPlan = document.getElementById('btn-apply-plan');
const btnCollectRds = document.getElementById('btn-collect-rds');
const btnApplyRds = document.getElementById('btn-apply-rds');
const btnPauseRds = document.getElementById('btn-pause-rds');
const rdStatusEl = document.getElementById('rd-sync-status');
const rdAllStatusEl = document.getElementById('rd-all-sync-status');
const btnCollectAllRds = document.getElementById('btn-collect-all-rds');
const btnApplyAllRds = document.getElementById('btn-apply-all-rds');
const btnPauseAllRds = document.getElementById('btn-pause-all-rds');
const rdForceFull = document.getElementById('rd-force-full');
let rdUnit = null;
const extensionAuthForm = document.getElementById('extension-auth-form');
const extensionAuthUser = document.getElementById('extension-auth-user');
const extensionAuthUserEmail = document.getElementById('extension-auth-user-email');
const extensionAuthBadge = document.getElementById('extension-auth-badge');
const extensionAuthEmailInput = document.getElementById('extension-auth-email');
const extensionAuthPasswordInput = document.getElementById('extension-auth-password');
const extensionAuthStatus = document.getElementById('extension-auth-status');
const extensionSignInButton = document.getElementById('btn-extension-sign-in');
const extensionSignOutButton = document.getElementById('btn-extension-sign-out');
const processBoxSyncStatus = document.getElementById('process-box-sync-status');
const siafiFavorecidosCard = document.getElementById('siafi-favorecidos-card');
const siafiListSelect = document.getElementById('siafi-list-select');
const siafiListInfo = document.getElementById('siafi-list-info');
const siafiBatchSelect = document.getElementById('siafi-batch-select');
const siafiAutoContinue = document.getElementById('siafi-auto-continue');
const siafiRefreshButton = document.getElementById('btn-siafi-refresh');
const siafiFillButton = document.getElementById('btn-siafi-fill');
const siafiResumeButton = document.getElementById('btn-siafi-resume');
const siafiFillStatus = document.getElementById('siafi-fill-status');
const syncSection = document.getElementById('sync-section');
let canViewSync = false;
let authStatusRequest = 0;

let siafiLists = [];
let siafiBatchProgress = null;
let siafiActiveTab = null;

function setExtensionAuthStatus(message, isError = false) {
  extensionAuthStatus.textContent = message;
  extensionAuthStatus.dataset.error = String(isError);
}

function renderExtensionAccount(session) {
  const connected = Boolean(session?.accessToken);
  extensionAuthForm.hidden = connected;
  extensionAuthUser.hidden = !connected;
  extensionAuthBadge.textContent = connected ? 'Conectado' : 'Desconectado';
  extensionAuthBadge.dataset.state = connected ? 'connected' : 'disconnected';
  extensionAuthUserEmail.textContent = connected ? session.user?.email || 'Conta SIAGES conectada' : '';
  if (connected) extensionAuthPasswordInput.value = '';
  updateSyncAccess(session);
}

function updateSyncAccess(session) {
  // Mesmo contrato de src/lib/authz.ts; user_metadata não concede privilégios.
  const user = session?.user;
  const allowed = Boolean(session?.accessToken && user && (
    String(user.email || '').trim().toLowerCase() === 'cristiano.cnrn@gmail.com' ||
    user.app_metadata?.role === 'superadmin' || user.app_metadata?.is_superadmin === true
  ));
  const wasAllowed = canViewSync;
  canViewSync = allowed;
  syncSection.hidden = !allowed;
  if (!allowed) {
    rdUnit = null;
    processBoxSyncStatus.textContent = '';
    rdStatusEl.textContent = '';
    rdAllStatusEl.textContent = '';
    statusEl.replaceChildren();
    statusEl.style.display = 'none';
    document.getElementById('plan-sync-panel').open = false;
    document.getElementById('rd-sync-panel').open = false;
    btnApplyPlan.hidden = true;
    btnCollectRds.disabled = true;
  } else if (!wasAllowed) {
    updateProcessBoxSyncStatus();
    void updatePlanPreviewButton();
    void initializeRdControls().catch(error => {
      if (canViewSync) rdStatusEl.textContent = formatExtensionAuthError(error);
    });
  }
}

// Controles ocultos também não podem iniciar ações por clique programático.
syncSection.addEventListener('click', (event) => {
  if (canViewSync) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

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
  const request = ++authStatusRequest;
  updateSyncAccess(null);
  try {
    const session = await getStoredExtensionSession();
    if (request !== authStatusRequest) return;
    renderExtensionAccount(session);
    if (session?.accessToken) {
      setExtensionAuthStatus('Sua sessão é renovada automaticamente.');
    } else {
      setExtensionAuthStatus('Use sua conta SIAGES para acessar os recursos da extensão.');
    }
  } catch (error) {
    if (request !== authStatusRequest) return;
    extensionAuthForm.hidden = !extensionAuthUser.hidden;
    extensionAuthBadge.textContent = 'Verificar acesso';
    extensionAuthBadge.dataset.state = 'unknown';
    setExtensionAuthStatus(error instanceof Error ? error.message : 'Não foi possível renovar a sessão agora. A sessão continua salva para uma nova tentativa.', true);
  }
}

function formatLocalScheduleDate(value) {
  if (!value) return 'calculando...';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'calculando...';
  return date.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function updateProcessBoxSyncStatus() {
  if (!canViewSync || !processBoxSyncStatus || !chrome?.runtime?.sendMessage) return;
  const request = authStatusRequest;
  chrome.runtime.sendMessage(
    { source: 'siages-extension-process-box-sync', type: 'get-status' },
    (response) => {
      if (!canViewSync || request !== authStatusRequest) return;
      if (chrome.runtime.lastError || !response?.ok) {
        processBoxSyncStatus.textContent = 'Não foi possível consultar a sincronização. Reabra a extensão para tentar novamente.';
        return;
      }
      const status = response.status || {};
      const lines = [`Próxima execução: ${formatLocalScheduleDate(status.nextRunAt)} (dias úteis).`];
      if (status.phase === 'inventory' || status.phase === 'processing') {
        lines.push(status.message || 'Sincronização em andamento...');
      } else if (status.finishedAt) {
        lines.push(`${status.message || 'Última sincronização concluída.'} ${new Date(status.finishedAt).toLocaleString('pt-BR')}.`);
      }
      if (status.lastError) lines.push(`Último aviso: ${status.lastError}`);
      processBoxSyncStatus.textContent = lines.join('\n');
    },
  );
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
    const session = await globalThis.SiagesExtensionAuth.signIn(email, password);
    authStatusRequest += 1;
    renderExtensionAccount(session);
    setExtensionAuthStatus('Você entrou no SIAGES. Sua sessão é renovada automaticamente.');
    extensionAuthPasswordInput.value = '';
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionSignInButton.disabled = false;
  }
}

extensionAuthForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!extensionSignInButton.disabled) void signInExtension();
});
extensionSignOutButton.addEventListener('click', async () => {
  authStatusRequest += 1;
  updateSyncAccess(null);
  try {
    extensionSignOutButton.disabled = true;
    if (!globalThis.SiagesExtensionAuth?.signOut) throw new Error('O serviço de autenticação da extensão não está disponível.');
    await globalThis.SiagesExtensionAuth.signOut();
    renderExtensionAccount(null);
    extensionAuthPasswordInput.value = '';
    setExtensionAuthStatus('Sessão da extensão encerrada.');
    extensionAuthEmailInput.focus();
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionSignOutButton.disabled = false;
  }
});
void updateExtensionAuthStatus();
chrome?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['siages-process-box-sync-state']) updateProcessBoxSyncStatus();
  if (areaName === 'local' && changes['siages-extension-session']) void updateExtensionAuthStatus();
});

function log(msg, type = 'info') {
  if (!canViewSync) return;
  document.getElementById('plan-sync-panel').open = true;
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
    func: () => ({ url: window.location.href, html: document.documentElement?.outerHTML || '', unit: document.querySelector('#id_unidade_gestora')?.value || new URL(window.location.href).searchParams.get('unidade_gestora') || '19' }),
  });
  const captured = results?.[0]?.result;
  if (!captured?.html) throw new Error('A pagina do SUAP ainda nao terminou de carregar. Recarregue e tente novamente.');
  return captured;
}

async function rdMessage(type, extra = {}) {
  if (!canViewSync) throw new Error('Sincronização disponível apenas para o superadministrador.');
  if (!rdUnit && extra.scope !== 'all') throw new Error('Abra o Plano 8 ou a lista de RDs da unidade no SUAP.');
  const response = await chrome.runtime.sendMessage({ source: 'siages-extension-rd-sync', type, unit: rdUnit, ...extra });
  if (!response?.ok) throw new Error(response?.error || 'Não foi possível acionar a coleta de RDs.');
  return response;
}

async function updateAllRdStatus() {
  if (!canViewSync) return;
  const { status, running } = await rdMessage('status', { scope: 'all' });
  if (!canViewSync) return;
  const entries = status?.results || [];
  const previews = entries.filter(entry => entry.run?.status === 'preview' && entry.run.complete);
  const applied = entries.filter(entry => entry.run?.status === 'applied');
  const failed = entries.filter(entry => entry.error);
  if (running || previews.length || failed.length) document.getElementById('rd-sync-panel').open = true;
  const reused = entries.reduce((sum,entry) => sum + (entry.run?.reusedDetails || 0),0);
  const published = entries.reduce((sum,entry) => sum + (entry.run?.appliedSnapshots || 0),0);
  const captured = entries.reduce((sum,entry) => sum + (entry.run?.snapshotCount || 0),0);
  btnApplyAllRds.hidden = !previews.length || running;
  btnPauseAllRds.hidden = !running;
  btnCollectAllRds.disabled = running;
  btnApplyAllRds.textContent = `Aplicar RDs de ${previews.length} unidade(s) conferida(s)`;
  const current = status?.currentUnit ? ` Unidade atual: ${status.currentUnit.code} (${status.currentUnit.parentUasg}).` : '';
  const errors = failed.length ? ` Falhas: ${failed.map(entry => `${entry.code}: ${entry.error}`).join('; ')}` : '';
  rdAllStatusEl.textContent = status?.error || (status
    ? `${running ? 'Coletando' : status.paused ? 'Lote pausado' : 'Lote de RDs'}: ${entries.length}/${status.total || 0} unidades; ${published}/${captured} RDs capturadas já disponíveis; ${previews.length} conferências completas; ${applied.length} unidades reconciliadas; ${reused} RDs reaproveitadas.${current}${errors}`
    : 'Todas as unidades: captura independente por unidade e campus; RDs validadas ficam disponíveis automaticamente.');
}

async function updateRdStatus() {
  if (!canViewSync || !rdUnit) return;
  const result = await rdMessage('status');
  if (!canViewSync) return;
  const status = result.status;
  const run = status?.run;
  const running = result.running;
  btnApplyRds.hidden = run?.status !== 'preview' || !run?.complete || running;
  btnPauseRds.hidden = !running;
  if (running || run?.status === 'preview' || status?.error) document.getElementById('rd-sync-panel').open = true;
  btnCollectRds.disabled = running;
  const totals = run?.summary;
  const reuse = run?.syncMode === 'incremental' ? ` ${run.reusedDetails || 0} RDs reaproveitadas; ${run.refreshedDetails || 0} relidas; ${run.reusedActivities || 0} relações de atividades reaproveitadas.` : '';
  const publication = Number.isInteger(run?.snapshotCount) ? ` ${run.appliedSnapshots || 0}/${run.snapshotCount} RDs capturadas já disponíveis.` : '';
  const priority = run?.priorityTotal > 0 && run?.status !== 'applied' ? ` RDs novas (prioridade): ${run.priorityPublished || 0}/${run.priorityTotal} publicadas.` : '';
  const currency = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  rdStatusEl.textContent = status?.error || (run?.status === 'preview'
    ? `Conferência completa da unidade ${rdUnit}: ${totals?.rds || 0} RDs.${reuse} Dotação ${currency(totals?.totalDotacao)}, reforços ${currency(totals?.totalReforco)}, anulações ${currency(totals?.totalAnulacao)}. Confira os detalhes no SIAGES.`
    : run?.status === 'applied' ? `RDs da unidade ${rdUnit} aplicadas no SIAGES.${publication}`
    : run ? `${running ? 'Coletando RDs' : 'Coleta pausada ou interrompida'} — unidade ${rdUnit}: ${run.processed || 0}/${run.sourceCount || 0} RDs conferidas; ${run.activitiesProcessed || 0}/${run.activitiesTotal || 0} relações oficiais verificadas.${priority}${publication}${reuse} ${running ? 'Mantenha a aba SUAP aberta.' : 'Clique em coletar / retomar.'}`
    : `Unidade SUAP ${rdUnit}. A coleta usa sua sessão nesta aba.`);
}

async function startRdCollection(tab, unit) {
  if (!/^\d+$/.test(String(unit))) throw new Error('Selecione a unidade SUAP antes de sincronizar.');
  rdUnit = String(unit);
  await rdMessage('start', { tabId: tab.id, ...(rdForceFull?.checked ? { forceFull:true } : {}) });
  await updateRdStatus();
}

async function initializeRdControls() {
  if (!canViewSync) return;
  await updateAllRdStatus();
  if (!canViewSync) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!canViewSync) return;
  if (!tab?.url || new URL(tab.url).origin !== 'https://suap.ifrn.edu.br') return;
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({
    unit: document.querySelector('#id_unidade_gestora')?.value || new URL(location.href).searchParams.get('unidade_gestora') || '',
  }) });
  const unit = results?.[0]?.result?.unit;
  if (!canViewSync) return;
  if (!/^\d+$/.test(String(unit))) return;
  rdUnit = String(unit);
  btnCollectRds.disabled = false;
  await updateRdStatus();
}

async function startAllRdCollection(tab) {
  await rdMessage('start', { scope: 'all', tabId: tab.id, ...(rdForceFull?.checked ? { forceFull:true } : {}) });
  await updateAllRdStatus();
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

async function postAllPlanSync(session, batchId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'sync-all', ...(batchId ? { batchId } : {}) }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function connectPlanSyncFromSuapSession(session) {
  const cookie = await chrome.cookies.get({
    url: 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',
    name: 'sessionid',
  });
  if (!cookie?.value) {
    throw new Error('Faça login no SUAP na aba atual e tente sincronizar novamente.');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'connect-cookie', sessionId: cookie.value }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Não foi possível reutilizar a sessão do SUAP (HTTP ${response.status}).`);
  return payload;
}

async function sendAllPlanSync() {
  const session = await getStoredExtensionSession();
  if (!session?.accessToken) throw new Error('Entre no SIAGES no popup da extensao antes de sincronizar.');

  let batchId;
  let reauthAttempts = 0;
  while (true) {
    let { response, payload } = await postAllPlanSync(session, batchId);
    if (response.status === 401 && payload?.status === 'reauth_required' && reauthAttempts < 2) {
      reauthAttempts += 1;
      await connectPlanSyncFromSuapSession(session);
      continue;
    }
    if (!response.ok) throw new Error(payload?.error || `Falha no sincronizador SUAP (HTTP ${response.status}).`);
    if (payload?.status !== 'running' || !payload?.batchId) return payload;
    batchId = payload.batchId;
    await delay(100);
  }
}

async function setPlanPreview(run) {
  if (run?.runId) {
    await chrome.storage.local.set({ [PLAN_PREVIEW_STORAGE_KEY]: run });
    await chrome.storage.local.remove(PLAN_BATCH_PREVIEW_STORAGE_KEY);
  } else if (run?.batchId) {
    await chrome.storage.local.set({ [PLAN_BATCH_PREVIEW_STORAGE_KEY]: run });
    await chrome.storage.local.remove(PLAN_PREVIEW_STORAGE_KEY);
  } else {
    await chrome.storage.local.remove([PLAN_PREVIEW_STORAGE_KEY, PLAN_BATCH_PREVIEW_STORAGE_KEY]);
  }
  await updatePlanPreviewButton();
}

async function updatePlanPreviewButton() {
  if (!canViewSync) return;
  const stored = await chrome.storage.local.get(PLAN_PREVIEW_STORAGE_KEY);
  let preview = stored[PLAN_PREVIEW_STORAGE_KEY];
  const batchStored = await chrome.storage.local.get(PLAN_BATCH_PREVIEW_STORAGE_KEY);
  let batchPreview = batchStored[PLAN_BATCH_PREVIEW_STORAGE_KEY];
  if (!canViewSync) return;
  if (!preview?.runId && !batchPreview?.batchId) {
    try {
      const session = await getStoredExtensionSession();
      if (canViewSync && session?.accessToken) {
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
        if (!canViewSync) return;
        if (response.ok && payload?.run?.status === 'preview') {
          preview = { ...payload.run, runId: payload.run.id };
          await chrome.storage.local.set({ [PLAN_PREVIEW_STORAGE_KEY]: preview });
        }
        if (response.ok && (payload?.batch?.status === 'preview' || (payload?.batch?.status === 'partial' && payload?.batch?.preview_count > 0))) {
          batchPreview = { ...payload.batch, batchId: payload.batch.id };
          await chrome.storage.local.set({ [PLAN_BATCH_PREVIEW_STORAGE_KEY]: batchPreview });
        }
      }
    } catch {
      // O botao continua oculto quando nao ha sessao ou a consulta de status falha.
    }
  }
  if (!canViewSync) return;
  const hasPreview = Boolean(preview?.runId || preview?.id || batchPreview?.batchId || batchPreview?.id);
  btnApplyPlan.textContent = batchPreview?.batchId || batchPreview?.id ? 'Aplicar atividades das unidades conferidas' : 'Aplicar atividades desta unidade';
  btnApplyPlan.hidden = !hasPreview;
  if (hasPreview) document.getElementById('plan-sync-panel').open = true;
  btnApplyPlan.disabled = !hasPreview;
}

function isSiafiUrl(url) {
  try {
    return new URL(url || '').hostname === 'siafi.tesouro.gov.br';
  } catch {
    return false;
  }
}

function normalizeSiafiCpf(value) {
  return String(value || '').replace(/\D/g, '');
}

function parseSiafiCurrency(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const raw = String(value ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!raw) return NaN;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma >= 0 && (dot < 0 || comma > dot)
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function buildSiafiRecords(list) {
  const rows = Array.isArray(list?.rows) ? list.rows : [];
  return rows.map((row) => ({
    cpf: normalizeSiafiCpf(row?.cpf || row?.favorecidoDocumento || row?.favorecido_documento),
    valor: parseSiafiCurrency(row?.valor),
  }));
}

function validateSiafiRecords(records) {
  const invalid = [];
  const normalized = (Array.isArray(records) ? records : []).map((record, index) => {
    const cpf = normalizeSiafiCpf(record?.cpf);
    const valor = parseSiafiCurrency(record?.valor);
    if (cpf.length !== 11 || !Number.isFinite(valor) || valor <= 0) invalid.push(index + 1);
    return { cpf, valor };
  });
  return { records: normalized, invalid };
}

function setSiafiListStatus(message, isError = false) {
  if (!siafiFillStatus) return;
  siafiFillStatus.textContent = message;
  siafiFillStatus.dataset.error = String(isError);
}

function siafiListUpdatedAt(list) {
  return String(list?.updated_at || list?.updatedAt || '');
}

function getSiafiBatchOffset(list, tab) {
  if (!list || !siafiBatchProgress) return 0;
  if (siafiBatchProgress.listId !== list.id || siafiBatchProgress.updatedAt !== siafiListUpdatedAt(list)) return 0;
  if (tab && (siafiBatchProgress.tabId !== tab.id || siafiBatchProgress.tabUrl !== tab.url)) return 0;
  const total = Array.isArray(list.rows) ? list.rows.length : 0;
  return Math.min(Math.max(Number(siafiBatchProgress.offset) || 0, 0), total);
}

async function loadSiafiBatchProgress() {
  try {
    const stored = await chrome.storage.local.get(SIAFI_BATCH_PROGRESS_STORAGE_KEY);
    const progress = stored?.[SIAFI_BATCH_PROGRESS_STORAGE_KEY];
    siafiBatchProgress = progress && typeof progress === 'object' ? progress : null;
  } catch {
    siafiBatchProgress = null;
  }
}

async function saveSiafiBatchProgress(list, tab, offset) {
  siafiBatchProgress = {
    listId: list.id,
    updatedAt: siafiListUpdatedAt(list),
    tabId: tab.id,
    tabUrl: tab.url || '',
    offset,
  };
  await chrome.storage.local.set({ [SIAFI_BATCH_PROGRESS_STORAGE_KEY]: siafiBatchProgress });
}

function renderSiafiBatchOptions(total, savedOffset) {
  if (!siafiBatchSelect) return;
  siafiBatchSelect.replaceChildren();
  const addOption = (value, label) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    siafiBatchSelect.appendChild(option);
  };
  if (!total) {
    addOption('', 'Selecione uma lista');
    siafiBatchSelect.disabled = true;
    return;
  }

  const totalBatches = Math.ceil(total / SIAFI_BATCH_SIZE);
  // Progresso salvo no meio de um bloco vira uma opção de retomada própria.
  const starts = Array.from({ length: totalBatches }, (_, index) => index * SIAFI_BATCH_SIZE);
  if (savedOffset < total && savedOffset % SIAFI_BATCH_SIZE) starts.push(savedOffset);
  if (savedOffset >= total) addOption('', 'Fim da lista alcançado');
  starts.sort((a, b) => a - b).forEach((start) => {
    const range = `posições ${start + 1}-${Math.min(start + SIAFI_BATCH_SIZE, total)}`;
    const label = start % SIAFI_BATCH_SIZE
      ? `Retomar da posição ${start + 1}: ${range}`
      : `Bloco ${start / SIAFI_BATCH_SIZE + 1}/${totalBatches}: ${range}`;
    addOption(String(start), start === savedOffset && start > 0 ? `${label} (próximo)` : label);
  });
  siafiBatchSelect.value = savedOffset < total ? String(savedOffset) : '';
  siafiBatchSelect.disabled = false;
}

function selectedSiafiOffset(list, tab) {
  if (!siafiBatchSelect) return getSiafiBatchOffset(list, tab);
  // Sem bloco escolhido (todos preenchidos), o início fica após o último registro.
  return siafiBatchSelect.value === '' ? buildSiafiRecords(list).length : Number(siafiBatchSelect.value);
}

function updateSiafiBatchInfo() {
  if (!siafiListSelect || !siafiListInfo || !siafiFillButton) return;
  const selected = siafiLists.find((list) => list.id === siafiListSelect.value);
  if (!selected) return;
  const total = buildSiafiRecords(selected).length;
  if (!total) {
    siafiListInfo.textContent = 'A lista selecionada não possui favorecidos.';
    siafiFillButton.disabled = true;
    return;
  }
  const savedOffset = getSiafiBatchOffset(selected, siafiActiveTab);
  const offset = selectedSiafiOffset(selected, siafiActiveTab);
  if (offset >= total) {
    siafiListInfo.textContent = `Progresso no fim da lista (${total} favorecido(s)). Use “Concluir linhas abertas” para revisar pendências da página atual ou escolha um bloco inicial.`;
    siafiFillButton.disabled = true;
    return;
  }
  const nextBatchEnd = Math.min(offset + SIAFI_BATCH_SIZE, total);
  const warning = offset < savedOffset
    ? ' Atenção: o bloco escolhido é anterior ao progresso salvo; linhas já confirmadas em outra página do SIAFI podem ser duplicadas.'
    : '';
  siafiListInfo.textContent = `${total} favorecido(s) pronto(s) para colagem. Próximo bloco: posições ${offset + 1}-${nextBatchEnd} (máximo ${SIAFI_BATCH_SIZE}).${warning}`;
  siafiFillButton.disabled = false;
}

function updateSiafiListInfo() {
  if (!siafiListSelect || !siafiListInfo || !siafiFillButton) return;
  if (siafiResumeButton) siafiResumeButton.disabled = true;
  const selected = siafiLists.find((list) => list.id === siafiListSelect.value);
  if (!selected) {
    siafiListInfo.textContent = siafiLists.length ? 'Selecione uma lista salva no SIAGES.' : 'Nenhuma lista salva encontrada.';
    siafiFillButton.disabled = true;
    renderSiafiBatchOptions(0, 0);
    return;
  }

  const validation = validateSiafiRecords(buildSiafiRecords(selected));
  const validCount = validation.records.length - validation.invalid.length;
  if (validation.invalid.length) {
    siafiListInfo.textContent = `${validCount} favorecido(s) pronto(s) para colagem. ${validation.invalid.length} registro(s) inválido(s): posições ${validation.invalid.join(', ')}.`;
    siafiFillButton.disabled = true;
    renderSiafiBatchOptions(0, 0);
    return;
  }

  if (siafiResumeButton) siafiResumeButton.disabled = validCount === 0;
  renderSiafiBatchOptions(validation.records.length, getSiafiBatchOffset(selected, siafiActiveTab));
  updateSiafiBatchInfo();
}

function renderSiafiLists() {
  if (!siafiListSelect) return;
  siafiListSelect.replaceChildren();
  if (!siafiLists.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhuma lista salva encontrada.';
    siafiListSelect.appendChild(option);
    siafiListSelect.disabled = true;
    updateSiafiListInfo();
    return;
  }

  const previousValue = siafiListSelect.value;
  siafiLists.forEach((list) => {
    const option = document.createElement('option');
    option.value = list.id;
    const count = Array.isArray(list.rows) ? list.rows.length : 0;
    option.textContent = `${list.name || 'Lista de trabalho'} (${count} favorecido(s))`;
    siafiListSelect.appendChild(option);
  });
  siafiListSelect.disabled = false;
  siafiListSelect.value = siafiLists.some((list) => list.id === previousValue) ? previousValue : siafiLists[0].id;
  updateSiafiListInfo();
}

async function fetchSharedLcSavedLists() {
  const session = await getStoredExtensionSession();
  if (!session?.accessToken) throw new Error('Entre no SIAGES no popup da extensao antes de carregar as listas da LC.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/lc_saved_lists?${SIAFI_LISTS_QUERY}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error(`Falha ao carregar listas da LC (HTTP ${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function loadSiafiLists() {
  if (!siafiListSelect || !siafiRefreshButton || !siafiFillButton) return;
  siafiRefreshButton.disabled = true;
  siafiListSelect.disabled = true;
  siafiFillButton.disabled = true;
  if (siafiResumeButton) siafiResumeButton.disabled = true;
  if (siafiBatchSelect) siafiBatchSelect.disabled = true;
  setSiafiListStatus('Carregando listas da LC...');
  try {
    siafiLists = await fetchSharedLcSavedLists();
    await loadSiafiBatchProgress();
    renderSiafiLists();
    setSiafiListStatus('');
  } catch (error) {
    siafiLists = [];
    renderSiafiLists();
    setSiafiListStatus(error instanceof Error ? error.message : 'Nao foi possivel carregar as listas da LC.', true);
  } finally {
    siafiRefreshButton.disabled = false;
    updateSiafiListInfo();
  }
}

async function findSiafiFrameId(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => Boolean(
      document.querySelector('cpr-table-itens-lista table')
      || Array.from(document.querySelectorAll('table')).some((table) => {
        const headers = Array.from(table.querySelectorAll('thead th')).map((header) => String(header.textContent || '').toLowerCase());
        return headers.some((header) => header.includes('favorecido')) && headers.some((header) => header.includes('valor'));
      }),
    ),
  });
  const match = results?.find((result) => result?.result === true);
  if (!match) throw new Error('Nao encontrei a tabela de favorecidos no SIAFI. Abra a transacao correta e tente novamente.');
  return Number.isFinite(Number(match.frameId)) ? Number(match.frameId) : 0;
}

async function sendSiafiFill(tab, frameId, records, mode) {
  const message = {
    source: SIAFI_MESSAGE_SOURCE,
    type: SIAFI_MESSAGE_TYPE,
    version: SIAFI_MESSAGE_VERSION,
    records,
    mode,
  };
  // Reinjeta a versão atual no frame existente, sem navegar/recarregar o SIAFI.
  await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [frameId] }, files: ['siafi-favorecidos.js'] });
  return chrome.tabs.sendMessage(tab.id, message, { frameId });
}

function siafiFillSummary(confirmed, pending) {
  return `${confirmed} linha(s) confirmada(s). ${pending.length} pendente(s) de seleção manual.${pending.length ? ' ' + pending.map((item) => `Item ${item.position} do lote: ${item.reason}.`).join(' ') : ''}`;
}

async function handleSiafiFill(mode = 'fill') {
  if (!siafiFillButton) return;
  // Preenchido quando um bloco encadeado falha, para não esconder os blocos já concluídos.
  let chainContext = '';
  try {
    siafiFillButton.disabled = true;
    if (siafiResumeButton) siafiResumeButton.disabled = true;
    siafiListSelect.disabled = true;
    if (siafiBatchSelect) siafiBatchSelect.disabled = true;
    siafiRefreshButton.disabled = true;
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id || !isSiafiUrl(activeTab.url)) throw new Error('Abra uma transacao do SIAFI antes de preencher os favorecidos.');
    const selected = siafiLists.find((list) => list.id === siafiListSelect.value);
    if (!selected) throw new Error('Selecione uma lista salva da LC.');
    const validation = validateSiafiRecords(buildSiafiRecords(selected));
    if (!validation.records.length) throw new Error('A lista selecionada nao possui favorecidos.');
    if (validation.invalid.length) throw new Error(`Registros inválidos nas posições: ${validation.invalid.join(', ')}.`);
    const total = validation.records.length;
    const totalBatches = Math.ceil(total / SIAFI_BATCH_SIZE);
    // Lido a cada bloco: desmarcar durante o lote para ao fim do bloco atual.
    const autoContinue = () => mode === 'fill' && siafiAutoContinue?.checked !== false;
    let offset = selectedSiafiOffset(selected, activeTab);
    let batchRecords = mode === 'resume' ? validation.records : validation.records.slice(offset, offset + SIAFI_BATCH_SIZE);
    if (!batchRecords.length) throw new Error('Todos os blocos desta lista já foram preenchidos nesta transação.');
    setSiafiListStatus('Localizando a tabela de favorecidos...');
    const frameId = await findSiafiFrameId(activeTab.id);
    const firstBatch = Math.floor(offset / SIAFI_BATCH_SIZE) + 1;
    let completedBatches = 0;
    let processedTotal = 0;
    let confirmedTotal = 0;
    for (;;) {
      const batchNumber = Math.floor(offset / SIAFI_BATCH_SIZE) + 1;
      setSiafiListStatus(mode === 'fill'
        ? `Preenchendo o bloco ${batchNumber}/${totalBatches} no SIAFI...${autoContinue() ? ' Mantenha este popup aberto; desmarque “Seguir para o próximo bloco” para parar ao fim deste bloco.' : ''}`
        : 'Preenchendo favorecidos no SIAFI...');
      const response = await sendSiafiFill(activeTab, frameId, batchRecords, mode);
      const processed = Number(response?.processed || 0);
      if (!Number.isInteger(processed) || processed < 0 || processed > batchRecords.length) {
        throw new Error('A extensão retornou um progresso inválido. Confira a tabela do SIAFI.');
      }
      if (mode === 'fill' && processed > 0) await saveSiafiBatchProgress(selected, activeTab, offset + processed);
      if (!response?.ok) throw new Error(response?.error || 'Nao foi possivel preencher os favorecidos no SIAFI.');
      if (response.matched === false) throw new Error('O frame selecionado nao contem a tabela de favorecidos do SIAFI.');
      const pending = Array.isArray(response.pending) ? response.pending : [];
      if (mode === 'resume') {
        const summary = siafiFillSummary(response.confirmed || 0, pending);
        setSiafiListStatus(summary);
        log(summary, 'success');
        return;
      }
      offset += processed;
      processedTotal += processed;
      confirmedTotal += Number(response.confirmed || 0);
      const remaining = Math.max(total - offset, 0);
      // Sem erro nem pendência, o próximo envio clica em “Incluir Favorecido” e o SIAFI abre a página seguinte.
      if (autoContinue() && remaining && !pending.length) {
        log(`Bloco ${batchNumber}/${totalBatches} concluído: ${siafiFillSummary(response.confirmed || 0, pending)}`, 'success');
        completedBatches += 1;
        chainContext = `${completedBatches} bloco(s) concluído(s) antes da falha. Bloco ${Math.floor(offset / SIAFI_BATCH_SIZE) + 1}/${totalBatches}: `;
        batchRecords = validation.records.slice(offset, offset + SIAFI_BATCH_SIZE);
        continue;
      }
      const summary = siafiFillSummary(confirmedTotal, pending);
      const batches = batchNumber === firstBatch ? `no bloco ${batchNumber}/${totalBatches}` : `nos blocos ${firstBatch}-${batchNumber}/${totalBatches}`;
      const nextMessage = !remaining
        ? ' Todos os blocos foram preenchidos.'
        : pending.length
          ? ` Selecione o Pix das linhas pendentes e confirme-as no SIAFI antes do próximo bloco (${batchNumber + 1}/${totalBatches}).`
          : ` Clique novamente para o próximo bloco (${batchNumber + 1}/${totalBatches}).`;
      setSiafiListStatus(`${processedTotal} favorecido(s) preenchido(s) ${batches}. ${summary}${nextMessage}`);
      log(summary, 'success');
      return;
    }
  } catch (error) {
    console.error('SIAFI fill error:', error);
    const message = chainContext + (error instanceof Error ? error.message : 'Nao foi possivel preencher os favorecidos no SIAFI.');
    setSiafiListStatus(message, true);
    log(message, 'error');
  } finally {
    if (siafiRefreshButton) siafiRefreshButton.disabled = false;
    if (siafiListSelect) siafiListSelect.disabled = !siafiLists.length;
    updateSiafiListInfo();
  }
}

async function initializeSiafiFiller() {
  if (!siafiFavorecidosCard) return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!isSiafiUrl(activeTab?.url)) return;
  siafiActiveTab = activeTab;
  siafiFavorecidosCard.hidden = false;
  await loadSiafiLists();
}
async function applyPlanPreview() {
  const stored = await chrome.storage.local.get(PLAN_PREVIEW_STORAGE_KEY);
  const preview = stored[PLAN_PREVIEW_STORAGE_KEY];
  const batchStored = await chrome.storage.local.get(PLAN_BATCH_PREVIEW_STORAGE_KEY);
  const batchPreview = batchStored[PLAN_BATCH_PREVIEW_STORAGE_KEY];
  const runId = preview?.runId || preview?.id;
  const batchId = batchPreview?.batchId || batchPreview?.id;
  if (!runId && !batchId) throw new Error('Nenhuma conferencia pendente para aplicar.');
  const session = await getStoredExtensionSession();
  if (!session?.accessToken) throw new Error('Entre no SIAGES no popup da extensao antes de aplicar.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-suap-plan`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(batchId ? { action: 'apply-batch', batchId } : { action: 'apply', runId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha ao aplicar a conferencia (HTTP ${response.status}).`);
  await setPlanPreview(null);
  return payload;
}
async function requestCampusSync(tab, scope = 'campus') {
  if (!tab?.id) throw new Error('Nao foi possivel acessar a pagina Campus do SIAGES.');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'siages:suap-plan-sync-request', scope });
  } catch {
    // A carga inicial do script ja dispara a sincronizacao; a mensagem pode chegar antes do listener.
  }
}

async function handleExtraction(scope = 'campus') {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    btnApplyPlan.disabled = true;
    statusEl.innerHTML = '';
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url || (!isSuapPlanUrl(activeTab.url) && !isCampusUrl(activeTab.url))) {
      throw new Error('Abra o Plano 8 do SUAP ou a pagina Campus do SIAGES antes de sincronizar.');
    }

    if (isSuapPlanUrl(activeTab.url) && scope === 'campus') {
      log('Capturando o HTML do Plano 8 na aba SUAP ja autenticada...', 'info');
      const captured = await capturePlanHtml(activeTab);
      const result = await sendCapturedPlanSync(captured);
      if (result.status === 'preview') {
        log(`${result.sourceCount || 0} atividades encontradas: ${result.inserted || 0} novas, ${result.updated || 0} atualizadas, ${result.archived || 0} serao arquivadas.`, 'success');
        await setPlanPreview(result);
        log('Atividades capturadas para conferência. Clique em Aplicar atividades desta unidade para atualizar o SIAGES.', 'info');
      } else {
        log(`Sincronizacao concluida: ${result.inserted || 0} novas, ${result.updated || 0} atualizadas, ${result.archived || 0} arquivadas.`, 'success');
      }
      return;
    }

    if (isSuapPlanUrl(activeTab.url) && scope === 'all') {
      log('Solicitando sincronizacao de todas as unidades do Plano 8...', 'info');
      const result = await sendAllPlanSync();
      if (result.status === 'preview' || result.status === 'partial') await setPlanPreview(result);
      const processedCount = Number.isFinite(Number(result.completedCount))
        ? Number(result.completedCount)
        : result.units?.filter((unit) => unit.status !== 'failed').length || 0;
      const failedCount = Number(result.failedCount) || result.units?.filter((unit) => unit.status === 'failed').length || 0;
      const suffix = failedCount ? ` ${failedCount} falharam.` : '';
      log(`Lote concluído: ${processedCount} unidade(s) processada(s).${suffix}`, result.status === 'partial' ? 'error' : 'success');
      if (result.status === 'preview' || result.status === 'partial') {
        log('Prévia das atividades concluída. Clique em Aplicar atividades das unidades conferidas para atualizar o SIAGES.', 'info');
      }
      return;
    }

    log(scope === 'all' ? 'Solicitando sincronizacao de todas as unidades ao card do Campus...' : 'Solicitando sincronizacao ao card do Campus...', 'info');
    await requestCampusSync(activeTab, scope);
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
btnExtractEn.addEventListener('click', () => { void handleExtraction('campus'); });
btnExtractAll.addEventListener('click', () => { void handleExtraction('all'); });
btnApplyPlan.addEventListener('click', async () => {
  try {
    btnApplyPlan.disabled = true;
    statusEl.innerHTML = '';
    log('Aplicando a conferência das atividades no SIAGES...', 'info');
    const result = await applyPlanPreview();
    const applied = Array.isArray(result.applied) ? result.applied : [];
    const inserted = Number(result.inserted) || applied.reduce((total, item) => total + (Number(item.inserted) || 0), 0);
    const updated = Number(result.updated) || applied.reduce((total, item) => total + (Number(item.updated) || 0), 0);
    const archived = Number(result.archived) || applied.reduce((total, item) => total + (Number(item.archived) || 0), 0);
    log(`Aplicacao concluida: ${inserted} novas, ${updated} atualizadas, ${archived} arquivadas. Recarregue o SIAGES para atualizar os dados visíveis.`, 'success');
  } catch (error) {
    console.error('Apply preview error:', error);
    log(error instanceof Error ? error.message : 'Nao foi possivel aplicar a conferencia.', 'error');
    await updatePlanPreviewButton();
  }
});

siafiListSelect?.addEventListener('change', updateSiafiListInfo);
siafiBatchSelect?.addEventListener('change', updateSiafiBatchInfo);
siafiRefreshButton?.addEventListener('click', () => { void loadSiafiLists(); });
siafiFillButton?.addEventListener('click', () => { void handleSiafiFill(); });
siafiResumeButton?.addEventListener('click', () => { void handleSiafiFill('resume'); });

void initializeSiafiFiller();
chrome.storage.onChanged?.addListener((changes, area) => {
  if (!canViewSync) return;
  if (area === 'local' && rdUnit && changes[`siages-suap-rd-status:${rdUnit}`]) void updateRdStatus().catch(error => { rdStatusEl.textContent = formatExtensionAuthError(error); });
  if (area === 'local' && changes['siages-suap-rd-status:all']) void updateAllRdStatus().catch(error => { rdAllStatusEl.textContent = formatExtensionAuthError(error); });
});
btnCollectRds.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await startRdCollection(tab, rdUnit);
  } catch (error) { rdStatusEl.textContent = formatExtensionAuthError(error); }
});
btnPauseRds.addEventListener('click', () => { void rdMessage('pause').catch(error => { rdStatusEl.textContent = formatExtensionAuthError(error); }); });
btnApplyRds.addEventListener('click', async () => {
  btnApplyRds.disabled = true;
  try { await rdMessage('apply'); await updateRdStatus(); }
  catch (error) { rdStatusEl.textContent = formatExtensionAuthError(error); }
  finally { btnApplyRds.disabled = false; }
});
btnCollectAllRds.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await startAllRdCollection(tab);
  } catch (error) { rdAllStatusEl.textContent = formatExtensionAuthError(error); }
});
btnPauseAllRds.addEventListener('click', () => { void rdMessage('pause', { scope: 'all' }).catch(error => { rdAllStatusEl.textContent = formatExtensionAuthError(error); }); });
btnApplyAllRds.addEventListener('click', async () => {
  btnApplyAllRds.disabled = true;
  try { await rdMessage('apply', { scope: 'all' }); await updateAllRdStatus(); }
  catch (error) { rdAllStatusEl.textContent = formatExtensionAuthError(error); }
  finally { btnApplyAllRds.disabled = false; }
});

// Atalhos de texto: mesma chave e mesmas regras do painel do SUAP (process-document.js) e do expansor.
const SNIPPETS_KEY = 'siages-snippets';
const DEFAULT_SNIPPETS = {
  '/ifrn': 'Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte',
  '/cn': 'Currais Novos',
  '/lei14133': 'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
  '/atpub': 'Atenciosamente, servidor público do IFRN – Campus Currais Novos',
};
const snippetForm = document.getElementById('snippet-form');
const snippetTrigger = document.getElementById('snippet-trigger');
const snippetExpansion = document.getElementById('snippet-expansion');
const snippetCancel = document.getElementById('btn-snippet-cancel');
const snippetMessage = document.getElementById('snippet-message');
const snippetSearch = document.getElementById('snippet-search');
const snippetList = document.getElementById('snippet-list');
let snippets = { ...DEFAULT_SNIPPETS };
let snippetEditingKey = null;

function normalizeSnippetKey(value) {
  const compact = String(value || '').trim().replace(/\s+/g, '');
  if (!compact) return '';
  return `${compact.startsWith('/') ? '' : '/'}${compact}`.toLowerCase();
}

function renderSnippets() {
  if (!snippetList) return;
  const query = String(snippetSearch?.value || '').trim().toLowerCase();
  const keys = Object.keys(snippets)
    .filter((key) => key.includes(query) || String(snippets[key]).toLowerCase().includes(query))
    .sort();
  snippetList.replaceChildren(...keys.map((key) => {
    const item = document.createElement('div');
    item.className = 'snippet-item';
    const text = document.createElement('div');
    text.className = 'snippet-text';
    const trigger = document.createElement('span');
    trigger.className = 'snippet-trigger';
    trigger.textContent = key;
    const expansion = document.createElement('span');
    expansion.className = 'snippet-expansion';
    expansion.textContent = snippets[key];
    text.append(trigger, expansion);
    const actions = document.createElement('div');
    actions.className = 'snippet-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = '✎';
    edit.setAttribute('aria-label', `Editar ${key}`);
    edit.addEventListener('click', () => startSnippetEdit(key));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover ${key}`);
    remove.addEventListener('click', () => { void deleteSnippet(key); });
    actions.append(edit, remove);
    item.append(text, actions);
    return item;
  }));
  if (!keys.length) {
    const empty = document.createElement('p');
    empty.className = 'helper';
    empty.textContent = 'Nenhum atalho encontrado.';
    snippetList.append(empty);
  }
}

function resetSnippetForm() {
  snippetEditingKey = null;
  snippetForm.reset();
  snippetCancel.hidden = true;
}

function startSnippetEdit(key) {
  snippetEditingKey = key;
  snippetTrigger.value = key;
  snippetExpansion.value = snippets[key] || '';
  snippetCancel.hidden = false;
  snippetMessage.textContent = '';
  snippetTrigger.focus();
}

async function persistSnippets(next) {
  await chrome.storage.sync.set({ [SNIPPETS_KEY]: next });
  snippets = next;
  renderSnippets();
}

async function saveSnippet(event) {
  event.preventDefault();
  const key = normalizeSnippetKey(snippetTrigger.value);
  const value = snippetExpansion.value.trim();
  if (!key || key === '/') { snippetMessage.textContent = 'Informe um atalho válido.'; return; }
  if (!value) { snippetMessage.textContent = 'Informe o texto expandido.'; return; }
  if (snippets[key] && key !== snippetEditingKey) { snippetMessage.textContent = 'Este atalho já existe. Edite o item existente.'; return; }
  const next = { ...snippets };
  if (snippetEditingKey && snippetEditingKey !== key) delete next[snippetEditingKey];
  next[key] = value;
  try {
    await persistSnippets(next);
    resetSnippetForm();
    snippetMessage.textContent = `Atalho ${key} salvo.`;
  } catch (error) {
    snippetMessage.textContent = formatExtensionAuthError(error);
  }
}

async function deleteSnippet(key) {
  const next = { ...snippets };
  delete next[key];
  try {
    await persistSnippets(next);
    if (snippetEditingKey === key) resetSnippetForm();
    snippetMessage.textContent = `Atalho ${key} removido.`;
  } catch (error) {
    snippetMessage.textContent = formatExtensionAuthError(error);
  }
}

async function initializeSnippets() {
  if (!snippetForm || !chrome?.storage?.sync?.get) return;
  const stored = await chrome.storage.sync.get(SNIPPETS_KEY).catch(() => ({}));
  const value = stored?.[SNIPPETS_KEY];
  if (value && typeof value === 'object' && Object.keys(value).length) snippets = value;
  renderSnippets();
}

snippetForm?.addEventListener('submit', (event) => { void saveSnippet(event); });
snippetCancel?.addEventListener('click', () => { resetSnippetForm(); snippetMessage.textContent = ''; });
snippetSearch?.addEventListener('input', renderSnippets);
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'sync' || !changes?.[SNIPPETS_KEY]) return;
  const value = changes[SNIPPETS_KEY].newValue;
  snippets = value && typeof value === 'object' && Object.keys(value).length ? value : { ...DEFAULT_SNIPPETS };
  renderSnippets();
});
void initializeSnippets();
