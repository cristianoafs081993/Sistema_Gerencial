(function () {
  window.__siagesSuapPlanSummaryDispose?.();

  const PANEL_ID = 'siages-suap-plan-summary';
  const STYLE_ID = 'siages-suap-plan-summary-style';
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
    retry: null,
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
      createElement('p', 'Dados consultados diretamente no banco para o plano de atividades 2026.'),
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

  function requestSummary() {
    if (!PLAN_PATH.test(window.location.pathname)) return;
    renderLoading();
    void fetchDirectPlanSummary()
      .then(renderSummary)
      .catch((error) => renderError(error instanceof Error ? error.message : 'Não foi possível consultar o banco de dados.'));
  }

  function dispose() {
    applyBalanceFilter(false);
    document.getElementById(PANEL_ID)?.remove();
  }

  state.retry = requestSummary;
  window.__siagesSuapPlanSummaryDispose = dispose;
  window.__siagesSuapPlanSummary = {
    parseCurrency,
    buildDirectPlanSummary,
    fetchDirectPlanSummary,
    collectActivityBlocks,
    applyBalanceFilter,
    renderSummary,
    requestSummary,
    dispose,
  };
  if (!window.__SIAGES_SUAP_PLAN_TEST__) requestSummary();
})();
