import { supabase } from '@/lib/supabase';
import {
  parseSuapProcessDocumentManifest,
  runWithConcurrency,
} from '@/lib/suapProcessDocuments';
import type { SuapProcessDocument } from '@/types';

export interface ScrapedProcesso {
  suapId: string;
  numProcesso?: string;
  url: string;
  caixa?: string;
}

export type SyncProgressCallback = (message: string) => void;
export type SyncedProcesso = ScrapedProcesso & {
  processId: string;
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

function base64ToUint8Array(base64: string) {
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let index = 0; index < byteChars.length; index += 1) {
    byteArray[index] = byteChars.charCodeAt(index);
  }
  return byteArray;
}

function mapProcessDocumentRow(row: SuapProcessDocumentRow): SuapProcessDocument {
  return {
    id: row.id,
    processoId: row.processo_id,
    tenantId: row.tenant_id || undefined,
    suapDocumentId: row.suap_documento_id,
    order: row.ordem,
    title: row.titulo,
    documentType: row.tipo || undefined,
    originalUrl: row.url_original,
    classification: row.classificacao,
    classificationReason: row.motivo_classificacao || undefined,
    downloadStatus: row.download_status,
    storagePath: row.storage_path || undefined,
    byteSize: row.byte_size ?? undefined,
    pageCount: row.page_count ?? undefined,
    downloadError: row.download_error || undefined,
    downloadedAt: row.downloaded_at ? new Date(row.downloaded_at) : undefined,
  };
}

type SuapProcessDocumentRow = {
  id: string;
  processo_id: string;
  tenant_id: string | null;
  suap_documento_id: string;
  ordem: number;
  titulo: string;
  tipo: string | null;
  url_original: string;
  classificacao: 'included' | 'excluded';
  motivo_classificacao: string | null;
  download_status: 'pending' | 'downloading' | 'downloaded' | 'failed';
  storage_path: string | null;
  byte_size: number | null;
  page_count: number | null;
  download_error: string | null;
  downloaded_at: string | null;
};

export type IndividualDocumentPilotResult = AiExtractionQueueResult & {
  includedDocuments: number;
  excludedDocuments: number;
  usedFullPdfFallback: boolean;
};

const INDIVIDUAL_DOCUMENT_DOWNLOAD_CONCURRENCY = 4;

function buildProcessDocumentStoragePath(tenantId: string, suapId: string, suapDocumentId: string) {
  return `${tenantId}/${suapId}/documents/${suapDocumentId}.pdf`;
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

async function storeProcessPdf(
  proc: Pick<ScrapedProcesso, 'suapId'>,
  pdfBytes: ArrayBuffer | Uint8Array,
  tenantId: string,
  log: SyncProgressCallback,
) {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  if (bytes.length < 4 || String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') {
    throw new Error('O arquivo recebido do SUAP nao e um PDF valido.');
  }

  log(`[${proc.suapId}] Fazendo upload do PDF para o bucket suap-pdfs...`);
  const storagePath = `${tenantId}/${proc.suapId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('suap-pdfs')
    .upload(storagePath, new Blob([bytes], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) throw new Error(`Upload do PDF falhou: ${uploadErr.message}`);

  const now = new Date().toISOString();
  const { data: statusUpdated, error: updateError } = await supabase
    .from('processos')
    .update({ pdf_url: storagePath, status: 'pdf_uploaded', updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('suap_id', proc.suapId)
    .in('status', ['pending_extraction', 'pdf_uploaded'])
    .select('id')
    .maybeSingle();
  if (updateError) throw updateError;

  // O PDF completo continua canônico, mas uma geração em segundo plano não pode
  // regredir o status de uma extração que já foi enfileirada ou concluída.
  if (!statusUpdated) {
    const { error: canonicalUrlError } = await supabase
      .from('processos')
      .update({ pdf_url: storagePath, updated_at: now })
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId);
    if (canonicalUrlError) throw canonicalUrlError;
  }

  log(`[${proc.suapId}] PDF sincronizado com sucesso.`);
  return storagePath;
}

// Portabilidade do scraping da página de listagem do SUAP
type IndividualDocumentInventory = {
  processId: string;
  included: SuapProcessDocument[];
  excluded: SuapProcessDocument[];
};

async function syncIndividualDocumentInventory(
  proc: Pick<ScrapedProcesso, 'suapId'>,
  suapSessionId: string,
  tenantId: string,
  log: SyncProgressCallback,
): Promise<IndividualDocumentInventory> {
  const { data: processRecord, error: processError } = await supabase
    .from('processos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('suap_id', proc.suapId)
    .single();
  if (processError || !processRecord) throw processError || new Error('Processo não encontrado.');

  log(`[${proc.suapId}] Piloto: inventariando os documentos individuais...`);
  const detail = await fetchViaProxy(`/processo_eletronico/processo/${proc.suapId}/`, suapSessionId);
  const candidates = parseSuapProcessDocumentManifest(detail.text || '');
  if (candidates.length === 0) throw new Error('Nenhum documento individual foi localizado na página do processo.');

  const inventoryRows = candidates.map((document) => ({
    tenant_id: tenantId,
    processo_id: processRecord.id,
    suap_documento_id: document.suapDocumentId,
    ordem: document.order,
    titulo: document.title,
    tipo: document.documentType,
    url_original: document.originalUrl,
    classificacao: document.classification,
    motivo_classificacao: document.classificationReason,
  }));
  const { error: upsertError } = await supabase
    .from('suap_processo_documentos')
    .upsert(inventoryRows, { onConflict: 'tenant_id,processo_id,suap_documento_id' });
  if (upsertError) throw upsertError;

  const { data: rows, error: inventoryError } = await supabase
    .from('suap_processo_documentos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('processo_id', processRecord.id)
    .in('suap_documento_id', candidates.map((candidate) => candidate.suapDocumentId))
    .order('ordem', { ascending: true });
  if (inventoryError) throw inventoryError;

  const documents = ((rows || []) as SuapProcessDocumentRow[]).map(mapProcessDocumentRow);
  return {
    processId: processRecord.id,
    included: documents.filter((document) => document.classification === 'included'),
    excluded: documents.filter((document) => document.classification === 'excluded'),
  };
}

async function downloadEligibleIndividualDocuments(
  proc: Pick<ScrapedProcesso, 'suapId'>,
  suapSessionId: string,
  tenantId: string,
  documents: SuapProcessDocument[],
  log: SyncProgressCallback,
) {
  const pending = documents.filter((document) => document.downloadStatus !== 'downloaded' || !document.storagePath);
  if (pending.length === 0) return { downloaded: documents, failed: [] as Array<{ document: SuapProcessDocument; error: unknown }> };

  log(`[${proc.suapId}] Piloto: baixando ${pending.length} PDF(s) úteis (até ${INDIVIDUAL_DOCUMENT_DOWNLOAD_CONCURRENCY} em paralelo)...`);
  const results = await runWithConcurrency(
    pending.map((document) => async () => {
      const { error: startingError } = await supabase
        .from('suap_processo_documentos')
        .update({ download_status: 'downloading', download_error: null })
        .eq('id', document.id)
        .eq('tenant_id', tenantId);
      if (startingError) throw startingError;

      try {
        const response = await fetchViaProxy(new URL(document.originalUrl).pathname + '?original=sim', suapSessionId);
        if (!response?.base64) throw new Error('O SUAP não retornou o PDF original.');
        const bytes = base64ToUint8Array(response.base64);
        if (bytes.length < 4 || String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') {
          throw new Error('O documento retornado pelo SUAP não é um PDF válido.');
        }
        const storagePath = buildProcessDocumentStoragePath(tenantId, proc.suapId, document.suapDocumentId);
        const { error: uploadError } = await supabase.storage
          .from('suap-pdfs')
          .upload(storagePath, new Blob([bytes], { type: 'application/pdf' }), {
            contentType: 'application/pdf',
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { error: completedError } = await supabase
          .from('suap_processo_documentos')
          .update({
            download_status: 'downloaded',
            storage_path: storagePath,
            byte_size: bytes.length,
            download_error: null,
            downloaded_at: new Date().toISOString(),
          })
          .eq('id', document.id)
          .eq('tenant_id', tenantId);
        if (completedError) throw completedError;
        return { ...document, downloadStatus: 'downloaded' as const, storagePath, byteSize: bytes.length };
      } catch (error) {
        await supabase
          .from('suap_processo_documentos')
          .update({ download_status: 'failed', download_error: error instanceof Error ? error.message : String(error) })
          .eq('id', document.id)
          .eq('tenant_id', tenantId);
        throw error;
      }
    }),
    INDIVIDUAL_DOCUMENT_DOWNLOAD_CONCURRENCY,
  );

  const failed = results.rejected.map((entry) => ({ document: pending[entry.index], error: entry.reason }));
  const downloaded = [
    ...documents.filter((document) => !pending.some((pendingDocument) => pendingDocument.id === document.id)),
    ...results.fulfilled,
  ];
  return { downloaded, failed };
}

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
      .select('id, suap_id, status, num_processo, pdf_url')
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
          processId: existing.id,
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

      const { data: inserted, error: insertError } = await supabase
        .from('processos')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;

      synced.push({
        ...proc,
        processId: inserted.id,
        already_exists: false,
        created: true,
        status: 'pending_extraction',
        pdfUrl: null,
      });
    }

    return synced;
  },

  async reconcileProcessBoxMemberships(
    caixaId: string,
    processIds: string[],
    tenantId: string,
  ): Promise<void> {
    const uniqueProcessIds = [...new Set(processIds)];
    const { data: currentMemberships, error: selectError } = await supabase
      .from('suap_processo_caixas')
      .select('processo_id')
      .eq('tenant_id', tenantId)
      .eq('caixa_id', caixaId);

    if (selectError) throw selectError;

    const observedProcessIds = new Set(uniqueProcessIds);
    const staleProcessIds = (currentMemberships || [])
      .map((membership) => membership.processo_id as string)
      .filter((processId) => !observedProcessIds.has(processId));

    if (staleProcessIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('suap_processo_caixas')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('caixa_id', caixaId)
        .in('processo_id', staleProcessIds);

      if (deleteError) throw deleteError;
    }

    if (uniqueProcessIds.length === 0) return;

    const { error: upsertError } = await supabase
      .from('suap_processo_caixas')
      .upsert(
        uniqueProcessIds.map((processoId) => ({
          processo_id: processoId,
          caixa_id: caixaId,
          tenant_id: tenantId,
          last_seen_at: new Date().toISOString(),
        })),
        { onConflict: 'processo_id,caixa_id' },
      );

    if (upsertError) throw upsertError;
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

    const byteChars = atob(pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    return storeProcessPdf(proc, byteArray, tenantId, log);
  },

  async storePdfBytesForProcess(
    proc: Pick<ScrapedProcesso, 'suapId'>,
    pdfBytes: ArrayBuffer | Uint8Array,
    tenantId: string,
    log: SyncProgressCallback,
  ) {
    return storeProcessPdf(proc, pdfBytes, tenantId, log);
  },

  async runAiExtractionForProcess(
    proc: Pick<ScrapedProcesso, 'suapId'>,
    tenantId: string,
    log: SyncProgressCallback,
    options: {
      force?: boolean;
      inputStrategy?: 'full' | 'eligible_documents';
      inputDocumentIds?: string[];
      stageMetrics?: Record<string, unknown>;
    } = {},
  ): Promise<AiExtractionQueueResult> {
    const { data: existing, error: fetchError } = await supabase
      .from('processos')
      .select('status, pdf_url')
      .eq('tenant_id', tenantId)
      .eq('suap_id', proc.suapId)
      .single();

    if (fetchError) throw fetchError;
    const inputStrategy = options.inputStrategy || 'full';
    if (inputStrategy === 'full' && !existing?.pdf_url) {
      log(`[${proc.suapId}] PDF ausente. Baixe o PDF antes da extracao por IA.`);
      return { queued: false, status: 'pdf_missing' };
    }

    if (existing.status === 'success' && !options.force) {
      log(`[${proc.suapId}] Extracao IA ja concluida. Pulando.`);
      return { queued: false, status: 'success' };
    }

    log(`[${proc.suapId}] Executando extracao por Inteligencia Artificial...`);
    const aiInvocation = inputStrategy === 'eligible_documents'
      ? supabase.functions.invoke('process-pdf', {
          body: {
            suap_id: proc.suapId,
            input_strategy: inputStrategy,
            input_document_ids: options.inputDocumentIds || [],
            stage_metrics: options.stageMetrics || {},
          },
        })
      : options.stageMetrics
        ? supabase.functions.invoke('process-pdf', {
            body: { suap_id: proc.suapId, stage_metrics: options.stageMetrics },
          })
        : supabase.functions.invoke('process-pdf', {
            body: { suap_id: proc.suapId },
          });
    const { data: aiRes, error: aiErr } = await aiInvocation;

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

  async runIndividualDocumentPilotForProcess(
    proc: ScrapedProcesso | SyncedProcesso,
    suapSessionId: string,
    tenantId: string,
    log: SyncProgressCallback,
  ): Promise<IndividualDocumentPilotResult> {
    const startedAt = Date.now();
    let fullPdfError: Error | null = null;
    const fullPdfPromise = this.downloadPdfForProcess(proc, suapSessionId, tenantId, log, { force: true })
      .catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        fullPdfError = normalizedError;
        log(`[${proc.suapId}] Piloto: PDF completo indisponível para fallback (${normalizedError.message}).`);
        return null;
      });

    let inventory: IndividualDocumentInventory;
    try {
      inventory = await syncIndividualDocumentInventory(proc, suapSessionId, tenantId, log);
    } catch (error) {
      log(`[${proc.suapId}] Piloto: inventário indisponível; usando PDF completo como fallback.`);
      await fullPdfPromise;
      if (fullPdfError) throw fullPdfError;
      const queued = await this.runAiExtractionForProcess(proc, tenantId, log, {
        force: true,
        stageMetrics: { strategy_fallback: 'full', total_ms: Date.now() - startedAt },
      });
      return { ...queued, includedDocuments: 0, excludedDocuments: 0, usedFullPdfFallback: true };
    }

    const downloadStartedAt = Date.now();
    const downloads = await downloadEligibleIndividualDocuments(
      proc,
      suapSessionId,
      tenantId,
      inventory.included,
      log,
    );
    const stageMetrics = {
      inventory_ms: downloadStartedAt - startedAt,
      documents_download_ms: Date.now() - downloadStartedAt,
      selected_documents: inventory.included.length,
      ignored_documents: inventory.excluded.length,
      selected_document_bytes: downloads.downloaded.reduce((total, document) => total + (document.byteSize || 0), 0),
    };

    if (inventory.included.length === 0 || downloads.failed.length > 0 || downloads.downloaded.length !== inventory.included.length) {
      const failedTitles = downloads.failed.map(({ document }) => document.title).join(', ');
      log(`[${proc.suapId}] Piloto: peça relevante indisponível${failedTitles ? ` (${failedTitles})` : ''}; aguardando PDF completo.`);
      await fullPdfPromise;
      if (fullPdfError) throw new Error(`Os PDFs individuais falharam e o fallback completo não ficou disponível: ${fullPdfError.message}`);
      const queued = await this.runAiExtractionForProcess(proc, tenantId, log, {
        force: true,
        stageMetrics: { ...stageMetrics, strategy_fallback: 'full', total_ms: Date.now() - startedAt },
      });
      return {
        ...queued,
        includedDocuments: inventory.included.length,
        excludedDocuments: inventory.excluded.length,
        usedFullPdfFallback: true,
      };
    }

    const queued = await this.runAiExtractionForProcess(proc, tenantId, log, {
      force: true,
      inputStrategy: 'eligible_documents',
      inputDocumentIds: downloads.downloaded.map((document) => document.id),
      stageMetrics: { ...stageMetrics, total_ms_until_queue: Date.now() - startedAt },
    });
    return {
      ...queued,
      includedDocuments: inventory.included.length,
      excludedDocuments: inventory.excluded.length,
      usedFullPdfFallback: false,
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
