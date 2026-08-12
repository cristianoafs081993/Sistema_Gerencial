import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeSuapDocument, getLatestSuapDocumentReview } from '@/services/suapDocumentReview';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke }, from: mocks.from },
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
      suapId: '12345',
      documentId: '987',
      documentType: 'tr',
      documentTitle: 'Termo de Referência',
      pdfBase64: 'JVBERi0=',
    })).rejects.toThrow('Gemini respondeu HTTP 400.');
  });

  it('salva a análise concluída com a identificação do documento', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert });
    mocks.invoke.mockResolvedValue({
      data: {
        documentType: 'tr', checkedAt: '2026-08-10T12:00:00.000Z', status: 'attention', summary: 'Ajustes necessários.',
        counts: { critical: 0, high: 1, medium: 0, low: 0 }, findings: [], sources: [], limitations: [],
      },
      error: null,
    });

    const result = await analyzeSuapDocument({
      suapId: '12345', documentId: '987', documentType: 'tr', documentTitle: 'TR 2/2026',
      processNumber: '23035.000001.2026-11', pdfBase64: 'JVBERi0=', pageCount: 1,
    });

    expect(mocks.from).toHaveBeenCalledWith('suap_document_reviews');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      suap_id: '12345', document_id: '987', document_type: 'tr', document_title: 'TR 2/2026',
      process_number: '23035.000001.2026-11', result,
    }));
  });

  it('carrega a última análise salva do documento', async () => {
    const query = {
      select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { result: { documentType: "tr", checkedAt: "2026-08-10T12:00:00.000Z", status: "no_major_finding", summary: "Tudo certo.", counts: { critical: 0, high: 0, medium: 0, low: 0 }, findings: [], sources: [], limitations: [] } }, error: null });
    mocks.from.mockReturnValue(query);

    const result = await getLatestSuapDocumentReview({ suapId: '12345', documentId: '987', documentType: 'tr' });

    expect(result?.summary).toBe('Tudo certo.');
    expect(query.eq).toHaveBeenCalledWith('document_type', 'tr');
  });
});
