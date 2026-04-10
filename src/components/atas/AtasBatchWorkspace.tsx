import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Clock3, History, ListOrdered, Loader2, Play, SearchCheck, WandSparkles } from 'lucide-react';
import { atasService } from '@/services/atas';
import type { AtaSearchFilters, AtaSearchResponse, SessaoBatchAtaResumo } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface BatchProcessedItem {
  item: string;
  response: AtaSearchResponse;
}

const defaultFilters: AtaSearchFilters = {
  statusVigencia: 'todas',
  tipoItem: 'todos',
  requireCatalog: false,
  catalogCode: '',
};

const parseBatchItems = (rawValue: string) =>
  rawValue
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*\d.]+\s*/, '').trim())
    .filter(Boolean);

const formatSessionFilters = (filters: AtaSearchFilters) => {
  const parts: string[] = [];
  if (filters.statusVigencia !== 'todas') parts.push(`vigencia ${filters.statusVigencia}`);
  if (filters.tipoItem !== 'todos') parts.push(`tipo ${filters.tipoItem}`);
  if (filters.requireCatalog) parts.push('com catalogo');
  if (filters.catalogCode) parts.push(`catalogo ${filters.catalogCode}`);
  return parts.length > 0 ? parts.join(' • ') : 'sem filtros';
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const formatBatchStatus = (status: SessaoBatchAtaResumo['status']) => {
  if (status === 'concluida') {
    return {
      label: 'Concluida',
      variant: 'success' as const,
    };
  }

  if (status === 'pausada') {
    return {
      label: 'Pausada',
      variant: 'secondary' as const,
    };
  }

  return {
    label: 'Em andamento',
    variant: 'warning' as const,
  };
};

const upsertProcessed = (current: BatchProcessedItem[], nextEntry: BatchProcessedItem) => {
  const next = [...current];
  const existingIndex = next.findIndex((entry) => entry.item === nextEntry.item);

  if (existingIndex >= 0) {
    next[existingIndex] = nextEntry;
    return next;
  }

  next.push(nextEntry);
  return next;
};

const buildConsolidationText = (title: string, processed: BatchProcessedItem[], filters: AtaSearchFilters) => {
  const header = [
    `Sessao batch: ${title || 'Sem titulo'}`,
    `Filtros: ${formatSessionFilters(filters)}`,
    '',
  ];

  if (processed.length === 0) {
    return [...header, 'Nenhum item processado ate o momento.'].join('\n');
  }

  const body = processed.map((entry, index) => {
    const topResult = entry.response.results[0];
    const topItem = topResult?.primaryItem?.descricao || 'Item principal nao identificado';

    return [
      `${index + 1}. ${entry.item}`,
      `Top 1: ${topResult ? `Ata ${topResult.ata.numero_ata} - ${topResult.ata.objeto}` : 'Sem referencia encontrada'}`,
      `Justificativa: ${topResult?.justification || 'Sem justificativa registrada'}`,
      `Item principal: ${topItem}`,
    ].join('\n');
  });

  return [...header, ...body].join('\n\n');
};

export function AtasBatchWorkspace() {
  const [rawBatch, setRawBatch] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [processed, setProcessed] = useState<BatchProcessedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [filters, setFilters] = useState<AtaSearchFilters>(defaultFilters);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSessionId, setBatchSessionId] = useState<string | null>(null);
  const [batchTitle, setBatchTitle] = useState('');
  const [recentBatchSessions, setRecentBatchSessions] = useState<SessaoBatchAtaResumo[]>([]);
  const [isLoadingBatchHistory, setIsLoadingBatchHistory] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const preparedItems = useMemo(() => parseBatchItems(rawBatch), [rawBatch]);
  const currentItem = queue[currentIndex] || null;
  const completedCount = Math.min(currentIndex, queue.length);
  const pendingCount = Math.max(queue.length - completedCount, 0);
  const processedByItem = useMemo(() => new Map(processed.map((entry) => [entry.item, entry.response])), [processed]);
  const focusedResponse = focusedItem ? processedByItem.get(focusedItem) || null : null;
  const consolidationText = useMemo(
    () => buildConsolidationText(batchTitle, processed, filters),
    [batchTitle, filters, processed]
  );

  useEffect(() => {
    let active = true;

    const loadRecentBatchSessions = async () => {
      try {
        setIsLoadingBatchHistory(true);
        const sessions = await atasService.listRecentBatchSessions();
        if (active) {
          setRecentBatchSessions(sessions);
        }
      } catch (historyError) {
        console.error(historyError);
      } finally {
        if (active) {
          setIsLoadingBatchHistory(false);
        }
      }
    };

    void loadRecentBatchSessions();

    return () => {
      active = false;
    };
  }, []);

  const refreshBatchHistory = async () => {
    const sessions = await atasService.listRecentBatchSessions();
    setRecentBatchSessions(sessions);
  };

  const prepareQueue = async () => {
    const items = parseBatchItems(rawBatch);
    if (items.length === 0) {
      setError('Informe pelo menos um item por linha para preparar o lote.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const title =
        batchTitle.trim() ||
        `Lote ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`;
      const sessionId = await atasService.createBatchSession(title, items, filters);

      setBatchSessionId(sessionId);
      setQueue(items);
      setProcessed([]);
      setCurrentIndex(0);
      setFocusedItem(items[0] || null);
      setBatchTitle(title);
      setRawBatch(items.join('\n'));
      await refreshBatchHistory();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Falha ao preparar sessao batch.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processItem = async (item: string, previousQuery: string | null) =>
    atasService.search('pesquisa_precos', item, {
      previousQuery,
      filters,
    });

  const processNext = async () => {
    if (!currentItem || !batchSessionId) {
      setError('Nao ha item pendente para processar.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      const previousQuery = processed[processed.length - 1]?.item || null;
      const response = await processItem(currentItem, previousQuery);

      const nextCompleted = completedCount + 1;
      const nextOrder = currentIndex + 2 <= queue.length ? currentIndex + 2 : null;

      await atasService.updateBatchProgress({
        batchSessionId,
        item: currentItem,
        order: currentIndex + 1,
        response,
        totalConcluded: nextCompleted,
        currentOrder: nextOrder,
        totalItems: queue.length,
      });

      setProcessed((current) => upsertProcessed(current, { item: currentItem, response }));
      setFocusedItem(currentItem);
      setCurrentIndex(nextCompleted);
      await refreshBatchHistory();
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : 'Falha ao processar item do lote.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processAll = async () => {
    if (!currentItem || !batchSessionId) {
      setError('Prepare um lote com itens antes de processar tudo.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      let nextIndex = currentIndex;
      let previousQuery = processed[processed.length - 1]?.item || null;
      const stagedResults: BatchProcessedItem[] = [];

      while (nextIndex < queue.length) {
        const item = queue[nextIndex];
        const response = await processItem(item, previousQuery);
        stagedResults.push({ item, response });
        await atasService.updateBatchProgress({
          batchSessionId,
          item,
          order: nextIndex + 1,
          response,
          totalConcluded: nextIndex + 1,
          currentOrder: nextIndex + 2 <= queue.length ? nextIndex + 2 : null,
          totalItems: queue.length,
        });
        previousQuery = item;
        nextIndex += 1;
      }

      setProcessed((current) => stagedResults.reduce((accumulator, entry) => upsertProcessed(accumulator, entry), current));
      setCurrentIndex(queue.length);
      setFocusedItem(stagedResults[stagedResults.length - 1]?.item || currentItem);
      await refreshBatchHistory();
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : 'Falha ao processar o lote completo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const restoreBatchSession = async (session: SessaoBatchAtaResumo) => {
    try {
      setIsRestoringSession(true);
      setError(null);

      const restoredQueue = session.itens.map((item) => item.consulta_item);
      const replayEntries = await Promise.all(
        session.itens
          .filter((item) => item.sessao_busca_id)
          .map(async (item) => {
            const replay = await atasService.getSearchSessionReplay(item.sessao_busca_id!);
            if (!replay) return null;
            return {
              item: item.consulta_item,
              response: replay,
            } satisfies BatchProcessedItem;
          })
      );

      const restoredProcessed = replayEntries.filter((entry): entry is BatchProcessedItem => Boolean(entry));
      const focusIndex = session.itemAtualOrdem
        ? session.itemAtualOrdem - 1
        : Math.max(session.totalConcluidos - 1, 0);
      const fallbackFocusIndex = Math.min(focusIndex, Math.max(restoredQueue.length - 1, 0));

      setBatchSessionId(session.id);
      setBatchTitle(session.titulo);
      setFilters(session.filters);
      setQueue(restoredQueue);
      setRawBatch(restoredQueue.join('\n'));
      setProcessed(restoredProcessed);
      setCurrentIndex(session.totalConcluidos);
      setFocusedItem(restoredQueue[fallbackFocusIndex] || restoredQueue[0] || null);
    } catch (restoreError) {
      console.error(restoreError);
      setError('Nao foi possivel restaurar a sessao batch selecionada.');
    } finally {
      setIsRestoringSession(false);
    }
  };

  const copyConsolidation = async () => {
    try {
      await navigator.clipboard.writeText(consolidationText);
      setCopyFeedback('Consolidacao copiada.');
      window.setTimeout(() => setCopyFeedback(null), 2200);
    } catch (copyError) {
      console.error(copyError);
      setCopyFeedback('Nao foi possivel copiar.');
      window.setTimeout(() => setCopyFeedback(null), 2200);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6">
        <Card className="card-system border-none shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <WandSparkles className="h-5 w-5 text-primary" />
              Batch guiado de pesquisa de precos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Organize varios itens em uma fila, acompanhe o progresso e consolide os resultados sem perder o contexto.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-title">Titulo da sessao</Label>
              <Input
                id="batch-title"
                value={batchTitle}
                onChange={(event) => setBatchTitle(event.target.value)}
                placeholder="Ex.: Material permanente para laboratorios"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-items">Itens do lote</Label>
              <Textarea
                id="batch-items"
                value={rawBatch}
                onChange={(event) => setRawBatch(event.target.value)}
                placeholder={'Um item por linha\nNotebook para laboratorio\nServico de garantia estendida\nImpressora multifuncional'}
                className="min-h-[180px]"
              />
              <p className="text-xs text-muted-foreground">
                Itens preparados: {preparedItems.length}. Cada linha vira uma busca guiada.
              </p>
            </div>

            <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status de vigencia</Label>
                <Select
                  value={filters.statusVigencia}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      statusVigencia: value as AtaSearchFilters['statusVigencia'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="vigente">Vigente</SelectItem>
                    <SelectItem value="a_vencer">A vencer</SelectItem>
                    <SelectItem value="encerrada">Encerrada</SelectItem>
                    <SelectItem value="desconhecida">Desconhecida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de item</Label>
                <Select
                  value={filters.tipoItem}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      tipoItem: value as AtaSearchFilters['tipoItem'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="servico">Servico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Codigo de catalogo</Label>
                <Input
                  value={filters.catalogCode}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      catalogCode: event.target.value,
                    }))
                  }
                  placeholder="Ex.: 123456"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/80 p-3">
                <div className="space-y-1">
                  <Label htmlFor="batch-catalog">Exigir catalogo</Label>
                  <p className="text-xs text-muted-foreground">Aplica o filtro a todos os itens do lote.</p>
                </div>
                <Switch
                  id="batch-catalog"
                  checked={filters.requireCatalog}
                  onCheckedChange={(checked) =>
                    setFilters((current) => ({
                      ...current,
                      requireCatalog: checked,
                    }))
                  }
                />
              </div>
            </div>

            {batchSessionId && (
              <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                Sessao atual: <span className="font-medium text-foreground">{batchTitle || 'Lote sem titulo'}</span>
                <br />
                ID registrado: {batchSessionId}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void prepareQueue()} disabled={isProcessing || isRestoringSession || preparedItems.length === 0}>
                <ListOrdered className="h-4 w-4" />
                Preparar lote
              </Button>
              <Button
                variant="outline"
                onClick={() => setFilters(defaultFilters)}
                disabled={isProcessing || isRestoringSession}
              >
                Limpar filtros
              </Button>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">{error}</div>}
          </CardContent>
        </Card>

        <Card className="card-system border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Progresso da sessao batch</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Concluidos</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{completedCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pendentes</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{pendingCount}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtros do lote</p>
              <p className="mt-2 text-sm font-medium text-foreground">{formatSessionFilters(filters)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-system border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Fila de processamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void processNext()} disabled={isProcessing || isRestoringSession || !currentItem}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Processar proximo item
              </Button>
              <Button variant="outline" onClick={() => void processAll()} disabled={isProcessing || isRestoringSession || !currentItem}>
                <SearchCheck className="h-4 w-4" />
                Processar todos
              </Button>
            </div>

            <ScrollArea className="h-[320px] rounded-xl border border-border/60 bg-background/70">
              <div className="space-y-2 p-4">
                {queue.length === 0 && <p className="text-sm text-muted-foreground">Prepare um lote para visualizar a fila.</p>}
                {queue.map((item, index) => {
                  const isDone = index < completedCount;
                  const isCurrent = index === currentIndex && currentItem !== null;
                  return (
                    <button
                      key={`${item}-${index}`}
                      type="button"
                      onClick={() => setFocusedItem(item)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        isCurrent
                          ? 'border-primary/40 bg-primary/5'
                          : isDone
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-border/50 bg-background/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Item {index + 1} de {queue.length}
                          </p>
                        </div>
                        {isDone ? (
                          <Badge variant="success">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Concluido
                          </Badge>
                        ) : isCurrent ? (
                          <Badge variant="warning">
                            <Clock3 className="mr-1 h-3.5 w-3.5" />
                            Em foco
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="card-system border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4 text-primary" />
              Historico de sessoes batch
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              <div className="space-y-3 p-6 pt-0">
                {isLoadingBatchHistory && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando sessoes batch...
                  </div>
                )}

                {!isLoadingBatchHistory && recentBatchSessions.length === 0 && (
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                    Nenhuma sessao batch registrada ainda.
                  </div>
                )}

                {recentBatchSessions.map((session) => {
                  const status = formatBatchStatus(session.status);
                  return (
                    <div key={session.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">{session.titulo}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(session.createdAt)}</p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>
                          Progresso: {session.totalConcluidos}/{session.totalItens} itens
                        </p>
                        <p>{formatSessionFilters(session.filters)}</p>
                      </div>

                      {session.itens.length > 0 && (
                        <div className="mt-3 rounded-lg border border-border/50 bg-background/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fila registrada</p>
                          <p className="mt-1 text-sm text-foreground/90">
                            {session.itens
                              .slice(0, 3)
                              .map((item) => item.consulta_item)
                              .join(' | ')}
                            {session.itens.length > 3 ? ' | ...' : ''}
                          </p>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void restoreBatchSession(session)}
                          disabled={isProcessing || isRestoringSession}
                        >
                          {isRestoringSession ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Retomar sessao
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="card-system border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Consolidacao parcial do item em foco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!focusedItem && (
              <p className="text-sm text-muted-foreground">
                Selecione ou processe um item do lote para ver a consolidacao parcial.
              </p>
            )}

            {focusedItem && (
              <>
                <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item em foco</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{focusedItem}</p>
                </div>

                {!focusedResponse && (
                  <p className="text-sm text-muted-foreground">
                    Este item ainda nao foi processado. Use "Processar proximo item" ou "Processar todos".
                  </p>
                )}

                {focusedResponse && (
                  <>
                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entendimento</p>
                      <p className="mt-2 text-sm text-foreground/90">{focusedResponse.intent.understanding}</p>
                    </div>

                    <div className="space-y-3">
                      {focusedResponse.results.length === 0 ? (
                        <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                          Nenhuma referencia encontrada para este item com os filtros atuais.
                        </div>
                      ) : (
                        focusedResponse.results.map((result) => (
                          <div
                            key={`${focusedItem}-${result.ata.id}-${result.position}`}
                            className="rounded-xl border border-border/60 bg-background/70 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="default">#{result.position}</Badge>
                              <Badge variant="outline">Ata {result.ata.numero_ata}</Badge>
                              {result.primaryItem?.tipo_item === 'servico' && <Badge variant="info">Servico</Badge>}
                              {result.primaryItem?.tipo_item === 'material' && <Badge variant="default">Material</Badge>}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-foreground">{result.ata.objeto}</p>
                            <p className="mt-2 text-sm text-muted-foreground">{result.justification}</p>
                            {result.primaryItem && (
                              <div className="mt-3 rounded-lg border border-border/50 bg-background/80 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Item principal da ata</p>
                                <p className="mt-1 text-sm text-foreground/90">{result.primaryItem.descricao}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-system border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base font-semibold">Consolidacao do lote</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void copyConsolidation()} disabled={processed.length === 0}>
              <Clipboard className="h-4 w-4" />
              Copiar resumo
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {copyFeedback && <p className="text-sm text-muted-foreground">{copyFeedback}</p>}

            {processed.length === 0 ? (
              <p className="text-sm text-muted-foreground">A consolidacao final aparece conforme os itens forem processados.</p>
            ) : (
              <>
                <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                  {processed.length} item(ns) com consolidacao disponivel nesta sessao.
                </div>

                <div className="space-y-3">
                  {processed.map((entry, index) => {
                    const topResult = entry.response.results[0];
                    return (
                      <div key={`${entry.item}-${index}`} className="rounded-xl border border-border/60 bg-background/70 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Item {index + 1}</Badge>
                          {topResult ? <Badge variant="success">Referencia encontrada</Badge> : <Badge variant="secondary">Sem referencia</Badge>}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">{entry.item}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {topResult
                            ? `Top 1: Ata ${topResult.ata.numero_ata} - ${topResult.ata.objeto}`
                            : 'Nao houve referencia aderente com os filtros atuais.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
