import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManutencaoAdmin from '@/pages/ManutencaoAdmin';
import { manutencaoService } from '@/services/manutencao';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@gov.br' },
    isSuperAdmin: true,
  }),
}));

vi.mock('@/services/manutencao', () => ({
  manutencaoService: {
    getAmbientes: vi.fn(),
    getOcorrencias: vi.fn(),
    getCheckins: vi.fn(),
    getBlocosMapa: vi.fn(),
    saveBlocoMapa: vi.fn(),
    deleteBlocoMapa: vi.fn(),
    createAmbiente: vi.fn(),
    deleteAmbiente: vi.fn(),
    resolveOcorrencia: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

const mockAmbientes = [
  {
    id: 'amb-1',
    codigo: 'SALA-101',
    nome: 'Sala 101 - Informática',
    bloco: 'Bloco Acadêmico Central',
    tipo: 'sala' as const,
    status: 'ativo' as const,
    created_at: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'amb-2',
    codigo: 'ADM-WC-M',
    nome: 'Banheiro Masculino Adm',
    bloco: 'Administrativo',
    tipo: 'banheiro' as const,
    status: 'ativo' as const,
    created_at: '2026-08-01T10:00:00.000Z',
  },
];

const mockOcorrencias = [
  {
    id: 'oc-1',
    ambiente_id: 'amb-1',
    respondente_tipo: 'aluno',
    avaliacao: 4,
    problemas: ['ar_condicionado'],
    observacao: 'Filtro sujo',
    foto_path: null,
    status: 'pendente' as const,
    resolvido_em: null,
    resolvido_por: null,
    created_at: '2026-08-10T14:00:00.000Z',
    ambiente: {
      nome: 'Sala 101 - Informática',
      codigo: 'SALA-101',
      bloco: 'Bloco Acadêmico Central',
    },
  },
  {
    id: 'oc-2',
    ambiente_id: 'amb-2',
    respondente_tipo: 'servidor',
    avaliacao: 2,
    problemas: ['falta_papel_higienico', 'vazamento'],
    observacao: 'Torneira vazando',
    foto_path: null,
    status: 'resolvido' as const,
    resolvido_em: '2026-08-12T10:00:00.000Z',
    resolvido_por: 'user-1',
    created_at: '2026-08-11T09:00:00.000Z',
    ambiente: {
      nome: 'Banheiro Masculino Adm',
      codigo: 'ADM-WC-M',
      bloco: 'Administrativo',
    },
  },
];

const mockCheckins = [
  {
    id: 'ck-1',
    ambiente_id: 'amb-1',
    responsavel_nome: 'João Silva',
    acoes_realizadas: ['limpeza_geral'],
    observacao: null,
    created_at: '2026-08-15T09:00:00.000Z',
    ambiente: {
      nome: 'Sala 101 - Informática',
      codigo: 'SALA-101',
    },
    materiais: [
      { material: 'papel_higienico' as const, quantidade: 2 },
      { material: 'papel_toalha' as const, quantidade: 2 },
    ],
  },
  {
    id: 'ck-2',
    ambiente_id: 'amb-2',
    responsavel_nome: 'Maria Santos',
    acoes_realizadas: ['limpeza_padrao', 'reposicao_insumos'],
    observacao: null,
    created_at: '2026-08-14T08:30:00.000Z',
    ambiente: {
      nome: 'Banheiro Masculino Adm',
      codigo: 'ADM-WC-M',
    },
    materiais: [
      { material: 'sabonete_liquido' as const, quantidade: 3 },
      { material: 'saco_lixo' as const, quantidade: 4 },
    ],
  },
];

describe('ManutencaoAdmin', () => {
  beforeEach(() => {
    vi.mocked(manutencaoService.getAmbientes).mockResolvedValue(mockAmbientes);
    vi.mocked(manutencaoService.getOcorrencias).mockResolvedValue(mockOcorrencias);
    vi.mocked(manutencaoService.getCheckins).mockResolvedValue(mockCheckins);
    vi.mocked(manutencaoService.getBlocosMapa).mockResolvedValue([]);
  });

  it('exibe a aba Dashboard por padrão no modo Avaliações e permite alternar para Insumos via seletor', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Filtros do Painel:')).toBeInTheDocument();
    });

    // Filtros e Seletor Radio
    expect(screen.getByText('Filtros do Painel:')).toBeInTheDocument();
    expect(screen.getByText('Avaliações')).toBeInTheDocument();
    expect(screen.getByText('Insumos')).toBeInTheDocument();

    // KPIs do modo Avaliações (padrão)
    expect(screen.getByText('Satisfação Média')).toBeInTheDocument();
    expect(screen.getByText('Total de Ocorrências')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Resolução')).toBeInTheDocument();
    expect(screen.getByText('Tempo Médio Resolução')).toBeInTheDocument();

    // Gráficos e Destaques de Avaliações
    expect(screen.getByText('Distribuição de Avaliações')).toBeInTheDocument();
    expect(screen.getByText('Principais Problemas Relatados')).toBeInTheDocument();
    expect(screen.getByText('Ambientes com Atenção Prioritária')).toBeInTheDocument();

    // Alterna para o modo Insumos
    const insumosRadio = screen.getByText('Insumos');
    fireEvent.click(insumosRadio);

    // KPIs do modo Insumos
    expect(screen.getByText('Limpezas Registradas')).toBeInTheDocument();
    expect(screen.getByText('Consumo Total de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Média por Intervenção')).toBeInTheDocument();

    // Gráficos e Rankings de Insumos
    expect(screen.getByText('Evolução Temporal de Limpezas')).toBeInTheDocument();
    expect(screen.getByText('Evolução Temporal de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Consumo Geral de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Ambientes em Consumo de Insumos')).toBeInTheDocument();
  });

  it('permite alternar para a aba Visão Geral / Mapa e exibe o mapa do campus com a tabela filtrável', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Visão Geral / Mapa' })).toBeInTheDocument();
    });

    const mapaTabBtn = screen.getByRole('button', { name: 'Visão Geral / Mapa' });
    fireEvent.click(mapaTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Mapa do Campus - Currais Novos')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Buscar no mapa...')).toBeInTheDocument();
      expect(screen.getByText('Sala 101 - Informática')).toBeInTheDocument();
      expect(screen.getByText('Banheiro Masculino Adm')).toBeInTheDocument();
    });
  });

  it('permite alternar para a aba Ocorrências e valida filtro padrão como Pendentes', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ocorrências/ })).toBeInTheDocument();
    });

    const ocorrenciasTabBtn = screen.getByRole('button', { name: /Ocorrências/ });
    fireEvent.click(ocorrenciasTabBtn);

    await waitFor(() => {
      // Exibe ocorrência pendente por padrão
      expect(screen.getByText('Sala 101 - Informática')).toBeInTheDocument();
      // Não exibe ocorrência resolvida por padrão
      expect(screen.queryByText('Banheiro Masculino Adm')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Buscar ocorrência...')).toBeInTheDocument();
    });
  });

  it('não exibe a aba de consumo como aba primária e abre o modal de drilldown ao clicar no detalhamento de insumos', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Filtros do Painel:')).toBeInTheDocument();
    });

    // A aba 'Consumo por Ambiente/Dia' não deve existir nas abas principais
    expect(screen.queryByRole('button', { name: /Consumo por Ambiente/ })).not.toBeInTheDocument();

    // Alterna para a visão de Insumos
    fireEvent.click(screen.getByText('Insumos'));

    // Clica no botão de Detalhar do gráfico de insumos (segundo botão Detalhar)
    const detalharBtns = screen.getAllByRole('button', { name: /Detalhar/i });
    expect(detalharBtns.length).toBeGreaterThan(0);
    fireEvent.click(detalharBtns[1]); // Gráfico de Insumos

    // Deve abrir o modal de Detalhamento de Consumo com a tabela detalhada
    await waitFor(() => {
      expect(screen.getByText('Detalhamento de Consumo de Insumos')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Buscar por ambiente, código, bloco...')).toBeInTheDocument();
    });
  });

  it('não exibe o histórico de limpezas como aba primária e abre o modal ao clicar em Detalhar no gráfico de limpezas', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Filtros do Painel:')).toBeInTheDocument();
    });

    // A aba 'Histórico de Limpezas' não deve existir nas abas principais
    expect(screen.queryByRole('button', { name: /Histórico de Limpezas/ })).not.toBeInTheDocument();

    // Alterna para a visão de Insumos onde estão os gráficos operacionais
    fireEvent.click(screen.getByText('Insumos'));

    // Clica no primeiro botão de Detalhar (Gráfico de Limpezas)
    const detalharBtns = screen.getAllByRole('button', { name: /Detalhar/i });
    fireEvent.click(detalharBtns[0]);

    // Deve abrir o modal de Detalhamento de Limpezas Realizadas
    await waitFor(() => {
      expect(screen.getByText('Detalhamento de Limpezas Realizadas')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Buscar por ambiente, responsável, material...')).toBeInTheDocument();
    });
  });
});
