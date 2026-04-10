import {
  cleanValor,
  matchAndLink,
  safeFormatDate,
} from '@/services/pfImportService';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

describe('pfImportService', () => {
  it('normaliza valor monetario e datas para comparacao', () => {
    expect(cleanValor('R$ 1.234,56')).toBe(1234.56);
    expect(cleanValor('')).toBe(0);
    expect(safeFormatDate('18/03/2026 10:00')).toBe('2026-03-18');
    expect(safeFormatDate(new Date('2026-03-18T00:00:00Z'))).toBe('2026-03-18');
  });

  it('vincula solicitacao, aprovacao e liberacao compatveis por valor, tipo e data', () => {
    const solicitacoes = [
      {
        PF: '153103000000001234PF000001',
        'PF - Ação': '1',
        'PF - Evento': '591292',
        'PF - Valor Linha': '1.000,00',
        'Emissão - Dia': '10/03/2026',
        valor_num: 1000,
      },
    ];

    const pfs = [
      {
        PF: '153103000000001235PF000002',
        'PF - Ação': '3',
        'PF - Evento': '591290',
        'PF - Valor Linha': '1.000,00',
        'Emissão - Dia': '12/03/2026',
        valor_num: 1000,
      },
      {
        PF: '153103000000001236PF000003',
        'PF - Ação': '7',
        'PF - Evento': '561611',
        'PF - Valor Linha': '1.000,00',
        'Emissão - Dia': '12/03/2026',
        valor_num: 1000,
      },
    ];

    expect(matchAndLink(solicitacoes, pfs)).toEqual([
      {
        s: solicitacoes[0],
        a: pfs[0],
        l: pfs[1],
      },
    ]);
  });

  it('mantem solicitacao sem aprovacao quando nao houver PF compativel', () => {
    const solicitacoes = [
      {
        PF: '153103000000001234PF000001',
        'PF - Ação': '1',
        'PF - Evento': '591296',
        'PF - Valor Linha': '500,00',
        'Emissão - Dia': '10/03/2026',
        valor_num: 500,
      },
    ];

    const pfs = [
      {
        PF: '153103000000001235PF000002',
        'PF - Ação': '3',
        'PF - Evento': '591290',
        'PF - Valor Linha': '500,00',
        'Emissão - Dia': '09/03/2026',
        valor_num: 500,
      },
    ];

    expect(matchAndLink(solicitacoes, pfs)).toEqual([
      {
        s: solicitacoes[0],
        a: null,
        l: null,
      },
    ]);
  });
});
