import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import type { Empenho, Contrato, Atividade } from '@/types';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});


if (typeof window !== 'undefined') {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = window.ResizeObserver || ResizeObserverMock;
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}

const mockedUseAuth = vi.mocked(useAuth);

const mockEmpenhos: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2026NE000123',
    descricao: 'Serviços de limpeza e conservação predial',
    valor: 100000,
    valorLiquidadoAPagar: 20000,
    valorPagoOficial: 30000,
    dimensao: 'Administração',
    componenteFuncional: 'Serviços Terceirizados',
    origemRecurso: 'Tesouro',
    naturezaDespesa: '339037',
    planoInterno: 'PI12345',
    favorecidoNome: 'LIMPEZA TOTAL LTDA',
    favorecidoDocumento: '12.345.678/0001-90',
    tipo: 'exercicio',
    dataEmpenho: new Date('2026-01-15'),
    status: 'liquidado',
    processo: '23000.000123/2026-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'emp-2',
    numero: '2025NE800456',
    descricao: 'Aquisição de material de consumo',
    valor: 50000,
    dimensao: 'Ensino',
    componenteFuncional: 'Material de Consumo',
    origemRecurso: 'Próprio',
    naturezaDespesa: '339030',
    planoInterno: 'PI67890',
    favorecidoNome: 'PAPELARIA CENTRAL LTDA',
    tipo: 'rap',
    rapInscrito: 50000,
    rapLiquidado: 10000,
    rapPago: 10000,
    dataEmpenho: new Date('2025-11-20'),
    status: 'pendente',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockContratos: Contrato[] = [
  {
    id: 'cont-1',
    numero: '12/2024',
    ano: 2024,
    fornecedorNome: 'SEGURANCA PATRIMONIAL LTDA',
    objeto: 'Serviços de vigilância armada',
    valorTotal: 360000,
    status: 'Ativo',
    dimensao: 'Administração',
    processo: '23000.000999/2024-10',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('CommandPalette — Entity Search & Navigation', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      canAccessScreen: vi.fn(() => true),
      session: { user: { id: 'user-1', email: 'user@ifrn.edu.br' } } as never,
    } as never);
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );

  it('permite buscar e encontrar empenho pelo número com saldo em destaque', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={mockContratos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '2026NE' } });

    expect(screen.getByText('2026NE000123')).toBeInTheDocument();
    expect(screen.getByText(/LIMPEZA TOTAL LTDA/i)).toBeInTheDocument();
    expect(screen.getByText('R$ 50.000,00')).toBeInTheDocument(); // Saldo disponível (100k - 20k - 30k)
  });

  it('permite buscar empenhos usando o prefixo "ne " ou "empenho "', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={mockContratos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'ne papelaria' } });

    expect(screen.getByText('2025NE800456')).toBeInTheDocument();
    expect(screen.getByText(/PAPELARIA CENTRAL LTDA/i)).toBeInTheDocument();
    expect(screen.getByText('RAP')).toBeInTheDocument();
  });

  it('permite buscar contratos pelo número ou fornecedor', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={mockContratos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'vigilância' } });

    expect(screen.getByText('Contrato 12/2024')).toBeInTheDocument();
    expect(screen.getByText(/SEGURANCA PATRIMONIAL LTDA/i)).toBeInTheDocument();
  });

  it('abre o modal EmpenhoDialog ao selecionar um empenho', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={mockContratos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '2026NE' } });

    const empenhoItem = screen.getByText('2026NE000123');
    fireEvent.click(empenhoItem);

    // Dialog title should show up
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('abre o modal ContratoApiDetailsSheet ao selecionar um contrato', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={mockContratos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '12/2024' } });

    const contratoItem = screen.getByText('Contrato 12/2024');
    fireEvent.click(contratoItem);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText(/Contrato 12\/2024/i).length).toBeGreaterThan(0);

  });

  it('exibe apenas contratos ativos e ignora contratos inativos ou encerrados', () => {
    const contratosComInativo: Contrato[] = [
      ...mockContratos,
      {
        id: 'contrato-inativo-99',
        numero: '99/2019',
        ano: 2019,
        fornecedorNome: 'EMPRESA ANTIGA ENCERRADA',
        objeto: 'Serviço encerrado',
        valorTotal: 50000,
        status: 'Inativo',
      },
    ];

    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={mockEmpenhos}
        contratosList={contratosComInativo}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '99/2019' } });

    expect(screen.queryByText('Contrato 99/2019')).not.toBeInTheDocument();
    expect(screen.queryByText(/EMPRESA ANTIGA ENCERRADA/i)).not.toBeInTheDocument();
  });

  it('prioriza com alta precisão o empenho cujo número sequencial corresponde exatamente à busca por número (ex: "32")', () => {
    const empenhosCom32: Empenho[] = [
      {
        id: 'emp-78',
        numero: '2026NE000078',
        favorecidoNome: 'MARIA ALISANDRA DA SILVA OLIVEIRA GOMES',
        favorecidoDocumento: '12.324.567/0001-90',
        valor: 10000,
        tipo: 'exercicio',
        status: 'pendente',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'emp-32',
        numero: '2026NE000032',
        favorecidoNome: 'LM SERVGRAFICA E COPIADORA LTDA',
        favorecidoDocumento: '98.765.432/0001-10',
        valor: 5000,
        tipo: 'exercicio',
        status: 'pago',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'emp-68',
        numero: '2026NE000068',
        favorecidoNome: 'COMPANHIA ENERGETICA DO RIO GRANDE DO NORTE COSERN',
        valor: 30000,
        tipo: 'exercicio',
        status: 'pendente',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={empenhosCom32}
        contratosList={[]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '32' } });

    // 2026NE000032 must be present
    expect(screen.getByText('2026NE000032')).toBeInTheDocument();
    expect(screen.getByText(/LM SERVGRAFICA E COPIADORA LTDA/i)).toBeInTheDocument();

    // Empenho 2026NE000078 should not match simply because its CNPJ has 32 (noise prevention for 2-digit queries)
    expect(screen.queryByText('2026NE000078')).not.toBeInTheDocument();
    expect(screen.queryByText('2026NE000068')).not.toBeInTheDocument();
  });
});





