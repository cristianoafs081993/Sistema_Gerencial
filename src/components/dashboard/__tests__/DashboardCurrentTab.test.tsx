import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardCurrentTab } from '../DashboardCurrentTab';
import type { Atividade, Empenho } from '@/types';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
  ComposedChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  Area: () => <div />,
}));

vi.mock('../DashboardOrigemAtividadesModal', () => ({
  DashboardOrigemAtividadesModal: ({
    open,
    origem,
    onOpenChange,
  }: {
    open: boolean;
    origem: string | null;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="origem-atividades-modal">
        <span>Modal aberto para origem: {origem}</span>
        <button type="button" onClick={() => onOpenChange(false)}>
          Fechar Modal
        </button>
      </div>
    ) : null,
}));

const mockAtividades: Atividade[] = [
  {
    id: 'atv-1',
    atividade: 'Atividade 01',
    descricao: 'Serviço de limpeza',
    valorTotal: 100000,
    origemRecurso: '231796',
    dimensao: 'D1',
    componenteFuncional: 'CF1',
    tipoAtividade: 'campus',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockEmpenhosCorrente: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2024NE000101',
    descricao: 'Empenho 1',
    valor: 60000,
    origemRecurso: '231796',
    dimensao: 'D1',
    componenteFuncional: 'CF1',
    naturezaDespesa: '339037',
    tipo: 'exercicio',
    status: 'pendente',
    dataEmpenho: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockDadosPorOrigem = [
  {
    origem: '231796',
    planejado: 100000,
    empenhado: 60000,
    saldo: 40000,
    percentual: 60,
  },
  {
    origem: '261941',
    planejado: 50000,
    empenhado: 50000,
    saldo: 0,
    percentual: 100,
  },
];

function renderDashboardCurrentTab(props: Partial<React.ComponentProps<typeof DashboardCurrentTab>> = {}) {
  return render(
    <DashboardCurrentTab
      isLoading={false}
      filteredData={{
        atividades: mockAtividades,
        empenhosCorrente: mockEmpenhosCorrente,
        empenhosRap: [],
        descentralizacoes: [],
      }}
      totalPlanejado={150000}
      totalEmpenhado={110000}
      totalDescentralizado={0}
      aDescentralizar={150000}
      percentualExecutado={73.3}
      totalLiquidado={0}
      totalPago={0}
      dadosPorOrigem={mockDadosPorOrigem}
      dadosMensais={[]}
      budgetTreemapData={[]}
      activeBudgetDimension={null}
      highlightedBudgetDimension={null}
      hoveredBudgetDimension={null}
      onHoverBudgetDimension={vi.fn()}
      onSelectBudgetDimension={vi.fn()}
      dadosDescentralizacao={[]}
      uniqueOrigens={['231796', '261941']}
      dadosPorNatureza={[]}
      {...props}
    />,
  );
}

describe('DashboardCurrentTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o card de Detalhamento por Origem com as linhas', () => {
    renderDashboardCurrentTab();

    expect(screen.getByText('Detalhamento por Origem')).toBeInTheDocument();
    expect(screen.getByText('231796')).toBeInTheDocument();
    expect(screen.getByText('261941')).toBeInTheDocument();
    expect(screen.queryByTestId('origem-atividades-modal')).not.toBeInTheDocument();
  });

  it('abre o modal com a origem correspondente ao clicar na linha da tabela', () => {
    renderDashboardCurrentTab();

    const row231796 = screen.getByText('231796').closest('tr');
    expect(row231796).toBeInTheDocument();

    fireEvent.click(row231796!);

    expect(screen.getByTestId('origem-atividades-modal')).toBeInTheDocument();
    expect(screen.getByText(/Modal aberto para origem: 231796/i)).toBeInTheDocument();
  });

  it('permite abrir o modal navegando com teclado (Enter/Espaço)', () => {
    renderDashboardCurrentTab();

    const row261941 = screen.getByText('261941').closest('tr');
    expect(row261941).toBeInTheDocument();

    fireEvent.keyDown(row261941!, { key: 'Enter' });

    expect(screen.getByTestId('origem-atividades-modal')).toBeInTheDocument();
    expect(screen.getByText(/Modal aberto para origem: 261941/i)).toBeInTheDocument();
  });

  it('fecha o modal quando onOpenChange(false) é disparado', () => {
    renderDashboardCurrentTab();

    const row231796 = screen.getByText('231796').closest('tr');
    fireEvent.click(row231796!);

    expect(screen.getByTestId('origem-atividades-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Fechar Modal'));
    expect(screen.queryByTestId('origem-atividades-modal')).not.toBeInTheDocument();
  });

  it('renderiza os valores de Liquidado e Pago no card de resumo', () => {
    renderDashboardCurrentTab({
      totalLiquidado: 1215470.5,
      totalPago: 1207245.19,
    });

    const cardTitle = screen.getByText('Liquidado / Pago');
    const card = cardTitle.closest('div');
    expect(card).toBeInTheDocument();
    expect(within(card!).getByText('Liquidado')).toBeInTheDocument();
    expect(within(card!).getByText('Pago')).toBeInTheDocument();
    expect(within(card!).getByText('R$ 1.215.470,50')).toBeInTheDocument();
    expect(within(card!).getByText('R$ 1.207.245,19')).toBeInTheDocument();
  });
});
