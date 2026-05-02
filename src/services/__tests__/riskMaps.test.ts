import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLocalRiskMapDraft, riskMapsService } from '@/services/riskMaps';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const mockedInvoke = vi.mocked(supabase.functions.invoke);

describe('riskMapsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gera fallback local com matriz de riscos editavel', () => {
    const result = buildLocalRiskMapDraft({
      manualObject: 'Contratacao de servicos continuos de limpeza',
    });

    expect(result.status).toBe('generated');
    expect(result.model).toBe('local-fallback');
    expect(result.risks.length).toBeGreaterThanOrEqual(3);
    expect(result.html).toContain('Mapa de Risco da Licitacao');
    expect(result.html).toContain('Probabilidade');
    expect(result.html).toContain('Acao preventiva');
    expect(result.html).toContain('Contratacao de servicos continuos de limpeza');
  });

  it('envia snippets do ETP para a function', async () => {
    mockedInvoke.mockResolvedValueOnce({
      data: {
        status: 'generated',
        title: 'Mapa de Risco',
        html: '<h1>Mapa</h1>',
        risks: [],
        warnings: [],
      },
      error: null,
    });

    await riskMapsService.generateDraft({
      manualObject: 'Contratacao de limpeza',
      etpContextSnippets: [
        {
          id: 'etp-1',
          kind: 'objeto',
          label: 'Objeto',
          excerpt: 'Objeto revisado no ETP.',
          sourceType: 'etp',
        },
      ],
    });

    expect(mockedInvoke).toHaveBeenCalledWith(
      'gerar-mapa-riscos-licitacao',
      expect.objectContaining({
        body: expect.objectContaining({
          manualObject: 'Contratacao de limpeza',
          etpContextSnippets: expect.arrayContaining([
            expect.objectContaining({ id: 'etp-1', sourceType: 'etp' }),
          ]),
        }),
      }),
    );
  });

  it('usa fallback local quando a function falha', async () => {
    mockedInvoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await riskMapsService.generateDraft({
      manualObject: 'Contratacao de copeiragem',
    });

    expect(result.status).toBe('generated');
    expect(result.model).toBe('local-fallback');
    expect(result.html).toContain('Contratacao de copeiragem');
  });
});
