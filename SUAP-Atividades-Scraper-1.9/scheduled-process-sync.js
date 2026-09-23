(function (root) {
  const BASE_URL = 'https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/';
  const DEFAULT_PROCESS_BOXES = [
    {
      name: 'Processos atribuídos a 304806',
      url: `${BASE_URL}?setor=&pesquisa=&atribuido_para=304806&nivel_acesso=&rotulo=&rotulo_excluir=&filtrocaixaentradasaida_form=Aguarde...`,
    },
    {
      name: 'Processos do setor 857',
      url: `${BASE_URL}?setor=857&pesquisa=&nivel_acesso=&rotulo=&rotulo_excluir=&filtrocaixaentradasaida_form=Aguarde...`,
    },
  ];
  const SCHEDULE_HOURS = [7, 10, 13, 15];

  function getNextRunAt(now = new Date()) {
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const day = new Date(candidate);
      day.setDate(candidate.getDate() + dayOffset);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      for (const hour of SCHEDULE_HOURS) {
        const runAt = new Date(day);
        runAt.setHours(hour, 0, 0, 0);
        if (runAt.getTime() > now.getTime()) return runAt;
      }
    }
    return null;
  }

  function decodeHtml(value) {
    return String(value || '')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/&#x([a-f\d]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
  }

  function textFromHtml(value) {
    return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  function parseProcessBoxHtml(html) {
    const source = String(html || '');
    if (/id\s*=\s*["']login-form["']|form[^>]+action\s*=\s*["'][^"']*\/accounts\/login\//i.test(source) || /<input[^>]+type\s*=\s*["']password["']/i.test(source)) {
      throw new Error('Sessão do SUAP expirada. Entre novamente no SUAP e tente sincronizar.');
    }

    const results = [];
    const seenIds = new Set();
    const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi;
    let anchor;
    while ((anchor = anchorPattern.exec(source))) {
      const href = decodeHtml(anchor[2]);
      let linkUrl;
      try { linkUrl = new URL(href, 'https://suap.ifrn.edu.br'); } catch { continue; }
      if (linkUrl.origin !== 'https://suap.ifrn.edu.br') continue;
      const match = linkUrl.pathname.match(/^\/processo_eletronico\/processo\/(\d+)\/?$/i);
      if (!match || seenIds.has(match[1])) continue;

      const normalizedSource = source.toLowerCase();
      const rowStart = normalizedSource.lastIndexOf('<tr', anchor.index);
      const rowEnd = rowStart >= 0 ? normalizedSource.indexOf('</tr>', anchorPattern.lastIndex) : -1;
      const rowText = rowStart >= 0 && rowEnd >= 0
        ? textFromHtml(source.slice(rowStart, rowEnd + 5))
        : '';
      const text = `${textFromHtml(anchor[3])} ${rowText}`;
      const processNumber = text.match(/\b\d{5}\.\d{6}(?:\.|\/)\d{4}-\d{2}\b/);
      results.push({
        suapId: match[1],
        numProcesso: processNumber?.[0],
        url: `https://suap.ifrn.edu.br/processo_eletronico/processo/${match[1]}/`,
      });
      seenIds.add(match[1]);
    }
    return results;
  }

  root.SuapeScheduledProcessSync = {
    DEFAULT_PROCESS_BOXES,
    SCHEDULE_HOURS,
    getNextRunAt,
    parseProcessBoxHtml,
  };
})(globalThis);
