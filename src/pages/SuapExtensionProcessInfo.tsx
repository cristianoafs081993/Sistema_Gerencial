import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  getSuapExtensionProcessContext,
  isValidSuapExtensionLcDocumentsResult,
  isValidSuapExtensionLcRebuild,
  isValidSuapExtensionProcessPdfResult,
  isValidSuapExtensionProcessRetry,
  SUAP_EXTENSION_LC_DOCUMENTS_REQUEST_TYPE,
  SUAP_EXTENSION_LC_STATUS_TYPE,
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
  SUAP_EXTENSION_PROCESS_FLOW_TYPE,
  SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE,
  SUAP_EXTENSION_PROCESS_PDF_REQUEST_TYPE,
  SUAP_EXTENSION_PROCESS_SNAPSHOT_TYPE,
  SUAP_EXTENSION_PROCESS_SYNC_STATUS_TYPE,
  type SuapExtensionLcDocument,
  type SuapExtensionLcStatus,
  type SuapExtensionProcessContext,
  type SuapExtensionProcessSyncStatus,
} from '@/lib/suapExtensionDispatch';
import { env } from '@/lib/env';
import { extractBolsistasFromPdfFiles } from '@/services/bolsistasPdfService';
import { loadLatestLCRowsFromDb } from '@/services/lcImportService';
import { findSharedLcSavedListBySuapId, saveSharedLcSavedList } from '@/services/lcSavedListsService';
import type { LcGridRow } from '@/services/lcWorkListBuilder';
import { extractBolsistasWithAi, isBolsaProcess, runSuapLcAutoBuild } from '@/services/suapLcAutoBuildService';
import { suapProcessFinanceService, type SuapProcessFinanceSummary } from '@/services/suapProcessFinance';
import { suapProcessosService } from '@/services/suapProcessos';
import { suapScraperService } from '@/services/suapScraperService';
import { mergePublishedMappings, processMappingsService } from '@/services/processMappings';
import { buildSuapProcessFlowSummary, selectSuapProcessMapping } from '@/lib/suapProcessFlow';
import { authenticateExtensionAccessToken } from '@/lib/extensionSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SuapProcesso } from '@/types';

const PROCESSING_STATUSES = new Set([
  'queued_extraction',
  'processing_extraction',
  'processing_chunks',
  'consolidating_extraction',
]);
const READY_STATUSES = new Set(['success', 'incomplete_extraction']);
const FINANCE_QUERY_TIMEOUT_MS = 30_000;

function postMessageToSuapParent(message: unknown) {
  try {
    window.parent.postMessage(message, SUAP_EXTENSION_ORIGIN);
  } catch {
    // Em testes ou acesso direto, a janela pai pode nao ser o SUAP.
  }
}

function postSummary(summary: SuapProcessFinanceSummary) {
  postMessageToSuapParent({ source: 'siages', type: SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE, version: 1, payload: summary });
}

function postSnapshot(context: SuapExtensionProcessContext, process: SuapProcesso | null) {
  const mergedProcess: SuapProcesso | null = process ? {
    ...process,
    assunto: process.assunto || context.assunto,
    beneficiario: process.beneficiario || context.beneficiario,
    cpfCnpj: process.cpfCnpj || context.cpfCnpj,
    caixa: process.caixa || context.caixa,
  } : (context.assunto || context.beneficiario || context.cpfCnpj || context.caixa ? {
    id: context.suapId,
    suapId: context.suapId,
    url: context.processUrl,
    status: 'pending_extraction',
    numProcesso: context.processNumber,
    assunto: context.assunto,
    beneficiario: context.beneficiario,
    cpfCnpj: context.cpfCnpj,
    caixa: context.caixa,
  } as SuapProcesso : null);

  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_PROCESS_SNAPSHOT_TYPE,
    version: 1,
    payload: {
      process: mergedProcess,
      fallback: { suapId: context.suapId, processNumber: context.processNumber, processUrl: context.processUrl },
    },
  });
}

function postSyncStatus(payload: SuapExtensionProcessSyncStatus) {
  postMessageToSuapParent({ source: 'siages', type: SUAP_EXTENSION_PROCESS_SYNC_STATUS_TYPE, version: 1, payload });
}

async function postProcessFlow(context: SuapExtensionProcessContext, process: SuapProcesso | null, client?: SupabaseClient) {
  let activeClient = client;
  if (!activeClient && context.extensionSession?.accessToken) {
    try {
      const authenticated = await authenticateExtensionAccessToken(context.extensionSession.accessToken);
      activeClient = authenticated.client;
    } catch {
      // Ignora falha de autenticação e usa fallback local
    }
  }
  const publishedMappings = await processMappingsService.listPublished(activeClient);
  const customMappings = (Array.isArray(context.route?.customMappings)
    ? context.route.customMappings
    : (Array.isArray(context.customMappings) ? context.customMappings : [])) as any[];
  const mappings = customMappings.length > 0
    ? mergePublishedMappings(publishedMappings, customMappings)
    : publishedMappings;
  const resolvedAssunto = process?.assunto?.trim() || context.route?.assunto?.trim() || context.assunto?.trim();
  const mapping = selectSuapProcessMapping(mappings, {
    selectedMappingId: context.route?.selectedMappingId,
    assunto: resolvedAssunto,
  });
  if (!mapping) return;

  const summary = buildSuapProcessFlowSummary(mapping, context.route, {
    suapId: context.suapId,
    processCompleted: Boolean(process?.dadosCompletos?.workflow?.concluido),
    manualCurrentStepNodeId: context.route?.manualCurrentStepNodeId,
  });

  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_PROCESS_FLOW_TYPE,
    version: 1,
    payload: {
      suapId: context.suapId,
      summary,
      mappings: mappings.map(({ id, title, code, version }) => ({ id, title, code, version })),
    },
  });
}

function waitForPdf(context: SuapExtensionProcessContext, isActive: () => boolean) {
  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_PROCESS_PDF_REQUEST_TYPE,
    version: 1,
    payload: { suapId: context.suapId },
  });

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receivePdf);
      reject(new Error('Tempo esgotado ao gerar o PDF no SUAP.'));
    }, 10 * 60 * 1000);

    const receivePdf = (event: MessageEvent) => {
      if (!isValidSuapExtensionProcessPdfResult(event, window.parent, context.suapId)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', receivePdf);
      if (!isActive()) return;
      if (event.data.payload.error) reject(new Error(event.data.payload.error));
      else if (event.data.payload.bytes) resolve(event.data.payload.bytes);
      else reject(new Error('O SUAP nao devolveu o PDF do processo.'));
    };

    window.addEventListener('message', receivePdf);
  });
}

function postLcStatus(status: SuapExtensionLcStatus) {
  postMessageToSuapParent({ source: 'siages', type: SUAP_EXTENSION_LC_STATUS_TYPE, version: 1, payload: status });
}

const LC_DOCUMENTS_TIMEOUT_MS = 3 * 60 * 1000;

/** Pede ao content script do SUAP os documentos do processo (texto dos eletronicos e PDF dos anexados). */
function requestLcDocuments(suapId: string, isActive: () => boolean) {
  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_LC_DOCUMENTS_REQUEST_TYPE,
    version: 1,
    payload: { suapId },
  });

  return new Promise<SuapExtensionLcDocument[]>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error('A extensão não enviou os documentos do processo. Atualize a extensão e recarregue a página.'));
    }, LC_DOCUMENTS_TIMEOUT_MS);

    const receive = (event: MessageEvent) => {
      if (!isValidSuapExtensionLcDocumentsResult(event, window.parent, suapId)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      if (!isActive()) return;
      if (event.data.payload.error) reject(new Error(event.data.payload.error));
      else resolve(event.data.payload.documents);
    };

    window.addEventListener('message', receive);
  });
}

async function delay(milliseconds: number) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export default function SuapExtensionProcessInfo() {
  const [context, setContext] = useState<SuapExtensionProcessContext | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lcRebuildCount, setLcRebuildCount] = useState(0);
  const [status, setStatus] = useState('Aguardando o contexto do processo SUAP...');

  useEffect(() => {
    let readyAttempts = 0;
    let readyInterval: ReturnType<typeof setInterval> | null = null;
    const stopReadySignal = () => {
      if (readyInterval) clearInterval(readyInterval);
      readyInterval = null;
    };
    const announceReady = () => {
      readyAttempts += 1;
      postMessageToSuapParent(SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE);
      if (readyAttempts >= 20) stopReadySignal();
    };
    const receiveMessage = (event: MessageEvent) => {
      const nextContext = getSuapExtensionProcessContext(event, window.parent);
      if (nextContext) {
        stopReadySignal();
        setContext(nextContext);
        setStatus('Consultando o processo no SIAGES...');
        postSnapshot(nextContext, null);
        void postProcessFlow(nextContext, null);
        return;
      }
    };

    window.addEventListener('message', receiveMessage);
    announceReady();
    readyInterval = setInterval(announceReady, 500);
    return () => {
      stopReadySignal();
      window.removeEventListener('message', receiveMessage);
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    const receiveRetry = (event: MessageEvent) => {
      if (isValidSuapExtensionProcessRetry(event, window.parent, context.suapId)) {
        setRetryCount((current) => current + 1);
      }
    };
    window.addEventListener('message', receiveRetry);
    return () => window.removeEventListener('message', receiveRetry);
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const receiveRebuild = (event: MessageEvent) => {
      if (isValidSuapExtensionLcRebuild(event, window.parent, context.suapId)) {
        setLcRebuildCount((current) => current + 1);
      }
    };
    window.addEventListener('message', receiveRebuild);
    return () => window.removeEventListener('message', receiveRebuild);
  }, [context]);

  // Lista de credores: em processos de bolsa, monta e salva a lista de trabalho da LC sem intervencao.
  useEffect(() => {
    if (!context?.extensionSession) return;
    // Tipo e assunto vem dos dados gerais da pagina do SUAP; processos que nao sao de bolsa nao fazem nada.
    const assunto = context.assunto?.trim() || context.route?.assunto?.trim() || '';
    if (!isBolsaProcess({ assunto, tipoProcesso: context.tipoProcesso })) return;
    let active = true;
    const isActive = () => active;

    void (async () => {
      const { client } = await authenticateExtensionAccessToken(context.extensionSession!.accessToken);
      if (!active) return;

      await runSuapLcAutoBuild(
        { suapId: context.suapId, processNumber: context.processNumber, assunto, tipoProcesso: context.tipoProcesso },
        {
          requestDocuments: () => requestLcDocuments(context.suapId, isActive),
          extractFromPdf: async (document) => {
            const warnings: string[] = [];
            let expected: number | undefined;
            const file = new File([document.bytes!], `${document.title || document.id}.pdf`, { type: 'application/pdf' });
            const records = await extractBolsistasFromPdfFiles([file], {
              onWarning: (warning) => {
                if (warning.reason === 'count_mismatch') expected = warning.expected;
                else warnings.push(`${document.title}: páginas ${warning.imageOnlyPages?.join(', ')} não lidas por OCR.`);
              },
            });
            return { records, expected, warnings };
          },
          extractWithAi: (input) => extractBolsistasWithAi(input, client),
          loadLcRows: async () => (await loadLatestLCRowsFromDb(client)).rows,
          findExisting: (suapId) => findSharedLcSavedListBySuapId<LcGridRow>(suapId, client),
          save: (input) => saveSharedLcSavedList<LcGridRow>(input, client),
          onStatus: (status) => {
            if (active) postLcStatus(status);
          },
          contaPagadora: env.siafiContaPagadora || '',
        },
        { force: lcRebuildCount > 0 },
      );
    })().catch((caught) => {
      if (!active) return;
      postLcStatus({
        suapId: context.suapId,
        stage: 'error',
        message: caught instanceof Error ? caught.message : 'Não foi possível montar a lista de credores.',
        retryable: true,
      });
    });

    return () => { active = false; };
  }, [context, lcRebuildCount]);

  useEffect(() => {
    if (!context) return;
    let active = true;
    let extensionClient: SupabaseClient | undefined;
    const isActive = () => active;
    const publishProcess = async () => {
      const process = await suapProcessosService.getBySuapId(context.suapId, extensionClient);
      if (!active) return process;
      postSnapshot(context, process);
      return process;
    };
    const publishFinance = async () => {
      postSyncStatus({ stage: 'checking', message: 'Consultando empenhos no SIAGES...' });
      const summary = await withTimeout(
        suapProcessFinanceService.getSummaryBySuapId(context.suapId, extensionClient),
        FINANCE_QUERY_TIMEOUT_MS,
        'A consulta financeira demorou demais. Tente novamente.',
      );
      if (active) postSummary(summary);
    };

    void (async () => {
      const extensionSession = context.extensionSession;
      if (!extensionSession) throw new Error('Entre no SIAGES pela aba Configuracoes para sincronizar este processo.');

      postSyncStatus({ stage: 'checking', message: 'Consultando o processo no SIAGES...' });
      const authenticated = await authenticateExtensionAccessToken(extensionSession.accessToken);
      extensionClient = authenticated.client;
      const tenantId = authenticated.user.id;

      let process = await publishProcess();
      if (!process) {
        postSyncStatus({ stage: 'registering', message: 'Registrando o processo no SIAGES...' });
        await suapScraperService.syncProcessListInSupabase([{
          suapId: context.suapId,
          numProcesso: context.processNumber,
          url: context.processUrl,
        }], tenantId, {}, extensionClient);
        process = await publishProcess();
      }
      if (!process) throw new Error('Nao foi possivel registrar o processo no SIAGES.');

      await postProcessFlow(context, process, extensionClient);
      await publishFinance();
      if (READY_STATUSES.has(process.status)) {
        postSyncStatus({ stage: 'ready', message: 'Dados do processo atualizados.' });
        return;
      }
      if ((process.status.includes('fail') || process.status.includes('error')) && retryCount === 0) {
        throw new Error('A extracao anterior falhou. Use Tentar novamente para repetir o processamento.');
      }

      if (!process.pdfUrl) {
        postSyncStatus({ stage: 'requesting-pdf', message: 'Gerando o PDF no SUAP...' });
        const bytes = await waitForPdf(context, isActive);
        if (!active) return;
        postSyncStatus({ stage: 'uploading-pdf', message: 'Salvando o PDF do processo...' });
        await suapScraperService.storePdfBytesForProcess({ suapId: context.suapId }, bytes, tenantId, () => undefined, extensionClient);
        process = await publishProcess();
      }

      if (!process || !PROCESSING_STATUSES.has(process.status)) {
        const result = await suapScraperService.runAiExtractionForProcess(
          { suapId: context.suapId },
          tenantId,
          () => undefined,
          { force: retryCount > 0 },
          extensionClient,
        );
        postSyncStatus({
          stage: result.queued ? 'queued' : 'processing',
          message: result.queued ? 'Extracao por IA enfileirada.' : 'Acompanhando a extracao por IA...',
        });
      }

      while (active) {
        process = await publishProcess();
        if (!process) throw new Error('O processo deixou de estar disponivel no SIAGES.');
        if (READY_STATUSES.has(process.status)) {
          await publishFinance();
          postSyncStatus({ stage: 'ready', message: 'Dados extraidos e atualizados.' });
          return;
        }
        if (process.status.includes('fail') || process.status.includes('error')) {
          throw new Error(process.dadosCompletos?.extraction_job?.last_error_message || 'A extracao por IA falhou.');
        }
        postSyncStatus({ stage: 'processing', message: 'Extraindo dados do processo por IA...' });
        await delay(5000);
      }
    })()
      .then(() => {
        if (active) setStatus('Sincronizacao concluida.');
      })
      .catch((caught) => {
        if (!active) return;
        const message = caught instanceof Error ? caught.message : 'Nao foi possivel sincronizar este processo.';
        setStatus(message);
        postSyncStatus({ stage: 'error', message, retryable: true });
      });

    return () => { active = false; };
  }, [context, retryCount]);

  return <EmbeddedStatus message={status} />;
}

function EmbeddedStatus({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4 font-ui">
      <div className="flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-600" />
        <span>{message}</span>
      </div>
    </main>
  );
}
