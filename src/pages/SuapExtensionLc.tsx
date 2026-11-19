import { useEffect, useRef, useState } from 'react';
import { Loader2, Table as TableIcon, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

import { LcWorkListEditor } from '@/components/lc/LcWorkListEditor';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { authenticateExtensionAccessToken } from '@/lib/extensionSupabase';
import type { LcSavedList } from '@/lib/lcSavedLists';
import { SUAP_EXTENSION_ORIGIN } from '@/lib/suapExtensionDispatch';
import { loadLatestLCRowsFromDb, type LCRegistro } from '@/services/lcImportService';
import { loadSharedLcSavedLists, saveSharedLcSavedList } from '@/services/lcSavedListsService';
import { countLcGridPendencias, type LcGridRow } from '@/services/lcWorkListBuilder';

export type SuapExtensionLcModalInit = {
  suapId: string;
  processNumber?: string;
  mode: 'open' | 'manual';
  listId?: string;
  nome?: string;
  extensionSession?: {
    accessToken: string;
  } | null;
};

function postToSuapParent(type: string, payload?: unknown) {
  window.parent.postMessage(
    { source: 'siages', type, version: 1, ...(payload !== undefined ? { payload } : {}) },
    SUAP_EXTENSION_ORIGIN,
  );
}

export default function SuapExtensionLc() {
  const [initContext, setInitContext] = useState<SuapExtensionLcModalInit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lcRows, setLcRows] = useState<LCRegistro[]>([]);
  const [savedWorkLists, setSavedWorkLists] = useState<LcSavedList<LcGridRow>[]>([]);
  const [gridRows, setGridRows] = useState<LcGridRow[]>([]);
  const [workListName, setWorkListName] = useState('Lista de trabalho');
  const [activeSavedListId, setActiveSavedListId] = useState<string | null>(null);
  const [isSavingWorkList, setIsSavingWorkList] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const receiveInit = (event: MessageEvent) => {
      if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== window.parent) return;
      const data = event.data as { source?: string; type?: string; payload?: SuapExtensionLcModalInit } | null;
      if (!data || data.source !== 'siages-suap-extension' || data.type !== 'siages:suap-lc-modal-init') return;
      if (data.payload) setInitContext(data.payload);
    };
    window.addEventListener('message', receiveInit);
    postToSuapParent('siages:suap-lc-modal-ready');
    return () => window.removeEventListener('message', receiveInit);
  }, []);

  useEffect(() => {
    if (!initContext) return;
    if (!initContext.extensionSession?.accessToken) {
      setIsLoading(false);
      setErrorMessage('Entre no SIAGES pelo popup da extensão para abrir a Lista de Credores.');
      return;
    }

    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      const { client } = await authenticateExtensionAccessToken(initContext.extensionSession!.accessToken);
      if (!active) return;
      clientRef.current = client;

      const [latestLc, sharedLists] = await Promise.all([
        loadLatestLCRowsFromDb(client),
        loadSharedLcSavedLists<LcGridRow>(client),
      ]);
      if (!active) return;

      setLcRows(latestLc.rows);
      setSavedWorkLists(sharedLists);

      if (initContext.mode === 'open' && initContext.listId) {
        const target = sharedLists.find((item) => item.id === initContext.listId);
        if (!target) {
          setErrorMessage('A lista de trabalho indicada não foi encontrada (pode ter sido excluída).');
        } else {
          setGridRows(target.rows);
          setWorkListName(target.name);
          setActiveSavedListId(target.id);
        }
      } else {
        setGridRows([]);
        setWorkListName(initContext.nome?.trim() || 'Lista manual');
        setActiveSavedListId(null);
      }
    })()
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar a Lista de Credores.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initContext]);

  const handleClose = () => {
    postToSuapParent('siages:suap-lc-modal-close');
  };

  const handleSave = async () => {
    if (!gridRows.length) {
      toast.error('Nao ha dados na grade para salvar.');
      return;
    }
    const client = clientRef.current;
    if (!client) {
      toast.error('Sessão da extensão indisponível.');
      return;
    }

    setIsSavingWorkList(true);
    try {
      const savedList = await saveSharedLcSavedList<LcGridRow>(
        {
          id: activeSavedListId,
          name: workListName,
          sourcePdfNames: [],
          rows: gridRows,
        },
        client,
      );
      setSavedWorkLists((current) => [savedList, ...current.filter((item) => item.id !== savedList.id)]);
      setWorkListName(savedList.name);
      setActiveSavedListId(savedList.id);
      toast.success(`Lista "${savedList.name}" salva e compartilhada com seu órgão.`);
      postToSuapParent('siages:suap-lc-modal-saved', {
        suapId: initContext?.suapId,
        listId: savedList.id,
        name: savedList.name,
        found: savedList.rows.length,
        pendencias: countLcGridPendencias(savedList.rows),
      });
    } catch (error) {
      console.error('Erro ao salvar lista da LC na extensao:', error);
      toast.error('Não foi possível salvar a lista de trabalho.');
    } finally {
      setIsSavingWorkList(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 p-5 overflow-hidden">
      <header className="pb-3 mb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-indigo-500" />
            Lista de Credores
          </h1>
          {initContext?.processNumber && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Processo {initContext.processNumber}
            </p>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Fechar"
          onClick={handleClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando Lista de Credores...
        </div>
      ) : errorMessage ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Fechar
          </Button>
        </div>
      ) : (
        <LcWorkListEditor
          key={`${initContext?.mode || 'open'}-${initContext?.listId || 'manual'}`}
          lcRows={lcRows}
          gridRows={gridRows}
          onGridRowsChange={setGridRows}
          workListName={workListName}
          onWorkListNameChange={setWorkListName}
          savedWorkLists={savedWorkLists}
          isSavingWorkList={isSavingWorkList}
          onSave={handleSave}
          onClose={handleClose}
          initialShowManualAdd={initContext?.mode === 'manual'}
          contaPagadora={env.siafiContaPagadora || ''}
        />
      )}
    </div>
  );
}
