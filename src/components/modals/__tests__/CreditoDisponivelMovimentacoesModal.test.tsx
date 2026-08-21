import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreditoDisponivelMovimentacoesModal } from '../CreditoDisponivelMovimentacoesModal';
import type { Descentralizacao, Empenho } from '@/types';
import type { CreditoDisponivelDetalheRow } from '@/services/creditosDisponiveisDetalhes';

const sampleRow: CreditoDisponivelDetalheRow = {
  id: 'cred-1',
  ptres: '231796',
  planoInterno: 'L20RLP01ADN',
  descricao: 'PROAD-GESTAO ADMINISTRATIVA',
  metrica: 'Saldo',
  valor: 8303.94,
  importBatchId: 'batch-1',
  sourceFile: '3 - Crédito Disponível.csv',
  importedAt: '2026-05-26T13:00:00.000Z',
};

const sampleDescentralizacoes: Descentralizacao[] = [
  {
    id: 'desc-1',
    origemRecurso: '231796',
    dimensao: 'AD - Administração',
    notaCredito: '2026NC000100',
    naturezaDespesa: '339039',
    planoInterno: 'L20RLP01ADN',
    dataEmissao: new Date('2026-02-15'),
    descricao: 'Descentralização inicial PROAD',
    valor: 50000,
    createdAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-02-15'),
  },
  {
    id: 'desc-2',
    origemRecurso: '231796',
    dimensao: 'AD - Administração',
    notaCredito: '2026NC000105',
    operacaoTipo: 'DEVOLUCAO',
    naturezaDespesa: '339030',
    planoInterno: 'L20RLP60ADN',
    dataEmissao: new Date('2026-03-01'),
    descricao: 'Devolução de saldo não utilizado',
    valor: -5000,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  },
  {
    id: 'desc-outra',
    origemRecurso: '261941',
    dimensao: 'AE - Assistência Estudantil',
    notaCredito: '2026NC000200',
    dataEmissao: new Date('2026-02-20'),
    descricao: 'Outra origem',
    valor: 80000,
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20'),
  },
];

const sampleEmpenhos: Empenho[] = [
  {
    id: 'emp-1',
    numero: '2026NE000123',
    descricao: 'Serviços de TI PROAD',
    valor: 20000,
    dimensao: 'AD - Administração',
    componenteFuncional: 'Contratos',
    origemRecurso: '231796',
    naturezaDespesa: '339039',
    planoInterno: 'L20RLP01ADN',
    favorecidoNome: 'Empresa Alpha Tech',
    favorecidoDocumento: '12345678000199',
    valorLiquidado: 12000,
    valorPago: 10000,
    dataEmpenho: new Date('2026-03-10'),
    status: 'liquidado',
    tipo: 'exercicio',
    createdAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-03-10'),
  },
  {
    id: 'emp-2',
    numero: '2026NE000456',
    descricao: 'Material de Consumo',
    valor: 5000,
    dimensao: 'AD - Administração',
    componenteFuncional: 'Compras',
    origemRecurso: '231796',
    naturezaDespesa: '339030',
    planoInterno: 'L20RLP60ADN',
    favorecidoNome: 'Papelaria Central',
    favorecidoDocumento: '98765432000188',
    valorLiquidado: 0,
    valorPago: 0,
    dataEmpenho: new Date('2026-03-15'),
    status: 'pendente',
    tipo: 'exercicio',
    createdAt: new Date('2026-03-15'),
    updatedAt: new Date('2026-03-15'),
  },
  {
    id: 'emp-outro',
    numero: '2026NE000999',
    descricao: 'Empenho de outro PTRES',
    valor: 15000,
    dimensao: 'AE - Assistência',
    componenteFuncional: 'Assistência',
    origemRecurso: '261941',
    naturezaDespesa: '339018',
    favorecidoNome: 'Outro Fornecedor',
    dataEmpenho: new Date('2026-03-20'),
    status: 'pendente',
    tipo: 'exercicio',
    createdAt: new Date('2026-03-20'),
    updatedAt: new Date('2026-03-20'),
  },
];

describe('CreditoDisponivelMovimentacoesModal', () => {
  it('renderiza os KPIs e a listagem de descentralizações daquele PTRES', () => {
    render(
      <CreditoDisponivelMovimentacoesModal
        open={true}
        onOpenChange={vi.fn()}
        selectedRow={sampleRow}
        descentralizacoes={sampleDescentralizacoes}
        empenhos={sampleEmpenhos}
      />,
    );

    // Header & Badges
    expect(screen.getByText(/Movimentações da Origem \/ PTRES/i)).toBeInTheDocument();
    expect(screen.getByText('PTRES: 231796')).toBeInTheDocument();
    expect(screen.getAllByText(/L20RLP01ADN/).length).toBeGreaterThan(0);
    expect(screen.getByText('PROAD-GESTAO ADMINISTRATIVA')).toBeInTheDocument();

    // KPIs
    expect(screen.getByText(/8\.303,94/)).toBeInTheDocument(); // Crédito Disponível no relatório
    expect(screen.getAllByText(/45\.000,00/).length).toBeGreaterThan(0); // Total Descentralizado (50.000 - 5.000)
    expect(screen.getByText(/25\.000,00/)).toBeInTheDocument(); // Total Empenhado (20.000 + 5.000)

    // Tab Descentralizações (aba padrão)
    expect(screen.getByText('2026NC000100')).toBeInTheDocument();
    expect(screen.getByText('Descentralização inicial PROAD')).toBeInTheDocument();
    expect(screen.getByText(/50\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/-R\$[\s\u00a0]*5\.000,00/)).toBeInTheDocument();
    expect(screen.queryByText('2026NC000200')).not.toBeInTheDocument(); // De outro PTRES
  });

  it('alterna para a aba de empenhos e exibe as notas de empenho daquele PTRES', () => {
    render(
      <CreditoDisponivelMovimentacoesModal
        open={true}
        onOpenChange={vi.fn()}
        selectedRow={sampleRow}
        descentralizacoes={sampleDescentralizacoes}
        empenhos={sampleEmpenhos}
      />,
    );

    // Clica na aba de empenhos
    const empenhosTab = screen.getByRole('tab', { name: /Empenhos/i });
    fireEvent.mouseDown(empenhosTab, { button: 0, ctrlKey: false });

    expect(screen.getByText('2026NE000123')).toBeInTheDocument();
    expect(screen.getByText('Empresa Alpha Tech')).toBeInTheDocument();
    expect(screen.getByText('2026NE000456')).toBeInTheDocument();
    expect(screen.getByText('Papelaria Central')).toBeInTheDocument();
    expect(screen.queryByText('2026NE000999')).not.toBeInTheDocument(); // Outro PTRES
  });

  it('filtra pelo PI específico através do botão de filtro', () => {
    render(
      <CreditoDisponivelMovimentacoesModal
        open={true}
        onOpenChange={vi.fn()}
        selectedRow={sampleRow}
        descentralizacoes={sampleDescentralizacoes}
        empenhos={sampleEmpenhos}
      />,
    );

    // Inicialmente mostra as 2 descentralizações do PTRES 231796
    expect(screen.getByText('2026NC000100')).toBeInTheDocument();
    expect(screen.getByText('2026NC000105')).toBeInTheDocument();

    // Clica no filtro "Apenas PI L20RLP01ADN"
    fireEvent.click(screen.getByRole('button', { name: /Apenas PI L20RLP01ADN/i }));

    expect(screen.getByText('2026NC000100')).toBeInTheDocument();
    expect(screen.queryByText('2026NC000105')).not.toBeInTheDocument();
  });
});
