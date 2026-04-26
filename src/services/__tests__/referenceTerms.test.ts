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
});
