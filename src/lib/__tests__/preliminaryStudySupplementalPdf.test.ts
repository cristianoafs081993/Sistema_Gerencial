import { describe, expect, it } from 'vitest';

import {
  analyzePreliminaryStudySupplementalPdfPages,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE,
} from '@/lib/preliminaryStudySupplementalPdf';

describe('preliminaryStudySupplementalPdf', () => {
  it('identifica trechos uteis de CCT preservando arquivo e pagina', () => {
    const result = analyzePreliminaryStudySupplementalPdfPages('cct-limpeza.pdf', [
      {
        pageNumber: 1,
        text: 'Convencao coletiva. Piso salarial da categoria profissional de limpeza e jornada de trabalho de 44 horas.',
      },
      {
        pageNumber: 2,
        text: 'Auxilio alimentacao, vale transporte e adicional noturno previstos para os trabalhadores.',
      },
    ]);

    expect(result.fileName).toBe('cct-limpeza.pdf');
    expect(result.searchablePageCount).toBe(2);
    expect(result.snippets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'anexo',
          sourceName: 'cct-limpeza.pdf',
          sourceLabel: 'cct-limpeza.pdf, pagina 1',
          pageNumber: 1,
        }),
      ]),
    );
    expect(result.snippets.some((snippet) => snippet.label.includes('Piso'))).toBe(true);
  });

  it('PDF sem texto pesquisavel gera aviso e nao inventa snippets', () => {
    const result = analyzePreliminaryStudySupplementalPdfPages('escaneado.pdf', [
      { pageNumber: 1, text: '' },
      { pageNumber: 2, text: '   ' },
    ]);

    expect(result.searchablePageCount).toBe(0);
    expect(result.snippets).toHaveLength(0);
    expect(result.warnings).toContain('O PDF do processo nao trouxe texto pesquisavel. Esta versao ainda nao faz OCR.');
  });

  it('expoe limites operacionais do upload auxiliar', () => {
    expect(PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES).toBe(5);
    expect(PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
  });
});
