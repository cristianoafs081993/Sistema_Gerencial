// Supabase Config
const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';

const statusEl = document.getElementById('status');
const btnExtractEn = document.getElementById('btn-extract-en');
const btnExtractAll = document.getElementById('btn-extract-all');

function log(msg, type = 'info') {
  statusEl.style.display = 'block';
  const div = document.createElement('div');
  div.className = `status-line status-${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  statusEl.appendChild(div);
  statusEl.scrollTop = statusEl.scrollHeight;
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase Error (${response.status}): ${errorText}`);
  }

  return response.status !== 204 ? await response.json() : null;
}

// Fetch existing activities from Supabase to prevent duplicates
async function getExistingActivities() {
  const data = await supabaseFetch('atividades?select=dimensao,atividade,componente_funcional');
  // Create a unique key set to check against.
  const set = new Set();
  if (data) {
    data.forEach(item => {
      // Combining dimension, component, and activity name to make it unique
      set.add(`${item.dimensao}|${item.componente_funcional}|${item.atividade}`.trim().toLowerCase());
    });
  }
  return set;
}

async function insertActivities(activities) {
  if (activities.length === 0) return 0;
  
  // Format dates required by the schema
  const now = new Date().toISOString();
  const payload = activities.map(a => ({
    dimensao: a.dimensao,
    componente_funcional: a.componenteFuncional,
    processo: a.processo || '',
    atividade: a.atividade,
    descricao: a.descricao,
    valor_total: a.valorTotal,
    origem_recurso: a.origemRecurso,
    natureza_despesa: a.naturezaDespesa,
    plano_interno: a.planoInterno,
    created_at: now,
    updated_at: now
  }));

  const result = await supabaseFetch('atividades', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  return result ? result.length : 0;
}

async function handleExtraction(filterDimension = null) {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    statusEl.innerHTML = '';
    
    log('Verificando aba ativa...', 'info');
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('suap.ifrn.edu.br')) {
      throw new Error('Você precisa estar na página do SUAP.');
    }

    log('Injetando script...', 'info');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Nenhum dado retornado do SUAP.');
    }
    
    let scrapedData = results[0].result;
    
    if (filterDimension) {
      scrapedData = scrapedData.filter(a => a.dimensao.includes(filterDimension));
      log(`Filtradas ${scrapedData.length} atividades para a dimensão ${filterDimension}.`, 'info');
    } else {
      log(`Encontradas ${scrapedData.length} atividades em todas as dimensões.`, 'info');
    }
    
    if (scrapedData.length === 0) {
      throw new Error('Nenhuma atividade encontrada na página.');
    }

    log('Buscando atividades existentes...', 'info');
    const existingSet = await getExistingActivities();
    
    const newActivities = [];
    const skippedActivities = [];

    scrapedData.forEach(item => {
      const key = `${item.dimensao}|${item.componenteFuncional}|${item.atividade}`.trim().toLowerCase();
      if (existingSet.has(key)) {
        skippedActivities.push(item);
      } else {
        newActivities.push(item);
      }
    });

    log(`Foi verificado que ${skippedActivities.length} atividades já existem no banco.`, existingSet.size > 0 ? 'info' : 'success');
    
    if (newActivities.length > 0) {
      log(`Inserindo ${newActivities.length} novas atividades...`);
      const insertedCount = await insertActivities(newActivities);
      log(`Sucesso! ${insertedCount} novas atividades foram cadastradas.`, 'success');
    } else {
      log('Nenhuma nova atividade para inserir. Todas já estão no banco.', 'success');
    }
    
  } catch (error) {
    console.error('Extraction error:', error);
    log(error.message, 'error');
  } finally {
    btnExtractEn.disabled = false;
    btnExtractAll.disabled = false;
  }
}

btnExtractEn.addEventListener('click', () => handleExtraction('EN - Ensino'));
btnExtractAll.addEventListener('click', () => handleExtraction(null));
