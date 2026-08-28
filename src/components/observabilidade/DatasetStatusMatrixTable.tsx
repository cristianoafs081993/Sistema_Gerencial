import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileUp,
  Filter,
  HelpCircle,
  Mail,
  RefreshCw,
  Search,
  Server,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DatasetStatus, PipelineModule, PipelineSourceType } from '@/services/dataImportLogsService';

interface DatasetStatusMatrixTableProps {
  datasets: DatasetStatus[];
  isLoading?: boolean;
  onSelectDataset?: (datasetKey: string) => void;
  onRefresh?: () => void;
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

function formatRelativeTime(iso: string | null) {
  if (!iso) return 'Nunca atualizado';
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 30) return `Há ${diffDays} dias`;
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatFullDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DatasetStatusMatrixTable({
  datasets,
  isLoading,
  onSelectDataset,
  onRefresh,
}: DatasetStatusMatrixTableProps) {
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const filteredDatasets = datasets.filter((dataset) => {
    if (selectedModule !== 'all' && dataset.module !== selectedModule) return false;
    if (selectedStatus !== 'all' && dataset.lastStatus !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        MODULE_LABELS[dataset.module].toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: DatasetStatus['lastStatus']) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] font-normal">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Atualizado
          </Badge>
        );
      case 'stale':
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-normal">
            <Clock className="mr-1 h-3 w-3" />
            Sem dados recentes (&gt;7d)
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="border-amber-500/40 bg-amber-500/10 text-amber-600 text-[11px] font-normal">
            <AlertCircle className="mr-1 h-3 w-3" />
            Atenção / Parcial
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-[11px] font-normal">
            <XCircle className="mr-1 h-3 w-3" />
            Falha Recente
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary" className="border-blue-500/40 bg-blue-500/10 text-blue-600 text-[11px] font-normal">
            <Clock className="mr-1 h-3 w-3 animate-spin" />
            Em processamento
          </Badge>
        );
      case 'no_data':
      default:
        return (
          <Badge variant="outline" className="text-text-muted text-[11px] font-normal">
            <HelpCircle className="mr-1 h-3 w-3" />
            Sem Ingestão
          </Badge>
        );
    }
  };

  const renderSourceIcon = (source: PipelineSourceType) => {
    switch (source) {
      case 'manual_upload':
        return (
          <span key={source} title="Suporta Upload Manual (CSV/XLSX/JSON)" className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 p-1 text-slate-600 dark:text-slate-300">
            <FileUp className="h-3 w-3" />
          </span>
        );
      case 'email_csv':
        return (
          <span key={source} title="Suporta Ingestão Automatizada por E-mail (Gmail)" className="inline-flex items-center rounded bg-blue-50 dark:bg-blue-950/50 p-1 text-blue-600 dark:text-blue-400">
            <Mail className="h-3 w-3" />
          </span>
        );
      case 'api_sync':
        return (
          <span key={source} title="Suporta Sincronização via API / Robô" className="inline-flex items-center rounded bg-purple-50 dark:bg-purple-950/50 p-1 text-purple-600 dark:text-purple-400">
            <Server className="h-3 w-3" />
          </span>
        );
    }
  };

  return (
    <Card className="border-border-default shadow-sm">
      <CardHeader className="p-4 pb-3 border-b border-border-subtle">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">
              Matriz de Observabilidade e Atualização das Bases
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Acompanhe o estado de atualização, frequência e canais suportados de cada base de dados do sistema.
            </CardDescription>
          </div>
          {onRefresh && (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading} className="gap-1.5 self-start text-xs sm:self-auto">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar Matriz
            </Button>
          )}
        </div>

        {/* Filtros da Matriz */}
        <div className="grid gap-2 pt-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
            <Input
              placeholder="Buscar base de dados..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="h-8 rounded-md border border-border-default bg-surface-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todos os Módulos</option>
            <option value="orcamentario">Módulo Orçamentário</option>
            <option value="financeiro">Módulo Financeiro</option>
            <option value="contratos">Contratos & Gestão</option>
            <option value="integracoes">Integrações</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 rounded-md border border-border-default bg-surface-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todos os Status</option>
            <option value="success">Atualizados</option>
            <option value="failed">Falhas Recentes</option>
            <option value="warning">Atenção / Parcial</option>
            <option value="stale">Sem dados recentes (&gt;7d)</option>
            <option value="no_data">Sem ingestão</option>
          </select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[260px] text-xs font-semibold">Base de Dados / Dataset</TableHead>
              <TableHead className="text-xs font-semibold">Módulo</TableHead>
              <TableHead className="text-xs font-semibold">Canais</TableHead>
              <TableHead className="text-xs font-semibold">Última Atualização</TableHead>
              <TableHead className="text-xs font-semibold">Última Origem</TableHead>
              <TableHead className="text-xs font-semibold">Status Atual</TableHead>
              <TableHead className="text-right text-xs font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-text-muted">
                  Carregando matriz de observabilidade...
                </TableCell>
              </TableRow>
            ) : filteredDatasets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-xs text-text-muted">
                  Nenhuma base de dados encontrada com os filtros informados.
                </TableCell>
              </TableRow>
            ) : (
              filteredDatasets.map((dataset) => (
                <TableRow key={dataset.key} className="hover:bg-surface-subtle/60">
                  <TableCell className="py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-text-primary">{dataset.name}</p>
                      <p className="text-[11px] text-text-muted line-clamp-1">{dataset.description}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${MODULE_BADGE_VARIANTS[dataset.module]}`}>
                      {MODULE_LABELS[dataset.module]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-1">
                      {dataset.supportedSources.map(renderSourceIcon)}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-text-primary">{formatRelativeTime(dataset.lastUpdatedAt)}</p>
                      <p className="text-[10px] text-text-muted">{formatFullDate(dataset.lastUpdatedAt)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {dataset.lastSourceName ? (
                      <div className="max-w-[200px] truncate text-xs text-text-secondary" title={dataset.lastSourceName}>
                        {dataset.lastSourceType === 'email_csv' ? '✉️ ' : dataset.lastSourceType === 'api_sync' ? '⚡ ' : '📁 '}
                        {dataset.lastSourceName}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {getStatusBadge(dataset.lastStatus)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    {onSelectDataset && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary gap-1 px-2"
                        onClick={() => onSelectDataset(dataset.key)}
                      >
                        <Filter className="h-3 w-3" />
                        Ver Logs
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
