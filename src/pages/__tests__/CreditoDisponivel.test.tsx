import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import CreditoDisponivel from '@/pages/CreditoDisponivel';
import { creditosDisponiveisDetalhesService } from '@/services/creditosDisponiveisDetalhes';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/services/creditosDisponiveisDetalhes', () => ({
  creditosDisponiveisDetalhesService: {
    getLatestReport: vi.fn(),
    importReport: vi.fn(),
  },
  parseCreditoDisponivelFile: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedService = vi.mocked(creditosDisponiveisDetalhesService);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CreditoDisponivel />
    </QueryClientProvider>,
  );
}

describe('CreditoDisponivel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({ isSuperAdmin: true } as never);
    mockedService.getLatestReport.mockResolvedValue({
      sourceFile: '3 - Crédito Disponível.csv',
      importedAt: '2026-05-26T13:00:00.000Z',
      rows: [
        {
          id: 'credito-1',
          ptres: '230446',
          planoInterno: 'CFF53M9601N',
          descricao: 'PNAE - ALIMENTACAO ESCOLAR',
          metrica: 'Saldo - Moeda Origem',
          valor: 75867,
          importBatchId: 'batch-1',
          sourceFile: '3 - Crédito Disponível.csv',
          importedAt: '2026-05-26T13:00:00.000Z',
        },
        {
          id: 'credito-2',
          ptres: '231796',
          planoInterno: 'L20RLP19ENN',
          descricao: 'PROEN-ACOES DO ENSINO',
          metrica: 'Saldo - Moeda Origem',
          valor: 0,
          importBatchId: 'batch-1',
          sourceFile: '3 - Crédito Disponível.csv',
          importedAt: '2026-05-26T13:00:00.000Z',
        },
      ],
    });
  });

  it('exibe o relatorio detalhado e filtra por conteudo do PI', async () => {
    renderPage();

    expect(await screen.findByText('PNAE - ALIMENTACAO ESCOLAR')).toBeInTheDocument();
    expect(screen.queryByText('L20RLP19ENN')).not.toBeInTheDocument();
    expect(screen.getByText('Somente com saldo')).toBeInTheDocument();
    expect(screen.getByText('R$ 75.867,00')).toBeInTheDocument();
    expect(screen.queryByText('Saldo - Moeda Origem')).not.toBeInTheDocument();
    expect(screen.queryByText('3 - Crédito Disponível.csv')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por PTRES/i), { target: { value: 'CFF53' } });

    expect(screen.getByText('CFF53M9601N')).toBeInTheDocument();
    expect(screen.queryByText('L20RLP19ENN')).not.toBeInTheDocument();
  });

  it('exibe o botao de atualizar e nao exibe mais botao de upload no header', async () => {
    renderPage();

    expect(await screen.findByRole('button', { name: /Atualizar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Importar CSV/i })).not.toBeInTheDocument();
  });
});
