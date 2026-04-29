import { beforeEach, describe, expect, it } from 'vitest';

import {
  normalizePreliminaryStudyQuestionSuggestionResult,
  preliminaryStudiesService,
} from '@/services/preliminaryStudies';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockedInvoke = vi.mocked(supabase.functions.invoke);

describe('normalizePreliminaryStudyQuestionSuggestionResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mantem apenas sugestoes com fonte explicita', () => {
    const result = normalizePreliminaryStudyQuestionSuggestionResult({
      suggestions: [
        {
          questionId: 'necessidade',
          status: 'suggested',
          value: 'Garantir a continuidade da limpeza do campus.',
          justification: 'A necessidade consta no DFD.',
          sourcePage: 2,
          sourceExcerpt: 'Continuidade dos servicos de limpeza.',
          confidence: 'high',
        },
        {
          questionId: 'quantitativos',
          status: 'suggested',
          value: 'Resposta sem fonte.',
          justification: 'Nao trouxe pagina.',
        },
        {
          questionId: 'conclusao',
          status: 'unanswered',
        },
        {
          questionId: 'pergunta-inexistente',
          status: 'suggested',
          value: 'Ignorar',
          justification: 'Fonte',
          sourcePage: 1,
          sourceExcerpt: 'Fonte',
        },
      ],
      warnings: ['ok'],
      model: 'gemini-2.5-flash-lite',
    });

    expect(result.suggestions).toEqual([
      expect.objectContaining({
        questionId: 'necessidade',
        status: 'suggested',
        sourcePage: 2,
        confidence: 'high',
      }),
      expect.objectContaining({
        questionId: 'conclusao',
        status: 'unanswered',
      }),
    ]);
  });

  it('aceita sugestao de anexo com sourceLabel mesmo sem pagina', () => {
    const result = normalizePreliminaryStudyQuestionSuggestionResult({
      suggestions: [
        {
          questionId: 'estimativa_valor',
          status: 'suggested',
          value: 'Usar a planilha de custos como base da estimativa.',
          justification: 'A planilha traz os custos por item.',
          sourceType: 'anexo',
          sourceLabel: 'planilha-custos.xlsx, aba Custos, linhas 2-30',
          sourceExcerpt: 'Planilha de custos com piso salarial da categoria.',
          confidence: 'medium',
        },
      ],
    });

    expect(result.suggestions).toEqual([
      expect.objectContaining({
        questionId: 'estimativa_valor',
        status: 'suggested',
        sourceType: 'anexo',
        sourceLabel: 'planilha-custos.xlsx, aba Custos, linhas 2-30',
      }),
    ]);
  });

  it('gera fallback local quando a function de ETP nao responde', async () => {
    mockedInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await preliminaryStudiesService.generateDraft({
      manualObject: 'Contratacao de servicos continuos de limpeza',
      questionnaireAnswers: [
        {
          questionId: 'necessidade',
          value: 'Manter limpeza predial.',
        },
      ],
    });

    expect(result.status).toBe('generated');
    expect(result.model).toBe('fallback-local');
    expect(result.html).toContain('Contratacao de servicos continuos de limpeza');
    expect(result.sections?.length).toBeGreaterThan(1);
    expect(result.warnings).toContain(
      'A Edge Function de geracao do ETP nao respondeu. O rascunho foi montado localmente com as respostas e pendencias informadas.',
    );
  });

  it('segue sem sugestoes quando a function de sugestoes nao responde', async () => {
    mockedInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await preliminaryStudiesService.suggestQuestionnaireAnswers({
      manualObject: 'Contratacao de servicos continuos de limpeza',
    });

    expect(result).toEqual({
      status: 'generated',
      suggestions: [],
      warnings: ['Nao foi possivel consultar a Edge Function de sugestoes do ETP. Revise o questionario manualmente.'],
      model: 'fallback-local',
    });
  });

  it('gera texto local de apoio para secao quando a function nao responde mesmo sem anotacoes', async () => {
    mockedInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await preliminaryStudiesService.generateQuestionText({
      manualObject: 'Contratacao de servicos continuos de limpeza',
      question: {
        id: 'necessidade',
        kind: 'field',
        title: 'Necessidade da contratacao',
        prompt: 'Explique a necessidade administrativa.',
        guidance: 'Use informacoes do processo.',
        placeholder: 'Exemplo',
        required: true,
      },
      userNotes: '',
    });

    expect(result.status).toBe('generated');
    expect(result.model).toBe('fallback-local');
    expect(result.value).toContain('Contratacao de servicos continuos de limpeza');
    expect(result.value.length).toBeGreaterThan(80);
    expect(result.warnings).toContain(
      'A Edge Function de texto por secao do ETP nao respondeu. Foi usado um texto local de apoio para revisao.',
    );
  });

  it('envia snippets auxiliares no payload do ETP', async () => {
    mockedInvoke.mockResolvedValueOnce({
      data: {
        status: 'generated',
        title: 'ETP',
        warnings: [],
        missingRequiredFields: [],
        fields: [],
      },
      error: null,
    });

    await preliminaryStudiesService.generateDraft({
      manualObject: 'Contratacao de servicos continuos de limpeza',
      supplementalSnippets: [
        {
          id: 'anexo-planilha-1',
          kind: 'estimativa',
          label: 'Planilha de custos',
          excerpt: 'Piso salarial da categoria.',
          sourceType: 'anexo',
          sourceName: 'planilha-custos.xlsx',
          sourceLabel: 'planilha-custos.xlsx, aba Custos, linhas 2-30',
        },
      ],
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      'gerar-etp-servicos-continuos',
      expect.objectContaining({
        body: expect.objectContaining({
          contextSnippets: expect.arrayContaining([
            expect.objectContaining({
              id: 'anexo-planilha-1',
              sourceType: 'anexo',
              sourceName: 'planilha-custos.xlsx',
              sourceLabel: 'planilha-custos.xlsx, aba Custos, linhas 2-30',
            }),
          ]),
        }),
      }),
    );
  });
});
