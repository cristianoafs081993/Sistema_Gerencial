import type { SuapDocumentReviewResult, SuapDocumentReviewSource } from './suapDocumentReview';

const statusLabels: Record<SuapDocumentReviewResult['status'], string> = {
  critical: 'Pontos críticos encontrados',
  attention: 'Revisão requer atenção',
  no_major_finding: 'Nenhum ponto grave identificado',
  insufficient_evidence: 'Evidência insuficiente',
};

const severityLabels = {
  critical: 'Crítico',
  high: 'Alto',
  medium: 'Médio',
  low: 'Baixo',
} as const;

const countLabels = {
  critical: 'Críticos',
  high: 'Altos',
  medium: 'Médios',
  low: 'Baixos',
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function renderSource(source: SuapDocumentReviewSource) {
  const reference = source.reference ? ` · ${escapeHtml(source.reference)}` : '';
  const link = source.url
    ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)}${reference}</a>`
    : `${escapeHtml(source.title)}${reference}`;
  return `<li>${link}</li>`;
}

function renderFinding(finding: SuapDocumentReviewResult['findings'][number], index: number) {
  const page = finding.page ? `<p class="meta">Página ${finding.page} · Confiança ${escapeHtml(finding.confidence)}</p>` : '';
  const excerpt = finding.excerpt ? `<blockquote>${escapeHtml(finding.excerpt)}</blockquote>` : '';
  const suggestedText = finding.suggestedText
    ? `<section class="suggested"><h4>Texto sugerido</h4><p>${escapeHtml(finding.suggestedText).replace(/\n/g, '<br>')}</p></section>`
    : '';
  const legalBases = finding.legalBases.length
    ? `<section><h4>Base legal</h4><ul>${finding.legalBases.map(renderSource).join('')}</ul></section>`
    : '';

  return `<article class="finding">
    <div class="finding-heading"><div><p class="category">${escapeHtml(finding.category)}</p><h3>${index + 1}. ${escapeHtml(finding.title)}</h3></div><span class="severity">${severityLabels[finding.severity]}</span></div>
    ${page}${excerpt}
    <div class="columns"><section><h4>Problema</h4><p>${escapeHtml(finding.problem).replace(/\n/g, '<br>')}</p></section><section><h4>Recomendação</h4><p>${escapeHtml(finding.recommendation).replace(/\n/g, '<br>')}</p></section></div>
    ${suggestedText}${legalBases}
  </article>`;
}

export function buildSuapDocumentReviewHtml(result: SuapDocumentReviewResult, documentTitle: string) {
  const counts = (['critical', 'high', 'medium', 'low'] as const)
    .map((severity) => `<div class="count"><span>${countLabels[severity]}${severity === 'critical' ? 's' : severity === 'high' ? 's' : severity === 'medium' ? 's' : 's'}</span><strong>${result.counts[severity]}</strong></div>`)
    .join('');
  const findings = result.findings.length
    ? result.findings.map(renderFinding).join('')
    : '<p>Nenhum achado foi retornado.</p>';
  const sources = result.sources.length
    ? `<ul>${result.sources.map(renderSource).join('')}</ul>`
    : '<p>Nenhuma fonte foi retornada com a análise.</p>';
  const limitations = result.limitations.length
    ? `<ul>${result.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>A análise não registrou limitações adicionais.</p>';

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(documentTitle)} — Revisão assistida</title>
<style>
  :root { color-scheme: light; font-family: Arial, sans-serif; }
  body { margin: 0; color: #1f2937; background: #fff; line-height: 1.55; }
  main { max-width: 980px; margin: 0 auto; padding: 32px; }
  h1 { margin: 0 0 6px; font-size: 24px; } h2 { margin: 28px 0 12px; font-size: 18px; } h3 { margin: 0; font-size: 17px; } h4 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; }
  p { margin: 0 0 10px; } .muted, .meta { color: #6b7280; font-size: 12px; } .summary, .finding, .panel { border: 1px solid #d1d5db; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
  .summary { background: #f9fafb; } .counts { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 16px; } .count { border: 1px solid #e5e7eb; border-radius: 7px; padding: 8px; } .count span { display: block; color: #6b7280; font-size: 12px; } .count strong { display: block; font-size: 20px; }
  .finding-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; } .category { color: #0f766e; font-weight: bold; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; } .severity { border: 1px solid #9ca3af; border-radius: 999px; padding: 3px 9px; font-size: 12px; white-space: nowrap; } blockquote { margin: 14px 0; padding-left: 12px; border-left: 3px solid #9ca3af; color: #4b5563; font-style: italic; } .columns { display: grid; grid-template-columns: repeat(2,1fr); gap: 18px; } .suggested { background: #ecfdf5; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px; margin-top: 14px; } ul { margin: 6px 0 0; padding-left: 20px; } a { color: #0f766e; } footer { margin-top: 26px; color: #6b7280; font-size: 11px; }
  @media (max-width: 640px) { main { padding: 18px; } .counts, .columns { grid-template-columns: 1fr 1fr; } }
  @media print { main { max-width: none; padding: 0; } .finding, .summary, .panel { break-inside: avoid; } }
</style></head>
<body><main>
  <header><h1>${escapeHtml(documentTitle)}</h1><p class="muted">Revisão assistida por IA · ${escapeHtml(statusLabels[result.status])} · Consultado em ${escapeHtml(formatDate(result.checkedAt))}</p></header>
  <section class="summary"><p>${escapeHtml(result.summary).replace(/\n/g, '<br>')}</p><div class="counts">${counts}</div></section>
  <h2>Achados e sugestões</h2>${findings}
  <div class="columns"><section class="panel"><h2>Fontes consultadas</h2>${sources}</section><section class="panel"><h2>Limitações</h2>${limitations}</section></div>
  <footer>Esta revisão é assistida e não substitui a avaliação jurídica, técnica ou administrativa.</footer>
</main></body></html>`;
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'documento-suap';
}

export function downloadSuapDocumentReview(result: SuapDocumentReviewResult, documentTitle: string) {
  const blob = new Blob([buildSuapDocumentReviewHtml(result, documentTitle)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revisao-${slugify(documentTitle)}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function printHtmlInWindow(printWindow: Window, html: string) {
  let printed = false;
  const print = () => {
    if (printed) return;
    try {
      printWindow.focus();
      printWindow.print();
      printed = true;
    } catch {
      // Alguns navegadores só liberam a impressão depois que a janela termina de carregar.
    }
  };
  printWindow.addEventListener('load', print, { once: true });
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  print();
  window.setTimeout(print, 250);
}

function printHtmlInHiddenFrame(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  let printed = false;
  const print = () => {
    if (printed) return;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      printed = true;
      window.setTimeout(() => frame.remove(), 2000);
    } catch {
      // Alguns navegadores liberam a impressão somente depois do carregamento do iframe.
    }
  };
  frame.addEventListener('load', print, { once: true });
  document.body.appendChild(frame);
  frame.contentDocument?.open();
  frame.contentDocument?.write(html);
  frame.contentDocument?.close();
  window.setTimeout(print, 250);
}
export function printSuapDocumentReview(result: SuapDocumentReviewResult, documentTitle: string) {
  const html = buildSuapDocumentReviewHtml(result, documentTitle);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printHtmlInWindow(printWindow, html);
    return true;
  }

  printHtmlInHiddenFrame(html);
  return true;
}