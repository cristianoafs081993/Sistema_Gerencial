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

  function isDocumentListPage() {
    return /\/admin\/documento_eletronico\/documentotexto\/$/.test(window.location.pathname);
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

  function armCloneSaveContinuation(subjectField) {
    const form = subjectField?.form || findSaveButton(document)?.closest('form');
    const saveButton = findSaveButton(document);
    if (!form) return;

    const markSubmitted = () => updatePendingStage('awaiting-created-document');
    form.addEventListener('submit', markSubmitted, { once: true });
    saveButton?.addEventListener('click', markSubmitted, { once: true });
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
    armCloneSaveContinuation(subjectField);

    showNotice('SIAGES: assunto preenchido. Revise os campos e clique em Salvar para continuar o preenchimento do texto.', 'success');
    return true;
  }

  function findCreatedDraftEditorPath(root, subject) {
    const normalizedSubject = cleanText(subject);
    if (!normalizedSubject) return null;

    const editLinks = Array.from((root || document).querySelectorAll(
      'a[href*="/admin/documento_eletronico/documentotexto/"]',
    ));

    for (const editLink of editLinks) {
      const match = (editLink.getAttribute('href') || '').match(
        /\/admin\/documento_eletronico\/documentotexto\/(\d+)\/change/,
      );
      if (!match) continue;

      const row = editLink.closest('tr');
      if (!row) continue;

      const cellTexts = Array.from(row.children).map((cell) => cleanText(cell.textContent || ''));
      const hasExactSubject = cellTexts.includes(normalizedSubject);
      const isDraft = cellTexts.some((cellText) => cellText.toLowerCase().includes('rascunho'));
      if (hasExactSubject && isDraft) {
        return `/documento_eletronico/editar_documento/${match[1]}/`;
      }
    }

    return null;
  }

  function navigateTo(url) {
    if (
      window.__SIAGES_SUAP_CLONE_TEST__
      && typeof window.__siagesSuapCloneTestNavigate === 'function'
    ) {
      window.__siagesSuapCloneTestNavigate(url);
      return;
    }

    window.location.assign(url);
  }

  async function openTextEditorFromDocumentList() {
    const pending = loadPendingAutomation();
    const canRecoverFromList = (
      pending?.stage === 'awaiting-created-document'
      || pending?.stage === 'opening-text-editor'
    );
    if (!canRecoverFromList || !pending.payload?.contentHtml) return false;

    const editorPath = await waitFor(
      () => findCreatedDraftEditorPath(document, pending.payload.subject),
      10000,
    );
    if (!editorPath) {
      showNotice('SIAGES: o rascunho criado nao foi localizado na listagem para abrir o editor de texto.', 'error');
      return false;
    }

    updatePendingStage('opening-text-editor');
    showNotice('SIAGES: abrindo o editor de texto do rascunho criado...', 'success');
    navigateTo(editorPath);
    return true;
  }

  async function openTextEditorFromView() {
    const pending = loadPendingAutomation();
    if (!pending?.payload?.contentHtml) return false;

    const documentId = window.location.pathname.match(
      /\/documento_eletronico\/visualizar_documento\/(\d+)\//,
    )?.[1];
    if (documentId) {
      updatePendingStage('opening-text-editor');
      showNotice('SIAGES: abrindo o editor de texto do rascunho criado...', 'success');
      navigateTo(`/documento_eletronico/editar_documento/${documentId}/`);
      return true;
    }

    const directTextLink = document.querySelector('a[href*="editar_texto_documento"], a[href*="editar_texto"]');
    if (directTextLink) {
      updatePendingStage('opening-text-editor');
      showNotice('SIAGES: abrindo Editor > Texto...', 'success');
      directTextLink.click();
      return true;
    }

    const editButton = await waitFor(
      () => findClickableByText(document, 'editar') || document.querySelector('a[href*="editar_texto_documento"], a[href*="editar_texto"]'),
      10000,
    );
    if (!editButton) {
      showNotice('SIAGES: documento salvo, mas o botao Editar nao foi encontrado.', 'error');
      return false;
    }

    const href = editButton.getAttribute('href') || '';
    if (href.includes('editar_texto')) {
      updatePendingStage('opening-text-editor');
      showNotice('SIAGES: abrindo Editor > Texto...', 'success');
      editButton.click();
      return true;
    }

    updatePendingStage('opening-text-editor');
    editButton.click();

    const textOption = await waitFor(
      () => document.querySelector('a[href*="editar_texto_documento"], a[href*="editar_texto"]') || findClickableByText(document, 'texto'),
      10000,
    );
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
    if (!received) return false;
    if (expected && received.includes(expected)) return true;
    return received.length >= 20;
  }

  function fillTinyIframe(contentHtml) {
    const iframes = Array.from(document.querySelectorAll('iframe.tox-edit-area__iframe, iframe[id$="_ifr"], iframe'));
    let filled = false;
    for (const iframe of iframes) {
      try {
        const body = iframe?.contentDocument?.body;
        if (body && (body.isContentEditable || body.classList.contains('mce-content-body'))) {
          body.innerHTML = contentHtml;
          body.dispatchEvent(new Event('input', { bubbles: true }));
          body.dispatchEvent(new Event('change', { bubbles: true }));
          body.dispatchEvent(new Event('blur', { bubbles: true }));
          filled = true;
        }
      } catch (_) {}
    }
    return filled;
  }

  function injectMainWorldFill(contentHtml) {
    try {
      const script = document.createElement('script');
      script.setAttribute('data-siages-injected', 'true');
      script.textContent = `
        (function() {
          try {
            var html = ${JSON.stringify(contentHtml)};
            var filled = false;
            if (window.tinymce) {
              var allEditors = [];
              if (window.tinymce.activeEditor) allEditors.push(window.tinymce.activeEditor);
              if (Array.isArray(window.tinymce.editors)) {
                window.tinymce.editors.forEach(function(ed) {
                  if (ed && allEditors.indexOf(ed) === -1) allEditors.push(ed);
                });
              }
              ['id_texto', 'id_corpo', 'texto', 'corpo'].forEach(function(id) {
                if (window.tinymce.get) {
                  var ed = window.tinymce.get(id);
                  if (ed && allEditors.indexOf(ed) === -1) allEditors.push(ed);
                }
              });

              allEditors.forEach(function(editor) {
                try {
                  if (typeof editor.setContent === 'function') {
                    editor.setContent(html);
                    if (typeof editor.fire === 'function') {
                      editor.fire('change');
                      editor.fire('input');
                      editor.fire('blur');
                    }
                    if (typeof editor.save === 'function') editor.save();
                    if (typeof editor.nodeChanged === 'function') editor.nodeChanged();
                    if (typeof editor.setDirty === 'function') editor.setDirty(true);
                    filled = true;
                  }
                } catch (_) {}
              });

              if (typeof window.tinymce.triggerSave === 'function') {
                try { window.tinymce.triggerSave(); } catch (_) {}
              }
            } else {
              var textareas = document.querySelectorAll('textarea#id_texto, textarea#id_corpo, textarea[name="texto"], textarea[name="corpo"], textarea[name="conteudo"], textarea');
              textareas.forEach(function(ta) {
                if (ta.offsetWidth > 0 || ta.offsetHeight > 0 || window.getComputedStyle(ta).display !== 'none') {
                  try {
                    ta.value = html;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.dispatchEvent(new Event('change', { bubbles: true }));
                  } catch (_) {}
                }
              });
            }

            document.documentElement.setAttribute('data-siages-content-injected', filled ? 'tinymce' : 'textarea');
          } catch (e) {
            console.warn('SIAGES: Erro ao injetar conteudo no TinyMCE', e);
          }
        })();
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      return true;
    } catch (e) {
      return false;
    }
  }

  function attachFormSubmitProtection(contentHtml) {
    if (window.__siagesSubmitProtected) return;
    window.__siagesSubmitProtected = true;

    document.addEventListener(
      'submit',
      () => {
        injectMainWorldFill(contentHtml);
        const textareas = document.querySelectorAll(
          'textarea#id_texto, textarea#id_corpo, textarea[name="texto"], textarea[name="corpo"], textarea[name="conteudo"]'
        );
        textareas.forEach((ta) => {
          if (!ta.value || ta.value.trim().length < 20) {
            ta.value = contentHtml;
          }
        });
      },
      true,
    );

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const btn = target?.closest('button, input[type="submit"], input[type="button"], a');
        if (!btn) return;
        const text = cleanText(btn.textContent || btn.getAttribute('value') || '').toLowerCase();
        if (text.includes('salvar') || text.includes('visualizar') || text.includes('concluir')) {
          injectMainWorldFill(contentHtml);
          const textareas = document.querySelectorAll(
            'textarea#id_texto, textarea#id_corpo, textarea[name="texto"], textarea[name="corpo"], textarea[name="conteudo"]'
          );
          textareas.forEach((ta) => {
            if (!ta.value || ta.value.trim().length < 20) {
              ta.value = contentHtml;
            }
          });
        }
      },
      true,
    );
  }

  function fillTextEditor(payload) {
    const contentHtml = payload?.contentHtml || '';
    if (!contentHtml.trim()) return false;

    let tinyOk = false;
    const tinyEditor = findTinyEditor();
    if (tinyEditor) {
      tinyEditor.setContent(contentHtml);
      tinyEditor.fire('change');
      tinyEditor.save();
      tinyOk = containsExpectedContent(
        typeof tinyEditor.getContent === 'function' ? tinyEditor.getContent() : '',
        payload,
      );
    }

    injectMainWorldFill(contentHtml);

    const textarea = findTextAreaEditor(document);
    if (textarea) {
      textarea.focus();
      textarea.value = contentHtml;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      textarea.blur();
      return containsExpectedContent(textarea.value, payload);
    }

    const iframeOk = fillTinyIframe(contentHtml);
    attachFormSubmitProtection(contentHtml);

    if (tinyOk) {
      return true;
    }

    if (iframeOk) {
      return true;
    }

    return document.documentElement.getAttribute('data-siages-content-injected') === 'tinymce';
  }

  async function fillTextEditorWhenReady() {
    const pending = loadPendingAutomation();
    if (!pending?.payload?.contentHtml || !looksLikeTextEditPage()) return false;

    const filled = await waitFor(() => fillTextEditor(pending.payload), 10000);
    if (!filled) {
      showNotice('SIAGES: editor de texto nao encontrado. Cole o conteudo manualmente.', 'error');
      return false;
    }

    window.setTimeout(() => {
      fillTextEditor(pending.payload);
    }, 300);
    window.setTimeout(() => {
      fillTextEditor(pending.payload);
    }, 1000);

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

    if (isDocumentListPage()) {
      await openTextEditorFromDocumentList();
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
    openTextEditorFromDocumentList,
    findCreatedDraftEditorPath,
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
