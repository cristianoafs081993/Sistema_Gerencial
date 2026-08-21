(function () {
  const ROOT_ID = 'siages-suap-toolkit';
  const MODAL_ID = 'siages-suap-dispatch-modal';
  const IFRAME_ID = 'siages-suap-dispatch-frame';
  const DOCUMENT_ANALYSIS_MODAL_ID = 'siages-suap-document-analysis-modal';
  const DOCUMENT_ANALYSIS_IFRAME_ID = 'siages-suap-document-analysis-frame';
  const BRIDGE_FRAME_ID = 'siages-suap-finance-frame';
  const FINANCE_PANEL_ID = 'siages-suap-finance-panel';
  const SIAGES_ORIGIN = 'https://www.siages.com.br';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
  const THEME_KEY = 'siages-toolkit-theme';
  const COLLAPSED_KEY = 'siages-toolkit-collapsed';
  const SNIPPETS_KEY = 'siages-snippets';
  const PROCESS_STATE_KEY_PREFIX = 'siages-process-state:';
  const PROCESS_MAPPING_KEY_PREFIX = 'siages-process-mapping:';
  const DOCUMENT_REVIEW_MAX_BYTES = 20 * 1024 * 1024;
  const DOCUMENT_VIEWER_PATH = /^\/documento_eletronico\/visualizar_documento(?:_digitalizado)?\/(\d+)\/?$/;
  const DEFAULT_SNIPPETS = {
    '/ifrn': 'Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte',
    '/cn': 'Currais Novos',
    '/lei14133': 'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
    '/atpub': 'Atenciosamente, servidor público do IFRN – Campus Currais Novos',
  };
  const state = {
    activeTab: 'summary', theme: 'dark', collapsed: false, maximized: false, snapshot: null,
    syncStatus: { stage: 'checking', message: 'Preparando a consulta do processo...' },
    financeSummary: null, hasFinanceSummary: false, flow: null, selectedMappingId: '', mappings: [], snippets: { ...DEFAULT_SNIPPETS }, editingKey: null,
  };
  let documentAnalysisObserver = null;
  let documentAnalysisCleanup = null;

  function cleanText(value) { return value ? String(value).replace(/\s+/g, ' ').trim() : ''; }
  function normalizeDocumentReviewText(value) {
    return cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function classifyDocumentForAnalysis(title, documentType) {
    const normalized = `${normalizeDocumentReviewText(documentType)} ${normalizeDocumentReviewText(title)}`.trim();
    if (!normalized || /(?:termo de )?aprovacao\b|aprovacao do termo|aprovacao de termo/.test(normalized)) return null;
    if (/\banexo\b|\bminuta\b/.test(normalized) && !/termo de referencia|estudo tecnico preliminar/.test(normalized)) return null;
    if (normalized.includes('estudo tecnico preliminar') || /\betp\b/.test(normalized)) return 'etp';
    if (normalized.includes('termo de referencia') || /\btr\s*(?:n[ºo]?\s*)?\d/.test(normalized)) return 'tr';
    return null;
  }
  function getDocumentSource(link) {
    try {
      const url = new URL(link.getAttribute('href') || '', location.origin);
      const match = DOCUMENT_VIEWER_PATH.exec(url.pathname);
      if (!match || url.origin !== 'https://suap.ifrn.edu.br') return null;
      return { documentId: match[1], originalPath: `${url.pathname}?original=sim` };
    } catch { return null; }
  }
  function normalizeEmpenhos(values) {
    const numbers = []; const seen = new Set(); const visited = new WeakSet();
    const add = (number) => {
      const normalized = number.toUpperCase();
      if (!seen.has(normalized)) { seen.add(normalized); numbers.push(normalized); }
    };
    const visit = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) { value.forEach((item) => visit(item)); return; }
      if (typeof value === 'object') {
        if (visited.has(value)) return; visited.add(value);
        const record = value;
        [record.numero, record.numeroEmpenho, record.numero_empenho, record.empenho, record.notaEmpenho, record.nota_empenho, record.ne, record.numeroNE, record.numero_ne, record.texto, record.value].forEach((candidate) => visit(candidate));
        return;
      }
      const raw = cleanText(value);
      if (!raw || raw === '[object Object]') return;
      const matches = Array.from(raw.matchAll(/(\d{4})\s*NE\s*(\d{6})/gi), (match) => `${match[1]}NE${match[2]}`);
      matches.forEach(add);
    };
    visit(values);
    return numbers;
  }
  function getProcessId() {
    const directMatch = location.pathname.match(/^\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?$/);
    if (directMatch) return directMatch[1];

    const urlParams = new URLSearchParams(location.search);
    const paramId = urlParams.get('processo') || urlParams.get('processo_id') || urlParams.get('suapId');
    if (paramId && /^\d+$/.test(paramId)) return paramId;

    const processLink = document.querySelector('a[href*="/processo_eletronico/processo/"], a[href*="/processo_eletronico/visualizar_processo/"]');
    if (processLink) {
      const match = processLink.getAttribute('href')?.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/);
      if (match) return match[1];
    }

    if (document.referrer) {
      const refMatch = document.referrer.match(/\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?/);
      if (refMatch) return refMatch[1];
    }

    return null;
  }
  function getProcessNumber() {
    const match = cleanText(document.body?.innerText || document.body?.textContent || '').match(/\b\d{5}\.\d{6}(?:[./])\d{4}-\d{2}\b/);
    return match?.[0] || state.snapshot?.process?.numProcesso || state.snapshot?.fallback?.processNumber || '';
  }
  function getProcessUrl() {
    const processPath = /^\/processo_eletronico\/(?:processo|visualizar_processo)\/\d+\/?$/;
    if (processPath.test(location.pathname)) return location.origin + location.pathname;
    try {
      const referrer = new URL(document.referrer || '');
      if (referrer.origin === 'https://suap.ifrn.edu.br' && processPath.test(referrer.pathname)) return referrer.origin + referrer.pathname;
    } catch {
      // O documento pode nao possuir referer quando aberto diretamente.
    }
    return location.origin + location.pathname;
  }
  function getProcessMappingKey(suapId = getProcessId()) {
    return suapId ? `${PROCESS_MAPPING_KEY_PREFIX}${suapId}` : '';
  }
  function parseProcessRoute() {
    const containers = Array.from(document.querySelectorAll('#timeline > *, aside.right > *, aside > *, [id*="timeline"] > *, [class*="timeline"] > *'));
    const candidates = containers.length ? containers : Array.from(document.querySelectorAll('main div, main li, main article'));
    const events = []; const seen = new Set();
    candidates.forEach((element) => {
      const rawText = cleanText(element.textContent);
      if (!rawText || rawText.length > 320 || !/(recebido|encaminhado|enviado|distribu[ií]do|atribu[ií]do|movido|remetido)/i.test(rawText)) return;
      const key = rawText.toLowerCase(); if (seen.has(key)) return; seen.add(key);
      const match = rawText.match(/(?:recebido|encaminhado|enviado|distribu[ií]do|atribu[ií]do|movido|remetido)\s+(?:por|para|a|à)\s+(.+)/i);
      const unit = cleanText(match?.[1] || '').replace(/\s*[|·-]\s*\d{1,2}\/\d{1,2}\/\d{2,4}.*$/i, '').replace(/\s+às?\s+.*$/i, '').trim();
      events.push({ id: `route-${events.length + 1}`, label: rawText, unit: unit || undefined, rawText, order: events.length });
    });
    return events.slice(0, 100);
  }
  function getProcessStateKey(suapId = getProcessId()) {
    return suapId ? `${PROCESS_STATE_KEY_PREFIX}${suapId}` : '';
  }
  async function readPersistedProcessState() {
    const key = getProcessStateKey();
    if (!key) return null;
    let persisted = null;
    if (globalThis.sessionStorage) {
      try {
        const raw = globalThis.sessionStorage.getItem(key);
        if (raw) persisted = JSON.parse(raw);
      } catch {
        persisted = null;
      }
    }
    if (!persisted) persisted = await storageGet('session', key, null);
    return persisted?.suapId === getProcessId() ? persisted : null;
  }
  function persistProcessState() {
    const key = getProcessStateKey();
    if (!key) return;
    const persisted = {
      suapId: getProcessId(),
      snapshot: state.snapshot,
      syncStatus: state.syncStatus,
      activeTab: state.activeTab,
      ...(state.hasFinanceSummary ? { financeSummary: state.financeSummary } : {}),
      ...(state.flow ? { flow: state.flow } : {}),
    };
    try {
      globalThis.sessionStorage?.setItem(key, JSON.stringify(persisted));
    } catch {
      // O cache e apenas uma otimizacao; a consulta continua funcionando sem ele.
    }
    void storageSet('session', { [key]: persisted });
  }
  async function restorePersistedProcessState() {
    const persisted = await readPersistedProcessState();
    if (!persisted) return false;
    if (persisted.snapshot) state.snapshot = persisted.snapshot;
    if (persisted.syncStatus?.stage && persisted.syncStatus?.message) state.syncStatus = persisted.syncStatus;
    if (['success', 'incomplete_extraction'].includes(state.snapshot?.process?.status) && state.syncStatus.stage === 'checking') {
      state.syncStatus = { stage: 'ready', message: 'Dados do processo atualizados.' };
    }
    if (typeof persisted.activeTab === 'string') state.activeTab = persisted.activeTab;
    if (Object.prototype.hasOwnProperty.call(persisted, 'financeSummary')) {
      state.financeSummary = persisted.financeSummary;
      state.hasFinanceSummary = true;
      window.__siagesLatestFinanceSummary = persisted.financeSummary;
    }
    if (persisted.flow) { state.flow = persisted.flow; state.mappings = persisted.flow.mappings || []; }
    return Boolean(state.snapshot || state.hasFinanceSummary);
  }
  function storageGet(area, key, fallback) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.[area];
      if (!storage?.get) return resolve(fallback);
      storage.get(key, (stored) => resolve(stored?.[key] ?? fallback));
    });
  }
  function storageSet(area, values) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.[area];
      if (!storage?.set) return resolve();
      storage.set(values, resolve);
    });
  }
  function isExtensionContextInvalidated(error) {
    return String(error?.message || error || '').toLowerCase().includes('extension context invalidated');
  }
  function formatAuthError(error) {
    if (isExtensionContextInvalidated(error)) return 'A extens\u00e3o foi atualizada. Recarregue a p\u00e1gina do SUAP e tente novamente.';
    return error instanceof Error ? error.message : 'Falha na autenticacao.';
  }
  async function getExtensionSession() {
    if (!globalThis.SiagesExtensionAuth?.getSession) throw new Error('O serviço de autenticação da extensão não está disponível.');
    const session = await globalThis.SiagesExtensionAuth.getSession();
    if (!session?.accessToken || !session?.refreshToken) throw new Error('Entre no SIAGES pela aba Configurações.');
    return session;
  }
  function buildContext(session) {
    const suapId = getProcessId();
    if (!suapId) return null;
    return {
      source: 'siages-suap-extension', type: 'siages:suap-process-context', version: 1,
      payload: {
        suapId, processNumber: getProcessNumber(), processUrl: getProcessUrl(),
        route: { events: parseProcessRoute(), ...(state.selectedMappingId ? { selectedMappingId: state.selectedMappingId } : {}) },
        ...(session ? { extensionSession: { accessToken: session.accessToken, refreshToken: session.refreshToken } } : {}),
      },
    };
  }
  function isSiagesFrameMessage(event, frame, type) {
    return event.origin === SIAGES_ORIGIN && event.source === frame.contentWindow && event.data?.source === 'siages' && event.data?.type === type && event.data?.version === 1;
  }
  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function normalizeSnippetKey(value) {
    const compact = String(value || '').trim().replace(/\s+/g, '');
    if (!compact) return '';
    return `${compact.startsWith('/') ? '' : '/'}${compact}`.toLowerCase();
  }
  function formatCurrency(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0); }
  function formatDate(value) {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toLocaleDateString('pt-BR');
  }
  function copyText(value, button) {
    const text = String(value ?? '');
    const done = () => {
      const previous = button.textContent;
      button.textContent = '✓';
      window.setTimeout(() => { button.textContent = previous; }, 1200);
    };
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(done);
    const textarea = document.createElement('textarea');
    textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
    document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove(); done();
    return Promise.resolve();
  }

  function findToolkitHost() {
    const directAside = document.querySelector('aside.right, .right-col, aside[class*="right"]');
    if (directAside) return directAside;
    const candidates = Array.from(document.querySelectorAll('aside, .right-col, [class*="right"], [id*="right"], section, article, .box, .card, .panel'));
    let best = null; let bestScore = -1;
    candidates.forEach((element) => {
      const text = cleanText(element.textContent).toLowerCase();
      let score = 0;
      if (text.includes('recebido por')) score += 80;
      if (text.includes('encaminhado por')) score += 70;
      if (text.includes('registro de ações') || text.includes('registro de acoes')) score += 35;
      const rect = element.getBoundingClientRect?.();
      if (rect?.width > 200 && rect.width < 600) score += 20;
      if (rect?.left > innerWidth * .45) score += 20;
      if (score > bestScore) { best = element; bestScore = score; }
    });
    if (bestScore > 0 && best) {
      const parentAside = best.closest('aside.right, aside, .right-col, [class*="right"]');
      return parentAside || best;
    }
    return document.querySelector('main, #content, .content, #main, [role="main"]') || document.body;
  }

  function buildShell() {
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.dataset.theme = state.theme;
    root.dataset.collapsed = String(state.collapsed);
    root.dataset.maximized = String(state.maximized);
    root.setAttribute('aria-label', 'Suape - ferramentas do processo');
    root.innerHTML = `
      <div class="suape-shell">
        <header class="suape-header">
          <div class="suape-brand"><div><strong>SIAGES</strong><small>Sistema Integrado de Administração e Gestão Estratégica</small></div></div>
          <button type="button" class="suape-icon-button" data-action="collapse" aria-label="Minimizar painel" title="Minimizar painel">−</button>
          <button type="button" class="suape-icon-button" data-action="maximize" aria-label="Maximizar painel" title="Maximizar painel">⛶</button>
        </header>
        <nav class="suape-tabs" role="tablist" aria-label="Ferramentas">
          <button class="suape-tab" role="tab" data-tab="summary" aria-selected="true">Resumo</button>
          <button class="suape-tab" role="tab" data-tab="finance" aria-selected="false">Financeiro</button>
          <button class="suape-tab" role="tab" data-tab="shortcuts" aria-selected="false">Atalhos</button>
          <button class="suape-tab" role="tab" data-tab="ai" aria-selected="false">IA</button>
          <button class="suape-tab" role="tab" data-tab="settings" aria-selected="false">Config.</button>
        </nav>
        <div class="suape-panels">
          <section class="suape-panel" data-panel="summary" data-active="true"></section>
          <section class="suape-panel" data-panel="finance" data-active="false"></section>
          <section class="suape-panel" data-panel="shortcuts" data-active="false"></section>
          <section class="suape-panel" data-panel="ai" data-active="false"></section>
          <section class="suape-panel" data-panel="settings" data-active="false"></section>
        </div>
      </div>`;
    root.querySelector('[data-action="collapse"]').addEventListener('click', toggleCollapsed);
    root.querySelector('[data-action="maximize"]').addEventListener('click', toggleMaximized);
    root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
    return root;
  }
  function selectTab(tab) {
    state.activeTab = tab;
    const root = document.getElementById(ROOT_ID);
    root?.querySelectorAll('[data-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    root?.querySelectorAll('[data-panel]').forEach((panel) => { panel.dataset.active = String(panel.dataset.panel === tab); });
    persistProcessState();
  }
  async function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    const root = document.getElementById(ROOT_ID);
    if (root) root.dataset.theme = state.theme;
    document.querySelectorAll('.siages-suap-document-ai-slot').forEach((slot) => { slot.dataset.theme = state.theme; });
    await storageSet('local', { [THEME_KEY]: state.theme });
    if (state.snapshot) renderSummary(state.snapshot);
    if (window.__siagesLatestFinanceSummary) renderFinanceSummary(window.__siagesLatestFinanceSummary);
  }
  async function toggleCollapsed() {
    state.collapsed = !state.collapsed;
    if (state.collapsed && state.maximized) { state.maximized = false; }
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.dataset.collapsed = String(state.collapsed);
      root.dataset.maximized = String(state.maximized);
      const button = root.querySelector('[data-action="collapse"]');
      if (button) {
        button.textContent = state.collapsed ? '+' : '−';
        button.setAttribute('aria-label', state.collapsed ? 'Expandir painel' : 'Minimizar painel');
        button.setAttribute('title', state.collapsed ? 'Expandir painel' : 'Minimizar painel');
      }
      const maxButton = root.querySelector('[data-action="maximize"]');
      if (maxButton) {
        maxButton.textContent = state.maximized ? '🗗' : '⛶';
        maxButton.setAttribute('aria-label', state.maximized ? 'Restaurar tamanho' : 'Maximizar painel');
        maxButton.setAttribute('title', state.maximized ? 'Restaurar tamanho' : 'Maximizar painel');
      }
    }
    await storageSet('local', { [COLLAPSED_KEY]: state.collapsed });
  }
  function toggleMaximized() {
    state.maximized = !state.maximized;
    if (state.maximized && state.collapsed) { state.collapsed = false; }
    if (!state.maximized && state.activeTab === 'shortcuts') { selectTab('summary'); }
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.dataset.maximized = String(state.maximized);
      root.dataset.collapsed = String(state.collapsed);
      const collapseButton = root.querySelector('[data-action="collapse"]');
      if (collapseButton) {
        collapseButton.textContent = state.collapsed ? '+' : '−';
        collapseButton.setAttribute('aria-label', state.collapsed ? 'Expandir painel' : 'Minimizar painel');
        collapseButton.setAttribute('title', state.collapsed ? 'Expandir painel' : 'Minimizar painel');
      }
      const maxButton = root.querySelector('[data-action="maximize"]');
      if (maxButton) {
        maxButton.textContent = state.maximized ? '🗗' : '⛶';
        maxButton.setAttribute('aria-label', state.maximized ? 'Restaurar tamanho' : 'Maximizar painel');
        maxButton.setAttribute('title', state.maximized ? 'Restaurar tamanho' : 'Maximizar painel');
      }
      const shortcutsTab = root.querySelector('.suape-tab[data-tab="shortcuts"]');
      if (shortcutsTab) {
        shortcutsTab.style.setProperty('display', state.maximized ? 'flex' : 'none', 'important');
      }
    }
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.maximized) { toggleMaximized(); }
  });

  function panel(name) { return document.querySelector(`#${ROOT_ID} [data-panel="${name}"]`); }
  function appendCopyRow(container, label, value, mono = false) {
    if (value == null || cleanText(value) === '' || cleanText(value) === '-') return;
    const row = createElement('div', 'suape-data-row');
    const labelElement = createElement('span', '', label);
    const valueElement = createElement('span', `suape-data-value${mono ? ' suape-mono' : ''}`, String(value));
    const button = createElement('button', 'suape-copy', '⧉');
    button.type = 'button'; button.title = `Copiar ${label}`; button.setAttribute('aria-label', `Copiar ${label}`);
    button.addEventListener('click', () => void copyText(value, button));
    row.append(labelElement, valueElement, button); container.appendChild(row);
  }
  function appendSection(container, title, rows) {
    const section = createElement('section', 'suape-section');
    section.appendChild(createElement('h3', 'suape-section-title', title));
    rows(section);
    if (section.children.length > 1) container.appendChild(section);
  }
  function renderSyncStatus(container) {
    const status = createElement('div', 'suape-status', state.syncStatus.message);
    status.dataset.stage = state.syncStatus.stage;
    if (state.syncStatus.retryable) {
      const retry = createElement('button', 'suape-button suape-button-secondary', 'Tentar novamente');
      retry.type = 'button'; retry.addEventListener('click', retrySync); status.appendChild(retry);
    }
    container.appendChild(status);
  }
  function renderSummary(snapshot = state.snapshot) {
    const container = panel('summary'); if (!container) return;
    container.innerHTML = ''; renderSyncStatus(container);
    const process = snapshot?.process; const fallback = snapshot?.fallback || { suapId: getProcessId(), processNumber: getProcessNumber() };
    appendSection(container, 'Processo', (section) => {
      appendCopyRow(section, 'Processo', process?.numProcesso || fallback.processNumber, true);
      appendCopyRow(section, 'SUAP ID', process?.suapId || fallback.suapId, true);
      appendCopyRow(section, 'Caixa', process?.caixa);
    });
    renderProcessFlow(container);
    if (!process) return;
    const full = process.dadosCompletos || {}; const bank = full.dados_bancarios || {}; const taxes = full.retencoes_tributarias || {};
    const invoices = Array.isArray(full.notas_fiscais)
      ? full.notas_fiscais
        .filter((invoice) => invoice && typeof invoice === 'object')
        .map((invoice) => ({
          numero: cleanText(invoice.numero),
          data_emissao: cleanText(invoice.data_emissao),
          valor: cleanText(invoice.valor),
        }))
        .filter((invoice) => invoice.numero || invoice.data_emissao || invoice.valor)
      : [];
    const hasMultipleInvoices = invoices.length > 1;
    const workflow = full.workflow || {};
    appendSection(container, 'Beneficiário', (section) => {
      appendCopyRow(section, 'Nome', process.beneficiario);
      appendCopyRow(section, 'CPF/CNPJ', process.cpfCnpj, true);
      appendCopyRow(section, 'Assunto', process.assunto);
    });
    appendSection(container, 'Documento e pagamento', (section) => {
      appendCopyRow(section, 'Valor', full.val_nf);
      appendCopyRow(section, 'NS', workflow.nsNumero || full.ns_numero, true);
      appendCopyRow(section, 'Contrato', process.contrato || full.contrato_numero, true);
      invoices.forEach((invoice, index) => {
        const suffix = invoices.length > 1 ? ` ${index + 1}` : '';
        appendCopyRow(section, `Nota fiscal${suffix}`, invoice.numero, true);
        appendCopyRow(section, `Emissão${suffix}`, invoice.data_emissao);
        appendCopyRow(section, `Valor NF${suffix}`, invoice.valor);
      });
    });
    appendSection(container, 'Dados bancários', (section) => {
      appendCopyRow(section, 'Banco', bank.banco);
      appendCopyRow(section, 'Agência', bank.agencia, true);
      appendCopyRow(section, 'Conta', bank.conta, true);
    });
    const empenhos = normalizeEmpenhos(full.empenhos);
    appendSection(container, hasMultipleInvoices ? 'Empenhos' : 'Retenções e empenhos', (section) => {
      if (!hasMultipleInvoices) {
        if (taxes.optante_simples_nacional) appendCopyRow(section, 'Regime', 'Optante pelo Simples Nacional');
        [['ISS', taxes.iss], ['INSS', taxes.inss], ['IR', taxes.ir], ['CSLL', taxes.csll], ['COFINS', taxes.cofins], ['PIS/PASEP', taxes.pis_pasep]].forEach(([label, value]) => appendCopyRow(section, label, value));
      }
      empenhos.forEach((value, index) => appendCopyRow(section, `Empenho ${index + 1}`, value, true));
      if (empenhos.length > 1) appendCopyRow(section, 'Todos', empenhos.join(', '), true);
    });
    if (workflow.concluido) appendSection(container, 'Conclusão', (section) => {
      appendCopyRow(section, 'NS registrada', workflow.nsNumero || full.ns_numero, true);
      appendCopyRow(section, 'Concluído em', workflow.concluidoEm ? formatDate(workflow.concluidoEm) : '');
      appendCopyRow(section, 'Concluído por', workflow.concluidoPor);
      appendCopyRow(section, 'Análise', workflow.analiseLiquidacao?.resumo);
    });
  }

  function renderProcessFlow(container) {
    if (!state.flow?.summary) return;
    const summary = state.flow.summary;
    const section = createElement('section', 'suape-flow-card');
    const header = createElement('div', 'suape-flow-header');
    const heading = createElement('div', 'suape-flow-heading');
    heading.append(createElement('span', 'suape-flow-eyebrow', 'Caminho do processo'), createElement('strong', 'suape-flow-title', summary.mappingTitle));
    heading.appendChild(createElement('span', 'suape-flow-version', `v${summary.mappingVersion}`));
    header.appendChild(heading);
    const open = createElement('a', 'suape-flow-open', 'Mapa completo ↗'); open.href = `${SIAGES_ORIGIN}${summary.fullPagePath}`; open.target = '_blank'; open.rel = 'noreferrer'; header.appendChild(open); section.appendChild(header);
    if (state.mappings.length > 1) {
      const chooser = createElement('label', 'suape-flow-chooser'); chooser.appendChild(createElement('span', '', 'Mapeamento aplicado'));
      const select = document.createElement('select'); select.className = 'suape-flow-select';
      state.mappings.forEach((mapping) => { const option = document.createElement('option'); option.value = mapping.id; option.textContent = `${mapping.title} · v${mapping.version}`; option.selected = mapping.id === state.selectedMappingId || mapping.id === summary.mappingId; select.appendChild(option); });
      select.addEventListener('change', async () => { state.selectedMappingId = select.value; const key = getProcessMappingKey(); await storageSet('local', { [key]: state.selectedMappingId }); state.flow = null; renderSummary(); restartBridge(); }); chooser.appendChild(select); section.appendChild(chooser);
    }
    const list = createElement('div', 'suape-flow-list');
    summary.steps.forEach((step) => {
      const item = createElement('div', `suape-flow-step suape-flow-step-${step.status}`);
      const dot = createElement('span', 'suape-flow-dot');
      const body = createElement('div', 'suape-flow-step-body');
      const title = createElement('div', 'suape-flow-step-title'); title.append(createElement('span', 'suape-flow-code', step.code), createElement('strong', '', step.title));
      const meta = createElement('div', 'suape-flow-step-meta', [step.responsible, step.status === 'completed' ? 'Concluída' : step.status === 'current' ? 'Etapa atual' : step.status === 'next' ? 'Próxima etapa' : 'Pendente'].join(' · '));
      body.append(title, meta); if (step.evidence) body.appendChild(createElement('div', 'suape-flow-evidence', `SUAP: ${step.evidence}`)); item.append(dot, body); list.appendChild(item);
    });
    section.appendChild(list);
    if (summary.note) section.appendChild(createElement('div', 'suape-flow-note', summary.note));
    container.appendChild(section);
  }

  function getThemeColors() {
    return state.theme === 'dark'
      ? { panelBg: '#17212f', panelBorder: '#314156', panelText: '#eef4f8', mutedText: '#9aabbc', heading: '#a7f3d0', chipBg: 'rgba(16,185,129,.18)', chipText: '#a7f3d0', metricBg: '#101722', metricBorder: '#314156', itemBg: '#17212f', accent: '#34d399' }
      : { panelBg: '#fff', panelBorder: '#bbf7d0', panelText: '#0f172a', mutedText: '#475569', heading: '#065f46', chipBg: '#ecfdf5', chipText: '#047857', metricBg: '#f8fafc', metricBorder: '#e2e8f0', itemBg: '#fff', accent: '#047857' };
  }
  function ensureFinancePanel() {
    let finance = document.getElementById(FINANCE_PANEL_ID);
    if (!finance) { finance = document.createElement('section'); finance.id = FINANCE_PANEL_ID; finance.setAttribute('aria-live', 'polite'); panel('finance')?.appendChild(finance); }
    return finance;
  }
  function removeFinancePanel() { document.getElementById(FINANCE_PANEL_ID)?.remove(); }
  function renderFinanceLoading(message) {
    const finance = ensureFinancePanel(); finance.innerHTML = '';
    const wrapper = createElement('div', 'suape-status', message || 'Consultando empenhos no SIAGES...'); wrapper.dataset.stage = 'checking'; finance.appendChild(wrapper);
  }
  function renderFinanceEmpty(message) {
    const finance = ensureFinancePanel(); finance.innerHTML = '';
    const section = createElement('section', 'suape-section'); section.append(createElement('h3', 'suape-section-title', 'SIAGES - Empenhos'), createElement('div', 'suape-empty', message)); finance.appendChild(section);
  }
  function renderMetric(label, value, colors) {
    const cell = document.createElement('div'); Object.assign(cell.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '8px', padding: '8px', background: colors.metricBg });
    const small = createElement('span', '', label); Object.assign(small.style, { display: 'block', color: colors.mutedText, fontSize: '11px', marginBottom: '3px' });
    const strong = createElement('strong', '', formatCurrency(value)); Object.assign(strong.style, { display: 'block', color: colors.panelText, fontSize: '13px' }); cell.append(small, strong); return cell;
  }
  function renderFinanceSummary(summary) {
    state.financeSummary = summary;
    state.hasFinanceSummary = true;
    window.__siagesLatestFinanceSummary = summary;
    persistProcessState();
    if (!summary || summary.status === 'missing-process' || summary.status === 'missing-beneficiary') { removeFinancePanel(); persistProcessState(); return; }
    if (summary.status === 'empty') { renderFinanceEmpty(summary.escopoContrato ? 'Nenhum empenho do beneficiário foi encontrado para o contrato deste processo.' : 'Nenhum empenho foi encontrado para o beneficiário identificado neste processo.'); return; }
    const colors = getThemeColors(); const finance = ensureFinancePanel(); finance.innerHTML = '';
    const wrapper = createElement('section', 'suape-section'); Object.assign(wrapper.style, { background: colors.panelBg, color: colors.panelText, borderColor: colors.panelBorder });
    const header = document.createElement('div'); Object.assign(header.style, { padding: '12px', borderBottom: `1px solid ${colors.metricBorder}` });
    const beneficiary = createElement('span', '', summary.beneficiario?.nome || summary.beneficiario?.documento || 'Beneficiário identificado'); Object.assign(beneficiary.style, { display: 'block', marginTop: '4px', color: colors.panelText }); header.append(beneficiary);
    if (summary.contrato?.numero) { const chip = createElement('span', '', `Filtrado pelo contrato ${summary.contrato.numero}`); Object.assign(chip.style, { display: 'inline-block', marginTop: '7px', padding: '3px 7px', borderRadius: '999px', background: colors.chipBg, color: colors.chipText, fontSize: '11px', fontWeight: '700' }); header.appendChild(chip); }
    const totals = document.createElement('div'); Object.assign(totals.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px', padding: '10px 12px' }); totals.append(renderMetric('Empenhado', summary.totais?.empenhado, colors), renderMetric('Saldo', summary.totais?.saldo, colors));
    const list = document.createElement('div'); Object.assign(list.style, { padding: '0 12px 12px', display: 'grid', gap: '8px' });
    (summary.empenhos || []).slice(0, 6).forEach((commitment) => {
      const item = document.createElement('article'); Object.assign(item.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '9px', padding: '9px', background: colors.itemBg });
      const number = createElement('strong', '', commitment.numero || 'Empenho sem \u00famero');
      const balance = createElement('span', '', `Saldo ${formatCurrency(commitment.saldo)}`); Object.assign(balance.style, { color: colors.accent, fontWeight: '700' });
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', `Exibir liquida\u00e7\u00f5es de ${commitment.numero || 'empenho'}`);
      Object.assign(toggle.style, { display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '8px', border: '0', padding: '0', background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }); toggle.append(number, balance); item.appendChild(toggle);
      const values = createElement('div', '', `Empenhado ${formatCurrency(commitment.empenhado)} \u00b7 Saldo ${formatCurrency(commitment.saldo)}`); Object.assign(values.style, { marginTop: '5px', color: colors.mutedText, fontSize: '11px' }); item.appendChild(values);
      if ((commitment.liquidacoes || []).length) {
        const liquidations = document.createElement('div'); liquidations.className = 'suape-liquidations'; Object.assign(liquidations.style, { marginTop: '9px', display: 'none', gap: '5px' }); liquidations.setAttribute('aria-hidden', 'true'); liquidations.appendChild(createElement('strong', '', 'Liquida\u00e7\u00f5es em cache'));
        commitment.liquidacoes.forEach((liquidation) => {
          const row = document.createElement('div'); Object.assign(row.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '7px', padding: '7px', background: colors.metricBg, fontSize: '11px' });
          row.append(createElement('strong', '', liquidation.numero || 'NF sem \u00famero'), createElement('div', '', [formatDate(liquidation.data), liquidation.situacao].filter(Boolean).join(' - ')), createElement('div', '', liquidation.valor != null ? formatCurrency(liquidation.valor) : '-')); liquidations.appendChild(row);
        });
        item.appendChild(liquidations);
        toggle.addEventListener('click', () => {
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded)); liquidations.setAttribute('aria-hidden', String(expanded)); liquidations.style.display = expanded ? 'none' : 'grid';
        });
      }
      list.appendChild(item);
    });
    if ((summary.empenhos || []).length > 6) list.appendChild(createElement('div', 'suape-empty', `+${summary.empenhos.length - 6} empenho(s) adicional(is)`));
    wrapper.append(header, totals, list); finance.appendChild(wrapper);
    persistProcessState();
  }

  function renderAiPanel() {
    const container = panel('ai'); container.innerHTML = '';
    const section = createElement('section', 'suape-section'); section.appendChild(createElement('h3', 'suape-section-title', 'Gerador de documentos com IA'));
    const body = createElement('div', 'suape-form'); body.style.padding = '11px'; body.appendChild(createElement('p', 'suape-help', 'Abra o gerador completo para revisar, editar, copiar ou clonar o despacho no SUAP.'));
    const button = createElement('button', 'suape-button suape-full', 'Gerar documento'); button.type = 'button'; button.addEventListener('click', openModal); body.appendChild(button); section.appendChild(body); container.appendChild(section);
  }
  function renderShortcuts(filter = '') {
    const container = panel('shortcuts'); container.innerHTML = '';
    const help = createElement('p', 'suape-help', 'Digite um atalho seguido de espaço em qualquer campo de texto. Os atalhos são sincronizados pelo navegador.'); container.appendChild(help);
    const form = createElement('form', 'suape-form'); form.innerHTML = '<label>Atalho<input class="suape-input" name="trigger" placeholder="/exemplo" autocomplete="off"></label><label>Texto expandido<textarea class="suape-input" name="expansion" placeholder="Texto completo..."></textarea></label><div class="suape-form-actions"><button class="suape-button" type="submit">Salvar atalho</button><button class="suape-button suape-button-secondary" type="button" data-cancel hidden>Cancelar</button></div><div class="suape-help" data-form-message aria-live="polite"></div>';
    if (state.editingKey) { form.elements.trigger.value = state.editingKey; form.elements.expansion.value = state.snippets[state.editingKey]; form.querySelector('[data-cancel]').hidden = false; }
    form.addEventListener('submit', saveShortcut); form.querySelector('[data-cancel]').addEventListener('click', () => { state.editingKey = null; renderShortcuts(filter); }); container.appendChild(form);
    const toolbar = createElement('div', 'suape-toolbar'); const search = createElement('input', 'suape-input'); search.placeholder = 'Buscar atalhos'; search.value = filter; search.addEventListener('input', () => renderShortcuts(search.value)); toolbar.appendChild(search); container.appendChild(toolbar);
    const list = createElement('div', 'suape-snippet-list'); const query = filter.toLowerCase();
    Object.keys(state.snippets).filter((key) => key.includes(query) || state.snippets[key].toLowerCase().includes(query)).sort().forEach((key) => {
      const item = createElement('div', 'suape-snippet'); item.append(createElement('span', 'suape-trigger', key), createElement('span', 'suape-expansion', state.snippets[key]));
      const actions = createElement('div', 'suape-snippet-actions'); const edit = createElement('button', 'suape-icon-button', '✎'); edit.type = 'button'; edit.setAttribute('aria-label', `Editar ${key}`); edit.addEventListener('click', () => { state.editingKey = key; renderShortcuts(filter); });
      const remove = createElement('button', 'suape-icon-button', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remover ${key}`); remove.addEventListener('click', () => void deleteShortcut(key, filter)); actions.append(edit, remove); item.appendChild(actions); list.appendChild(item);
    });
    if (!list.children.length) list.appendChild(createElement('div', 'suape-empty', 'Nenhum atalho encontrado.')); container.appendChild(list); isolateShortcutsLayout(container);
  }
  async function saveShortcut(event) {
    event.preventDefault(); const form = event.currentTarget; const message = form.querySelector('[data-form-message]');
    const key = normalizeSnippetKey(form.elements.trigger.value); const value = form.elements.expansion.value.trim();
    if (!key || key === '/') { message.textContent = 'Informe um atalho válido.'; return; }
    if (!value) { message.textContent = 'Informe o texto expandido.'; return; }
    if (state.snippets[key] && key !== state.editingKey) { message.textContent = 'Este atalho já existe. Edite o item existente.'; return; }
    const next = { ...state.snippets }; if (state.editingKey && state.editingKey !== key) delete next[state.editingKey]; next[key] = value; state.snippets = next; state.editingKey = null;
    await storageSet('sync', { [SNIPPETS_KEY]: next }); renderShortcuts();
  }
  async function deleteShortcut(key, filter) { const next = { ...state.snippets }; delete next[key]; state.snippets = next; await storageSet('sync', { [SNIPPETS_KEY]: next }); renderShortcuts(filter); }

  function isolateAuthFormLayout(form) {
    const force = (element, styles) => Object.entries(styles).forEach(([property, value]) => element.style.setProperty(property, value, 'important'));
    force(form, { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', gap: '10px', clear: 'both' });
    form.querySelectorAll(':scope > label').forEach((label) => force(label, { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', gap: '4px', float: 'none', position: 'static', width: 'auto', height: 'auto', margin: '0', padding: '0', opacity: '1', visibility: 'visible', 'text-align': 'left' }));
    form.querySelectorAll('.suape-input').forEach((input) => force(input, { display: 'block', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', float: 'none', position: 'static', width: '100%', 'max-width': 'none', height: '38px', margin: '0', opacity: '1', visibility: 'visible' }));
    const actions = form.querySelector('.suape-auth-actions'); force(actions, { display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '8px' });
    actions.querySelectorAll('button').forEach((button) => force(button, { float: 'none', position: 'static', width: '100%', margin: '0' }));
  }

  function isolateShortcutsLayout(container) {
    const force = (element, styles) => Object.entries(styles).forEach(([property, value]) => element?.style.setProperty(property, value, 'important'));
    const form = container.querySelector('form.suape-form');
    force(form, { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', gap: '9px', clear: 'both', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', width: '100%' });
    form?.querySelectorAll(':scope > label').forEach((label) => force(label, { display: 'grid', 'grid-template-columns': 'minmax(0, 1fr)', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', gap: '4px', float: 'none', position: 'static', width: 'auto', height: 'auto', margin: '0', padding: '0', 'text-align': 'left', 'writing-mode': 'horizontal-tb', 'text-orientation': 'mixed' }));
    form?.querySelectorAll('.suape-input').forEach((input) => force(input, { display: 'block', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', float: 'none', position: 'static', width: '100%', 'max-width': 'none', 'min-width': '0', height: 'auto', margin: '0', 'writing-mode': 'horizontal-tb', 'text-orientation': 'mixed', 'white-space': 'normal' }));
    const actions = form?.querySelector('.suape-form-actions');
    force(actions, { display: 'flex', 'align-items': 'center', gap: '7px', 'grid-area': 'auto', 'grid-column': '1 / -1', 'grid-row': 'auto', width: '100%' });
    actions?.querySelectorAll('button').forEach((button) => force(button, { float: 'none', position: 'static', width: 'auto', 'min-width': '0', margin: '0', 'writing-mode': 'horizontal-tb' }));
    force(container.querySelector('.suape-toolbar'), { display: 'flex', 'align-items': 'center', gap: '7px', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', width: '100%' });
    container.querySelectorAll('.suape-snippet').forEach((item) => {
      force(item, { display: 'grid', 'grid-template-columns': 'max-content minmax(0, 1fr) max-content', 'align-items': 'center', gap: '8px', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', width: '100%', 'min-width': '0', overflow: 'hidden' });
      item.children && Array.from(item.children).forEach((child) => force(child, { display: child.classList.contains('suape-snippet-actions') ? 'flex' : 'block', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', float: 'none', position: 'static', width: 'auto', 'min-width': '0', 'max-width': '100%', 'writing-mode': 'horizontal-tb', 'text-orientation': 'mixed' }));
    });
  }

  function isolateTabTitles(root) {
    const force = (element, styles) => Object.entries(styles).forEach(([property, value]) => element.style.setProperty(property, value, 'important'));
    root.querySelectorAll('.suape-tab').forEach((tab) => {
      const isShortcuts = tab.dataset.tab === 'shortcuts';
      const displayVal = (isShortcuts && !state.maximized) ? 'none' : 'flex';
      force(tab, { display: displayVal, 'align-items': 'center', 'justify-content': 'center', 'grid-area': 'auto', 'grid-column': 'auto', 'grid-row': 'auto', float: 'none', position: 'static', width: 'auto', 'min-width': '0', 'writing-mode': 'horizontal-tb', 'text-orientation': 'mixed', 'white-space': 'nowrap', 'text-align': 'center' });
    });
  }

  function renderSettings() {
    const container = panel('settings'); container.innerHTML = '';
    const themeSection = createElement('section', 'suape-section'); themeSection.appendChild(createElement('h3', 'suape-section-title', 'Aparência'));
    const themeBody = createElement('div', 'suape-form'); themeBody.style.padding = '11px'; const themeButton = createElement('button', 'suape-button suape-button-secondary suape-full', state.theme === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'); themeButton.type = 'button'; themeButton.addEventListener('click', async () => { await toggleTheme(); renderSettings(); }); themeBody.appendChild(themeButton); themeSection.appendChild(themeBody); container.appendChild(themeSection);
    const authSection = createElement('section', 'suape-section'); authSection.appendChild(createElement('h3', 'suape-section-title', 'Acesso ao SIAGES'));
    const form = createElement('form', 'suape-form suape-auth-form'); form.noValidate = true; form.style.padding = '11px'; form.innerHTML = '<label for="suape-auth-email"><span>E-mail cadastrado no SIAGES</span><input id="suape-auth-email" class="suape-input" name="email" type="text" inputmode="email" autocomplete="username" placeholder="nome@dominio.com" required></label><label for="suape-auth-password"><span>Senha do SIAGES</span><input id="suape-auth-password" class="suape-input" name="password" type="password" autocomplete="current-password" required></label><div class="suape-auth-actions"><button class="suape-button" type="submit">Entrar</button><button class="suape-button suape-button-secondary" type="button" data-signout>Sair</button></div><div class="suape-help suape-auth-message" data-auth-message aria-live="polite">Use seu e-mail e senha cadastrados no SIAGES, não a matrícula e senha do SUAP.</div>';
    isolateAuthFormLayout(form); form.addEventListener('submit', signIn); form.querySelector('[data-signout]').addEventListener('click', signOut); authSection.appendChild(form); container.appendChild(authSection); void updateAuthStatus(form);
  }
  async function updateAuthStatus(form) {
    const requestId = String(Number(form.dataset.authStatusRequest || 0) + 1);
    form.dataset.authStatusRequest = requestId;
    const message = form.querySelector('[data-auth-message]'); const session = await globalThis.SiagesExtensionAuth?.getSession();
    if (form.dataset.authStatusRequest !== requestId) return;
    message.dataset.state = session?.accessToken ? 'success' : '';
    message.textContent = session?.accessToken ? 'Sessão ativa. Os dados usam as permissões do seu usuário.' : 'Entre para consultar e sincronizar processos.';
  }
  async function signIn(event) {
    event.preventDefault(); const form = event.currentTarget; const message = form.querySelector('[data-auth-message]'); const button = form.querySelector('button[type="submit"]');
    form.dataset.authStatusRequest = String(Number(form.dataset.authStatusRequest || 0) + 1);
    const emailInput = form.querySelector('input[name="email"]'); const passwordInput = form.querySelector('input[name="password"]');
    const email = emailInput?.value.trim() || ''; const password = passwordInput?.value || '';
    message.dataset.state = 'error';
    if (!email || !password) { message.textContent = 'Informe o e-mail e a senha cadastrados no SIAGES.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.textContent = 'Use o e-mail cadastrado no SIAGES. A matrícula do SUAP não autentica neste campo.'; return; }
    button.disabled = true; message.dataset.state = 'loading'; message.textContent = 'Autenticando...';
    try {
      if (!globalThis.SiagesExtensionAuth?.signIn) throw new Error('O serviço de autenticação da extensão não está disponível.');
      await globalThis.SiagesExtensionAuth.signIn(email, password);
      if (passwordInput) passwordInput.value = ''; message.dataset.state = 'success'; message.textContent = 'Sessão ativa.'; restartBridge();
    } catch (error) { message.dataset.state = 'error'; message.textContent = formatAuthError(error); } finally { button.disabled = false; }
  }
  async function signOut(event) { const form = event.currentTarget.closest('form'); const message = form.querySelector('[data-auth-message]'); try { if (!globalThis.SiagesExtensionAuth?.signOut) throw new Error('O serviço de autenticação da extensão não está disponível.'); await globalThis.SiagesExtensionAuth.signOut(); message.dataset.state = ''; message.textContent = 'Sessão encerrada.'; } catch (error) { message.dataset.state = 'error'; message.textContent = formatAuthError(error); } }

  function closeModal() { document.getElementById(MODAL_ID)?.remove(); }

  function documentReviewLabel(documentType) {
    return documentType === 'etp' ? 'Estudo Técnico Preliminar' : 'Termo de Referência';
  }

  function setDocumentReviewButtonState(button, stateValue) {
    if (!button) return;
    button.dataset.state = stateValue;
    button.disabled = stateValue === 'loading';
    button.setAttribute('aria-busy', String(stateValue === 'loading'));
  }

  function createDocumentReviewSlot(link, source, documentType, title) {
    const existing = Array.from(document.querySelectorAll('[data-siages-suap-document-ai-id]')).some((element) => element.getAttribute('data-siages-suap-document-ai-id') === source.documentId);
    if (existing) return;

    const slot = document.createElement('span');
    slot.className = 'siages-suap-document-ai-slot';
    slot.dataset.siagesSuapDocumentAiId = source.documentId;
    slot.dataset.theme = state.theme;
    slot.setAttribute('data-document-type', documentType);

    const analyzeButton = document.createElement('button');
    analyzeButton.type = 'button';
    analyzeButton.className = 'siages-suap-document-ai-button';
    analyzeButton.dataset.action = 'analyze-document';
    analyzeButton.title = `Analisar ${documentReviewLabel(documentType)} com IA`;
    analyzeButton.setAttribute('aria-label', `Analisar ${documentReviewLabel(documentType)} com IA`);
    analyzeButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm6.3 10.2.8 2.7 2.7.8-2.7.8-.8 2.7-.8-2.7-2.7-.8 2.7-.8.8-2.7ZM5.2 14l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z"/></svg>`;
    analyzeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDocumentReviewButtonState(analyzeButton, 'loading');
      void getExtensionSession().catch(() => null).then((session) => {
        openDocumentAnalysisModal({ documentId: source.documentId, documentTitle: title, documentType, documentOriginalPath: source.originalPath, button: analyzeButton, session });
      });
    });

    const savedButton = document.createElement('button');
    savedButton.type = 'button';
    savedButton.className = 'siages-suap-document-ai-button';
    savedButton.dataset.action = 'view-saved-analysis';
    savedButton.title = `Consultar última análise salva de ${documentReviewLabel(documentType)}`;
    savedButton.setAttribute('aria-label', `Consultar última análise salva de ${documentReviewLabel(documentType)}`);
    savedButton.innerHTML = "<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" focusable=\"false\"><path d=\"M3 12a9 9 0 1 0 3-6.7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M3 4v4h4M12 7v5l3 2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>";
    savedButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDocumentReviewButtonState(savedButton, 'loading');
      void getExtensionSession().catch(() => null).then((session) => {
        openDocumentAnalysisModal({ documentId: source.documentId, documentTitle: title, documentType, documentOriginalPath: source.originalPath, reviewMode: 'latest', button: savedButton, session });
      });
    });

    slot.append(analyzeButton, savedButton);
    link.insertAdjacentElement('afterend', slot);
  }
  function scanDocumentCards() {
    if (!getProcessId()) return;
    const links = Array.from(document.querySelectorAll('a[href*="/documento_eletronico/visualizar_documento"]'));
    links.forEach((link) => {
      const anchor = link;
      const source = getDocumentSource(anchor);
      if (!source) return;
      const title = cleanText(anchor.textContent);
      const documentType = cleanText(anchor.querySelector('strong')?.textContent).replace(/:\s*$/, '');
      const reviewType = classifyDocumentForAnalysis(title, documentType);
      if (!reviewType) return;
      createDocumentReviewSlot(anchor, source, reviewType, title || documentType);
    });
    document.querySelectorAll('.siages-suap-document-ai-slot').forEach((slot) => { slot.dataset.theme = state.theme; });
  }

  function installDocumentAnalysis() {
    scanDocumentCards();
    if (documentAnalysisObserver || !document.body) return;
    let queued = false;
    documentAnalysisObserver = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => { queued = false; scanDocumentCards(); }, 0);
    });
    documentAnalysisObserver.observe(document.body, { childList: true, subtree: true });
  }

  function disposeDocumentAnalysis() {
    documentAnalysisObserver?.disconnect();
    documentAnalysisObserver = null;
    closeDocumentAnalysisModal();
  }

  function isValidDocumentPdfRequest(event, frame, documentInfo) {
    const message = event.data;
    const payload = message?.payload;
    if (event.origin !== SIAGES_ORIGIN || event.source !== frame.contentWindow || message?.source !== 'siages' || message.type !== 'siages:suap-document-pdf-request' || message.version !== 1) return false;
    if (payload?.suapId !== getProcessId() || payload?.documentId !== documentInfo.documentId) return false;
    return payload.documentOriginalPath === documentInfo.documentOriginalPath;
  }

  function closeDocumentAnalysisModal() {
    if (documentAnalysisCleanup) {
      documentAnalysisCleanup();
      return;
    }
    document.getElementById(DOCUMENT_ANALYSIS_MODAL_ID)?.remove();
  }

  function openDocumentAnalysisModal(documentInfo) {
    if (document.getElementById(DOCUMENT_ANALYSIS_MODAL_ID)) return false;
    const session = documentInfo.session;
    const context = {
      source: 'siages-suap-extension', type: 'siages:suap-document-analysis-context', version: 1,
      payload: {
        suapId: getProcessId(), processNumber: getProcessNumber(), processUrl: location.origin + location.pathname,
        documentId: documentInfo.documentId, documentTitle: documentInfo.documentTitle, documentType: documentInfo.documentType,
        documentOriginalPath: documentInfo.documentOriginalPath,
        ...(documentInfo.reviewMode ? { reviewMode: documentInfo.reviewMode } : {}),
        ...(session ? { extensionSession: { accessToken: session.accessToken, refreshToken: session.refreshToken } } : {}),
      },
    };
    const overlay = document.createElement('div');
    overlay.id = DOCUMENT_ANALYSIS_MODAL_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Análise de ${documentReviewLabel(documentInfo.documentType)}`);
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(15,23,42,.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' });
    const modalPanel = document.createElement('div');
    Object.assign(modalPanel.style, { position: 'relative', width: 'min(1120px,96vw)', height: 'min(880px,94vh)', overflow: 'hidden', borderRadius: '12px', background: '#18181b', boxShadow: '0 25px 50px -12px rgba(0,0,0,.55)' });
    const frame = document.createElement('iframe');
    frame.id = DOCUMENT_ANALYSIS_IFRAME_ID;
    frame.src = `${SIAGES_ORIGIN}/suap-extensao/documento-analise`;
    frame.title = `Análise de ${documentReviewLabel(documentInfo.documentType)}`;
    frame.allow = 'clipboard-read; clipboard-write';
    Object.assign(frame.style, { width: '100%', height: '100%', border: '0' });
    let pdfInFlight = false;
    const postContext = () => frame.contentWindow?.postMessage(context, SIAGES_ORIGIN);
    const cleanup = () => {
      window.removeEventListener('message', receive);
      frame.removeEventListener('load', postContext);
      if (documentInfo.button) setDocumentReviewButtonState(documentInfo.button, 'idle');
      if (documentAnalysisCleanup === cleanup) documentAnalysisCleanup = null;
      overlay.remove();
    };
    const sendPdfError = (message) => frame.contentWindow?.postMessage({ source: 'siages-suap-extension', type: 'siages:suap-document-pdf-result', version: 1, payload: { suapId: getProcessId(), documentId: documentInfo.documentId, error: message } }, SIAGES_ORIGIN);
    const receive = async (event) => {
      if (event.origin !== SIAGES_ORIGIN || event.source !== frame.contentWindow) return;
      if (event.data?.source === 'siages' && event.data?.type === 'siages:suap-document-analysis-ready' && event.data?.version === 1) { postContext(); return; }
      if (event.data?.source === 'siages' && event.data?.type === 'siages:suap-document-analysis-close' && event.data?.version === 1) { cleanup(); return; }
      if (!isValidDocumentPdfRequest(event, frame, documentInfo) || pdfInFlight) return;
      pdfInFlight = true;
      try {
        const response = await fetch(documentInfo.documentOriginalPath, { credentials: 'include' });
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (!response.ok) throw new Error(`O SUAP respondeu ${response.status}.`);
        if (contentLength > DOCUMENT_REVIEW_MAX_BYTES) throw new Error('O PDF excede o limite de 20 MB para análise.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > DOCUMENT_REVIEW_MAX_BYTES) throw new Error('O PDF excede o limite de 20 MB para análise.');
        const signature = new TextDecoder().decode(bytes.slice(0, 4));
        if (signature !== '%PDF') throw new Error('O SUAP não devolveu um PDF válido.');
        frame.contentWindow?.postMessage({ source: 'siages-suap-extension', type: 'siages:suap-document-pdf-result', version: 1, payload: { suapId: getProcessId(), documentId: documentInfo.documentId, bytes } }, SIAGES_ORIGIN, [bytes]);
      } catch (error) {
        sendPdfError(error instanceof Error ? error.message : 'Falha ao baixar o PDF do documento.');
      } finally { pdfInFlight = false; }
    };
    documentAnalysisCleanup = cleanup;
    frame.addEventListener('load', postContext);
    window.addEventListener('message', receive);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) cleanup(); });
    modalPanel.append(frame); overlay.appendChild(modalPanel); document.body.appendChild(overlay);
    return true;
  }
  function openModal() {
    if (document.getElementById(MODAL_ID)) return; const context = buildContext(); if (!context) return;
    const overlay = document.createElement('div'); overlay.id = MODAL_ID; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(15,23,42,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' });
    const modalPanel = document.createElement('div'); Object.assign(modalPanel.style, { position: 'relative', width: 'min(1240px,96vw)', height: 'min(920px,94vh)', overflow: 'hidden', borderRadius: '12px', background: '#fff' });
    const frame = document.createElement('iframe'); frame.id = IFRAME_ID; frame.src = `${SIAGES_ORIGIN}/suap-extensao/despacho`; frame.title = 'Gerador de Despacho de Liquidação do SIAGES'; frame.allow = 'clipboard-read; clipboard-write'; Object.assign(frame.style, { width: '100%', height: '100%', border: '0' });
    const receive = (event) => { if (isSiagesFrameMessage(event, frame, 'siages:suap-dispatch-ready')) frame.contentWindow?.postMessage(context, SIAGES_ORIGIN); if (isSiagesFrameMessage(event, frame, 'siages:suap-dispatch-close')) cleanup(); };
    const cleanup = () => { window.removeEventListener('message', receive); closeModal(); }; frame.addEventListener('load', () => frame.contentWindow?.postMessage(context, SIAGES_ORIGIN)); window.addEventListener('message', receive); overlay.addEventListener('click', (event) => { if (event.target === overlay) cleanup(); }); modalPanel.append(frame); overlay.appendChild(modalPanel); document.body.appendChild(overlay);
  }

  async function downloadProcessPdfFromSuap(suapId, onProgress = () => undefined) {
    const fetchText = async (path) => { const response = await fetch(path, { credentials: 'include' }); if (!response.ok) throw new Error(`O SUAP respondeu ${response.status}.`); return response.text(); };
    onProgress('Localizando o visualizador do processo...'); const detailHtml = await fetchText(`/processo_eletronico/processo/${suapId}/`);
    const viewerPath = detailHtml.match(new RegExp(`/processo_eletronico/visualizar_processo/${suapId}/`))?.[0]; if (!viewerPath) throw new Error('Visualizador do processo não encontrado.');
    const viewerHtml = await fetchText(viewerPath); const triggerPath = viewerHtml.match(/href="([^"]*\/processo_eletronico\/imprimir_processo_celery\/[^"]*)"/)?.[1]; if (!triggerPath) throw new Error('Comando de geração do PDF não encontrado.');
    onProgress('Solicitando a geração do PDF...'); const triggerHtml = await fetchText(triggerPath); const uuid = triggerHtml.match(/process_progress\/[01]\/([a-f0-9-]+)\//)?.[1]; if (!uuid) throw new Error('Identificador da geração do PDF não encontrado.');
    let attempts = 120; while (attempts > 0) { await new Promise((resolve) => window.setTimeout(resolve, 5000)); const text = await fetchText(`/djtools/process_progress/0/${uuid}/`); const parts = text.split('::'); onProgress(`Gerando PDF: ${parts[0] || '?'}%`); if ((parts[1] || '').toLowerCase().includes('sucesso')) break; if ((parts[4] || '').trim()) throw new Error(parts[4]); attempts -= 1; }
    if (!attempts) throw new Error('Tempo esgotado na geração do PDF.'); const response = await fetch(`/djtools/process_progress/1/${uuid}/`, { credentials: 'include' }); if (!response.ok) throw new Error('Não foi possível baixar o PDF gerado.');
    const bytes = await response.arrayBuffer(); const signature = new TextDecoder().decode(bytes.slice(0, 4)); if (signature !== '%PDF') throw new Error('O SUAP não devolveu um PDF válido.'); return bytes;
  }

  function retrySync() { const frame = document.getElementById(BRIDGE_FRAME_ID); const suapId = getProcessId(); if (frame?.contentWindow && suapId) frame.contentWindow.postMessage({ source: 'siages-suap-extension', type: 'siages:suap-process-retry', version: 1, payload: { suapId } }, SIAGES_ORIGIN); }
  function restartBridge() { document.getElementById(BRIDGE_FRAME_ID)?.remove(); openProcessBridge(); }
  function openProcessBridge() {
    if (!getProcessId() || document.getElementById(BRIDGE_FRAME_ID)) return;
    if (!state.hasFinanceSummary) renderFinanceLoading();
    void getExtensionSession().then((session) => {
      if (document.getElementById(BRIDGE_FRAME_ID)) return; const context = buildContext(session); const frame = document.createElement('iframe'); frame.id = BRIDGE_FRAME_ID; frame.src = `${SIAGES_ORIGIN}/suap-extensao/processo-info`; frame.title = 'Sincronização do processo com o SIAGES'; Object.assign(frame.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', border: '0' });
      const postContext = () => frame.contentWindow?.postMessage(context, SIAGES_ORIGIN);
      const receive = async (event) => {
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-info-ready')) { postContext(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-snapshot')) { state.snapshot = event.data.payload; persistProcessState(); renderSummary(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-sync-status')) { state.syncStatus = event.data.payload; persistProcessState(); renderSummary(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-flow')) { state.flow = event.data.payload; state.mappings = event.data.payload?.mappings || []; persistProcessState(); renderSummary(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-finance-summary')) { renderFinanceSummary(event.data.payload); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-pdf-request')) {
          const suapId = event.data.payload?.suapId; if (suapId !== getProcessId()) return;
          try { const bytes = await downloadProcessPdfFromSuap(suapId, (message) => { state.syncStatus = { stage: 'requesting-pdf', message }; renderSummary(); }); frame.contentWindow?.postMessage({ source: 'siages-suap-extension', type: 'siages:suap-process-pdf-result', version: 1, payload: { suapId, bytes } }, SIAGES_ORIGIN, [bytes]); }
          catch (error) { frame.contentWindow?.postMessage({ source: 'siages-suap-extension', type: 'siages:suap-process-pdf-result', version: 1, payload: { suapId, error: error instanceof Error ? error.message : 'Falha ao gerar o PDF.' } }, SIAGES_ORIGIN); }
        }
      };
      frame.addEventListener('load', postContext); window.addEventListener('message', receive); document.body.appendChild(frame);
    }).catch((error) => { state.syncStatus = { stage: 'error', message: error instanceof Error ? error.message : 'Não foi possível autenticar.', retryable: false }; renderSummary(); renderFinanceEmpty(state.syncStatus.message); });
  }

  function fitToolkitToHost(host, root) {
    if (!host || !root) return;
    let target = host;
    let style = window.getComputedStyle(target);
    let pt = parseFloat(style.paddingTop) || 0;
    let pr = parseFloat(style.paddingRight) || 0;
    let pl = parseFloat(style.paddingLeft) || 0;

    if ((pt === 0 && pr === 0 && pl === 0) && target.parentElement) {
      const parentStyle = window.getComputedStyle(target.parentElement);
      const parentPt = parseFloat(parentStyle.paddingTop) || 0;
      const parentPr = parseFloat(parentStyle.paddingRight) || 0;
      const parentPl = parseFloat(parentStyle.paddingLeft) || 0;
      if (parentPt > 0 || parentPr > 0 || parentPl > 0) {
        target = target.parentElement;
        style = parentStyle;
        pt = parentPt; pr = parentPr; pl = parentPl;
      }
    }

    if (pt > 0 || pr > 0 || pl > 0) {
      root.style.setProperty('margin-top', `-${pt}px`, 'important');
      root.style.setProperty('margin-right', `-${pr}px`, 'important');
      root.style.setProperty('margin-left', `-${pl}px`, 'important');
      root.style.setProperty('width', `calc(100% + ${pl + pr}px)`, 'important');
      root.style.setProperty('max-width', `calc(100% + ${pl + pr}px)`, 'important');
    }

    const borderRadius = style.borderRadius;
    if (borderRadius && borderRadius !== '0px') {
      const shell = root.querySelector('.suape-shell');
      if (shell) {
        shell.style.borderTopLeftRadius = borderRadius;
        shell.style.borderTopRightRadius = borderRadius;
      }
    }
  }

  async function installToolkit() {
    if (!getProcessId() || document.getElementById(ROOT_ID)) return;
    const [theme, collapsed, storedSnippets, selectedMappingId] = await Promise.all([storageGet('local', THEME_KEY, 'dark'), storageGet('local', COLLAPSED_KEY, false), storageGet('sync', SNIPPETS_KEY, null), storageGet('local', getProcessMappingKey(), '')]);
    const hasPersistedProcessState = await restorePersistedProcessState();
    state.theme = theme === 'light' ? 'light' : 'dark'; state.collapsed = Boolean(collapsed); state.selectedMappingId = typeof selectedMappingId === 'string' ? selectedMappingId : ''; state.snippets = storedSnippets && Object.keys(storedSnippets).length ? storedSnippets : { ...DEFAULT_SNIPPETS };
    if (!storedSnippets) await storageSet('sync', { [SNIPPETS_KEY]: state.snippets });
    const root = buildShell(); isolateTabTitles(root); const host = findToolkitHost(); host.prepend(root); fitToolkitToHost(host, root);
    renderSummary(hasPersistedProcessState ? state.snapshot : { process: null, fallback: { suapId: getProcessId(), processNumber: getProcessNumber(), processUrl: getProcessUrl() } });
    renderShortcuts(); renderAiPanel(); renderSettings();
    if (state.hasFinanceSummary) renderFinanceSummary(state.financeSummary);
    selectTab(state.activeTab || 'summary'); installDocumentAnalysis(); openProcessBridge();
  }
  window.addEventListener('pagehide', persistProcessState);
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => { if (area === 'sync' && changes[SNIPPETS_KEY]) { state.snippets = changes[SNIPPETS_KEY].newValue || { ...DEFAULT_SNIPPETS }; renderShortcuts(); } });
  window.__siagesSuapProcessDocument = { getProcessId, getProcessNumber, buildContext, parseProcessRoute, installToolkit, installButton: installToolkit, installFinancePanel: openProcessBridge, openFinanceBridge: openProcessBridge, renderFinanceSummary, openModal, closeModal, openDocumentAnalysisModal, closeDocumentAnalysisModal, scanDocumentCards, installDocumentAnalysis, disposeDocumentAnalysis, classifyDocumentForAnalysis, downloadProcessPdfFromSuap, normalizeSnippetKey, selectTab, retrySync, toggleTheme, toggleMaximized, toggleCollapsed };
  if (!window.__SIAGES_SUAP_PROCESS_TEST__) void installToolkit();
})();
