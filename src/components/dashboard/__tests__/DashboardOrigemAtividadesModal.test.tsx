import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardOrigemAtividadesModal } from '../DashboardOrigemAtividadesModal';
import type { Atividade, Empenho } from '@/types';

vi.mock('@/components/modals/AtividadeDialog', () => ({
  AtividadeDialog: ({ open, atividade }: { open: boolean; atividade: Atividade | null }) =>
    open && atividade ? <div data-testid="atividade-dialog">{atividade.atividade}</div> : null,
}));

const mockAtividades: Atividade[] = [
  {
    id: 'atv-1',
    atividade: 'Atividade 01',
    descricao: 'Serviço de limpeza predial',
    valorTotal: 100000,
    origemRecurso: '231796',
    dimensao: 'Administração',
    componenteFuncional: 'Serviços Terceirizados',
    planoInterno: 'L20RLP0100N',
    naturezaDespesa: '339037',
    tipoAtividade: 'campus',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'atv-2',
    atividade: 'Atividade 02',
    descricao: 'Material de escritório e consumo',
    valorTotal: 30000,
    origemRecurso: '231796',
    dimensao: 'Administração',
    componenteFuncional: 'Material de Consumo',
    planoInterno: 'L20RLP0200N',
    naturezaDespesa: '339030',
    tipoAtividade: 'campus',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'atv-3',
    atividade: 'Atividade 03',
    descricao: 'Aquisição de equipamentos de TI',
    valorTotal: 50000,
    origemRecurso: '261941',
    dimensao: 'TI',
    componenteFuncional: 'Infraestrutura',
    planoInterno: 'L20RLP0300N',
    naturezaDespesa: '449052',
    tipoAtividade: 'campus',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockEmpenhos: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2024NE000101',
    descricao: 'Limpeza mensal',
    valor: 40000,
    atividadeId: 'atv-1',
    origemRecurso: '231796',
    dimensao: 'Administração',
    componenteFuncional: 'Serviços Terceirizados',
    naturezaDespesa: '339037',
    tipo: 'exercicio',
    status: 'pendente',
    dataEmpenho: new Date('2024-02-01'),
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'emp-2',
    numero: '2024NE000102',
    descricao: 'Material de expediente',
    valor: 30000,
    atividadeId: 'atv-2',
    origemRecurso: '231796',
    dimensao: 'Administração',
    componenteFuncional: 'Material de Consumo',
    naturezaDespesa: '339030',
    tipo: 'exercicio',
    status: 'pago',
    dataEmpenho: new Date('2024-02-15'),
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-02-15'),
  },
];

describe('DashboardOrigemAtividadesModal', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o modal com cabeçalho, origem e métricas corretas', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    expect(screen.getByRole('heading', { name: /Atividades com Saldo da Origem/i })).toBeInTheDocument();
    expect(screen.getByText(/Origem \/ PTRES: 231796/i)).toBeInTheDocument();

    // Cards de resumo
    expect(screen.getByText('Saldo Disponível')).toBeInTheDocument();
    expect(screen.getByText('Atividades c/ saldo')).toBeInTheDocument();
    // Saldo da origem 231796 = 60.000 + 0 = 60.000 (total planejado: 130.000, total empenhado: 70.000)
    expect(screen.getAllByText(/R\$\s*60\.000,00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*130\.000,00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*70\.000,00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('exibe exclusivamente as atividades com saldo > 0 por padrão', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    // Atividade 01 (saldo 60.000 > 0) deve estar visível
    expect(screen.getByText('Atividade 01')).toBeInTheDocument();
    expect(screen.getByText('Serviço de limpeza predial')).toBeInTheDocument();

    // Atividade 02 (saldo = 0) NÃO deve estar visível por padrão
    expect(screen.queryByText('Atividade 02')).not.toBeInTheDocument();

    // Atividade 03 (de outra origem 261941) NÃO deve estar visível
    expect(screen.queryByText('Atividade 03')).not.toBeInTheDocument();
  });

  it('permite alternar para exibir todas as atividades da origem ao desmarcar o filtro', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    const toggleButton = screen.getByRole('button', { name: /Apenas com saldo/i });
    fireEvent.click(toggleButton);

    // Agora ambas as atividades da origem 231796 devem estar visíveis
    expect(screen.getByText('Atividade 01')).toBeInTheDocument();
    expect(screen.getByText('Atividade 02')).toBeInTheDocument();
    expect(screen.getByText('Material de escritório e consumo')).toBeInTheDocument();
  });

  it('filtra atividades pelo campo de busca', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Buscar atividade, descrição, PI/i);
    fireEvent.change(searchInput, { target: { value: 'L20RLP0100N' } });

    expect(screen.getByText('Atividade 01')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Inexistente' } });
    expect(screen.queryByText('Atividade 01')).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhuma atividade com saldo remanescente nesta origem/i)).toBeInTheDocument();
  });

  it('abre os detalhes da atividade ao clicar no botão de ação', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    const detailButtons = screen.getAllByRole('button', { name: /Ver detalhes/i });
    fireEvent.click(detailButtons[0]);

    expect(screen.getByTestId('atividade-dialog')).toHaveTextContent('Atividade 01');
  });
});
