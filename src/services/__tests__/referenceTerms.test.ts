import { describe, expect, it } from 'vitest';

import { normalizeReferenceTermQuestionSuggestionResult } from '@/services/referenceTerms';

describe('normalizeReferenceTermQuestionSuggestionResult', () => {
  it('mantem apenas sugestoes com fonte explicita', () => {
    const result = normalizeReferenceTermQuestionSuggestionResult({
      suggestions: [
        {
          questionId: 'field-objeto',
          kind: 'field',
          status: 'suggested',
          value: 'Aquisicao de notebooks.',
          justification: 'Objeto identificado no ETP.',
          sourcePage: 3,
          sourceExcerpt: 'Aquisicao de notebooks para laboratorios.',
          confidence: 'high',
        },
        {
          questionId: 'field-sem-fonte',
          kind: 'field',
          status: 'suggested',
          value: 'Resposta sem fonte.',
          justification: 'Nao trouxe pagina.',
        },
        {
          questionId: 'exclusive-sem-resposta',
          kind: 'exclusive',
          status: 'unanswered',
        },
      ],
      warnings: ['ok'],
      model: 'gemini-2.5-flash-lite',
    });

    expect(result.suggestions).toEqual([
      expect.objectContaining({
        questionId: 'field-objeto',
        status: 'suggested',
        sourcePage: 3,
        confidence: 'high',
      }),
      expect.objectContaining({
        questionId: 'exclusive-sem-resposta',
        status: 'unanswered',
      }),
    ]);
  });

  it('aceita sugestao com fonte ETP sem pagina', () => {
    const result = normalizeReferenceTermQuestionSuggestionResult({
      suggestions: [
        {
          questionId: 'field-objeto',
          kind: 'field',
          status: 'suggested',
          value: 'Contratacao de servicos continuos de limpeza.',
          justification: 'Objeto consta no ETP editado.',
          sourceType: 'etp',
          sourceLabel: 'ETP editado no editor',
          sourceExcerpt: 'A solucao proposta e a contratacao de servicos continuos de limpeza.',
          confidence: 'medium',
        },
      ],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });

    expect(result.suggestions).toEqual([
      expect.objectContaining({
        questionId: 'field-objeto',
        status: 'suggested',
        sourceType: 'etp',
        sourceLabel: 'ETP editado no editor',
        sourcePage: undefined,
      }),
    ]);
  });

  it('aceita sugestao com fonte Mapa de Risco sem pagina', () => {
    const result = normalizeReferenceTermQuestionSuggestionResult({
      suggestions: [
        {
          questionId: 'field-riscos',
          kind: 'field',
          status: 'suggested',
          value: 'A fiscalizacao deve acompanhar indicadores de execucao.',
          justification: 'O mapa de riscos indicou falha de fiscalizacao como risco alto.',
          sourceType: 'mapa_riscos',
          sourceLabel: 'Mapa de Risco editado no editor',
          sourceExcerpt: 'Falha na fiscalizacao do contrato.',
          confidence: 'medium',
        },
      ],
    });

    expect(result.suggestions).toEqual([
      expect.objectContaining({
        questionId: 'field-riscos',
        status: 'suggested',
        sourceType: 'mapa_riscos',
        sourceLabel: 'Mapa de Risco editado no editor',
        sourcePage: undefined,
      }),
    ]);
  });
});
