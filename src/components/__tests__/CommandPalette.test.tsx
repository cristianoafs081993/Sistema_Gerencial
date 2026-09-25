import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/components/CommandPalette';
import { useAuth, useOptionalAuth } from '@/contexts/AuthContext';
import type { Empenho, Contrato, Atividade, DocumentoDespesa } from '@/types';

const transparenciaMock = vi.hoisted(() => ({
  getDocumentosPorFavorecido: vi.fn(),
  getDocumentoCompleto: vi.fn(),
}));

vi.mock('@/services/transparencia', () => ({
  transparenciaService: transparenciaMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  useOptionalAuth: vi.fn(),
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
const mockedUseOptionalAuth = vi.mocked(useOptionalAuth);

function stubLocationAssign() {
  const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign } as unknown as Location,
  });

  return {
    assign,
    restore: () => {
      if (locationDescriptor) Object.defineProperty(window, 'location', locationDescriptor);
    },
  };
}

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
    queryClient.clear();
    transparenciaMock.getDocumentosPorFavorecido.mockReset().mockResolvedValue({ data: [], total: 0 });
    transparenciaMock.getDocumentoCompleto.mockReset().mockResolvedValue(null);
    mockedUseAuth.mockReturnValue({
      canAccessScreen: vi.fn(() => true),
      session: { user: { id: 'user-1', email: 'user@ifrn.edu.br' } } as never,
    } as never);
    mockedUseOptionalAuth.mockReturnValue({
      userCampus: { codigo: '158366', nome: 'Currais Novos' },
    } as never);
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );

  it('busca o CPF/CNPJ pelo comando condh e abre os detalhes do documento NP', async () => {
    const documento: DocumentoDespesa = {
      id: '158366264352026NP000085',
      valor_original: 1250.5,
      valor_pago: 1250.5,
      estado: 'REALIZADO',
      processo: '23000.000085/2026-10',
      favorecido_nome: 'FORNECEDOR EXEMPLO',
      favorecido_documento: '07.805.649/0001-29',
      data_emissao: '2026-02-03',
      itens: [],
      situacoes: [],
    };
    transparenciaMock.getDocumentosPorFavorecido.mockResolvedValue({ data: [documento], total: 1 });
    transparenciaMock.getDocumentoCompleto.mockResolvedValue(documento);

    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'CONDH 07.805.649/0001-29' } });

    expect(await screen.findByText('2026NP000085')).toBeInTheDocument();
    expect(screen.getByText('REALIZADO')).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).toHaveBeenCalledWith('07.805.649/0001-29', { page: 1, perPage: 20 });

    fireEvent.click(screen.getByText('2026NP000085'));
    expect(await screen.findByText('Detalhamento Financeiro')).toBeInTheDocument();
    expect(transparenciaMock.getDocumentoCompleto).toHaveBeenCalledWith('158366264352026NP000085');
  });

  it('busca RP/NP pelo próprio número no comando condh', async () => {
    const documento: DocumentoDespesa = {
      id: '158366264352026NP000085',
      valor_original: 1250.5,
      valor_pago: 1250.5,
      estado: 'REALIZADO',
      processo: '',
      favorecido_nome: 'FORNECEDOR EXEMPLO',
      favorecido_documento: '07.805.649/0001-29',
      data_emissao: '2026-02-03',
    };
    transparenciaMock.getDocumentosPorFavorecido.mockResolvedValue({ data: [documento], total: 1 });

    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/digite um comando, ne, contrato/i), {
      target: { value: 'condh 2026NP000085' },
    });

    expect(await screen.findByText('2026NP000085')).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).toHaveBeenCalledWith('2026NP000085', { page: 1, perPage: 20 });
  });

  it('busca RP e NP pelo sufixo numérico no comando condh', async () => {
    const documentos: DocumentoDespesa[] = ['NP', 'RP'].map((tipo) => ({
      id: `158366264352026${tipo}000082`,
      valor_original: 100,
      valor_pago: 0,
      estado: tipo === 'NP' ? 'REALIZADO' : 'PENDENTE DE REALIZAÇÃO',
      processo: '',
      favorecido_nome: `FORNECEDOR ${tipo}`,
      favorecido_documento: '07805649000129',
      data_emissao: '2026-02-03',
    }));
    transparenciaMock.getDocumentosPorFavorecido.mockResolvedValue({ data: documentos, total: 2 });

    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/digite um comando, ne, contrato/i), {
      target: { value: 'condh 82' },
    });

    expect(await screen.findByText('2026NP000082')).toBeInTheDocument();
    expect(screen.getByText('2026RP000082')).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).toHaveBeenCalledWith('82', { page: 1, perPage: 20 });
  });

  it('permite paginar os resultados condh em grupos de 20', async () => {
    const makeDocumento = (index: number): DocumentoDespesa => ({
      id: `158366264352026NP${String(index).padStart(6, '0')}`,
      valor_original: 100,
      valor_pago: 0,
      estado: index === 21 ? 'PENDENTE DE REALIZAÇÃO' : 'REALIZADO',
      processo: '',
      favorecido_nome: `FORNECEDOR ${index}`,
      favorecido_documento: '07805649000129',
      data_emissao: `2026-01-${String(Math.min(index, 28)).padStart(2, '0')}`,
    });
    transparenciaMock.getDocumentosPorFavorecido.mockImplementation(
      (_documento: string, options: { page: number }) => Promise.resolve({
        data: options.page === 1
          ? Array.from({ length: 20 }, (_, index) => makeDocumento(index + 1))
          : [makeDocumento(21)],
        total: 21,
      }),
    );

    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'condh 07805649000129' } });
    expect(await screen.findByText('2026NP000001')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('2026NP000021')).toBeInTheDocument();
    expect(screen.getByText('PENDENTE DE REALIZAÇÃO')).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).toHaveBeenLastCalledWith('07805649000129', { page: 2, perPage: 20 });
  });

  it('respeita a permissão de acesso à tela de liquidações', async () => {
    const canAccessScreen = vi.fn((screenId: string) => screenId !== 'liquidacoes-pagamentos');
    mockedUseAuth.mockReturnValue({
      canAccessScreen,
      session: { user: { id: 'user-1', email: 'user@ifrn.edu.br' } } as never,
    } as never);

    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/digite um comando, ne, contrato/i), {
      target: { value: 'condh 07805649000129' },
    });

    expect(await screen.findByText(/você não tem acesso à tela liquidações e pagamentos/i)).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).not.toHaveBeenCalled();
  });

  it('orienta sobre o formato e informa quando nenhum RP/NP é encontrado', async () => {
    renderWithProviders(
      <CommandPalette open={true} onOpenChange={vi.fn()} empenhosList={[]} contratosList={[]} />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'condh abc' } });
    expect(screen.getByText(/cpf\/cnpj com 11 ou 14 dígitos, o número de uma rp\/np.*sufixo numérico/i)).toBeInTheDocument();
    expect(transparenciaMock.getDocumentosPorFavorecido).not.toHaveBeenCalled();

    fireEvent.change(searchInput, { target: { value: 'condh 07805649000129' } });
    expect(await screen.findByText(/nenhum documento rp ou np encontrado/i)).toBeInTheDocument();
  });

  it('exibe consultas de processos, alunos, documentos e contratos com URLs oficiais do SUAP', () => {
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={[]}
        contratosList={[]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'consulta exemplo' } });

    const queryRows = Array.from(document.querySelectorAll<HTMLElement>('[data-suap-query-url]'));
    expect(queryRows).toHaveLength(4);
    expect(queryRows.map((row) => row.dataset.suapQueryUrl)).toEqual(expect.arrayContaining([
      'https://suap.ifrn.edu.br/admin/processo_eletronico/processo/?q=consulta+exemplo',
      'https://suap.ifrn.edu.br/edu/alunos/?q=consulta+exemplo',
      'https://suap.ifrn.edu.br/admin/documento_eletronico/documentotexto/?opcao=1&q=consulta+exemplo',
      'https://suap.ifrn.edu.br/admin/contratos/contrato/?campi=3&q=consulta+exemplo&tab=tab_ativos',
    ]));
  });

  it('aceita prefixo de aluno e abre a consulta na aba atual com Enter', () => {
    const location = stubLocationAssign();
    try {
      renderWithProviders(
        <CommandPalette
          open={true}
          onOpenChange={vi.fn()}
          empenhosList={[]}
          contratosList={[]}
        />,
      );

      const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
      fireEvent.change(searchInput, { target: { value: 'aluno: 20201234567890' } });
      expect(document.querySelectorAll('[data-suap-query-url]')).toHaveLength(1);
      expect(screen.getByText('Abrir Aluno #20201234567890')).toBeInTheDocument();

      fireEvent.keyDown(searchInput, { key: 'Enter' });
      expect(location.assign).toHaveBeenCalledWith('https://suap.ifrn.edu.br/edu/aluno/20201234567890/');
    } finally {
      location.restore();
    }
  });

  it('abre uma consulta selecionada em nova aba com Ctrl+Enter', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={[]}
        contratosList={[]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: 'proc: 23000.000123/2026-01' } });
    const queryRow = document.querySelector<HTMLElement>('[data-suap-query-url]')!;
    queryRow.setAttribute('aria-selected', 'true');

    fireEvent.keyDown(searchInput, { key: 'Enter', ctrlKey: true });
    expect(openMock).toHaveBeenCalledWith(
      'https://suap.ifrn.edu.br/admin/processo_eletronico/processo/?q=23000.000123%2F2026-01',
      '_blank',
      'noopener,noreferrer',
    );
  });

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

  it('não exibe empenhos com saldo zero nos resultados da busca', () => {
    const empenhosComSaldos: Empenho[] = [
      {
        id: 'emp-com-saldo',
        numero: '2026NE000080',
        favorecidoNome: 'VAREJAO L B LTDA',
        valor: 25500,
        valorLiquidadoAPagar: 0,
        valorPagoOficial: 0,
        tipo: 'exercicio',
        status: 'pendente',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'emp-exercicio-zerado',
        numero: '2026NE000081',
        favorecidoNome: 'FORNECEDOR TOTALMENTE PAGO',
        valor: 15000,
        valorPagoOficial: 15000,
        tipo: 'exercicio',
        status: 'pago',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'emp-rap-zerado',
        numero: '2025NE000280',
        favorecidoNome: 'ROBERIO BATISTA DE AZEVEDO JUNIOR',
        valor: 10000,
        tipo: 'rap',
        rapInscrito: 10000,
        rapPago: 10000,
        saldoRapOficial: 0,
        status: 'pago',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    renderWithProviders(
      <CommandPalette
        open={true}
        onOpenChange={vi.fn()}
        empenhosList={empenhosComSaldos}
        contratosList={[]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/digite um comando, ne, contrato/i);
    fireEvent.change(searchInput, { target: { value: '80' } });

    // Empenho com saldo deve aparecer
    expect(screen.getByText('2026NE000080')).toBeInTheDocument();
    expect(screen.getByText(/VAREJAO L B LTDA/i)).toBeInTheDocument();
    expect(screen.getByText('R$ 25.500,00')).toBeInTheDocument();

    // Empenhos com saldo zero não devem aparecer
    expect(screen.queryByText('2026NE000081')).not.toBeInTheDocument();
    expect(screen.queryByText('2025NE000280')).not.toBeInTheDocument();
    expect(screen.queryByText(/ROBERIO BATISTA DE AZEVEDO JUNIOR/i)).not.toBeInTheDocument();
  });
});






