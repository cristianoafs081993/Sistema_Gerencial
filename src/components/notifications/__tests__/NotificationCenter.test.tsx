import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from '../NotificationCenter';
import type { Empenho, Descentralizacao, Atividade } from '@/types';

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
    dataEmpenho: new Date('2026-08-15T10:00:00.000Z'),
    status: 'liquidado',
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
    updatedAt: new Date('2026-08-15T10:00:00.000Z'),
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
    createdAt: new Date('2026-08-10T14:30:00.000Z'),
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
    dataEmissao: new Date('2026-08-16T09:00:00.000Z'),
    createdAt: new Date('2026-08-16T09:00:00.000Z'),
    updatedAt: new Date('2026-08-16T09:00:00.000Z'),
  },
];

const mockAtividades: Atividade[] = [];

describe('NotificationCenter', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  it('renderiza o botão da central de notificações com indicador visual de novidades', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('notification-unread-dot')).toBeInTheDocument();
  });

  it('exibe empenhos e descentralizações juntos na mesma lista unificada', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    fireEvent.click(button);

    expect(screen.getByText('Notificações')).toBeInTheDocument();
    // Verifica que empenhos e descentralizações aparecem juntos
    expect(screen.getByText('Empenho 2026NE000101')).toBeInTheDocument();
    expect(screen.getByText('Dell Computadores do Brasil Ltda')).toBeInTheDocument();
    expect(screen.getByText('Descentralização 2026NC000045')).toBeInTheDocument();
    expect(screen.getByText('Origem: 8100 - Custeio')).toBeInTheDocument();
    expect(screen.getByText('Empenho 2026NE000102')).toBeInTheDocument();
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

    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={manyEmpenhos}
          descentralizacoes={[]}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    // Os mais recentes (dia 25 até dia 6) devem estar presentes (20 itens)
    expect(screen.getByText('Empenho 2026NE000024')).toBeInTheDocument();
    // O mais antigo (dia 1 -> index 0) deve ter sido excluído pelo limite de 20
    expect(screen.queryByText('Empenho 2026NE000000')).not.toBeInTheDocument();
  });

  it('filtra notificações pelo campo de busca na lista unificada', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    const searchInput = screen.getByPlaceholderText(/buscar por número, credor/i);
    fireEvent.change(searchInput, { target: { value: 'Dell' } });

    expect(screen.getByText('Empenho 2026NE000101')).toBeInTheDocument();
    expect(screen.queryByText('Empenho 2026NE000102')).not.toBeInTheDocument();
    expect(screen.queryByText('Descentralização 2026NC000045')).not.toBeInTheDocument();
  });

  it('abre o modal EmpenhoDialog ao clicar em um empenho', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByText('Empenho 2026NE000101'));

    expect(screen.getByTestId('empenho-dialog')).toHaveTextContent('Modal Empenho: 2026NE000101');
  });

  it('navega para /descentralizacoes ao clicar em uma descentralização', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByText('Descentralização 2026NC000045'));

    expect(mockNavigate).toHaveBeenCalledWith('/descentralizacoes');
  });

  it('marca todas as notificações como lidas ao clicar na ação', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(screen.getByTitle('Marcar todas como lidas')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Marcar todas como lidas'));

    expect(screen.queryByTestId('notification-unread-dot')).not.toBeInTheDocument();
  });

  it('navega através dos botões de atalho no rodapé', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    fireEvent.click(screen.getByRole('button', { name: /todos empenhos/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/empenhos');

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    fireEvent.click(screen.getByRole('button', { name: /descentralizações/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/descentralizacoes');
  });
});
