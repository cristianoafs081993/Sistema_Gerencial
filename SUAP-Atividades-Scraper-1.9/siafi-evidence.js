(function () {
  'use strict';
  if (window.top !== window || window.__siagesSiafiEvidenceLoaded) return;
  window.__siagesSiafiEvidenceLoaded = true;
  const core = globalThis.SiagesSiafiEvidenceCore;
  const ID = 'siages-siafi-evidence';
  let toolbar, running = false, cancelled = false, lastRecord = null;
  let pageCount = 0;
  let objectUrls = [];
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const byId = id => document.getElementById(id);
  const root = () => byId(core.TABS);
  const status = message => { if (toolbar) toolbar.querySelector('[role="status"]').textContent = message; };
  const modal = () => {
    const element = byId(`${core.FORM}:modalPredocContainer`);
    return core.visible(element) ? element : null;
  };
  const loading = () => core.visible(byId('mpStatusContainer'));
  function check() {
    if (cancelled) throw new Error('Captura cancelada.');
    if (document.visibilityState === 'hidden') throw new Error('A aba SIAFI deixou de estar visível. Volte a ela e repita a captura.');
    if (!root()) throw new Error('O documento SIAFI foi fechado ou a sessão expirou.');
    if (lastRecord && JSON.stringify(core.documentIdentity(document)) !== JSON.stringify(lastRecord.document)) throw new Error('O documento mudou durante a captura. Repita no DH correto.');
  }
  async function until(predicate, message, checkCancellation = true) {
    const start = Date.now(); let stable = 0;
    while (Date.now() - start < 20000) {
      if (checkCancellation) check();
      if (predicate() && !loading()) { if (++stable >= 3) return; } else stable = 0;
      await delay(120);
    }
    throw new Error(message);
  }
  async function selectTab(id, restoring = false) {
    if (restoring) await until(() => !loading(), 'O SIAFI não terminou a operação em andamento.', false);
    const element = byId(id);
    if (!element) throw new Error('A aba esperada não está mais disponível.');
    if (!core.active(element)) {
      if (element.disabled) throw new Error(`A aba ${element.value} está desabilitada.`);
      // Only these read/navigation actions can bypass the pending pre-doc alert.
      window.__siagesSiafiEvidenceNavigation = element;
      try { element.click(); } finally { window.__siagesSiafiEvidenceNavigation = null; }
    }
    await until(() => core.active(byId(id)), 'O SIAFI não concluiu a troca de aba.', !restoring);
  }
  function pendingEdits() {
    return Array.from(document.querySelectorAll(`[id^="${core.FORM}:"]`)).some(element =>
      element.matches('input,button') && !element.disabled && core.visible(element) &&
      (/btnConfirmarDadosBasicos$|_painel_confirmar$/.test(element.id)));
  }
  async function expandDetails() {
    const changed = [];
    for (const element of Array.from(root().querySelectorAll('[id$=":panelCollapse"].closed'))) {
      if (core.visible(element)) { element.click(); changed.push({ id: element.id, kind: 'item' }); }
    }
    for (const element of Array.from(root().querySelectorAll('.rich-stglpanel-header'))) {
      const body = byId(element.id.replace(/_header$/, '_body'));
      if (core.visible(element) && body && !core.visible(body)) { element.click(); changed.push({ id: element.id, kind: 'total' }); }
    }
    await delay(180);
    return () => { for (const entry of changed.reverse()) byId(entry.id)?.click(); };
  }
  function unscroll(element) {
    const changes = [];
    const expanded = new WeakSet();
    // RichFaces pre-docs and long lists have their own scroll area.
    // Revisit ancestors after expanding children: RichFaces nests fixed-height
    // overflow:hidden containers around divScrollDados.
    for (let pass = 0; pass < 6; pass++) {
      let count = 0;
      for (const candidate of [element, ...element.querySelectorAll('div,table,td')]) {
        const style = getComputedStyle(candidate);
        if (!expanded.has(candidate) && core.visible(candidate) && (candidate === element || candidate.id === 'divScrollDados' ||
          (/(auto|scroll|hidden)/.test(style.overflowY) && candidate.scrollHeight > candidate.clientHeight + 2))) {
          changes.push({ element: candidate, style: candidate.getAttribute('style'), top: candidate.scrollTop });
          expanded.add(candidate); count++;
          candidate.style.setProperty('height', 'auto', 'important');
          candidate.style.setProperty('max-height', 'none', 'important');
          candidate.style.setProperty('overflow', 'visible', 'important');
        }
      }
      if (!count) break;
    }
    return () => changes.reverse().forEach(change => {
      if (change.style === null) change.element.removeAttribute('style'); else change.element.setAttribute('style', change.style);
      change.element.scrollTop = change.top;
    });
  }
  const imageFrom = url => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Falha ao ler a captura do navegador.')); image.src = url;
  });
  function jpegPage(canvas, title) {
    const raw = atob(canvas.toDataURL('image/jpeg', 0.96).split(',')[1]);
    return { title, width: canvas.width, height: canvas.height, jpeg: Uint8Array.from(raw, character => character.charCodeAt(0)) };
  }
  async function screenshotPages(element, title, pages) {
    const restoreLayout = unscroll(element);
    const before = { x: scrollX, y: scrollY };
    const captureStyle = element.getAttribute('style');
    let fixed = false;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).position === 'fixed') { fixed = true; break; }
    }
    const barVisibility = toolbar.style.visibility;
    toolbar.style.visibility = 'hidden';
    try {
      // RichFaces puts the pre-doc inside a zero-height fixed wrapper and locks
      // body scrolling. Move the real modal between tiles; window.scrollTo
      // cannot expose its lower fields. Keep its original width and restore all
      // inline styles before returning to SIAFI.
      if (fixed) {
        const width = element.getBoundingClientRect().width;
        for (const [property, value] of Object.entries({ position: 'fixed', width: `${width}px`, 'box-sizing': 'border-box', left: '16px', top: '16px', right: 'auto', bottom: 'auto', margin: '0' })) {
          element.style.setProperty(property, value, 'important');
        }
      }
      await delay(180);
      const rect = element.getBoundingClientRect();
      const bounds = { x: Math.max(0, rect.left + scrollX), y: Math.max(0, rect.top + scrollY), width: rect.width, height: rect.height };
      const viewport = { width: document.documentElement.clientWidth || innerWidth, height: document.documentElement.clientHeight || innerHeight };
      if (bounds.width <= 0 || bounds.height <= 0) throw new Error('A tela do SIAFI não está disponível para captura.');
      // Leave a small overlap so a line crossing a viewport boundary stays legible.
      const tileWidth = Math.max(1, viewport.width - 32), tileHeight = Math.max(1, viewport.height - 64);
      const total = Math.ceil(bounds.width / tileWidth) * Math.ceil(bounds.height / tileHeight);
      if (pageCount + total > 160) throw new Error('Documento muito extenso: limite de 160 imagens. Capture em partes.');
      for (let y = 0; y < bounds.height; y += tileHeight) {
        for (let x = 0; x < bounds.width; x += tileWidth) {
          check();
          if (fixed) {
            element.style.setProperty('left', `${16 - x}px`, 'important');
            element.style.setProperty('top', `${16 - y}px`, 'important');
          } else window.scrollTo({ left: bounds.x + x, top: bounds.y + y, behavior: 'instant' });
          await delay(160);
          const currentRect = element.getBoundingClientRect();
          const left = currentRect.left + x, top = currentRect.top + y;
          const sx = Math.max(0, left), sy = Math.max(0, top);
          const width = Math.min(tileWidth + 16, bounds.width - x, viewport.width - sx);
          const height = Math.min(tileHeight + 24, bounds.height - y, viewport.height - sy);
          if (left < -1 || top < -1 || width <= 0 || height <= 0) throw new Error('O SIAFI reposicionou a tela durante a captura. Repita a operação.');
          const response = await chrome.runtime.sendMessage({ source: 'siages-siafi-evidence', type: 'capture' });
          if (!response?.ok) throw new Error(response?.error || 'O navegador recusou a captura.');
          check();
          const image = await imageFrom(response.dataUrl);
          const rx = image.width / innerWidth, ry = image.height / innerHeight;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * rx); canvas.height = Math.round(height * ry);
          canvas.getContext('2d').drawImage(image, Math.round(sx * rx), Math.round(sy * ry), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
          const page = jpegPage(canvas, `${title} - trecho ${pages.length + 1}`);
          pages.push(page); pageCount++;
        }
      }
    } finally {
      if (captureStyle === null) element.removeAttribute('style'); else element.setAttribute('style', captureStyle);
      restoreLayout(); toolbar.style.visibility = barVisibility;
      window.scrollTo({ left: before.x, top: before.y, behavior: 'instant' });
    }
  }
  async function capturePredocs(section, pages) {
    for (const descriptor of core.predocs(root())) {
      check();
      const entry = { ...descriptor, sectionKey: section.key, status: descriptor.filled ? 'pending' : 'missing' };
      lastRecord.predocs.push(entry);
      if (!descriptor.filled) { lastRecord.warnings.push(`Pré-doc não preenchido: ${descriptor.row || descriptor.id}`); continue; }
      if (!toolbar.querySelector('input').checked) { entry.status = 'skipped'; lastRecord.warnings.push(`Pré-doc não capturado por opção: ${descriptor.row}`); continue; }
      status(`Capturando pré-doc ${lastRecord.predocs.length}…`);
      const returnScroll = { x: scrollX, y: scrollY };
      try {
        byId(descriptor.id).click();
        await until(() => Boolean(modal()), 'O pré-doc não abriu.');
        const data = core.extract(modal());
        const firstPage = pages.length + 1;
        await screenshotPages(byId(`${core.FORM}:modalPredocCDiv`) || modal(), `Pré-doc ${descriptor.row}`, pages);
        Object.assign(entry, data, { status: 'captured', firstPage, lastPage: pages.length });
      } finally {
        if (modal()) {
          const back = byId(`${core.FORM}:btnRetornarPredoc`);
          if (!back || back.disabled) throw new Error('Feche o pré-doc usando Retornar e repita a captura.');
          back.click();
          await until(() => !modal(), 'O pré-doc não fechou.', false);
        }
        window.scrollTo({ left: returnScroll.x, top: returnScroll.y, behavior: 'instant' });
      }
    }
  }
  async function captureTab(tab, pages) {
    if (!tab.id || !tab.available) {
      lastRecord.sections.push({ key: tab.key, title: tab.title || tab.key, status: 'unavailable' });
      lastRecord.warnings.push(`Aba não disponível: ${tab.title || tab.key}`); return;
    }
    status(`Capturando ${tab.title}…`);
    await selectTab(tab.id);
    if (tab.key === 'deducoes' && !core.hasDeductions(root())) {
      lastRecord.sections.push({ key: tab.key, title: tab.title, status: 'empty', ...core.extract(root()) }); return;
    }
    const originalSituation = Array.from(root().querySelectorAll('.linkParaSituacao')).find(element => element.disabled)?.id;
    const situations = Array.from(root().querySelectorAll('.linkParaSituacao')).map(element => ({ id: element.id, title: element.value }));
    try {
      for (const situation of situations.length ? situations : [null]) {
        if (situation && !byId(situation.id)?.disabled) {
          byId(situation.id).click();
          await until(() => byId(situation.id)?.disabled, 'A situação não carregou.');
        }
        const restoreDetails = await expandDetails();
        try {
          const section = { key: tab.key, title: tab.title, situation: situation?.title || null, status: 'captured', ...core.extract(root()), firstPage: pages.length + 1 };
          await screenshotPages(byId('divDH') || root(), `${tab.title}${situation ? ` - ${situation.title}` : ''}`, pages);
          section.lastPage = pages.length;
          lastRecord.sections.push(section);
          await capturePredocs(section, pages);
        } finally { restoreDetails(); }
      }
    } finally {
      if (originalSituation && byId(originalSituation) && !byId(originalSituation).disabled) {
        byId(originalSituation).click();
        await until(() => byId(originalSituation)?.disabled, 'Não foi possível restaurar a situação original.', false);
      }
    }
  }
  function downloads(record, pages) {
    objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls = [];
    const identity = record.document;
    const name = `SIAFI-${identity.ug}-${identity.year}-${identity.type}-${identity.number === '-' ? 'em-preenchimento' : identity.number}-${record.startedAt.replace(/[:.]/g, '-')}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const json = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' });
    const pdf = new Blob([globalThis.SiagesSiafiEvidencePdf.buildPdf(pages, record)], { type: 'application/pdf' });
    const results = toolbar.querySelector('[data-results]'); results.replaceChildren();
    for (const [label, extension, blob] of [['Baixar PDF', 'pdf', pdf], ['Baixar dados (JSON)', 'json', json]]) {
      const anchor = document.createElement('a'); anchor.textContent = label; anchor.download = `${name}.${extension}`;
      anchor.href = URL.createObjectURL(blob); objectUrls.push(anchor.href); results.appendChild(anchor);
    }
  }
  async function start() {
    if (running) return;
    if (modal()) { status('Retorne do pré-doc antes de iniciar a captura.'); return; }
    if (pendingEdits()) { status('Conclua a edição da aba no SIAFI antes de capturar.'); return; }
    const originalTab = core.getTabs(document).find(tab => tab.active)?.id;
    if (!originalTab) { status('Não foi possível identificar a aba ativa do DH.'); return; }
    let tabs;
    try { tabs = core.planTabs(document); } catch (error) { status(error.message); return; }
    const originalScroll = { x: scrollX, y: scrollY };
    const pages = [];
    cancelled = false; running = true; pageCount = 0;
    lastRecord = core.createRecord(core.documentIdentity(document), location.href);
    toolbar.querySelector('[data-results]').replaceChildren();
    toolbar.querySelector('[data-start]').disabled = true;
    toolbar.querySelector('input').disabled = true;
    toolbar.querySelector('[data-cancel]').hidden = false;
    let failure = null;
    try {
      for (const tab of tabs) { check(); await captureTab(tab, pages); }
      lastRecord.status = lastRecord.warnings.length ? 'partial' : 'complete';
    } catch (error) { failure = error; lastRecord.status = 'failed'; lastRecord.warnings.push(error.message); }
    finally {
      try { if (!modal() && root()) await selectTab(originalTab, true); }
      catch (error) { lastRecord.warnings.push(error.message); lastRecord.status = 'failed'; failure ||= error; }
      window.scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
      running = false; toolbar.querySelector('[data-start]').disabled = false;
      toolbar.querySelector('input').disabled = false; toolbar.querySelector('[data-cancel]').hidden = true;
      lastRecord.finishedAt = new Date().toISOString();
    }
    if (failure) { status(`Não foi gerado comprovante: ${failure.message}`); return; }
    try {
      downloads(lastRecord, pages);
      status(lastRecord.status === 'complete' ? 'Captura pronta. Baixe o PDF e o JSON.' : `Captura parcial: ${lastRecord.warnings.join(' ')} Confira os avisos no JSON.`);
    } catch (error) { status(`Falha ao gerar os arquivos: ${error.message}`); }
  }
  function blockDuringCapture(event) {
    if (!running || !event.isTrusted || event.target.closest?.(`#${ID}`)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }
  function mount() {
    if (!document.body) return;
    if (!toolbar) {
      toolbar = document.createElement('aside'); toolbar.id = ID; toolbar.setAttribute('aria-label', 'Comprovante SIAFI');
      toolbar.innerHTML = '<strong>Comprovante da liquidação</strong><label><input type="checkbox" checked> Incluir pré-docs preenchidos</label><div class="siages-evidence-actions"><button type="button" data-start>Capturar liquidação</button><button type="button" data-cancel hidden>Cancelar captura</button><span data-results></span></div><p role="status" aria-live="polite">Gera PDF das telas e dados em JSON neste navegador.</p>';
      toolbar.querySelector('[data-start]').addEventListener('click', () => { void start(); });
      toolbar.querySelector('[data-cancel]').addEventListener('click', () => { cancelled = true; status('Cancelando e restaurando a aba…'); });
      document.body.appendChild(toolbar);
    }
    const hide = !root(); if (toolbar.hidden !== hide) toolbar.hidden = hide;
  }
  document.addEventListener('click', blockDuringCapture, true);
  document.addEventListener('keydown', blockDuringCapture, true);
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount();
  if (window.__SIAGES_SIAFI_EVIDENCE_TEST__) window.__siagesSiafiEvidence = { start, selectTab, pendingEdits, captureTab, screenshotPages, unscroll, getRecord: () => lastRecord, destroy() {
    observer.disconnect(); toolbar?.remove(); objectUrls.forEach(url => URL.revokeObjectURL(url));
    document.removeEventListener('click', blockDuringCapture, true); document.removeEventListener('keydown', blockDuringCapture, true);
    window.__siagesSiafiEvidenceLoaded = false;
  } };
})();
