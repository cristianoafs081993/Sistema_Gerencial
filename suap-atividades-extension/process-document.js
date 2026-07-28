(function () {
  const BUTTON_ID = 'siages-suap-generate-document';
  const MODAL_ID = 'siages-suap-dispatch-modal';
  const IFRAME_ID = 'siages-suap-dispatch-frame';
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
      chrome.storage.local.get(SIAGES_APP_ORIGIN_STORAGE_KEY, (stored) => {
        const candidate = stored[SIAGES_APP_ORIGIN_STORAGE_KEY] || DEFAULT_SIAGES_APP_ORIGIN;
        try {
          const url = new URL(candidate);
          resolve(url.protocol === 'https:' ? url.origin : null);
        } catch {
          resolve(null);
        }
      });
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
    document.removeEventListener('keydown', handleEscape);
  }

  function handleEscape(event) {
    if (event.key === 'Escape') closeModal();
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
      overlay.setAttribute('aria-label', 'Gerar despacho de liquidação no SIAGES');
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
      closeButton.addEventListener('click', closeModal);

      const frame = document.createElement('iframe');
      frame.id = IFRAME_ID;
      frame.src = `${siagesOrigin}/suap-extensao/despacho`;
      frame.title = 'Gerador de Despacho de Liquidação do SIAGES';
      frame.allow = 'clipboard-read; clipboard-write';
      Object.assign(frame.style, { display: 'block', width: '100%', height: '100%', border: '0' });
      frame.addEventListener('load', () => frame.contentWindow?.postMessage(context, siagesOrigin));

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
      });
      panel.append(closeButton, frame);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      document.addEventListener('keydown', handleEscape);

      const closeFromSiages = (event) => {
        if (
          event.origin === siagesOrigin &&
          event.source === frame.contentWindow &&
          event.data?.source === 'siages' &&
          event.data?.type === 'siages:suap-dispatch-close' &&
          event.data?.version === 1
        ) {
          window.removeEventListener('message', closeFromSiages);
          closeModal();
        }
      };
      window.addEventListener('message', closeFromSiages);
    });
  }

  function installButton() {
    if (!getProcessId() || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Gerar documento';
    button.setAttribute('aria-label', 'Gerar despacho de liquidação com o SIAGES');
    Object.assign(button.style, {
      position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483646', border: '0', borderRadius: '7px',
      padding: '10px 14px', background: '#047857', color: '#fff', boxShadow: '0 8px 20px rgba(4, 120, 87, 0.28)',
      cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: '14px', fontWeight: '600',
    });
    button.addEventListener('click', openModal);
    document.body.appendChild(button);
  }

  window.__siagesSuapProcessDocument = { getProcessId, getProcessNumber, buildContext, installButton, openModal, closeModal };
  if (!window.__SIAGES_SUAP_PROCESS_TEST__) installButton();
})();