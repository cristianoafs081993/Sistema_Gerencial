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

  function ensureFinancePanel() {
    const existing = document.getElementById(FINANCE_PANEL_ID);
    if (existing) return existing;

    const panel = document.createElement('section');
    panel.id = FINANCE_PANEL_ID;
    panel.setAttribute('aria-live', 'polite');
    Object.assign(panel.style, {
      position: 'fixed',
      right: '20px',
      bottom: '74px',
      zIndex: '2147483645',
      width: 'min(440px, calc(100vw - 40px))',
      maxHeight: 'min(640px, calc(100vh - 110px))',
      overflow: 'auto',
      border: '1px solid #bbf7d0',
      borderRadius: '12px',
      background: '#ffffff',
      boxShadow: '0 18px 45px rgba(15, 23, 42, 0.22)',
      color: '#0f172a',
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
    });

    document.body.appendChild(panel);
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
    const cell = document.createElement('div');
    Object.assign(cell.style, { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' });
    cell.append(
      createText('span', label, { display: 'block', color: '#64748b', fontSize: '11px', marginBottom: '3px' }),
      createText('strong', formatCurrency(value), { display: 'block', color: '#0f172a', fontSize: '13px' }),
    );
    return cell;
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

    const panel = ensureFinancePanel();
    panel.innerHTML = '';

    const header = document.createElement('div');
    Object.assign(header.style, { padding: '14px 14px 10px', borderBottom: '1px solid #e2e8f0' });
    header.append(
      createText('strong', 'SIAGES - Empenhos do beneficiario', { display: 'block', color: '#065f46', fontSize: '14px' }),
      createText('span', summary.beneficiario?.nome || summary.beneficiario?.documento || 'Beneficiario identificado', {
        display: 'block', color: '#334155', marginTop: '4px', lineHeight: '1.35',
      }),
    );
    if (summary.contrato?.numero) {
      header.appendChild(createText('span', `Filtrado pelo contrato ${summary.contrato.numero}`, {
        display: 'inline-block', marginTop: '7px', padding: '3px 7px', borderRadius: '999px', background: '#ecfdf5',
        color: '#047857', fontSize: '11px', fontWeight: '700',
      }));
    }

    const totals = document.createElement('div');
    Object.assign(totals.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 14px' });
    totals.append(
      renderMetric('Empenhado', summary.totais?.empenhado),
      renderMetric('Liquidado', summary.totais?.liquidado),
      renderMetric('Pago', summary.totais?.pago),
      renderMetric('Saldo', summary.totais?.saldo),
    );

    const list = document.createElement('div');
    Object.assign(list.style, { padding: '0 14px 14px', display: 'grid', gap: '8px' });
    (summary.empenhos || []).slice(0, 6).forEach((empenho) => {
      const item = document.createElement('article');
      Object.assign(item.style, { border: '1px solid #e2e8f0', borderRadius: '9px', padding: '9px', background: '#fff' });
      const title = document.createElement('div');
      Object.assign(title.style, { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' });
      title.append(
        createText('strong', empenho.numero || 'Empenho sem numero', { color: '#0f172a' }),
        createText('span', `Saldo ${formatCurrency(empenho.saldo)}`, { color: '#047857', fontWeight: '700', whiteSpace: 'nowrap' }),
      );
      item.appendChild(title);
      item.appendChild(createText('div', `Liquidado ${formatCurrency(empenho.liquidado)} · Pago ${formatCurrency(empenho.pago)}`, {
        marginTop: '4px', color: '#475569', fontSize: '12px',
      }));
      if (empenho.liquidacoes?.length) {
        const liquidacoes = createText('div', `${empenho.liquidacoes.length} liquidacao(oes) no cache`, {
          marginTop: '5px', color: '#64748b', fontSize: '12px',
        });
        item.appendChild(liquidacoes);
      }
      list.appendChild(item);
    });

    if ((summary.empenhos || []).length > 6) {
      list.appendChild(createText('div', `+${summary.empenhos.length - 6} empenho(s) adicional(is)`, {
        color: '#64748b', fontSize: '12px', textAlign: 'center',
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
