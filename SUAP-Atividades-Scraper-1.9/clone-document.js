(function () {
  const HASH_PARAM = 'siagesClone';
  const NOTICE_ID = 'siages-suap-clone-notice';
  const PENDING_KEY = 'siagesClonePendingV1';
  const PENDING_TTL_MS = 30 * 60 * 1000;

  function cleanText(text) {
    return text ? text.replace(/\s+/g, ' ').trim() : '';
  }

  function parsePayloadFromHash(hash) {
    const sourceHash = typeof hash === 'string' ? hash : window.location.hash;
    const params = new URLSearchParams(sourceHash.replace(/^#/, ''));
    const raw = params.get(HASH_PARAM);
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw);
      if (
        payload.source !== 'siages' ||
        payload.version !== 1 ||
        (payload.documentType !== 'despacho' && payload.documentType !== 'cdo') ||
        (payload.mode !== 'review' && payload.mode !== 'save-after-confirmation') ||
        typeof payload.subject !== 'string' ||
        !cleanText(payload.subject) ||
        (payload.contentHtml !== undefined && typeof payload.contentHtml !== 'string') ||
        (payload.plainText !== undefined && typeof payload.plainText !== 'string')
      ) {
        return null;
      }

      return {
        source: 'siages',
        version: 1,
        documentType: payload.documentType,
        subject: cleanText(payload.subject),
        mode: payload.mode,
        contentHtml: payload.contentHtml || '',
        plainText: payload.plainText || '',
      };
    } catch (error) {
      return null;
    }
  }

  function isClonePage() {
    return /\/documento_eletronico\/clonar_documento\/\d+\//.test(window.location.pathname);
  }

  function isViewPage() {
    return /\/documento_eletronico\/visualizar_documento\/\d+\//.test(window.location.pathname);
  }

  function looksLikeTextEditPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('texto') || path.includes('editar_documento')) return true;
    return Boolean(findTinyEditor() || findTextAreaEditor(document) || document.querySelector('textarea#id_corpo, textarea#id_texto'));
  }

  function stripAutomationHash() {
    if (!window.location.hash || !window.history || !window.history.replaceState) return;
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  }

  function storePendingAutomation(payload, stage) {
    if (!payload || !payload.contentHtml) return;
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        payload,
        stage,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    } catch (error) {
      showNotice('SIAGES: nao foi possivel guardar o texto para continuar apos salvar.', 'error');
    }
  }

  function loadPendingAutomation() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      if (!pending?.payload || Date.now() - Number(pending.createdAt || 0) > PENDING_TTL_MS) {
        sessionStorage.removeItem(PENDING_KEY);
        return null;
      }
      return pending;
    } catch (error) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
  }

  function updatePendingStage(stage) {
    const pending = loadPendingAutomation();
    if (!pending) return;
    pending.stage = stage;
    pending.updatedAt = Date.now();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }

  function clearPendingAutomation() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  function findSubjectField(root) {
    const doc = root || document;
    const directMatch = doc.querySelector('#id_assunto, input[name="assunto"], textarea[name="assunto"]');
    if (directMatch) return directMatch;

    const candidates = Array.from(doc.querySelectorAll('input, textarea'));
    return candidates.find((field) => {
      const id = cleanText(field.id).toLowerCase();
      const name = cleanText(field.getAttribute('name') || '').toLowerCase();
      const label = field.id ? cleanText((doc.querySelector(`label[for="${field.id}"]`) || {}).textContent || '').toLowerCase() : '';
      return id.includes('assunto') || name.includes('assunto') || label.includes('assunto');
    }) || null;
  }

  function setNativeValue(field, value) {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(field, value);
    } else {
      field.value = value;
    }
  }

  function fillSubject(field, subject) {
    field.focus();
    setNativeValue(field, subject);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  }

  function findClickableByText(root, targetText) {
    const normalizedTarget = targetText.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"]'));
    return candidates.find((element) => {
      const text = cleanText(element.textContent || element.value || '').toLowerCase();
      return text === normalizedTarget || text.includes(normalizedTarget);
    }) || null;
  }

  function findSaveButton(root) {
    return findClickableByText(root || document, 'salvar');
  }

  function showNotice(message, type) {
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
    notice.style.maxWidth = '380px';
    notice.style.padding = '12px 14px';
    notice.style.borderRadius = '8px';
    notice.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.22)';
    notice.style.fontFamily = 'Arial, sans-serif';
    notice.style.fontSize = '13px';
    notice.style.lineHeight = '1.4';
    notice.style.color = '#ffffff';
    notice.style.background = type === 'error' ? '#b91c1c' : '#047857';
    document.body.appendChild(notice);
  }

  function waitFor(check, timeoutMs) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        let result = null;
        try {
          result = check();
        } catch (error) {
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

  function runCloneAutomation(payload) {
    if (!payload) return false;

    const subjectField = findSubjectField(document);
    if (!subjectField) {
      showNotice('SIAGES: campo de assunto nao encontrado. Preencha manualmente antes de salvar.', 'error');
      return false;
    }

    fillSubject(subjectField, payload.subject);
    storePendingAutomation(payload, 'awaiting-document-view');

    if (payload.mode === 'save-after-confirmation') {
      const scheduleSave = (saveButton) => {
        if (!saveButton) {
          showNotice('SIAGES: assunto preenchido, mas o botao Salvar nao foi encontrado.', 'error');
          return;
        }

        showNotice('SIAGES: assunto preenchido. Salvando documento...', 'success');
        window.setTimeout(() => {
          const currentSaveButton = document.contains(saveButton) ? saveButton : findSaveButton(document);
          currentSaveButton?.click();
        }, 250);
      };

      const saveButton = findSaveButton(document);
      if (saveButton) {
        scheduleSave(saveButton);
      } else {
        void waitFor(() => findSaveButton(document), 10000).then(scheduleSave);
      }
      return true;
    }

    showNotice('SIAGES: assunto preenchido. Ao salvar, a extensao tentara abrir Editar > Texto.', 'success');
    return true;
  }

  async function openTextEditorFromView() {
    const pending = loadPendingAutomation();
    if (!pending?.payload?.contentHtml) return false;

    const editButton = await waitFor(() => findClickableByText(document, 'editar'), 10000);
    if (!editButton) {
      showNotice('SIAGES: documento salvo, mas o botao Editar nao foi encontrado.', 'error');
      return false;
    }

    updatePendingStage('opening-text-editor');
    editButton.click();

    const textOption = await waitFor(() => findClickableByText(document, 'texto'), 10000);
    if (!textOption) {
      showNotice('SIAGES: menu Editar aberto, mas a opcao Texto nao foi encontrada.', 'error');
      return false;
    }

    showNotice('SIAGES: abrindo Editor > Texto...', 'success');
    textOption.click();
    return true;
  }

  function isTinyEditorReady(editor) {
    if (!editor || typeof editor.setContent !== 'function' || typeof editor.save !== 'function') return false;
    if (editor.initialized === false) return false;
    if (typeof editor.getBody === 'function') {
      const body = editor.getBody();
      if (!body || body.isContentEditable === false) return false;
    }
    return true;
  }

  function findTinyEditor() {
    if (window.tinymce) {
      const isVisible = (editor) => {
        if (!editor) return false;
        if (typeof editor.isHidden === 'function') return !editor.isHidden();
        return editor.isHidden !== true;
      };
      const activeEditor = window.tinymce.activeEditor;
      if (isVisible(activeEditor) && isTinyEditorReady(activeEditor)) return activeEditor;

      const editor = Array.from(window.tinymce.editors || [])
        .filter(isVisible)
        .find(isTinyEditorReady);
      if (editor) return editor;
    }
    return null;
  }

  function isVisibleFormControl(field) {
    if (field.hidden || field.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(field);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function findTextAreaEditor(root) {
    const doc = root || document;
    const candidates = Array.from(doc.querySelectorAll(
      'textarea#id_corpo, textarea#id_texto, textarea[name="corpo"], textarea[name="texto"], textarea[name="conteudo"], textarea[id*="corpo"], textarea[id*="texto"], textarea'
    ));
    return candidates.find(isVisibleFormControl) || null;
  }

  function cleanContentText(value) {
    if (!value) return '';
    const container = document.createElement('div');
    container.innerHTML = value;
    return cleanText(container.textContent || value);
  }

  function containsExpectedContent(actual, payload) {
    const expected = cleanContentText(payload?.plainText || payload?.contentHtml || '');
    const received = cleanContentText(actual || '');
    return Boolean(expected && received.includes(expected));
  }

  function fillTinyIframe(contentHtml) {
    const iframe = document.querySelector('iframe.tox-edit-area__iframe, iframe[id$="_ifr"], iframe');
    const body = iframe?.contentDocument?.body;
    if (!body || !body.isContentEditable) return false;
    body.innerHTML = contentHtml;
    body.dispatchEvent(new Event('input', { bubbles: true }));
    body.dispatchEvent(new Event('change', { bubbles: true }));
    return containsExpectedContent(body.innerHTML, { contentHtml });
  }

  function fillTextEditor(payload) {
    const contentHtml = payload?.contentHtml || '';
    if (!contentHtml.trim()) return false;

    const tinyEditor = findTinyEditor();
    if (tinyEditor) {
      tinyEditor.setContent(contentHtml);
      tinyEditor.fire('change');
      tinyEditor.save();
      return containsExpectedContent(
        typeof tinyEditor.getContent === 'function' ? tinyEditor.getContent() : '',
        payload,
      );
    }

    const textarea = findTextAreaEditor(document);
    if (textarea) {
      textarea.focus();
      textarea.value = contentHtml;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.blur();
      return containsExpectedContent(textarea.value, payload);
    }

    return fillTinyIframe(contentHtml);
  }

  async function fillTextEditorWhenReady() {
    const pending = loadPendingAutomation();
    if (!pending?.payload?.contentHtml || !looksLikeTextEditPage()) return false;

    const filled = await waitFor(() => fillTextEditor(pending.payload), 6000);
    if (!filled) {
      showNotice('SIAGES: editor de texto nao encontrado. Cole o conteudo manualmente.', 'error');
      return false;
    }

    clearPendingAutomation();
    showNotice('SIAGES: texto preenchido. Revise e clique em Salvar e Visualizar.', 'success');
    return true;
  }

  async function initCloneAutomation() {
    if (isClonePage()) {
      const payload = parsePayloadFromHash(window.location.hash);
      if (!payload) return;
      stripAutomationHash();
      runCloneAutomation(payload);
      return;
    }

    if (isViewPage()) {
      await openTextEditorFromView();
      return;
    }

    await fillTextEditorWhenReady();
  }

  window.__siagesSuapCloneAutomation = {
    parsePayloadFromHash,
    findSubjectField,
    fillSubject,
    findSaveButton,
    runCloneAutomation,
    openTextEditorFromView,
    fillTextEditor,
    fillTextEditorWhenReady,
    loadPendingAutomation,
    storePendingAutomation,
    clearPendingAutomation,
    initCloneAutomation,
  };

  if (!window.__SIAGES_SUAP_CLONE_TEST__) {
    initCloneAutomation();
  }
})();
