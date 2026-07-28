const SUPABASE_URL = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzk4NjIsImV4cCI6MjA4NTg1NTg2Mn0.g9h5nF0l8yKG-yjQRI8i_mq084IzKTrH64F2FpreVIg';
const SAVINGS_EVENT_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/record-automation-savings-event`;
const SECRET_STORAGE_KEY = 'automation-event-secret';
const SIAGES_APP_ORIGIN_STORAGE_KEY = 'siages-app-origin';
const DEFAULT_SIAGES_APP_ORIGIN = 'https://sistema-gerencial-gamma.vercel.app';

const statusEl = document.getElementById('status');
const btnExtractEn = document.getElementById('btn-extract-en');
const btnExtractAll = document.getElementById('btn-extract-all');
const automationSecretInput = document.getElementById('automation-secret');
const siagesAppOriginInput = document.getElementById('siages-app-origin');
const saveSiagesAppOriginButton = document.getElementById('btn-save-siages-origin');

async function getSiagesAppOrigin() {
  const stored = await chrome.storage.local.get(SIAGES_APP_ORIGIN_STORAGE_KEY);
  return stored[SIAGES_APP_ORIGIN_STORAGE_KEY] || DEFAULT_SIAGES_APP_ORIGIN;
}

function normalizeSiagesAppOrigin(value) {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:') throw new Error('Informe uma URL HTTPS válida para o SIAGES.');
  return url.origin;
}

void getSiagesAppOrigin().then((origin) => {
  siagesAppOriginInput.value = origin;
});

saveSiagesAppOriginButton.addEventListener('click', async () => {
  try {
    const origin = normalizeSiagesAppOrigin(siagesAppOriginInput.value);
    await chrome.storage.local.set({ [SIAGES_APP_ORIGIN_STORAGE_KEY]: origin });
    siagesAppOriginInput.value = origin;
    log('URL do SIAGES salva.', 'success');
  } catch (error) {
    log(error.message, 'error');
  }
});

automationSecretInput.value = localStorage.getItem(SECRET_STORAGE_KEY) || '';
automationSecretInput.addEventListener('change', () => {
  localStorage.setItem(SECRET_STORAGE_KEY, automationSecretInput.value.trim());
});

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
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase Error (${response.status}): ${errorText}`);
  }

  return response.status !== 204 ? await response.json() : null;
}

async function recordSavingsEvent(count) {
  const secret = automationSecretInput.value.trim();
  localStorage.setItem(SECRET_STORAGE_KEY, secret);

  if (!secret || count <= 0) {
    log('Evento de economia de tempo não registrado: segredo não configurado.', 'info');
    return;
  }

  const response = await fetch(SAVINGS_EVENT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-automation-event-secret': secret,
    },
    body: JSON.stringify({
      scenarioId: 'suap-processos',
      source: 'suap-atividades-extension',
      eventName: 'atividades_sincronizadas',
      occurredAt: new Date().toISOString(),
      metadata: { count },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao registrar economia de tempo (${response.status}): ${errorText}`);
  }

  log(`Evento de economia registrado para ${count} atividade(s).`, 'success');
}

async function getExistingActivities() {
  const data = await supabaseFetch('atividades?select=dimensao,atividade,componente_funcional');
  const set = new Set();
  if (data) {
    data.forEach((item) => {
      set.add(`${item.dimensao}|${item.componente_funcional}|${item.atividade}`.trim().toLowerCase());
    });
  }
  return set;
}

async function insertActivities(activities) {
  if (activities.length === 0) return 0;

  const now = new Date().toISOString();
  const payload = activities.map((activity) => ({
    dimensao: activity.dimensao,
    componente_funcional: activity.componenteFuncional,
    processo: activity.processo || '',
    atividade: activity.atividade,
    descricao: activity.descricao,
    valor_total: activity.valorTotal,
    origem_recurso: activity.origemRecurso,
    natureza_despesa: activity.naturezaDespesa,
    plano_interno: activity.planoInterno,
    created_at: now,
    updated_at: now,
  }));

  const result = await supabaseFetch('atividades', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return result ? result.length : 0;
}

async function handleExtraction(filterDimension = null) {
  try {
    btnExtractEn.disabled = true;
    btnExtractAll.disabled = true;
    statusEl.innerHTML = '';

    log('Verificando aba ativa...', 'info');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('suap.ifrn.edu.br')) {
      throw new Error('Você precisa estar na página do SUAP.');
    }

    log('Injetando script...', 'info');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });

    if (!results || !results[0] || !results[0].result) {
      throw new Error('Nenhum dado retornado do SUAP.');
    }

    let scrapedData = results[0].result;

    if (filterDimension) {
      scrapedData = scrapedData.filter((activity) => activity.dimensao.includes(filterDimension));
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

    scrapedData.forEach((item) => {
      const key = `${item.dimensao}|${item.componenteFuncional}|${item.atividade}`.trim().toLowerCase();
      if (existingSet.has(key)) {
        skippedActivities.push(item);
      } else {
        newActivities.push(item);
      }
    });

    log(`Foi verificado que ${skippedActivities.length} atividades já existem no banco.`, 'info');

    if (newActivities.length > 0) {
      log(`Inserindo ${newActivities.length} novas atividades...`, 'info');
      const insertedCount = await insertActivities(newActivities);
      log(`Sucesso! ${insertedCount} novas atividades foram cadastradas.`, 'success');
      await recordSavingsEvent(insertedCount);
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
