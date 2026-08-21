import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  getSuapExtensionProcessContext,
  isValidSuapExtensionProcessPdfResult,
  isValidSuapExtensionProcessRetry,
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
  SUAP_EXTENSION_PROCESS_FLOW_TYPE,
  SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE,
  SUAP_EXTENSION_PROCESS_PDF_REQUEST_TYPE,
  SUAP_EXTENSION_PROCESS_SNAPSHOT_TYPE,
  SUAP_EXTENSION_PROCESS_SYNC_STATUS_TYPE,
  type SuapExtensionProcessContext,
  type SuapExtensionProcessSyncStatus,
} from '@/lib/suapExtensionDispatch';
import { suapProcessFinanceService, type SuapProcessFinanceSummary } from '@/services/suapProcessFinance';
import { suapProcessosService } from '@/services/suapProcessos';
import { suapScraperService } from '@/services/suapScraperService';
import { processMappingsService } from '@/services/processMappings';
import { buildSuapProcessFlowSummary } from '@/lib/suapProcessFlow';
import { supabase } from '@/lib/supabase';
import type { SuapProcesso } from '@/types';

const PROCESSING_STATUSES = new Set([
  'queued_extraction',
  'processing_extraction',
  'processing_chunks',
  'consolidating_extraction',
]);
const READY_STATUSES = new Set(['success', 'incomplete_extraction']);

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
  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_PROCESS_SNAPSHOT_TYPE,
    version: 1,
    payload: {
      process,
      fallback: { suapId: context.suapId, processNumber: context.processNumber, processUrl: context.processUrl },
    },
  });
}

function postSyncStatus(payload: SuapExtensionProcessSyncStatus) {
  postMessageToSuapParent({ source: 'siages', type: SUAP_EXTENSION_PROCESS_SYNC_STATUS_TYPE, version: 1, payload });
}

async function postProcessFlow(context: SuapExtensionProcessContext, process: SuapProcesso | null) {
  const mappings = await processMappingsService.listPublished();
  const mapping = mappings.find((item) => item.id === context.route?.selectedMappingId) || mappings[0];
  if (!mapping) return;

  const summary = buildSuapProcessFlowSummary(mapping, context.route, {
    suapId: context.suapId,
    processCompleted: Boolean(process?.dadosCompletos?.workflow?.concluido),
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

async function delay(milliseconds: number) {
  await new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function SuapExtensionProcessInfo() {
  const [context, setContext] = useState<SuapExtensionProcessContext | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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
    let active = true;
    const isActive = () => active;
    const publishProcess = async () => {
      const process = await suapProcessosService.getBySuapId(context.suapId);
      if (!active) return process;
      postSnapshot(context, process);
      return process;
    };
    const publishFinance = async () => {
      const summary = await suapProcessFinanceService.getSummaryBySuapId(context.suapId);
      if (active) postSummary(summary);
    };

    void (async () => {
      const extensionSession = context.extensionSession;
      if (!extensionSession) throw new Error('Entre no SIAGES pela aba Configuracoes para sincronizar este processo.');

      postSyncStatus({ stage: 'checking', message: 'Consultando o processo no SIAGES...' });
      const { data, error } = await supabase.auth.setSession({
        access_token: extensionSession.accessToken,
        refresh_token: extensionSession.refreshToken,
      });
      if (error || !data.session) throw error ?? new Error('Nao foi possivel iniciar a sessao da extensao.');
      // O service worker da extensao e o unico responsavel por renovar este refresh token.
      supabase.auth.stopAutoRefresh();
      const tenantId = data.session.user.id;

      let process = await publishProcess();
      if (!process) {
        postSyncStatus({ stage: 'registering', message: 'Registrando o processo no SIAGES...' });
        await suapScraperService.syncProcessListInSupabase([{
          suapId: context.suapId,
          numProcesso: context.processNumber,
          url: context.processUrl,
        }], tenantId);
        process = await publishProcess();
      }
      if (!process) throw new Error('Nao foi possivel registrar o processo no SIAGES.');

      await postProcessFlow(context, process);
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
        await suapScraperService.storePdfBytesForProcess({ suapId: context.suapId }, bytes, tenantId, () => undefined);
        process = await publishProcess();
      }

      if (!process || !PROCESSING_STATUSES.has(process.status)) {
        const result = await suapScraperService.runAiExtractionForProcess(
          { suapId: context.suapId },
          tenantId,
          () => undefined,
          { force: retryCount > 0 },
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
