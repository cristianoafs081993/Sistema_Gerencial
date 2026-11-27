// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  getOrigensDePessoal,
  getOrigensDoPlano,
  isEmpenhoDePessoal,
  splitEmpenhosPorPlano,
  summarizeEmpenhosForaDoPlano,
} from '@/utils/empenhosForaDoPlano';

const empenho = (origemRecurso: string, valor: number, valorPagoOficial = 0, descricao = '') =>
  ({ origemRecurso, valor, valorPagoOficial, descricao });

describe('empenhos fora do plano (TED e fontes externas)', () => {
  // Caso real de Natal Cidade Alta (27/11/2026): NEs de TED para a FUNCERN em PTRES sem atividade planejada.
  it('compara com o planejado só os PTRES que constam do plano do campus', () => {
    const origens = getOrigensDoPlano([{ origemRecurso: '231796' }, { origemRecurso: ' 231802 ' }]);
    const { noPlano, foraDoPlano } = splitEmpenhosPorPlano([
      empenho('231796', 1000),
      empenho('231802', 500),
      empenho('260596', 2951047),
      empenho('235435', 822100),
    ], origens);

    expect(noPlano.map((item) => item.valor)).toEqual([1000, 500]);
    expect(foraDoPlano.map((item) => item.origemRecurso)).toEqual(['260596', '235435']);
  });

  it('mantém tudo no empenhado quando o campus ainda não tem plano sincronizado', () => {
    const empenhos = [empenho('260596', 10)];
    expect(splitEmpenhosPorPlano(empenhos, new Set())).toEqual({ noPlano: empenhos, foraDoPlano: [] });
  });

  it('resume por PTRES, do maior para o menor', () => {
    const resumo = summarizeEmpenhosForaDoPlano([
      empenho('235435', 600000, 600000, 'Saberes do Campo'),
      empenho('260596', 1599970.33, 1599970.33, 'Do Território à Mesa'),
      empenho('235435', 822100, 0),
    ]);

    expect(resumo).toMatchObject({ quantidade: 3, empenhado: 3022070.33, pago: 2199970.33 });
    expect(resumo.porOrigem.map((item) => [item.origem, item.quantidade])).toEqual([['260596', 1], ['235435', 2]]);
    expect(resumo.porOrigem[1].descricao).toBe('Saberes do Campo');
  });
});

describe('folha e benefícios da Reitoria', () => {
  // Reitoria 27/11/2026: PTRES 171158 planejado R$ 607,7 mi x empenhado R$ 635,8 mi por suplementação da folha.
  it('marca como pessoal só os PTRES planejados exclusivamente pela DIGPE', () => {
    const origens = getOrigensDePessoal([
      { origemRecurso: '171158', suapUnitCode: '6' },
      { origemRecurso: '215697', suapUnitCode: '6' },
      { origemRecurso: '171166', suapUnitCode: '6' },
      { origemRecurso: '171166', suapUnitCode: '5' },
      { origemRecurso: '231796', suapUnitCode: '12' },
    ]);

    expect([...origens].sort()).toEqual(['171158', '215697']);
  });

  it('trata natureza 31 como pessoal mesmo fora dos PTRES da DIGPE', () => {
    const origens = new Set(['171158']);
    expect(isEmpenhoDePessoal({ origemRecurso: '171158', naturezaDespesa: '339046' }, origens)).toBe(true);
    expect(isEmpenhoDePessoal({ origemRecurso: '999999', naturezaDespesa: '319011' }, origens)).toBe(true);
    expect(isEmpenhoDePessoal({ origemRecurso: '231796', naturezaDespesa: '339039' }, origens)).toBe(false);
  });
});
