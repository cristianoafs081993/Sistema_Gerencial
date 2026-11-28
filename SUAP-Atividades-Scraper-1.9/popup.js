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
const extensionAuthCampusField = document.getElementById('extension-auth-campus-field');
const extensionUserCampusSelect = document.getElementById('extension-user-campus-select');
const extensionAuthBadge = document.getElementById('extension-auth-badge');
const extensionAuthEmailInput = document.getElementById('extension-auth-email');
const extensionAuthPasswordInput = document.getElementById('extension-auth-password');
const extensionAuthStatus = document.getElementById('extension-auth-status');
const extensionSignInButton = document.getElementById('btn-extension-sign-in');
const extensionSignOutButton = document.getElementById('btn-extension-sign-out');
const extensionSuapSignInButton = document.getElementById('btn-extension-sign-in-suap');
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

// Menu lateral: mostra uma seção por vez e reabre a última escolhida.
// A seção desejada só aparece quando está disponível (SIAFI aberto, superadmin);
// até lá, o popup exibe a conta.
const SECTION_STORAGE_KEY = 'siages-popup-section';
const DEFAULT_SECTION = 'account';
const SECTION_ALIASES = { templates: 'templates-forwards' };
const navItems = Array.from(document.querySelectorAll('.nav-item[data-section]'));
const navSubmenuToggles = Array.from(document.querySelectorAll('.nav-parent[aria-controls]'));
const sectionViews = Array.from(document.querySelectorAll('.view[data-section]'));
const navSiafiItem = document.getElementById('nav-siafi');
const navSyncGroup = document.getElementById('nav-sync-group');
const navAccountPresence = document.getElementById('nav-account-presence');
const popupContent = document.getElementById('popup-content');
const extensionAuthAvatar = document.getElementById('extension-auth-avatar');
let desiredSection = resolveSection(readSavedSection()) || DEFAULT_SECTION;
let visibleSection = null;

function resolveSection(name) {
  return SECTION_ALIASES[name] || name;
}

function readSavedSection() {
  try { return localStorage.getItem(SECTION_STORAGE_KEY) || ''; } catch { return ''; }
}

function saveSection(name) {
  try { localStorage.setItem(SECTION_STORAGE_KEY, name); } catch { /* preferência opcional */ }
}

function setSubmenuExpanded(toggle, expanded) {
  const panel = document.getElementById(toggle.getAttribute('aria-controls') || '');
  toggle.setAttribute('aria-expanded', String(expanded));
  if (panel) panel.hidden = !expanded;
}

function isSectionAvailable(name) {
  const view = sectionViews.find((candidate) => candidate.dataset.section === name);
  return Boolean(view && !view.closest('[hidden]'));
}

function renderSection() {
  const name = isSectionAvailable(desiredSection) ? desiredSection : DEFAULT_SECTION;
  if (name === visibleSection) return;
  visibleSection = name;
  sectionViews.forEach((view) => view.classList.toggle('is-active', view.dataset.section === name));
  navItems.forEach((item) => {
    const active = item.dataset.section === name;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  navSubmenuToggles.forEach((toggle) => {
    const panel = document.getElementById(toggle.getAttribute('aria-controls') || '');
    const hasActiveChild = Boolean(panel?.querySelector('.nav-item.is-active[data-section]'));
    toggle.classList.toggle('is-parent-active', hasActiveChild);
    if (hasActiveChild) setSubmenuExpanded(toggle, true);
  });
  if (popupContent) popupContent.scrollTop = 0;
}

function selectSection(name, { remember = true } = {}) {
  const resolved = resolveSection(name);
  desiredSection = resolved;
  if (remember) saveSection(resolved);
  renderSection();
}

function updateNavVisibility() {
  if (navSiafiItem) navSiafiItem.hidden = Boolean(siafiFavorecidosCard?.hidden ?? true);
  if (navSyncGroup) navSyncGroup.hidden = syncSection.hidden;
  renderSection();
}

function setNavBadge(section, text = '', tone = 'info') {
  const badge = document.querySelector(`[data-nav-badge="${section}"]`);
  if (!badge) return;
  badge.textContent = text;
  badge.hidden = !text;
  if (text) badge.dataset.tone = tone;
}

function setAccountPresence(state) {
  if (navAccountPresence) navAccountPresence.dataset.state = state;
}

const rdNavState = { unit: '', all: '' };
function updateRdNavBadge() {
  const states = Object.values(rdNavState);
  if (states.includes('running')) setNavBadge('rds', 'Coletando', 'info');
  else if (states.includes('preview')) setNavBadge('rds', 'Conferir', 'success');
  else if (states.includes('error')) setNavBadge('rds', 'Aviso', 'warning');
  else setNavBadge('rds');
}

function clearSyncNavBadges() {
  rdNavState.unit = '';
  rdNavState.all = '';
  ['process-box', 'plan', 'rds'].forEach((section) => setNavBadge(section));
}

navItems.forEach((item) => {
  item.addEventListener('click', () => selectSection(item.dataset.section));
});
navSubmenuToggles.forEach((toggle) => {
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    setSubmenuExpanded(toggle, !expanded);
  });
});
renderSection();

function setExtensionAuthStatus(message, isError = false, isNotice = false) {
  extensionAuthStatus.textContent = message;
  extensionAuthStatus.dataset.error = String(isError);
  if (isNotice) extensionAuthStatus.dataset.notice = 'true';
  else delete extensionAuthStatus.dataset.notice;
}

function renderExtensionAccount(session) {
  const connected = Boolean(session?.accessToken);
  extensionAuthForm.hidden = connected;
  extensionAuthUser.hidden = !connected;
  if (extensionAuthCampusField) extensionAuthCampusField.hidden = !connected;
  extensionAuthBadge.textContent = connected ? 'Conectado' : 'Desconectado';
  extensionAuthBadge.dataset.state = connected ? 'connected' : 'disconnected';
  extensionAuthUserEmail.textContent = connected ? session.user?.email || 'Conta SIAGES conectada' : '';
  if (extensionAuthAvatar) extensionAuthAvatar.textContent = connected ? (session.user?.email || 'S').trim().charAt(0).toUpperCase() : '';
  setAccountPresence(connected ? 'connected' : 'disconnected');
  if (extensionUserCampusSelect) {
    extensionUserCampusSelect.value = session?.campusUasg || '158366';
  }
  if (connected) {
    extensionAuthPasswordInput.value = '';
    if (typeof globalThis.SiagesExtensionAuth?.getCampus === 'function') {
      const request = authStatusRequest;
      void globalThis.SiagesExtensionAuth.getCampus().then((campusUasg) => {
        if (request !== authStatusRequest || !extensionUserCampusSelect || !campusUasg) return;
        extensionUserCampusSelect.value = campusUasg;
      }).catch(() => undefined);
    }
  }
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
  updateNavVisibility();
  if (!allowed) {
    rdUnit = null;
    processBoxSyncStatus.textContent = '';
    rdStatusEl.textContent = '';
    rdAllStatusEl.textContent = '';
    statusEl.replaceChildren();
    statusEl.style.display = 'none';
    clearSyncNavBadges();
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
    const suapStatus = await getRecentSuapLoginStatus();
    if (request !== authStatusRequest) return;
    if (suapStatus?.phase === 'error' && !session?.accessToken) {
      setExtensionAuthStatus(suapStatus.message, true);
    } else if (suapStatus?.phase === 'done' && session?.accessToken) {
      setExtensionAuthStatus(suapStatus.message, false, true);
    } else if (session?.accessToken) {
      setExtensionAuthStatus('Sua sessão é renovada automaticamente.');
    } else {
      setExtensionAuthStatus('Entre com o SUAP ou com sua conta SIAGES para acessar os recursos da extensão.');
    }
  } catch (error) {
    if (request !== authStatusRequest) return;
    extensionAuthForm.hidden = !extensionAuthUser.hidden;
    extensionAuthBadge.textContent = 'Verificar acesso';
    extensionAuthBadge.dataset.state = 'unknown';
    setAccountPresence('unknown');
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
        setNavBadge('process-box', 'Aviso', 'warning');
        return;
      }
      const status = response.status || {};
      const running = status.phase === 'inventory' || status.phase === 'processing';
      if (running) setNavBadge('process-box', 'Rodando', 'info');
      else if (status.lastError) setNavBadge('process-box', 'Aviso', 'warning');
      else setNavBadge('process-box');
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
const SUAP_LOGIN_STATUS_MAX_AGE_MS = 10 * 60 * 1000;

async function getRecentSuapLoginStatus() {
  try {
    const status = await globalThis.SiagesExtensionAuth?.getSuapLoginStatus?.();
    if (!status?.message || Date.now() - Number(status.at || 0) > SUAP_LOGIN_STATUS_MAX_AGE_MS) return null;
    return status;
  } catch {
    return null;
  }
}

async function signInExtensionWithSuap() {
  try {
    extensionSuapSignInButton.disabled = true;
    setExtensionAuthStatus('Abrindo o SUAP. Se você já estiver logado, a aba fecha sozinha.');
    if (!globalThis.SiagesExtensionAuth?.signInWithSuap) throw new Error('O serviço de autenticação da extensão não está disponível.');
    // A aba do SUAP abre em primeiro plano e o popup fecha; o resultado aparece ao reabrir o popup.
    await globalThis.SiagesExtensionAuth.signInWithSuap();
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionSuapSignInButton.disabled = false;
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

extensionSuapSignInButton?.addEventListener('click', () => {
  if (!extensionSuapSignInButton.disabled) void signInExtensionWithSuap();
});
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
extensionUserCampusSelect?.addEventListener('change', async () => {
  const nextCampusUasg = extensionUserCampusSelect.value;
  extensionUserCampusSelect.disabled = true;
  try {
    if (!globalThis.SiagesExtensionAuth?.setCampus) throw new Error('O serviço de autenticação da extensão não está disponível.');
    const saved = await globalThis.SiagesExtensionAuth.setCampus(nextCampusUasg);
    extensionUserCampusSelect.value = saved || nextCampusUasg;
    const selectedLabel = extensionUserCampusSelect.selectedOptions?.[0]?.textContent || saved || nextCampusUasg;
    setExtensionAuthStatus(`Campus vinculado atualizado: ${selectedLabel}.`, false, true);
  } catch (error) {
    setExtensionAuthStatus(formatExtensionAuthError(error), true);
  } finally {
    extensionUserCampusSelect.disabled = false;
  }
});
void updateExtensionAuthStatus();
chrome?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['siages-process-box-sync-state']) updateProcessBoxSyncStatus();
  if (areaName === 'local' && (changes['siages-extension-session'] || changes['siages-extension-suap-login-status'])) void updateExtensionAuthStatus();
  if (areaName === 'local' && changes['siages-user-campus-uasg'] && extensionUserCampusSelect) {
    const nextVal = changes['siages-user-campus-uasg'].newValue;
    if (typeof nextVal === 'string' && nextVal) extensionUserCampusSelect.value = nextVal;
  }
  if (areaName === 'local' && changes['siages-user-campus-uasg']?.newValue) {
    void applyCampusDefaultForward(changes['siages-user-campus-uasg'].newValue);
  }
});

function log(msg, type = 'info') {
  if (!canViewSync) return;
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
  rdNavState.all = running ? 'running' : previews.length ? 'preview' : failed.length || status?.error ? 'error' : '';
  updateRdNavBadge();
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
  rdNavState.unit = running ? 'running' : run?.status === 'preview' && run?.complete ? 'preview' : status?.error ? 'error' : '';
  updateRdNavBadge();
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
  setNavBadge('plan', hasPreview ? 'Prévia' : '', 'success');
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

// Assinatura das linhas (CPF e valor, na ordem): o progresso continua valendo quando a lista é
// regravada sem mudar as linhas (modal da LC no SUAP, renomear, remontar igual), o que muda o updated_at.
function siafiListFingerprint(list) {
  const source = buildSiafiRecords(list).map((record) => `${record.cpf}:${Math.round((record.valor || 0) * 100)}`).join('|');
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = ((hash * 33) ^ source.charCodeAt(index)) >>> 0;
  return `${source.length}-${hash.toString(36)}`;
}

/** Progresso salvo para esta lista, ou null. `sameTab` indica se veio desta mesma aba e URL do SIAFI. */
function getSiafiBatchProgressInfo(list, tab) {
  if (!list || !siafiBatchProgress || siafiBatchProgress.listId !== list.id) return null;
  const sameRows = siafiBatchProgress.fingerprint
    ? siafiBatchProgress.fingerprint === siafiListFingerprint(list)
    : siafiBatchProgress.updatedAt === siafiListUpdatedAt(list); // progresso gravado no formato antigo, sem assinatura
  if (!sameRows) return null;
  const total = Array.isArray(list.rows) ? list.rows.length : 0;
  return {
    offset: Math.min(Math.max(Number(siafiBatchProgress.offset) || 0, 0), total),
    sameTab: !tab || (siafiBatchProgress.tabId === tab.id && siafiBatchProgress.tabUrl === tab.url),
    savedAt: typeof siafiBatchProgress.savedAt === 'string' ? siafiBatchProgress.savedAt : '',
  };
}

function getSiafiBatchOffset(list, tab) {
  return getSiafiBatchProgressInfo(list, tab)?.offset ?? 0;
}

function formatSiafiProgressTime(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
    fingerprint: siafiListFingerprint(list),
    updatedAt: siafiListUpdatedAt(list),
    tabId: tab.id,
    tabUrl: tab.url || '',
    offset,
    savedAt: new Date().toISOString(),
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
  const progressInfo = getSiafiBatchProgressInfo(selected, siafiActiveTab);
  let warning = offset < savedOffset
    ? ' Atenção: o bloco escolhido é anterior ao progresso salvo; linhas já confirmadas em outra página do SIAFI podem ser duplicadas.'
    : '';
  if (progressInfo && progressInfo.offset > 0 && !progressInfo.sameTab) {
    const when = formatSiafiProgressTime(progressInfo.savedAt);
    warning += ` Progresso de ${progressInfo.offset} favorecido(s) salvo em outra aba ou página do SIAFI${when ? ` (${when})` : ''}. Se esta for uma nova transação, escolha o Bloco 1.`;
  }
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
  updateNavVisibility();
  // No SIAFI, o preenchimento é a ferramenta da vez; não substitui a seção salva.
  selectSection('siafi', { remember: false });
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
const snippetFormTitle = document.getElementById('snippet-form-title');
let snippets = { ...DEFAULT_SNIPPETS };
let snippetEditingKey = null;

function normalizeSnippetKey(value) {
  const compact = String(value || '').trim().replace(/\s+/g, '');
  if (!compact) return '';
  return `${compact.startsWith('/') ? '' : '/'}${compact}`.toLowerCase();
}

function renderSnippets() {
  if (!snippetList) return;
  setNavBadge('snippets', String(Object.keys(snippets).length), 'muted');
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
  if (snippetFormTitle) snippetFormTitle.textContent = 'Novo atalho';
}

function startSnippetEdit(key) {
  snippetEditingKey = key;
  snippetTrigger.value = key;
  snippetExpansion.value = snippets[key] || '';
  snippetCancel.hidden = false;
  if (snippetFormTitle) snippetFormTitle.textContent = `Editar atalho ${key}`;
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

// Modelos e preenchimentos: atalhos de encaminhamento, de upload e de documento da paleta, e
// partes fixas do despacho de liquidação. Regras e padrões ficam em user-preferences.js.
const preferencesApi = globalThis.SiagesUserPreferences || null;
const templatesViews = ['templates-forwards-panel', 'templates-documents-panel', 'templates-uploads-panel']
  .map((id) => document.getElementById(id))
  .filter(Boolean);
const navTemplatesGroup = document.getElementById('nav-templates-group');
const navTemplatesItem = document.getElementById('nav-templates');
const forwardListEl = document.getElementById('forward-list');
const forwardMessage = document.getElementById('forward-message');
const forwardUndoButton = document.getElementById('btn-forward-undo');
const forwardNewButton = document.getElementById('btn-forward-new');
const forwardEditor = document.getElementById('forward-editor');
const forwardEditorTitle = document.getElementById('forward-editor-title');
const forwardForm = document.getElementById('forward-form');
const forwardFormMessage = document.getElementById('forward-form-message');
const forwardCatalogStatus = document.getElementById('forward-catalog-status');
const forwardRefreshButton = document.getElementById('btn-forward-refresh');
const forwardFields = {
  shortcut: document.getElementById('forward-shortcut'),
  title: document.getElementById('forward-title'),
  despacho: document.getElementById('forward-despacho'),
  campus: document.getElementById('forward-campus'),
  setorSearch: document.getElementById('forward-setor-search'),
  setorOptions: document.getElementById('forward-setor-options'),
  setor: document.getElementById('forward-setor'),
  papel: document.getElementById('forward-papel'),
};
const uploadFields = {
  shortcut: document.getElementById('upload-shortcut'),
  title: document.getElementById('upload-title'),
  tipoConferencia: document.getElementById('upload-tipo-conferencia'),
  tipoDocumento: document.getElementById('upload-tipo-documento'),
  assunto: document.getElementById('upload-assunto'),
};
const documentFields = {
  shortcut: document.getElementById('document-shortcut'),
  title: document.getElementById('document-title'),
  templateId: document.getElementById('document-template-id'),
  assunto: document.getElementById('document-assunto'),
  texto: document.getElementById('document-texto'),
};
const documentFormMessage = document.getElementById('document-form-message');
const SUAP_DOCUMENT_PAGE_REGEX = /^https:\/\/suap\.ifrn\.edu\.br\/documento_eletronico\/(?:visualizar_documento|documento|editar_documento|clonar_documento)\/(\d+)\//;
const despachoForm = document.getElementById('despacho-form');
const despachoMessage = document.getElementById('despacho-message');
const despachoFormMessage = document.getElementById('despacho-form-message');
const despachoListEl = document.getElementById('despacho-list');
const despachoEditor = document.getElementById('despacho-editor');
const despachoEditorTitle = document.getElementById('despacho-editor-title');
const despachoVariablesEl = document.getElementById('despacho-variables');
const despachoFields = {
  destinatario: document.getElementById('despacho-destinatario'),
  assunto: document.getElementById('despacho-assunto'),
  corpo: document.getElementById('despacho-corpo'),
  encaminhamento: document.getElementById('despacho-encaminhamento'),
  fecho: document.getElementById('despacho-fecho'),
};
let despachoEditing = '';
let despachoLastField = null;
const SUAP_ORIGIN = 'https://suap.ifrn.edu.br';
const SUAP_UO_ENDPOINT = `${SUAP_ORIGIN}/json/rh/unidadeorganizacional/`;
const SUAP_SETOR_ENDPOINT = `${SUAP_ORIGIN}/json/rh/setor/`;
const SUAP_FORWARD_CATALOG_KEY = 'siages-suap-forward-catalog-v2';
const SUAP_DEFAULT_CONTROLS = {
  uo: '04c4a208298e9bb90fbc3af712f42636a8ce4dea732d43c3eee06f1800650ccd',
  setor: 'e38d32439ee53b9ef53d3a0be73e36140c3204ee4dfa36d9e43b4bb58dc78c5f',
};
const SUAP_MAX_UO_PAGES = 10;
const SUAP_MAX_SETOR_PAGES = 60;
const SUAP_FORWARD_PAGE_REGEX = /\/processo_eletronico\/processo\/encaminhar\/(\d+)\/?/;
const SUAP_PROCESS_PAGE_REGEX = /\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/;
let userPreferences = preferencesApi ? preferencesApi.normalize(null) : null;
const suapCatalog = {
  campuses: [],
  sectorsByCampus: {},
  papeis: [],
  controls: { ...SUAP_DEFAULT_CONTROLS },
  cacheLoaded: false,
  refreshedOnce: false,
};
let forwardCatalogRequest = 0;
let setorLoadRequest = 0;
let setorSearchTimer = null;

function cleanSingleLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value) {
  return cleanSingleLine(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function createSuapLoginError() {
  const error = new Error('Faça login no SUAP no navegador e clique em “Atualizar do SUAP”.');
  error.code = 'SUAP_LOGIN_REQUIRED';
  return error;
}

function parseSuapSetorItem(item) {
  const id = String(item?.id ?? '').trim();
  const text = cleanSingleLine(item?.text);
  if (!/^\d+$/.test(id) || !text) return null;
  let label = text;
  if (item?.html && typeof DOMParser === 'function') {
    const doc = new DOMParser().parseFromString(String(item.html), 'text/html');
    const span = doc.querySelector('.admin-setor');
    const title = cleanSingleLine(span?.getAttribute('title'));
    const spanText = cleanSingleLine(span?.textContent);
    if (title && normalizeSearchText(title) !== normalizeSearchText(text)) {
      label = `${text} — ${title}`;
    } else if (spanText && spanText.length > text.length) {
      label = spanText;
    }
  }
  return { id, text, label };
}

function mergeSuapSectors(existing, incoming) {
  const byId = new Map();
  for (const item of [...(existing || []), ...(incoming || [])]) {
    if (!item?.id || !item?.text) continue;
    const prev = byId.get(item.id);
    if (!prev || (item.label && item.label.length > (prev.label || '').length)) {
      byId.set(item.id, { id: String(item.id), text: item.text, label: item.label || item.text });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.text.localeCompare(b.text, 'pt-BR'));
}

function parseForwardPageMetadata(html) {
  if (!html || typeof DOMParser !== 'function') return null;
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const papelSelect = doc.querySelector('select[name="papel"]');
  const papeis = papelSelect
    ? Array.from(papelSelect.options)
        .filter((opt) => cleanSingleLine(opt.value) !== '')
        .map((opt) => cleanSingleLine(opt.textContent))
        .filter((text) => text && !/^-+$/.test(text))
    : [];
  const uoControl = html.match(/\/json\/rh\/unidadeorganizacional\/[\s\S]{0,400}?control\s*:\s*['"]([a-f0-9]{32,128})['"]/i)?.[1] || '';
  const setorControl = html.match(/\/json\/rh\/setor\/[\s\S]{0,400}?control\s*:\s*['"]([a-f0-9]{32,128})['"]/i)?.[1] || '';
  return {
    papeis: Array.from(new Set(papeis)),
    controls: {
      ...(uoControl ? { uo: uoControl } : {}),
      ...(setorControl ? { setor: setorControl } : {}),
    },
  };
}

async function fetchSuapJsonPage(endpoint, params) {
  const url = `${endpoint}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if ((response.redirected && /\/accounts\/login/i.test(response.url || '')) || response.status === 401 || response.status === 403) {
    throw createSuapLoginError();
  }
  if (!response.ok) {
    throw new Error(`O SUAP respondeu ${response.status} ao carregar as listas.`);
  }
  const contentType = response.headers?.get?.('content-type') || '';
  const data = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.items)) {
    if (contentType.includes('text/html')) throw createSuapLoginError();
    throw new Error('Resposta inesperada do SUAP ao carregar as listas.');
  }
  const total = Number(data.total);
  return {
    items: data.items,
    total: Number.isFinite(total) && total > 0 ? total : null,
    more: typeof data.more === 'boolean' ? data.more : null,
  };
}

// Lê todas as páginas de uma lista do SUAP. O tamanho da página vem da primeira resposta; sem total,
// segue até uma página curta, vazia ou repetida. Devolve os itens brutos e se a lista veio completa.
async function fetchSuapAllPages(endpoint, params, maxPages) {
  const first = await fetchSuapJsonPage(endpoint, { ...params, page: '1' });
  const items = [...first.items];
  const pageSize = first.items.length;
  if (!pageSize || first.more === false) return { items, total: first.total || items.length, complete: true };
  if (first.total) {
    const needed = Math.ceil(first.total / pageSize);
    const lastPage = Math.min(maxPages, needed);
    for (let start = 2; start <= lastPage; start += 5) {
      const batch = Array.from({ length: Math.min(5, lastPage - start + 1) }, (_, i) => start + i);
      const pages = await Promise.all(batch.map((page) => fetchSuapJsonPage(endpoint, { ...params, page: String(page) })));
      pages.forEach((page) => items.push(...page.items));
    }
    return { items, total: first.total, complete: needed <= lastPage };
  }
  const seen = new Set(first.items.map((item) => String(item?.id)));
  for (let page = 2; page <= maxPages; page += 1) {
    const next = await fetchSuapJsonPage(endpoint, { ...params, page: String(page) });
    const fresh = next.items.filter((item) => !seen.has(String(item?.id)));
    fresh.forEach((item) => seen.add(String(item?.id)));
    items.push(...fresh);
    if (!fresh.length || next.items.length < pageSize || next.more === false) {
      return { items, total: items.length, complete: true };
    }
  }
  return { items, total: items.length, complete: false };
}

async function fetchSuapCampuses(control = suapCatalog.controls.uo) {
  const result = await fetchSuapAllPages(SUAP_UO_ENDPOINT, { q: '', control }, SUAP_MAX_UO_PAGES);
  const seen = new Map();
  for (const raw of result.items) {
    const id = String(raw?.id ?? '').trim();
    const text = cleanSingleLine(raw?.text);
    if (/^\d+$/.test(id) && text && !seen.has(id)) seen.set(id, { id, text });
  }
  return Array.from(seen.values()).sort((a, b) => a.text.localeCompare(b.text, 'pt-BR'));
}

async function fetchSuapSectors(campusId, { query = '', control = suapCatalog.controls.setor } = {}) {
  const uoId = String(campusId || '').trim();
  if (!/^\d+$/.test(uoId)) return { items: [], total: 0, complete: true };
  const q = cleanSingleLine(query);
  const result = await fetchSuapAllPages(
    SUAP_SETOR_ENDPOINT,
    { q, control, filter_pks: JSON.stringify({ uo_id: uoId }) },
    q ? 5 : SUAP_MAX_SETOR_PAGES,
  );
  const items = mergeSuapSectors([], result.items.map(parseSuapSetorItem).filter(Boolean));
  return { items, total: Math.max(result.total || 0, items.length), complete: result.complete };
}

async function fetchSuapHtmlPage(path) {
  const url = path.startsWith('http') ? path : `${SUAP_ORIGIN}${path}`;
  const response = await fetch(url, { credentials: 'include' });
  if (response.redirected && /\/accounts\/login/i.test(response.url || '')) {
    throw createSuapLoginError();
  }
  if (!response.ok) return null;
  const html = await response.text();
  if (/id="id_username"|name="username"[\s\S]{0,300}name="password"/i.test(html) && !/name="papel"/i.test(html)) {
    throw createSuapLoginError();
  }
  return html;
}

async function fetchSuapPapeisAndControls() {
  const candidateIds = [];
  const addCandidate = (id) => {
    const clean = String(id || '').trim();
    if (/^\d+$/.test(clean) && !candidateIds.includes(clean)) candidateIds.push(clean);
  };

  if (chrome?.tabs?.query) {
    const tabs = await Promise.resolve(chrome.tabs.query({ url: `${SUAP_ORIGIN}/processo_eletronico/*` })).catch(() => []);
    for (const tab of Array.isArray(tabs) ? tabs : []) {
      const url = String(tab?.url || '');
      const forwardMatch = url.match(SUAP_FORWARD_PAGE_REGEX);
      if (forwardMatch) addCandidate(forwardMatch[1]);
    }
    for (const tab of Array.isArray(tabs) ? tabs : []) {
      const url = String(tab?.url || '');
      const processMatch = url.match(SUAP_PROCESS_PAGE_REGEX);
      if (processMatch) addCandidate(processMatch[1]);
    }
  }

  for (const id of candidateIds.slice(0, 2)) {
    const html = await fetchSuapHtmlPage(`/processo_eletronico/processo/encaminhar/${id}/`);
    const meta = parseForwardPageMetadata(html);
    if (meta?.papeis?.length) return meta;
  }

  for (const boxPath of [
    '/processo_eletronico/caixa_processos/?tab=tab_aguardando_encaminhamento',
    '/processo_eletronico/caixa_processos/',
  ]) {
    const html = await fetchSuapHtmlPage(boxPath);
    if (!html) continue;
    for (const match of html.matchAll(/\/processo_eletronico\/processo\/encaminhar\/(\d+)\//g)) {
      addCandidate(match[1]);
    }
    for (const match of html.matchAll(/\/processo_eletronico\/processo\/(\d+)\//g)) {
      addCandidate(match[1]);
    }
    if (candidateIds.length >= 6) break;
  }

  let fallbackMeta = null;
  for (const id of candidateIds.slice(0, 6)) {
    const html = await fetchSuapHtmlPage(`/processo_eletronico/processo/encaminhar/${id}/`);
    const meta = parseForwardPageMetadata(html);
    if (!meta) continue;
    if (meta.papeis.length) return meta;
    if (!fallbackMeta && (meta.controls.uo || meta.controls.setor)) fallbackMeta = meta;
  }
  return fallbackMeta;
}

async function loadSuapCatalogCache() {
  if (suapCatalog.cacheLoaded || !chrome?.storage?.local?.get) return;
  suapCatalog.cacheLoaded = true;
  const stored = await chrome.storage.local.get(SUAP_FORWARD_CATALOG_KEY).catch(() => ({}));
  const cached = stored?.[SUAP_FORWARD_CATALOG_KEY];
  if (!cached || typeof cached !== 'object') return;
  if (Array.isArray(cached.campuses) && cached.campuses.length) suapCatalog.campuses = cached.campuses;
  if (cached.sectorsByCampus && typeof cached.sectorsByCampus === 'object') suapCatalog.sectorsByCampus = cached.sectorsByCampus;
  if (Array.isArray(cached.papeis) && cached.papeis.length) suapCatalog.papeis = cached.papeis;
  if (cached.controls?.uo) suapCatalog.controls.uo = cached.controls.uo;
  if (cached.controls?.setor) suapCatalog.controls.setor = cached.controls.setor;
}

function saveSuapCatalogCache() {
  if (!chrome?.storage?.local?.set) return;
  const payload = {
    campuses: suapCatalog.campuses,
    sectorsByCampus: suapCatalog.sectorsByCampus,
    papeis: suapCatalog.papeis,
    controls: suapCatalog.controls,
    updatedAt: Date.now(),
  };
  void Promise.resolve(chrome.storage.local.set({ [SUAP_FORWARD_CATALOG_KEY]: payload })).catch(() => undefined);
}

function getSelectedSuapOption(select) {
  const option = select?.selectedOptions?.[0];
  const id = cleanSingleLine(option?.value);
  if (!id) return null;
  return { id, text: cleanSingleLine(option.dataset?.text || option.textContent) || id };
}

function renderCampusSelect(selectedCampus) {
  const select = forwardFields.campus;
  if (!select) return;
  const list = [...suapCatalog.campuses];
  if (selectedCampus?.id && !list.some((item) => item.id === selectedCampus.id)) {
    list.push({ id: selectedCampus.id, text: selectedCampus.text || selectedCampus.id });
    list.sort((a, b) => a.text.localeCompare(b.text, 'pt-BR'));
  }
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = list.length ? 'Escolha o campus' : 'Carregando campi do SUAP…';
  const options = [placeholder, ...list.map((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.dataset.text = item.text;
    opt.textContent = item.text;
    return opt;
  })];
  select.replaceChildren(...options);
  select.value = selectedCampus?.id || '';
}

function renderSetorSelect(campusId, selectedSetor, { loading = false } = {}) {
  const select = forwardFields.setor;
  if (!select) return;
  const uoId = cleanSingleLine(campusId);
  const entry = uoId ? suapCatalog.sectorsByCampus[uoId] : null;
  const list = entry?.items ? [...entry.items] : [];
  if (selectedSetor?.id && !list.some((item) => item.id === selectedSetor.id)) {
    list.push({ id: selectedSetor.id, text: selectedSetor.text || selectedSetor.id, label: selectedSetor.text || selectedSetor.id });
    list.sort((a, b) => a.text.localeCompare(b.text, 'pt-BR'));
  }
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Escolha o setor';
  const options = [placeholder, ...list.map((item) => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.dataset.text = item.text;
    opt.textContent = item.label || item.text;
    return opt;
  })];
  select.replaceChildren(...options);
  select.disabled = !uoId && !list.length;
  select.value = selectedSetor?.id && list.some((item) => item.id === selectedSetor.id) ? selectedSetor.id : '';
  setorCombobox.sync({ uoId, loading: loading && !list.length });
}

// Seletor de setor com pesquisa: o texto digitado filtra a lista por sigla ou nome; ao escolher,
// o setor vai para o <select id="forward-setor"> oculto, que continua sendo o valor do formulário.
const setorCombobox = (() => {
  const input = forwardFields.setorSearch;
  const listEl = forwardFields.setorOptions;
  const state = { open: false, query: '', active: -1, matches: [], uoId: '', loading: false, searching: false };
  const selectedOption = () => forwardFields.setor?.selectedOptions?.[0];
  const selectedLabel = () => (forwardFields.setor?.value ? selectedOption()?.textContent || '' : '');
  const allOptions = () => Array.from(forwardFields.setor?.options || []).filter((opt) => opt.value);

  function placeholderText() {
    if (!state.uoId) return 'Escolha um campus primeiro';
    if (state.loading) return 'Carregando setores do SUAP…';
    return 'Escolha ou pesquise o setor (ex.: DG, COFIN, DIAD)';
  }

  function renderList() {
    if (!listEl) return;
    const query = normalizeSearchText(state.query);
    state.matches = allOptions().filter((opt) => !query
      || normalizeSearchText(opt.dataset.text).includes(query)
      || normalizeSearchText(opt.textContent).includes(query));
    if (state.active >= state.matches.length) state.active = state.matches.length - 1;
    const items = state.matches.map((opt, index) => {
      const li = document.createElement('li');
      li.id = `forward-setor-option-${opt.value}`;
      li.className = `combobox-option${index === state.active ? ' is-active' : ''}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(opt.value === forwardFields.setor.value));
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      li.addEventListener('mousedown', (event) => event.preventDefault());
      li.addEventListener('click', () => choose(opt.value));
      return li;
    });
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'combobox-empty';
      empty.textContent = state.loading ? 'Carregando setores do SUAP…' : (state.searching ? 'Pesquisando no SUAP…' : 'Nenhum setor encontrado');
      items.push(empty);
    }
    listEl.replaceChildren(...items);
    const active = state.matches[state.active];
    if (active) {
      input?.setAttribute('aria-activedescendant', `forward-setor-option-${active.value}`);
      listEl.querySelector('.is-active')?.scrollIntoView?.({ block: 'nearest' });
    } else {
      input?.removeAttribute('aria-activedescendant');
    }
  }

  // Aberto, o campo fica vazio para pesquisar e o setor escolhido aparece como dica; fechado, mostra o setor.
  function setOpen(open) {
    const wasOpen = state.open;
    state.open = open && Boolean(state.uoId);
    if (listEl) listEl.hidden = !state.open;
    input?.setAttribute('aria-expanded', String(state.open));
    if (state.open && !wasOpen && input) {
      input.value = state.query;
      input.placeholder = selectedLabel() || placeholderText();
    }
    if (!state.open && input) input.placeholder = placeholderText();
    if (state.open) renderList();
  }

  function showSelected() {
    if (input && !state.open) input.value = selectedLabel();
  }

  function choose(value) {
    if (!forwardFields.setor) return;
    forwardFields.setor.value = value;
    state.query = '';
    state.active = -1;
    setOpen(false);
    showSelected();
    forwardFields.setor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function sync({ uoId = state.uoId, loading = false } = {}) {
    if (uoId !== state.uoId) state.query = '';
    state.uoId = uoId;
    state.loading = loading;
    if (input) {
      input.disabled = !uoId;
      input.placeholder = state.open ? selectedLabel() || placeholderText() : placeholderText();
    }
    if (state.open) renderList();
    else showSelected();
  }

  // Pesquisa no SUAP em andamento: a lista avisa em vez de dizer que nada foi encontrado.
  function setSearching(searching) {
    state.searching = searching;
    if (state.open) renderList();
  }

  function reset() {
    state.query = '';
    state.active = -1;
    setOpen(false);
    showSelected();
  }

  function openFresh() {
    if (state.open) return;
    state.query = '';
    state.active = Math.max(0, allOptions().findIndex((opt) => opt.value === forwardFields.setor.value));
    setOpen(true);
  }
  input?.addEventListener('focus', openFresh);
  input?.addEventListener('mousedown', () => { if (document.activeElement === input) openFresh(); });
  input?.addEventListener('input', () => {
    state.query = input.value;
    state.active = 0;
    setOpen(true);
    handleForwardSetorSearch(state.query);
  });
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!state.open) setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      state.active = Math.min(state.matches.length - 1, Math.max(0, state.active + step));
      renderList();
    } else if (event.key === 'Enter') {
      if (!state.open) return;
      event.preventDefault();
      const active = state.matches[state.active] || (state.matches.length === 1 ? state.matches[0] : null);
      if (active) choose(active.value);
    } else if (event.key === 'Escape' && state.open) {
      event.preventDefault();
      reset();
    }
  });
  input?.addEventListener('blur', reset);

  return { sync, reset, choose, setSearching };
})();

function renderPapelSelect(selectedPapel) {
  const select = forwardFields.papel;
  if (!select) return;
  const known = new Set(suapCatalog.papeis);
  for (const shortcut of userPreferences?.forwardShortcuts || []) {
    if (shortcut.papel) known.add(shortcut.papel);
  }
  if (selectedPapel) known.add(selectedPapel);
  const list = Array.from(known).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Não preencher automaticamente';
  const options = [placeholder, ...list.map((papel) => {
    const opt = document.createElement('option');
    opt.value = papel;
    opt.textContent = papel;
    return opt;
  })];
  select.replaceChildren(...options);
  select.value = selectedPapel || '';
}

function summarizeSuapCatalogStatus(campusId) {
  const parts = [];
  if (suapCatalog.campuses.length) parts.push(`${suapCatalog.campuses.length} campi`);
  const sectorEntry = campusId ? suapCatalog.sectorsByCampus[campusId] : null;
  if (sectorEntry?.items?.length) {
    parts.push(`${sectorEntry.total || sectorEntry.items.length} setores`);
  }
  if (suapCatalog.papeis.length) parts.push(`${suapCatalog.papeis.length} perfis`);
  if (!parts.length) return 'Listas carregadas direto do SUAP.';
  if (!suapCatalog.papeis.length) {
    return `Listas do SUAP (${parts.join(' · ')}). Para carregar seus perfis, abra um processo para encaminhar no SUAP e clique em “Atualizar do SUAP”.`;
  }
  return `Listas carregadas do SUAP (${parts.join(' · ')}).`;
}

async function loadSectorsForCampus(campusId, { force = false, query = '' } = {}) {
  const uoId = cleanSingleLine(campusId);
  if (!/^\d+$/.test(uoId)) return;
  const existing = suapCatalog.sectorsByCampus[uoId];
  if (!force && !query && existing?.items?.length) {
    renderSetorSelect(uoId, getSelectedSuapOption(forwardFields.setor));
    return;
  }
  const requestId = ++setorLoadRequest;
  const selectedSetor = getSelectedSuapOption(forwardFields.setor);
  if (!existing?.items?.length && !query) {
    renderSetorSelect(uoId, selectedSetor, { loading: true });
  }
  try {
    const result = await fetchSuapSectors(uoId, { query });
    if (requestId !== setorLoadRequest || cleanSingleLine(forwardFields.campus?.value) !== uoId) return;
    if (query) {
      const merged = mergeSuapSectors(existing?.items || [], result.items);
      suapCatalog.sectorsByCampus[uoId] = {
        items: merged,
        total: Math.max(existing?.total || 0, result.total || merged.length),
        complete: Boolean(existing?.complete),
      };
    } else {
      suapCatalog.sectorsByCampus[uoId] = result;
    }
    saveSuapCatalogCache();
    renderSetorSelect(uoId, getSelectedSuapOption(forwardFields.setor) || selectedSetor);
    if (forwardCatalogStatus && !forwardCatalogStatus.dataset.error?.includes('true')) {
      setFormMessage(forwardCatalogStatus, summarizeSuapCatalogStatus(uoId));
    }
  } catch (error) {
    if (requestId !== setorLoadRequest) return;
    renderSetorSelect(uoId, selectedSetor);
    setFormMessage(forwardCatalogStatus, formatExtensionAuthError(error), true);
  }
}

async function refreshSuapCatalog({ force = false, campusId = '' } = {}) {
  const requestId = ++forwardCatalogRequest;
  await loadSuapCatalogCache();
  if (requestId !== forwardCatalogRequest) return;

  const activeCampus = getSelectedSuapOption(forwardFields.campus);
  const activeSetor = getSelectedSuapOption(forwardFields.setor);
  const activePapel = forwardFields.papel?.value || '';
  const targetCampusId = cleanSingleLine(campusId || activeCampus?.id);

  renderCampusSelect(activeCampus);
  renderSetorSelect(targetCampusId, activeSetor, {
    loading: Boolean(targetCampusId && !suapCatalog.sectorsByCampus[targetCampusId]?.items?.length),
  });
  renderPapelSelect(activePapel);

  if (!force && suapCatalog.refreshedOnce && suapCatalog.campuses.length) {
    setFormMessage(forwardCatalogStatus, summarizeSuapCatalogStatus(targetCampusId));
    if (targetCampusId && !suapCatalog.sectorsByCampus[targetCampusId]?.items?.length) {
      await loadSectorsForCampus(targetCampusId);
    }
    return;
  }

  if (forwardRefreshButton) forwardRefreshButton.disabled = true;
  setFormMessage(forwardCatalogStatus, 'Carregando listas do SUAP…');

  try {
    const [campusesResult, sectorsResult, metaResult] = await Promise.allSettled([
      fetchSuapCampuses(suapCatalog.controls.uo),
      targetCampusId ? fetchSuapSectors(targetCampusId, { control: suapCatalog.controls.setor }) : Promise.resolve(null),
      fetchSuapPapeisAndControls(),
    ]);
    if (requestId !== forwardCatalogRequest) return;

    let controlsChanged = false;
    if (metaResult.status === 'fulfilled' && metaResult.value) {
      if (metaResult.value.papeis?.length) suapCatalog.papeis = metaResult.value.papeis;
      if (metaResult.value.controls?.uo && metaResult.value.controls.uo !== suapCatalog.controls.uo) {
        suapCatalog.controls.uo = metaResult.value.controls.uo;
        controlsChanged = true;
      }
      if (metaResult.value.controls?.setor && metaResult.value.controls.setor !== suapCatalog.controls.setor) {
        suapCatalog.controls.setor = metaResult.value.controls.setor;
        controlsChanged = true;
      }
    }

    let finalCampuses = campusesResult;
    if (controlsChanged && (finalCampuses.status === 'rejected' || !finalCampuses.value?.length)) {
      finalCampuses = await Promise.allSettled([fetchSuapCampuses(suapCatalog.controls.uo)]).then((r) => r[0]);
      if (requestId !== forwardCatalogRequest) return;
    }
    if (finalCampuses.status === 'fulfilled' && finalCampuses.value?.length) {
      suapCatalog.campuses = finalCampuses.value;
    }

    let finalSectors = sectorsResult;
    if (targetCampusId && controlsChanged && (finalSectors.status === 'rejected' || !finalSectors.value?.items?.length)) {
      finalSectors = await Promise.allSettled([fetchSuapSectors(targetCampusId, { control: suapCatalog.controls.setor })]).then((r) => r[0]);
      if (requestId !== forwardCatalogRequest) return;
    }
    if (targetCampusId && finalSectors.status === 'fulfilled' && finalSectors.value) {
      suapCatalog.sectorsByCampus[targetCampusId] = finalSectors.value;
    }

    const currentCampus = getSelectedSuapOption(forwardFields.campus) || activeCampus;
    const currentSetor = getSelectedSuapOption(forwardFields.setor) || activeSetor;
    const currentPapel = forwardFields.papel?.value || activePapel;
    renderCampusSelect(currentCampus);
    renderSetorSelect(currentCampus?.id || targetCampusId, currentSetor);
    renderPapelSelect(currentPapel);

    const errors = [finalCampuses, finalSectors, metaResult]
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    const loginError = errors.find((err) => err?.code === 'SUAP_LOGIN_REQUIRED');

    if (suapCatalog.campuses.length) {
      suapCatalog.refreshedOnce = true;
      saveSuapCatalogCache();
      setFormMessage(forwardCatalogStatus, summarizeSuapCatalogStatus(currentCampus?.id || targetCampusId));
    } else if (loginError) {
      setFormMessage(forwardCatalogStatus, loginError.message, true);
    } else if (errors[0]) {
      setFormMessage(forwardCatalogStatus, formatExtensionAuthError(errors[0]), true);
    } else {
      setFormMessage(forwardCatalogStatus, 'Nenhuma opção retornada pelo SUAP. Verifique sua sessão e tente novamente.', true);
    }
  } finally {
    if (requestId === forwardCatalogRequest && forwardRefreshButton) forwardRefreshButton.disabled = false;
  }
}

function setFormMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.dataset.error = String(isError);
}

function describeForwardDestination(item) {
  const parts = [`Para ${item.setor?.text || '—'}`];
  if (item.campus?.text) parts.push(`campus ${item.campus.text}`);
  if (item.papel) parts.push(`perfil ${item.papel}`);
  return parts.join(' · ');
}

// Linhas dos atalhos nos três submenus de "Modelos e preenchimentos": uma linha por atalho,
// com Editar e Excluir; o formulário de criação e edição abre abaixo da lista.
const ROW_ICONS = {
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  remove: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  restore: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
};

function createRowButton(kind, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = kind === 'remove' ? 'icon-button danger' : 'icon-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = ROW_ICONS[kind];
  button.addEventListener('click', onClick);
  return button;
}

function createShortcutRow({ shortcut, name, meta, editing, onEdit, onRemove, secondaryAction = null }) {
  const row = document.createElement('div');
  row.className = `shortcut-row${editing ? ' is-editing' : ''}`;
  row.dataset.shortcut = shortcut;
  row.title = `${shortcut} · ${name}${meta ? ` · ${meta}` : ''}`;
  const trigger = document.createElement('span');
  trigger.className = 'snippet-trigger';
  trigger.textContent = shortcut;
  const nameEl = document.createElement('span');
  nameEl.className = 'shortcut-name';
  nameEl.textContent = name;
  nameEl.title = name;
  const metaEl = document.createElement('span');
  metaEl.className = 'shortcut-meta';
  metaEl.textContent = meta;
  metaEl.title = meta;
  const actions = document.createElement('div');
  actions.className = 'row-actions';
  // Modelos fixos (despacho do SIAGES) trocam Excluir por Restaurar padrão.
  const second = secondaryAction
    ? createRowButton(secondaryAction.kind, secondaryAction.label, secondaryAction.onClick)
    : createRowButton('remove', `Excluir ${shortcut}`, onRemove);
  if (secondaryAction?.disabled) second.disabled = true;
  actions.append(createRowButton('edit', `Editar ${secondaryAction?.name || shortcut}`, onEdit), second);
  row.append(trigger, nameEl, metaEl, actions);
  return row;
}

// Lista de atalhos de um submenu: criar, editar (atalho e nome inclusive), excluir e desfazer.
// O atalho é único entre as três listas (user-preferences.js valida contra todas).
function createShortcutListController(config) {
  const state = { editingIndex: -1, lastRemoved: null };
  const items = () => userPreferences?.[config.key] || [];
  const othersFor = (index) => preferencesApi.allShortcuts(userPreferences)
    .filter((entry) => !(entry.kind === config.kind && entry.index === index));

  function render() {
    if (!config.listEl || !userPreferences) return;
    const editorOpen = config.editorEl && !config.editorEl.hidden;
    const rows = items().map((item, index) => createShortcutRow({
      shortcut: item.shortcut,
      name: config.title(item),
      meta: config.meta(item, index),
      editing: editorOpen && index === state.editingIndex,
      onEdit: () => open(index),
      onRemove: () => { void remove(index); },
    }));
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'helper';
      empty.textContent = config.emptyText;
      // Lista esvaziada pelo servidor: um clique traz de volta o atalho inicial (encdg, up).
      if (config.defaultShortcut) {
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'link-button';
        restore.textContent = `Restaurar o atalho padrão ${config.defaultShortcut}`;
        restore.addEventListener('click', () => { void restoreDefault(); });
        empty.append(' ', restore);
      }
      rows.push(empty);
    }
    config.listEl.replaceChildren(...rows);
    if (config.newButton) config.newButton.disabled = items().length >= config.max;
  }

  function open(index) {
    state.editingIndex = index;
    const editing = index >= 0 ? items()[index] : null;
    const item = editing || config.blank();
    config.fill(item);
    config.editorTitleEl.textContent = editing ? `Editar atalho ${editing.shortcut}` : config.newTitle;
    setFormMessage(config.formMessageEl, '');
    config.editorEl.hidden = false;
    config.onOpen?.(item);
    render();
    config.editorEl.scrollIntoView?.({ block: 'nearest' });
    config.fields.shortcut.focus();
  }

  function close() {
    state.editingIndex = -1;
    config.onClose?.();
    config.formEl.reset();
    setFormMessage(config.formMessageEl, '');
    config.editorEl.hidden = true;
    render();
  }

  async function save(event) {
    event.preventDefault();
    const item = config.read();
    const error = config.validate(item, othersFor(state.editingIndex));
    if (error) {
      setFormMessage(config.formMessageEl, error, true);
      return;
    }
    const list = [...items()];
    if (state.editingIndex >= 0) list[state.editingIndex] = item;
    else list.push(item);
    try {
      await persistPreferences({ ...userPreferences, [config.key]: list });
      close();
      state.lastRemoved = null;
      if (config.undoButton) config.undoButton.hidden = true;
      setFormMessage(config.messageEl, config.savedMessage(item));
    } catch (saveError) {
      setFormMessage(config.formMessageEl, formatExtensionAuthError(saveError), true);
    }
  }

  async function remove(index) {
    const removed = items()[index];
    if (!removed) return;
    try {
      await persistPreferences({ ...userPreferences, [config.key]: items().filter((_, position) => position !== index) });
      if (state.editingIndex === index) close();
      else if (state.editingIndex > index) {
        state.editingIndex -= 1;
        render();
      }
      state.lastRemoved = { item: removed, index };
      if (config.undoButton) config.undoButton.hidden = false;
      setFormMessage(config.messageEl, `Atalho ${removed.shortcut} excluído.`);
    } catch (removeError) {
      setFormMessage(config.messageEl, formatExtensionAuthError(removeError), true);
    }
  }

  async function restoreDefault() {
    let item;
    try {
      item = await config.defaultItem();
    } catch (resolveError) {
      setFormMessage(config.messageEl, formatExtensionAuthError(resolveError), true);
      return;
    }
    const error = config.validate(item, preferencesApi.allShortcuts(userPreferences));
    if (error) {
      setFormMessage(config.messageEl, `Não foi possível restaurar ${item.shortcut}: ${error}`, true);
      return;
    }
    try {
      await persistPreferences({ ...userPreferences, [config.key]: [...items(), item] });
      setFormMessage(config.messageEl, `Atalho ${item.shortcut} restaurado.`);
    } catch (restoreError) {
      setFormMessage(config.messageEl, formatExtensionAuthError(restoreError), true);
    }
  }

  async function undo() {
    if (!state.lastRemoved) return;
    const { item, index } = state.lastRemoved;
    if (config.validate(item, preferencesApi.allShortcuts(userPreferences))) {
      setFormMessage(config.messageEl, `Não foi possível restaurar ${item.shortcut}: o atalho já está em uso.`, true);
      return;
    }
    const list = [...items()];
    const position = Math.min(index, list.length);
    list.splice(position, 0, item);
    try {
      await persistPreferences({ ...userPreferences, [config.key]: list });
      if (state.editingIndex >= position) {
        state.editingIndex += 1;
        render();
      }
      state.lastRemoved = null;
      if (config.undoButton) config.undoButton.hidden = true;
      setFormMessage(config.messageEl, `Atalho ${item.shortcut} restaurado.`);
    } catch (undoError) {
      setFormMessage(config.messageEl, formatExtensionAuthError(undoError), true);
    }
  }

  config.newButton?.addEventListener('click', () => open(-1));
  config.formEl?.addEventListener('submit', (event) => { void save(event); });
  config.cancelButton?.addEventListener('click', close);
  config.undoButton?.addEventListener('click', () => { void undo(); });
  return { render, open, close };
}

function readForwardForm() {
  return preferencesApi.normalizeForwardShortcut({
    shortcut: forwardFields.shortcut.value,
    title: forwardFields.title.value,
    despacho: forwardFields.despacho.value,
    campus: getSelectedSuapOption(forwardFields.campus),
    setor: getSelectedSuapOption(forwardFields.setor),
    papel: forwardFields.papel.value,
  });
}

const forwardShortcutList = createShortcutListController({
  kind: 'forward',
  key: 'forwardShortcuts',
  max: preferencesApi?.MAX_FORWARD_SHORTCUTS || 15,
  listEl: forwardListEl,
  newButton: forwardNewButton,
  messageEl: forwardMessage,
  undoButton: forwardUndoButton,
  editorEl: forwardEditor,
  editorTitleEl: forwardEditorTitle,
  formEl: forwardForm,
  formMessageEl: forwardFormMessage,
  cancelButton: document.getElementById('btn-forward-cancel'),
  fields: forwardFields,
  newTitle: 'Novo atalho de encaminhamento',
  emptyText: 'Nenhum atalho de encaminhamento. Use o botão + para criar um.',
  defaultShortcut: 'encdg',
  defaultItem: () => resolveCampusDefaultForward({ required: true }),
  title: (item) => preferencesApi.forwardTitle(item),
  meta: (item) => describeForwardDestination(item),
  // Num atalho novo, campus e perfil costumam ser os mesmos do primeiro atalho.
  blank: () => {
    const base = userPreferences.forwardShortcuts[0];
    return { shortcut: '', title: '', despacho: '', campus: base?.campus || null, setor: null, papel: base?.papel || '' };
  },
  fill: (item) => {
    forwardFields.shortcut.value = item.shortcut;
    forwardFields.title.value = item.title;
    forwardFields.despacho.value = item.despacho;
    setorCombobox.reset();
    renderCampusSelect(item.campus);
    renderSetorSelect(item.campus?.id || '', item.setor, {
      loading: Boolean(item.campus?.id && !suapCatalog.sectorsByCampus[item.campus.id]?.items?.length),
    });
    renderPapelSelect(item.papel);
  },
  onOpen: (item) => { void refreshSuapCatalog({ campusId: item.campus?.id || '' }); },
  onClose: () => {
    forwardCatalogRequest += 1;
    setorLoadRequest += 1;
    if (setorSearchTimer) {
      clearTimeout(setorSearchTimer);
      setorSearchTimer = null;
    }
  },
  read: readForwardForm,
  validate: (item, others) => preferencesApi.validateForwardShortcut(item, others),
  savedMessage: (item) => `Atalho ${item.shortcut} salvo. Na paleta, use “${item.shortcut} <ID do processo>”.`,
});

const uploadShortcutList = createShortcutListController({
  kind: 'upload',
  key: 'uploadShortcuts',
  max: preferencesApi?.MAX_UPLOAD_SHORTCUTS || 15,
  listEl: document.getElementById('upload-list'),
  newButton: document.getElementById('btn-upload-new'),
  messageEl: document.getElementById('upload-message'),
  undoButton: document.getElementById('btn-upload-undo'),
  editorEl: document.getElementById('upload-editor'),
  editorTitleEl: document.getElementById('upload-editor-title'),
  formEl: document.getElementById('upload-form'),
  formMessageEl: document.getElementById('upload-form-message'),
  cancelButton: document.getElementById('btn-upload-cancel'),
  fields: uploadFields,
  newTitle: 'Novo atalho de upload',
  emptyText: 'Nenhum atalho de upload. Sem atalhos, “upload <processo>” abre o upload com os valores padrão do SUAP.',
  defaultShortcut: 'up',
  defaultItem: async () => preferencesApi.cloneDefaultUpload(),
  title: (item) => preferencesApi.uploadTitle(item),
  meta: (item, index) => [
    index === 0 ? 'Padrão' : '',
    item.tipoDocumento,
    item.tipoConferencia,
    item.assunto ? `assunto ${item.assunto}` : '',
  ].filter(Boolean).join(' · '),
  blank: () => ({ shortcut: '', title: '', ...preferencesApi.DEFAULT_UPLOAD }),
  fill: (item) => {
    for (const [key, input] of Object.entries(uploadFields)) if (input) input.value = item[key] || '';
  },
  read: () => preferencesApi.normalizeUploadShortcut(readFields(uploadFields)),
  validate: (item, others) => preferencesApi.validateUploadShortcut(item, others),
  savedMessage: (item) => `Atalho ${item.shortcut} salvo. Na paleta, use “${item.shortcut} <ID do processo>”.`,
});

const documentShortcutList = createShortcutListController({
  kind: 'document',
  key: 'documentShortcuts',
  max: preferencesApi?.MAX_DOCUMENT_SHORTCUTS || 15,
  listEl: document.getElementById('document-list'),
  newButton: document.getElementById('btn-document-new'),
  messageEl: document.getElementById('document-message'),
  undoButton: document.getElementById('btn-document-undo'),
  editorEl: document.getElementById('document-editor'),
  editorTitleEl: document.getElementById('document-editor-title'),
  formEl: document.getElementById('document-form'),
  formMessageEl: documentFormMessage,
  cancelButton: document.getElementById('btn-document-cancel'),
  fields: documentFields,
  newTitle: 'Novo atalho de documento',
  emptyText: 'Nenhum atalho de documento. Use o botão + e informe o documento do SUAP que serve de modelo.',
  title: (item) => preferencesApi.documentTitle(item),
  meta: (item) => `Modelo #${item.templateId} · ${item.assunto}`,
  blank: () => ({ shortcut: '', title: '', templateId: '', assunto: '', texto: '' }),
  fill: (item) => {
    for (const [key, input] of Object.entries(documentFields)) if (input) input.value = item[key] || '';
  },
  read: () => preferencesApi.normalizeDocumentShortcut(readFields(documentFields)),
  validate: (item, others) => preferencesApi.validateDocumentShortcut(item, others),
  savedMessage: (item) => `Atalho ${item.shortcut} salvo. Na paleta, digite “${item.shortcut}” para criar o documento.`,
});

function renderShortcutLists() {
  forwardShortcutList.render();
  uploadShortcutList.render();
  documentShortcutList.render();
}

// encdg padrão para o campus vinculado em "Sua conta": a sigla vem da UASG e os IDs do campus e
// do setor DG/<sigla> vêm das listas do SUAP, com a sessão do servidor no navegador.
async function getConfiguredCampusUasg() {
  try {
    if (typeof globalThis.SiagesExtensionAuth?.getCampus === 'function') {
      const uasg = await globalThis.SiagesExtensionAuth.getCampus();
      if (uasg) return String(uasg);
    }
  } catch (_) { /* usa o valor salvo abaixo */ }
  const stored = await Promise.resolve(chrome?.storage?.local?.get?.('siages-user-campus-uasg')).catch(() => null);
  return String(stored?.['siages-user-campus-uasg'] || extensionUserCampusSelect?.value || '158366');
}

async function resolveCampusDefaultForward({ required = false, uasg = '' } = {}) {
  const campusUasg = uasg || await getConfiguredCampusUasg();
  const sigla = preferencesApi.campusSiglaForUasg(campusUasg);
  if (!sigla) {
    if (required) throw new Error('O campus vinculado em “Sua conta” não tem Direção-Geral própria. Crie o atalho com o botão +.');
    return null;
  }
  const fallback = preferencesApi.cloneDefaultForward();
  if (fallback.campus?.text === sigla) return fallback;
  const campuses = suapCatalog.campuses.length ? suapCatalog.campuses : await fetchSuapCampuses();
  const campus = campuses.find((item) => item.text.toUpperCase() === sigla);
  const setorText = `DG/${sigla}`;
  const sectors = campus ? await fetchSuapSectors(campus.id, { query: setorText }) : { items: [] };
  const setor = sectors.items.find((item) => item.text.toUpperCase() === setorText);
  if (!campus || !setor) {
    if (required) throw new Error(`Não encontrei o setor ${setorText} no SUAP. Crie o atalho com o botão +.`);
    return null;
  }
  return preferencesApi.campusDefaultForward({ id: campus.id, text: campus.text }, { id: setor.id, text: setor.text });
}

// Mantém o encdg de fábrica apontando para a DG do campus configurado. Atalho editado pelo servidor
// (nome, despacho ou destino diferentes) não é alterado.
let campusDefaultRequest = null;
function applyCampusDefaultForward(uasg = '') {
  if (!preferencesApi || !userPreferences) return Promise.resolve();
  if (campusDefaultRequest) return campusDefaultRequest;
  campusDefaultRequest = (async () => {
    const index = userPreferences.forwardShortcuts.findIndex((item) => preferencesApi.isCampusDefaultForward(item));
    if (index < 0) return;
    const current = userPreferences.forwardShortcuts[index];
    const campusUasg = uasg || await getConfiguredCampusUasg();
    const sigla = preferencesApi.campusSiglaForUasg(campusUasg);
    if (!sigla || current.campus?.text === sigla) return;
    const next = await resolveCampusDefaultForward({ uasg: campusUasg }).catch(() => null);
    if (!next) return;
    const latest = userPreferences.forwardShortcuts;
    if (!preferencesApi.isCampusDefaultForward(latest[index])) return;
    const list = [...latest];
    list[index] = { ...next, papel: current.papel };
    await persistPreferences({ ...userPreferences, forwardShortcuts: list });
    setFormMessage(forwardMessage, `Atalho encdg atualizado para a Direção-Geral do seu campus (${next.setor.text}).`);
  })().catch(() => undefined).finally(() => { campusDefaultRequest = null; });
  return campusDefaultRequest;
}

// O ID do documento modelo vem da aba aberta, quando ela mostra um documento do SUAP.
async function captureDocumentTemplate() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const match = String(tab?.url || '').match(SUAP_DOCUMENT_PAGE_REGEX);
    if (!match) {
      setFormMessage(documentFormMessage, 'Abra no SUAP o documento que servirá de modelo e tente de novo.', true);
      return;
    }
    documentFields.templateId.value = match[1];
    setFormMessage(documentFormMessage, `Documento #${match[1]} copiado da aba aberta.`);
  } catch (error) {
    setFormMessage(documentFormMessage, formatExtensionAuthError(error), true);
  }
}

// Despachos de liquidação do SIAGES: uma linha por finalidade, com o texto completo editável e variáveis.
function despachoModeloInfo(id) {
  return preferencesApi.DESPACHO_MODELOS.find((modelo) => modelo.id === id);
}

function renderDespachoModels() {
  if (!despachoListEl || !userPreferences) return;
  const editorOpen = despachoEditor && !despachoEditor.hidden;
  despachoListEl.replaceChildren(...preferencesApi.DESPACHO_MODELOS.map((modelo) => {
    const customized = preferencesApi.isDespachoCustomized(userPreferences, modelo.id);
    const corpo = preferencesApi.despachoTemplate(userPreferences, modelo.id).corpo.replace(/\s+/g, ' ');
    return createShortcutRow({
      shortcut: modelo.code,
      name: modelo.label,
      meta: `${customized ? 'Personalizado' : 'Padrão do SIAGES'} · ${corpo}`,
      editing: editorOpen && despachoEditing === modelo.id,
      onEdit: () => openDespachoEditor(modelo.id),
      secondaryAction: {
        kind: 'restore',
        name: `despacho ${modelo.label}`,
        label: `Restaurar o padrão do despacho ${modelo.label}`,
        disabled: !customized,
        onClick: () => { void restoreDespachoModel(modelo.id); },
      },
    });
  }));
}

function renderDespachoVariables() {
  if (!despachoVariablesEl || despachoVariablesEl.childElementCount) return;
  despachoVariablesEl.replaceChildren(...preferencesApi.DESPACHO_VARIABLES.map((variable) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'variable-chip';
    chip.textContent = `{${variable.name}}`;
    chip.title = variable.description;
    chip.setAttribute('aria-label', `Inserir ${variable.description.toLowerCase()}`);
    chip.addEventListener('mousedown', (event) => event.preventDefault());
    chip.addEventListener('click', () => insertDespachoVariable(`{${variable.name}}`));
    return chip;
  }));
}

// Insere a variável na posição do cursor do último campo usado (o texto, se nenhum).
function insertDespachoVariable(token) {
  const field = despachoLastField || despachoFields.corpo;
  if (!field) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.value = `${field.value.slice(0, start)}${token}${field.value.slice(end)}`;
  field.focus();
  field.setSelectionRange?.(start + token.length, start + token.length);
  despachoLastField = field;
}

function fillDespachoEditor(template) {
  for (const [key, input] of Object.entries(despachoFields)) if (input) input.value = template[key] || '';
}

function openDespachoEditor(id) {
  const modelo = despachoModeloInfo(id);
  if (!modelo || !despachoEditor) return;
  despachoEditing = id;
  renderDespachoVariables();
  fillDespachoEditor(preferencesApi.despachoTemplate(userPreferences, id));
  despachoEditorTitle.textContent = `Despacho de liquidação — ${modelo.label}`;
  setFormMessage(despachoFormMessage, '');
  despachoEditor.hidden = false;
  despachoLastField = despachoFields.corpo;
  renderDespachoModels();
  despachoEditor.scrollIntoView?.({ block: 'nearest' });
  despachoFields.corpo?.focus();
}

function closeDespachoEditor() {
  despachoEditing = '';
  despachoLastField = null;
  setFormMessage(despachoFormMessage, '');
  if (despachoEditor) despachoEditor.hidden = true;
  renderDespachoModels();
}

async function saveDespachoModel(event) {
  event.preventDefault();
  const modelo = despachoModeloInfo(despachoEditing);
  if (!modelo) return;
  const despachoModelos = { ...userPreferences.despachoModelos, [modelo.id]: readFields(despachoFields) };
  try {
    await persistPreferences({ ...userPreferences, despachoModelos });
    closeDespachoEditor();
    setFormMessage(despachoMessage, `Modelo ${modelo.label} salvo. Vale nos próximos despachos gerados no SIAGES.`);
  } catch (error) {
    setFormMessage(despachoFormMessage, formatExtensionAuthError(error), true);
  }
}

// Volta ao texto do SIAGES. Com textos comuns do formato anterior, grava o padrão só nesta finalidade.
async function restoreDespachoModel(id) {
  const modelo = despachoModeloInfo(id);
  if (!modelo) return;
  const despachoModelos = { ...userPreferences.despachoModelos };
  const legacy = Object.entries(userPreferences.despacho || {}).filter(([, value]) => value);
  if (legacy.length) {
    const defaults = preferencesApi.defaultDespachoTemplate(id);
    despachoModelos[id] = Object.fromEntries(legacy.map(([field]) => [field, defaults[field]]));
  } else {
    delete despachoModelos[id];
  }
  try {
    await persistPreferences({ ...userPreferences, despachoModelos });
    if (despachoEditing === id) fillDespachoEditor(preferencesApi.despachoTemplate(userPreferences, id));
    setFormMessage(despachoMessage, `Modelo ${modelo.label} voltou ao texto padrão do SIAGES.`);
  } catch (error) {
    setFormMessage(despachoMessage, formatExtensionAuthError(error), true);
  }
}

async function persistPreferences(next) {
  userPreferences = await preferencesApi.save(next, chrome.storage.sync);
  renderShortcutLists();
  renderDespachoModels();
  renderSummaryBlocks();
}

// Painel do processo: blocos da aba Resumo. A preferência guarda os ocultos.
const processPanelView = document.getElementById('process-panel-view');
const navProcessPanelItem = document.getElementById('nav-process-panel');
const summaryBlocksEl = document.getElementById('summary-blocks');
const summaryBlocksMessage = document.getElementById('summary-blocks-message');

function renderSummaryBlocks() {
  if (!summaryBlocksEl || !userPreferences) return;
  const hidden = new Set(userPreferences.hiddenSummaryBlocks);
  summaryBlocksEl.replaceChildren(...preferencesApi.SUMMARY_BLOCKS.map((block) => {
    const option = document.createElement('label');
    option.className = 'block-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.block = block.id;
    checkbox.checked = !hidden.has(block.id);
    const text = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = block.label;
    const description = document.createElement('small');
    description.textContent = block.description;
    text.append(name, description);
    option.append(checkbox, text);
    return option;
  }));
  const total = preferencesApi.SUMMARY_BLOCKS.length;
  setNavBadge('process-panel', hidden.size ? `${total - hidden.size}/${total}` : '', 'muted');
}

async function saveSummaryBlocks(hiddenSummaryBlocks) {
  try {
    await persistPreferences({ ...userPreferences, hiddenSummaryBlocks });
    const total = preferencesApi.SUMMARY_BLOCKS.length;
    const visible = total - userPreferences.hiddenSummaryBlocks.length;
    setFormMessage(summaryBlocksMessage, visible
      ? `Resumo atualizado: ${visible} de ${total} blocos visíveis.`
      : 'Todos os blocos ocultos. O Resumo vai mostrar um aviso para reativá-los aqui.');
  } catch (error) {
    setFormMessage(summaryBlocksMessage, formatExtensionAuthError(error), true);
    renderSummaryBlocks();
  }
}

summaryBlocksEl?.addEventListener('change', () => {
  const hidden = Array.from(summaryBlocksEl.querySelectorAll('input[type="checkbox"][data-block]'))
    .filter((checkbox) => !checkbox.checked)
    .map((checkbox) => checkbox.dataset.block);
  void saveSummaryBlocks(hidden);
});
document.getElementById('btn-summary-blocks-all')?.addEventListener('click', () => { void saveSummaryBlocks([]); });

function handleForwardCampusChange() {
  const campusId = cleanSingleLine(forwardFields.campus?.value);
  if (setorSearchTimer) {
    clearTimeout(setorSearchTimer);
    setorSearchTimer = null;
  }
  setorCombobox.reset();
  renderSetorSelect(campusId, null, {
    loading: Boolean(campusId && !suapCatalog.sectorsByCampus[campusId]?.items?.length),
  });
  if (campusId) void loadSectorsForCampus(campusId);
}

// A pesquisa sempre consulta o SUAP também (como o próprio campo de setor do SUAP): a lista sem
// pesquisa pode vir parcial, e os setores encontrados entram na lista do campus.
function handleForwardSetorSearch(query) {
  const campusId = cleanSingleLine(forwardFields.campus?.value);
  if (setorSearchTimer) {
    clearTimeout(setorSearchTimer);
    setorSearchTimer = null;
  }
  const trimmed = cleanSingleLine(query);
  if (!campusId || trimmed.length < 2) {
    setorCombobox.setSearching(false);
    return;
  }
  setorCombobox.setSearching(true);
  setorSearchTimer = setTimeout(() => {
    setorSearchTimer = null;
    void loadSectorsForCampus(campusId, { query: trimmed }).finally(() => setorCombobox.setSearching(false));
  }, 250);
}

const readFields = (fields) => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input?.value || '']));

async function initializeTemplates() {
  if (!preferencesApi || !chrome?.storage?.sync?.get) {
    // Sem o módulo ou sem armazenamento sincronizado, as seções de preferências não são oferecidas.
    [...templatesViews, navTemplatesGroup, navTemplatesItem, processPanelView, navProcessPanelItem].forEach((element) => { if (element) element.hidden = true; });
    renderSection();
    return;
  }
  userPreferences = await preferencesApi.load(chrome.storage.sync);
  renderShortcutLists();
  renderSummaryBlocks();
  renderDespachoModels();
  await applyCampusDefaultForward();
}

document.getElementById('btn-document-template-capture')?.addEventListener('click', () => { void captureDocumentTemplate(); });
forwardRefreshButton?.addEventListener('click', () => { void refreshSuapCatalog({ force: true, campusId: forwardFields.campus?.value || '' }); });
forwardFields.campus?.addEventListener('change', handleForwardCampusChange);
despachoForm?.addEventListener('submit', (event) => { void saveDespachoModel(event); });
document.getElementById('btn-despacho-cancel')?.addEventListener('click', closeDespachoEditor);
document.getElementById('btn-despacho-reset')?.addEventListener('click', () => { if (despachoEditing) void restoreDespachoModel(despachoEditing); });
Object.values(despachoFields).forEach((field) => field?.addEventListener('focus', () => { despachoLastField = field; }));
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (!preferencesApi || area !== 'sync' || !changes?.[preferencesApi.STORAGE_KEY]) return;
  // Mudança feita em outro perfil ou janela: atualiza a lista sem apagar o que está sendo digitado.
  userPreferences = preferencesApi.normalize(changes[preferencesApi.STORAGE_KEY].newValue);
  renderShortcutLists();
  renderDespachoModels();
  renderSummaryBlocks();
});
void initializeTemplates();
