(function () {
  if (window.__siagesComprasnetPredocAlertLoaded) return;
  window.__siagesComprasnetPredocAlertLoaded = true;

  const FORM_PATH = '/apropriacao/fatura-form/';
  const PAYMENT_TAB_ID = 'dados-pagamento-tab';
  const PAYMENT_PANEL_ID = 'dados-pagamento';
  const DEDUCTION_PANEL_ID = 'deducao';
  const APPROPRIATE_ID = 'btnEnviarApropriacaoSiafiDiretamente';
  const PAYMENT_CONFIRM_ID = 'btnSubmitFormSfDadosPagamento';
  const OVERLAY_ID = 'suape-comprasnet-predoc-overlay';
  const MESSAGE = 'Preencha os pré-docs antes de sair ou apropriar esta fatura.';

  let mutationObserver = null;
  let refreshTimer = null;
  let lastKnownPendingCount = 0;
  let overlay = null;
  let dialog = null;
  let pendingAction = null;
  let allowedElements = new WeakSet();
  let unloadAllowedUntil = 0;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isEditPage() {
    return location.hostname === 'contratos.comprasnet.gov.br' && location.pathname.includes(FORM_PATH);
  }

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isPaymentTabActive() {
    const tab = document.getElementById(PAYMENT_TAB_ID);
    const panel = document.getElementById(PAYMENT_PANEL_ID);
    if (!tab || !panel) return false;
    const expanded = tab.getAttribute('aria-expanded');
    if (expanded) return expanded === 'true';
    if (tab.getAttribute('aria-selected') === 'true') return true;
    const tabClass = typeof tab.className === 'string' ? tab.className : '';
    if (/(?:^|\s)(?:active|selected|show)(?:\s|$)/i.test(tabClass)) return true;
    return isVisible(panel);
  }

  function getPredocColumnIndex(table) {
    const headerRow = table.querySelector('thead tr, tr');
    if (!headerRow) return -1;
    return Array.from(headerRow.children).findIndex((cell) => /pr[eé]-doc/i.test(cleanText(cell.textContent)));
  }

  function getPredocCell(row, columnIndex) {
    const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
    return columnIndex >= 0 ? cells[columnIndex] || null : null;
  }

  function getPredocRowsFromPanel(panel) {
    if (!panel) return [];
    const rows = [];
    panel.querySelectorAll('table').forEach((table) => {
      const columnIndex = getPredocColumnIndex(table);
      if (columnIndex < 0) return;
      table.querySelectorAll('tr').forEach((row) => {
        const cells = Array.from(row.children).filter((cell) => /^(TD|TH)$/i.test(cell.tagName));
        const predocCell = getPredocCell(row, columnIndex);
        if (!predocCell || !cells.length || cells.some((cell) => cell.tagName.toLowerCase() === 'th')) return;
        if (!/pr[eé]-doc/i.test(cleanText(predocCell.textContent))) return;
        rows.push({ row, predocCell });
      });
    });
    return rows;
  }

  function getPredocRows() {
    if (!isEditPage()) return [];
    return [PAYMENT_PANEL_ID, DEDUCTION_PANEL_ID]
      .flatMap((id) => getPredocRowsFromPanel(document.getElementById(id)));
  }

  function isPredocFilledCell(cell) {
    if (!cell) return false;
    const text = cleanText(cell.textContent).toLocaleLowerCase();
    return Boolean(cell.querySelector(
      '[id*="excluir" i], [id*="remov" i], [id*="delet" i], [title*="excluir" i], [aria-label*="excluir" i], [class*="trash" i], [class*="remove" i], [class*="delete" i], .fa-trash, .fa-trash-alt, .fa-trash-can',
    )) || /[\uf1f8\uf2ed]/u.test(text);
  }

  function isPredocFilled(row) {
    return isPredocFilledCell(row?.predocCell || row);
  }

  function getPendingPredocCount() {
    return getPredocRows().filter((row) => !isPredocFilled(row)).length;
  }

  function refreshState() {
    lastKnownPendingCount = isPaymentTabActive() ? getPendingPredocCount() : 0;
  }

  function hasPendingPredocs() {
    refreshState();
    return isEditPage() && isPaymentTabActive() && lastKnownPendingCount > 0;
  }

  function getClickable(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('a, button, input[type="button"], input[type="submit"]');
  }

  function isPredocWorkflowControl(element) {
    if (!element) return false;
    if (element.closest(`#${PAYMENT_PANEL_ID} tr, #${DEDUCTION_PANEL_ID} tr`)) {
      const row = element.closest('tr');
      return getPredocRows().some((entry) => entry.row === row && entry.predocCell?.contains(element));
    }
    const dialogText = cleanText(element.closest('[role="dialog"], .modal')?.textContent).toLocaleLowerCase();
    return dialogText.includes('pré-doc') || dialogText.includes('pre-doc');
  }

  function isExtensionElement(element) {
    return Boolean(element?.closest(`#${OVERLAY_ID}`));
  }

  function isExitControl(element) {
    if (!element || isExtensionElement(element) || isPredocWorkflowControl(element)) return false;
    if (element.id === APPROPRIATE_ID || element.id === PAYMENT_CONFIRM_ID) return true;
    if (element.closest(`#${PAYMENT_TAB_ID}`)) return false;
    if (element.closest('[role="tab"], .nav-tabs, .nav-pills, .abas-alteracao-apropriacao')) return true;
    if (element.closest('a')) return true;
    return false;
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
    allowedElements.add(action.element);
    action.element.click();
  }

  function openDialog() {
    if (!overlay) return;
    refreshState();
    const count = lastKnownPendingCount;
    const countLabel = count === 1
      ? 'Há 1 favorecido ou dedução sem pré-doc preenchido.'
      : `Há ${count} favorecidos ou deduções sem pré-doc preenchido.`;
    const message = dialog?.querySelector('[data-role="message"]');
    if (message) message.textContent = `${countLabel} ${MESSAGE}`;
    overlay.hidden = false;
    dialog?.querySelector('button[data-action="stay"]')?.focus();
  }

  function ensureDialog() {
    if (overlay || !document.body) return;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.hidden = true;
    overlay.setAttribute('role', 'presentation');
    dialog = document.createElement('div');
    dialog.id = 'suape-comprasnet-predoc-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'suape-comprasnet-predoc-title');
    dialog.innerHTML = `
      <div class="suape-comprasnet-predoc-header">
        <h2 id="suape-comprasnet-predoc-title">Pré-doc pendente</h2>
      </div>
      <p class="suape-comprasnet-predoc-message" data-role="message"></p>
      <div class="suape-comprasnet-predoc-actions">
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
    if (!element || !isExitControl(element)) return;
    if (allowedElements.has(element)) {
      allowedElements.delete(element);
      return;
    }
    if (!hasPendingPredocs()) return;
    blockClick(event, element);
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
    mutationObserver.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  }

  function install() {
    if (window.top !== window || !isEditPage()) return;
    document.addEventListener('click', handleClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    startObserver();
    refreshState();
    ensureDialog();
  }

  function destroy() {
    document.removeEventListener('click', handleClick, true);
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
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  if (window.__SIAGES_COMPRASNET_PREDOC_ALERT_TEST__) {
    window.__siagesComprasnetPredocAlert = {
      getPredocRows,
      isPredocFilled,
      getPendingPredocCount,
      isPaymentTabActive,
      hasPendingPredocs,
      refreshState,
      destroy,
    };
  }
})();
