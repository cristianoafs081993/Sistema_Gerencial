import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeSuapDocument } from '@/services/suapDocumentReview';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

describe('suapDocumentReview service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exibe a mensagem JSON retornada pela Edge Function em erros non-2xx', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'Gemini respondeu HTTP 400.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    });

    await expect(analyzeSuapDocument({
      documentType: 'tr',
      documentTitle: 'Termo de Referência',
      pdfBase64: 'JVBERi0=',
    })).rejects.toThrow('Gemini respondeu HTTP 400.');
  });
});
