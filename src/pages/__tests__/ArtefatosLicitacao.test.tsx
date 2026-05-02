import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ArtefatosLicitacao from '@/pages/ArtefatosLicitacao';
import { licitacaoArtifactsService } from '@/services/licitacaoArtifacts';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/docxDocumentTemplate', () => ({
  applyDocxTemplatePlan: vi.fn(),
}));

vi.mock('@/services/licitacaoArtifacts', () => ({
  licitacaoArtifactsService: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedLicitacaoArtifactsService = vi.mocked(licitacaoArtifactsService);

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={['/artefatos-licitacao']}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/artefatos-licitacao"
            element={(
              <>
                <ArtefatosLicitacao />
                <LocationProbe />
              </>
            )}
          />
          <Route path="/editor-documentos/:modelId" element={<LocationProbe />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ArtefatosLicitacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLicitacaoArtifactsService.list.mockResolvedValue([
      {
        id: 'artifact-etp',
        artifactType: 'etp',
        processId: 'proc-1',
        processNumber: '23035.000123/2026-11',
        title: 'ETP - Limpeza',
        subtitle: 'Processo 23035.000123/2026-11',
        htmlContent: '<h1>ETP</h1>',
        plainText: 'ETP de limpeza',
        metadata: {},
        sourceArtifactIds: [],
        version: 1,
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
      {
        id: 'artifact-risk',
        artifactType: 'mapa_riscos',
        processId: 'proc-2',
        processNumber: '23035.000999/2026-99',
        title: 'Mapa de Risco - Copeiragem',
        subtitle: 'Processo 23035.000999/2026-99',
        htmlContent: '<h1>Mapa</h1>',
        plainText: 'Mapa de riscos de copeiragem',
        metadata: {},
        sourceArtifactIds: ['artifact-etp'],
        version: 2,
        updatedAt: '2026-05-01T11:00:00.000Z',
      },
    ]);
    mockedLicitacaoArtifactsService.delete.mockResolvedValue(undefined);
  });

  it('lista e filtra artefatos por processo', async () => {
    renderPage();

    expect(await screen.findByText('ETP - Limpeza')).toBeInTheDocument();
    expect(screen.getByText('Mapa de Risco - Copeiragem')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por processo/i), {
      target: { value: '000999' },
    });

    expect(screen.queryByText('ETP - Limpeza')).not.toBeInTheDocument();
    expect(screen.getByText('Mapa de Risco - Copeiragem')).toBeInTheDocument();
  });

  it('filtra por tipo textual e abre artefato no editor', async () => {
    renderPage();

    expect(await screen.findByText('ETP - Limpeza')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por processo/i), {
      target: { value: 'Mapa de Risco' },
    });

    expect(screen.queryByText('ETP - Limpeza')).not.toBeInTheDocument();
    expect(screen.getByText('Mapa de Risco - Copeiragem')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Abrir no editor/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/editor-documentos/mapa-riscos-licitacao?artifactId=artifact-risk',
      );
    });
  });
});
