import {
  buildDescentralizacaoSummaryRows,
  getFilteredDescentralizacaoSummaryTotal,
  normalizeContaDescentralizacaoImportRows,
} from '@/utils/descentralizacoesContaSaldos';

describe('descentralizacoesContaSaldos', () => {
  it('agrega o upload da conta por PTRES', () => {
    expect(
      normalizeContaDescentralizacaoImportRows([
        { ptres: '231796', metrica: 'Saldo - Moeda Origem (Conta Contabil)', valor: '100,00' },
        { ptres: '231796', metrica: 'Saldo - Moeda Origem (Conta Contabil)', valor: '25,50' },
        { ptres: '261941', metrica: 'Saldo - Moeda Origem (Conta Contabil)', valor: '10,00' },
      ]),
    ).toEqual([
      {
        ptres: '231796',
        metrica: 'Saldo - Moeda Origem (Conta Contabil)',
        valor: 125.5,
      },
      {
        ptres: '261941',
        metrica: 'Saldo - Moeda Origem (Conta Contabil)',
        valor: 10,
      },
    ]);
  });

  it('usa o saldo da conta para o total por PTRES e reparte por dimensao conforme os lancamentos atuais', () => {
    const resumo = buildDescentralizacaoSummaryRows({
      descentralizacoes: [
        {
          id: 'desc-ad',
          dimensao: 'AD - Administracao',
          origemRecurso: '231796',
          planoInterno: 'L20RLP01ADN',
          valor: 75,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
        {
          id: 'desc-en',
          dimensao: 'EN - Ensino',
          origemRecurso: '231796',
          planoInterno: 'L20RLP19ENN',
          valor: 25,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
      contaSaldos: [
        {
          id: 'conta-1',
          ptres: '231796',
          metrica: 'Saldo - Moeda Origem (Conta Contabil)',
          valor: 200,
          updatedAt: '2026-04-15T10:00:00.000Z',
        },
      ],
    });

    expect(resumo).toEqual([
      {
        dimensao: 'AD - Administração',
        origemRecurso: '231796',
        valor: 150,
      },
      {
        dimensao: 'EN - Ensino',
        origemRecurso: '231796',
        valor: 50,
      },
    ]);

    expect(
      getFilteredDescentralizacaoSummaryTotal({
        rows: resumo,
        filterDimensao: 'all',
        filterOrigem: '231796',
      }),
    ).toBe(200);

    expect(
      getFilteredDescentralizacaoSummaryTotal({
        rows: resumo,
        filterDimensao: 'EN',
        filterOrigem: 'all',
      }),
    ).toBe(50);
  });

  it('mantem o comportamento antigo quando nao houver saldo de conta importado', () => {
    const resumo = buildDescentralizacaoSummaryRows({
      descentralizacoes: [
        {
          id: 'desc-en',
          dimensao: '',
          origemRecurso: '231802',
          planoInterno: 'L20RLP19ENN',
          valor: 40,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
      contaSaldos: [],
    });

    expect(resumo).toEqual([
      {
        dimensao: 'EN - Ensino',
        origemRecurso: '231802',
        valor: 40,
      },
    ]);
  });
});
