import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { Atividade, Descentralizacao, Empenho } from '@/types';
import {
  getSuapExtensionPlanContext,
  SUAP_EXTENSION_ORIGIN,
  SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE,
  SUAP_EXTENSION_PLAN_SUMMARY_READY_MESSAGE,
  SUAP_EXTENSION_PLAN_SUMMARY_TYPE,
  type SuapExtensionPlanContext,
  type SuapExtensionPlanSummaryErrorMessage,
  type SuapExtensionPlanSummaryMessage,
} from '@/lib/suapExtensionDispatch';
import { atividadesService } from '@/services/atividades';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { empenhosService } from '@/services/empenhos';
import { buildSuapPlanSummary } from '@/services/suapPlanSummary';

type PlanData = {
  atividades: Atividade[];
  descentralizacoes: Descentralizacao[];
  empenhos: Empenho[];
};

function postMessageToSuapParent(message: unknown) {
  try {
    window.parent.postMessage(message, SUAP_EXTENSION_ORIGIN);
  } catch {
    // Em acesso direto ou em testes, a janela pai pode não ser o SUAP.
  }
}

export default function SuapExtensionPlanSummary() {
  const [context, setContext] = useState<SuapExtensionPlanContext | null>(null);
  const [data, setData] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState('Aguardando o contexto do plano SUAP...');

  useEffect(() => {
    let active = true;
    Promise.all([
      atividadesService.getAll(),
      descentralizacoesService.getAll(),
      empenhosService.getAll(),
    ])
      .then(([atividades, descentralizacoes, empenhos]) => {
        if (active) setData({ atividades, descentralizacoes, empenhos });
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let attempts = 0;
    const announceReady = () => {
      attempts += 1;
      postMessageToSuapParent(SUAP_EXTENSION_PLAN_SUMMARY_READY_MESSAGE);
    };
    const interval = window.setInterval(() => {
      if (attempts >= 20) {
        window.clearInterval(interval);
        return;
      }
      announceReady();
    }, 500);
    const receiveContext = (event: MessageEvent) => {
      const nextContext = getSuapExtensionPlanContext(event, window.parent);
      if (!nextContext) return;
      window.clearInterval(interval);
      setContext(nextContext);
      setStatus('Consultando o resumo orçamentário no SIAGES...');
    };

    window.addEventListener('message', receiveContext);
    announceReady();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('message', receiveContext);
    };
  }, []);

  useEffect(() => {
    if (!context) return;

    if (loadError) {
      const message: SuapExtensionPlanSummaryErrorMessage = {
        source: 'siages',
        type: SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE,
        version: 1,
        payload: { message: 'Não foi possível consultar o resumo no SIAGES. Tente novamente.' },
      };
      postMessageToSuapParent(message);
      setStatus(message.payload.message);
      return;
    }
    if (!data) return;

    const summary = buildSuapPlanSummary(data);
    const message: SuapExtensionPlanSummaryMessage = {
      source: 'siages',
      type: SUAP_EXTENSION_PLAN_SUMMARY_TYPE,
      version: 1,
      payload: summary,
    };
    postMessageToSuapParent(message);
    setStatus(summary.dimensoes.length
      ? 'Resumo orçamentário enviado ao SUAP.'
      : 'Nenhum registro orçamentário foi encontrado no SIAGES.');
  }, [context, data, loadError]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4 font-ui">
      <div className="flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-600" />
        <span>{status}</span>
      </div>
    </main>
  );
}
