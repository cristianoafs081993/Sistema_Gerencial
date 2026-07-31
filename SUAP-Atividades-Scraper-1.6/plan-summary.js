(function () {
  window.__siagesSuapPlanSummaryDispose?.();

  const PANEL_ID = 'siages-suap-plan-summary';
  const FRAME_ID = 'siages-suap-plan-summary-frame';
  const STYLE_ID = 'siages-suap-plan-summary-style';
  const SIAGES_APP_ORIGIN_STORAGE_KEY = 'siages-app-origin';
  const DEFAULT_SIAGES_APP_ORIGIN = 'https://www.siages.com.br';
  const LEGACY_SIAGES_APP_ORIGIN = 'https://sistema-gerencial-gamma.vercel.app';
  const SUAP_ORIGIN = 'https://suap.ifrn.edu.br';
  const PLAN_PATH = /^\/plan_estrategico\/plano_concluido\/8\/?$/;
  const BALANCE_LABEL = 'saldo disponivel para empenho da atividade r';
  const DIMENSION_CODES = new Set(['AD', 'AE', 'CI', 'EN', 'EX', 'GE', 'GO', 'GP', 'IE', 'IN', 'PI', 'TI']);

  const state = {
    summary: null,
    detail: null,
    hiddenState: new Map(),
    retry: null,
    cleanupRequest: null,
  };

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeText(value) {
    return cleanText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
  }

  function parseCurrency(value) {
    const cleaned = String(value || '')
      .replace(/R\$\s*/gi, '')
      .replace(/\s/g, '')
      .trim();
    if (!cleaned) return 0;

    let normalized = cleaned;
    if (cleaned.includes('.') && cleaned.includes(',')) {
      normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
      normalized = cleaned.replace(',', '.');
    }

    const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  function getDimensionCode(value) {
    const match = cleanText(value).toUpperCase().match(/\b([A-Z]{2})\b/);
    return match && DIMENSION_CODES.has(match[1]) ? match[1] : null;
  }

  function findActivityContainer(label) {
    const preferred = 'tr,[data-atividade],[class*="atividade" i],[id*="atividade" i],fieldset,article,.card,.box';
    const closestPreferred = label.closest(preferred);
    if (closestPreferred && !closestPreferred.matches('body,html')) return closestPreferred;

    let current = label.parentElement;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (current.matches('body,html,main,#content,.content,.content-body')) continue;
      const text = normalizeText(current.textContent);
      if (text.includes(BALANCE_LABEL) && text.length < 2200) return current;
    }
    return label.parentElement;
  }

  function getDimensionForElement(element) {
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,strong.legend,legend'));
    let code = null;
    headings.forEach((heading) => {
      if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
        const candidate = getDimensionCode(heading.textContent);
        if (candidate) code = candidate;
      }
    });
    return code;
  }

  function getBalanceValue(label) {
    const row = label.closest('tr,dl,.form-group,.row,.form-row,li,div,section,fieldset');
    const text = cleanText(row ? row.textContent : label.parentElement?.textContent);
    const labelText = cleanText(label.textContent);
    const remainder = text.slice(Math.max(0, text.indexOf(labelText) + labelText.length));
    const valueMatch = remainder.match(/(?:R\$\s*)?-?[\d.]+(?:,[\d]{1,2})?/);
    return parseCurrency(valueMatch ? valueMatch[0] : remainder);
  }

  function collectActivityBlocks() {
    const labels = Array.from(document.querySelectorAll('th,td,dt,dd,label,strong,b,span,p,div'))
      .filter((element) => {
        const text = normalizeText(element.textContent);
        return text === BALANCE_LABEL || (text.startsWith(BALANCE_LABEL) && text.length <= BALANCE_LABEL.length + 4);
      });
    const seen = new Set();

    return labels.map((label) => {
      const element = findActivityContainer(label);
      if (!element || seen.has(element)) return null;
      seen.add(element);
      return {
        element,
        saldo: getBalanceValue(label),
        dimensao: getDimensionForElement(element),
        texto: cleanText(element.textContent),
      };
    }).filter(Boolean);
  }

  function applyBalanceFilter(enabled) {
    const blocks = collectActivityBlocks();
    blocks.forEach((block) => {
      if (enabled) {
        if (!state.hiddenState.has(block.element)) {
          state.hiddenState.set(block.element, block.element.hidden);
        }
        block.element.hidden = block.saldo <= 0;
      } else if (state.hiddenState.has(block.element)) {
        block.element.hidden = state.hiddenState.get(block.element);
      }
    });
    if (!enabled) state.hiddenState.clear();
    return blocks;
  }

  function getStoredSiagesOrigin() {
    return new Promise((resolve) => {
      const onStored = (stored) => {
        const storedOrigin = stored?.[SIAGES_APP_ORIGIN_STORAGE_KEY];
        const candidate = storedOrigin === LEGACY_SIAGES_APP_ORIGIN
          ? DEFAULT_SIAGES_APP_ORIGIN
          : (storedOrigin || DEFAULT_SIAGES_APP_ORIGIN);
        try {
          const url = new URL(candidate);
          resolve(url.protocol === 'https:' ? url.origin : null);
        } catch {
          resolve(null);
        }
      };
      if (!window.chrome?.storage?.local?.get) {
        onStored({});
        return;
      }
      chrome.storage.local.get(SIAGES_APP_ORIGIN_STORAGE_KEY, onStored);
    });
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} { box-sizing: border-box; margin: 20px 0; border: 1px solid #cfe4d2; border-radius: 12px; background: #fff; color: #17311b; box-shadow: 0 8px 24px rgba(15, 23, 42, .08); font: 14px/1.45 Inter, Arial, sans-serif; }
      #${PANEL_ID} *, #${PANEL_ID} *::before, #${PANEL_ID} *::after { box-sizing: border-box; }
      #${PANEL_ID} .siages-plan-header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 18px; border-bottom:1px solid #e5ece6; }
      #${PANEL_ID} .siages-plan-header h2 { margin:0; font-size:17px; color:#14532d; }
      #${PANEL_ID} .siages-plan-header p { margin:3px 0 0; color:#526156; font-size:13px; }
      #${PANEL_ID} .siages-plan-switch { display:flex; align-items:center; gap:8px; min-height:32px; color:#243526; font-weight:600; cursor:pointer; }
      #${PANEL_ID} .siages-plan-switch input { width:18px; height:18px; accent-color:#177d32; cursor:pointer; }
      #${PANEL_ID} .siages-plan-status { margin:0; padding:12px 18px; color:#526156; }
      #${PANEL_ID} .siages-plan-status[role="alert"] { color:#991b1b; background:#fef2f2; }
      #${PANEL_ID} .siages-plan-retry { margin:0 18px 16px; min-height:36px; border:1px solid #177d32; border-radius:7px; padding:6px 12px; background:#fff; color:#14532d; font:inherit; font-weight:700; cursor:pointer; }
      #${PANEL_ID} .siages-plan-retry:hover { background:#f0f9f1; }
      #${PANEL_ID} .siages-plan-retry:focus-visible, #${PANEL_ID} .siages-plan-value:focus-visible, #${PANEL_ID} .siages-plan-detail-close:focus-visible { outline:3px solid #60a5fa; outline-offset:2px; }
      #${PANEL_ID} .siages-plan-table-wrap { overflow-x:auto; }
      #${PANEL_ID} table { width:100%; min-width:920px; border-collapse:collapse; }
      #${PANEL_ID} th, #${PANEL_ID} td { padding:11px 14px; border-bottom:1px solid #edf1ee; text-align:right; vertical-align:top; }
      #${PANEL_ID} th:first-child, #${PANEL_ID} td:first-child { min-width:190px; text-align:left; }
      #${PANEL_ID} th { background:#f6faf7; color:#46604b; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; white-space:nowrap; }
      #${PANEL_ID} td { font-variant-numeric:tabular-nums; }
      #${PANEL_ID} .siages-plan-value { width:100%; border:0; border-radius:5px; padding:4px; background:transparent; color:#075a21; font:inherit; font-weight:700; text-align:right; cursor:pointer; }
      #${PANEL_ID} .siages-plan-value:hover { background:#eaf7ed; text-decoration:underline; }
      #${PANEL_ID} .siages-plan-value[aria-expanded="true"] { background:#dff4e4; }
      #${PANEL_ID} .siages-plan-detail td { padding:0; text-align:left; }
      #${PANEL_ID} .siages-plan-detail-panel { padding:16px 18px 18px; background:#f8fbf8; }
      #${PANEL_ID} .siages-plan-detail-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
      #${PANEL_ID} .siages-plan-detail-heading h3 { margin:0; font-size:15px; color:#17311b; }
      #${PANEL_ID} .siages-plan-detail-heading p { margin:3px 0 0; color:#526156; }
      #${PANEL_ID} .siages-plan-detail-close { min-height:32px; border:1px solid #cbd5cf; border-radius:6px; padding:4px 10px; background:#fff; color:#29482f; font:inherit; cursor:pointer; }
      #${PANEL_ID} .siages-plan-detail-table { min-width:0; background:#fff; border:1px solid #dce8de; border-radius:8px; overflow:hidden; }
      #${PANEL_ID} .siages-plan-detail-table th, #${PANEL_ID} .siages-plan-detail-table td { padding:9px 10px; font-size:12px; }
      #${PANEL_ID} .siages-plan-empty { margin:0; color:#526156; }
      @media (max-width: 640px) { #${PANEL_ID} .siages-plan-header { align-items:flex-start; flex-direction:column; } #${PANEL_ID} .siages-plan-switch { font-size:13px; } }
    `;
    document.head.appendChild(style);
  }

  function findHost() {
    return document.querySelector('main, #content, .content-body, .content, [role="main"]') || document.body;
  }

  function ensurePanel() {
    ensureStyles();
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Resumo orçamentário do SIAGES por dimensão');
    const host = findHost();
    const heading = host.querySelector('h1');
    if (heading?.parentElement === host) heading.insertAdjacentElement('afterend', panel);
    else host.insertBefore(panel, host.firstChild);
    return panel;
  }

  function createElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function setStatus(message, isError) {
    const panel = ensurePanel();
    const status = panel.querySelector('.siages-plan-status');
    if (!status) return;
    status.textContent = message;
    if (isError) status.setAttribute('role', 'alert');
    else status.removeAttribute('role');
  }

  function getDetails(dimension, metric) {
    if (metric === 'planejado') {
      return {
        title: 'Atividades planejadas',
        total: dimension.totalPlanejado,
        columns: ['Atividade', 'Descrição', 'Componente', 'Origem', 'Valor'],
        rows: dimension.atividades.map((item) => [item.atividade, item.descricao || '-', item.componenteFuncional || '-', item.origemRecurso || '-', formatCurrency(item.valor)]),
      };
    }
    if (metric === 'descentralizado') {
      return {
        title: 'Descentralizações',
        total: dimension.totalDescentralizado,
        columns: ['Nota de crédito', 'Descrição', 'PTRES', 'Data', 'Valor'],
        rows: dimension.descentralizacoes.map((item) => [item.notaCredito || '-', item.descricao || '-', item.origemRecurso || '-', formatDate(item.dataEmissao), formatCurrency(item.valor)]),
      };
    }
    if (metric === 'empenhado') {
      return {
        title: 'Empenhos do exercício',
        total: dimension.totalEmpenhado,
        columns: ['Empenho', 'Descrição', 'PTRES', 'Data', 'Valor'],
        rows: dimension.empenhos.map((item) => [item.numero, item.descricao || '-', item.origemRecurso || '-', formatDate(item.dataEmpenho), formatCurrency(item.valor)]),
      };
    }

    const activityBlocks = collectActivityBlocks()
      .filter((item) => item.saldo > 0 && (!item.dimensao || item.dimensao === dimension.key));
    const rows = activityBlocks.map((item) => {
      const normalizedBlock = normalizeText(item.texto);
      const match = dimension.atividades.find((atividade) => normalizedBlock.includes(normalizeText(atividade.atividade)));
      return [match?.atividade || 'Atividade no SUAP', match?.descricao || '-', formatCurrency(item.saldo)];
    });
    return {
      title: 'Atividades com saldo disponível para empenho',
      total: dimension.aDescentralizar,
      columns: ['Atividade', 'Descrição', 'Saldo disponível'],
      rows,
    };
  }

  function renderDetail(row, dimension, metric) {
    const details = getDetails(dimension, metric);
    const detailRow = createElement('tr', undefined, 'siages-plan-detail');
    const cell = createElement('td');
    cell.colSpan = 6;
    const panel = createElement('div', undefined, 'siages-plan-detail-panel');
    const heading = createElement('div', undefined, 'siages-plan-detail-heading');
    const titleGroup = createElement('div');
    titleGroup.append(
      createElement('h3', `${details.title} — ${dimension.dimensao}`),
      createElement('p', `Total: ${formatCurrency(details.total)}`),
    );
    const close = createElement('button', 'Fechar', 'siages-plan-detail-close');
    close.type = 'button';
    close.addEventListener('click', () => {
      state.detail = null;
      renderSummary(state.summary);
    });
    heading.append(titleGroup, close);
    panel.appendChild(heading);

    if (details.rows.length === 0) {
      panel.appendChild(createElement('p', 'Nenhum registro encontrado para esta dimensão.', 'siages-plan-empty'));
    } else {
      const table = createElement('table', undefined, 'siages-plan-detail-table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      details.columns.forEach((column) => headRow.appendChild(createElement('th', column)));
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      details.rows.forEach((values) => {
        const itemRow = document.createElement('tr');
        values.forEach((value) => itemRow.appendChild(createElement('td', value)));
        tbody.appendChild(itemRow);
      });
      table.append(thead, tbody);
      panel.appendChild(table);
    }
    cell.appendChild(panel);
    detailRow.appendChild(cell);
    row.insertAdjacentElement('afterend', detailRow);
  }

  function renderSummary(summary) {
    state.summary = summary;
    const panel = ensurePanel();
    panel.innerHTML = '';
    const header = createElement('div', undefined, 'siages-plan-header');
    const titleGroup = createElement('div');
    titleGroup.append(
      createElement('h2', 'Resumo por dimensão'),
      createElement('p', 'Valores consolidados do SIAGES para o plano de atividades 2026.'),
    );
    const switchLabel = createElement('label', undefined, 'siages-plan-switch');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.hiddenState.size > 0;
    checkbox.addEventListener('change', () => applyBalanceFilter(checkbox.checked));
    switchLabel.append(checkbox, document.createTextNode('Somente atividades com saldo para empenho'));
    header.append(titleGroup, switchLabel);

    const status = createElement('p', summary.dimensoes.length ? '' : 'Nenhuma dimensão foi encontrada no SIAGES.', 'siages-plan-status');
    status.setAttribute('aria-live', 'polite');
    const tableWrap = createElement('div', undefined, 'siages-plan-table-wrap');
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Dimensão', 'Total planejado', 'Total descentralizado', 'A descentralizar', 'Total empenhado', 'A empenhar'].forEach((label) => {
      headRow.appendChild(createElement('th', label));
    });
    thead.appendChild(headRow);
    const tbody = document.createElement('tbody');

    summary.dimensoes.forEach((dimension) => {
      const row = document.createElement('tr');
      row.appendChild(createElement('td', dimension.dimensao));
      const metrics = [
        ['planejado', dimension.totalPlanejado, 'Ver atividades planejadas'],
        ['descentralizado', dimension.totalDescentralizado, 'Ver descentralizações'],
        ['a-descentralizar', dimension.aDescentralizar, 'Ver atividades com saldo disponível para empenho'],
        ['empenhado', dimension.totalEmpenhado, 'Ver empenhos'],
      ];
      metrics.forEach(([metric, value, label]) => {
        const cell = document.createElement('td');
        const button = createElement('button', formatCurrency(value), 'siages-plan-value');
        button.type = 'button';
        button.setAttribute('aria-label', `${label} da dimensão ${dimension.dimensao}`);
        const isOpen = state.detail?.key === dimension.key && state.detail?.metric === metric;
        button.setAttribute('aria-expanded', String(isOpen));
        button.addEventListener('click', () => {
          state.detail = isOpen ? null : { key: dimension.key, metric };
          renderSummary(state.summary);
        });
        cell.appendChild(button);
        row.appendChild(cell);
      });
      row.appendChild(createElement('td', formatCurrency(dimension.aEmpenhar)));
      tbody.appendChild(row);
      if (state.detail?.key === dimension.key) {
        renderDetail(row, dimension, state.detail.metric === 'a-descentralizar' ? 'a-descentralizar' : state.detail.metric);
      }
    });
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    panel.append(header, status, tableWrap);
  }

  function renderLoading() {
    const panel = ensurePanel();
    panel.innerHTML = '';
    const header = createElement('div', undefined, 'siages-plan-header');
    header.append(
      createElement('div', 'Resumo por dimensão'),
      createElement('span', 'Carregando dados do SIAGES...'),
    );
    panel.appendChild(header);
  }

  function renderError(message) {
    const panel = ensurePanel();
    panel.innerHTML = '';
    const header = createElement('div', undefined, 'siages-plan-header');
    header.appendChild(createElement('div', 'Resumo por dimensão'));
    const status = createElement('p', message, 'siages-plan-status');
    status.setAttribute('role', 'alert');
    const retry = createElement('button', 'Tentar novamente', 'siages-plan-retry');
    retry.type = 'button';
    retry.addEventListener('click', () => state.retry?.());
    panel.append(header, status, retry);
  }

  function isOptionalString(value) {
    return value === undefined || typeof value === 'string';
  }

  function isValidSummaryPayload(payload) {
    if (!payload || typeof payload !== 'object' || payload.planId !== 8 || !Array.isArray(payload.dimensoes)) return false;
    return payload.dimensoes.every((dimension) => {
      if (!dimension || typeof dimension !== 'object') return false;
      const validTotals = ['totalPlanejado', 'totalDescentralizado', 'aDescentralizar', 'totalEmpenhado', 'aEmpenhar']
        .every((field) => typeof dimension[field] === 'number' && Number.isFinite(dimension[field]));
      const validActivities = Array.isArray(dimension.atividades) && dimension.atividades.every((item) =>
        item && typeof item.id === 'string' && typeof item.atividade === 'string' &&
        typeof item.descricao === 'string' && typeof item.componenteFuncional === 'string' &&
        typeof item.origemRecurso === 'string' && typeof item.planoInterno === 'string' &&
        typeof item.valor === 'number' && Number.isFinite(item.valor));
      const validDescentralizacoes = Array.isArray(dimension.descentralizacoes) && dimension.descentralizacoes.every((item) =>
        item && typeof item.id === 'string' && typeof item.origemRecurso === 'string' &&
        typeof item.valor === 'number' && Number.isFinite(item.valor) &&
        isOptionalString(item.notaCredito) && isOptionalString(item.descricao) &&
        isOptionalString(item.naturezaDespesa) && isOptionalString(item.planoInterno) &&
        isOptionalString(item.dataEmissao));
      const validEmpenhos = Array.isArray(dimension.empenhos) && dimension.empenhos.every((item) =>
        item && typeof item.id === 'string' && typeof item.numero === 'string' &&
        typeof item.descricao === 'string' && typeof item.origemRecurso === 'string' &&
        typeof item.dataEmpenho === 'string' && typeof item.valor === 'number' && Number.isFinite(item.valor));
      return typeof dimension.key === 'string' && typeof dimension.dimensao === 'string' &&
        validTotals && validActivities && validDescentralizacoes && validEmpenhos;
    });
  }

  function isValidPlanMessage(event, siagesOrigin, frame, type) {
    const baseIsValid = event.origin === siagesOrigin &&
      event.source === frame.contentWindow &&
      event.data?.source === 'siages' &&
      event.data?.type === type &&
      event.data?.version === 1;
    if (!baseIsValid) return false;
    if (type === 'siages:suap-plan-summary') return isValidSummaryPayload(event.data.payload);
    if (type === 'siages:suap-plan-summary-error') {
      return typeof event.data.payload?.message === 'string' && event.data.payload.message.length <= 500;
    }
    return true;
  }

  function requestSummary() {
    if (!PLAN_PATH.test(window.location.pathname)) return;
    state.cleanupRequest?.();
    document.getElementById(FRAME_ID)?.remove();
    renderLoading();
    void getStoredSiagesOrigin().then((siagesOrigin) => {
      if (!siagesOrigin) {
        renderError('Configure uma origem HTTPS válida do SIAGES na extensão.');
        return;
      }

      const frame = document.createElement('iframe');
      frame.id = FRAME_ID;
      frame.src = `${siagesOrigin}/suap-extensao/plano-resumo`;
      frame.title = 'Resumo do plano no SIAGES';
      Object.assign(frame.style, { position: 'absolute', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none' });
      const context = {
        source: 'siages-suap-extension',
        type: 'siages:suap-plan-context',
        version: 1,
        payload: { planId: 8, planUrl: window.location.origin + window.location.pathname },
      };
      let frameLoaded = false;
      let readyReceived = false;
      const postContext = () => frame.contentWindow?.postMessage(context, siagesOrigin);
      const timeout = window.setTimeout(() => {
        cleanup();
        if (!frameLoaded) {
          renderError(`O iframe do SIAGES não carregou em ${siagesOrigin}. Verifique a URL configurada na extensão.`);
        } else if (!readyReceived) {
          renderError(`O SIAGES abriu, mas a sessão não foi reconhecida. Abra ${siagesOrigin} em outra guia, entre no sistema e tente novamente.`);
        } else {
          renderError(`O SIAGES recebeu a solicitação, mas não enviou o resumo. Tente novamente em alguns instantes.`);
        }
      }, 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener('message', receiveMessage);
        frame.remove();
        if (state.cleanupRequest === cleanup) state.cleanupRequest = null;
      };
      const receiveMessage = (event) => {
        if (isValidPlanMessage(event, siagesOrigin, frame, 'siages:suap-plan-summary-ready')) {
          readyReceived = true;
          postContext();
          return;
        }
        if (isValidPlanMessage(event, siagesOrigin, frame, 'siages:suap-plan-summary')) {
          cleanup();
          renderSummary(event.data.payload);
        }
        if (isValidPlanMessage(event, siagesOrigin, frame, 'siages:suap-plan-summary-error')) {
          cleanup();
          renderError(event.data.payload.message);
        }
      };
      frame.addEventListener('load', () => {
        frameLoaded = true;
        postContext();
      });
      window.addEventListener('message', receiveMessage);
      state.cleanupRequest = cleanup;
      document.body.appendChild(frame);
    });
  }

  function dispose() {
    state.cleanupRequest?.();
    applyBalanceFilter(false);
    document.getElementById(PANEL_ID)?.remove();
  }

  state.retry = requestSummary;
  window.__siagesSuapPlanSummaryDispose = dispose;
  window.__siagesSuapPlanSummary = {
    parseCurrency,
    isValidSummaryPayload,
    collectActivityBlocks,
    applyBalanceFilter,
    renderSummary,
    requestSummary,
    dispose,
  };
  if (!window.__SIAGES_SUAP_PLAN_TEST__) requestSummary();
})();
