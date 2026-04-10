import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarClock,
  FileText,
  History,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Search,
  SendHorizontal,
  Sparkles,
  Tags,
  User,
  Waypoints,
  Wrench,
} from 'lucide-react';
import { atasService } from '@/services/atas';
import { geminiAtasChatService } from '@/services/geminiAtasChat';
import type {
  AtaConversationalReply,
  AtaDetalhe,
  AtaSearchFilters,
  AtaSearchResponse,
  AtaSearchSessionSummary,
  AtaAdesaoStatus,
  ModuloBuscaAtas,
  TipoItemAta,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Nao informada';

  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Nao informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
};

const formatQuantity = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Nao informada';
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const statusVariantByVigencia = {
  vigente: 'success',
  a_vencer: 'warning',
  encerrada: 'secondary',
  desconhecida: 'outline',
} as const;

const tipoVariantByItem: Record<TipoItemAta, 'default' | 'info' | 'outline'> = {
  material: 'default',
  servico: 'info',
  nao_classificado: 'outline',
};

const tipoLabelByItem: Record<TipoItemAta, string> = {
  material: 'Material',
  servico: 'Servico',
  nao_classificado: 'Nao classificado',
};

const adesaoStatusVariantByStatus: Record<AtaAdesaoStatus, 'warning' | 'secondary' | 'outline'> = {
  revisar_documentos: 'warning',
  somente_pesquisa_precos: 'secondary',
  sem_indicativo_adesao: 'outline',
};

const adesaoStatusLabelByStatus: Record<AtaAdesaoStatus, string> = {
  revisar_documentos: 'Revisar adesao',
  somente_pesquisa_precos: 'Somente pesquisa de precos',
  sem_indicativo_adesao: 'Sem indicativo de adesao',
};

interface AtasSearchWorkspaceProps {
  module: ModuloBuscaAtas;
}

interface ConversationUserMessage {
  id: string;
  role: 'user';
  query: string;
  filters: AtaSearchFilters;
}

interface ConversationAssistantWelcomeMessage {
  id: string;
  role: 'assistant';
  kind: 'welcome';
}

interface ConversationAssistantResultsMessage {
  id: string;
  role: 'assistant';
  kind: 'results';
  response: AtaSearchResponse;
  reply: AtaConversationalReply;
}

interface ConversationAssistantErrorMessage {
  id: string;
  role: 'assistant';
  kind: 'error';
  content: string;
}

type ConversationMessage =
  | ConversationUserMessage
  | ConversationAssistantWelcomeMessage
  | ConversationAssistantResultsMessage
  | ConversationAssistantErrorMessage;

const defaultFilters: AtaSearchFilters = {
  statusVigencia: 'todas',
  tipoItem: 'todos',
  requireCatalog: false,
  catalogCode: '',
};

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const createWelcomeMessage = (): ConversationAssistantWelcomeMessage => ({
  id: createMessageId(),
  role: 'assistant',
  kind: 'welcome',
});

const formatSessionFilters = (filters: AtaSearchFilters | null) => {
  if (!filters) return 'Sem filtros registrados';

  const parts: string[] = [];
  if (filters.statusVigencia !== 'todas') parts.push(`vigencia ${filters.statusVigencia}`);
  if (filters.tipoItem !== 'todos') parts.push(`tipo ${filters.tipoItem}`);
  if (filters.requireCatalog) parts.push('com catalogo');
  if (filters.catalogCode) parts.push(`catalogo ${filters.catalogCode}`);

  return parts.length > 0 ? parts.join(' • ') : 'Sem filtros';
};

interface ResultCardProps {
  ataKey: string;
  module: ModuloBuscaAtas;
  result: AtaSearchResponse['results'][number];
  nextStep: string;
  isOpen: boolean;
  isDetailLoading: boolean;
  detail?: AtaDetalhe;
  onToggleDetail: (ataKey: string, ataId: string) => void;
}

interface AssistantResultsMessageProps {
  messageId: string;
  module: ModuloBuscaAtas;
  response: AtaSearchResponse;
  reply: AtaConversationalReply;
  activeAtaKey: string | null;
  loadingDetailKey: string | null;
  detailsByAta: Record<string, AtaDetalhe | undefined>;
  onToggleDetail: (ataKey: string, ataId: string) => void;
  onRefine: (query: string, filters?: AtaSearchFilters) => void;
}

function ResultCard({
  ataKey,
  module,
  result,
  nextStep,
  isOpen,
  isDetailLoading,
  detail,
  onToggleDetail,
}: ResultCardProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">#{result.position}</Badge>
              <Badge variant={statusVariantByVigencia[result.ata.status_vigencia]}>
                Vigencia: {result.ata.status_vigencia}
              </Badge>
              {result.primaryItem?.tipo_item && (
                <Badge variant={tipoVariantByItem[result.primaryItem.tipo_item]}>
                  {tipoLabelByItem[result.primaryItem.tipo_item]}
                </Badge>
              )}
              <Badge variant={adesaoStatusVariantByStatus[result.adesaoAnalysis.status]}>
                {adesaoStatusLabelByStatus[result.adesaoAnalysis.status]}
              </Badge>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-lg font-bold">{result.ata.objeto}</CardTitle>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {result.ata.orgao_gerenciador || 'Orgao nao informado'}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  {formatDate(result.ata.vigencia_inicio)} ate {formatDate(result.ata.vigencia_fim)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => onToggleDetail(ataKey, result.ata.id)}>
            {isDetailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {isOpen ? 'Ocultar detalhe' : 'Ver detalhe da ata'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Justificativa curta</p>
          <p className="mt-2 text-sm text-foreground/90">{result.justification}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Itens que motivaram o ranking</p>
            </div>
            <div className="mt-3 space-y-2">
              {result.matchedItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/50 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Item {item.numero_item || '-'}</Badge>
                    <Badge variant={tipoVariantByItem[item.tipo_item]}>{tipoLabelByItem[item.tipo_item]}</Badge>
                    {item.codigo_catmat_catser && (
                      <Badge variant="outline">Catalogo {item.codigo_catmat_catser}</Badge>
                    )}
                    {Number(item.maximo_adesao || 0) > 0 && (
                      <Badge variant="outline">Max. adesao {formatQuantity(item.maximo_adesao)}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground/90">{item.descricao}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {item.valor_unitario !== undefined && item.valor_unitario !== null && (
                      <span>Valor unitario: {formatCurrency(item.valor_unitario)}</span>
                    )}
                    {item.fornecedor_nome && <span>Fornecedor: {item.fornecedor_nome}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/70 p-4">
            <div className="flex items-center gap-2">
              {module === 'adesao' ? <Tags className="h-4 w-4 text-primary" /> : <Wrench className="h-4 w-4 text-primary" />}
              <p className="text-sm font-semibold">Leitura rapida</p>
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Numero da ata: {result.ata.numero_ata}</p>
              <p>Ano: {result.ata.ano_ata || 'Nao informado'}</p>
              <p>Fonte: {result.ata.fonte}</p>
              {result.adesaoAnalysis.orgaoCnpj && <p>CNPJ do orgao: {result.adesaoAnalysis.orgaoCnpj}</p>}
              <p>Status de adesao: {adesaoStatusLabelByStatus[result.adesaoAnalysis.status]}</p>
              <p>{result.adesaoAnalysis.message}</p>
              <p>Proximo passo: {nextStep}</p>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            {isDetailLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando detalhe da ata...
              </div>
            )}

            {!isDetailLoading && detail && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Ata {detail.ata.numero_ata}</Badge>
                  <Badge variant={statusVariantByVigencia[detail.ata.status_vigencia]}>{detail.ata.status_vigencia}</Badge>
                  <Badge variant="outline">{detail.itens.length} itens cadastrados</Badge>
                  <Badge variant="outline">{detail.documentos.length} documentos vinculados</Badge>
                  <Badge variant={adesaoStatusVariantByStatus[result.adesaoAnalysis.status]}>
                    {adesaoStatusLabelByStatus[result.adesaoAnalysis.status]}
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Metadados da ata</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Orgao: {detail.ata.orgao_gerenciador || 'Nao informado'}</p>
                      {result.adesaoAnalysis.orgaoCnpj && <p>CNPJ do orgao: {result.adesaoAnalysis.orgaoCnpj}</p>}
                      {result.adesaoAnalysis.naturezaJuridica && <p>Natureza juridica: {result.adesaoAnalysis.naturezaJuridica}</p>}
                      <p>Inicio da vigencia: {formatDate(detail.ata.vigencia_inicio)}</p>
                      <p>Fim da vigencia: {formatDate(detail.ata.vigencia_fim)}</p>
                      <p>{result.adesaoAnalysis.message}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Itens vinculados</p>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {detail.itens.map((item) => (
                        <div key={item.id} className="rounded-lg border border-border/40 bg-background/80 p-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Item {item.numero_item || '-'}</Badge>
                            <Badge variant={tipoVariantByItem[item.tipo_item]}>{tipoLabelByItem[item.tipo_item]}</Badge>
                            {item.codigo_catmat_catser && <Badge variant="outline">{item.codigo_catmat_catser}</Badge>}
                            {Number(item.maximo_adesao || 0) > 0 && (
                              <Badge variant="outline">Max. adesao {formatQuantity(item.maximo_adesao)}</Badge>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-foreground/90">{item.descricao}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {item.valor_unitario !== undefined && item.valor_unitario !== null && (
                              <span>Valor unitario: {formatCurrency(item.valor_unitario)}</span>
                            )}
                            {item.valor_total !== undefined && item.valor_total !== null && (
                              <span>Valor total: {formatCurrency(item.valor_total)}</span>
                            )}
                            {item.fornecedor_nome && <span>Fornecedor: {item.fornecedor_nome}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssistantResultsMessage({
  messageId,
  module,
  response,
  reply,
  activeAtaKey,
  loadingDetailKey,
  detailsByAta,
  onToggleDetail,
  onRefine,
}: AssistantResultsMessageProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">Entendimento da demanda</Badge>
          {response.sessionId && <Badge variant="outline">Sessao {response.sessionId.slice(0, 8)}</Badge>}
          <Badge variant={reply.provider === 'gemini' ? 'info' : 'outline'}>
            {reply.provider === 'gemini' ? `Gemini${reply.model ? ` ${reply.model}` : ''}` : 'Resumo local'}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">{reply.text}</p>
        <p className="mt-3 text-sm text-foreground/90">{response.intent.understanding}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {response.intent.tokens.map((token) => (
            <Badge key={`${messageId}-${token}`} variant="outline">
              {token}
            </Badge>
          ))}
          {!response.intent.tokens.length && <Badge variant="outline">Sem termos relevantes extraidos</Badge>}
        </div>

        {response.previousQuery && (
          <p className="mt-3 text-xs text-muted-foreground">Refinamento da busca anterior: {response.previousQuery}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Filtros ativos: {formatSessionFilters(response.filters)}</p>
      </div>

      {response.results.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
          <p className="text-sm font-medium text-foreground">Nenhum resultado encontrado para esta formulacao.</p>
          <p className="mt-2 text-sm text-muted-foreground">{response.nextStep}</p>
        </div>
      ) : (
        response.results.map((result) => {
          const ataKey = `${messageId}:${result.ata.id}`;
          return (
            <ResultCard
              key={`${messageId}-${result.ata.id}-${result.position}`}
              ataKey={ataKey}
              module={module}
              result={result}
              nextStep={response.nextStep}
              isOpen={activeAtaKey === ataKey}
              isDetailLoading={loadingDetailKey === ataKey}
              detail={detailsByAta[result.ata.id]}
              onToggleDetail={onToggleDetail}
            />
          );
        })
      )}

      {response.refinementSuggestions.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-background/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugestoes de refinamento</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {response.refinementSuggestions.map((suggestion) => (
              <Button
                key={`${messageId}-${suggestion}`}
                variant="outline"
                size="sm"
                onClick={() => onRefine(suggestion, response.filters)}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AtasSearchWorkspace({ module }: AtasSearchWorkspaceProps) {
  const definition = atasService.getModuleDefinition(module);
  const status = atasService.getModuleStatus(module);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState('');
  const [latestResponse, setLatestResponse] = useState<AtaSearchResponse | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([createWelcomeMessage()]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeAtaKey, setActiveAtaKey] = useState<string | null>(null);
  const [detailsByAta, setDetailsByAta] = useState<Record<string, AtaDetalhe | undefined>>({});
  const [loadingDetailKey, setLoadingDetailKey] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [sessionHistory, setSessionHistory] = useState<AtaSearchSessionSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [filters, setFilters] = useState<AtaSearchFilters>(defaultFilters);

  const exampleQueries = useMemo(
    () =>
      module === 'adesao'
        ? [
            'notebooks para laboratorio de informatica',
            'cadeiras ergonomicas para setor administrativo',
            'servico de manutencao de impressoras',
          ]
        : [
            'servico de garantia estendida para notebooks',
            'impressora multifuncional com suprimentos',
            'mesa para laboratorio de informatica',
          ],
    [module]
  );

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const sessions = await atasService.listRecentSessions(module);
        if (active) {
          setSessionHistory(sessions);
        }
      } catch (historyError) {
        console.error(historyError);
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [module]);

  useEffect(() => {
    if (!timelineRef.current) return;
    timelineRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSearching]);

  const refreshHistory = async () => {
    const sessions = await atasService.listRecentSessions(module);
    setSessionHistory(sessions);
  };

  const conversationHistory = useMemo(
    () =>
      messages.flatMap((message) => {
        if (message.role === 'user') {
          return [{ role: 'user' as const, text: message.query }];
        }

        if (message.kind === 'results') {
          return [{ role: 'assistant' as const, text: message.reply.text }];
        }

        if (message.kind === 'error') {
          return [{ role: 'assistant' as const, text: message.content }];
        }

        return [];
      }),
    [messages]
  );

  const appendErrorMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'assistant',
        kind: 'error',
        content,
      },
    ]);
  };

  const executeSearch = async (nextQuery?: string, nextFilters?: AtaSearchFilters) => {
    const targetQuery = (nextQuery ?? query).trim();
    const targetFilters = nextFilters ?? filters;
    if (!targetQuery) {
      appendErrorMessage('Informe uma demanda para iniciar a conversa de busca.');
      return;
    }

    const userMessage: ConversationUserMessage = {
      id: createMessageId(),
      role: 'user',
      query: targetQuery,
      filters: targetFilters,
    };

    setMessages((current) => [...current, userMessage]);
    setActiveAtaKey(null);
    setIsSearching(true);

    try {
      const previousQuery = latestResponse?.query || null;
      const nextResponse = await atasService.search(module, targetQuery, {
        previousQuery,
        filters: targetFilters,
      });
      const reply = await geminiAtasChatService.generateReply({
        module,
        query: targetQuery,
        response: nextResponse,
        history: conversationHistory,
      });

      setLatestResponse(nextResponse);
      setQuery('');
      setFilters(targetFilters);
      setRecentQueries((current) => {
        const merged = [targetQuery, ...current.filter((entry) => entry !== targetQuery)];
        return merged.slice(0, 5);
      });
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          kind: 'results',
          response: nextResponse,
          reply,
        },
      ]);
      await refreshHistory();
    } catch (searchError) {
      const message = searchError instanceof Error ? searchError.message : 'Falha ao executar a busca.';
      appendErrorMessage(message);
    } finally {
      setIsSearching(false);
    }
  };

  const startNewConversation = () => {
    setMessages([createWelcomeMessage()]);
    setLatestResponse(null);
    setQuery('');
    setActiveAtaKey(null);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const restoreSessionIntoConversation = async (session: AtaSearchSessionSummary) => {
    try {
      const replay = await atasService.getSearchSessionReplay(session.id);
      if (!replay) {
        appendErrorMessage('Nao foi possivel recuperar a sessao selecionada.');
        return;
      }

      setLatestResponse(replay);
      setFilters(replay.filters);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'user',
          query: replay.query,
          filters: replay.filters,
        },
        {
          id: createMessageId(),
          role: 'assistant',
          kind: 'results',
          response: replay,
          reply: geminiAtasChatService.buildFallbackReply({
            module,
            query: replay.query,
            response: replay,
            history: [],
          }),
        },
      ]);
    } catch (restoreError) {
      console.error(restoreError);
      appendErrorMessage('Nao foi possivel abrir a sessao anterior na conversa.');
    }
  };

  const toggleAtaDetail = async (ataKey: string, ataId: string) => {
    if (activeAtaKey === ataKey) {
      setActiveAtaKey(null);
      return;
    }

    setActiveAtaKey(ataKey);
    if (detailsByAta[ataId]) return;

    try {
      setLoadingDetailKey(ataKey);
      await atasService.trackDetailOpened(module, ataId);
      const detail = await atasService.getAtaDetalhe(ataId);
      if (detail) {
        setDetailsByAta((current) => ({
          ...current,
          [ataId]: detail,
        }));
      }
    } catch (detailError) {
      console.error(detailError);
      appendErrorMessage('Nao foi possivel carregar o detalhe da ata.');
    } finally {
      setLoadingDetailKey(null);
    }
  };

  return (
    <div className="grid gap-6 pb-10 xl:grid-cols-[1.45fr,0.55fr]">
      <div className="space-y-6">
        <Card className="card-system border-none shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  {definition.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{definition.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={status.enabled ? 'success' : 'secondary'}>
                  {status.enabled ? 'Conversa habilitada' : 'Modulo desabilitado'}
                </Badge>
                <Badge variant={status.sessionReady ? 'default' : 'outline'}>
                  {status.sessionReady ? 'Sessao registrada' : 'Sessao ainda nao registrada'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Foco do modulo</p>
                <p className="mt-2 text-sm font-medium">{definition.focusLabel}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saida prevista</p>
                <p className="mt-2 text-sm font-medium">{definition.outputLabel}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base atual</p>
                <p className="mt-2 text-sm font-medium">{status.sourceName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {status.searchReady ? 'Busca estruturada com refinamento em linha do tempo.' : definition.nextMilestone}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="card-system border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Conversa de triagem</CardTitle>
              <p className="text-sm text-muted-foreground">
                Descreva a demanda, refine ao longo da conversa e abra o detalhe da ata quando fizer sentido.
              </p>
            </div>
            <Button variant="outline" onClick={startNewConversation} disabled={isSearching}>
              <RefreshCcw className="h-4 w-4" />
              Nova conversa
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            <ScrollArea className="h-[820px] rounded-2xl border border-border/60 bg-gradient-to-b from-background to-muted/20">
              <div className="space-y-6 p-5">
                {messages.map((message) => {
                  if (message.role === 'user') {
                    return (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground/80">
                            <User className="h-3.5 w-3.5" />
                            Usuario
                          </div>
                          <p className="mt-2 text-sm leading-6">{message.query}</p>
                          <p className="mt-2 text-xs text-primary-foreground/80">
                            Filtros: {formatSessionFilters(message.filters)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (message.kind === 'welcome') {
                    return (
                      <div key={message.id} className="flex justify-start">
                        <div className="max-w-[92%] rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Bot className="h-3.5 w-3.5 text-primary" />
                            Assistente de triagem
                          </div>
                          <p className="mt-3 text-sm text-foreground/90">{definition.emptyPrompt}</p>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <p>Exemplos de busca:</p>
                            {exampleQueries.map((example) => (
                              <button
                                key={example}
                                type="button"
                                onClick={() => setQuery(example)}
                                className="block text-left transition-colors hover:text-foreground"
                              >
                                - {example}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (message.kind === 'error') {
                    return (
                      <div key={message.id} className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-600">
                            <Bot className="h-3.5 w-3.5" />
                            Assistente
                          </div>
                          <p className="mt-2">{message.content}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="flex justify-start">
                      <div className="max-w-[92%] space-y-4 rounded-2xl border border-border/60 bg-background/90 p-5 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                          Assistente
                        </div>
                        <AssistantResultsMessage
                          messageId={message.id}
                          module={module}
                          response={message.response}
                          reply={message.reply}
                          activeAtaKey={activeAtaKey}
                          loadingDetailKey={loadingDetailKey}
                          detailsByAta={detailsByAta}
                          onToggleDetail={toggleAtaDetail}
                          onRefine={(nextQuery, nextFilters) => {
                            void executeSearch(nextQuery, nextFilters);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {isSearching && (
                  <div className="flex justify-start">
                    <div className="max-w-[70%] rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                        Assistente
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analisando a demanda e montando a resposta estruturada...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={timelineRef} />
              </div>
            </ScrollArea>

            <div className="grid gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 md:grid-cols-2 xl:grid-cols-4">
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

              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/50 bg-background/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`${module}-catalogo`}>Exigir catalogo</Label>
                    <p className="text-xs text-muted-foreground">Mostra apenas itens com CATMAT/CATSER.</p>
                  </div>
                  <Switch
                    id={`${module}-catalogo`}
                    checked={filters.requireCatalog}
                    onCheckedChange={(checked) =>
                      setFilters((current) => ({
                        ...current,
                        requireCatalog: checked,
                      }))
                    }
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>

            {recentQueries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Sugestoes com base no uso recente
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentQueries.map((recentQuery) => (
                    <Button
                      key={recentQuery}
                      variant="outline"
                      size="sm"
                      onClick={() => void executeSearch(recentQuery)}
                      disabled={isSearching}
                    >
                      {recentQuery}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[1fr,auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void executeSearch();
                    }
                  }}
                  placeholder={definition.queryPlaceholder}
                  className="h-12 pl-9"
                />
              </div>
              <Button onClick={() => void executeSearch()} disabled={isSearching} className="h-12">
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="card-system border-none shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <History className="h-4 w-4 text-primary" />
              Historico de sessoes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[920px]">
              <div className="space-y-3 p-6 pt-0">
                {isLoadingHistory && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando sessoes recentes...
                  </div>
                )}

                {!isLoadingHistory && sessionHistory.length === 0 && (
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                    Nenhuma sessao registrada ainda neste modulo.
                  </div>
                )}

                {sessionHistory.map((session) => (
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
                    <p className="mt-2 text-xs text-muted-foreground">{formatSessionFilters(session.filters)}</p>

                    {session.topResult?.ata && (
                      <div className="mt-3 rounded-lg border border-border/50 bg-background/80 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top 1 registrado</p>
                        <p className="mt-1 text-sm font-medium text-foreground">Ata {session.topResult.ata.numero_ata}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{session.topResult.ata.objeto}</p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void restoreSessionIntoConversation(session)}
                        disabled={isSearching}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Abrir na conversa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void executeSearch(session.query, session.filters || defaultFilters)}
                        disabled={isSearching}
                      >
                        Reexecutar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
