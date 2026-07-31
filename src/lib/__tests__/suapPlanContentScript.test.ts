import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

type PlanContentHelpers = {
  parseCurrency: (value: string) => number;
  buildDirectPlanSummary: (atividades: unknown[], descentralizacoes: unknown[], empenhos: unknown[]) => {
    planId: number;
    dimensoes: Array<{ totalPlanejado: number; totalDescentralizado: number; aDescentralizar: number; totalEmpenhado: number; aEmpenhar: number }>;
  };
  applyBalanceFilter: (enabled: boolean) => unknown[];
  renderSummary: (summary: unknown) => void;
};

let helpers: PlanContentHelpers;
let planSummaryScript = '';

beforeAll(() => {
  (window as typeof window & { __SIAGES_SUAP_PLAN_TEST__?: boolean }).__SIAGES_SUAP_PLAN_TEST__ = true;
  planSummaryScript = readFileSync(
    resolve(process.cwd(), 'suap-atividades-extension/plan-summary.js'),
    'utf8',
  );
  window.eval(planSummaryScript);
  helpers = (window as typeof window & { __siagesSuapPlanSummary: PlanContentHelpers }).__siagesSuapPlanSummary;
});

describe('plan-summary content script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <h2>EN - Ensino</h2>
        <article class="atividade"><span>Saldo disponível para empenho da atividade (R$)</span><strong>R$ 12,50</strong></article>
        <article class="atividade"><span>Saldo disponível para empenho da atividade (R$)</span><strong>R$ 0,00</strong></article>
      </main>`;
  });

  it('interpreta moeda brasileira e filtra/restaura somente atividades sem saldo', () => {
    expect(helpers.parseCurrency('R$ 1.234,56')).toBe(1234.56);
    expect(helpers.parseCurrency('R$ -10,00')).toBe(-10);

    helpers.applyBalanceFilter(true);
    const activities = document.querySelectorAll<HTMLElement>('.atividade');
    expect(activities[0].hidden).toBe(false);
    expect(activities[1].hidden).toBe(true);

    helpers.applyBalanceFilter(false);
    expect(activities[0].hidden).toBe(false);
    expect(activities[1].hidden).toBe(false);
  });

  it('agrega os registros consultados diretamente no banco com o JWT da extensão', () => {
    const summary = helpers.buildDirectPlanSummary(
      [{ id: 'a1', dimensao: 'EN - Ensino', atividade: 'Ação', descricao: 'Teste', componente_funcional: 'Ensino', origem_recurso: '171', plano_interno: 'PIEN', valor_total: 100 }],
      [{ id: 'd1', dimensao: 'EN', origem_recurso: '171', valor: 60 }],
      [{ id: 'e1', dimensao: 'EN', numero: '2026NE1', descricao: 'Empenho', origem_recurso: '171', data_empenho: '2026-01-10', status: 'pago', tipo: 'exercicio', valor: 25 }],
    );

    expect(summary).toEqual(expect.objectContaining({ planId: 8 }));
    expect(summary.dimensoes[0]).toEqual(expect.objectContaining({
      totalPlanejado: 100,
      totalDescentralizado: 60,
      aDescentralizar: 40,
      totalEmpenhado: 25,
      aEmpenhar: 35,
    }));
  });

  it('expande o drill-down de atividades com saldo ao clicar na métrica', () => {
    helpers.renderSummary({
      planId: 8,
      dimensoes: [{
        key: 'EN', dimensao: 'EN - Ensino', totalPlanejado: 100, totalDescentralizado: 50,
        aDescentralizar: 50, totalEmpenhado: 20, aEmpenhar: 30,
        atividades: [{ id: 'a1', atividade: 'Atividade no SUAP', descricao: 'Teste', componenteFuncional: 'Ensino', origemRecurso: '171', planoInterno: 'PIEN', valor: 100 }],
        descentralizacoes: [], empenhos: [],
      }],
    });
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.siages-plan-value'));
    buttons[2].click();

    expect(document.querySelector('.siages-plan-detail-panel')?.textContent).toContain('Atividades com saldo disponível para empenho');
    expect(document.querySelector('.siages-plan-detail-panel')?.textContent).toContain('R$ 12,50');
  });

  it('substitui a injecao anterior sem duplicar o painel', () => {
    helpers.renderSummary({ planId: 8, dimensoes: [] });
    window.eval(planSummaryScript);
    helpers = (window as typeof window & { __siagesSuapPlanSummary: PlanContentHelpers }).__siagesSuapPlanSummary;
    helpers.renderSummary({ planId: 8, dimensoes: [] });

    expect(document.querySelectorAll('#siages-suap-plan-summary')).toHaveLength(1);
  });
});
