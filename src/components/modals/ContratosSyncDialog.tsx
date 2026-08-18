import { useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { contratosApiService } from '@/services/contratosApi';

type SyncSummary = {
  synced?: number;
  active?: number;
  inactive?: number;
  empenhos?: number;
};

interface ContratosSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

const getSummary = (payload: unknown): SyncSummary => {
  const data = payload as {
    totals?: {
      contratos_upserted?: number;
      contracts_synced?: number;
      contratos_ativos?: number;
      contratos_inativos?: number;
      derived_active_contracts?: number;
      derived_inactive_contracts?: number;
      empenhos_upserted?: number;
    };
  } | null;

  return {
    synced: data?.totals?.contracts_synced ?? data?.totals?.contratos_upserted,
    active: data?.totals?.derived_active_contracts ?? data?.totals?.contratos_ativos,
    inactive: data?.totals?.derived_inactive_contracts ?? data?.totals?.contratos_inativos,
    empenhos: data?.totals?.empenhos_upserted,
  };
};

export function ContratosSyncDialog({
  open,
  onOpenChange,
  onSyncComplete,
}: ContratosSyncDialogProps) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const handleSync = async () => {
    setRunning(true);
    setDone(false);
    setError(null);
    setSummary(null);

    try {
      const result = await contratosApiService.runSync();
      setSummary(getSummary(result));
      setDone(true);
      onSyncComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setRunning(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (running) return;
    if (!nextOpen) {
      setDone(false);
      setError(null);
      setSummary(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-action-primary" />
            Atualizar contratos via Comprasnet
          </DialogTitle>
          <DialogDescription>
            A sincronização automática roda diariamente. Use esta ação apenas quando precisar antecipar a atualização dos contratos, histórico, empenhos e faturas.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border-default/70 bg-surface-subtle/70 p-4 text-sm text-text-secondary">
          {running ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
              Sincronizando contratos e empenhos de todas as UASGs do IFRN...
            </div>
          ) : done ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-status-success">
                <CheckCircle2 className="h-4 w-4" />
                Sincronização concluída com sucesso.
              </div>
              {summary ? (
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <span>Contratos: {summary.synced ?? '-'}</span>
                  <span>Ativos: {summary.active ?? '-'}</span>
                  <span>Inativos: {summary.inactive ?? '-'}</span>
                  <span>Empenhos: {summary.empenhos ?? '-'}</span>
                </div>
              ) : null}
            </div>
          ) : error ? (
            <span className="font-medium text-destructive">Erro: {error}</span>
          ) : (
            <span>
              O sistema usa a vigência derivada do histórico contratual e ignora contratos vencidos que a API ainda retorna como ativos.
            </span>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={running}>
            {done ? 'Fechar' : 'Cancelar'}
          </Button>
          <Button onClick={handleSync} disabled={running || done} className="gap-2">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Concluído
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Atualizar agora
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
