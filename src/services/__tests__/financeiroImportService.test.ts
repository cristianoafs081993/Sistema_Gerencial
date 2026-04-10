import {
  aggregateFinanceiroDisponivel,
  parseFinanceiroCsv,
  type FinanceiroRegistro,
} from '@/services/financeiroImportService';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

function createCsvFile(content: string, name = 'financeiro.csv') {
  const file = new File([content], name, { type: 'text/csv' });
  const buffer = new TextEncoder().encode(content).buffer;
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(buffer),
  });
  return file;
}

describe('financeiroImportService', () => {
  it('faz parse do CSV financeiro localizando o cabecalho e convertendo valores monetarios', async () => {
    const file = createCsvFile(
      [
        'linha ignorada;;;;;;;',
        'UG Executora;Nome UG;Mes Lancamento;Fonte;Fonte Desc;Vinculacao;Vinculacao Desc;Saldo - R$',
        '153103;Reitoria;MAR/2026;0100;Tesouro;144;Custeio;1.234,56',
        '153103;Reitoria;MAR/2026;0100;Tesouro;188;Investimento;200,00',
      ].join('\n'),
    );

    const rows = await parseFinanceiroCsv(file);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      ugCodigo: '153103',
      ugNome: 'Reitoria',
      fonteCodigo: '0100',
      fonteDescricao: 'Tesouro',
      vinculacaoCodigo: '144',
      vinculacaoDescricao: 'Custeio',
      saldo: 1234.56,
    });
    expect(rows[0]?.mesLancamento).toEqual(expect.any(String));
    expect(rows[0]?.mesLancamento).not.toHaveLength(0);

    expect(rows[1]).toMatchObject({
      ugCodigo: '153103',
      ugNome: 'Reitoria',
      fonteCodigo: '0100',
      fonteDescricao: 'Tesouro',
      vinculacaoCodigo: '188',
      vinculacaoDescricao: 'Investimento',
      saldo: 200,
    });
    expect(rows[1]?.mesLancamento).toEqual(expect.any(String));
    expect(rows[1]?.mesLancamento).not.toHaveLength(0);
  });

  it('agrega os cards por fonte e vinculacao somando os saldos', () => {
    const rows: FinanceiroRegistro[] = [
      {
        ugCodigo: '153103',
        ugNome: 'Reitoria',
        mesLancamento: 'MAR/2026',
        fonteCodigo: '0100',
        fonteDescricao: 'Tesouro',
        vinculacaoCodigo: '144',
        vinculacaoDescricao: 'Custeio',
        saldo: 100,
      },
      {
        ugCodigo: '153103',
        ugNome: 'Reitoria',
        mesLancamento: 'ABR/2026',
        fonteCodigo: '0100',
        fonteDescricao: 'Tesouro',
        vinculacaoCodigo: '144',
        vinculacaoDescricao: 'Custeio',
        saldo: 50,
      },
      {
        ugCodigo: '153103',
        ugNome: 'Reitoria',
        mesLancamento: 'MAR/2026',
        fonteCodigo: '0200',
        fonteDescricao: 'Convenio',
        vinculacaoCodigo: '188',
        vinculacaoDescricao: 'Investimento',
        saldo: 200,
      },
    ];

    expect(aggregateFinanceiroDisponivel(rows)).toEqual([
      {
        fonteCodigo: '0200',
        fonteDescricao: 'Convenio',
        vinculacaoCodigo: '188',
        vinculacaoDescricao: 'Investimento',
        saldoDisponivel: 200,
      },
      {
        fonteCodigo: '0100',
        fonteDescricao: 'Tesouro',
        vinculacaoCodigo: '144',
        vinculacaoDescricao: 'Custeio',
        saldoDisponivel: 150,
      },
    ]);
  });
});
