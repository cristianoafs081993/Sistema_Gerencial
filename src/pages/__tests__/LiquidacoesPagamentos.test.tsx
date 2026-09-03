import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LiquidacoesPagamentos from '@/pages/LiquidacoesPagamentos';
import { transparenciaService } from '@/services/transparencia';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/transparencia', () => ({
  transparenciaService: {
    getDocumentos: vi.fn(),
  },
}));

const mockedTransparenciaService = vi.mocked(transparenciaService);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LiquidacoesPagamentos />
    </QueryClientProvider>,
  );
}

describe('LiquidacoesPagamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTransparenciaService.getDocumentos.mockResolvedValue({
      data: [
        {
          id: '2026NS000001',
          data_emissao: '2026-03-01T12:00:00',
          favorecido_nome: 'Empresa Alpha Ltda',
          favorecido_documento: '12.345.678/0001-90',
          estado: 'REALIZADO',
          valor_original: 15000,
          obs: [],
          situacoes: [],
          fontes: [],
        },
      ],
      total: 1,
      page: 1,
      perPage: 10,
    } as never);
  });

  it('renderiza a lista de documentos hábeis e cartões com sucesso sem erros de runtime', async () => {
    renderPage();

    expect(screen.getByText('Documentos Hábeis')).toBeInTheDocument();
    expect(await screen.findByText('Empresa Alpha Ltda')).toBeInTheDocument();
    expect(screen.getByText('2026NS000001')).toBeInTheDocument();
    expect(screen.getByText('REALIZADO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Atualizar Dados/i })).toBeInTheDocument();
  });

  it('permite filtrar por termo de busca', async () => {
    renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar documento ou favorecido...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(searchInput).toHaveValue('Alpha');
  });
});
