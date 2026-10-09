import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter, type NotificationCenterProps } from '../NotificationCenter';
import type { Empenho, Descentralizacao, Atividade, RequisicaoCompraRecord } from '@/types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/modals/EmpenhoDialog', () => ({
  EmpenhoDialog: ({ open, empenho }: { open: boolean; empenho: Empenho | null }) =>
    open ? <div data-testid="empenho-dialog">Modal Empenho: {empenho?.numero}</div> : null,
}));

const mockEmpenhos: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2026NE000101',
    descricao: 'Aquisição de material permanente para laboratórios',
    valor: 45000.5,
    dimensao: 'TI - Tecnologia da Informação e Comunicação',
    componenteFuncional: 'Equipamentos de TI',
    origemRecurso: '8100 - Tesouro',
    naturezaDespesa: '449052',
    favorecidoNome: 'Dell Computadores do Brasil Ltda',
    favorecidoDocumento: '00.000.000/0001-91',
    tipo: 'exercicio',
    dataEmpenho: new Date('2026-08-01T10:00:00.000Z'),
    status: 'liquidado',
    createdAt: new Date('2026-08-18T12:00:00.000Z'), // Criação mais recente
    updatedAt: new Date('2026-08-18T12:00:00.000Z'),
  },
  {
    id: 'emp-2',
    numero: '2026NE000102',
    descricao: 'Serviços de manutenção predial preventiva',
    valor: 12800.0,
    dimensao: 'IE - Infraestrutura',
    componenteFuncional: 'Manutenção Predial',
    origemRecurso: '8100 - Tesouro',
    naturezaDespesa: '339039',
    favorecidoNome: 'Engenharia e Manutenções Gerais',
    favorecidoDocumento: '11.111.111/0001-11',
    tipo: 'exercicio',
    dataEmpenho: new Date('2026-08-10T14:30:00.000Z'),
    status: 'pendente',
    createdAt: new Date('2026-08-10T14:30:00.000Z'), // Criação mais antiga
    updatedAt: new Date('2026-08-10T14:30:00.000Z'),
  },
];

const mockDescentralizacoes: Descentralizacao[] = [
  {
    id: 'desc-1',
    notaCredito: '2026NC000045',
    descricao: 'Descentralização de créditos para custeio de ensino',
    valor: 85000.0,
    dimensao: 'EN - Ensino',
    origemRecurso: '8100 - Custeio',
    naturezaDespesa: '339030',
    planoInterno: 'ENSINOCN',
    dataEmissao: new Date('2026-08-05T09:00:00.000Z'),
    createdAt: new Date('2026-08-15T09:00:00.000Z'), // Criação intermediária
    updatedAt: new Date('2026-08-15T09:00:00.000Z'),
  },
];

const mockRequisicoes: RequisicaoCompraRecord[] = [
  {
    id: 'req-1',
    title: 'Aquisição de suprimentos de informática',
    number: 'REQ-2026-0001',
    status: 'enviada_fornecedor',
    createdBy: 'user-1',
    createdByEmail: 'terceirizado@ifrn.edu.br',
    empenhoId: 'emp-1',
    empenhoNumero: '2026NE000101',
    empenhos: [{ empenhoId: 'emp-1', empenhoNumero: '2026NE000101', sortOrder: 0 }],
    contratoId: 'contrato-1',
    contratoNumero: '00329/2025',
    processNumber: '23035.000001/2026-01',
    notes: 'Pedido enviado',
    items: [],
    totalValue: 3500.0,
    createdAt: new Date('2026-08-20T10:00:00.000Z'),
    updatedAt: new Date('2026-08-20T10:00:00.000Z'),
  },
  {
    id: 'req-2',
    title: 'Rascunho não enviado',
    number: 'REQ-2026-0002',
    status: 'draft',
    createdBy: 'user-1',
    createdByEmail: 'terceirizado@ifrn.edu.br',
    empenhoId: 'emp-2',
    empenhoNumero: '2026NE000102',
    empenhos: [{ empenhoId: 'emp-2', empenhoNumero: '2026NE000102', sortOrder: 0 }],
    notes: 'Rascunho',
    items: [],
    totalValue: 1200.0,
    createdAt: new Date('2026-08-21T10:00:00.000Z'),
    updatedAt: new Date('2026-08-21T10:00:00.000Z'),
  },
];

const mockAtividades: Atividade[] = [];

function renderComponent(props: NotificationCenterProps = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const tree = (notificationProps: NotificationCenterProps) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
          requisicoesCompra={mockRequisicoes}
          {...notificationProps}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(tree(props));
  return { ...result, rerenderNotifications: (next: NotificationCenterProps) => result.rerender(tree(next)) };
}

function notificationTitles() {
  return screen.getAllByText(/^(Empenho \S+|Descentralização \S+|Requisição \S+)$/).map((item) => item.textContent);
}

describe('NotificationCenter', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  it('renderiza o botão da central de notificações com indicador visual de novidades contendo o número de não lidas', () => {
    renderComponent();

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    expect(button).toBeInTheDocument();
    const badge = screen.getByTestId('notification-unread-badge');
    expect(badge).toBeInTheDocument();
    // 2 empenhos + 1 descentralização + 1 requisição enviada ao fornecedor = 4 eventos
    expect(badge).toHaveTextContent('4');
  });

  it('não renderiza o badge quando não houver eventos ou notificações', () => {
    renderComponent({
      empenhos: [],
      descentralizacoes: [],
      requisicoesCompra: [],
    });

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('exibe empenhos, descentralizações e requisições enviadas ao fornecedor na lista unificada', () => {
    renderComponent();

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    fireEvent.click(button);

    expect(screen.getByText('Notificações')).toBeInTheDocument();
    // Verifica que requisições enviadas aparecem
    expect(screen.getByText('Requisição REQ-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Criador: terceirizado@ifrn.edu.br')).toBeInTheDocument();
    expect(screen.getByText('Enviada')).toBeInTheDocument();

    // Rascunho não deve aparecer na lista de notificações
    expect(screen.queryByText('Requisição REQ-2026-0002')).not.toBeInTheDocument();

    // Verifica que empenhos e descentralizações aparecem
    expect(screen.getByText('Empenho 2026NE000101')).toBeInTheDocument();
    expect(screen.getByText('Dell Computadores do Brasil Ltda')).toBeInTheDocument();
    expect(screen.getByText('Descentralização 2026NC000045')).toBeInTheDocument();
    expect(screen.getByText('Origem: 8100 - Custeio')).toBeInTheDocument();
    expect(screen.getByText('Empenho 2026NE000102')).toBeInTheDocument();
  });

  it('navega para /requisicao-compra ao clicar em uma requisição enviada ao fornecedor', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByText('Requisição REQ-2026-0001'));

    expect(mockNavigate).toHaveBeenCalledWith('/requisicao-compra');
  });

  it('limita a exibição aos últimos 20 eventos', () => {
    const manyEmpenhos: Empenho[] = Array.from({ length: 25 }, (_, i) => ({
      id: `emp-extra-${i}`,
      numero: `2026NE${String(i).padStart(6, '0')}`,
      descricao: `Empenho extra ${i}`,
      valor: 1000 + i,
      dimensao: 'AD - Administração',
      componenteFuncional: 'Material',
      origemRecurso: '8100',
      naturezaDespesa: '339030',
      tipo: 'exercicio',
      dataEmpenho: new Date(2026, 0, i + 1),
      status: 'pendente',
      createdAt: new Date(2026, 0, i + 1),
      updatedAt: new Date(2026, 0, i + 1),
    }));

    renderComponent({
      empenhos: manyEmpenhos,
      descentralizacoes: [],
      requisicoesCompra: [],
    });

    // O badge deve exibir 20 (limite de eventos suportado)
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('20');

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    // Os mais recentes (dia 25 até dia 6) devem estar presentes (20 itens)
    expect(screen.getByText('Empenho 2026NE000024')).toBeInTheDocument();
    // O mais antigo (dia 1 -> index 0) deve ter sido excluído pelo limite de 20
    expect(screen.queryByText('Empenho 2026NE000000')).not.toBeInTheDocument();
  });

  it('abre o modal EmpenhoDialog ao clicar em um empenho', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByText('Empenho 2026NE000101'));

    expect(screen.getByTestId('empenho-dialog')).toHaveTextContent('Modal Empenho: 2026NE000101');
  });

  it('navega para /descentralizacoes ao clicar em uma descentralização', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByText('Descentralização 2026NC000045'));

    expect(mockNavigate).toHaveBeenCalledWith('/descentralizacoes');
  });

  it('marca todas as notificações como lidas ao clicar na ação e remove o badge numérico', () => {
    renderComponent();

    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('4');

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(screen.getByTitle('Marcar todas como lidas')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Marcar todas como lidas'));

    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('ordena os três tipos por data, sem promover documentos antigos importados recentemente', () => {
    const oldRequisicao = { ...mockRequisicoes[0], updatedAt: new Date('2026-07-01'), createdAt: new Date('2026-07-01') };
    renderComponent({ requisicoesCompra: [oldRequisicao] });
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    expect(notificationTitles()).toEqual([
      'Empenho 2026NE000102',
      'Descentralização 2026NC000045',
      'Empenho 2026NE000101',
      'Requisição REQ-2026-0001',
    ]);
  });

  it('a data prevalece sobre o número sequencial do empenho', () => {
    renderComponent({
      empenhos: [{ ...mockEmpenhos[0], numero: '2026NE999999' }, mockEmpenhos[1]],
      descentralizacoes: [], requisicoesCompra: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(notificationTitles()).toEqual(['Empenho 2026NE000102', 'Empenho 2026NE999999']);
  });

  it('aplica o limite depois de ordenar todas as categorias', () => {
    const recentes = Array.from({ length: 20 }, (_, i) => ({
      ...mockEmpenhos[0], id: `recent-${i}`, numero: `2026NE${String(i).padStart(6, '0')}`,
      dataEmpenho: new Date(2026, 8, i + 1),
    }));
    renderComponent({ empenhos: recentes });
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(notificationTitles()).toHaveLength(20);
    expect(screen.getByText('Empenho 2026NE000000')).toBeInTheDocument();
    expect(screen.getByText('Empenho 2026NE000019')).toBeInTheDocument();
    expect(screen.queryByText('Requisição REQ-2026-0001')).not.toBeInTheDocument();
    expect(screen.queryByText('Descentralização 2026NC000045')).not.toBeInTheDocument();
  });

  it('desempata pelo identificador mesmo se a ordem de entrada mudar', () => {
    const sameDate = new Date('2026-08-10T14:30:00Z');
    const a = { ...mockEmpenhos[0], id: 'a', dataEmpenho: sameDate };
    const b = { ...mockEmpenhos[1], id: 'b', dataEmpenho: sameDate };
    const props = { empenhos: [b, a], descentralizacoes: [], requisicoesCompra: [] };
    const view = renderComponent(props);
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(notificationTitles()).toEqual(['Empenho 2026NE000101', 'Empenho 2026NE000102']);
    view.rerenderNotifications({ ...props, empenhos: [a, b] });
    expect(notificationTitles()).toEqual(['Empenho 2026NE000101', 'Empenho 2026NE000102']);
  });

  it.each([undefined, new Date('inválida')])('usa criação quando a data principal é ausente ou inválida (%s)', (invalidDate) => {
    renderComponent({
      empenhos: [{ ...mockEmpenhos[0], dataEmpenho: invalidDate, createdAt: new Date('2026-08-18T12:00:00Z') }],
      descentralizacoes: [{ ...mockDescentralizacoes[0], dataEmissao: invalidDate, createdAt: new Date('2026-08-19T12:00:00Z') }],
      requisicoesCompra: [{ ...mockRequisicoes[0], updatedAt: invalidDate, createdAt: new Date('2026-08-20T12:00:00Z') }],
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(notificationTitles()).toEqual([
      'Requisição REQ-2026-0001', 'Descentralização 2026NC000045', 'Empenho 2026NE000101',
    ]);
    expect(screen.getByText('18/08/2026')).toBeInTheDocument();
    expect(screen.getByText('19/08/2026')).toBeInTheDocument();
    expect(screen.getByText('20/08/2026')).toBeInTheDocument();
  });

  it('coloca eventos sem nenhuma data válida no final', () => {
    renderComponent({
      empenhos: [mockEmpenhos[1], { ...mockEmpenhos[0], dataEmpenho: new Date('inválida'), createdAt: new Date('inválida') }],
      descentralizacoes: [], requisicoesCompra: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(notificationTitles()).toEqual(['Empenho 2026NE000102', 'Empenho 2026NE000101']);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('um novo evento sobe ao topo após a leitura sem tornar antigos não lidos', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-21T12:00:00Z').getTime());
    const view = renderComponent();
    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByTitle('Marcar todas como lidas'));
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
    const novo = { ...mockEmpenhos[0], id: 'novo', numero: '2026NE000103', dataEmpenho: new Date('2026-08-22T12:00:00Z') };
    view.rerenderNotifications({ empenhos: [...mockEmpenhos, novo] });
    expect(notificationTitles()[0]).toBe('Empenho 2026NE000103');
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('1');
    expect(localStorage.getItem('siages-notifications-last-read')).toBe(String(Date.now()));
  });
});
