(function () {
  const ROOT_ID = 'siages-suap-toolkit';
  const MODAL_ID = 'siages-suap-dispatch-modal';
  const IFRAME_ID = 'siages-suap-dispatch-frame';
  const BRIDGE_FRAME_ID = 'siages-suap-finance-frame';
  const FINANCE_PANEL_ID = 'siages-suap-finance-panel';
  const SIAGES_ORIGIN = 'https://www.siages.com.br';
  const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
  const SESSION_KEY = 'siages-extension-session';
  const THEME_KEY = 'siages-toolkit-theme';
  const COLLAPSED_KEY = 'siages-toolkit-collapsed';
  const SNIPPETS_KEY = 'siages-snippets';
  const DEFAULT_SNIPPETS = {
    '/ifrn': 'Instituto Federal de Educação, Ciência e Tecnologia do Rio Grande do Norte',
    '/cn': 'Currais Novos',
    '/lei14133': 'Lei nº 14.133, de 1º de abril de 2021 (Lei de Licitações e Contratos Administrativos)',
    '/atpub': 'Atenciosamente, servidor público do IFRN – Campus Currais Novos',
  };
  const state = {
    activeTab: 'summary', theme: 'dark', collapsed: false, snapshot: null,
    syncStatus: { stage: 'checking', message: 'Preparando a consulta do processo...' }, snippets: { ...DEFAULT_SNIPPETS }, editingKey: null,
  };

  function cleanText(value) { return value ? String(value).replace(/\s+/g, ' ').trim() : ''; }
  function getProcessId() {
    const match = location.pathname.match(/^\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?$/);
    return match ? match[1] : null;
  }
  function getProcessNumber() {
    const match = cleanText(document.body?.innerText || document.body?.textContent || '').match(/\b\d{5}\.\d{6}(?:[./])\d{4}-\d{2}\b/);
    return match ? match[0] : '';
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
  function storageRemove(area, key) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.[area];
      if (!storage?.remove) return resolve();
      storage.remove(key, resolve);
    });
  }
  async function getExtensionSession() {
    const storedSession = await storageGet('local', SESSION_KEY, null);
    if (!storedSession?.accessToken || !storedSession?.refreshToken) throw new Error('Entre no SIAGES pela aba Configurações.');
    if (Number(storedSession.expiresAt || 0) > (Date.now() / 1000) + 60) return storedSession;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storedSession.refreshToken }),
    });
    if (!response.ok) throw new Error('A sessão expirou. Entre novamente na aba Configurações.');
    const payload = await response.json();
    const session = { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600) };
    await storageSet('local', { [SESSION_KEY]: session });
    return session;
  }
  function buildContext(session) {
    const suapId = getProcessId();
    if (!suapId) return null;
    return {
      source: 'siages-suap-extension', type: 'siages:suap-process-context', version: 1,
      payload: {
        suapId, processNumber: getProcessNumber(), processUrl: location.origin + location.pathname,
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
    return bestScore > 0 ? best : (document.querySelector('main, #content, .content, #main, [role="main"]') || document.body);
  }

  function buildShell() {
    const root = document.createElement('section');
    root.id = ROOT_ID;
    root.dataset.theme = state.theme;
    root.dataset.collapsed = String(state.collapsed);
    root.setAttribute('aria-label', 'Suape - ferramentas do processo');
    root.innerHTML = `
      <div class="suape-shell">
        <header class="suape-header">
          <div class="suape-brand"><span class="suape-logo">S</span><div><strong>Suape</strong><small>Canivete suíço do IFRN · v1.9.1</small></div></div>
          <button type="button" class="suape-icon-button" data-action="theme" aria-label="Alternar tema">◐</button>
          <button type="button" class="suape-icon-button" data-action="collapse" aria-label="Recolher painel">⌃</button>
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
    root.querySelector('[data-action="theme"]').addEventListener('click', toggleTheme);
    root.querySelector('[data-action="collapse"]').addEventListener('click', toggleCollapsed);
    root.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
    return root;
  }
  function selectTab(tab) {
    state.activeTab = tab;
    const root = document.getElementById(ROOT_ID);
    root?.querySelectorAll('[data-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    root?.querySelectorAll('[data-panel]').forEach((panel) => { panel.dataset.active = String(panel.dataset.panel === tab); });
  }
  async function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    const root = document.getElementById(ROOT_ID);
    if (root) root.dataset.theme = state.theme;
    await storageSet('local', { [THEME_KEY]: state.theme });
    if (state.snapshot) renderSummary(state.snapshot);
    if (window.__siagesLatestFinanceSummary) renderFinanceSummary(window.__siagesLatestFinanceSummary);
  }
  async function toggleCollapsed() {
    state.collapsed = !state.collapsed;
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.dataset.collapsed = String(state.collapsed);
      const button = root.querySelector('[data-action="collapse"]');
      button.textContent = state.collapsed ? '⌄' : '⌃';
      button.setAttribute('aria-label', state.collapsed ? 'Expandir painel' : 'Recolher painel');
    }
    await storageSet('local', { [COLLAPSED_KEY]: state.collapsed });
  }

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
      appendCopyRow(section, 'Status', process?.status);
      appendCopyRow(section, 'Atualizado', process?.updatedAt ? formatDate(process.updatedAt) : '');
    });
    if (!process) return;
    const full = process.dadosCompletos || {}; const bank = full.dados_bancarios || {}; const taxes = full.retencoes_tributarias || {};
    const invoice = (full.notas_fiscais || [])[0] || {}; const workflow = full.workflow || {};
    appendSection(container, 'Beneficiário', (section) => {
      appendCopyRow(section, 'Nome', process.beneficiario);
      appendCopyRow(section, 'CPF/CNPJ', process.cpfCnpj, true);
      appendCopyRow(section, 'Assunto', process.assunto);
    });
    appendSection(container, 'Documento e pagamento', (section) => {
      appendCopyRow(section, 'Valor', full.val_nf);
      appendCopyRow(section, 'NS', workflow.nsNumero || full.ns_numero, true);
      appendCopyRow(section, 'Contrato', process.contrato || full.contrato_numero, true);
      appendCopyRow(section, 'Nota fiscal', invoice.numero, true);
      appendCopyRow(section, 'Emissão', invoice.data_emissao);
    });
    appendSection(container, 'Dados bancários', (section) => {
      appendCopyRow(section, 'Banco', bank.banco);
      appendCopyRow(section, 'Agência', bank.agencia, true);
      appendCopyRow(section, 'Conta', bank.conta, true);
    });
    appendSection(container, 'Retenções e empenhos', (section) => {
      if (taxes.optante_simples_nacional) appendCopyRow(section, 'Regime', 'Optante pelo Simples Nacional');
      [['ISS', taxes.iss], ['INSS', taxes.inss], ['IR', taxes.ir], ['CSLL', taxes.csll], ['COFINS', taxes.cofins], ['PIS/PASEP', taxes.pis_pasep]].forEach(([label, value]) => appendCopyRow(section, label, value));
      (full.empenhos || []).forEach((value, index) => appendCopyRow(section, `Empenho ${index + 1}`, value, true));
      if ((full.empenhos || []).length > 1) appendCopyRow(section, 'Todos', full.empenhos.join(', '), true);
    });
    if (workflow.concluido) appendSection(container, 'Conclusão', (section) => {
      appendCopyRow(section, 'NS registrada', workflow.nsNumero || full.ns_numero, true);
      appendCopyRow(section, 'Concluído em', workflow.concluidoEm ? formatDate(workflow.concluidoEm) : '');
      appendCopyRow(section, 'Concluído por', workflow.concluidoPor);
      appendCopyRow(section, 'Análise', workflow.analiseLiquidacao?.resumo);
    });
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
    window.__siagesLatestFinanceSummary = summary;
    if (!summary || summary.status === 'missing-process' || summary.status === 'missing-beneficiary') { removeFinancePanel(); return; }
    if (summary.status === 'empty') { renderFinanceEmpty(summary.escopoContrato ? 'Nenhum empenho do beneficiário foi encontrado para o contrato deste processo.' : 'Nenhum empenho foi encontrado para o beneficiário identificado neste processo.'); return; }
    const colors = getThemeColors(); const finance = ensureFinancePanel(); finance.innerHTML = '';
    const wrapper = createElement('section', 'suape-section'); Object.assign(wrapper.style, { background: colors.panelBg, color: colors.panelText, borderColor: colors.panelBorder });
    const header = document.createElement('div'); Object.assign(header.style, { padding: '12px', borderBottom: `1px solid ${colors.metricBorder}` });
    const title = createElement('strong', '', 'SIAGES - Empenhos do beneficiário'); Object.assign(title.style, { display: 'block', color: colors.heading, fontSize: '14px' });
    const beneficiary = createElement('span', '', summary.beneficiario?.nome || summary.beneficiario?.documento || 'Beneficiário identificado'); Object.assign(beneficiary.style, { display: 'block', marginTop: '4px', color: colors.panelText }); header.append(title, beneficiary);
    if (summary.contrato?.numero) { const chip = createElement('span', '', `Filtrado pelo contrato ${summary.contrato.numero}`); Object.assign(chip.style, { display: 'inline-block', marginTop: '7px', padding: '3px 7px', borderRadius: '999px', background: colors.chipBg, color: colors.chipText, fontSize: '11px', fontWeight: '700' }); header.appendChild(chip); }
    const totals = document.createElement('div'); Object.assign(totals.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '8px', padding: '10px 12px' }); totals.append(renderMetric('Empenhado', summary.totais?.empenhado, colors), renderMetric('Saldo', summary.totais?.saldo, colors));
    const list = document.createElement('div'); Object.assign(list.style, { padding: '0 12px 12px', display: 'grid', gap: '8px' });
    (summary.empenhos || []).slice(0, 6).forEach((commitment) => {
      const item = document.createElement('article'); Object.assign(item.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '9px', padding: '9px', background: colors.itemBg });
      const heading = document.createElement('div'); Object.assign(heading.style, { display: 'flex', justifyContent: 'space-between', gap: '8px' });
      const number = createElement('strong', '', commitment.numero || 'Empenho sem número'); const balance = createElement('span', '', `Saldo ${formatCurrency(commitment.saldo)}`); Object.assign(balance.style, { color: colors.accent, fontWeight: '700' }); heading.append(number, balance); item.appendChild(heading);
      const values = createElement('div', '', `Empenhado ${formatCurrency(commitment.empenhado)} · Saldo ${formatCurrency(commitment.saldo)}`); Object.assign(values.style, { marginTop: '5px', color: colors.mutedText, fontSize: '11px' }); item.appendChild(values);
      if ((commitment.liquidacoes || []).length) {
        const liquidations = document.createElement('div'); Object.assign(liquidations.style, { marginTop: '9px', display: 'grid', gap: '5px' }); liquidations.appendChild(createElement('strong', '', 'Liquidações em cache'));
        commitment.liquidacoes.forEach((liquidation) => {
          const row = document.createElement('div'); Object.assign(row.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '7px', padding: '7px', background: colors.metricBg, fontSize: '11px' });
          row.append(createElement('strong', '', liquidation.numero || 'NF sem número'), createElement('div', '', [formatDate(liquidation.data), liquidation.situacao].filter(Boolean).join(' - ')), createElement('div', '', liquidation.valor != null ? formatCurrency(liquidation.valor) : '-')); liquidations.appendChild(row);
        }); item.appendChild(liquidations);
      }
      list.appendChild(item);
    });
    if ((summary.empenhos || []).length > 6) list.appendChild(createElement('div', 'suape-empty', `+${summary.empenhos.length - 6} empenho(s) adicional(is)`));
    wrapper.append(header, totals, list); finance.appendChild(wrapper);
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
    if (!list.children.length) list.appendChild(createElement('div', 'suape-empty', 'Nenhum atalho encontrado.')); container.appendChild(list);
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

  function renderSettings() {
    const container = panel('settings'); container.innerHTML = '';
    const themeSection = createElement('section', 'suape-section'); themeSection.appendChild(createElement('h3', 'suape-section-title', 'Aparência'));
    const themeBody = createElement('div', 'suape-form'); themeBody.style.padding = '11px'; const themeButton = createElement('button', 'suape-button suape-button-secondary suape-full', state.theme === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'); themeButton.type = 'button'; themeButton.addEventListener('click', async () => { await toggleTheme(); renderSettings(); }); themeBody.appendChild(themeButton); themeSection.appendChild(themeBody); container.appendChild(themeSection);
    const authSection = createElement('section', 'suape-section'); authSection.appendChild(createElement('h3', 'suape-section-title', 'Acesso ao SIAGES'));
    const form = createElement('form', 'suape-form suape-auth-form'); form.noValidate = true; form.style.padding = '11px'; form.innerHTML = '<label for="suape-auth-email"><span>E-mail cadastrado no SIAGES</span><input id="suape-auth-email" class="suape-input" name="email" type="text" inputmode="email" autocomplete="username" placeholder="nome@dominio.com" required></label><label for="suape-auth-password"><span>Senha do SIAGES</span><input id="suape-auth-password" class="suape-input" name="password" type="password" autocomplete="current-password" required></label><div class="suape-auth-actions"><button class="suape-button" type="submit">Entrar</button><button class="suape-button suape-button-secondary" type="button" data-signout>Sair</button></div><div class="suape-help suape-auth-message" data-auth-message aria-live="polite">Use seu e-mail e senha cadastrados no SIAGES, não a matrícula e senha do SUAP.</div>';
    isolateAuthFormLayout(form); form.addEventListener('submit', signIn); form.querySelector('[data-signout]').addEventListener('click', signOut); authSection.appendChild(form); container.appendChild(authSection); void updateAuthStatus(form);
  }
  async function updateAuthStatus(form) {
    const message = form.querySelector('[data-auth-message]'); const session = await storageGet('local', SESSION_KEY, null);
    message.dataset.state = session?.accessToken ? 'success' : '';
    message.textContent = session?.accessToken ? 'Sessão ativa. Os dados usam as permissões do seu usuário.' : 'Entre para consultar e sincronizar processos.';
  }
  async function signIn(event) {
    event.preventDefault(); const form = event.currentTarget; const message = form.querySelector('[data-auth-message]'); const button = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('input[name="email"]'); const passwordInput = form.querySelector('input[name="password"]');
    const email = emailInput?.value.trim() || ''; const password = passwordInput?.value || '';
    message.dataset.state = 'error';
    if (!email || !password) { message.textContent = 'Informe o e-mail e a senha cadastrados no SIAGES.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.textContent = 'Use o e-mail cadastrado no SIAGES. A matrícula do SUAP não autentica neste campo.'; return; }
    button.disabled = true; message.dataset.state = 'loading'; message.textContent = 'Autenticando...';
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error('E-mail ou senha do SIAGES inválidos. Confirme o acesso no SIAGES ou redefina a senha.');
        throw new Error(`Não foi possível autenticar no SIAGES (HTTP ${response.status}).`);
      }
      if (!payload.access_token || !payload.refresh_token) throw new Error('O SIAGES não devolveu uma sessão válida.');
      await storageSet('local', { [SESSION_KEY]: { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresAt: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600) } });
      if (passwordInput) passwordInput.value = ''; message.dataset.state = 'success'; message.textContent = 'Sessão ativa.'; restartBridge();
    } catch (error) { message.dataset.state = 'error'; message.textContent = error instanceof Error ? error.message : 'Falha na autenticação.'; } finally { button.disabled = false; }
  }
  async function signOut(event) { const form = event.currentTarget.closest('form'); await storageRemove('local', SESSION_KEY); const message = form.querySelector('[data-auth-message]'); message.dataset.state = ''; message.textContent = 'Sessão encerrada.'; }

  function closeModal() { document.getElementById(MODAL_ID)?.remove(); }
  function openModal() {
    if (document.getElementById(MODAL_ID)) return; const context = buildContext(); if (!context) return;
    const overlay = document.createElement('div'); overlay.id = MODAL_ID; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(15,23,42,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' });
    const modalPanel = document.createElement('div'); Object.assign(modalPanel.style, { position: 'relative', width: 'min(1240px,96vw)', height: 'min(920px,94vh)', overflow: 'hidden', borderRadius: '12px', background: '#fff' });
    const close = createElement('button', '', 'Fechar'); close.type = 'button'; Object.assign(close.style, { position: 'absolute', zIndex: '2', top: '12px', right: '12px', padding: '6px 10px' });
    const frame = document.createElement('iframe'); frame.id = IFRAME_ID; frame.src = `${SIAGES_ORIGIN}/suap-extensao/despacho`; frame.title = 'Gerador de Despacho de Liquidação do SIAGES'; frame.allow = 'clipboard-read; clipboard-write'; Object.assign(frame.style, { width: '100%', height: '100%', border: '0' });
    const receive = (event) => { if (isSiagesFrameMessage(event, frame, 'siages:suap-dispatch-ready')) frame.contentWindow?.postMessage(context, SIAGES_ORIGIN); if (isSiagesFrameMessage(event, frame, 'siages:suap-dispatch-close')) cleanup(); };
    const cleanup = () => { window.removeEventListener('message', receive); closeModal(); }; close.addEventListener('click', cleanup); frame.addEventListener('load', () => frame.contentWindow?.postMessage(context, SIAGES_ORIGIN)); window.addEventListener('message', receive); overlay.addEventListener('click', (event) => { if (event.target === overlay) cleanup(); }); modalPanel.append(close, frame); overlay.appendChild(modalPanel); document.body.appendChild(overlay);
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
    if (!getProcessId() || document.getElementById(BRIDGE_FRAME_ID)) return; renderFinanceLoading();
    void getExtensionSession().then((session) => {
      if (document.getElementById(BRIDGE_FRAME_ID)) return; const context = buildContext(session); const frame = document.createElement('iframe'); frame.id = BRIDGE_FRAME_ID; frame.src = `${SIAGES_ORIGIN}/suap-extensao/processo-info`; frame.title = 'Sincronização do processo com o SIAGES'; Object.assign(frame.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', border: '0' });
      const postContext = () => frame.contentWindow?.postMessage(context, SIAGES_ORIGIN);
      const receive = async (event) => {
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-info-ready')) { postContext(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-snapshot')) { state.snapshot = event.data.payload; renderSummary(); return; }
        if (isSiagesFrameMessage(event, frame, 'siages:suap-process-sync-status')) { state.syncStatus = event.data.payload; renderSummary(); return; }
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

  async function installToolkit() {
    if (!getProcessId() || document.getElementById(ROOT_ID)) return;
    const [theme, collapsed, storedSnippets] = await Promise.all([storageGet('local', THEME_KEY, 'dark'), storageGet('local', COLLAPSED_KEY, false), storageGet('sync', SNIPPETS_KEY, null)]);
    state.theme = theme === 'light' ? 'light' : 'dark'; state.collapsed = Boolean(collapsed); state.snippets = storedSnippets && Object.keys(storedSnippets).length ? storedSnippets : { ...DEFAULT_SNIPPETS };
    if (!storedSnippets) await storageSet('sync', { [SNIPPETS_KEY]: state.snippets });
    const root = buildShell(); const host = findToolkitHost(); host.prepend(root); renderSummary({ process: null, fallback: { suapId: getProcessId(), processNumber: getProcessNumber(), processUrl: location.href } }); renderShortcuts(); renderAiPanel(); renderSettings(); selectTab('summary'); openProcessBridge();
  }
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => { if (area === 'sync' && changes[SNIPPETS_KEY]) { state.snippets = changes[SNIPPETS_KEY].newValue || { ...DEFAULT_SNIPPETS }; renderShortcuts(); } });
  window.__siagesSuapProcessDocument = { getProcessId, getProcessNumber, buildContext, installToolkit, installButton: installToolkit, installFinancePanel: openProcessBridge, openFinanceBridge: openProcessBridge, renderFinanceSummary, openModal, closeModal, downloadProcessPdfFromSuap, normalizeSnippetKey, selectTab, retrySync };
  if (!window.__SIAGES_SUAP_PROCESS_TEST__) void installToolkit();
})();
