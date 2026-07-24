import { supabase } from '@/lib/supabase';

export interface ScrapedProcesso {
  suapId: string;
  numProcesso?: string;
  url: string;
  caixa?: string;
}

export type SyncProgressCallback = (message: string) => void;
export type SyncedProcesso = ScrapedProcesso & {
  already_exists: boolean;
  created?: boolean;
  pdfUrl?: string | null;
  status?: string;
};

export type InventorySyncOptions = {
  forceUpdateProcessIds?: Set<string>;
};

export type StageResult = {
  completed: number;
  skipped: number;
  errors: number;
};

const PROCESS_NUMBER_REGEX = /\b\d{5}\.\d{6}\.\d{4}-\d{2}\b/;
const PROCESS_LINK_HREF_REGEX = /\/processo_eletronico\/processo\/\d+\/?/;

// Função auxiliar para chamar o proxy do SUAP
async function fetchViaProxy(
  path: string, 
  suapSessionId: string, 
  options: { method?: string; body?: any } = {}
) {
  const cleanPath = path.startsWith('https://suap.ifrn.edu.br')
    ? path.replace('https://suap.ifrn.edu.br', '')
    : path;

  const { data, error } = await supabase.functions.invoke('suap-proxy', {
    body: {
      path: cleanPath,
      method: options.method || 'GET',
      suapSessionId,
      body: options.body,
    },
  });

  if (error) {
    throw new Error(`Erro de rede no proxy: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

function extractProcessNumber(text: string): string | null {
  const match = String(text || '').match(PROCESS_NUMBER_REGEX);
  return match ? match[0] : null;
}

export type AiExtractionQueueResult = {
  queued: boolean;
  status: string;
};

// Orquestra a geração e download do PDF no SUAP via polling Celery
async function downloadProcessPdf(
  proc: ScrapedProcesso,
  suapSessionId: string,
  log: SyncProgressCallback
): Promise<{ pdfBase64: string }> {
  const id = proc.suapId;

  log(`[${id}] Passo 1: Buscando página de detalhes do processo...`);
  const detailRes = await fetchViaProxy(`/processo_eletronico/processo/${id}/`, suapSessionId);
  const detailHtml = detailRes.text || '';

  const viewerMatch = detailHtml.match(new RegExp(`/processo_eletronico/visualizar_processo/${id}/`));
  if (!viewerMatch) {
    throw new Error(`Visualizador do processo não encontrado para o ID ${id}`);
  }

  const viewerUrl = viewerMatch[0];
  log(`[${id}] Passo 1 OK: Visualizador localizado.`);

  log(`[${id}] Passo 2: Buscando página do visualizador...`);
  const viewerRes = await fetchViaProxy(viewerUrl, suapSessionId);
  const viewerHtml = viewerRes.text || '';

  const triggerMatch = viewerHtml.match(/href="([^"]*\/processo_eletronico\/imprimir_processo_celery\/[^"]*)"/);
  if (!triggerMatch) {
    throw new Error(`Link de impressão/geração de PDF Celery não encontrado para o ID ${id}`);
  }

  const triggerPath = triggerMatch[1];
  log(`[${id}] Passo 2 OK: Trigger Celery localizado.`);


  log(`[${id}] Passo 3: Disparando geração do PDF no Celery...`);
  const triggerRes = await fetchViaProxy(triggerPath, suapSessionId);
  const celeryHtml = triggerRes.text || '';

  const uuidMatch = celeryHtml.match(/process_progress\/[01]\/([a-f0-9-]+)\//);
  if (!uuidMatch) {
    throw new Error(`UUID do polling Celery não localizado na resposta do SUAP.`);
  }

  const uuid = uuidMatch[1];
  log(`[${id}] Passo 3 OK: UUID de Polling = ${uuid}`);

  const statusPath = `/djtools/process_progress/0/${uuid}/`;
  let finished = false;
  let maxPolls = 120; // 10 minutos limite (120 * 5s)

  log(`[${id}] Passo 4: Aguardando geração do PDF (polling Celery)...`);
  while (!finished && maxPolls > 0) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const pollRes = await fetchViaProxy(statusPath, suapSessionId);
      const textVal = pollRes.text || '';
      const parts = textVal.split('::');
      const pct = parts[0] || '?';
      const msg = parts[1] || '';
      const err = parts[4] || '';

      log(`[${id}] Poll [${121 - maxPolls}]: ${pct}% - ${msg || 'processando...'}`);
      
      if (msg && msg.toLowerCase().includes('sucesso')) {
        finished = true;
      } else if (err && err.trim()) {
        throw new Error(`Erro no Celery SUAP: ${err}`);
      }
    } catch (pollErr: any) {
      if (pollErr.message?.startsWith('Erro no Celery')) throw pollErr;
      log(`[${id}] Aviso no Polling: ${pollErr.message}`);
    }
    maxPolls--;
  }

  if (!finished) {
    throw new Error(`Tempo esgotado na geração do PDF para o processo ${id}`);
  }
  log(`[${id}] Passo 4 OK: PDF gerado com sucesso!`);

  log(`[${id}] Passo 5: Baixando PDF binário via proxy...`);
  const pdfDownloadPath = `/djtools/process_progress/1/${uuid}/`;
  const pdfRes = await fetchViaProxy(pdfDownloadPath, suapSessionId);

  if (!pdfRes.base64) {
    throw new Error('Falha ao obter PDF em formato Base64.');
  }

  log(`[${id}] Passo 5 OK: PDF baixado (${Math.round((pdfRes.base64.length * 3) / 4 / 1024)} KB)`);

  return {
    pdfBase64: pdfRes.base64,
  };
}

// Portabilidade do scraping da página de listagem do SUAP
export const suapScraperService = {
  async loginSuap(username: string, password: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('suap-proxy', {
      body: {
        action: 'login',
        username,
        password,
      },
    });

    if (error) {
      throw new Error(`Erro de rede no login: ${error.message}`);
    }

    if (!data || data.success === false || data.error) {
      throw new Error(data?.error || 'Falha ao autenticar no SUAP. Verifique usuário e senha.');
    }

    return data.suapSessionId;
  },

  // Dado o HTML da caixa de processos, faz o parse e retorna a lista
  parseCaixaProcessos(html: string): ScrapedProcesso[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Verificar se caiu na tela de login do SUAP (sessão expirada)
    if (doc.querySelector('input[type="password"], form[action*="/accounts/login/"]')) {
      throw new Error('Sessão expirada ou não autenticada no SUAP. Por favor, conecte-se ao SUAP novamente.');
    }

    const links = Array.from(doc.querySelectorAll('a[href*="/processo_eletronico/processo/"]'));
    
    const processes: ScrapedProcesso[] = [];
    const seenIds = new Set<string>();

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (!PROCESS_LINK_HREF_REGEX.test(href)) continue;
      
      // Extrair ID
      const match = href.match(/\/processo_eletronico\/processo\/(\d+)\//);
      const suapId = match ? match[1] : null;
      if (!suapId || seenIds.has(suapId)) continue;
      
      // Tentar pegar número do processo no contexto
      const container = link.closest('tr, li, article, .box, .media, .item');
      const candidates = [link.textContent, link.getAttribute('title'), container?.textContent];
      let numProcesso = undefined;
      for (const candidate of candidates) {
        const num = extractProcessNumber(candidate || '');
        if (num) {
          numProcesso = num;
          break;
        }
      }

      processes.push({
        suapId,
        numProcesso,
        url: `https://suap.ifrn.edu.br${href}`,
      });
      seenIds.add(suapId);
    }

    return processes;
  },

  // Busca o HTML da caixa de processos e faz o scraping
  async fetchAndScrapeCaixa(caixaUrl: string, suapSessionId: string): Promise<ScrapedProcesso[]> {
    const res = await fetchViaProxy(caixaUrl, suapSessionId);
    if (!res.text) {
      throw new Error('Resposta vazia da caixa de processos do SUAP');
    }
    return this.parseCaixaProcessos(res.text);
  },

  // Sincroniza a lista de processos básicos no Supabase (pendentes)
  async syncProcessListInSupabase(
    processes: ScrapedProcesso[],
    tenantId: string,
    options: InventorySyncOptions = {},
  ): Promise<SyncedProcesso[]> {
    const { data: existingList, error: selectErr } = await supabase
      .from('processos')
      .select('suap_id, status, num_processo, pdf_url')
      .eq('tenant_id', tenantId);

    if (selectErr) throw selectErr;

    const existingMap = new Map((existingList || []).map((p) => [p.suap_id, p]));
    const synced: SyncedProcesso[] = [];

    for (const proc of processes) {
      const existing = existingMap.get(proc.suapId);
      const shouldForceUpdate = options.forceUpdateProcessIds?.has(proc.suapId) ?? false;

      if (existing) {
        if (shouldForceUpdate) {
          const patch: any = { updated_at: new Date().toISOString() };
          if (proc.url) patch.url = proc.url;
          if (proc.numProcesso) patch.num_processo = proc.numProcesso;
          if (proc.caixa) patch.caixa = proc.caixa;

          if (Object.keys(patch).length > 1) {
            await supabase
              .from('processos')
              .update(patch)
              .eq('tenant_id', tenantId)
              .eq('suap_id', proc.suapId);
          }
        }

        synced.push({
          ...proc,
          already_exists: true,
          created: false,
          status: existing.status,
          numProcesso: proc.numProcesso || existing.num_processo || undefined,
          pdfUrl: existing.pdf_url,
        });
        continue;
      }

      const payload: any = {
        tenant_id: tenantId,
        suap_id: proc.suapId,
        url: proc.url,
        status: 'pending_extraction',
        updated_at: new Date().toISOString(),
      };
      if (proc.numProcesso) payload.num_processo = proc.numProcesso;
      if (proc.caixa) payload.caixa = proc.caixa;

      await supabase.from('processos').insert(payload);
      synced.push({
        ...proc,
        already_exists: false,
        created: true,
        status: 'pending_extraction',
        pdfUrl: null,
      });
    }

    return synced;
  },

  async downloadPdfForProcess(
    proc: ScrapedProcesso | SyncedProcesso,
    suapSessionId: string,
    tenantId: string,
    log: SyncProgressCallback,
    options: { force?: boolean } = {},
  ): Promise<string | null> {
    const { data: existing, error: fetchError } = await supabase
      .from('processos')
      .select('pdf_url')
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId)
      .single();

    if (fetchError) throw fetchError;

    if (existing?.pdf_url && !options.force) {
      log(`[${proc.suapId}] PDF ja sincronizado. Pulando download.`);
      return existing.pdf_url;
    }

    const { pdfBase64 } = await downloadProcessPdf(proc, suapSessionId, log);

    log(`[${proc.suapId}] Fazendo upload do PDF para o bucket suap-pdfs...`);
    const byteChars = atob(pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const storagePath = `${tenantId}/${proc.suapId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('suap-pdfs')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Upload do PDF falhou: ${uploadErr.message}`);
    }

    await supabase
      .from('processos')
      .update({
        pdf_url: storagePath,
        status: 'pdf_uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId);

    log(`[${proc.suapId}] PDF sincronizado com sucesso.`);
    return storagePath;
  },

  async runAiExtractionForProcess(
    proc: Pick<ScrapedProcesso, 'suapId'>,
    tenantId: string,
    log: SyncProgressCallback,
    options: { force?: boolean } = {},
  ): Promise<AiExtractionQueueResult> {
    const { data: existing, error: fetchError } = await supabase
      .from('processos')
      .select('status, pdf_url')
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId)
      .single();

    if (fetchError) throw fetchError;
    if (!existing?.pdf_url) {
      log(`[${proc.suapId}] PDF ausente. Baixe o PDF antes da extracao por IA.`);
      return { queued: false, status: 'pdf_missing' };
    }

    if (existing.status === 'success' && !options.force) {
      log(`[${proc.suapId}] Extracao IA ja concluida. Pulando.`);
      return { queued: false, status: 'success' };
    }

    log(`[${proc.suapId}] Executando extracao por Inteligencia Artificial...`);
    const { data: aiRes, error: aiErr } = await supabase.functions.invoke('process-pdf', {
      body: { suap_id: proc.suapId },
    });

    if (aiErr) {
      throw new Error(`Extracao por IA falhou: ${aiErr.message}`);
    }

    if (aiRes?.queued) {
      log(`[${proc.suapId}] Extracao IA enfileirada. Acompanhe o status na tabela.`);
    }

    return {
      queued: Boolean(aiRes?.queued),
      status: typeof aiRes?.status === 'string' ? aiRes.status : 'queued_extraction',
    };
  },

  async processAndSyncSingle(
    proc: ScrapedProcesso | SyncedProcesso,
    suapSessionId: string,
    tenantId: string,
    log: SyncProgressCallback,
    options: { forcePdf?: boolean; forceAi?: boolean } = {},
  ): Promise<AiExtractionQueueResult> {
    await this.downloadPdfForProcess(proc, suapSessionId, tenantId, log, { force: options.forcePdf });
    return this.runAiExtractionForProcess(proc, tenantId, log, { force: options.forceAi });
  },
  // Descobre todas as caixas de processos disponíveis analisando o HTML principal da caixa do SUAP
  discoverCaixasProcessos(html: string): Array<{ nome: string; url: string }> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // O menu lateral de filtros/caixas do SUAP costuma usar links apontando para caixa_processos
    const links = Array.from(doc.querySelectorAll('a[href*="/processo_eletronico/caixa_processos/"]'));
    const caixasMap = new Map<string, string>(); // url -> nome
    
    // Caixa padrão (Recebidos)
    caixasMap.set('https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/', 'Caixa de Entrada (Padrão)');

    for (const link of links) {
      const href = link.getAttribute('href') || '';
      let fullUrl = href;
      if (href.startsWith('/')) {
        fullUrl = `https://suap.ifrn.edu.br${href}`;
      } else if (!href.startsWith('http')) {
        fullUrl = `https://suap.ifrn.edu.br/processo_eletronico/caixa_processos/${href}`;
      }
      
      const nome = link.textContent?.trim().replace(/\s+/g, ' ') || '';
      // Limpar nomes vazios ou links repetitivos de paginação/filtros
      if (!nome || nome.includes('Anterior') || nome.includes('Próximo') || nome.match(/^\d+$/)) {
        continue;
      }
      
      // Ignorar parâmetros de paginação (?page=) que alteram a mesma caixa
      if (fullUrl.includes('page=')) continue;
      
      caixasMap.set(fullUrl, nome);
    }
    
    return Array.from(caixasMap.entries()).map(([url, nome]) => ({ nome, url }));
  },

  // CRUD de caixas de processos no banco de dados do Supabase
  async fetchCaixas(tenantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addCaixa(tenantId: string, nome: string, url: string, syncAutomatica = true): Promise<any> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .insert({
        tenant_id: tenantId,
        nome,
        url,
        sync_automatica: syncAutomatica,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCaixa(caixaId: string, tenantId: string): Promise<void> {
    const { error } = await supabase
      .from('suap_caixas')
      .delete()
      .eq('id', caixaId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
  },

  async toggleSyncAutomatica(caixaId: string, tenantId: string, enabled: boolean): Promise<any> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .update({ sync_automatica: enabled, updated_at: new Date().toISOString() })
      .eq('id', caixaId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLastSyncTime(caixaId: string, tenantId: string): Promise<void> {
    await supabase
      .from('suap_caixas')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', caixaId)
      .eq('tenant_id', tenantId);
  },

  // Valida se um cookie de sessão do SUAP ainda é ativo
  async validateSession(suapSessionId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('suap-proxy', {
        body: {
          path: '/processo_eletronico/caixa_processos/',
          method: 'GET',
          suapSessionId,
        },
      });

      if (error || !data?.text) return false;
      
      // Se contiver o form de login do Django, a sessão expirou
      if (data.text.includes('id="login-form"') || data.text.includes('/accounts/login/')) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
};
