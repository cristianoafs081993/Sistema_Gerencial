import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { SuapDocumentGeneratorDialog } from '@/components/suap/SuapDocumentGeneratorDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSuapExtensionProcessContext,
  SUAP_EXTENSION_DISPATCH_CLOSE_MESSAGE,
  SUAP_EXTENSION_ORIGIN,
  type SuapExtensionProcessContext,
} from '@/lib/suapExtensionDispatch';
import { createDispatchQueue, createStandaloneDispatchQueue, type DispatchQueueState } from '@/lib/suapDispatchGeneration';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

type DispatchState = {
  processo: SuapProcesso | null;
  queue: DispatchQueueState;
};

export default function SuapExtensionDispatch() {
  const { user } = useAuth();
  const userId = user?.id;
  const [context, setContext] = useState<SuapExtensionProcessContext | null>(null);
  const [dispatch, setDispatch] = useState<DispatchState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const receiveContext = (event: MessageEvent) => {
      const nextContext = getSuapExtensionProcessContext(event, window.parent);
      if (!nextContext) return;
      setError(null);
      setContext(nextContext);
    };

    window.addEventListener('message', receiveContext);
    return () => window.removeEventListener('message', receiveContext);
  }, []);

  useEffect(() => {
    if (!context || !userId) return;

    let active = true;
    setDispatch(null);
    setError(null);

    void suapProcessosService.getBySuapId(context.suapId)
      .then((processo) => {
        if (!active) return;
        setDispatch({
          processo,
          queue: processo
            ? createDispatchQueue([processo])
            : createStandaloneDispatchQueue({ processo: context.processNumber || '' }),
        });
      })
      .catch(() => {
        if (active) setError('Não foi possível consultar este processo no espelho SUAP. Tente novamente.');
      });

    return () => {
      active = false;
    };
  }, [context, userId]);

  if (error) return <EmbeddedStatus message={error} />;
  if (!dispatch) return <EmbeddedStatus message={context ? 'Preparando o despacho...' : 'Aguardando o contexto do processo SUAP...'} />;

  return (
    <SuapDocumentGeneratorDialog
      open
      onOpenChange={(open) => {
        if (!open) window.parent.postMessage(SUAP_EXTENSION_DISPATCH_CLOSE_MESSAGE, SUAP_EXTENSION_ORIGIN);
      }}
      processos={dispatch.processo ? [dispatch.processo] : []}
      queue={dispatch.queue}
      onQueueChange={(queue) => setDispatch((current) => current ? { ...current, queue } : current)}
    />
  );
}

function EmbeddedStatus({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950/10 p-6 font-ui">
      <div className="flex max-w-sm items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm text-slate-700 shadow-xl">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-600" />
        <span>{message}</span>
      </div>
    </main>
  );
}