import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileUp,
  Filter,
  Mail,
  RefreshCw,
  Search,
  Server,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { LogDetailsDialog } from '@/components/observabilidade/LogDetailsDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  PipelineModule,
  PipelineRunStatus,
  PipelineSourceType,
  UnifiedLogEntry,
} from '@/services/dataImportLogsService';

interface UnifiedLogsTableProps {
  logs: UnifiedLogEntry[];
  isLoading?: boolean;
  onRefresh?: () => void;
  initialPipelineFilter?: string | null;
  onClearPipelineFilter?: () => void;
}

const MODULE_LABELS: Record<PipelineModule, string> = {
  orcamentario: 'Orçamentário',
  financeiro: 'Financeiro',
  contratos: 'Contratos & Gestão',
  integracoes: 'Integrações',
};

const MODULE_BADGE_VARIANTS: Record<PipelineModule, string> = {
  orcamentario: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  financeiro: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  contratos: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  integracoes: 'border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

export function UnifiedLogsTable({
  logs,
  isLoading,
  onRefresh,
  initialPipelineFilter,
  onClearPipelineFilter,
}: UnifiedLogsTableProps) {
  const [search, setSearch] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<UnifiedLogEntry | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredLogs = logs.filter((log) => {
    if (initialPipelineFilter && log.pipelineKey !== initialPipelineFilter) {
      return false;
    }
    if (selectedSourceType !== 'all' && log.sourceType !== selectedSourceType) {
      return false;
    }
    if (selectedStatus !== 'all' && log.status !== selectedStatus) {
      return false;
    }
    if (selectedModule !== 'all' && log.module !== selectedModule) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        log.pipelineLabel.toLowerCase().includes(q) ||
        log.sourceName.toLowerCase().includes(q) ||
        (log.errorMessage && log.errorMessage.toLowerCase().includes(q)) ||
        (log.userEmail && log.userEmail.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOpenDetails = (log: UnifiedLogEntry) => {
    setSelectedLog(log);
    setIsDetailsOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      toast.info('Nenhum log para exportar.');
      return;
    }

    try {
      const headers = [
        'Data/Hora',
        'Pipeline/Base',
        'Módulo',
        'Canal',
        'Origem/Arquivo',
        'Status',
        'Linhas Detectadas',
        'Linhas Gravadas',
        'Linhas Atualizadas',
        'Linhas Ignoradas',
        'Usuário/Remetente',
        'Mensagem de Erro',
      ];

      const rows = filteredLogs.map((log) => [
        new Date(log.timestamp).toLocaleString('pt-BR'),
        log.pipelineLabel,
        MODULE_LABELS[log.module] || log.module,
        log.sourceType,
        log.sourceName,
        log.status,
        log.rowsDetected,
        log.rowsWritten,
        log.rowsUpdated,
        log.rowsSkipped,
        log.userEmail || '',
        log.errorMessage || '',
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';')),
      ].join('\r\n');

      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logs-observabilidade-ingestoes-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exportados em CSV com sucesso.');
    } catch (err) {
      toast.error('Erro ao exportar logs.');
    }
  };

  const getStatusBadge = (status: PipelineRunStatus) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-normal">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Sucesso
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-[10px] font-normal">
            <XCircle className="mr-1 h-3 w-3" />
            Falha
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[10px] font-normal">
            <AlertCircle className="mr-1 h-3 w-3" />
            Atenção / Parcial
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="outline" className="text-slate-500 text-[10px] font-normal">
            <Clock className="mr-1 h-3 w-3" />
            Ignorado
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="border-blue-500/40 bg-blue-500/10 text-blue-600 text-[10px] font-normal">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Processando
          </Badge>
        );
    }
  };

  const renderSourceTypeBadge = (source: PipelineSourceType) => {
    switch (source) {
      case 'manual_upload':
        return (
          <Badge variant="outline" className="gap-1 border-slate-300 text-slate-700 dark:text-slate-300 text-[10px]">
            <FileUp className="h-3 w-3 text-primary" />
            Manual (Upload)
          </Badge>
        );
      case 'email_csv':
        return (
          <Badge variant="outline" className="gap-1 border-blue-400/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">
            <Mail className="h-3 w-3" />
            E-mail (Gmail)
          </Badge>
        );
      case 'api_sync':
        return (
          <Badge variant="outline" className="gap-1 border-purple-400/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]">
            <Server className="h-3 w-3" />
            Job API / Robô
          </Badge>
        );
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <Card className="border-border-default shadow-sm">
        <CardHeader className="p-4 pb-3 border-b border-border-subtle">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-text-primary">
                  Histórico Cronológico de Ingestões e Atualizações
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-normal">
                  {filteredLogs.length} registro(s)
                </Badge>
              </div>
              <CardDescription className="text-xs text-text-secondary">
                Rastreabilidade completa de envios de arquivos, ingestões recebidas por e-mail e rotinas de sincronização via API.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleExportCsv}
                disabled={filteredLogs.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
              {onRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              )}
            </div>
          </div>

          {/* Filtro ativo de pipeline se selecionado na matriz */}
          {initialPipelineFilter && (
            <div className="mt-2 flex items-center justify-between rounded-md bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <div className="flex items-center gap-1.5 font-medium">
                <Filter className="h-3.5 w-3.5" />
                <span>Filtrando especificamente por: <strong>{initialPipelineFilter}</strong></span>
              </div>
              {onClearPipelineFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px] text-primary hover:text-primary/80"
                  onClick={onClearPipelineFilter}
                >
                  Limpar Filtro
                </Button>
              )}
            </div>
          )}

          {/* Painel de Filtros */}
          <div className="grid gap-2 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <Input
                placeholder="Buscar por arquivo, erro, remetente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={selectedSourceType}
              onChange={(e) => setSelectedSourceType(e.target.value)}
              className="h-8 rounded-md border border-border-default bg-surface-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Canais (Manual, E-mail, API)</option>
              <option value="manual_upload">📁 Upload Manual (Navegador)</option>
              <option value="email_csv">✉️ Ingestão por E-mail (Gmail)</option>
              <option value="api_sync">⚡ Sincronização via API / Robôs</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-border-default bg-surface-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Status</option>
              <option value="success">Sucesso</option>
              <option value="failed">Falha / Erro</option>
              <option value="warning">Atenção / Parcial</option>
              <option value="skipped">Ignorado / Duplicado</option>
              <option value="processing">Em processamento</option>
            </select>

            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-8 rounded-md border border-border-default bg-surface-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Módulos</option>
              <option value="orcamentario">Orçamentário</option>
              <option value="financeiro">Financeiro</option>
              <option value="contratos">Contratos & Gestão</option>
              <option value="integracoes">Integrações</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px] text-xs font-semibold">Data / Hora</TableHead>
                <TableHead className="w-[180px] text-xs font-semibold">Base de Dados</TableHead>
                <TableHead className="w-[130px] text-xs font-semibold">Canal</TableHead>
                <TableHead className="text-xs font-semibold">Origem / Arquivo / Assunto</TableHead>
                <TableHead className="w-[120px] text-xs font-semibold">Status</TableHead>
                <TableHead className="w-[140px] text-center text-xs font-semibold">Linhas (G / A / I)</TableHead>
                <TableHead className="w-[80px] text-right text-xs font-semibold">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-text-muted">
                    Carregando histórico de logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-xs text-text-muted">
                    Nenhum registro de log encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-surface-subtle/60">
                    <TableCell className="py-2.5 font-mono text-[11px] text-text-secondary whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-text-primary">{log.pipelineLabel}</p>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${MODULE_BADGE_VARIANTS[log.module]}`}>
                          {MODULE_LABELS[log.module]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {renderSourceTypeBadge(log.sourceType)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <div className="space-y-0.5">
                        <p className="text-xs text-text-primary font-mono truncate max-w-[280px]" title={log.sourceName}>
                          {log.sourceName}
                        </p>
                        {log.errorMessage ? (
                          <p className="text-[11px] text-destructive font-medium line-clamp-1" title={log.errorMessage}>
                            Erro: {log.errorMessage}
                          </p>
                        ) : log.userEmail ? (
                          <p className="text-[10px] text-text-muted">{log.userEmail}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      <div className="inline-flex items-center gap-1 font-mono text-[11px]">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title="Linhas Gravadas/Inseridas">
                          {log.rowsWritten}
                        </span>
                        <span className="text-text-muted">/</span>
                        <span className="text-blue-600 dark:text-blue-400" title="Linhas Atualizadas/Reconciliadas">
                          {log.rowsUpdated}
                        </span>
                        <span className="text-text-muted">/</span>
                        <span className="text-amber-600 dark:text-amber-400" title="Linhas Ignoradas/Puladas">
                          {log.rowsSkipped}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
                        title="Ver Detalhes do Log"
                        onClick={() => handleOpenDetails(log)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LogDetailsDialog
        log={selectedLog}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
