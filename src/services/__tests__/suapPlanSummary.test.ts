import { describe, expect, it } from 'vitest';

import { buildSuapPlanSummary } from '@/services/suapPlanSummary';
import type { Atividade, Descentralizacao, Empenho } from '@/types';

const date = new Date('2026-03-12T00:00:00.000Z');

function atividade(overrides: Partial<Atividade> = {}): Atividade {
  return {
    id: 'atividade-1', dimensao: 'EN - Ensino', componenteFuncional: 'Ensino', tipoAtividade: 'sistemico',
    atividade: 'Laboratórios', descricao: 'Modernização de laboratórios', valorTotal: 1000,
    origemRecurso: '171', naturezaDespesa: '449052', planoInterno: 'PIEN', createdAt: date, updatedAt: date,
    ...overrides,
  };
}

function descentralizacao(overrides: Partial<Descentralizacao> = {}): Descentralizacao {
  return {
    id: 'descentralizacao-1', dimensao: 'EN', origemRecurso: '171', planoInterno: 'PIEN', valor: 800,
    createdAt: date, updatedAt: date, ...overrides,
  };
}

function empenho(overrides: Partial<Empenho> = {}): Empenho {
  return {
    id: 'empenho-1', numero: '2026NE000001', descricao: 'Compra de equipamentos', valor: 500,
    dimensao: 'EN', componenteFuncional: 'Ensino', origemRecurso: '171', naturezaDespesa: '449052',
    tipo: 'exercicio', dataEmpenho: date, status: 'pendente', createdAt: date, updatedAt: date,
    ...overrides,
  };
}

describe('buildSuapPlanSummary', () => {
  it('agrega por dimensão normalizada e reconcilia os detalhes com os totais', () => {
    const summary = buildSuapPlanSummary({
      atividades: [atividade(), atividade({ id: 'atividade-2', dimensao: 'Ensino', atividade: 'Biblioteca', valorTotal: 200 })],
      descentralizacoes: [descentralizacao(), descentralizacao({ id: 'descentralizacao-2', valor: -100, operacaoTipo: 'DEVOLUCAO' })],
      empenhos: [empenho()],
    });

    expect(summary).toMatchObject({ planId: 8 });
    expect(summary.dimensoes).toHaveLength(1);
    expect(summary.dimensoes[0]).toMatchObject({
      key: 'EN', totalPlanejado: 1200, totalDescentralizado: 700, aDescentralizar: 500,
      totalEmpenhado: 500, aEmpenhar: 200,
    });
    expect(summary.dimensoes[0].atividades).toHaveLength(2);
    expect(summary.dimensoes[0].descentralizacoes).toHaveLength(2);
    expect(summary.dimensoes[0].empenhos).toHaveLength(1);
  });

  it('não inclui RAP ou empenhos cancelados, mas preserva saldos negativos', () => {
    const summary = buildSuapPlanSummary({
      atividades: [],
      descentralizacoes: [descentralizacao({ valor: 100 })],
      empenhos: [
        empenho({ valor: 150 }),
        empenho({ id: 'rap-1', tipo: 'rap', valor: 900 }),
        empenho({ id: 'cancelado-1', status: 'cancelado', valor: 700 }),
      ],
    });

    expect(summary.dimensoes[0]).toMatchObject({
      totalPlanejado: 0, totalDescentralizado: 100, aDescentralizar: -100,
      totalEmpenhado: 150, aEmpenhar: -50,
    });
  });

  it('retorna um resumo vazio quando não há registros', () => {
    expect(buildSuapPlanSummary({ atividades: [], descentralizacoes: [], empenhos: [] })).toEqual({
      planId: 8,
      dimensoes: [],
    });
  });
});
