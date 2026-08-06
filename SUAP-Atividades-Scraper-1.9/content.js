function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function foldText(text) {
  return cleanText(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseCurrency(str) {
  const value = cleanText(str).replace(/[^\d,.-]/g, '');
  if (!value) return 0;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  const normalized = comma >= 0 && (dot < 0 || comma > dot)
    ? value.replace(/\./g, '').replace(',', '.')
    : value.replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function parsePTRES(text) {
  const value = cleanText(text);
  return value.match(/\b\d{6}\b/)?.[0] || value;
}

function isSummaryTable(table) {
  return table.matches('[data-siages-plan-dimension-summary="true"], #siages-suap-plan-dimension-summary, .siages-plan-dimension-summary') ||
    Boolean(table.closest('[data-siages-plan-dimension-summary="true"], #siages-suap-plan-dimension-summary, .siages-plan-dimension-summary'));
}

function extractSuapActivityId(row) {
  const link = row.querySelector('a[href*="/plan_estrategico/listar_requisicoes_despesa/8/"]');
  return link?.getAttribute('href')?.match(/\/plan_estrategico\/listar_requisicoes_despesa\/8\/(\d+)\/?/)?.[1] || '';
}

function extractDataFromPage() {
  if (/^\/plan_estrategico\/plano_concluido\/8\/?$/.test(window.location.pathname)) return [];
  const activities = new Map();
  let currentDimension = 'EN - Ensino';
  let currentComponent = '-';
  const contentBody = document.querySelector('.content-body, .panel-body, body');
  if (!contentBody) return [];

  Array.from(contentBody.querySelectorAll('h2, h3, h4, h5, h6, table')).forEach((element) => {
    if (element.tagName.startsWith('H')) {
      const heading = cleanText(element.textContent);
      if (/^[A-Z]{2}\s*-/.test(heading)) currentDimension = heading;
      else if (heading.length > 5 && !foldText(heading).includes('total')) currentComponent = heading;
      return;
    }

    const table = element;
    if (isSummaryTable(table)) return;
    const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th')).map((cell) => foldText(cell.textContent));
    const hasPlanColumns = headers.some((header) => header.includes('origem de recurso')) &&
      headers.some((header) => header.includes('plano interno')) &&
      headers.some((header) => header.includes('valor atualizado da atividade'));
    if (!hasPlanColumns) return;

    const indexOf = (...needles) => headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
    const activityIndex = indexOf('atividade');
    const descriptionIndex = indexOf('descricao', 'detalhe');
    const valueIndex = indexOf('valor atualizado da atividade');
    const originIndex = indexOf('origem de recurso');
    const planIndex = indexOf('plano interno');
    const natureIndex = indexOf('natureza', 'despesa');
    const processIndex = indexOf('processo');
    const componentIndex = indexOf('componente funcional');
    const dimensionIndex = indexOf('dimensao');

    Array.from(table.tBodies.length ? table.tBodies : [table]).flatMap((body) => Array.from(body.querySelectorAll('tr'))).forEach((row) => {
      const cells = Array.from(row.querySelectorAll('td')).map((cell) => cleanText(cell.textContent));
      const activity = cells[activityIndex] || '';
      const id = extractSuapActivityId(row);
      if (!activity || foldText(activity) === 'total' || !id) return;

      const dimension = dimensionIndex >= 0 ? cells[dimensionIndex] || currentDimension : currentDimension;
      const component = componentIndex >= 0 ? cells[componentIndex] || '-' : currentComponent || '-';
      const item = {
        suapActivityId: id,
        dimensao: dimension,
        componenteFuncional: component,
        processo: processIndex >= 0 ? cells[processIndex] || null : null,
        atividade: activity.substring(0, 200),
        descricao: descriptionIndex >= 0 ? cells[descriptionIndex] || activity : activity,
        valorTotal: valueIndex >= 0 ? parseCurrency(cells[valueIndex]) : 0,
        origemRecurso: originIndex >= 0 ? parsePTRES(cells[originIndex]) : '',
        naturezaDespesa: natureIndex >= 0 ? cells[natureIndex] : '',
        planoInterno: planIndex >= 0 ? cells[planIndex] : '',
      };
      activities.set(`suap:8:${id}`, item);
    });
  });

  return Array.from(activities.values());
}

if (window.__SIAGES_SUAP_EXTENSION_TEST__) window.__siagesExtractPlanActivities = extractDataFromPage;
extractDataFromPage();




