import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManutencaoAdmin, { formatMaterialDisplayName } from '@/pages/ManutencaoAdmin';
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
    getConsumosInsumos: vi.fn(),
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
  BarChart: ({ children, layout, data }: { children: React.ReactNode; layout?: string; data?: any[] }) => (
    <div data-testid="bar-chart" data-layout={layout} data-items-count={data?.length}>
      {children}
    </div>
  ),
  AreaChart: ({ children, data }: { children: React.ReactNode; data?: any[] }) => (
    <div data-testid="area-chart" data-items-count={data?.length}>
      {children}
    </div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Bar: () => null,
  Area: ({ dataKey, name }: { dataKey?: string; name?: string }) => (
    <div data-testid="area-curve" data-key={dataKey} data-name={name} />
  ),
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

const mockConsumosInsumos = [
  {
    id: 'consumo-req-1',
    origem: 'requisicao_compra' as const,
    consumo_em: '2026-09-03T10:00:00.000Z',
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
];

describe('ManutencaoAdmin', () => {
  beforeEach(() => {
    vi.mocked(manutencaoService.getAmbientes).mockResolvedValue(mockAmbientes);
    vi.mocked(manutencaoService.getOcorrencias).mockResolvedValue(mockOcorrencias);
    vi.mocked(manutencaoService.getCheckins).mockResolvedValue(mockCheckins);
    vi.mocked(manutencaoService.getConsumosInsumos).mockResolvedValue(mockConsumosInsumos);
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
    const insumosRadio = screen.getByDisplayValue('insumos');
    fireEvent.change(insumosRadio, { target: { checked: true } });
    fireEvent.click(insumosRadio);

    // KPIs do modo Insumos
    expect(screen.getByText('Limpezas Registradas')).toBeInTheDocument();
    expect(screen.getByText('Valor Total Gasto')).toBeInTheDocument();
    expect(screen.getByText('Média por Registro')).toBeInTheDocument();

    // Gráficos e Rankings de Insumos
    expect(screen.getByText('Evolução Temporal de Limpezas')).toBeInTheDocument();
    expect(screen.getByText('Evolução Temporal de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Consumo Geral de Insumos')).toBeInTheDocument();
    expect(screen.getByText('Top 5 Ambientes em Consumo de Insumos')).toBeInTheDocument();

    // Valida que o filtro de Tipo de Insumo está visível no modo Insumos
    expect(screen.getByText('Todos os Insumos')).toBeInTheDocument();
  });

  it('permite alternar para a aba Visão Geral / Mapa e exibe o mapa do campus com a tabela consolidada filtrável', async () => {
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
      expect(screen.getByPlaceholderText('Buscar ambiente...')).toBeInTheDocument();
      expect(screen.getByText('CÓDIGO')).toBeInTheDocument();
      expect(screen.getByText('NOME DO ESPAÇO')).toBeInTheDocument();
      expect(screen.getByText('BLOCO')).toBeInTheDocument();
      expect(screen.getByText('TIPO DE ESPAÇO')).toBeInTheDocument();
      expect(screen.getByText('STATUS')).toBeInTheDocument();
      expect(screen.getByText('ÚLTIMA LIMPEZA')).toBeInTheDocument();
      expect(screen.getByText('SITUAÇÃO')).toBeInTheDocument();
      expect(screen.getByText('AÇÕES')).toBeInTheDocument();
      expect(screen.getByText('Sala 101 - Informática')).toBeInTheDocument();
      expect(screen.getByText('Banheiro Masculino Adm')).toBeInTheDocument();
      expect(screen.getAllByText('Ativo').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /QR Code/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Imprimir Todos/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cadastrar Ambiente/i })).toBeInTheDocument();
    });

    // Seleciona um ambiente específico pelo checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
    fireEvent.click(checkboxes[1]);

    // Valida que o botão de Imprimir Selecionados aparece com contagem
    expect(screen.getByRole('button', { name: /Imprimir Selecionados \(1\)/i })).toBeInTheDocument();

    // Clica no botão QR Code do primeiro ambiente para validar modal e URL base
    const qrCodeBtns = screen.getAllByRole('button', { name: /QR Code/i });
    fireEvent.click(qrCodeBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Cartaz com QR Code do Ambiente')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Testar link público/i })).toHaveAttribute(
        'href',
        expect.stringContaining('https://www.siages.com.br/feedback-ambiente/')
      );
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

  it('inclui itens de requisição como consumo no Refeitório com origem, unidade e situação', async () => {
    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(manutencaoService.getConsumosInsumos).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Insumos'));
    fireEvent.click(screen.getAllByRole('button', { name: /Detalhar/i })[1]);

    await waitFor(() => {
      expect(screen.getByText('Arroz parboilizado')).toBeInTheDocument();
      expect(screen.getAllByText('Refeitório').length).toBeGreaterThan(0);
      expect(screen.getByText('Requisição de compra')).toBeInTheDocument();
      expect(screen.getByText(/12\.5 KG/)).toBeInTheDocument();
      expect(screen.getByText(/REQ-2026-0001/)).toBeInTheDocument();
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

  it('formata nomes longos e técnicos de insumos com formatMaterialDisplayName', () => {
    expect(formatMaterialDisplayName('papel_higienico')).toBe('Papel Higiênico (rolos)');
    expect(formatMaterialDisplayName('sabonete_liquido')).toBe('Sabonete Líquido (L)');
    expect(
      formatMaterialDisplayName('00020 - Fruta - apresentacao: natural, tipo: laranja pera')
    ).toBe('Fruta: Laranja pera');
    expect(
      formatMaterialDisplayName('00037 - Polpa De Fruta - sabor: maracuja')
    ).toBe('Polpa: Maracuja');
    expect(
      formatMaterialDisplayName('00010 - Legume In Natura - variedade: batata inglesa')
    ).toBe('Legume: Batata inglesa');
    expect(
      formatMaterialDisplayName('00015 - Desinfetante hospitalar')
    ).toBe('Desinfetante hospitalar');
    expect(formatMaterialDisplayName('')).toBe('Insumo');
  });

  it('exibe gráfico de insumos com layout vertical e suporte a alternância Top 8 / Todos quando há mais de 8 materiais', async () => {
    // 10 materiais diferentes distribuídos
    const mockConsumos10 = [
      { material: '00020 - Fruta - tipo: laranja pera', quantidade: 25 },
      { material: '00037 - Polpa De Fruta - sabor: maracuja', quantidade: 20 },
      { material: '00010 - Legume In Natura - variedade: batata', quantidade: 18 },
      { material: 'papel_higienico', quantidade: 15 },
      { material: 'sabonete_liquido', quantidade: 12 },
      { material: 'papel_toalha', quantidade: 10 },
      { material: 'saco_lixo', quantidade: 8 },
      { material: '00045 - Detergente neutro', quantidade: 7 },
      { material: '00050 - Esponja multiuso', quantidade: 5 },
      { material: '00060 - Álcool em gel 70%', quantidade: 3 },
    ].map((item, idx) => ({
      id: `consumo-${idx}`,
      origem: 'checkin' as const,
      consumo_em: new Date().toISOString(),
      ambiente_id: 'amb-1',
      ambiente_nome: 'Sala 101 - Informática',
      ambiente_codigo: 'SALA-101',
      ambiente_bloco: 'Bloco Acadêmico Central',
      material: item.material,
      quantidade: item.quantidade,
      unidade: 'UN',
    }));

    vi.mocked(manutencaoService.getConsumosInsumos).mockResolvedValue(mockConsumos10);

    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('insumos')).toBeInTheDocument();
    });

    const insumosRadio = screen.getByDisplayValue('insumos');
    fireEvent.change(insumosRadio, { target: { checked: true } });
    fireEvent.click(insumosRadio);

    await waitFor(() => {
      expect(screen.getByText('Consumo Geral de Insumos')).toBeInTheDocument();
    });

    // O gráfico de barras deve ter layout vertical
    const barChart = screen.getByTestId('bar-chart');
    expect(barChart).toHaveAttribute('data-layout', 'vertical');

    // Com 10 materiais, deve exibir os botões de alternância Top 8 e Todos (10)
    expect(screen.getByRole('button', { name: 'Top 8' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Todos \(10\)/i })).toBeInTheDocument();

    // No modo padrão Top 8, exibe 8 itens no gráfico
    expect(barChart).toHaveAttribute('data-items-count', '8');

    // Alterna para 'Todos (10)'
    fireEvent.click(screen.getByRole('button', { name: /Todos \(10\)/i }));
    expect(barChart).toHaveAttribute('data-items-count', '10');

    // Retorna para 'Top 8'
    fireEvent.click(screen.getByRole('button', { name: 'Top 8' }));
    expect(barChart).toHaveAttribute('data-items-count', '8');
  });

  it('exibe o card de Valor Total Gasto e o gráfico de Evolução Temporal com a métrica de valor gasto', async () => {
    const mockConsumoValor = [
      {
        id: 'consumo-val-1',
        origem: 'requisicao_compra' as const,
        consumo_em: new Date().toISOString(),
        ambiente_id: 'amb-1',
        ambiente_nome: 'Refeitório',
        ambiente_codigo: 'REFEITORIO',
        ambiente_bloco: 'Refeitório',
        material: 'Fruta',
        quantidade: 10,
        unidade: 'KG',
        valor_unitario: 5.5,
        valor_total: 55.0,
        requisicao_compra_id: 'req-val',
        requisicao_numero: 'REQ-VAL-1',
        requisicao_status: 'enviada_fornecedor' as const,
      },
    ];

    vi.mocked(manutencaoService.getConsumosInsumos).mockResolvedValue(mockConsumoValor);

    render(
      <MemoryRouter>
        <ManutencaoAdmin />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('insumos')).toBeInTheDocument();
    });

    const insumosRadio = screen.getByDisplayValue('insumos');
    fireEvent.change(insumosRadio, { target: { checked: true } });
    fireEvent.click(insumosRadio);

    await waitFor(() => {
      expect(screen.getByText('Valor Total Gasto')).toBeInTheDocument();
    });

    // Valida que o card exibe o valor formatado em R$
    expect(screen.getByText(/R\$\s*55,00/)).toBeInTheDocument();

    // Valida o subtítulo da evolução temporal de insumos
    expect(screen.getByText('Valor diário gasto com materiais e insumos repostos.')).toBeInTheDocument();

    // Valida que a curva do gráfico de evolução de insumos consome a chave 'valor'
    const areaCurves = screen.getAllByTestId('area-curve');
    const valorCurve = areaCurves.find((el) => el.getAttribute('data-key') === 'valor');
    expect(valorCurve).toBeDefined();
    expect(valorCurve).toHaveAttribute('data-name', 'Valor Gasto');
  });
});
