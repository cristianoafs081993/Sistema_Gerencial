(function () {
  const BUTTON_ID = 'siages-suap-generate-document';
  const MODAL_ID = 'siages-suap-dispatch-modal';
  const IFRAME_ID = 'siages-suap-dispatch-frame';
  const FINANCE_PANEL_ID = 'siages-suap-finance-panel';
  const FINANCE_FRAME_ID = 'siages-suap-finance-frame';
  const SIAGES_APP_ORIGIN_STORAGE_KEY = 'siages-app-origin';
  const DEFAULT_SIAGES_APP_ORIGIN = 'https://sistema-gerencial-gamma.vercel.app';

  function cleanText(value) {
    return value ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function getProcessId() {
    const match = window.location.pathname.match(/^\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?$/);
    return match ? match[1] : null;
  }

  function getProcessNumber() {
    const match = cleanText(document.body?.innerText || document.body?.textContent || '').match(/\b\d{5}\.\d{6}(?:[./])\d{4}-\d{2}\b/);
    return match ? match[0] : '';
  }

  function getStoredSiagesOrigin() {
    return new Promise((resolve) => {
      const readStored = (stored) => {
        const candidate = stored?.[SIAGES_APP_ORIGIN_STORAGE_KEY] || DEFAULT_SIAGES_APP_ORIGIN;
        try {
          const url = new URL(candidate);
          resolve(url.protocol === 'https:' ? url.origin : null);
        } catch {
          resolve(null);
        }
      };

      if (!window.chrome?.storage?.local?.get) {
        readStored({});
        return;
      }

      chrome.storage.local.get(SIAGES_APP_ORIGIN_STORAGE_KEY, readStored);
    });
  }

  function buildContext() {
    const suapId = getProcessId();
    if (!suapId) return null;
    return {
      source: 'siages-suap-extension',
      type: 'siages:suap-process-context',
      version: 1,
      payload: {
        suapId,
        processNumber: getProcessNumber(),
        processUrl: window.location.origin + window.location.pathname,
      },
    };
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.remove();
  }

  function isSiagesFrameMessage(event, siagesOrigin, frame, type) {
    return (
      event.origin === siagesOrigin &&
      event.source === frame.contentWindow &&
      event.data?.source === 'siages' &&
      event.data?.type === type &&
      event.data?.version === 1
    );
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  function createText(tag, text, styles) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (styles) Object.assign(element.style, styles);
    return element;
  }

  function getThemeColors() {
    return isDarkTheme()
      ? {
        panelBg: '#1f2937', panelBorder: '#047857', panelText: '#e5e7eb', mutedText: '#cbd5e1', heading: '#a7f3d0',
        chipBg: 'rgba(16,185,129,0.18)', chipText: '#a7f3d0', metricBg: 'rgba(15,23,42,0.42)', metricBorder: '#334155',
        itemBg: 'rgba(15,23,42,0.32)', accent: '#34d399', shadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
      }
      : {
        panelBg: '#ffffff', panelBorder: '#bbf7d0', panelText: '#0f172a', mutedText: '#475569', heading: '#065f46',
        chipBg: '#ecfdf5', chipText: '#047857', metricBg: '#f8fafc', metricBorder: '#e2e8f0',
        itemBg: '#ffffff', accent: '#047857', shadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
      };
  }

  function normalizeTextForMatch(value) {
    return cleanText(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function isDarkTheme() {
    const background = window.getComputedStyle(document.body).backgroundColor;
    const match = background.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return document.body.className.toLowerCase().includes('dark');
    const [, red, green, blue] = match.map(Number);
    return ((red * 299) + (green * 587) + (blue * 114)) / 1000 < 120;
  }

  function findUsefulContainer(element) {
    const selectors = ['section', 'article', 'fieldset', '.box', '.card', '.module', '.panel', '.timeline', '.tabular', 'div'];
    for (const selector of selectors) {
      const candidate = element.closest(selector);
      if (candidate && candidate !== document.body && candidate !== document.documentElement) return candidate;
    }
    return element.parentElement && element.parentElement !== document.body ? element.parentElement : null;
  }

  function findFinancePanelHost() {
    const pattern = /\b(tramitacao|tramitacoes|tramite|tramites|historico de tramitacao)\b/i;
    const labelSelectors = 'h1,h2,h3,h4,h5,h6,legend,summary,caption,strong,b,.title,.titulo,.card-title,.box-title';
    const label = Array.from(document.querySelectorAll(labelSelectors)).find((element) => pattern.test(normalizeTextForMatch(element.textContent)));
    if (label) {
      const host = findUsefulContainer(label);
      if (host) return { host, mode: 'flow' };
    }

    const contentCandidates = Array.from(document.querySelectorAll('section,article,fieldset,.box,.card,.module,.panel'));
    const directHost = contentCandidates.find((element) => {
      const text = normalizeTextForMatch(element.textContent).slice(0, 220);
      return pattern.test(text);
    });
    if (directHost) return { host: directHost, mode: 'flow' };

    const main = document.querySelector('main, #content, .content, #main, [role="main"]');
    if (main && main !== document.body) return { host: main, mode: 'content' };

    return { host: document.body, mode: 'fixed' };
  }

  function applyFinancePanelStyle(panel, placement) {
    const colors = getThemeColors();
    const integrated = placement.mode !== 'fixed';
    Object.assign(panel.style, {
      position: integrated ? 'static' : 'fixed',
      right: integrated ? '' : '20px',
      bottom: integrated ? '' : '74px',
      zIndex: integrated ? '' : '2147483645',
      width: integrated ? '100%' : 'min(440px, calc(100vw - 40px))',
      maxHeight: integrated ? 'none' : 'min(640px, calc(100vh - 110px))',
      overflow: integrated ? 'visible' : 'auto',
      margin: integrated ? '16px 0 0' : '0',
      border: `1px solid ${colors.panelBorder}`,
      borderRadius: '12px',
      background: colors.panelBg,
      boxShadow: colors.shadow,
      color: colors.panelText,
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      boxSizing: 'border-box',
    });
    panel.dataset.siagesPlacement = placement.mode;
  }

  function ensureFinancePanel() {
    const placement = findFinancePanelHost();
    const existing = document.getElementById(FINANCE_PANEL_ID);
    const panel = existing || document.createElement('section');
    panel.id = FINANCE_PANEL_ID;
    panel.setAttribute('aria-live', 'polite');
    applyFinancePanelStyle(panel, placement);
    if (panel.parentElement !== placement.host) placement.host.appendChild(panel);
    return panel;
  }
  function removeFinancePanel() {
    document.getElementById(FINANCE_PANEL_ID)?.remove();
  }

  function renderFinanceLoading(message) {
    const panel = ensureFinancePanel();
    panel.innerHTML = '';
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px' });
    const indicator = document.createElement('span');
    Object.assign(indicator.style, {
      width: '10px', height: '10px', borderRadius: '999px', background: '#10b981', display: 'inline-block',
      boxShadow: '0 0 0 4px rgba(16,185,129,0.14)',
    });
    wrapper.append(indicator, createText('span', message || 'Consultando empenhos no SIAGES...'));
    panel.appendChild(wrapper);
  }

  function renderFinanceEmpty(message) {
    const panel = ensureFinancePanel();
    panel.innerHTML = '';
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { padding: '14px' });
    wrapper.append(
      createText('strong', 'SIAGES - Empenhos', { display: 'block', marginBottom: '6px', color: '#065f46' }),
      createText('p', message, { margin: '0', color: '#475569', lineHeight: '1.35' }),
    );
    panel.appendChild(wrapper);
  }

  function renderMetric(label, value) {
    const colors = getThemeColors();
    const cell = document.createElement('div');
    Object.assign(cell.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '8px', padding: '8px', background: colors.metricBg });
    cell.append(
      createText('span', label, { display: 'block', color: colors.mutedText, fontSize: '11px', marginBottom: '3px' }),
      createText('strong', formatCurrency(value), { display: 'block', color: colors.panelText, fontSize: '13px' }),
    );
    return cell;
  }
  function formatDate(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }

  function formatLiquidacaoSituation(value) {
    const text = cleanText(value || '');
    if (!text) return '';
    return /pag/i.test(normalizeTextForMatch(text)) ? 'Liquidada' : text;
  }

  function renderLiquidacoes(empenho, colors) {
    const liquidacoes = empenho.liquidacoes || [];
    if (!liquidacoes.length) return null;

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { marginTop: '10px', display: 'grid', gap: '6px' });
    wrapper.appendChild(createText('div', 'Liquidacoes em cache', {
      color: colors.mutedText, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em',
    }));

    liquidacoes.forEach((liquidacao) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'grid', gridTemplateColumns: 'minmax(90px, 1.2fr) minmax(72px, 0.8fr) minmax(86px, 0.9fr) minmax(86px, 0.9fr)',
        gap: '8px', alignItems: 'center', padding: '7px 8px', border: `1px solid ${colors.metricBorder}`,
        borderRadius: '7px', background: colors.metricBg, color: colors.panelText, fontSize: '12px', lineHeight: '1.25',
      });
      row.append(
        createText('span', liquidacao.numero || 'NF sem numero', { fontWeight: '700', overflowWrap: 'anywhere' }),
        createText('span', formatDate(liquidacao.data) || '-', { color: colors.mutedText }),
        createText('span', formatLiquidacaoSituation(liquidacao.situacao) || '-', { color: colors.mutedText }),
        createText('strong', liquidacao.valor != null ? formatCurrency(liquidacao.valor) : '-', { textAlign: 'right', color: colors.panelText }),
      );
      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function renderFinanceSummary(summary) {
    if (!summary || summary.status === 'missing-process' || summary.status === 'missing-beneficiary') {
      removeFinancePanel();
      return;
    }

    if (summary.status === 'empty') {
      renderFinanceEmpty(summary.escopoContrato
        ? 'Nenhum empenho do beneficiario foi encontrado para o contrato deste processo.'
        : 'Nenhum empenho foi encontrado para o beneficiario identificado neste processo.');
      return;
    }

    const colors = getThemeColors();
    const panel = ensureFinancePanel();
    panel.innerHTML = '';

    const header = document.createElement('div');
    Object.assign(header.style, { padding: '14px 14px 10px', borderBottom: `1px solid ${colors.metricBorder}` });
    header.append(
      createText('strong', 'SIAGES - Empenhos do beneficiario', { display: 'block', color: colors.heading, fontSize: '14px' }),
      createText('span', summary.beneficiario?.nome || summary.beneficiario?.documento || 'Beneficiario identificado', {
        display: 'block', color: colors.panelText, marginTop: '4px', lineHeight: '1.35',
      }),
    );
    if (summary.contrato?.numero) {
      header.appendChild(createText('span', `Filtrado pelo contrato ${summary.contrato.numero}`, {
        display: 'inline-block', marginTop: '7px', padding: '3px 7px', borderRadius: '999px', background: colors.chipBg,
        color: colors.chipText, fontSize: '11px', fontWeight: '700',
      }));
    }

    const totals = document.createElement('div');
    Object.assign(totals.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', padding: '12px 14px' });
    totals.append(
      renderMetric('Empenhado', summary.totais?.empenhado),
      renderMetric('Saldo', summary.totais?.saldo),
    );

    const list = document.createElement('div');
    Object.assign(list.style, { padding: '0 14px 14px', display: 'grid', gap: '8px' });
    (summary.empenhos || []).slice(0, 6).forEach((empenho) => {
      const item = document.createElement('article');
      Object.assign(item.style, { border: `1px solid ${colors.metricBorder}`, borderRadius: '9px', padding: '9px', background: colors.itemBg });
      const title = document.createElement('div');
      Object.assign(title.style, { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' });
      title.append(
        createText('strong', empenho.numero || 'Empenho sem numero', { color: colors.panelText }),
        createText('span', `Saldo ${formatCurrency(empenho.saldo)}`, { color: colors.accent, fontWeight: '700', whiteSpace: 'nowrap' }),
      );
      item.appendChild(title);
      const values = document.createElement('div');
      Object.assign(values.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px', color: colors.mutedText, fontSize: '12px' });
      values.append(
        createText('span', `Empenhado ${formatCurrency(empenho.empenhado)}`),
        createText('span', `Saldo ${formatCurrency(empenho.saldo)}`),
      );
      item.appendChild(values);
      const liquidacoes = renderLiquidacoes(empenho, colors);
      if (liquidacoes) item.appendChild(liquidacoes);
      list.appendChild(item);
    });

    if ((summary.empenhos || []).length > 6) {
      list.appendChild(createText('div', `+${summary.empenhos.length - 6} empenho(s) adicional(is)`, {
        color: colors.mutedText, fontSize: '12px', textAlign: 'center',
      }));
    }

    panel.append(header, totals, list);
  }
  function openFinanceBridge() {
    const context = buildContext();
    if (!context || document.getElementById(FINANCE_FRAME_ID)) return;
    renderFinanceLoading();

    void getStoredSiagesOrigin().then((siagesOrigin) => {
      if (!siagesOrigin) {
        renderFinanceEmpty('Configure uma origem HTTPS valida do SIAGES na extensao.');
        return;
      }
      if (document.getElementById(FINANCE_FRAME_ID)) return;

      const frame = document.createElement('iframe');
      frame.id = FINANCE_FRAME_ID;
      frame.src = `${siagesOrigin}/suap-extensao/processo-info`;
      frame.title = 'Resumo financeiro do processo no SIAGES';
      Object.assign(frame.style, { position: 'absolute', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none' });

      const postContext = () => frame.contentWindow?.postMessage(context, siagesOrigin);
      const timeout = window.setTimeout(() => {
        renderFinanceEmpty('Nao foi possivel carregar o resumo financeiro. Verifique se voce esta autenticado no SIAGES.');
      }, 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener('message', receiveFromSiages);
        frame.remove();
      };
      const receiveFromSiages = (event) => {
        if (isSiagesFrameMessage(event, siagesOrigin, frame, 'siages:suap-process-info-ready')) {
          postContext();
          return;
        }
        if (isSiagesFrameMessage(event, siagesOrigin, frame, 'siages:suap-process-finance-summary')) {
          renderFinanceSummary(event.data.payload);
          cleanup();
        }
      };

      frame.addEventListener('load', postContext);
      window.addEventListener('message', receiveFromSiages);
      document.body.appendChild(frame);
    });
  }

  function openModal() {
    if (document.getElementById(MODAL_ID)) return;
    const context = buildContext();
    if (!context) return;

    void getStoredSiagesOrigin().then((siagesOrigin) => {
      if (!siagesOrigin || document.getElementById(MODAL_ID)) return;

      const overlay = document.createElement('div');
      overlay.id = MODAL_ID;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Gerar despacho de liquidacao no SIAGES');
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      });

      const panel = document.createElement('div');
      Object.assign(panel.style, {
        position: 'relative', width: 'min(1240px, 96vw)', height: 'min(920px, 94vh)', overflow: 'hidden',
        borderRadius: '12px', background: '#fff', boxShadow: '0 24px 70px rgba(15, 23, 42, 0.4)',
      });

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Fechar';
      closeButton.setAttribute('aria-label', 'Fechar gerador de documento');
      Object.assign(closeButton.style, {
        position: 'absolute', zIndex: '1', top: '12px', right: '12px', border: '1px solid #cbd5e1', borderRadius: '6px',
        padding: '6px 10px', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: '13px',
      });

      const frame = document.createElement('iframe');
      frame.id = IFRAME_ID;
      frame.src = `${siagesOrigin}/suap-extensao/despacho`;
      frame.title = 'Gerador de Despacho de Liquidacao do SIAGES';
      frame.allow = 'clipboard-read; clipboard-write';
      Object.assign(frame.style, { display: 'block', width: '100%', height: '100%', border: '0' });

      const postContext = () => frame.contentWindow?.postMessage(context, siagesOrigin);
      const cleanupAndClose = () => {
        window.removeEventListener('message', receiveFromSiages);
        document.removeEventListener('keydown', closeOnEscape);
        closeModal();
      };
      const closeOnEscape = (event) => {
        if (event.key === 'Escape') cleanupAndClose();
      };
      const receiveFromSiages = (event) => {
        if (isSiagesFrameMessage(event, siagesOrigin, frame, 'siages:suap-dispatch-ready')) {
          postContext();
          return;
        }
        if (isSiagesFrameMessage(event, siagesOrigin, frame, 'siages:suap-dispatch-close')) {
          cleanupAndClose();
        }
      };

      closeButton.addEventListener('click', cleanupAndClose);
      frame.addEventListener('load', postContext);
      window.addEventListener('message', receiveFromSiages);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanupAndClose();
      });
      panel.append(closeButton, frame);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      document.addEventListener('keydown', closeOnEscape);
    });
  }

  function installButton() {
    if (!getProcessId() || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Gerar documento';
    button.setAttribute('aria-label', 'Gerar despacho de liquidacao com o SIAGES');
    Object.assign(button.style, {
      position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483646', border: '0', borderRadius: '7px',
      padding: '10px 14px', background: '#047857', color: '#fff', boxShadow: '0 8px 20px rgba(4, 120, 87, 0.28)',
      cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: '14px', fontWeight: '600',
    });
    button.addEventListener('click', openModal);
    document.body.appendChild(button);
  }

  function installFinancePanel() {
    if (!getProcessId()) return;
    openFinanceBridge();
  }

  window.__siagesSuapProcessDocument = {
    getProcessId,
    getProcessNumber,
    buildContext,
    installButton,
    installFinancePanel,
    openFinanceBridge,
    renderFinanceSummary,
    openModal,
    closeModal,
  };
  if (!window.__SIAGES_SUAP_PROCESS_TEST__) {
    installButton();
    installFinancePanel();
  }
})();
