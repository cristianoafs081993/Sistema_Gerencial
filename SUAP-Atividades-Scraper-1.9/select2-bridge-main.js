// Runs in the page (MAIN world): picks a Select2 option with the page's own jQuery/Select2,
// including AJAX widgets whose <select> only holds the chosen option. Content scripts ask
// for a pick with a `siages:select2-pick` event and receive `siages:select2-picked`.
(function () {
  'use strict';
  if (window.__siagesSelect2BridgeLoaded) return;
  window.__siagesSelect2BridgeLoaded = true;

  const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
  const normalize = (text) => clean(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // AJAX results may only carry HTML for the dropdown; parse it inertly.
  function textOf(item) {
    if (item.text) return clean(item.text);
    return clean(new DOMParser().parseFromString(String(item.html || ''), 'text/html').body.textContent);
  }

  function bestMatch(items, target) {
    const wanted = normalize(target);
    const list = items.filter((item) => item && item.id !== undefined && item.id !== null && item.id !== '');
    return list.find((item) => normalize(textOf(item)) === wanted) ||
      list.find((item) => normalize(textOf(item)).startsWith(wanted)) ||
      list.find((item) => normalize(textOf(item)).includes(wanted)) || null;
  }

  function query(adapter, term) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), 8000);
      try {
        adapter.query({ term, page: 1, _type: 'query' }, (data) => {
          clearTimeout(timer);
          resolve(Array.isArray(data?.results) ? data.results : []);
        });
      } catch (_) {
        clearTimeout(timer);
        resolve([]);
      }
    });
  }

  async function pick(select, target) {
    const $ = window.jQuery;
    const natives = Array.from(select.options).map((option) => ({ id: option.value, text: option.textContent }));
    let item = bestMatch(natives, target);
    if (!item && $ && typeof $.fn?.select2 === 'function') {
      for (let attempt = 0; attempt < 80 && !$(select).data('select2'); attempt++) await delay(100);
      const adapter = $(select).data('select2')?.dataAdapter;
      if (typeof adapter?.query === 'function') item = bestMatch(await query(adapter, target), target);
    }
    if (!item) return null;

    const id = String(item.id);
    const text = textOf(item);
    let option = Array.from(select.options).find((candidate) => candidate.value === id);
    if (!option) {
      option = new Option(text, id, true, true);
      select.appendChild(option);
    }
    select.value = id;
    option.selected = true;
    // A native event reaches both Select2 (bound via jQuery) and content-script listeners.
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if ($) $(select).trigger({ type: 'select2:select', params: { data: { ...item, id, text } } });
    return { id, text };
  }

  document.addEventListener('siages:select2-pick', async (event) => {
    let request;
    try {
      request = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    let result = null;
    try {
      const select = Array.from(document.querySelectorAll('select')).find((candidate) => candidate.name === request.name);
      if (select) result = await pick(select, request.text);
    } catch (_) {
      result = null;
    }
    document.dispatchEvent(new CustomEvent('siages:select2-picked', {
      detail: JSON.stringify({ requestId: request.requestId, ok: Boolean(result), ...(result || {}) }),
    }));
  });

  document.documentElement.dataset.siagesSelect2Bridge = 'ready';
})();
