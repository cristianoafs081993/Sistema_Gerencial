import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Eye, History, Layers3, Loader2, RefreshCw, Search, Sparkles } from 'lucide-react';
import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { atasService } from '@/services/atas';
import type { AtasObservabilityMetric, AtasObservabilityOverview, EventoUsoAta, ModuloBuscaAtas } from '@/types';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const formatModuleLabel = (module: ModuloBuscaAtas) =>
  module === 'adesao' ? 'Buscar atas para adesao' : 'Buscar atas para pesquisa de precos';

const formatEventLabel = (event: EventoUsoAta) => {
  if (event.tipo_evento === 'busca_realizada') return 'Busca realizada';
  if (event.tipo_evento === 'refinamento_busca') return 'Refinamento de busca';
  if (event.tipo_evento === 'detalhe_ata_aberto') return 'Detalhe de ata aberto';
  if (event.tipo_evento === 'sessao_batch_criada') return 'Sessao batch criada';
  if (event.tipo_evento === 'item_batch_processado') return 'Item batch processado';
  return event.tipo_evento;
};

const metricCards = (metrics: AtasObservabilityMetric) => [
  {
    title: 'Buscas registradas',
    value: metrics.totalSearchSessions,
    helper: 'Sessoes de busca salvas no modulo',
    icon: Search,
  },
  {
    title: 'Refinamentos',
    value: metrics.totalRefinements,
    helper: 'Buscas que partiram de uma consulta anterior',
    icon: Sparkles,
  },
  {
    title: 'Detalhes abertos',
    value: metrics.totalDetailOpens,
    helper: 'Aberturas de detalhe de atas',
    icon: Eye,
  },
  {
    title: 'Batches concluidos',
    value: metrics.totalCompletedBatchSessions,
    helper: `${metrics.totalBatchSessions} sessoes batch registradas`,
    icon: CheckCircle2,
  },
];

const moduleBadgeVariant = (module: ModuloBuscaAtas) => (module === 'adesao' ? 'default' : 'info');

export default function AtasObservabilidade() {
  const [overview, setOverview] = useState<AtasObservabilityOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalMetricCards = useMemo(
    () => (overview ? metricCards(overview.totals) : []),
    [overview]
  );

  const loadOverview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await atasService.getObservabilityOverview();
      setOverview(data);
    } catch (overviewError) {
      console.error(overviewError);
      setError('Nao foi possivel carregar a observabilidade do modulo de atas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <>
      <HeaderSubtitle>
        <span>Visao operacional de buscas, refinamentos, batches e uso recente do modulo de atas.</span>
      </HeaderSubtitle>
      <HeaderActions>
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </HeaderActions>

      <div className="space-y-6 pb-10">
        <Card className="card-system border-none shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Observabilidade do modulo de atas
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Acompanhe como o modulo esta sendo usado e onde faz sentido priorizar ajustes de busca, UX e batch.
            </p>
          </CardHeader>
        </Card>

        {error && (
          <Card className="border border-red-200 bg-red-50/80 shadow-none">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {isLoading && !overview ? (
          <Card className="card-system border-none shadow-sm">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando indicadores do modulo...
            </CardContent>
          </Card>
        ) : null}

        {overview && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {totalMetricCards.map((metric) => (
                <Card key={metric.title} className="card-system border-none shadow-sm">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                      <metric.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                    <p className="text-sm text-muted-foreground">{metric.helper}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
              <div className="space-y-6">
                {(['adesao', 'pesquisa_precos'] as ModuloBuscaAtas[]).map((module) => {
                  const metrics = overview.byModule[module];
                  const sessions = overview.recentSessions[module];

                  return (
                    <Card key={module} className="card-system border-none shadow-sm">
                      <CardHeader className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle className="text-base font-semibold">{formatModuleLabel(module)}</CardTitle>
                          <Badge variant={moduleBadgeVariant(module)}>{module === 'adesao' ? 'Adesao' : 'Pesquisa de precos'}</Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {metricCards(metrics).map((metric) => (
                            <div key={`${module}-${metric.title}`} className="rounded-xl border border-border/60 bg-background/70 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{metric.title}</p>
                              <p className="mt-2 text-2xl font-bold text-foreground">{metric.value}</p>
                            </div>
                          ))}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leitura rapida</p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {module === 'adesao'
                              ? 'Use esta trilha para observar se a equipe esta chegando a atas uteis e abrindo detalhes com frequencia.'
                              : 'Aqui a leitura principal e volume de referencia pesquisada, refinamentos e uso do batch guiado.'}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-foreground">Sessoes recentes</p>
                          {sessions.length === 0 ? (
                            <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                              Nenhuma sessao registrada ainda neste modulo.
                            </div>
                          ) : (
                            sessions.map((session) => (
                              <div key={session.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">{session.query}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateTime(session.createdAt)}</p>
                                  </div>
                                  <Badge variant="outline">{session.resultCount} resultados</Badge>
                                </div>
                                {session.previousQuery && (
                                  <p className="mt-2 text-xs text-muted-foreground">Refinou: {session.previousQuery}</p>
                                )}
                                {session.topResult?.ata && (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    Top 1: Ata {session.topResult.ata.numero_ata} - {session.topResult.ata.objeto}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="space-y-6">
                <Card className="card-system border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Layers3 className="h-4 w-4 text-primary" />
                      Sessoes batch recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[360px]">
                      <div className="space-y-3 p-6 pt-0">
                        {overview.recentBatchSessions.length === 0 ? (
                          <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                            Nenhuma sessao batch registrada ainda.
                          </div>
                        ) : (
                          overview.recentBatchSessions.map((session) => (
                            <div key={session.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">{session.titulo}</p>
                                  <p className="text-xs text-muted-foreground">{formatDateTime(session.createdAt)}</p>
                                </div>
                                <Badge variant={session.status === 'concluida' ? 'success' : session.status === 'pausada' ? 'secondary' : 'warning'}>
                                  {session.status === 'concluida' ? 'Concluida' : session.status === 'pausada' ? 'Pausada' : 'Em andamento'}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">
                                Progresso: {session.totalConcluidos}/{session.totalItens} itens
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="card-system border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <History className="h-4 w-4 text-primary" />
                      Eventos recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[420px]">
                      <div className="space-y-3 p-6 pt-0">
                        {overview.recentEvents.length === 0 ? (
                          <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                            Nenhum evento recente registrado.
                          </div>
                        ) : (
                          overview.recentEvents.map((event) => (
                            <div key={event.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">{formatEventLabel(event)}</p>
                                  <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                                </div>
                                {event.modulo && <Badge variant={moduleBadgeVariant(event.modulo)}>{event.modulo === 'adesao' ? 'Adesao' : 'Pesquisa'}</Badge>}
                              </div>
                              {event.referencia_tipo && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Referencia: {event.referencia_tipo}
                                  {event.referencia_id ? ` (${event.referencia_id})` : ''}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="card-system border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Clock3 className="h-4 w-4 text-primary" />
                      Leitura operacional
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Mais refinamentos costumam indicar que a primeira formulacao ainda nao esta chegando no que a equipe precisa.</p>
                    <p>Muitas aberturas de detalhe com poucas buscas podem sinalizar resultados relevantes para triagem.</p>
                    <p>Quando o batch crescer, o foco passa a ser quantidade de itens processados e percentual de lotes concluidos.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
