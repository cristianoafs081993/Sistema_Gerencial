// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getOrigensDoPlano, splitEmpenhosPorPlano, summarizeEmpenhosForaDoPlano } from '@/utils/empenhosForaDoPlano';

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
