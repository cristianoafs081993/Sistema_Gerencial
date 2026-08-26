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

const mockAtividades: Atividade[] = [];

describe('NotificationCenter', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
  });

  it('renderiza o botão da central de notificações com indicador visual de novidades contendo o número de não lidas', () => {
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
    const badge = screen.getByTestId('notification-unread-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('não renderiza o badge quando não houver eventos ou notificações', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={[]}
          descentralizacoes={[]}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: /abrir central de notificações/i });
    expect(button).toBeInTheDocument();
    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });

  it('exibe empenhos e descentralizações juntos na mesma lista unificada ordenados por data de criação', () => {
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

    // Valida a intercalação decrescente dos eventos (NC000045 antes de NE000102 antes de NE000101)
    const desc1 = screen.getByText('Descentralização 2026NC000045');
    const empenho2 = screen.getByText('Empenho 2026NE000102');
    const empenho1 = screen.getByText('Empenho 2026NE000101');

    expect(desc1.compareDocumentPosition(empenho2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(empenho2.compareDocumentPosition(empenho1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

    // O badge deve exibir 20 (limite de eventos suportado)
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('20');

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));

    // Os mais recentes (dia 25 até dia 6) devem estar presentes (20 itens)
    expect(screen.getByText('Empenho 2026NE000024')).toBeInTheDocument();
    // O mais antigo (dia 1 -> index 0) deve ter sido excluído pelo limite de 20
    expect(screen.queryByText('Empenho 2026NE000000')).not.toBeInTheDocument();
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

  it('marca todas as notificações como lidas ao clicar na ação e remove o badge numérico', () => {
    render(
      <MemoryRouter>
        <NotificationCenter
          empenhos={mockEmpenhos}
          descentralizacoes={mockDescentralizacoes}
          atividades={mockAtividades}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: /abrir central de notificações/i }));
    expect(screen.getByTitle('Marcar todas como lidas')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Marcar todas como lidas'));

    expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
  });
});
