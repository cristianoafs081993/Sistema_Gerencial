import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import {
  getSuapExtensionProcessContext,
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
  SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE,
  type SuapExtensionProcessContext,
} from '@/lib/suapExtensionDispatch';
import { suapProcessFinanceService, type SuapProcessFinanceSummary } from '@/services/suapProcessFinance';

function postMessageToSuapParent(message: unknown) {
  try {
    window.parent.postMessage(message, SUAP_EXTENSION_ORIGIN);
  } catch {
    // Em testes ou acesso direto, a janela pai pode nao ser o SUAP.
  }
}

function postSummary(summary: SuapProcessFinanceSummary) {
  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE,
    version: 1,
    payload: summary,
  });
}

export default function SuapExtensionProcessInfo() {
  const { user } = useAuth();
  const userId = user?.id;
  const [context, setContext] = useState<SuapExtensionProcessContext | null>(null);
  const [status, setStatus] = useState('Aguardando o contexto do processo SUAP...');

  useEffect(() => {
    let readyAttempts = 0;
    let readyInterval: ReturnType<typeof setInterval> | null = null;

    const stopReadySignal = () => {
      if (!readyInterval) return;
      clearInterval(readyInterval);
      readyInterval = null;
    };

    const announceReady = () => {
      readyAttempts += 1;
      postMessageToSuapParent(SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE);
      if (readyAttempts >= 20) stopReadySignal();
    };

    const receiveContext = (event: MessageEvent) => {
      const nextContext = getSuapExtensionProcessContext(event, window.parent);
      if (!nextContext) return;
      stopReadySignal();
      setContext(nextContext);
      setStatus('Consultando empenhos do beneficiario no SIAGES...');
    };

    window.addEventListener('message', receiveContext);
    announceReady();
    readyInterval = setInterval(announceReady, 500);

    return () => {
      stopReadySignal();
      window.removeEventListener('message', receiveContext);
    };
  }, []);

  useEffect(() => {
    if (!context || !userId) return;

    let active = true;
    setStatus('Consultando empenhos do beneficiario no SIAGES...');

    void suapProcessFinanceService.getSummaryBySuapId(context.suapId)
      .then((summary) => {
        if (!active) return;
        postSummary(summary);
        setStatus(summary.status === 'ready' ? 'Resumo financeiro enviado ao SUAP.' : 'Resumo financeiro indisponivel para este processo.');
      })
      .catch(() => {
        if (!active) return;
        postSummary({
          status: 'empty',
          escopoContrato: false,
          totais: { empenhado: 0, liquidado: 0, saldo: 0 },
          empenhos: [],
        });
        setStatus('Nao foi possivel consultar os dados financeiros deste processo.');
      });

    return () => {
      active = false;
    };
  }, [context, userId]);

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
