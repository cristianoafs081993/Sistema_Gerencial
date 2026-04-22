import { describe, expect, it } from 'vitest';

import { analyzeReferenceTermPdfPages } from '@/lib/referenceTermProcessPdf';

describe('analyzeReferenceTermPdfPages', () => {
  it('identifica trechos uteis do processo para montar o termo de referencia', () => {
    const result = analyzeReferenceTermPdfPages([
      {
        pageNumber: 3,
        text: 'Objeto da contratacao: aquisicao de notebooks para os laboratorios. Descricao do objeto e quantitativos.',
      },
      {
        pageNumber: 4,
        text: 'Justificativa da contratacao: atender a renovacao do parque tecnologico do campus.',
      },
      {
        pageNumber: 5,
        text: 'Estimativa do valor com pesquisa de precos e mapa comparativo de precos.',
      },
      {
        pageNumber: 6,
        text: 'Prazo de entrega em ate 30 dias e local de entrega no almoxarifado central.',
      },
      {
        pageNumber: 7,
        text: 'Pagamento apos liquidacao e recebimento definitivo da nota fiscal.',
      },
    ]);

    expect(result.searchablePageCount).toBe(5);
    expect(result.snippets.map((snippet) => snippet.kind)).toEqual(
      expect.arrayContaining(['objeto', 'justificativa', 'estimativa', 'entrega', 'pagamento']),
    );
    expect(result.warnings).toEqual([]);
  });

  it('bloqueia pdf sem texto pesquisavel', () => {
    const result = analyzeReferenceTermPdfPages([
      { pageNumber: 1, text: '' },
      { pageNumber: 2, text: '   ' },
    ]);

    expect(result.searchablePageCount).toBe(0);
    expect(result.snippets).toHaveLength(0);
    expect(result.warnings).toContain('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
    expect(result.warnings).toContain(
      'Nao encontrei trechos claros do processo para preencher o Termo de Referencia automaticamente.',
    );
  });
});
