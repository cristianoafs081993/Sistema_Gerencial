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
    getDocumentosPorFavorecido: vi.fn(),
    getDocumentoCompleto: vi.fn(),
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
    window.history.replaceState(null, '', '/');
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
    mockedTransparenciaService.getDocumentosPorFavorecido.mockResolvedValue({
      data: [],
      total: 0,
    });
    mockedTransparenciaService.getDocumentoCompleto.mockResolvedValue(null as never);
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

  it('abre a consulta condh recebida pela extensão e permite acessar os detalhes do documento', async () => {
    const documento = {
      id: '2026NP000085',
      data_emissao: '2026-03-01T12:00:00',
      favorecido_nome: 'Empresa Exemplo Ltda',
      favorecido_documento: '07.805.649/0001-29',
      estado: 'REALIZADO',
      valor_original: 1250,
      valor_pago: 1250,
      itens: [],
      obs: [],
      situacoes: [],
      fontes: [],
    };
    mockedTransparenciaService.getDocumentosPorFavorecido.mockResolvedValue({
      data: [documento],
      total: 1,
    } as never);
    mockedTransparenciaService.getDocumentoCompleto.mockResolvedValue(documento as never);
    window.history.replaceState(null, '', '/liquidacoes-pagamentos#condh=07805649000129');

    renderPage();

    expect(screen.getByPlaceholderText('Buscar documento ou favorecido...'))
      .toHaveValue('07.805.649/0001-29');
    expect(await screen.findByText('2026NP000085')).toBeInTheDocument();
    expect(mockedTransparenciaService.getDocumentosPorFavorecido)
      .toHaveBeenCalledWith('07805649000129', { page: 1, perPage: 20 });

    fireEvent.click(screen.getByText('2026NP000085'));
    expect(await screen.findByText('Detalhamento Financeiro')).toBeInTheDocument();
    expect(mockedTransparenciaService.getDocumentoCompleto).toHaveBeenCalledWith('2026NP000085');
  });
});
