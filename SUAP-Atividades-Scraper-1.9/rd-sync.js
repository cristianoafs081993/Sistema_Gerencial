(function () {
  const ORIGIN = 'https://suap.ifrn.edu.br';
  const MAX_HTML_BYTES = 15 * 1024 * 1024;

  function allowedUrl(value) {
    try {
      const url = new URL(value);
      if (url.origin !== ORIGIN || url.username || url.password || url.hash) return false;
      const pairs = [...url.searchParams];
      if (new Set(pairs.map(([key]) => key)).size !== pairs.length) return false;
      if (url.pathname === '/plan_estrategico/plano_concluido/8/') return pairs.every(([key, val]) => key === 'unidade_gestora' && /^\d+$/.test(val));
      if (/^\/plan_estrategico\/(?:detalhar_requisicaodespesa\/\d+|listar_requisicoes_despesa\/8\/\d+)\/$/.test(url.pathname)) return pairs.every(([key, val]) => key === 'p' && /^[1-9]\d*$/.test(val));
      return url.pathname === '/admin/plan_estrategico/requisicaodespesa/' && /^\d+$/.test(url.searchParams.get('unidade_gestora') || '')
        && pairs.every(([key, val]) => (key === 'unidade_gestora' && /^\d+$/.test(val)) || (key === 'tab' && val === 'tab_any_data') || (key === 'p' && /^[1-9]\d*$/.test(val)));
    } catch { return false; }
  }

  // Executed in the SUAP tab: cookies stay in Chrome and never enter the payload.
  // Errors are returned (not thrown): executeScript drops exceptions from the page and yields an undefined result.
  async function capturePage(sourceUrl) {
    try {
      if (window.location.origin !== 'https://suap.ifrn.edu.br') throw new Error('Mantenha a aba do SUAP aberta para coletar as RDs.');
      const response = await fetch(sourceUrl, { credentials: 'include', signal: AbortSignal.timeout(60000) });
      if (response.url !== sourceUrl) {
        if (response.url.includes('/accounts/login/')) throw new Error('Sessão do SUAP expirada. Entre novamente e retome a coleta.');
        throw new Error(`Redirecionamento inesperado do SUAP (${response.url}).`);
      }
      if (!response.ok) throw new Error(`Leitura SUAP recusada (HTTP ${response.status}). Retome a coleta.`);
      if (Number(response.headers.get('content-length') || 0) > 15 * 1024 * 1024) throw new Error('Página SUAP maior que 15 MB.');
      const html = await response.text();
      if (new TextEncoder().encode(html).byteLength > 15 * 1024 * 1024) throw new Error('Página SUAP maior que 15 MB.');
      if (/<input[^>]+type=["']password["']/i.test(html)) throw new Error('Sessão do SUAP expirada. Entre novamente e retome a coleta.');
      return { html, sourceUrl };
    } catch (error) {
      const name = error && error.name;
      if (name === 'TimeoutError' || name === 'AbortError') return { error: 'O SUAP demorou mais de 60 s para responder. Retome a coleta.' };
      return { error: error instanceof Error && error.message ? error.message : 'Falha ao ler a página do SUAP.' };
    }
  }

  // The SUAP answers each page slowly: read the pages the server announces ahead in parallel and send them in batches.
  const PARALLEL_READS = 4;
  const MAX_BATCH_PAGES = 6;
  const MAX_BATCH_BYTES = 4 * 1024 * 1024;
  const BATCH_GRACE_MS = 1000;

  function validCapture(captured, url) {
    if (captured?.sourceUrl !== url || typeof captured.html !== 'string' || !captured.html.trim() || new TextEncoder().encode(captured.html).byteLength > MAX_HTML_BYTES) throw new Error('Captura SUAP inválida ou maior que 15 MB.');
    return captured;
  }

  async function collect({ unit, post, capture, progress, stopped = () => false, forceFull = false }) {
    let run = await post({ action: 'sync-extension', suapUnitCode: unit, ...(forceFull ? { forceFull:true } : {}) });
    await progress(run);
    const reads = new Map();
    const read = (url, ahead) => {
      if (!reads.has(url)) {
        const entry = { ahead, done: false, value: null, error: null };
        entry.promise = Promise.resolve().then(() => capture(url)).then(value => validCapture(value, url))
          .then(value => { entry.value = value; return value; }, error => { entry.error = error; throw error; })
          .finally(() => { entry.done = true; });
        entry.promise.catch(() => {});
        reads.set(url, entry);
      }
      return reads.get(url);
    };
    // Keeps PARALLEL_READS pages in flight, including while the previous batch is being processed by the server.
    const topUp = (urls, skip) => {
      let inFlight = [...reads.values()].filter(entry => !entry.done).length;
      for (const url of urls) {
        if (inFlight >= PARALLEL_READS) break;
        if (reads.has(url) || skip.has(url)) continue;
        read(url, true); inFlight++;
      }
    };
    while (run.status === 'collecting' && !stopped()) {
      if (run.busy) throw new Error('Outra coleta está em andamento. Retome após sua conclusão.');
      if (!run.runId || !allowedUrl(run.nextUrl)) throw new Error('O SIAGES retornou uma etapa de captura inválida.');
      const ahead = (Array.isArray(run.prefetchUrls) ? run.prefetchUrls : []).filter(url => url !== run.nextUrl && allowedUrl(url));
      const announced = new Set([run.nextUrl, ...ahead]);
      for (const url of reads.keys()) if (!announced.has(url)) reads.delete(url);
      let current = read(run.nextUrl, false);
      topUp(ahead, new Set());
      // A failed read-ahead is repeated once as the current step before reporting the error.
      if (current.ahead) await current.promise.catch(() => { reads.delete(run.nextUrl); current = read(run.nextUrl, false); });
      const pages = [await current.promise];
      let bytes = new TextEncoder().encode(pages[0].html).byteLength;
      // Waits briefly for neighbours already in flight: each extra page in the batch saves a server round trip.
      const graceUntil = Date.now() + BATCH_GRACE_MS;
      for (const url of ahead) {
        const entry = reads.get(url);
        if (entry && !entry.done && Date.now() < graceUntil) {
          let timer;
          await Promise.race([entry.promise.catch(() => {}), new Promise(resolve => { timer = setTimeout(resolve, graceUntil - Date.now()); })]);
          clearTimeout(timer);
        }
        if (pages.length >= MAX_BATCH_PAGES || !entry?.done || entry.error) break;
        bytes += new TextEncoder().encode(entry.value.html).byteLength;
        if (bytes > MAX_BATCH_BYTES) break;
        pages.push(entry.value);
      }
      // Sent pages are never reused: a page the server did not accept is read again.
      const sent = new Set(pages.map(page => page.sourceUrl));
      for (const url of sent) reads.delete(url);
      topUp(ahead, sent);
      run = await post({ action: 'sync-html', suapUnitCode: unit, runId: run.runId, ...(pages.length === 1 ? pages[0] : { pages }) });
      await progress(run);
    }
    reads.clear();
    if (!['preview','applied'].includes(run.status) && !stopped()) throw new Error(run.error || 'Captura incompleta. Retome pela extensão.');
    return run;
  }

  async function collectAll({ units, post, capture, progress, stopped = () => false, forceFull = false }) {
    const results = [];
    for (const unit of units) {
      if (stopped()) break;
      try {
        const run = await collect({ unit: unit.value, post, capture, stopped, forceFull,
          progress: run => progress({ unit, run, results: [...results], total: units.length, running: true }),
        });
        results.push({ unit: unit.value, code: unit.code, campusUasg: unit.parentUasg, run });
      } catch (error) {
        results.push({ unit: unit.value, code: unit.code, campusUasg: unit.parentUasg, error: error instanceof Error ? error.message : 'Coleta interrompida.' });
      }
      await progress({ results: [...results], total: units.length, running: !stopped() });
    }
    return { results, total: units.length, running: false, paused: stopped() };
  }

  globalThis.SuapeRdSync = { allowedUrl, capturePage, collect, collectAll };
})();
