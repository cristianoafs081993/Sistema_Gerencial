import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assistenteGerencialService,
  buildAssistenteGerencialPayload,
  parseAssistenteGerencialSuggestions,
} from '@/services/assistenteGerencial';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockedInvoke = vi.mocked(supabase.functions.invoke);

describe('assistenteGerencialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extrai sugestoes do marcador retornado pelo modelo', () => {
    const parsed = parseAssistenteGerencialSuggestions([
      'Resumo curto.',
      '',
      '||SUGESTOES||',
      '- Quais contratos exigem atencao?',
      '- Quais empenhos tem maior saldo?',
    ].join('\n'));

    expect(parsed).toEqual({
      response: 'Resumo curto.',
      suggestions: ['Quais contratos exigem atencao?', 'Quais empenhos tem maior saldo?'],
    });
  });

  it('monta payload sanitizado com historico limitado', () => {
    const payload = buildAssistenteGerencialPayload({
      message: '  Qual   o saldo?  ',
      history: Array.from({ length: 12 }, (_, index) => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Mensagem ${index} ${'x'.repeat(2000)}`,
      })),
    });

    expect(payload.message).toBe('Qual o saldo?');
    expect(payload.history).toHaveLength(8);
    expect(payload.history[0].content.startsWith('Mensagem 4')).toBe(true);
    expect(payload.history[0].content.length).toBeLessThanOrEqual(1500);
  });

  it('chama a Edge Function e normaliza resposta', async () => {
    mockedInvoke.mockResolvedValueOnce({
      data: {
      response: 'Saldo total: **R$ 10,00**',
      suggestions: ['Detalhar por PTRES'],
      model: 'gemini-2.5-flash-lite',
      sources: [{ label: 'creditos_disponiveis', totalAmostra: 1, totalDisponivel: 1 }],
    },
      error: null,
    });

    const result = await assistenteGerencialService.ask({
      message: 'saldo',
      history: [],
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      'assistente-gerencial',
      expect.objectContaining({
        body: expect.objectContaining({ message: 'saldo' }),
      }),
    );
    expect(result).toMatchObject({
      response: 'Saldo total: **R$ 10,00**',
      suggestions: ['Detalhar por PTRES'],
      model: 'gemini-2.5-flash-lite',
      warnings: [],
      sources: [{ label: 'creditos_disponiveis', totalAmostra: 1, totalDisponivel: 1 }],
    });
  });

  it('repete a chamada quando ha falha transitoria de rede', async () => {
    vi.useFakeTimers();
    mockedInvoke
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch' },
      })
      .mockResolvedValueOnce({
        data: {
          response: 'Consulta recuperada.',
          suggestions: [],
          sources: [],
        },
        error: null,
      });

    const request = assistenteGerencialService.ask({ message: 'saldo' });

    await vi.advanceTimersByTimeAsync(650);

    await expect(request).resolves.toMatchObject({
      response: 'Consulta recuperada.',
      suggestions: [],
      model: null,
      warnings: [],
      sources: [],
    });
    expect(mockedInvoke).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('rejeita pergunta vazia antes de chamar a function', async () => {
    await expect(assistenteGerencialService.ask({ message: '   ' })).rejects.toThrow(
      'Digite uma pergunta',
    );
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it('permite consulta via perguntar() com parametros e resposta em portugues', async () => {
    mockedInvoke.mockResolvedValueOnce({
      data: {
        response: 'Saldo apurado com sucesso.',
        suggestions: ['Ver empenhos'],
        model: 'gemini-2.5-flash-lite',
        sources: [{ label: 'empenhos_siafi', totalAmostra: 10 }],
      },
      error: null,
    });

    const result = await assistenteGerencialService.perguntar({
      pergunta: 'qual o saldo do empenho 2026ne000080',
      historico: [{ role: 'user', content: 'pergunta anterior' }],
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      'assistente-gerencial',
      expect.objectContaining({
        body: {
          message: 'qual o saldo do empenho 2026ne000080',
          history: [{ role: 'user', content: 'pergunta anterior' }],
        },
      }),
    );

    expect(result.resposta).toBe('Saldo apurado com sucesso.');
    expect(result.response).toBe('Saldo apurado com sucesso.');
    expect(result.sugestoes).toEqual(['Ver empenhos']);
    expect(result.fontes).toEqual([
      expect.objectContaining({ label: 'empenhos_siafi', totalAmostra: 10 }),
    ]);
  });
});
