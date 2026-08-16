import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardRapTab } from '../DashboardRapTab';
import type { Empenho } from '@/types';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isSuperAdmin: false }),
}));

vi.mock('../DashboardRapAnnualEvolutionPanel', () => ({
  DashboardRapAnnualEvolutionPanel: () => <div data-testid="annual-panel">Painel Anual</div>,
}));

vi.mock('../DashboardRapOrigemEmpenhosModal', () => ({
  DashboardRapOrigemEmpenhosModal: ({
    open,
    origem,
    onOpenChange,
  }: {
    open: boolean;
    origem: string | null;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="rap-origem-modal">
        <span>Modal aberto para origem: {origem}</span>
        <button type="button" onClick={() => onOpenChange(false)}>
          Fechar Modal
        </button>
      </div>
    ) : null,
}));

const mockEmpenhosRap: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2024NE000101',
    descricao: 'Serviço de limpeza',
    valor: 100000,
    origemRecurso: '231796',
    dimensao: 'D1',
    componenteFuncional: 'CF1',
    naturezaDespesa: '339037',
    favorecidoNome: 'EMPRESA LIMPEZA LTDA',
    tipo: 'rap',
    rapInscrito: 100000,
    rapPago: 40000,
    saldoRapOficial: 60000,
    dataEmpenho: new Date('2024-03-01'),
    status: 'pendente',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
];

const mockDadosRapPorOrigem = [
  {
    origem: '231796',
    baseVigente: 100000,
    liquidadoNoAno: 40000,
    saldoAtual: 60000,
    percentual: 40,
  },
  {
    origem: '231799',
    baseVigente: 50000,
    liquidadoNoAno: 50000,
    saldoAtual: 0,
    percentual: 100,
  },
];

function renderDashboardRapTab(props: Partial<React.ComponentProps<typeof DashboardRapTab>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardRapTab
        isLoading={false}
        rapTotalInscrito={100000}
        rapTotalReinscrito={50000}
        rapTotalLiquidadoNoAno={90000}
        rapTotalSaldoAtual={60000}
        filteredRapCount={2}
        dadosRapPorOrigem={mockDadosRapPorOrigem}
        empenhosRap={mockEmpenhosRap}
        rapReferenceYear={2026}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('DashboardRapTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza os cartões de estatísticas e a tabela de resumo por origem', () => {
    renderDashboardRapTab();

    expect(screen.getByText('RAP por origem de recurso')).toBeInTheDocument();
    expect(screen.getByText('231796')).toBeInTheDocument();
    expect(screen.getByText('231799')).toBeInTheDocument();
    expect(screen.queryByTestId('rap-origem-modal')).not.toBeInTheDocument();
  });

  it('abre o modal com a origem correta ao clicar na linha da tabela', () => {
    renderDashboardRapTab();

    const row231796 = screen.getByText('231796').closest('tr');
    expect(row231796).toBeInTheDocument();

    fireEvent.click(row231796!);

    expect(screen.getByTestId('rap-origem-modal')).toBeInTheDocument();
    expect(screen.getByText(/Modal aberto para origem: 231796/i)).toBeInTheDocument();
  });

  it('permite abrir o modal navegando com teclado (Enter/Espaço)', () => {
    renderDashboardRapTab();

    const row231799 = screen.getByText('231799').closest('tr');
    expect(row231799).toBeInTheDocument();

    fireEvent.keyDown(row231799!, { key: 'Enter' });

    expect(screen.getByTestId('rap-origem-modal')).toBeInTheDocument();
    expect(screen.getByText(/Modal aberto para origem: 231799/i)).toBeInTheDocument();
  });

  it('fecha o modal quando onOpenChange(false) é disparado', () => {
    renderDashboardRapTab();

    const row231796 = screen.getByText('231796').closest('tr');
    fireEvent.click(row231796!);

    expect(screen.getByTestId('rap-origem-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fechar Modal'));
    expect(screen.queryByTestId('rap-origem-modal')).not.toBeInTheDocument();
  });
});
