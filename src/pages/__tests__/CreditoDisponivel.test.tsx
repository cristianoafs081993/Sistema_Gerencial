import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import CreditoDisponivel from '@/pages/CreditoDisponivel';
import { creditosDisponiveisDetalhesService } from '@/services/creditosDisponiveisDetalhes';

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/services/creditosDisponiveisDetalhes', () => ({
  creditosDisponiveisDetalhesService: {
    getLatestReport: vi.fn(),
    importReport: vi.fn(),
  },
  parseCreditoDisponivelFile: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseData = vi.mocked(useData);
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
    mockedUseData.mockReturnValue({
      empenhos: [
        {
          id: 'emp-1',
          numero: '2026NE000100',
          descricao: 'Empenho PNAE',
          valor: 25000,
          origemRecurso: '230446',
          dimensao: 'EN - Ensino',
          componenteFuncional: 'Ensino',
          naturezaDespesa: '339030',
          planoInterno: 'CFF53M9601N',
          favorecidoNome: 'Fornecedor Alimentar Ltda',
          dataEmpenho: new Date('2026-03-01'),
          status: 'pendente',
          tipo: 'exercicio',
          createdAt: new Date('2026-03-01'),
          updatedAt: new Date('2026-03-01'),
        },
      ],
      descentralizacoes: [
        {
          id: 'desc-1',
          origemRecurso: '230446',
          dimensao: 'EN - Ensino',
          notaCredito: '2026NC000050',
          planoInterno: 'CFF53M9601N',
          descricao: 'Descentralização PNAE',
          valor: 100000,
          dataEmissao: new Date('2026-02-01'),
          createdAt: new Date('2026-02-01'),
          updatedAt: new Date('2026-02-01'),
        },
      ],
      atividades: [],
      updateEmpenho: vi.fn(),
    } as never);

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

  it('abre o modal de movimentações ao clicar na linha do PTRES', async () => {
    renderPage();

    const rowItem = await screen.findByText('PNAE - ALIMENTACAO ESCOLAR');
    fireEvent.click(rowItem);

    expect(screen.getByText(/Movimentações da Origem \/ PTRES/i)).toBeInTheDocument();
    expect(screen.getByText('PTRES: 230446')).toBeInTheDocument();
    expect(screen.getByText('2026NC000050')).toBeInTheDocument();
    expect(screen.getByText('Descentralização PNAE')).toBeInTheDocument();

    // Alterna para aba de empenhos
    const empenhosTab = screen.getByRole('tab', { name: /Empenhos/i });
    fireEvent.mouseDown(empenhosTab, { button: 0, ctrlKey: false });
    expect(screen.getByText('2026NE000100')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor Alimentar Ltda')).toBeInTheDocument();
  });
});

