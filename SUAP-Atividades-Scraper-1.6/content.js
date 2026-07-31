function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function parseCurrency(str) {
  if (!str) return 0;
  const cleanStr = str.replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  return Number.isNaN(num) ? 0 : num;
}

function parsePTRES(text) {
  if (!text) return '';
  const match = text.match(/\b\d{6}\b/);
  return match ? match[0] : text;
}

function extractDataFromPage() {
  const atividades = [];
  let currentDimensao = 'EN - Ensino';
  let currentComponente = 'Desconhecido';

  const contentBody = document.querySelector('.content-body, .panel-body, body');
  if (!contentBody) return [];

  Array.from(contentBody.querySelectorAll('h2, h3, h4, table')).forEach((el) => {
    if (el.tagName.startsWith('H')) {
      const text = cleanText(el.innerText);
      if (text.match(/^[A-Z]{2}\s*-/)) {
        currentDimensao = text;
      } else if (text.length > 5 && !text.toUpperCase().includes('TOTAL')) {
        currentComponente = text;
      }
    }

    if (el.tagName === 'TABLE') {
      const headers = Array.from(el.querySelectorAll('th')).map((th) => cleanText(th.innerText).toLowerCase());
      const isAtividadeTable = headers.some((header) => header.includes('atividade') || header.includes('meta'));

      if (isAtividadeTable) {
        const idxAtividade = headers.findIndex((header) =>
          header.includes('atividade') || header.includes('ação') || header.includes('meta')
        );
        const idxDescricao = headers.findIndex((header) => header.includes('descrição') || header.includes('detalhe'));
        const idxValor = headers.findIndex((header) => header.includes('valor') || header.includes('orçamento') || header.includes('financeiro'));
        const idxOrigem = headers.findIndex((header) => header.includes('origem') || header.includes('recurso'));
        const idxNatureza = headers.findIndex((header) => header.includes('natureza') || header.includes('despesa'));
        const idxPlano = headers.findIndex((header) => header.includes('plano interno') || header.includes('pi'));
        const idxProcesso = headers.findIndex((header) => header.includes('processo'));
        const idxComponente = headers.findIndex((header) => header.includes('componente') || header.includes('funcional'));
        const idxDimensao = headers.findIndex((header) => header.includes('dimensão'));
        const tbody = el.querySelector('tbody') || el;
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.forEach((tr) => {
          const cols = tr.querySelectorAll('td');
          if (cols.length <= 2) return;

          const atividadeVal = idxAtividade >= 0 && cols[idxAtividade]
            ? cleanText(cols[idxAtividade].innerText)
            : cleanText(cols[0].innerText);

          if (!atividadeVal || atividadeVal.toLowerCase() === 'total') return;

          const dimensaoVal = idxDimensao >= 0 && cols[idxDimensao]
            ? cleanText(cols[idxDimensao].innerText)
            : currentDimensao;
          const componenteVal = idxComponente >= 0 && cols[idxComponente]
            ? cleanText(cols[idxComponente].innerText)
            : currentComponente;
          const descricaoVal = idxDescricao >= 0 && cols[idxDescricao]
            ? cleanText(cols[idxDescricao].innerText)
            : atividadeVal;
          const valorVal = idxValor >= 0 && cols[idxValor] ? parseCurrency(cols[idxValor].innerText) : 0;
          const origemValRaw = idxOrigem >= 0 && cols[idxOrigem]
            ? cleanText(cols[idxOrigem].innerText)
            : '0100000000 - TESOURO';
          const naturezaVal = idxNatureza >= 0 && cols[idxNatureza]
            ? cleanText(cols[idxNatureza].innerText)
            : '339000 - APLIC. DIRETAS';
          const planoValRaw = idxPlano >= 0 && cols[idxPlano] ? cleanText(cols[idxPlano].innerText) : '';
          const processoVal = idxProcesso >= 0 && cols[idxProcesso] ? cleanText(cols[idxProcesso].innerText) : '';

          atividades.push({
            dimensao: dimensaoVal,
            componenteFuncional: componenteVal,
            processo: processoVal !== '' ? processoVal : null,
            atividade: atividadeVal.substring(0, 200),
            descricao: descricaoVal,
            valorTotal: valorVal,
            origemRecurso: parsePTRES(origemValRaw),
            naturezaDespesa: naturezaVal,
            planoInterno: parsePTRES(planoValRaw),
          });
        });
      }
    }
  });

  return atividades;
}

extractDataFromPage();
