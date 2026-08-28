import { Activity, AlertTriangle, CheckCircle2, FileUp, Mail, Server } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import type { ObservabilityStats } from '@/services/dataImportLogsService';

interface ObservabilityOverviewCardsProps {
  stats: ObservabilityStats | null;
  isLoading?: boolean;
}

export function ObservabilityOverviewCards({ stats, isLoading }: ObservabilityOverviewCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-subtle border border-border-subtle" />
        ))}
      </div>
    );
  }

  const successRate =
    stats.totalRuns > 0 ? Math.round((stats.successCount / stats.totalRuns) * 100) : 100;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1: Saúde Geral */}
      <Card className="border-border-default shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Taxa de Sucesso</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-text-primary">{successRate}%</span>
              <span className="text-xs text-text-muted">({stats.successCount}/{stats.totalRuns})</span>
            </div>
            <p className="text-[11px] text-text-muted">
              {stats.healthyDatasetsCount} bases saudáveis
            </p>
          </div>
          <div className="rounded-full bg-emerald-500/10 p-2.5 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Falhas e Alertas */}
      <Card className={`border-border-default shadow-sm ${stats.failedCount > 0 ? 'border-destructive/40 bg-destructive/5' : ''}`}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Falhas & Alertas</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold tracking-tight ${stats.failedCount > 0 ? 'text-destructive' : 'text-text-primary'}`}>
                {stats.failedCount}
              </span>
              {stats.warningCount > 0 && (
                <span className="text-xs text-amber-600">({stats.warningCount} avisos)</span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              {stats.unhealthyDatasetsCount > 0
                ? `${stats.unhealthyDatasetsCount} base(s) com erro recente`
                : 'Nenhum erro pendente'}
            </p>
          </div>
          <div className={`rounded-full p-2.5 ${stats.failedCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-surface-subtle text-text-muted'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Ingestão por Canal */}
      <Card className="border-border-default shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Canais de Ingestão</p>
            <div className="flex items-center gap-3 text-xs pt-1">
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium" title="Uploads manuais no navegador">
                <FileUp className="h-3.5 w-3.5 text-primary" /> {stats.manualUploadsCount}
              </span>
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium" title="Ingestões automáticas por e-mail">
                <Mail className="h-3.5 w-3.5 text-blue-600" /> {stats.emailIngestionsCount}
              </span>
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium" title="Sincronizações via API/Robôs">
                <Server className="h-3.5 w-3.5 text-purple-600" /> {stats.apiSyncsCount}
              </span>
            </div>
            <p className="text-[11px] text-text-muted pt-0.5">
              {stats.totalRuns} execuções totais monitoradas
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-2.5 text-primary">
            <Activity className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Última Atividade */}
      <Card className="border-border-default shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">Última Atualização</p>
            <p className="text-sm font-semibold text-text-primary">
              {stats.lastActivityTimestamp
                ? new Date(stats.lastActivityTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) +
                  ' em ' +
                  new Date(stats.lastActivityTimestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : 'Nenhum registro'}
            </p>
            <p className="text-[11px] text-text-muted">
              {stats.lastActivityTimestamp
                ? 'Central sincronizada e ativa'
                : 'Aguardando primeira ingestão'}
            </p>
          </div>
          <div className="rounded-full bg-blue-500/10 p-2.5 text-blue-600">
            <Activity className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
