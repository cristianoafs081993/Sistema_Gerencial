import { describe, expect, it } from 'vitest';

import { comprasnetEtpQuestions, getComprasnetEtpQuestion, normalizeComprasnetEtpText } from '@/lib/comprasnetEtpQuestionnaire';

describe('questionário geral do ETP do Comprasnet', () => {
  it('mapeia somente as seções textuais oficiais e exclui campos estruturados', () => {
    expect(comprasnetEtpQuestions).toHaveLength(13);
    expect(getComprasnetEtpQuestion('necessidade')?.sectionTitle).toBe('Descrição da necessidade');
    expect(getComprasnetEtpQuestion('conclusao')?.sectionTitle).toBe('Declaração de Viabilidade');
    expect(comprasnetEtpQuestions.some((question) => /responsáveis|anexos|área requisitante/i.test(question.sectionTitle))).toBe(false);
  });

  it('normaliza texto sem alterar o conteúdo semântico', () => {
    expect(normalizeComprasnetEtpText('  contratação   de\nserviço  ')).toBe('contratação de serviço');
  });
});

