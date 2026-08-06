(function () {
  window.__siagesSuapPlanSummaryDispose?.();

  const PANEL_ID = 'siages-suap-plan-summary';
  const FRAME_ID = 'siages-suap-plan-summary-frame';
  const STYLE_ID = 'siages-suap-plan-summary-style';
  const FILTER_TOGGLE_ID = 'siages-suap-plan-balance-filter';
  const DIMENSION_SUMMARY_ID = 'siages-suap-plan-dimension-summary';
  const TABLE_MARKER = 'data-siages-plan-table';
  const SIAGES_APP_ORIGIN_STORAGE_KEY = 'siages-app-origin';
  const DEFAULT_SIAGES_APP_ORIGIN = 'https://www.siages.com.br';
  const LEGACY_SIAGES_APP_ORIGIN = 'https://sistema-gerencial-gamma.vercel.app';
  const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
  const EXTENSION_SESSION_STORAGE_KEY = 'siages-extension-session';
  const PLAN_PATH = /^\/plan_estrategico\/plano_concluido\/8\/?$/;
  const BALANCE_LABEL = 'saldo disponivel para empenho da atividade r';
  const DIMENSION_CODES = new Set(['AD', 'AE', 'CI', 'EN', 'EX', 'GE', 'GO', 'GP', 'IE', 'IN', 'PI', 'TI']);

  const state = {
    summary: null,
    detail: null,
    hiddenState: new Map(),
    tableEnhancements: new Map(),
    tableTools: { hideZeroBalances: false, sortColumn: null, sortDirection: 'asc' },
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

  function getDimensionIdentity({ dimensao, planoInterno, descricao }) {
    const directCode = getDimensionCode(dimensao);
    const fromPlanInternal = cleanText(planoInterno).toUpperCase().match(/([A-Z]{2})[A-Z]?$/)?.[1];
    const fromDescription = getDimensionCode(descricao);
    const code = directCode || (fromPlanInternal && DIMENSION_CODES.has(fromPlanInternal) ? fromPlanInternal : null) || fromDescription;
    const fallback = cleanText(dimensao) || 'Sem dimensão';
    const labels = {
      AD: 'AD - Administração', AE: 'AE - Atividades Estudantis', CI: 'CI - Comunicação Institucional',
      EN: 'EN - Ensino', EX: 'EX - Extensão', GE: 'GE - Gestão Estratégica e Desenvolvimento Institucional',
      GO: 'GO - Governança', GP: 'GP - Gestão de Pessoas', IE: 'IE - Infraestrutura',
      IN: 'IN - Internacionalização', PI: 'PI - Pesquisa, Pós-Graduação e Inovação',
      TI: 'TI - Tecnologia da Informação e Comunicação',
    };
    return {
      key: code || normalizeText(fallback).toUpperCase(),
      dimensao: code ? labels[code] : fallback,
    };
  }

  function getOrCreateDimension(map, identity) {
    const resolved = getDimensionIdentity(identity);
    if (map.has(resolved.key)) return map.get(resolved.key);
    const dimension = {
      key: resolved.key,
      dimensao: resolved.dimensao,
      totalPlanejado: 0,
      totalDescentralizado: 0,
      aDescentralizar: 0,
      totalEmpenhado: 0,
      aEmpenhar: 0,
      atividades: [],
      descentralizacoes: [],
      empenhos: [],
    };
    map.set(resolved.key, dimension);
    return dimension;
  }

  function buildDirectPlanSummary(atividades, descentralizacoes, empenhos) {
    const dimensions = new Map();
    atividades.forEach((atividade) => {
      const dimension = getOrCreateDimension(dimensions, {
        dimensao: atividade.dimensao, planoInterno: atividade.plano_interno, descricao: atividade.descricao,
      });
      const valor = Number(atividade.valor_total) || 0;
      dimension.totalPlanejado += valor;
      dimension.atividades.push({
        id: String(atividade.id), atividade: atividade.atividade || '', descricao: atividade.descricao || '',
        componenteFuncional: atividade.componente_funcional || '', origemRecurso: atividade.origem_recurso || '',
        planoInterno: atividade.plano_interno || '', valor,
      });
    });
    descentralizacoes.forEach((descentralizacao) => {
      const dimension = getOrCreateDimension(dimensions, {
        dimensao: descentralizacao.dimensao, planoInterno: descentralizacao.plano_interno, descricao: descentralizacao.descricao,
      });
      const valor = Number(descentralizacao.valor) || 0;
      dimension.totalDescentralizado += valor;
      dimension.descentralizacoes.push({
        id: String(descentralizacao.id), notaCredito: descentralizacao.nota_credito || undefined,
        descricao: descentralizacao.descricao || undefined, origemRecurso: descentralizacao.origem_recurso || '',
        naturezaDespesa: descentralizacao.natureza_despesa || undefined, planoInterno: descentralizacao.plano_interno || undefined,
        dataEmissao: descentralizacao.data_emissao || undefined, valor,
      });
    });
    empenhos.filter((empenho) => (empenho.tipo || 'exercicio') === 'exercicio' && empenho.status !== 'cancelado').forEach((empenho) => {
      const dimension = getOrCreateDimension(dimensions, {
        dimensao: empenho.dimensao, planoInterno: empenho.plano_interno, descricao: empenho.descricao,
      });
      const valor = Number(empenho.valor) || 0;
      dimension.totalEmpenhado += valor;
      dimension.empenhos.push({
        id: String(empenho.id), numero: empenho.numero || '', descricao: empenho.descricao || '',
        origemRecurso: empenho.origem_recurso || '', dataEmpenho: empenho.data_empenho || '', valor,
      });
    });
    const dimensoes = Array.from(dimensions.values()).map((dimension) => ({
      ...dimension,
      aDescentralizar: dimension.totalPlanejado - dimension.totalDescentralizado,
      aEmpenhar: dimension.totalDescentralizado - dimension.totalEmpenhado,
      atividades: dimension.atividades.sort((left, right) => left.atividade.localeCompare(right.atividade, 'pt-BR')),
      descentralizacoes: dimension.descentralizacoes.sort((left, right) => String(right.dataEmissao || '').localeCompare(String(left.dataEmissao || ''))),
      empenhos: dimension.empenhos.sort((left, right) => right.dataEmpenho.localeCompare(left.dataEmpenho)),
    })).sort((left, right) => left.dimensao.localeCompare(right.dimensao, 'pt-BR'));
    return { planId: 8, dimensoes };
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

  function getTableHeaders(table) {
    return Array.from(table.querySelectorAll('thead th')).map((header) => cleanText(header.textContent));
  }

  function getTableColumnIndex(table, normalizedLabel) {
    return getTableHeaders(table).findIndex((header) => {
      const normalized = normalizeText(header);
      return normalized === normalizedLabel || normalized.startsWith(normalizedLabel);
    });
  }

  function getPlanTables() {
    return Array.from(document.querySelectorAll('main table, #content table, .content table'))
      .filter((table) => table.tBodies.length > 0 && getTableColumnIndex(table, BALANCE_LABEL) >= 0);
  }

  function getTableNumericValue(value) {
    const compact = cleanText(value).replace(/\s/g, '');
    if (!/^-?(?:R\$)?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(compact)
      && !/^-?\d+(?:[.,]\d+)?$/.test(compact)) return null;
    return parseCurrency(compact);
  }

  function getTableCellValue(row, columnIndex) {
    return cleanText(row.cells[columnIndex]?.textContent);
  }

  function isZeroBalanceRow(row, balanceColumnIndex) {
    const rawValue = getTableCellValue(row, balanceColumnIndex);
    return Math.abs(parseCurrency(rawValue)) < 0.005;
  }

  function getPlanTableDimension(table, fallbackIndex) {
    const button = table.closest('.accordion-item')?.querySelector('.accordion-header button');
    return cleanText(button?.textContent) || `Dimensão ${fallbackIndex + 1}`;
  }

  function collectPlanDimensionSummary() {
    const dimensions = new Map();
    let fallbackIndex = 0;
    state.tableEnhancements.forEach((stateForTable) => {
      const table = stateForTable.table;
      const dimensionLabel = getPlanTableDimension(table, fallbackIndex);
      fallbackIndex += 1;
      if (!dimensions.has(dimensionLabel)) {
        dimensions.set(dimensionLabel, {
          dimensao: dimensionLabel,
          valorAtualizado: 0,
          valorEmpenhado: 0,
          requisicoes: 0,
          saldoDisponivel: 0,
        });
      }
      const summary = dimensions.get(dimensionLabel);
      const updatedColumn = getTableColumnIndex(table, 'valor atualizado da atividade r');
      const committedColumn = getTableColumnIndex(table, 'valor empenhado da atividade r');
      const requisitionsColumn = getTableColumnIndex(table, 'valor de requisicoes de despesas em tramitacao');
      stateForTable.rows.forEach((row) => {
        summary.valorAtualizado += parseCurrency(getTableCellValue(row, updatedColumn));
        summary.valorEmpenhado += parseCurrency(getTableCellValue(row, committedColumn));
        summary.requisicoes += parseCurrency(getTableCellValue(row, requisitionsColumn));
        summary.saldoDisponivel += parseCurrency(getTableCellValue(row, stateForTable.balanceColumnIndex));
      });
    });
    return Array.from(dimensions.values());
  }

  function renderPlanDimensionSummary() {
    const dimensions = collectPlanDimensionSummary();
    document.getElementById(DIMENSION_SUMMARY_ID)?.remove();
    if (dimensions.length === 0) return dimensions;

    const legendButton = Array.from(document.querySelectorAll('.accordion-header button'))
      .find((button) => normalizeText(button.textContent) === 'legenda');
    const legendAccordion = legendButton?.closest('.accordion');
    if (!legendAccordion) return dimensions;

    const accordion = document.createElement('div');
    accordion.id = DIMENSION_SUMMARY_ID;
    accordion.className = 'accordion siages-plan-dimension-summary';
    accordion.setAttribute('aria-label', 'Resumo financeiro por dimensão');
    const item = createElement('div', undefined, 'accordion-item');
    const header = createElement('h2', undefined, 'accordion-header');
    const button = createElement('button', 'Resumo financeiro por dimensão', 'accordion-button');
    button.type = 'button';
    button.setAttribute('data-bs-toggle', 'collapse');
    button.setAttribute('data-bs-target', '#siages-suap-plan-dimension-summary-collapse');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-controls', 'siages-suap-plan-dimension-summary-collapse');
    header.appendChild(button);

    const collapse = createElement('div', undefined, 'accordion-collapse collapse show');
    collapse.id = 'siages-suap-plan-dimension-summary-collapse';
    const body = createElement('div', undefined, 'accordion-body');
    const responsive = createElement('div', undefined, 'table-responsive');
    const table = createElement('table', undefined, 'table siages-plan-dimension-summary-table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Dimensão', 'Valor atualizado da atividade (R$)', 'Valor empenhado da atividade (R$)', 'Valor de requisições de despesas em tramitação', 'Saldo disponível para empenho da atividade (R$)']
      .forEach((label) => headRow.appendChild(createElement('th', label)));
    thead.appendChild(headRow);
    const tbody = document.createElement('tbody');
    dimensions.forEach((dimension) => {
      const row = document.createElement('tr');
      row.appendChild(createElement('td', dimension.dimensao));
      [dimension.valorAtualizado, dimension.valorEmpenhado, dimension.requisicoes, dimension.saldoDisponivel]
        .forEach((value) => row.appendChild(createElement('td', formatCurrency(value), 'text-end')));
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    responsive.appendChild(table);
    body.appendChild(responsive);
    collapse.appendChild(body);
    item.append(header, collapse);
    accordion.appendChild(item);
    legendAccordion.insertAdjacentElement('afterend', accordion);
    return dimensions;
  }
  function renderPlanBalanceFilter() {
    let toggle = document.getElementById(FILTER_TOGGLE_ID);
    if (toggle) return toggle;

    const form = document.querySelector('form#relatorioplanoatividade_form, form[name="relatorioplanoatividade_form"]');
    const fieldset = form?.querySelector('fieldset.module.aligned, fieldset');
    if (!fieldset) return null;

    toggle = document.createElement('div');
    toggle.id = FILTER_TOGGLE_ID;
    toggle.className = 'form-row siages-plan-filter-toggle';
    const fieldBox = createElement('div', undefined, 'field-box-first');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.tableTools.hideZeroBalances;
    checkbox.addEventListener('change', () => {
      state.tableTools.hideZeroBalances = checkbox.checked;
      applyPlanTableFilters();
    });
    label.append(checkbox, document.createTextNode('Exibir somente atividades com saldo'));
    fieldBox.appendChild(label);
    toggle.appendChild(fieldBox);
    fieldset.appendChild(toggle);
    return toggle;
  }

  function updateTableHeaderSort(stateForTable) {
    stateForTable.headers.forEach((header, index) => {
      const button = header.querySelector('.siages-plan-column-sort');
      if (!button) return;
      const isActive = state.tableTools.sortColumn === index;
      header.setAttribute('aria-sort', isActive ? (state.tableTools.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
      button.dataset.direction = isActive ? state.tableTools.sortDirection : 'none';
      button.title = `Ordenar por ${stateForTable.headerLabels[index]}${isActive ? (state.tableTools.sortDirection === 'asc' ? ', crescente' : ', decrescente') : ''}`;
    });
  }

  function sortPlanTable(stateForTable) {
    const columnIndex = state.tableTools.sortColumn;
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= stateForTable.headerLabels.length) return;
    const direction = state.tableTools.sortDirection === 'desc' ? -1 : 1;
    const rows = [...stateForTable.rows].sort((left, right) => {
      const leftValue = getTableCellValue(left, columnIndex);
      const rightValue = getTableCellValue(right, columnIndex);
      const leftNumeric = getTableNumericValue(leftValue);
      const rightNumeric = getTableNumericValue(rightValue);
      if (leftNumeric !== null && rightNumeric !== null && leftNumeric !== rightNumeric) return (leftNumeric - rightNumeric) * direction;
      const compared = leftValue.localeCompare(rightValue, 'pt-BR', { numeric: true, sensitivity: 'base' });
      return compared !== 0 ? compared * direction : stateForTable.originalOrder.get(left) - stateForTable.originalOrder.get(right);
    });
    stateForTable.tbody.append(...rows);
  }

  function applyPlanTableFilters() {
    let visibleRows = 0;
    let totalRows = 0;
    state.tableEnhancements.forEach((stateForTable) => {
      sortPlanTable(stateForTable);
      stateForTable.rows.forEach((row) => {
        const originalHidden = stateForTable.originalHidden.get(row) || false;
        const hasZeroBalance = isZeroBalanceRow(row, stateForTable.balanceColumnIndex);
        row.hidden = originalHidden || (state.tableTools.hideZeroBalances && hasZeroBalance);
        totalRows += 1;
        if (!row.hidden) visibleRows += 1;
      });
      updateTableHeaderSort(stateForTable);
    });
    return { visibleRows, totalRows };
  }

  function setPlanTableSort(columnIndex) {
    if (state.tableTools.sortColumn === columnIndex) {
      state.tableTools.sortDirection = state.tableTools.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.tableTools.sortColumn = columnIndex;
      state.tableTools.sortDirection = 'asc';
    }
    applyPlanTableFilters();
  }

  function enhancePlanTables() {
    ensureStyles();
    const tables = getPlanTables();
    state.tableEnhancements.forEach((stateForTable, table) => {
      if (!document.documentElement.contains(table)) state.tableEnhancements.delete(table);
    });
    if (tables.length === 0) return { tableCount: 0, visibleRows: 0, totalRows: 0 };

    tables.forEach((table) => {
      if (state.tableEnhancements.has(table)) return;
      const tbody = table.tBodies[0];
      const headers = Array.from(table.querySelectorAll('thead th'));
      const stateForTable = {
        table,
        tbody,
        headers,
        headerLabels: getTableHeaders(table),
        rows: Array.from(tbody.rows),
        originalOrder: new Map(),
        originalHidden: new Map(),
        balanceColumnIndex: getTableColumnIndex(table, BALANCE_LABEL),
      };
      stateForTable.rows.forEach((row, index) => {
        stateForTable.originalOrder.set(row, index);
        stateForTable.originalHidden.set(row, row.hidden);
      });
      headers.forEach((header, index) => {
        const button = createElement('button', stateForTable.headerLabels[index], 'siages-plan-column-sort');
        button.type = 'button';
        button.addEventListener('click', () => setPlanTableSort(index));
        header.replaceChildren(button);
        header.setAttribute('aria-sort', 'none');
      });
      table.setAttribute(TABLE_MARKER, 'true');
      state.tableEnhancements.set(table, stateForTable);
    });

    renderPlanBalanceFilter();
    renderPlanDimensionSummary();
    return { tableCount: tables.length, ...applyPlanTableFilters() };
  }

  function getStoredValue(key) {
    return new Promise((resolve) => {
      if (!window.chrome?.storage?.local?.get) {
        resolve(undefined);
        return;
      }
      chrome.storage.local.get(key, (stored) => resolve(stored?.[key]));
    });
  }

  function setStoredValue(key, value) {
    return new Promise((resolve) => {
      if (!window.chrome?.storage?.local?.set) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  function removeStoredValue(key) {
    return new Promise((resolve) => {
      if (!window.chrome?.storage?.local?.remove) {
        resolve();
        return;
      }
      chrome.storage.local.remove(key, resolve);
    });
  }

  async function refreshExtensionSession(refreshToken) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) throw new Error('A sessão da extensão expirou. Abra o popup e entre novamente.');
    const payload = await response.json();
    const session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
    };
    await setStoredValue(EXTENSION_SESSION_STORAGE_KEY, session);
    return session;
  }

  async function getExtensionSession() {
    const session = await getStoredValue(EXTENSION_SESSION_STORAGE_KEY);
    if (!session?.accessToken || !session?.refreshToken) {
      throw new Error('Autentique a extensão no popup para consultar os dados do banco.');
    }
    if (Number(session.expiresAt || 0) <= (Date.now() / 1000) + 60) {
      try {
        return await refreshExtensionSession(session.refreshToken);
      } catch (error) {
        await removeStoredValue(EXTENSION_SESSION_STORAGE_KEY);
        throw error;
      }
    }
    return session;
  }

  async function fetchTableRows(table, select, order, session) {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const params = new URLSearchParams({ select, order });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`,
          Range: `${offset}-${offset + pageSize - 1}`,
        },
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await removeStoredValue(EXTENSION_SESSION_STORAGE_KEY);
          throw new Error('A sessão da extensão não tem acesso a estes dados. Entre novamente no popup.');
        }
        throw new Error(`Falha ao consultar ${table} no banco (${response.status}).`);
      }
      const page = await response.json();
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }

  async function fetchDirectPlanSummary() {
    const session = await getExtensionSession();
    const [atividades, descentralizacoes, empenhos] = await Promise.all([
      fetchTableRows('atividades', 'id,dimensao,componente_funcional,atividade,descricao,valor_total,origem_recurso,plano_interno', 'created_at.desc', session),
      fetchTableRows('descentralizacoes', 'id,dimensao,nota_credito,origem_recurso,natureza_despesa,plano_interno,data_emissao,descricao,valor', 'data_emissao.desc.nullslast', session),
      fetchTableRows('empenhos', 'id,numero,descricao,valor,dimensao,origem_recurso,plano_interno,data_empenho,status,tipo', 'created_at.desc', session),
    ]);
    return buildDirectPlanSummary(atividades, descentralizacoes, empenhos);
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
      #${PANEL_ID} .siages-plan-status { margin:0; padding:12px 18px; color:#526156; }
      #${PANEL_ID} .siages-plan-status[role="alert"] { color:#991b1b; background:#fef2f2; }
      #${PANEL_ID} .siages-plan-retry { margin:0 18px 16px; min-height:36px; border:1px solid #177d32; border-radius:7px; padding:6px 12px; background:#fff; color:#14532d; font:inherit; font-weight:700; cursor:pointer; }
      #${PANEL_ID} .siages-plan-retry:hover { background:#f0f9f1; }
      #relatorioplanoatividade_form #${FILTER_TOGGLE_ID} { min-width:250px; }
      #relatorioplanoatividade_form #${FILTER_TOGGLE_ID} label { display:flex; align-items:center; gap:7px; min-height:34px; margin:0; cursor:pointer; }
      #relatorioplanoatividade_form #${FILTER_TOGGLE_ID} input { width:16px; height:16px; margin:0; accent-color:#177d32; cursor:pointer; }
      #${DIMENSION_SUMMARY_ID} { margin-top:16px; border:1px solid #353535; border-radius:6px; background:#1b1b1b; color:#f5f5f5; overflow:hidden; }
      #${DIMENSION_SUMMARY_ID} .accordion-item { border:0; background:#1b1b1b; }
      #${DIMENSION_SUMMARY_ID} .accordion-header { background:#1b1b1b; }
      #${DIMENSION_SUMMARY_ID} .accordion-button, #${DIMENSION_SUMMARY_ID} .accordion-button:not(.collapsed) { background:#1b1b1b; color:#18c7bd; box-shadow:none; }
      #${DIMENSION_SUMMARY_ID} .accordion-button:focus { box-shadow:inset 0 0 0 2px rgba(24,199,189,.35); }
      #${DIMENSION_SUMMARY_ID} .accordion-body { padding:16px 10px 10px; background:#1b1b1b; color:#f5f5f5; }
      #${DIMENSION_SUMMARY_ID} .table-responsive { margin:0; }
      #${DIMENSION_SUMMARY_ID} table { width:100%; margin:0; border-collapse:collapse; background:#242424 !important; color:#f5f5f5 !important; --bs-table-bg:#242424; --bs-table-color:#f5f5f5; --bs-table-border-color:#454545; }
      #${DIMENSION_SUMMARY_ID} thead th { background:#343434 !important; color:#ffffff !important; border:1px solid #4b4b4b; padding:10px 8px; font-size:12px; font-weight:700; line-height:1.2; vertical-align:middle; }
      #${DIMENSION_SUMMARY_ID} tbody td { background:#242424 !important; color:#f5f5f5 !important; border:1px solid #454545; padding:10px 8px; font-size:13px; vertical-align:middle; }
      #${DIMENSION_SUMMARY_ID} tbody tr:nth-child(even) td { background:#292929 !important; }
      #${DIMENSION_SUMMARY_ID} tbody tr:hover td { background:#303030 !important; }
      #${DIMENSION_SUMMARY_ID} .text-end { color:#ffffff; font-variant-numeric:tabular-nums; }
      table[${TABLE_MARKER}="true"] .siages-plan-column-sort { display:inline-flex; align-items:center; gap:7px; width:100%; border:0; padding:2px 0; background:transparent; color:#f8fafc !important; font:inherit; font-weight:inherit; text-align:inherit; cursor:pointer; }
      table[${TABLE_MARKER}="true"] .siages-plan-column-sort::after { content:\\2195; color:#e2e8f0; font-size:15px; font-weight:800; line-height:1; margin-left:7px; text-shadow:0 1px 1px rgba(0,0,0,.65); }
      table[${TABLE_MARKER}="true"] .siages-plan-column-sort[data-direction="asc"]::after { content:\\2191; color:#facc15; font-size:16px; font-weight:900; }
      table[${TABLE_MARKER}="true"] .siages-plan-column-sort[data-direction="desc"]::after { content:\\2193; color:#facc15; font-size:16px; font-weight:900; }
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
      @media (max-width: 640px) { #${PANEL_ID} .siages-plan-header { align-items:flex-start; flex-direction:column; } }
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
      createElement('p', 'Dados consultados diretamente no banco para o plano de atividades 2026.'),
    );
    header.appendChild(titleGroup);

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
      createElement('span', 'Consultando dados do banco...'),
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
    enhancePlanTables();
    state.cleanupRequest?.();
    document.getElementById(FRAME_ID)?.remove();
    renderLoading();
    void fetchDirectPlanSummary()
      .then(renderSummary)
      .catch((error) => renderError(error instanceof Error ? error.message : 'Não foi possível consultar o banco de dados.'));
  }

  function dispose() {
    state.cleanupRequest?.();
    applyBalanceFilter(false);
    state.tableEnhancements.forEach((stateForTable) => {
      stateForTable.tbody.append(...stateForTable.rows);
      stateForTable.rows.forEach((row) => { row.hidden = stateForTable.originalHidden.get(row) || false; });
      stateForTable.headers.forEach((header, index) => {
        header.textContent = stateForTable.headerLabels[index];
        header.removeAttribute('aria-sort');
      });
      stateForTable.table.removeAttribute(TABLE_MARKER);
    });
    state.tableEnhancements.clear();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(DIMENSION_SUMMARY_ID)?.remove();
    document.getElementById(FILTER_TOGGLE_ID)?.remove();
    document.getElementById(PANEL_ID)?.remove();
  }

  state.retry = requestSummary;
  window.__siagesSuapPlanSummaryDispose = dispose;
  window.__siagesSuapPlanSummary = {
    parseCurrency,
    isValidSummaryPayload,
    buildDirectPlanSummary,
    fetchDirectPlanSummary,
    collectActivityBlocks,
    applyBalanceFilter,
    getPlanTables,
    collectPlanDimensionSummary,
    renderPlanDimensionSummary,
    enhancePlanTables,
    applyPlanTableFilters,
    setPlanTableSort,
    renderSummary,
    requestSummary,
    dispose,
  };
  if (!window.__SIAGES_SUAP_PLAN_TEST__) enhancePlanTables();
})();
