import { describe, expect, it } from 'vitest';

import { parseSuapPlanHtml } from '@/services/suapPlanParser';

const html = `
  <main>
    <h2>AD - Administração</h2>
    <table>
      <thead><tr>
        <th>Unidade gestora</th><th>Origem de recurso</th><th>Plano interno</th>
        <th>Componente funcional</th><th>Atividade</th>
        <th>Valor atualizado da atividade (R$)</th><th>Opções</th>
      </tr></thead>
      <tbody>
        <tr hidden="">
          <td></td><td>AD.20RL.231796.3</td><td>PI-001 - Gestão</td><td>-</td>
          <td>Compra de materiais</td><td>R$ 1.234,56</td>
          <td><a href="/plan_estrategico/listar_requisicoes_despesa/8/32658/">Detalhar</a></td>
        </tr>
      </tbody>
    </table>
  </main>`;

describe('parseSuapPlanHtml', () => {
  it('associa cada tabela ao cabecalho de sua propria dimensao', () => {
    const multiDimensionHtml = `
      <div class="accordion-item">
        <h2>AD - AdministraÃ§Ã£o</h2>
        <div><table><thead><tr><th>Atividade</th><th>Valor atualizado da atividade</th><th>OpÃ§Ãµes</th></tr></thead>
          <tbody><tr><td>Compra AD</td><td>R$ 10,00</td><td><a href="/plan_estrategico/listar_requisicoes_despesa/8/1/">Detalhar</a></td></tr></tbody>
        </table></div>
      </div>
      <div class="accordion-item">
        <h2>TI - Tecnologia da InformaÃ§Ã£o e ComunicaÃ§Ã£o</h2>
        <div><table><thead><tr><th>Atividade</th><th>Valor atualizado da atividade</th><th>OpÃ§Ãµes</th></tr></thead>
          <tbody><tr><td>Compra TI</td><td>R$ 20,00</td><td><a href="/plan_estrategico/listar_requisicoes_despesa/8/2/">Detalhar</a></td></tr></tbody>
        </table></div>
      </div>`;

    const result = parseSuapPlanHtml(multiDimensionHtml);
    expect(result.activities.map((activity) => activity.dimensao)).toEqual([
      'AD - AdministraÃ§Ã£o',
      'TI - Tecnologia da InformaÃ§Ã£o e ComunicaÃ§Ã£o',
    ]);
  });

  it('extrai linhas ocultas e normaliza valores brasileiros', () => {
    const result = parseSuapPlanHtml(html);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]).toMatchObject({
      suapActivityId: '32658',
      dimensao: 'AD - Administração',
      atividade: 'Compra de materiais',
      componenteFuncional: '-',
      origemRecurso: '231796',
      origemRecursoRaw: 'AD.20RL.231796.3',
      valorTotal: 1234.56,
    });
  });

  it('rejeita ids SUAP duplicados', () => {
    expect(() => parseSuapPlanHtml(html.replace('</tbody>', `${html.match(/<tr hidden="">[\s\S]*?<\/tr>/)?.[0]}</tbody>`)))
      .toThrow('Atividade SUAP duplicada');
  });

  it('rejeita uma página sem tabelas de atividades', () => {
    expect(() => parseSuapPlanHtml('<h1>Plano 8</h1>')).toThrow('Nenhuma atividade');
  });
});
