(function () {
  if (window.__siagesSiafiPredocAlertLoaded) return;
  window.__siagesSiafiPredocAlertLoaded = true;

  const FORM_ID = 'form_manterDocumentoHabil';
  const PAYMENT_TABLE_ID = `${FORM_ID}:lista_DPgtoOB`;
  const TABS_ID = `${FORM_ID}:abasDocHabil`;
  const REGISTER_ID = `${FORM_ID}:btnRegistrarAlteracaoDocumentoHabil`;
  const REGISTER_CURRENT_ID = `${FORM_ID}:btnRegistrar`;
  const CANCEL_ID = `${FORM_ID}:btnCancelarAlteracaoDocumentoHabil`;
  const SAVE_DRAFT_ID = `${FORM_ID}:salvarRascunho_botao`;
  const PAYMENT_PANEL_PREFIX = `${PAYMENT_TABLE_ID}_painel_`;
  const PAYMENT_TAB_LABEL = 'Dados de Pagamento';
  const OVERLAY_ID = 'suape-siafi-predoc-overlay';
  const MESSAGE = 'Preencha o pré-doc antes de sair ou registrar as alterações.';

  let mutationObserver = null;
  let refreshTimer = null;
  let lastKnownPendingCount = 0;
  let lastKnownCondhPage = false;
  let overlay = null;
  let dialog = null;
  let pendingAction = null;
  let allowedElements = new WeakSet();
  let allowedForms = new WeakSet();
  let unloadAllowedUntil = 0;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getForm() {
    return document.getElementById(FORM_ID);
  }

  function getPaymentTable() {
    return document.getElementById(PAYMENT_TABLE_ID);
  }

  function isVisible(element) {
    if (!element || element.hidden) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return element.offsetParent !== null || element.getClientRects().length > 0;
  }

  function isActiveTabElement(element) {
    if (!element) return false;
    if (element.getAttribute('aria-selected') === 'true' || element.getAttribute('data-active') === 'true') return true;
    const className = typeof element.className === 'string' ? element.className : '';
    return /(?:^|\s)(?:active|selected|ui-tabs-active|ui-tabs-selected|ui-state-active)(?:\s|$)/i.test(className);
  }

  function getTabTargetId(element) {
    const reference = element?.getAttribute('aria-controls') || element?.getAttribute('data-target') || element?.getAttribute('href');
    if (!reference) return null;
    const match = reference.trim().match(/^#(.+)$/);
    return match ? match[1] : null;
  }

  function isPaymentTabActive() {
    const tabs = document.getElementById(TABS_ID);
    if (!tabs) return false;

    const normalizedLabel = PAYMENT_TAB_LABEL.toLocaleLowerCase();
    const candidates = Array.from(tabs.querySelectorAll('a, button, input, li, [role="tab"]'));
    const tabLabel = candidates.find((element) => {
      const label = cleanText(element.value || element.textContent).toLocaleLowerCase();
      return label === normalizedLabel || element.id.toLocaleLowerCase().includes('dadospagamento');
    });

    if (!tabLabel) return false;

    const tabItem = tabLabel.closest('li, [role="tab"], .tab, .nav-item') || tabLabel;
    if (isActiveTabElement(tabItem) || isActiveTabElement(tabLabel)) return true;

    const targetId = getTabTargetId(tabLabel) || getTabTargetId(tabItem);
    if (targetId && isVisible(document.getElementById(targetId))) return true;

    const paymentTable = getPaymentTable();
    return Boolean(paymentTable && isVisible(paymentTable));
  }

  function isCondhEditPage() {
    return Boolean(getForm() && document.getElementById(TABS_ID));
  }

  function getPredocRows(table = getPaymentTable()) {
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).filter((row) =>
      row.querySelector('[id$=":btnPredoc"], .botaoPredoc'),
    );
  }

  function isPredocFilled(row) {
    return Boolean(row.querySelector(
      '[id$=":btnPredoc"].checked, .botaoPredoc.checked, [id$=":excluirPredoc_btn"], [title="Excluir Pré-doc"]',
    ));
  }

  function getPendingPredocCount() {
    return getPredocRows().filter((row) => !isPredocFilled(row)).length;
  }

  function refreshState() {
    const condhPage = isCondhEditPage();
    const paymentTabActive = condhPage && isPaymentTabActive();
    lastKnownCondhPage = condhPage;
    if (!paymentTabActive) {
      lastKnownPendingCount = 0;
      return;
    }

    const table = getPaymentTable();
    if (table) lastKnownPendingCount = getPendingPredocCount();
  }

  function hasPendingPredocs() {
    refreshState();
    return lastKnownCondhPage && isPaymentTabActive() && lastKnownPendingCount > 0;
  }

  function getClickable(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('a, button, input[type="button"], input[type="submit"]');
  }

  function isExtensionElement(element) {
    return Boolean(element?.closest(`#${OVERLAY_ID}`));
  }

  function isPredocControl(element) {
    return Boolean(element?.closest(`[id="${PAYMENT_TABLE_ID}"]`) && (
      element.id.endsWith(':btnPredoc') ||
      element.id.endsWith(':excluirPredoc_btn') ||
      element.title === 'Excluir Pré-doc'
    ));
  }

  function isPredocWorkflowControl(element) {
    return Boolean(element?.id?.startsWith(PAYMENT_PANEL_PREFIX) || element?.closest(`[id^="${PAYMENT_PANEL_PREFIX}"]`));
  }

  function isSafeControl(element) {
    if (!element) return true;
    if (isExtensionElement(element) || isPredocControl(element) || isPredocWorkflowControl(element)) return true;
    if (element.id === `${FORM_ID}:btnVerificarConsistencia`) return true;
    return false;
  }

  function isExitControl(element) {
    if (!element || isSafeControl(element)) return false;
    if ([REGISTER_ID, REGISTER_CURRENT_ID, CANCEL_ID, SAVE_DRAFT_ID].includes(element.id)) return true;
    if (element.closest(`[id="${TABS_ID}"]`)) return true;
    if (element.closest('a')) return true;
    return false;
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function closeDialog() {
    if (!overlay) return;
    overlay.hidden = true;
    pendingAction = null;
    dialog?.querySelector('button[data-action="stay"]')?.focus();
  }

  function continueAction() {
    const action = pendingAction;
    if (!action) return;
    pendingAction = null;
    overlay.hidden = true;
    unloadAllowedUntil = Date.now() + 5000;

    if (action.element) {
      allowedElements.add(action.element);
      action.element.click();
      return;
    }

    if (action.form) {
      allowedForms.add(action.form);
      if (typeof action.form.requestSubmit === 'function') action.form.requestSubmit(action.submitter || undefined);
    }
  }

  function openDialog() {
    if (!overlay) return;
    refreshState();
    const count = lastKnownPendingCount;
    const countLabel = count === 1 ? 'Há 1 favorecido sem pré-doc preenchido.' : `Há ${count} favorecidos sem pré-doc preenchido.`;
    const message = dialog?.querySelector('[data-role="message"]');
    if (message) message.textContent = `${countLabel} ${MESSAGE}`;
    overlay.hidden = false;
    dialog?.querySelector('button[data-action="stay"]')?.focus();
  }

  function ensureDialog() {
    if (overlay || !document.body) return;

    overlay = createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'presentation');

    dialog = createElement('div');
    dialog.id = 'suape-siafi-predoc-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'suape-siafi-predoc-title');
    dialog.innerHTML = `
      <div class="suape-siafi-predoc-header">
        <h2 id="suape-siafi-predoc-title">Pré-doc pendente</h2>
      </div>
      <p class="suape-siafi-predoc-message" data-role="message"></p>
      <div class="suape-siafi-predoc-actions">
        <button type="button" data-action="stay">Ficar e preencher</button>
        <button type="button" data-action="continue">Continuar mesmo assim</button>
      </div>
    `;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector('button[data-action="stay"]')?.addEventListener('click', closeDialog);
    dialog.querySelector('button[data-action="continue"]')?.addEventListener('click', continueAction);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeDialog();
    });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
    });
  }

  function blockClick(event, element) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    pendingAction = { element };
    ensureDialog();
    openDialog();
  }

  function handleClick(event) {
    const element = getClickable(event.target);
    if (!element || isExtensionElement(element) || !isExitControl(element)) return;
    if (allowedElements.has(element)) {
      allowedElements.delete(element);
      return;
    }
    if (!hasPendingPredocs()) return;
    blockClick(event, element);
  }

  function handleSubmit(event) {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const submitter = event.submitter;
    if (!form || !submitter || !isExitControl(submitter) || !hasPendingPredocs()) return;
    if (allowedForms.has(form)) {
      allowedForms.delete(form);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    pendingAction = { form, submitter: event.submitter };
    ensureDialog();
    openDialog();
  }

  function handleBeforeUnload(event) {
    if (Date.now() < unloadAllowedUntil || !hasPendingPredocs()) return;
    event.preventDefault();
    event.returnValue = '';
  }

  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      refreshState();
      ensureDialog();
    }, 0);
  }

  function startObserver() {
    if (mutationObserver || !document.documentElement) return;
    mutationObserver = new MutationObserver(scheduleRefresh);
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  function install() {
    if (window.top !== window) return;
    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    startObserver();
    refreshState();
    ensureDialog();
  }

  function destroy() {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('submit', handleSubmit, true);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    mutationObserver?.disconnect();
    mutationObserver = null;
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = null;
    overlay?.remove();
    overlay = null;
    dialog = null;
    pendingAction = null;
    allowedElements = new WeakSet();
    allowedForms = new WeakSet();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  if (window.__SIAGES_SIAFI_PREDOC_ALERT_TEST__) {
    window.__siagesSiafiPredocAlert = {
      FORM_ID,
      PAYMENT_TABLE_ID,
      TABS_ID,
      PAYMENT_TAB_LABEL,
      REGISTER_ID,
      REGISTER_CURRENT_ID,
      CANCEL_ID,
      SAVE_DRAFT_ID,
      getPredocRows,
      isPredocFilled,
      getPendingPredocCount,
      isPaymentTabActive,
      hasPendingPredocs,
      refreshState,
      openDialog,
      destroy,
    };
  }
})();
