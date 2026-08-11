import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSuapDocumentReviewHtml, printSuapDocumentReview } from '@/lib/suapDocumentReviewExport';
import type { SuapDocumentReviewResult } from '@/lib/suapDocumentReview';

const result: SuapDocumentReviewResult = {
  documentType: 'tr',
  checkedAt: '2026-08-10T12:00:00.000Z',
  status: 'attention',
  summary: 'Resumo <seguro>',
  counts: { critical: 0, high: 1, medium: 0, low: 0 },
  findings: [{
    id: 'f-1', severity: 'high', category: 'Quantitativos', title: 'Memória de cálculo',
    page: 2, excerpt: 'Quantidade estimada', problem: 'Problema', recommendation: 'Recomendação',
    suggestedText: 'Texto sugerido', confidence: 'high', legalBases: [],
  }],
  sources: [{ title: 'Lei 14.133/2021', reference: 'art. 18', url: 'https://www.planalto.gov.br/lei' }],
  limitations: ['Revisão assistida.'],
};

describe('buildSuapDocumentReviewHtml', () => {
  afterEach(() => vi.useRealTimers());
  it('gera uma análise independente com achados, fontes e limitações', () => {
    const html = buildSuapDocumentReviewHtml(result, 'TR <2026>');

    expect(html).toContain('<title>TR &lt;2026&gt; — Revisão assistida</title>');
    expect(html).toContain('Achados e sugestões');
    expect(html).toContain('Memória de cálculo');
    expect(html).toContain('https://www.planalto.gov.br/lei');
    expect(html).toContain('Revisão assistida.');
    expect(html).toContain('Resumo &lt;seguro&gt;');
    expect(html).not.toContain('Resumo <seguro>');
  });

  it('abre uma janela própria e dispara a impressão', () => {
    vi.useFakeTimers();
    let loadHandler: EventListener | undefined;
    const printWindow = {
      opener: window,
      focus: vi.fn(),
      print: vi.fn(),
      addEventListener: vi.fn((_type: string, handler: EventListener) => { loadHandler = handler; }),
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow);

    expect(printSuapDocumentReview(result, 'TR 2026')).toBe(true);
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Memória de cálculo'));
    loadHandler?.(new Event('load'));
    vi.runAllTimers();
    expect(printWindow.focus).toHaveBeenCalledOnce();
    expect(printWindow.print).toHaveBeenCalledOnce();

    openSpy.mockRestore();
    vi.useRealTimers();
  });
});
