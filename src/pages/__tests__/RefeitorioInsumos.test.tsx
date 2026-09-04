import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefeitorioInsumos from '@/pages/RefeitorioInsumos';
import { manutencaoService } from '@/services/manutencao';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/manutencao', () => ({
  manutencaoService: {
    getAmbientes: vi.fn(),
    getCheckins: vi.fn(),
    getConsumosInsumos: vi.fn(),
    getBlocosMapa: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Bar: () => null,
  Area: () => null,
  Pie: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
}));

const now = new Date().toISOString();

const mockConsumos = [
  {
    id: 'consumo-req-1',
    origem: 'requisicao_compra' as const,
    consumo_em: now,
    ambiente_id: 'amb-refeitorio',
    ambiente_nome: 'Refeitório',
    ambiente_codigo: 'REFEITORIO',
    ambiente_bloco: 'Refeitório',
    material: 'Arroz parboilizado',
    quantidade: 12.5,
    unidade: 'KG',
    valor_unitario: 4.5,
    valor_total: 56.25,
    requisicao_compra_id: 'req-1',
    requisicao_numero: 'REQ-2026-0001',
    requisicao_status: 'enviada_fornecedor' as const,
  },
  {
    id: 'consumo-req-2',
    origem: 'requisicao_compra' as const,
    consumo_em: now,
    ambiente_id: 'amb-refeitorio',
    ambiente_nome: 'Refeitório',
    ambiente_codigo: 'REFEITORIO',
    ambiente_bloco: 'Refeitório',
    material: 'Feijão preto',
    quantidade: 10,
    unidade: 'KG',
    valor_unitario: 8.0,
    valor_total: 80,
    requisicao_compra_id: 'req-2',
    requisicao_numero: 'REQ-2026-0002',
    requisicao_status: 'enviada_fornecedor' as const,
  },
];

const mockAmbientes = [
  {
    id: 'amb-refeitorio',
    codigo: 'REFEITORIO',
    nome: 'Refeitório',
    bloco: 'Refeitório',
    tipo: 'outros' as const,
    status: 'ativo' as const,
    created_at: now,
  },
];

describe('RefeitorioInsumos Page', () => {
  beforeEach(() => {
    vi.mocked(manutencaoService.getConsumosInsumos).mockResolvedValue(mockConsumos as any);
    vi.mocked(manutencaoService.getAmbientes).mockResolvedValue(mockAmbientes as any);
    vi.mocked(manutencaoService.getCheckins).mockResolvedValue([]);
    vi.mocked(manutencaoService.getBlocosMapa).mockResolvedValue([]);
  });

  it('renderiza o cabeçalho e o painel de insumos com filtros e cards', async () => {
    render(
      <MemoryRouter>
        <RefeitorioInsumos />
      </MemoryRouter>
    );

    expect(screen.getByText('Insumos do Refeitório')).toBeInTheDocument();
    expect(
      screen.getByText(/Acompanhamento do consumo, volume de requisições e custos de insumos/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total de Requisições')).toBeInTheDocument();
      expect(screen.getByText('Valor Total Gasto')).toBeInTheDocument();
    });

    // Gráficos
    expect(screen.getByText('Distribuição por Categoria')).toBeInTheDocument();
    expect(screen.getByText('Evolução Temporal de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Consumo Geral de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Ambientes em Consumo de Insumos')).toBeInTheDocument();
  });

  it('abre o modal de detalhamento analítico ao clicar em Detalhar', async () => {
    render(
      <MemoryRouter>
        <RefeitorioInsumos />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Total de Requisições')).toBeInTheDocument();
    });

    const detalharBtns = screen.getAllByRole('button', { name: /Detalhar/i });
    expect(detalharBtns.length).toBeGreaterThan(1);
    fireEvent.click(detalharBtns[1]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Detalhamento de Consumo de Insumos/i })).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Buscar por ambiente, código, bloco...')).toBeInTheDocument();
    expect(screen.getByText('Arroz parboilizado')).toBeInTheDocument();
  });
});
