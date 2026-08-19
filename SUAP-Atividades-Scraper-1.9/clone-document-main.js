// Script injetado no mundo principal (MAIN world) para acesso nativo ao TinyMCE no SUAP
(function () {
  const PENDING_KEY = 'siagesClonePendingV1';
  const PENDING_TTL_MS = 30 * 60 * 1000;

  function loadPendingAutomation() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      if (!pending?.payload?.contentHtml || Date.now() - Number(pending.createdAt || 0) > PENDING_TTL_MS) {
        return null;
      }
      return pending;
    } catch (_) {
      return null;
    }
  }

  function fillTinyMceMainWorld(contentHtml) {
    if (!contentHtml || !contentHtml.trim()) return false;
    let filled = false;

    if (window.tinymce) {
      const allEditors = [];
      if (window.tinymce.activeEditor) allEditors.push(window.tinymce.activeEditor);
      if (Array.isArray(window.tinymce.editors)) {
        window.tinymce.editors.forEach((ed) => {
          if (ed && !allEditors.includes(ed)) allEditors.push(ed);
        });
      }
      ['id_texto', 'id_corpo', 'texto', 'corpo'].forEach((id) => {
        if (window.tinymce.get) {
          const ed = window.tinymce.get(id);
          if (ed && !allEditors.includes(ed)) allEditors.push(ed);
        }
      });

      allEditors.forEach((editor) => {
        try {
          if (typeof editor.setContent === 'function') {
            editor.setContent(contentHtml);
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
    }

    const textareas = document.querySelectorAll(
      'textarea#id_texto, textarea#id_corpo, textarea[name="texto"], textarea[name="corpo"], textarea[name="conteudo"], textarea'
    );
    textareas.forEach((ta) => {
      try {
        ta.value = contentHtml;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    });

    return filled;
  }

  function initMainWorld() {
    const pending = loadPendingAutomation();
    if (!pending?.payload?.contentHtml) return;

    const html = pending.payload.contentHtml;

    fillTinyMceMainWorld(html);

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const ok = fillTinyMceMainWorld(html);
      if (ok || attempts >= 20) {
        clearInterval(interval);
      }
    }, 250);

    document.addEventListener('submit', () => {
      fillTinyMceMainWorld(html);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainWorld);
  } else {
    initMainWorld();
  }
})();
