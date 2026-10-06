// Sanitized contract fixtures from the observed SUAP tables (including TH status cells).
export const rdListUrl = 'https://suap.ifrn.edu.br/admin/plan_estrategico/requisicaodespesa/?unidade_gestora=19&tab=tab_any_data';
export const activityUrl = 'https://suap.ifrn.edu.br/plan_estrategico/listar_requisicoes_despesa/8/32635/';
export function listHtml({ id = '9083', count = 1, next = '', activity = false } = {}) {
  return `<main id="content">${activity ? '<dl><dt>Unidade administrativa</dt><dd>DG/CN</dd><dt>Atividade</dt><dd>Almoxarifado virtual</dd></dl>' : `Mostrando ${count} Requisições de despesas`}
  <table><thead><tr>${activity ? '' : '<th>#</th>'}<th>Nº da requisição</th><th>Situação</th><th>Tipo</th><th>Unidade Gestora</th></tr></thead><tbody><tr>${activity ? '' : `<th><a href="/plan_estrategico/detalhar_requisicaodespesa/${id}/">Visualizar</a></th>`}
  <td>${activity ? `<a href="/plan_estrategico/detalhar_requisicaodespesa/${id}/">2026RD003731</a>` : '2026RD003731'}</td><td>Concluída</td><td>Reforço de empenho</td><td>DG/CN - Direção-Geral</td></tr></tbody></table>${next ? `<a href="${next.replace(/&/g,'&amp;')}">Próxima</a>` : ''}</main>`;
}
export function detailHtml({ type = 'Reforço de empenho', status = 'Concluída', value = '20.242,46', ne = '158366264352026NE000014', lineStatus = 'Confirmada', withStatus = true, total = value } = {}) {
  return `<main id="content"><h2>Requisição Nº 2026RD003731</h2><div>${status}</div><dl><dt>Atividade:</dt><dd>Almoxarifado virtual</dd><dt>Unidade:</dt><dd>DG/CN - Direção-Geral</dd><dt>Processo administrativo:</dt><dd><span>#463949</span><a href="/processo_eletronico/processo/463949/">23035.000649.2026-76</a></dd></dl>
  <ul><li><h4>Valor inicial</h4><p>R$ 20.289,05</p></li><li><h4>Valor</h4><p>R$ ${value}</p></li><li><h4>Tipo da requisição</h4><p>${type}</p></li></ul>
  <table><thead><tr><th>Natureza de despesa</th><th>Valor</th><th>Número do empenho</th><th>Número RO</th>${withStatus ? '<th>Situação</th>' : ''}</tr></thead><tbody><tr><td>339039</td><td>${value}</td><td>${ne}</td><td>158366264352026RO000338</td>${withStatus ? `<th>${lineStatus}</th>` : ''}</tr></tbody><tfoot><tr><td>Total:</td><td>${total}</td><td></td></tr></tfoot></table></main>`;
}
export const planHtml = `<main><select id="id_unidade_gestora"><option value="19" selected>DG/CN</option></select><h2>AD - Administração</h2><table><thead><tr><th>Atividade</th><th>Valor atualizado da atividade</th><th>Saldo disponível para empenho da atividade</th><th>Opções</th></tr></thead><tbody><tr hidden><td>Almoxarifado virtual</td><td>20.242,46</td><td>0,00</td><td><a href="/plan_estrategico/listar_requisicoes_despesa/8/32635/">Detalhar</a></td></tr></tbody></table></main>`;
