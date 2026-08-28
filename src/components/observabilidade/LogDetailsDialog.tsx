import { AlertCircle, CheckCircle2, Clock, Copy, FileText, Info, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnifiedLogEntry } from '@/services/dataImportLogsService';

interface LogDetailsDialogProps {
  log: UnifiedLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogDetailsDialog({ log, open, onOpenChange }: LogDetailsDialogProps) {
  if (!log) return null;

  const handleCopyJson = () => {
    try {
      const formatted = JSON.stringify(log, null, 2);
      navigator.clipboard.writeText(formatted);
      toast.success('Detalhes do log copiados para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar os dados.');
    }
  };

  const getStatusBadge = () => {
    switch (log.status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Sucesso
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Falha
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Atenção / Parcial
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="outline" className="text-slate-500">
            <Info className="mr-1 h-3 w-3" />
            Ignorado / Duplicado
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="border-blue-500/30 bg-blue-500/10 text-blue-600">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Em processamento
          </Badge>
        );
    }
  };

  const getSourceTypeLabel = () => {
    switch (log.sourceType) {
      case 'manual_upload':
        return '📁 Upload Manual no Navegador';
      case 'email_csv':
        return '✉️ Ingestão Automatizada por E-mail (Gmail)';
      case 'api_sync':
        return '⚡ Sincronização via API / Robô';
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <FileText className="h-5 w-5 text-primary" />
              Detalhes da Execução de Ingestão
            </DialogTitle>
            {getStatusBadge()}
          </div>
          <DialogDescription className="text-xs text-text-secondary">
            Registro detalhado de processamento e auditoria da base de dados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {/* Informações Básicas */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border-default bg-surface-subtle p-3">
            <div>
              <p className="text-text-muted">Pipeline / Dataset</p>
              <p className="font-semibold text-text-primary">{log.pipelineLabel}</p>
            </div>
            <div>
              <p className="text-text-muted">Canal de Ingestão</p>
              <p className="font-medium text-text-primary">{getSourceTypeLabel()}</p>
            </div>
            <div>
              <p className="text-text-muted">Origem / Arquivo</p>
              <p className="font-mono text-text-primary break-all">{log.sourceName}</p>
            </div>
            <div>
              <p className="text-text-muted">Data / Hora de Processamento</p>
              <p className="font-medium text-text-primary">{formatDateTime(log.timestamp)}</p>
            </div>
            {log.userEmail && (
              <div>
                <p className="text-text-muted">Responsável / Remetente</p>
                <p className="font-medium text-text-primary">{log.userEmail}</p>
              </div>
            )}
            {log.durationMs !== undefined && (
              <div>
                <p className="text-text-muted">Tempo de Execução</p>
                <p className="font-medium text-text-primary">{(log.durationMs / 1000).toFixed(2)}s</p>
              </div>
            )}
          </div>

          {/* Métricas de Linhas */}
          <div className="rounded-lg border border-border-default p-3">
            <h4 className="mb-2 font-semibold text-text-primary">Métricas de Volume Processado</h4>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded bg-surface-card p-2 border border-border-subtle">
                <p className="text-[10px] text-text-muted uppercase">Detectadas</p>
                <p className="text-sm font-bold text-text-primary">{log.rowsDetected}</p>
              </div>
              <div className="rounded bg-emerald-500/10 p-2 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase">Gravadas</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{log.rowsWritten}</p>
              </div>
              <div className="rounded bg-blue-500/10 p-2 border border-blue-500/20">
                <p className="text-[10px] text-blue-700 dark:text-blue-300 uppercase">Atualizadas</p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{log.rowsUpdated}</p>
              </div>
              <div className="rounded bg-amber-500/10 p-2 border border-amber-500/20">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 uppercase">Ignoradas</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{log.rowsSkipped}</p>
              </div>
            </div>
          </div>

          {/* Mensagem de Erro se houver */}
          {log.errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                <AlertCircle className="h-4 w-4" />
                Mensagem de Erro / Motivo da Falha:
              </div>
              <p className="font-mono text-xs whitespace-pre-wrap break-all">{log.errorMessage}</p>
            </div>
          )}

          {/* Metadados JSON */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="font-semibold text-text-primary">Metadados Técnicos</h4>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={handleCopyJson}>
                  <Copy className="h-3 w-3" />
                  Copiar JSON
                </Button>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg border border-border-default bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
