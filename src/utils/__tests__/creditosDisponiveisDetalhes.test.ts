import {
  aggregateCreditoDisponivelRows,
  parseCreditoDisponivelTable,
} from '@/utils/creditosDisponiveisDetalhes';

describe('creditosDisponiveisDetalhes', () => {
  it('le o layout detalhado com PI, descricao e valor em coluna sem cabecalho', () => {
    const rows = parseCreditoDisponivelTable([
      ['PTRES', 'PI', '', 'Métrica', ''],
      ['230446', 'CFF53M9601N', 'PNAE - ALIMENTACAO ESCOLAR - ENSINO MEDIO', 'Saldo - Moeda Origem', '75.867,00'],
      ['231796', 'L20RLP19ENN', 'PROEN-ACOES DO ENSINO', 'Saldo - Moeda Origem', '0,00'],
    ]);

    expect(rows).toEqual([
      {
        ptres: '230446',
        planoInterno: 'CFF53M9601N',
        descricao: 'PNAE - ALIMENTACAO ESCOLAR - ENSINO MEDIO',
        metrica: 'Saldo - Moeda Origem',
        valor: 75867,
      },
      {
        ptres: '231796',
        planoInterno: 'L20RLP19ENN',
        descricao: 'PROEN-ACOES DO ENSINO',
        metrica: 'Saldo - Moeda Origem',
        valor: 0,
      },
    ]);
  });

  it('continua aceitando o layout agregado anterior e soma por PTRES', () => {
    const rows = parseCreditoDisponivelTable([
      ['PTRES', 'Metrica', 'Valor'],
      ['231796', 'Disponivel', '100,00'],
      ['231796', 'Disponivel', '64.719,67'],
    ]);

    expect(aggregateCreditoDisponivelRows(rows)).toEqual([
      {
        ptres: '231796',
        metrica: 'Disponivel',
        valor: 64819.67,
      },
    ]);
  });

  it('descarta linha sem valor parseavel sem descartar saldo zero', () => {
    expect(
      parseCreditoDisponivelTable([
        ['PTRES', 'PI', '', 'Metrica', ''],
        ['231796', 'PI-1', 'Sem valor', 'Saldo', ''],
        ['231798', 'PI-2', 'Invalido', 'Saldo', 'abc'],
        ['231802', 'PI-3', 'Zerado', 'Saldo', '0,00'],
      ]),
    ).toEqual([
      {
        ptres: '231802',
        planoInterno: 'PI-3',
        descricao: 'Zerado',
        metrica: 'Saldo',
        valor: 0,
      },
    ]);
  });
});
