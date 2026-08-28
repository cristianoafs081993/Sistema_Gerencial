(function () {
  if (window.__suapeClickHintsLoaded) return;
  window.__suapeClickHintsLoaded = true;

  const ROOT_ID = 'suape-click-hints-root';
  const INTERACTIVE_ROLES = new Set([
    'button', 'checkbox', 'combobox', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'treeitem',
  ]);
  const NATIVE_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
  const STOP_WORDS = new Set([
    'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos',
    'o', 'os', 'ou', 'para', 'por', 'pra', 'um', 'uma', 'uns', 'umas', 'the', 'and', 'for', 'of', 'to',
  ]);
  const FORM_SELECTOR = 'input:not([type="hidden"]), select, textarea, [contenteditable="true"]';
  const CANDIDATE_SELECTOR = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
    '[contenteditable="true"]', '[onclick]', '[role]', '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  let rootEl = null;
  let statusEl = null;
  let query = '';
  let active = false;
  let hints = [];
  let hintsByElement = new Map();
  let refreshFrame = 0;
  let mutationObserver = null;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  function wordsFrom(value) {
    return normalizeText(value)
      .split(/\s+/)
      .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()));
  }

  function mnemonicFromLabel(label, element) {
    const words = wordsFrom(label);
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`;
    if (words.length === 1) return words[0].slice(0, 2).padEnd(2, words[0][0]);
    if (element?.tagName === 'INPUT') return 'CP';
    if (element?.tagName === 'SELECT') return 'SL';
    if (element?.tagName === 'TEXTAREA' || element?.isContentEditable) return 'TX';
    if (element?.tagName === 'A') return 'LK';
    return 'BT';
  }

  function getDirectText(element) {
    const text = element.innerText || element.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function getAssociatedLabelText(element) {
    const labels = Array.from(element.labels || []);
    const fromLabels = labels.map(getDirectText).find(Boolean);
    if (fromLabels) return fromLabels;

    const id = element.getAttribute('id');
    if (id) {
      const explicit = document.querySelector(`label[for="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')}"]`);
      const explicitText = explicit ? getDirectText(explicit) : '';
      if (explicitText) return explicitText;
    }

    const wrappingLabel = element.closest('label');
    return wrappingLabel ? getDirectText(wrappingLabel) : '';
  }

  function getVisibleLabel(element) {
    const directText = getDirectText(element);
    if (directText) return directText;

    if (element instanceof HTMLInputElement && ['button', 'image', 'reset', 'submit'].includes(element.type) && element.value) {
      return element.value;
    }

    const labelText = getAssociatedLabelText(element);
    if (labelText) return labelText;

    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    return element.getAttribute('aria-label') || element.getAttribute('title') || '';
  }

  function isDisabled(element) {
    return element.matches(':disabled')
      || element.getAttribute('aria-disabled') === 'true'
      || element.closest('[inert]') !== null;
  }

  function isRendered(element) {
    if (!element.isConnected || element.hidden || element.closest('[hidden], [aria-hidden="true"]')) return false;
    const styles = window.getComputedStyle(element);
    if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isInteractiveRole(element) {
    const role = (element.getAttribute('role') || '').toLowerCase();
    return INTERACTIVE_ROLES.has(role);
  }

  function hasPointerCursor(element) {
    return window.getComputedStyle(element).cursor === 'pointer';
  }

  function isCandidate(element) {
    if (!(element instanceof HTMLElement) || element.closest(`#${ROOT_ID}`)) return false;
    if (isDisabled(element) || !isRendered(element)) return false;
    return NATIVE_TAGS.has(element.tagName)
      || element.isContentEditable
      || element.hasAttribute('onclick')
      || isInteractiveRole(element)
      || (element.hasAttribute('tabindex') && element.tabIndex >= 0)
      || hasPointerCursor(element);
  }

  function isSpecificControl(element) {
    return NATIVE_TAGS.has(element.tagName)
      || element.isContentEditable
      || isInteractiveRole(element)
      || (element.hasAttribute('tabindex') && element.tabIndex >= 0);
  }

  function hasMoreSpecificDescendant(element, candidates) {
    if (isSpecificControl(element)) return false;
    return candidates.some((candidate) => candidate !== element && element.contains(candidate) && isSpecificControl(candidate));
  }

  function compareByScreenPosition(left, right) {
    const leftRect = left.element.getBoundingClientRect();
    const rightRect = right.element.getBoundingClientRect();
    const topDifference = leftRect.top - rightRect.top;
    if (Math.abs(topDifference) > 4) return topDifference;
    const leftDifference = leftRect.left - rightRect.left;
    if (Math.abs(leftDifference) > 4) return leftDifference;
    return left.order - right.order;
  }

  function getDocumentCandidates() {
    const elements = new Set(document.querySelectorAll(CANDIDATE_SELECTOR));
    document.querySelectorAll('*').forEach((element) => {
      if (element instanceof HTMLElement && hasPointerCursor(element)) elements.add(element);
    });

    const candidates = Array.from(elements)
      .filter((element) => isCandidate(element))
      .filter((element, _, all) => !hasMoreSpecificDescendant(element, all));

    return candidates.map((element, order) => {
      const label = getVisibleLabel(element);
      return {
        element,
        label,
        baseCode: mnemonicFromLabel(label, element),
        code: '',
        order,
      };
    });
  }

  function assignInitialCodes(nextHints) {
    const groups = new Map();
    nextHints.forEach((hint) => {
      const group = groups.get(hint.baseCode) || [];
      group.push(hint);
      groups.set(hint.baseCode, group);
    });

    groups.forEach((group, baseCode) => {
      group.sort(compareByScreenPosition);
      group.forEach((hint, index) => {
        hint.code = group.length === 1 ? baseCode : `${baseCode}${index + 1}`;
      });
    });
  }

  function allocateCode(baseCode, usedCodes) {
    if (!usedCodes.has(baseCode)) return baseCode;
    let suffix = 1;
    while (usedCodes.has(`${baseCode}${suffix}`)) suffix += 1;
    return `${baseCode}${suffix}`;
  }

  function reconcileHints(preserveExisting) {
    const nextHints = getDocumentCandidates();
    if (!preserveExisting) {
      assignInitialCodes(nextHints);
      hints = nextHints;
      hintsByElement = new Map(hints.map((hint) => [hint.element, hint]));
      return;
    }

    const usedCodes = new Set();
    nextHints.forEach((hint) => {
      const previous = hintsByElement.get(hint.element);
      if (previous) {
        hint.code = previous.code;
        usedCodes.add(hint.code);
      }
    });
    nextHints.forEach((hint) => {
      if (!hint.code) {
        hint.code = allocateCode(hint.baseCode, usedCodes);
        usedCodes.add(hint.code);
      }
    });
    hints = nextHints;
    hintsByElement = new Map(hints.map((hint) => [hint.element, hint]));
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function matchesQuery(hint) {
    return !query || hint.code.startsWith(query);
  }

  function announce(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function createRoot() {
    if (rootEl) return;
    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    rootEl.hidden = true;
    rootEl.innerHTML = `
      <div class="suape-click-hints-labels" aria-hidden="true"></div>
      <div class="suape-click-hints-query" aria-hidden="true"></div>
      <div class="suape-click-hints-status" role="status" aria-live="polite"></div>
    `;
    document.documentElement.appendChild(rootEl);
    statusEl = rootEl.querySelector('.suape-click-hints-status');
  }

  function renderHints() {
    if (!rootEl || !active) return;
    const labelsEl = rootEl.querySelector('.suape-click-hints-labels');
    const queryEl = rootEl.querySelector('.suape-click-hints-query');
    labelsEl.replaceChildren();

    let visibleCount = 0;
    let matchingCount = 0;
    hints.forEach((hint) => {
      if (!isInViewport(hint.element)) return;
      visibleCount += 1;
      const matches = matchesQuery(hint);
      if (matches) matchingCount += 1;

      const rect = hint.element.getBoundingClientRect();
      const label = document.createElement('span');
      label.className = `suape-click-hint${matches ? '' : ' suape-click-hint-hidden'}`;
      label.dataset.code = hint.code;
      label.textContent = hint.code;
      label.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 52))}px`;
      label.style.top = `${Math.max(4, Math.min(rect.top - 8, window.innerHeight - 28))}px`;
      labelsEl.appendChild(label);
    });

    queryEl.textContent = query ? `${query} · Enter para abrir` : 'Digite o atalho · Esc para sair';
    if (query) {
      announce(matchingCount === 1 ? `Atalho ${query}. Um ponto correspondente.` : `Atalho ${query}. ${matchingCount} pontos correspondentes.`);
    } else {
      announce(`Modo de atalhos ativado. ${visibleCount} pontos visíveis.`);
    }
  }

  function scheduleRefresh(reconcile) {
    if (!active || refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      if (reconcile) reconcileHints(true);
      renderHints();
    });
  }

  function startObserving() {
    if (mutationObserver) return;
    mutationObserver = new MutationObserver((records) => {
      const changedPage = records.some((record) => {
        const target = record.target instanceof Element ? record.target : null;
        if (!target?.closest(`#${ROOT_ID}`)) return true;
        return Array.from(record.addedNodes).some((node) => !(node instanceof Element) || !node.closest(`#${ROOT_ID}`));
      });
      if (changedPage) scheduleRefresh(true);
    });
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'aria-disabled', 'aria-hidden', 'class', 'style'] });
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange, true);
  }

  function stopObserving() {
    mutationObserver?.disconnect();
    mutationObserver = null;
    window.removeEventListener('scroll', handleViewportChange, true);
    window.removeEventListener('resize', handleViewportChange, true);
  }

  function handleViewportChange() {
    scheduleRefresh(false);
  }

  function openHints() {
    createRoot();
    query = '';
    active = true;
    rootEl.hidden = false;
    reconcileHints(false);
    renderHints();
    startObserving();
  }

  function closeHints(message) {
    if (!active) return;
    active = false;
    query = '';
    if (refreshFrame) {
      window.cancelAnimationFrame(refreshFrame);
      refreshFrame = 0;
    }
    stopObserving();
    if (rootEl) {
      rootEl.hidden = true;
      rootEl.querySelector('.suape-click-hints-labels').replaceChildren();
    }
    announce(message || 'Modo de atalhos encerrado.');
  }

  function toggleHints() {
    if (active) closeHints('Modo de atalhos encerrado.');
    else openHints();
  }

  function activateHint(hint) {
    closeHints(`Atalho ${hint.code} selecionado.`);
    window.requestAnimationFrame(() => {
      if (!hint.element.isConnected) return;
      const inputType = hint.element instanceof HTMLInputElement ? hint.element.type : '';
      const inputIsAction = ['button', 'checkbox', 'image', 'radio', 'reset', 'submit'].includes(inputType);
      if (hint.element.matches(FORM_SELECTOR) && !inputIsAction) {
        try {
          hint.element.focus({ preventScroll: true });
        } catch {
          hint.element.focus();
        }
      } else {
        hint.element.click();
      }
    });
  }

  function handleActiveKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeHints('Modo de atalhos cancelado.');
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      query = query.slice(0, -1);
      renderHints();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const matches = hints.filter(matchesQuery);
      const exactMatches = matches.filter((hint) => hint.code === query);
      const selected = exactMatches.length === 1 ? exactMatches[0] : matches.length === 1 ? matches[0] : null;
      if (selected) activateHint(selected);
      else announce(query ? `Atalho ${query} ainda não identifica um único ponto.` : 'Digite um atalho antes de confirmar.');
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;

    const typed = normalizeText(event.key).replace(/\s+/g, '');
    if (!typed) return;
    event.preventDefault();
    event.stopPropagation();
    query += typed;
    renderHints();
  }

  document.addEventListener('keydown', (event) => {
    const isToggle = (event.ctrlKey || event.metaKey) && (event.key === 'm' || event.key === 'M' || event.code === 'KeyM');
    if (isToggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleHints();
      return;
    }
    if (active) handleActiveKeydown(event);
  }, true);
})();
