import { describe, expect, it } from 'vitest';

import {
  buildInitialPreliminaryStudyAnswers,
  buildPreliminaryStudyQuestionnaireAnswers,
  getPreliminaryStudyMissingRequiredFields,
  isPreliminaryStudyQuestionAnswered,
} from '@/lib/preliminaryStudyQuestionnaire';

describe('preliminaryStudyQuestionnaire', () => {
  it('nao considera resposta vazia como concluida', () => {
    expect(isPreliminaryStudyQuestionAnswered({ value: '   ' })).toBe(false);
    expect(isPreliminaryStudyQuestionAnswered({ value: 'texto valido' })).toBe(true);
    expect(isPreliminaryStudyQuestionAnswered({ value: 'texto valido', skipped: true })).toBe(false);
  });

  it('preserva perguntas puladas como pendencia no payload', () => {
    const answers = buildPreliminaryStudyQuestionnaireAnswers({
      necessidade: {
        questionId: 'necessidade',
        value: 'Manter o servico de limpeza em funcionamento.',
      },
    });

    expect(answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'necessidade', value: 'Manter o servico de limpeza em funcionamento.' }),
        expect.objectContaining({ questionId: 'quantitativos', skipped: true }),
      ]),
    );
  });

  it('valida campos obrigatorios minimos do ETP', () => {
    const missing = getPreliminaryStudyMissingRequiredFields([
      {
        questionId: 'necessidade',
        value: 'Contratacao necessaria.',
      },
      {
        questionId: 'quantitativos',
        skipped: true,
      },
    ]);

    expect(missing).toEqual(
      expect.arrayContaining([
        'Estimativa de quantidades',
        'Estimativa do valor',
        'Justificativa de parcelamento',
        'Conclusao de viabilidade',
      ]),
    );
  });

  it('usa o objeto manual como resposta inicial da solucao', () => {
    expect(buildInitialPreliminaryStudyAnswers('Contratacao de servicos continuos de limpeza')).toEqual({
      solucao: expect.objectContaining({
        questionId: 'solucao',
        value: 'Contratacao de servicos continuos de limpeza',
        origin: 'user',
      }),
    });
  });
});
