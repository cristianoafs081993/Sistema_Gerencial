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
    saldoDisponivel: 55000,
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
    saldoDisponivel: 0,
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
    expect(screen.getByText('Saldo Disponível (SUAP)')).toBeInTheDocument();
    expect(screen.getByText('Atividades exibidas')).toBeInTheDocument();
    // O saldo oficial do SUAP prevalece sobre o calculo planejado - empenhado (55.000 vs. 60.000).
    expect(screen.getAllByText(/R\$\s*55\.000,00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*100\.000,00/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/R\$\s*40\.000,00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('mantem os cards financeiros iguais ao total das linhas exibidas', () => {
    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        atividades={mockAtividades}
        empenhos={mockEmpenhos}
      />,
    );

    // Com o filtro padrao, card e rodape representam a mesma linha e o saldo oficial do SUAP.
    expect(screen.getByText('Atividades exibidas:').parentElement).toHaveTextContent('1');
    expect(screen.getAllByText(/R\$\s*100\.000,00/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/R\$\s*40\.000,00/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/R\$\s*55\.000,00/i).length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: /Apenas com saldo/i }));

    // Ao exibir todas, o mesmo contrato continua valendo para todas as linhas.
    expect(screen.getByText('Atividades exibidas:').parentElement).toHaveTextContent('2');
    expect(screen.getAllByText(/R\$\s*130\.000,00/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/R\$\s*70\.000,00/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/R\$\s*55\.000,00/i).length).toBeGreaterThanOrEqual(2);
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

  it('correlaciona empenhos SIAFI sem atividadeId por processo, descrição e siglas garantindo saldos corretos', () => {
    const atividadesSiafi: Atividade[] = [
      {
        id: 'atv-pafe-siafi',
        atividade: 'Programa de Apoio à Formação Estudantil (PAFE)',
        descricao: 'Programa de Apoio à Formação Estudantil (PAFE)',
        valorTotal: 110000,
        origemRecurso: '231802',
        planoInterno: 'L2994P23AEN - DIAE-Ações de assistência estudantil - Aux. bolsas e outras despesas',
        naturezaDespesa: '339018',
        dimensao: 'AE',
        componenteFuncional: 'Atividades Estudantis',
        tipoAtividade: 'campus',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'atv-transporte-siafi',
        atividade: 'Programa de Auxílio Transporte',
        descricao: 'Programa de Auxílio Transporte',
        valorTotal: 94377.12,
        origemRecurso: '231802',
        planoInterno: 'L2994P23AEN - DIAE-Ações de assistência estudantil - Aux. bolsas e outras despesas',
        naturezaDespesa: '339018',
        dimensao: 'AE',
        componenteFuncional: 'Atividades Estudantis',
        tipoAtividade: 'campus',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const empenhosSiafi: Empenho[] = [
      {
        id: 'emp-pafe-1',
        numero: '2026NE000012',
        descricao: 'RECURSO PARA PAGAMENTO DE BOLSA PAFE, CONFORME PROCESSO 23035.000591.2026-61',
        valor: 53100,
        origemRecurso: '231802',
        planoInterno: 'L2994P23AEN',
        naturezaDespesa: '339018',
        tipo: 'exercicio',
        status: 'pendente',
        dataEmpenho: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'emp-transporte-1',
        numero: '2026NE000013',
        descricao: 'RECURSO PARA PAGAMENTO DE AUXILIO TRANSPORTE, CONFORME PROCESSO 23035.000593.2026-50',
        valor: 83258,
        origemRecurso: '231802',
        planoInterno: 'L2994P23AEN',
        naturezaDespesa: '339018',
        tipo: 'exercicio',
        status: 'pendente',
        dataEmpenho: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(
      <DashboardOrigemAtividadesModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231802"
        atividades={atividadesSiafi}
        empenhos={empenhosSiafi}
      />,
    );

    // PAFE deve exibir saldo de R$ 56.900,00 (110.000 - 53.100) e NÃO R$ 110.000,00
    expect(screen.getByText(/R\$\s*56\.900,00/i)).toBeInTheDocument();
    // Auxílio transporte deve exibir saldo de R$ 11.119,12 (94.377,12 - 83.258)
    expect(screen.getByText(/R\$\s*11\.119,12/i)).toBeInTheDocument();
    // O código do PI deve ser exibido de forma limpa
    expect(screen.getAllByText(/PI:\s*L2994P23AEN/i).length).toBeGreaterThanOrEqual(1);
  });
});
