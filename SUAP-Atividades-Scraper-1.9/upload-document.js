(function () {
  const HASH_PARAM = 'siagesUpload';
  const STORAGE_KEY = 'siagesUploadPendingV1';
  const TTL_MS = 30 * 60 * 1000;
  const NOTICE_ID = 'siages-suap-upload-notice';

  function cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
  }

  function normalizeText(text) {
    return cleanText(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function parseUploadPayloadFromHash(hash) {
    const sourceHash = typeof hash === 'string' ? hash : window.location.hash;
    if (!sourceHash) return null;
    const params = new URLSearchParams(sourceHash.replace(/^#/, ''));
    const raw = params.get(HASH_PARAM);
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw);
      if (
        payload.source !== 'siages' ||
        payload.version !== 1 ||
        payload.action !== 'suap_upload_document'
      ) {
        return null;
      }

      return {
        source: 'siages',
        version: 1,
        action: 'suap_upload_document',
        suapId: String(payload.suapId || ''),
        ...(payload.processNumber ? { processNumber: String(payload.processNumber) } : {}),
        tipoConferencia: cleanText(payload.tipoConferencia || 'Cópia Simples'),
        tipoDocumento: cleanText(payload.tipoDocumento || 'Liquidação'),
        assunto: cleanText(payload.assunto || 'Liquidação'),
      };
    } catch (_) {
      return null;
    }
  }

  function loadPendingUploadAutomation() {
    try {
      const rawSession = sessionStorage.getItem(STORAGE_KEY);
      const rawLocal = localStorage.getItem(STORAGE_KEY);
      const raw = rawSession || rawLocal;
      if (!raw) return null;

      const record = JSON.parse(raw);
      const payload = record?.payload || record;
      const createdAt = Number(record?.createdAt || 0);

      if (createdAt && Date.now() - createdAt > TTL_MS) {
        clearPendingUploadAutomation();
        return null;
      }

      if (payload?.action !== 'suap_upload_document') return null;

      return {
        source: 'siages',
        version: 1,
        action: 'suap_upload_document',
        suapId: String(payload.suapId || ''),
        ...(payload.processNumber ? { processNumber: String(payload.processNumber) } : {}),
        tipoConferencia: cleanText(payload.tipoConferencia || 'Cópia Simples'),
        tipoDocumento: cleanText(payload.tipoDocumento || 'Liquidação'),
        assunto: cleanText(payload.assunto || 'Liquidação'),
      };
    } catch (_) {
      return null;
    }
  }

  function clearPendingUploadAutomation() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      if (globalThis.chrome?.storage?.local) {
        globalThis.chrome.storage.local.remove(STORAGE_KEY);
      }
    } catch (_) {}
  }

  function stripUploadAutomationHash() {
    if (!window.location.hash || !window.history?.replaceState) return;
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, document.title, url);
  }

  function isUploadPage() {
    return /\/processo_eletronico\/documento_upload\/\d+\/?/.test(window.location.pathname);
  }

  function findTipoConferenciaField(root) {
    const doc = root || document;
    const directMatch = doc.querySelector('#id_tipo_conferencia, select[name="tipo_conferencia"]');
    if (directMatch) return directMatch;

    const selects = Array.from(doc.querySelectorAll('select'));
    return selects.find((sel) => {
      const id = normalizeText(sel.id);
      const name = normalizeText(sel.name);
      const label = sel.id ? normalizeText(doc.querySelector(`label[for="${sel.id}"]`)?.textContent || '') : '';
      return id.includes('conferencia') || name.includes('conferencia') || label.includes('conferencia');
    }) || null;
  }

  function findTipoDocumentoField(root) {
    const doc = root || document;
    const directMatch = doc.querySelector('#id_tipo, select[name="tipo"], select[name="tipo_documento"]');
    if (directMatch) return directMatch;

    const selects = Array.from(doc.querySelectorAll('select'));
    return selects.find((sel) => {
      const id = normalizeText(sel.id);
      const name = normalizeText(sel.name);
      const label = sel.id ? normalizeText(doc.querySelector(`label[for="${sel.id}"]`)?.textContent || '') : '';
      if (id.includes('conferencia') || name.includes('conferencia') || label.includes('conferencia')) {
        return false;
      }
      return id === 'tipo' || name === 'tipo' || label.startsWith('tipo') || label.includes('tipo de documento');
    }) || null;
  }

  function findAssuntoField(root) {
    const doc = root || document;
    const directMatch = doc.querySelector('#id_assunto, input[name="assunto"], textarea[name="assunto"]');
    if (directMatch) return directMatch;

    const inputs = Array.from(doc.querySelectorAll('input[type="text"], input:not([type]), textarea'));
    return inputs.find((inp) => {
      const id = normalizeText(inp.id);
      const name = normalizeText(inp.name);
      const label = inp.id ? normalizeText(doc.querySelector(`label[for="${inp.id}"]`)?.textContent || '') : '';
      return id.includes('assunto') || name.includes('assunto') || label.includes('assunto');
    }) || null;
  }

  function findArquivoField(root) {
    return (root || document).querySelector('input[type="file"]');
  }

  const FILE_PROMPT_ID = 'siages-suap-upload-file-prompt';

  function openFileChooser(fileInput) {
    try {
      if (typeof fileInput.showPicker === 'function') fileInput.showPicker();
      else fileInput.click();
      return true;
    } catch (_) {
      return false;
    }
  }

  // Chrome only opens a file chooser after a click or key press on this page; the
  // palette's Enter happened on the previous page. Open it directly when allowed,
  // otherwise focus the field and let Enter or the floating button open it.
  function promptFileChooser(fileInput) {
    if (!fileInput || fileInput.files?.length) return false;
    fileInput.scrollIntoView?.({ block: 'center' });
    if (navigator.userActivation?.isActive && openFileChooser(fileInput)) return true;

    document.getElementById(FILE_PROMPT_ID)?.remove();
    const button = document.createElement('button');
    button.type = 'button';
    button.id = FILE_PROMPT_ID;
    button.textContent = 'Escolher documento (Enter)';
    Object.assign(button.style, {
      position: 'fixed', zIndex: '2147483647', top: '76px', right: '16px', padding: '10px 16px',
      borderRadius: '10px', border: '1px solid #1d4ed8', background: '#2563eb', color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '13px', fontWeight: '700',
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)', cursor: 'pointer',
    });

    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || ![fileInput, button].includes(document.activeElement)) return;
      event.preventDefault();
      openFileChooser(fileInput);
    };
    const cleanup = () => {
      button.remove();
      document.removeEventListener('keydown', onKeyDown, true);
      fileInput.removeEventListener('change', cleanup);
    };
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openFileChooser(fileInput);
    });
    document.addEventListener('keydown', onKeyDown, true);
    fileInput.addEventListener('change', cleanup);
    document.body.appendChild(button);
    fileInput.focus();
    return false;
  }

  function selectOptionByText(selectEl, targetText) {
    if (!selectEl || !targetText) return null;
    const normalizedTarget = normalizeText(targetText);
    // Placeholders ("---------") have an empty value and must never match.
    const options = Array.from(selectEl.options || []).filter((opt) => opt.value);

    let match = options.find((opt) => normalizeText(opt.textContent) === normalizedTarget);

    if (!match) {
      match = options.find((opt) => normalizeText(opt.textContent).includes(normalizedTarget));
    }

    // Never invent an option: the server only accepts the real option id.
    if (!match) return null;

    selectEl.value = match.value;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    return match;
  }

  function injectMainWorldSelect2Update(selectId, optionValue, optionText) {
    try {
      const script = document.createElement('script');
      script.setAttribute('data-siages-upload-injected', 'true');
      script.textContent = `
        (function() {
          try {
            var elId = ${JSON.stringify(selectId)};
            var val = ${JSON.stringify(optionValue)};
            var text = ${JSON.stringify(optionText)};
            var targetEl = document.getElementById(elId);
            if (targetEl) {
              targetEl.value = val;
              targetEl.dispatchEvent(new Event('change', { bubbles: true }));
              targetEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (window.jQuery || window.$) {
              var $ = window.jQuery || window.$;
              var $el = $('#' + elId);
              if ($el.length) {
                if (typeof $el.select2 === 'function') {
                  try { $el.select2('val', val); } catch (_) {}
                }
                $el.val(val).trigger('change');
              }
              var $chosen = $('#s2id_' + elId + ' .select2-chosen, #select2-' + elId + '-container');
              if ($chosen.length && text) {
                $chosen.text(text);
              }
            }
          } catch (_) {}
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (_) {}
  }

  function updateSelect2Display(selectEl, option) {
    if (!selectEl || !option) return;

    const selectId = selectEl.id;
    const optionText = option.textContent.trim();
    // Only this field's widget: a page-wide fallback could relabel another Select2.
    const containers = [
      selectId ? document.querySelector(`#select2-${selectId}-container`) : null,
      selectId ? document.querySelector(`#s2id_${selectId} .select2-chosen`) : null,
      selectEl.closest('.form-row')?.querySelector('.select2-selection__rendered, .select2-chosen'),
    ];

    for (const c of containers) {
      if (c) {
        c.textContent = optionText;
        c.setAttribute('title', optionText);
        break;
      }
    }

    if (selectId) {
      injectMainWorldSelect2Update(selectId, option.value, optionText);
    }
  }

  function isSelect2Field(selectEl) {
    return Boolean(selectEl?.classList?.contains('select2-hidden-accessible') || selectEl?.classList?.contains('js-example-data-ajax'));
  }

  // Asks select2-bridge-main.js (page world) to pick the option, searching the
  // widget's AJAX source when the <select> does not list it yet.
  async function pickSelect2ViaPage(selectEl, text, timeoutMs = 10000) {
    if (!selectEl?.name || !text) return null;
    const root = document.documentElement;
    if (root.dataset.siagesSelect2Bridge !== 'ready') {
      if (!isSelect2Field(selectEl)) return null;
      await waitFor(() => root.dataset.siagesSelect2Bridge === 'ready', 3000);
      if (root.dataset.siagesSelect2Bridge !== 'ready') return null;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      let timer = null;
      const onPicked = (event) => {
        let result = null;
        try {
          result = JSON.parse(event.detail);
        } catch (_) {
          return;
        }
        if (result?.requestId !== requestId) return;
        done(result.ok ? result : null);
      };
      const done = (result) => {
        document.removeEventListener('siages:select2-picked', onPicked);
        window.clearTimeout(timer);
        resolve(result);
      };
      timer = window.setTimeout(() => done(null), timeoutMs);
      document.addEventListener('siages:select2-picked', onPicked);
      document.dispatchEvent(new CustomEvent('siages:select2-pick', {
        detail: JSON.stringify({ requestId, name: selectEl.name, text }),
      }));
    });
  }

  async function selectTipoDocumento(selectEl, text) {
    const picked = await pickSelect2ViaPage(selectEl, text);
    if (picked) return picked;
    const option = selectOptionByText(selectEl, text);
    if (option) updateSelect2Display(selectEl, option);
    return option;
  }

  function fillTextInput(inputEl, value) {
    if (!inputEl) return false;
    inputEl.focus();

    const prototype = inputEl instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.blur();
    return true;
  }

  function showNotice(message, type = 'success') {
    const previous = document.getElementById(NOTICE_ID);
    if (previous) previous.remove();

    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.textContent = message;
    notice.setAttribute('role', 'status');
    notice.style.position = 'fixed';
    notice.style.zIndex = '2147483647';
    notice.style.top = '16px';
    notice.style.right = '16px';
    notice.style.maxWidth = '420px';
    notice.style.padding = '12px 16px';
    notice.style.borderRadius = '10px';
    notice.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.25)';
    notice.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    notice.style.fontSize = '13px';
    notice.style.fontWeight = '600';
    notice.style.lineHeight = '1.4';
    notice.style.color = '#ffffff';
    notice.style.background = type === 'error' ? '#dc2626' : '#059669';
    notice.style.border = type === 'error' ? '1px solid #b91c1c' : '1px solid #047857';
    notice.style.transition = 'opacity 0.3s ease';

    document.body.appendChild(notice);

    setTimeout(() => {
      notice.style.opacity = '0';
      setTimeout(() => notice.remove(), 400);
    }, 4500);
  }

  function waitFor(check, timeoutMs = 10000) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        let result = null;
        try {
          result = check();
        } catch (_) {
          result = null;
        }
        if (result) {
          resolve(result);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          resolve(null);
          return;
        }
        window.setTimeout(tick, 100);
      };
      tick();
    });
  }

  async function runUploadAutomation(payload) {
    if (!payload) return false;

    const fieldsReady = await waitFor(() => {
      const conf = findTipoConferenciaField(document);
      const tipo = findTipoDocumentoField(document);
      const ass = findAssuntoField(document);
      if (conf && tipo && ass && (tipo.options?.length > 1 || conf.options?.length > 1)) {
        return { conf, tipo, ass };
      }
      return null;
    }, 10000);

    const confField = fieldsReady?.conf || findTipoConferenciaField(document);
    const tipoField = fieldsReady?.tipo || findTipoDocumentoField(document);
    const assuntoField = fieldsReady?.ass || findAssuntoField(document);

    let filledCount = 0;
    const missing = [];

    if (confField && payload.tipoConferencia) {
      const selected = selectOptionByText(confField, payload.tipoConferencia);
      if (selected) filledCount++;
      else missing.push(`Tipo de Conferência "${payload.tipoConferencia}"`);
    }

    if (tipoField && payload.tipoDocumento) {
      const selected = await selectTipoDocumento(tipoField, payload.tipoDocumento);
      if (selected) filledCount++;
      else missing.push(`Tipo "${payload.tipoDocumento}"`);
    }

    if (assuntoField && payload.assunto) {
      const filled = fillTextInput(assuntoField, payload.assunto);
      if (filled) filledCount++;
    }

    if (filledCount > 0) {
      clearPendingUploadAutomation();
      if (missing.length) {
        showNotice(`SIAGES: não foi possível selecionar ${missing.join(' e ')}. Escolha manualmente antes de salvar.`, 'error');
      } else {
        showNotice(
          `SIAGES: Campos preenchidos automaticamente (${payload.tipoDocumento || 'Liquidação'} / ${payload.tipoConferencia || 'Cópia Simples'}).`,
          'success'
        );
      }

      promptFileChooser(findArquivoField(document));

      // The page may reset fields while it finishes loading; reapply only what was lost.
      window.setTimeout(() => {
        if (tipoField && payload.tipoDocumento && !tipoField.value) {
          void selectTipoDocumento(tipoField, payload.tipoDocumento);
        }
        if (confField && payload.tipoConferencia && !confField.value) {
          selectOptionByText(confField, payload.tipoConferencia);
        }
        if (assuntoField && payload.assunto && !assuntoField.value) {
          fillTextInput(assuntoField, payload.assunto);
        }
      }, 350);

      return true;
    } else {
      showNotice(
        'SIAGES: Não foi possível identificar todos os campos do formulário para preenchimento automático.',
        'error'
      );
      return false;
    }
  }

  async function initUploadAutomation() {
    if (!isUploadPage()) return;

    let payload = parseUploadPayloadFromHash(window.location.hash);
    if (payload) {
      stripUploadAutomationHash();
    } else {
      payload = loadPendingUploadAutomation();
    }

    if (!payload && globalThis.chrome?.storage?.local) {
      try {
        const stored = await new Promise((resolve) => {
          globalThis.chrome.storage.local.get(STORAGE_KEY, (res) => resolve(res?.[STORAGE_KEY]));
        });
        if (stored?.action === 'suap_upload_document') {
          payload = {
            source: 'siages',
            version: 1,
            action: 'suap_upload_document',
            suapId: String(stored.suapId || ''),
            ...(stored.processNumber ? { processNumber: String(stored.processNumber) } : {}),
            tipoConferencia: cleanText(stored.tipoConferencia || 'Cópia Simples'),
            tipoDocumento: cleanText(stored.tipoDocumento || 'Liquidação'),
            assunto: cleanText(stored.assunto || 'Liquidação'),
          };
        }
      } catch (_) {}
    }

    if (!payload) return;
    await runUploadAutomation(payload);
  }

  window.__siagesSuapUploadAutomation = {
    cleanText,
    normalizeText,
    parseUploadPayloadFromHash,
    loadPendingUploadAutomation,
    clearPendingUploadAutomation,
    stripUploadAutomationHash,
    findTipoConferenciaField,
    findTipoDocumentoField,
    findAssuntoField,
    findArquivoField,
    promptFileChooser,
    selectOptionByText,
    updateSelect2Display,
    pickSelect2ViaPage,
    selectTipoDocumento,
    fillTextInput,
    runUploadAutomation,
    initUploadAutomation,
  };

  if (!window.__SIAGES_SUAP_UPLOAD_TEST__) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUploadAutomation);
    } else {
      void initUploadAutomation();
    }
  }
})();
