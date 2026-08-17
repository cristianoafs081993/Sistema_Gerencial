import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DashboardRapOrigemEmpenhosModal } from '../DashboardRapOrigemEmpenhosModal';
import type { Empenho } from '@/types';

vi.mock('@/components/modals/EmpenhoDialog', () => ({
  EmpenhoDialog: ({ open, empenho }: { open: boolean; empenho: Empenho | null }) =>
    open && empenho ? <div data-testid="empenho-dialog">{empenho.numero}</div> : null,
}));

const mockEmpenhos: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2024NE000101',
    descricao: 'Serviço de vigilância armada',
    valor: 100000,
    origemRecurso: '231796',
    dimensao: 'D1',
    componenteFuncional: 'CF1',
    naturezaDespesa: '339037',
    favorecidoNome: 'EMPRESA ALFA SERVICOS LTDA',
    favorecidoDocumento: '12345678000199',
    processo: '23000.001234/2024-11',
    planoInterno: 'M2345N0000N',
    tipo: 'rap',
    rapInscrito: 100000,
    rapPago: 60000,
    saldoRapOficial: 40000,
    dataEmpenho: new Date('2024-03-01'),
    status: 'pendente',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: 'emp-2',
    numero: '2024NE000102',
    descricao: 'Aquisição de material de consumo',
    valor: 20000,
    origemRecurso: '231796',
    dimensao: 'D1',
    componenteFuncional: 'CF1',
    naturezaDespesa: '339030',
    favorecidoNome: 'COMERCIAL BETA LTDA',
    favorecidoDocumento: '98765432000188',
    processo: '23000.005678/2024-22',
    tipo: 'rap',
    rapInscrito: 20000,
    rapPago: 20000,
    saldoRapOficial: 0,
    dataEmpenho: new Date('2024-04-10'),
    status: 'pago',
    createdAt: new Date('2024-04-10'),
    updatedAt: new Date('2024-04-10'),
  },
  {
    id: 'emp-3',
    numero: '2024NE000201',
    descricao: 'Outro empenho de origem diferente',
    valor: 50000,
    origemRecurso: '231799',
    dimensao: 'D2',
    componenteFuncional: 'CF2',
    naturezaDespesa: '339039',
    favorecidoNome: 'GAMA TECNOLOGIA',
    tipo: 'rap',
    rapInscrito: 50000,
    rapPago: 10000,
    saldoRapOficial: 40000,
    dataEmpenho: new Date('2024-05-15'),
    status: 'pendente',
    createdAt: new Date('2024-05-15'),
    updatedAt: new Date('2024-05-15'),
  },
];

describe('DashboardRapOrigemEmpenhosModal', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o modal com cabeçalho, origem e métricas corretas', () => {
    render(
      <DashboardRapOrigemEmpenhosModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        empenhos={mockEmpenhos}
        rapReferenceYear={2026}
      />,
    );

    expect(screen.getByRole('heading', { name: /Empenhos de Restos a Pagar com Saldo/i })).toBeInTheDocument();
    expect(screen.getByText(/Origem \/ PTRES: 231796/i)).toBeInTheDocument();

    // Cards de resumo
    expect(screen.getByText('Saldo Atual Total')).toBeInTheDocument();
    // Saldo da origem 231796 = 40.000 + 0 = 40.000 (aparece no KPI card, na linha da tabela e no rodapé)
    expect(screen.getAllByText(/R\$\s*40\.000,00/i).length).toBeGreaterThanOrEqual(1);
  });

  it('exibe exclusivamente os empenhos com saldo > 0', () => {
    render(
      <DashboardRapOrigemEmpenhosModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        empenhos={mockEmpenhos}
        rapReferenceYear={2026}
      />,
    );

    // NE com saldo > 0 deve estar visível
    expect(screen.getByText('2024NE000101')).toBeInTheDocument();
    expect(screen.getByText('EMPRESA ALFA SERVICOS LTDA')).toBeInTheDocument();

    // NE com saldo = 0 não deve estar visível
    expect(screen.queryByText('2024NE000102')).not.toBeInTheDocument();

    // NE de outra origem não deve estar visível
    expect(screen.queryByText('2024NE000201')).not.toBeInTheDocument();
  });



  it('abre os detalhes do empenho ao clicar no botão de ação', () => {
    render(
      <DashboardRapOrigemEmpenhosModal
        open={true}
        onOpenChange={onOpenChange}
        origem="231796"
        empenhos={mockEmpenhos}
        rapReferenceYear={2026}
      />,
    );

    const detailButtons = screen.getAllByRole('button', { name: /Ver detalhes/i });
    fireEvent.click(detailButtons[0]);

    expect(screen.getByTestId('empenho-dialog')).toHaveTextContent('2024NE000101');
  });
});
