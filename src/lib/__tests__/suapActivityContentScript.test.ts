import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

describe('extrator manual da extensão no Plano SUAP', () => {
  beforeEach(() => {
    (window as typeof window & { __SIAGES_SUAP_EXTENSION_TEST__?: boolean }).__SIAGES_SUAP_EXTENSION_TEST__ = true;
    window.history.replaceState({}, '', '/outra-pagina');
    document.body.innerHTML = `
      <table id="siages-suap-plan-dimension-summary">
        <thead><tr><th>Dimensão</th><th>Atividade</th><th>Valor atualizado da atividade (R$)</th></tr></thead>
        <tbody><tr><td>AD</td><td>Resumo financeiro por dimensão</td><td>100,00</td></tr></tbody>
      </table>
      <h2>AD - Administração</h2>
      <table>
        <thead><tr><th>Origem de recurso</th><th>Plano interno</th><th>Componente funcional</th><th>Atividade</th><th>Valor atualizado da atividade (R$)</th></tr></thead>
        <tbody><tr><td>AD.20RL.231796.3</td><td>PI-001</td><td>-</td><td>Compra de materiais</td><td>R$ 1.234,56</td><td><a href="/plan_estrategico/listar_requisicoes_despesa/8/32658/">Detalhar</a></td></tr></tbody>
      </table>`;
  });

  it('ignora o quadro-resumo e retorna apenas atividades com ID SUAP', () => {
    const script = readFileSync(extensionFixturePath('content.js'), 'utf8');
    window.eval(script);
    const extractor = (window as typeof window & { __siagesExtractPlanActivities?: () => unknown[] }).__siagesExtractPlanActivities;
    expect(extractor?.()).toEqual([expect.objectContaining({ suapActivityId: '32658', atividade: 'Compra de materiais' })]);
  });

  it('não faz extração manual no caminho oficial do Plano 8', () => {
    window.history.replaceState({}, '', '/plan_estrategico/plano_concluido/8/');
    const script = readFileSync(extensionFixturePath('content.js'), 'utf8');
    window.eval(script);
    const extractor = (window as typeof window & { __siagesExtractPlanActivities?: () => unknown[] }).__siagesExtractPlanActivities;
    expect(extractor?.()).toEqual([]);
  });
});
