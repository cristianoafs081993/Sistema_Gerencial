// This script extracts tabular data from the SUAP Strategic Planning page.
// Returns an array of objects matching the Atividade interface.

function cleanText(text) {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

function parseCurrency(str) {
  if (!str) return 0;
  // Ex: "R$ 1.234,56" -> 1234.56
  const cleanStr = str.replace(/[R$\s\.]/g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function parsePTRES(text) {
  if (!text) return '';
  // Extrai trecho de exatamente 6 dígitos se existir (ex: EN.2994.231802.3 -> 231802)
  const match = text.match(/\b\d{6}\b/);
  return match ? match[0] : text;
}

function extractDataFromPage() {
  const atividades = [];
  
  // O SUAP normalmente estrutura com headers indicando dimensões/objetivos
  // Procurando tabelas de atividade.
  const tables = document.querySelectorAll('table');
  
  // Vamos buscar um padrão onde o "Componente Funcional" ou "Dimensão" possa ser identificado.
  // Como o modelo HTML específico não é conhecido, vamos tentar uma heurística forte baseada em classes do SUAP ou títulos de seção.
  
  let currentDimensao = 'EN - Ensino'; // default unless found
  let currentComponente = 'Desconhecido';
  
  // Percorrendo elementos para manter estado
  // No SUAP os blocos de metas/atividades costumam vir após Headers (H2, H3) e estar em tabelas
  
  const contentBody = document.querySelector('.content-body, .panel-body, body'); // Generic fallback
  if (!contentBody) return [];
  
  // Tentativa 1: Estrutura típica de resumos do SUAP
  // Procura por cabeçalhos que possam indicar a Dimensão
  Array.from(contentBody.querySelectorAll('h2, h3, h4, table')).forEach(el => {
    if (el.tagName.startsWith('H')) {
      const text = cleanText(el.innerText);
      // Se for algo como "1. AD - Administração" ou "EN - Ensino"
      if (text.match(/^[A-Z]{2}\s*-/)) {
        currentDimensao = text;
      } else if (text.length > 5 && !text.toUpperCase().includes('TOTAL')) {
        // Pode ser um componente funcional dependendo da hierarquia
        // Só atualiza se acharmos que é relevante
        currentComponente = text; 
      }
    }
    
    if (el.tagName === 'TABLE') {
      // Verifica se é uma tabela de atividades verificando o thead
      const headers = Array.from(el.querySelectorAll('th')).map(th => cleanText(th.innerText).toLowerCase());
      
      const isAtividadeTable = headers.some(h => h.includes('atividade') || h.includes('meta'));
      
      if (isAtividadeTable) {
        // Mapeia colunas para extrair os dados
        const idxAtividade = headers.findIndex(h => h.includes('atividade') || h.includes('ação') || h.includes('meta'));
        const idxDescricao = headers.findIndex(h => h.includes('descrição') || h.includes('detalhe'));
        const idxValor = headers.findIndex(h => h.includes('valor') || h.includes('orçamento') || h.includes('financeiro'));
        const idxOrigem = headers.findIndex(h => h.includes('origem') || h.includes('recurso'));
        const idxNatureza = headers.findIndex(h => h.includes('natureza') || h.includes('despesa'));
        const idxPlano = headers.findIndex(h => h.includes('plano interno') || h.includes('pi'));
        const idxProcesso = headers.findIndex(h => h.includes('processo'));
        const idxComponente = headers.findIndex(h => h.includes('componente') || h.includes('funcional'));
        const idxDimensao = headers.findIndex(h => h.includes('dimensão')); // Caso a dimensão esteja na própria tabela

        const tbody = el.querySelector('tbody') || el;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        rows.forEach(tr => {
          const cols = tr.querySelectorAll('td');
          if (cols.length > 2) {
            // Tenta pegar da coluna específica, se não achar cai num default
            
            const atividadeVal = idxAtividade >= 0 && cols[idxAtividade] ? cleanText(cols[idxAtividade].innerText) : cleanText(cols[0].innerText);
            
            if (!atividadeVal || atividadeVal.toLowerCase() === 'total' || atividadeVal === '') return;
            
            const dimensaoVal = idxDimensao >= 0 && cols[idxDimensao] ? cleanText(cols[idxDimensao].innerText) : currentDimensao;
            const componenteVal = idxComponente >= 0 && cols[idxComponente] ? cleanText(cols[idxComponente].innerText) : currentComponente;
            
            const descricaoVal = idxDescricao >= 0 && cols[idxDescricao] ? cleanText(cols[idxDescricao].innerText) : atividadeVal;
            const valorVal = idxValor >= 0 && cols[idxValor] ? parseCurrency(cols[idxValor].innerText) : 0;
            const origemValRaw = idxOrigem >= 0 && cols[idxOrigem] ? cleanText(cols[idxOrigem].innerText) : '0100000000 - TESOURO'; // Default guess if missing
            const origemVal = parsePTRES(origemValRaw);
            const naturezaVal = idxNatureza >= 0 && cols[idxNatureza] ? cleanText(cols[idxNatureza].innerText) : '339000 - APLIC. DIRETAS';
            const planoValRaw = idxPlano >= 0 && cols[idxPlano] ? cleanText(cols[idxPlano].innerText) : '';
            const planoVal = parsePTRES(planoValRaw);
            const processoVal = idxProcesso >= 0 && cols[idxProcesso] ? cleanText(cols[idxProcesso].innerText) : '';

            atividades.push({
              dimensao: dimensaoVal,
              componenteFuncional: componenteVal,
              processo: processoVal !== '' ? processoVal : null,
              atividade: atividadeVal.substring(0, 200), // Limits to avoid db issues
              descricao: descricaoVal,
              valorTotal: valorVal,
              origemRecurso: origemVal,
              naturezaDespesa: naturezaVal,
              planoInterno: planoVal
            });
          }
        });
      }
    }
  });

  return atividades;
}

// Em manifest V3 executeScript, a última expressão deve avaliar o valor de retorno diretamente.
extractDataFromPage();
