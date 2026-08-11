import { describe, expect, it } from 'vitest';

import {
  classifySuapDocumentForReview,
  normalizeSuapDocumentReviewResult,
} from '@/lib/suapDocumentReview';

describe('suapDocumentReview', () => {
  it('classifica TR e ETP com acentos, caixa e siglas', () => {
    expect(classifySuapDocumentForReview('Termo de Referência: TR 2/2026')).toBe('tr');
    expect(classifySuapDocumentForReview('ESTUDO TÉCNICO PRELIMINAR - ETP 01/2026')).toBe('etp');
    expect(classifySuapDocumentForReview('ETP 04/2026', 'Documento')).toBe('etp');
  });

  it('não classifica aprovação, anexo ou documento sem tipo', () => {
    expect(classifySuapDocumentForReview('TERMO DE APROVAÇÃO do TERMO DE REFERÊNCIA')).toBeNull();
    expect(classifySuapDocumentForReview('Anexo I - Planilha de preços')).toBeNull();
    expect(classifySuapDocumentForReview('Despacho de encaminhamento')).toBeNull();
  });

  it('normaliza resposta incompleta sem aceitar fontes externas', () => {
    const result = normalizeSuapDocumentReviewResult({
      status: 'attention',
      summary: '  resumo  ',
      counts: { high: 4 },
      findings: [{
        title: 'Quantitativos',
        problem: 'Ausência de memória de cálculo.',
        recommendation: 'Incluir a memória.',
        severity: 'high',
        legalBases: [
          { title: 'Lei', url: 'https://www.planalto.gov.br/lei' },
          { title: 'Fonte externa', url: 'https://example.com' },
        ],
      }],
      sources: [{ title: 'Fonte oficial', url: 'https://www.gov.br/compras' }, { title: 'Externa', url: 'https://example.com' }],
    }, 'tr');

    expect(result.documentType).toBe('tr');
    expect(result.summary).toBe('resumo');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].legalBases).toHaveLength(1);
    expect(result.sources).toHaveLength(1);
    expect(result.counts.high).toBe(1);
  });
});
