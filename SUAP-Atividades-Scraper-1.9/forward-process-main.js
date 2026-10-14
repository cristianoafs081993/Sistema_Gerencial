// Runs in the page (MAIN world) so it can drive the SUAP select2 widgets with the page's jQuery.
(function () {
  'use strict';
  if (window.__siagesForwardProcessLoaded) return;
  window.__siagesForwardProcessLoaded = true;

  const HASH_PARAM = 'siagesEncaminhar';
  const NOTICE_ID = 'siages-suap-forward-notice';

  const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
  const normalize = (text) => clean(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function parsePayloadFromHash(hash) {
    const raw = new URLSearchParams(String(hash || '').replace(/^#/, '')).get(HASH_PARAM);
    if (!raw) return null;
    try {
      const payload = JSON.parse(raw);
      if (payload?.source !== 'siages' || payload.version !== 1 || payload.action !== 'suap_forward_process') return null;
      const option = (value) => (value?.id ? { id: String(value.id), text: clean(value.text) } : null);
      return {
        suapId: String(payload.suapId || ''),
        despacho: clean(payload.despacho),
        campus: option(payload.campus),
        setor: option(payload.setor),
        papel: clean(payload.papel),
      };
    } catch (_) {
      return null;
    }
  }

  function stripHash() {
    if (window.history?.replaceState) window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  }

  const form = () => document.getElementById('tramite_formencaminharparasetor') || document.querySelector('form');
  const field = (name) => form()?.querySelector(`[name="${name}"]`) || null;

  function fire(element, type) {
    element.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function fillTextarea(element, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(element, value); else element.value = value;
    fire(element, 'input');
    fire(element, 'change');
    fire(element, 'keyup'); // atualiza o contador de caracteres do SUAP
  }

  // The select2 fields only carry the options already chosen; add the target option when missing.
  function selectOption(select, { id, text }) {
    let option = Array.from(select.options).find((item) => item.value === id);
    if (!option) {
      option = new Option(text, id, true, true);
      select.appendChild(option);
    }
    select.value = id;
    option.selected = true;
    const $ = window.jQuery;
    if ($ && typeof $.fn?.select2 === 'function') {
      $(select).val(id).trigger('change');
      $(select).trigger({ type: 'select2:select', params: { data: { id, text } } });
    } else {
      fire(select, 'change');
    }
  }

  function selectByText(select, text) {
    const target = normalize(text);
    const option = Array.from(select.options).find((item) => normalize(item.textContent) === target) ||
      Array.from(select.options).find((item) => item.value && normalize(item.textContent).includes(target));
    if (!option) return false;
    select.value = option.value;
    fire(select, 'change');
    return true;
  }

  function showNotice(message, type) {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    Object.assign(notice.style, {
      position: 'fixed', zIndex: '2147483647', top: '16px', right: '16px', maxWidth: '420px', padding: '12px 16px',
      borderRadius: '10px', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)', fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px', fontWeight: '600', lineHeight: '1.4', color: '#ffffff',
      background: type === 'error' ? '#dc2626' : '#059669', border: `1px solid ${type === 'error' ? '#b91c1c' : '#047857'}`,
    });
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6000);
  }

  async function waitFor(check, timeoutMs = 8000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const result = check();
      if (result) return result;
      await delay(100);
    }
    return check();
  }

  async function run(payload) {
    const fields = () => {
      const despacho = field('despacho_corpo');
      const campus = field('destinatario_uo');
      const setor = field('destinatario_setor_autocompletar');
      return despacho && campus && setor ? { despacho, campus, setor } : null;
    };
    // Wait until the page has initialized select2, when jQuery is available.
    const ready = await waitFor(() => {
      const found = fields();
      const $ = window.jQuery;
      return found && (!$ || typeof $.fn?.select2 !== 'function' || $(found.setor).data('select2')) ? found : null;
    }) || fields();
    if (!ready) {
      showNotice('SIAGES: não encontrei o formulário de encaminhamento para preencher.', 'error');
      return false;
    }

    const missing = [];
    if (payload.despacho) fillTextarea(ready.despacho, payload.despacho);
    const autocomplete = form().querySelector('input[name="tipo_busca_setor"][value="autocompletar"]');
    if (autocomplete && !autocomplete.checked) autocomplete.click();
    if (payload.campus) selectOption(ready.campus, payload.campus);
    // The sector widget filters by campus; let the campus change settle before choosing it.
    await delay(150);
    if (payload.setor) selectOption(ready.setor, payload.setor);
    const papel = field('papel');
    if (payload.papel && !(papel && selectByText(papel, payload.papel))) missing.push(`perfil ${payload.papel}`);

    // Reapply the sector in case a campus change handler cleared it.
    await delay(350);
    if (payload.setor && ready.setor.value !== payload.setor.id) selectOption(ready.setor, payload.setor);

    field('senha')?.focus();
    showNotice(missing.length
      ? `SIAGES: formulário preenchido, mas não encontrei ${missing.join(', ')}. Confira antes de salvar.`
      : 'SIAGES: encaminhamento à DG/CN preenchido. Informe a senha e clique em Salvar.', missing.length ? 'error' : 'success');
    return true;
  }

  async function init() {
    if (!/\/processo_eletronico\/processo\/encaminhar\/\d+\/?$/.test(window.location.pathname)) return;
    const payload = parsePayloadFromHash(window.location.hash);
    if (!payload) return;
    stripHash();
    const pageId = window.location.pathname.match(/\/encaminhar\/(\d+)/)?.[1];
    if (payload.suapId && pageId && payload.suapId !== pageId) return;
    await run(payload);
  }

  window.__siagesForwardProcess = { parsePayloadFromHash, run, init };
  // The palette only changes the hash when the form is already open.
  window.addEventListener('hashchange', () => { void init(); });
  if (!window.__SIAGES_SUAP_FORWARD_TEST__) void init();
})();
