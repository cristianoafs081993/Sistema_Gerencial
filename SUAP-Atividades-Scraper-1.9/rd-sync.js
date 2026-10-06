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
  async function capturePage(sourceUrl) {
    if (window.location.origin !== 'https://suap.ifrn.edu.br') throw new Error('Mantenha a aba do SUAP aberta para coletar as RDs.');
    const response = await fetch(sourceUrl, { credentials: 'include', signal: AbortSignal.timeout(12000) });
    if (response.url !== sourceUrl) {
      if (response.url.includes('/accounts/login/')) throw new Error('Sessão do SUAP expirada. Entre novamente e retome a coleta.');
      throw new Error('Redirecionamento inesperado do SUAP.');
    }
    if (!response.ok) throw new Error(`Leitura SUAP recusada (HTTP ${response.status}). Retome a coleta.`);
    if (Number(response.headers.get('content-length') || 0) > 15 * 1024 * 1024) throw new Error('Página SUAP maior que 15 MB.');
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > 15 * 1024 * 1024) throw new Error('Página SUAP maior que 15 MB.');
    if (/<input[^>]+type=["']password["']/i.test(html)) throw new Error('Sessão do SUAP expirada. Entre novamente e retome a coleta.');
    return { html, sourceUrl };
  }

  async function collect({ unit, post, capture, progress, stopped = () => false }) {
    let run = await post({ action: 'sync-extension', suapUnitCode: unit });
    await progress(run);
    while (run.status === 'collecting' && !stopped()) {
      if (run.busy) throw new Error('Outra coleta está em andamento. Retome após sua conclusão.');
      if (!run.runId || !allowedUrl(run.nextUrl)) throw new Error('O SIAGES retornou uma etapa de captura inválida.');
      const captured = await capture(run.nextUrl);
      if (captured?.sourceUrl !== run.nextUrl || typeof captured.html !== 'string' || !captured.html.trim() || new TextEncoder().encode(captured.html).byteLength > MAX_HTML_BYTES) throw new Error('Captura SUAP inválida ou maior que 15 MB.');
      run = await post({ action: 'sync-html', suapUnitCode: unit, runId: run.runId, ...captured });
      await progress(run);
    }
    if (run.status !== 'preview' && !stopped()) throw new Error(run.error || 'Captura incompleta. Retome pela extensão.');
    return run;
  }

  async function collectAll({ units, post, capture, progress, stopped = () => false }) {
    const results = [];
    for (const unit of units) {
      if (stopped()) break;
      try {
        const run = await collect({ unit: unit.value, post, capture, stopped,
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
