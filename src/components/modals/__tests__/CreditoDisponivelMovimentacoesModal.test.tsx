import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CreditoDisponivelMovimentacoesModal, isEmpenhoDoAno } from '../CreditoDisponivelMovimentacoesModal';
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
    id: 'emp-antigo',
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
    id: 'emp-recente',
    numero: '2026NE000456',
    descricao: 'Material de Consumo Recente',
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
    dataEmpenho: new Date('2026-03-25'),
    status: 'pendente',
    tipo: 'exercicio',
    createdAt: new Date('2026-03-25'),
    updatedAt: new Date('2026-03-25'),
  },
  {
    id: 'emp-rap-ano-anterior',
    numero: '2025NE000010',
    descricao: 'Empenho RAP de 2025',
    valor: 12000,
    dimensao: 'AD - Administração',
    origemRecurso: '231796',
    dataEmpenho: new Date('2025-11-20'),
    status: 'pendente',
    tipo: 'rap',
    createdAt: new Date('2025-11-20'),
    updatedAt: new Date('2025-11-20'),
  },
  {
    id: 'emp-outro-ptres',
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
  it('identifica corretamente empenhos do ano corrente e descarta RAPs/anos anteriores', () => {
    expect(isEmpenhoDoAno({ tipo: 'exercicio', numero: '2026NE000100' } as Empenho, 2026)).toBe(true);
    expect(isEmpenhoDoAno({ tipo: 'rap', numero: '2025NE000100' } as Empenho, 2026)).toBe(false);
    expect(isEmpenhoDoAno({ dataEmpenho: new Date('2026-04-01') } as Empenho, 2026)).toBe(true);
    expect(isEmpenhoDoAno({ dataEmpenho: new Date('2025-12-31') } as Empenho, 2026)).toBe(false);
    expect(isEmpenhoDoAno({ numero: '2025NE000500' } as Empenho, 2026)).toBe(false);
  });

  it('abre na aba de empenhos por padrão, exibindo apenas empenhos do ano ordenados do mais recente para o mais antigo', () => {
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

    // KPIs (exclui RAP de 12.000 da soma de empenhado do ano)
    expect(screen.getByText(/8\.303,94/)).toBeInTheDocument(); // Crédito Disponível no relatório
    expect(screen.getAllByText(/45\.000,00/).length).toBeGreaterThan(0); // Total Descentralizado (50.000 - 5.000)
    expect(screen.getAllByText(/25\.000,00/).length).toBeGreaterThan(0); // Empenhado no ano (20.000 + 5.000)

    // Aba padrão: Empenhos do Ano (2 empenhos do ano corrente)
    expect(screen.getByRole('tab', { name: /Empenhos do Ano \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText('2026NE000456')).toBeInTheDocument(); // Mais recente (25/03/2026)
    expect(screen.getByText('Material de Consumo Recente')).toBeInTheDocument();
    expect(screen.getByText('2026NE000123')).toBeInTheDocument(); // Mais antigo (10/03/2026)
    expect(screen.getByText('Serviços de TI PROAD')).toBeInTheDocument();

    // Não deve conter RAP de 2025 nem empenho de outro PTRES
    expect(screen.queryByText('2025NE000010')).not.toBeInTheDocument();
    expect(screen.queryByText('2026NE000999')).not.toBeInTheDocument();

    // Verifica a ordem das linhas de empenho: a primeira deve ser 2026NE000456
    const empenhoRows = screen.getAllByRole('row');
    const tableText = empenhoRows.map((r) => r.textContent).join(' ');
    const posRecente = tableText.indexOf('2026NE000456');
    const posAntigo = tableText.indexOf('2026NE000123');
    expect(posRecente).toBeLessThan(posAntigo);
  });

  it('alterna para a aba de descentralizações e exibe as notas de crédito daquele PTRES', () => {
    render(
      <CreditoDisponivelMovimentacoesModal
        open={true}
        onOpenChange={vi.fn()}
        selectedRow={sampleRow}
        descentralizacoes={sampleDescentralizacoes}
        empenhos={sampleEmpenhos}
      />,
    );

    // Clica na aba de descentralizações
    const descTab = screen.getByRole('tab', { name: /Descentralizações/i });
    fireEvent.mouseDown(descTab, { button: 0, ctrlKey: false });

    expect(screen.getByText('2026NC000100')).toBeInTheDocument();
    expect(screen.getByText('Descentralização inicial PROAD')).toBeInTheDocument();
    expect(screen.getByText(/50\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/-R\$[\s\u00a0]*5\.000,00/)).toBeInTheDocument();
    expect(screen.queryByText('2026NC000200')).not.toBeInTheDocument(); // Outro PTRES
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

    // Inicialmente na aba de empenhos, mostra os 2 empenhos do ano
    expect(screen.getByText('2026NE000456')).toBeInTheDocument();
    expect(screen.getByText('2026NE000123')).toBeInTheDocument();

    // Clica no filtro "Apenas PI L20RLP01ADN"
    fireEvent.click(screen.getByRole('button', { name: /Apenas PI L20RLP01ADN/i }));

    expect(screen.getByText('2026NE000123')).toBeInTheDocument();
    expect(screen.queryByText('2026NE000456')).not.toBeInTheDocument();
  });

  it('ordena a lista de empenhos sequencialmente pelo número da NE de forma estritamente decrescente (ex: 85, 84, 10, 7, 6, 5, 2)', () => {
    const empenhosListaSeq: Empenho[] = [
      { id: '1', numero: '2026NE000010', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '2', numero: '2026NE000007', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '3', numero: '2026NE000002', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '4', numero: '2026NE000006', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '5', numero: '2026NE000005', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '6', numero: '2026NE000084', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
      { id: '7', numero: '2026NE000085', tipo: 'exercicio', valor: 100, origemRecurso: '231796' } as Empenho,
    ];

    render(
      <CreditoDisponivelMovimentacoesModal
        open={true}
        onOpenChange={vi.fn()}
        selectedRow={sampleRow}
        descentralizacoes={[]}
        empenhos={empenhosListaSeq}
      />,
    );

    const rows = screen.getAllByRole('row');
    const fullText = rows.map((r) => r.textContent).join(' ');

    const pos85 = fullText.indexOf('2026NE000085');
    const pos84 = fullText.indexOf('2026NE000084');
    const pos10 = fullText.indexOf('2026NE000010');
    const pos07 = fullText.indexOf('2026NE000007');
    const pos06 = fullText.indexOf('2026NE000006');
    const pos05 = fullText.indexOf('2026NE000005');
    const pos02 = fullText.indexOf('2026NE000002');

    expect(pos85).toBeLessThan(pos84);
    expect(pos84).toBeLessThan(pos10);
    expect(pos10).toBeLessThan(pos07);
    expect(pos07).toBeLessThan(pos06);
    expect(pos06).toBeLessThan(pos05);
    expect(pos05).toBeLessThan(pos02);
  });
});
