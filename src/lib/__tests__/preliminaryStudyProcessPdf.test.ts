import { describe, expect, it } from 'vitest';

import { analyzePreliminaryStudyPdfPages } from '@/lib/preliminaryStudyProcessPdf';

describe('analyzePreliminaryStudyPdfPages', () => {
  it('identifica trechos uteis para montar ETP de servicos continuos', () => {
    const result = analyzePreliminaryStudyPdfPages([
      {
        pageNumber: 1,
        text: 'Descricao da necessidade: continuidade dos servicos de limpeza do campus.',
      },
      {
        pageNumber: 2,
        text: 'Quantitativo estimado: 6 postos de trabalho com dedicacao exclusiva de mao de obra.',
      },
      {
        pageNumber: 3,
        text: 'Estimativa do valor anual conforme planilha de custos e pesquisa de precos.',
      },
    ]);

    expect(result.searchablePageCount).toBe(3);
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'necessidade', pageNumber: 1 }),
        expect.objectContaining({ kind: 'quantitativos', pageNumber: 2 }),
        expect.objectContaining({ kind: 'estimativa', pageNumber: 3 }),
      ]),
    );
  });

  it('avisa quando o PDF nao possui texto pesquisavel', () => {
    const result = analyzePreliminaryStudyPdfPages([
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: '' },
    ]);

    expect(result.searchablePageCount).toBe(0);
    expect(result.snippets).toEqual([]);
    expect(result.warnings).toContain('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
  });

  it('mantem pendencia quando nao encontra trechos claros', () => {
    const result = analyzePreliminaryStudyPdfPages([
      { pageNumber: 1, text: 'Documento sem termos relacionados ao planejamento da contratacao.' },
    ]);

    expect(result.searchablePageCount).toBe(1);
    expect(result.snippets).toEqual([]);
    expect(result.warnings).toContain('Nao encontrei trechos claros do processo para preencher o ETP automaticamente.');
  });
});
