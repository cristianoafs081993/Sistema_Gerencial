import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type PlanContentHelpers = {
  parseCurrency: (value: string) => number;
  buildDirectPlanSummary: (atividades: unknown[], descentralizacoes: unknown[], empenhos: unknown[]) => {
    planId: number;
    dimensoes: Array<{ totalPlanejado: number; totalDescentralizado: number; aDescentralizar: number; totalEmpenhado: number; aEmpenhar: number }>;
  };
  applyBalanceFilter: (enabled: boolean) => unknown[];
  enhancePlanTables: () => { tableCount: number; visibleRows: number; totalRows: number };
  collectPlanDimensionSummary: () => Array<{ dimensao: string; valorAtualizado: number; valorEmpenhado: number; requisicoes: number; saldoDisponivel: number }>;
  renderPlanDimensionSummary: () => unknown;
  renderSummary: (summary: unknown) => void;
};

let helpers: PlanContentHelpers;
let planSummaryScript = '';

beforeAll(() => {
  (window as typeof window & { __SIAGES_SUAP_PLAN_TEST__?: boolean }).__SIAGES_SUAP_PLAN_TEST__ = true;
  planSummaryScript = readFileSync(extensionFixturePath('plan-summary.js'), 'utf8');
  window.eval(planSummaryScript);
  helpers = (window as typeof window & { __siagesSuapPlanSummary: PlanContentHelpers }).__siagesSuapPlanSummary;
});

describe('plan-summary content script', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <h2>EN - Ensino</h2>
        <article class="atividade"><span>Saldo disponivel para empenho da atividade (R$)</span><strong>R$ 12,50</strong></article>
        <article class="atividade"><span>Saldo disponivel para empenho da atividade (R$)</span><strong>R$ 0,00</strong></article>
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

  it('mantem filtro de saldo e ordenacao nos cabecalhos da tabela original', () => {
    document.body.innerHTML = `
      <main>
        <div class="search-and-filters"><form id="relatorioplanoatividade_form"><fieldset class="module aligned"><div class="form-row"><div class="field-box-first"><label>Unid. Administrativa:</label></div></div></fieldset></form></div>
        <div class="accordion"><div class="table-responsive"><table>
        <thead><tr><th>Atividade</th><th>Saldo disponivel para empenho da atividade (R$)</th></tr></thead>
        <tbody>
          <tr><td>Atividade C</td><td class="text-end">30,00</td></tr>
          <tr><td>Atividade A</td><td class="text-end">0,00</td></tr>
          <tr><td>Atividade B</td><td class="text-end">10,00</td></tr>
        </tbody>
      </table></div></div></main>`;

    expect(helpers.enhancePlanTables()).toMatchObject({ tableCount: 1, visibleRows: 3, totalRows: 3 });
    expect(document.querySelector('#siages-suap-plan-table-tools')).toBeNull();
    const balanceFilter = document.querySelector<HTMLInputElement>('#siages-suap-plan-balance-filter input[type="checkbox"]');
    expect(balanceFilter?.closest('form')?.id).toBe('relatorioplanoatividade_form');
    expect(balanceFilter?.parentElement?.textContent).toContain('Exibir somente atividades com saldo');

    const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    document.querySelector<HTMLButtonElement>('thead th .siages-plan-column-sort')!.click();
    expect(document.querySelector('tbody tr')?.textContent).toContain('Atividade A');

    balanceFilter!.click();
    expect(rows.find((row) => row.textContent?.includes('Atividade A'))?.hidden).toBe(true);
    expect(rows.find((row) => row.textContent?.includes('Atividade B'))?.hidden).toBe(false);
  });

  it('renderiza o resumo financeiro por dimensao abaixo da legenda', () => {
    document.body.innerHTML = `
      <main>
        <div class="accordion" id="legend"><div class="accordion-item"><h2 class="accordion-header"><button type="button">Legenda</button></h2><div class="accordion-collapse show"><div class="accordion-body">Legenda</div></div></div></div>
        <div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button type="button">AD - Administracao</button></h2><div class="table-responsive"><table><thead><tr><th>Atividade</th><th>Valor atualizado da atividade (R$)</th><th>Valor empenhado da atividade (R$)</th><th>Valor de requisicoes de despesas em tramitacao</th><th>Saldo disponivel para empenho da atividade (R$)</th></tr></thead><tbody>
          <tr><td>A</td><td>100,00</td><td>20,00</td><td>4,00</td><td>80,00</td></tr>
          <tr><td>B</td><td>50,00</td><td>10,00</td><td>6,00</td><td>40,00</td></tr>
        </tbody></table></div></div></div>
        <div class="accordion"><div class="accordion-item"><h2 class="accordion-header"><button type="button">EN - Ensino</button></h2><div class="table-responsive"><table><thead><tr><th>Atividade</th><th>Valor atualizado da atividade (R$)</th><th>Valor empenhado da atividade (R$)</th><th>Valor de requisi&#231;&#245;es de despesas em tramita&#231;&#227;o</th><th>Saldo disponivel para empenho da atividade (R$)</th></tr></thead><tbody>
          <tr><td>C</td><td>25,00</td><td>5,00</td><td>1,00</td><td>20,00</td></tr>
        </tbody></table></div></div></div>
      </main>`;

    helpers.enhancePlanTables();
    const dimensions = helpers.collectPlanDimensionSummary();
    expect(dimensions).toEqual([
      expect.objectContaining({ dimensao: 'AD - Administracao', valorAtualizado: 150, valorEmpenhado: 30, requisicoes: 10, saldoDisponivel: 120 }),
      expect.objectContaining({ dimensao: 'EN - Ensino', valorAtualizado: 25, valorEmpenhado: 5, requisicoes: 1, saldoDisponivel: 20 }),
    ]);
    const summary = document.querySelector('#siages-suap-plan-dimension-summary');
    expect(summary).not.toBeNull();
    expect(document.querySelector('#siages-suap-plan-summary')).toBeNull();
    expect(document.querySelector('#legend')?.nextElementSibling).toBe(summary);
    expect(summary?.textContent).toContain('Resumo financeiro por');
    expect(summary?.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(summary?.querySelector('tbody tr')?.textContent).toContain('R$');
  });

  it('agrega os registros consultados diretamente no banco com o JWT da extensao', () => {
    const summary = helpers.buildDirectPlanSummary(
      [{ id: 'a1', dimensao: 'EN - Ensino', atividade: 'Acao', descricao: 'Teste', componente_funcional: 'Ensino', origem_recurso: '171', plano_interno: 'PIEN', valor_total: 100 }],
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

  it('expande o drill-down de atividades com saldo ao clicar na metrica', () => {
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
    expect(document.querySelector('.siages-plan-detail-panel')?.textContent).toContain('12,50');
  });

  it('substitui a injecao anterior sem duplicar o painel', () => {
    helpers.renderSummary({ planId: 8, dimensoes: [] });
    window.eval(planSummaryScript);
    helpers = (window as typeof window & { __siagesSuapPlanSummary: PlanContentHelpers }).__siagesSuapPlanSummary;
    helpers.renderSummary({ planId: 8, dimensoes: [] });

    expect(document.querySelectorAll('#siages-suap-plan-summary')).toHaveLength(1);
  });
});
