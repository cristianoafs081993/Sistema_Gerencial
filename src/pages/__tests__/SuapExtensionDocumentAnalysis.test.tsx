import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SuapExtensionDocumentAnalysis from '@/pages/SuapExtensionDocumentAnalysis';
import { isValidSuapExtensionDocumentPdfResult, SUAP_EXTENSION_ORIGIN } from '@/lib/suapExtensionDispatch';

const mocks = vi.hoisted(() => ({
  setSession: vi.fn(),
  stopAutoRefresh: vi.fn(),
  analyzeSuapDocument: vi.fn(),
}));
const { setSession, stopAutoRefresh, analyzeSuapDocument } = mocks;

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { setSession: mocks.setSession, stopAutoRefresh: mocks.stopAutoRefresh } },
}));

vi.mock('@/services/suapDocumentReview', () => ({
  SUAP_DOCUMENT_REVIEW_MAX_BYTES: 20 * 1024 * 1024,
  SUAP_DOCUMENT_REVIEW_MAX_PAGES: 200,
  analyzeSuapDocument: mocks.analyzeSuapDocument,
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(({ data }: { data: Uint8Array }) => {
    structuredClone(data.buffer, { transfer: [data.buffer] });
    return { promise: Promise.resolve({ numPages: 1 }) };
  }),
}));

describe('SuapExtensionDocumentAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    analyzeSuapDocument.mockResolvedValue({
      documentType: 'tr', checkedAt: '2026-08-10T12:00:00.000Z', status: 'attention',
      summary: 'O documento precisa de ajustes.',
      counts: { critical: 0, high: 1, medium: 0, low: 0 },
      findings: [{ id: 'f-1', severity: 'high', category: 'Quantitativos', title: 'Memória de cálculo', page: 2, excerpt: 'Quantidade estimada', problem: 'A memória não está demonstrada.', recommendation: 'Incluir a memória de cálculo.', suggestedText: 'A quantidade foi calculada...', confidence: 'high', legalBases: [{ title: 'Lei 14.133/2021', reference: 'art. 18', url: 'https://www.planalto.gov.br/lei' }] }],
      sources: [{ title: 'Lei 14.133/2021', reference: 'art. 18', url: 'https://www.planalto.gov.br/lei', checkedAt: '2026-08-10T12:00:00.000Z' }],
      limitations: ['Revisão assistida.'],
    });
  });

  it('recebe contexto, solicita o PDF e exibe achados sem editar o documento', async () => {
    render(<SuapExtensionDocumentAnalysis />);

    await act(async () => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: SUAP_EXTENSION_ORIGIN,
        source: window.parent,
        data: {
          source: 'siages-suap-extension', type: 'siages:suap-document-analysis-context', version: 1,
          payload: {
            suapId: '12345', processNumber: '23035.000001.2026-11', processUrl: 'https://suap.ifrn.edu.br/processo_eletronico/processo/12345/',
            documentId: '987', documentTitle: 'Termo de Referência: TR 2/2026', documentType: 'tr',
            documentOriginalPath: '/documento_eletronico/visualizar_documento/987/?original=sim',
            extensionSession: { accessToken: 'access', refreshToken: 'refresh' },
          },
        },
      }));
    });

    await waitFor(() => expect(setSession).toHaveBeenCalledOnce());
    expect(await screen.findByText('Baixando o PDF do documento pelo SUAP...')).toBeInTheDocument();
    await act(async () => {
      const bytes = new ArrayBuffer(8);
      const pdfEvent = new MessageEvent('message', {
        origin: SUAP_EXTENSION_ORIGIN,
        source: window.parent,
        data: { source: 'siages-suap-extension', type: 'siages:suap-document-pdf-result', version: 1, payload: { suapId: '12345', documentId: '987', bytes } },
      });
      expect(isValidSuapExtensionDocumentPdfResult(pdfEvent, window.parent, '12345', '987')).toBe(true);
      window.dispatchEvent(pdfEvent);
    });

    expect(await screen.findByText('O documento precisa de ajustes.')).toBeInTheDocument();
    expect(screen.getByText('Memória de cálculo')).toBeInTheDocument();
    expect(screen.getByText('A quantidade foi calculada...')).toBeInTheDocument();
    expect(analyzeSuapDocument).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'tr', documentTitle: 'Termo de Referência: TR 2/2026', pageCount: 1 }));
    expect(stopAutoRefresh).toHaveBeenCalledOnce();
    expect(screen.queryByText(/editar|aplicar automaticamente/i)).not.toBeInTheDocument();
  });
});
