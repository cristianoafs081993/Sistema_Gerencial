import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Database,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Scale,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { PriceResearchChatCard } from '@/components/ai/PriceResearchChatCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearAssistenteGerencialSession,
  createAssistenteGerencialSession,
  getAssistenteGerencialStorageKey,
  loadAssistenteGerencialSession,
  replaceAssistenteGerencialMessages,
  saveAssistenteGerencialSession,
  type AssistenteGerencialMessage,
  type AssistenteGerencialSession,
} from '@/lib/assistenteGerencialSessions';
import { cn } from '@/lib/utils';
import { assistenteGerencialService } from '@/services/assistenteGerencial';

const loadingTexts = [
  'Consultando dados do sistema...',
  'Varrendo editais e cotações no PNCP...',
  'Auditando Termos de Referência com IA...',
  'Calculando cesta e conformidade IN 65/2021...',
  'Preparando resposta gerencial...',
];

const startSuggestions = [
  {
    icon: Scale,
    label: 'Pesquisa de preços com Edital',
    prompt: 'Pesquise preços para 50 monitores 27 polegadas 4K e 20 cadeiras ergonômicas com auditoria de editais no PNCP',
  },
  {
    icon: Database,
    label: 'Resumo da execução',
    prompt: 'Qual o resumo da execução orçamentária?',
  },
  {
    icon: FileText,
    label: 'Maiores empenhos',
    prompt: 'Quais empenhos têm maior saldo?',
  },
  {
    icon: Sparkles,
    label: 'Alertas gerenciais',
    prompt: 'Quais pontos dos dados exigem atenção agora?',
  },
];

function createMessage(role: AssistenteGerencialMessage['role'], content: string): AssistenteGerencialMessage {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${role}-${crypto.randomUUID()}`
    : `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return { id, role, content };
}

export function AIAssistantWidget() {
  const { user } = useAuth();
  const storageKey = useMemo(
    () => getAssistenteGerencialStorageKey(user?.id, user?.email),
    [user?.email, user?.id],
  );
  const [session, setSession] = useState<AssistenteGerencialSession>(() => createAssistenteGerencialSession());
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = session.messages;

  useEffect(() => {
    setSession(loadAssistenteGerencialSession(storageKey));
  }, [storageKey]);

  useEffect(() => {
    saveAssistenteGerencialSession(storageKey, session);
  }, [session, storageKey]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingTextIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingTextIndex((current) => (current + 1) % loadingTexts.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const hasConversation = messages.length > 0;

  const latestSuggestions = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.suggestions?.slice(0, 3) || [];
  }, [messages]);

  const handleClear = () => {
    clearAssistenteGerencialSession(storageKey);
    setSession(createAssistenteGerencialSession());
    toast.success('Conversa do Assistente Gerencial reiniciada.');
  };

  const askAssistant = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMessage = createMessage('user', trimmed);
    const updatedMessages = [...messages, userMessage];

    setSession((current) => replaceAssistenteGerencialMessages(current, updatedMessages));
    setInput('');
    setIsLoading(true);

    try {
      const response = await assistenteGerencialService.perguntar({
        pergunta: trimmed,
        historico: updatedMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      const assistantMessage: AssistenteGerencialMessage = {
        ...createMessage('assistant', response.resposta || response.response || ''),
        sources: response.fontes || response.sources || [],
        suggestions: response.sugestoes || response.suggestions || [],
        warnings: response.avisos || response.warnings || [],
        priceResearchData: response.priceResearchResult,
      };

      setSession((current) => replaceAssistenteGerencialMessages(current, [...updatedMessages, assistantMessage]));
    } catch (error) {
      console.error(error);
      const fallbackContent = error instanceof Error
        ? error.message
        : 'Não foi possível consultar os dados gerenciais neste momento.';

      const errorMessage: AssistenteGerencialMessage = {
        ...createMessage('assistant', fallbackContent),
        warnings: ['Ocorreu uma falha na consulta aos serviços de apoio.'],
      };

      setSession((current) => replaceAssistenteGerencialMessages(current, [...updatedMessages, errorMessage]));
      toast.error('Falha ao processar resposta do Assistente Gerencial.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askAssistant(input);
  };

  return (
    <>
      {isOpen && isExpanded ? (
        <button
          type="button"
          aria-label="Fechar modo expandido do Assistente Gerencial"
          className="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-xs"
          onClick={() => setIsExpanded(false)}
        />
      ) : null}

      <div
        className={cn(
          'fixed z-50 flex flex-col items-end pointer-events-none',
          isExpanded ? 'inset-4 justify-center md:inset-8' : 'bottom-5 right-4 sm:right-6',
        )}
      >
        <section
          aria-label="Assistente Gerencial IA"
          className={cn(
            'pointer-events-auto mb-3 flex origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none',
            isExpanded
              ? 'h-full w-full'
              : 'h-[min(660px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] sm:w-[440px]',
          )}
        >
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-foreground">Assistente Gerencial IA</h2>
                <p className="truncate text-xs font-medium text-muted-foreground">Dados em linguagem natural</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {hasConversation ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClear}
                  title="Limpar conversa"
                  aria-label="Limpar conversa"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setIsExpanded((current) => !current)}
                title={isExpanded ? 'Restaurar tamanho' : 'Expandir'}
                aria-label={isExpanded ? 'Restaurar tamanho' : 'Expandir assistente'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  setIsExpanded(false);
                  setIsOpen(false);
                }}
                title="Fechar"
                aria-label="Fechar Assistente Gerencial"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-muted/30 px-4 py-4 scrollbar-thin">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                        : 'border border-border bg-card text-foreground',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div>
                        <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-p:my-1 prose-p:text-foreground prose-ul:my-2 prose-li:my-1 prose-li:text-foreground prose-strong:text-foreground prose-strong:font-bold prose-a:text-primary">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                        {message.warnings?.length ? (
                          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            {message.warnings[0]}
                          </div>
                        ) : null}
                        {message.priceResearchData ? (
                          <PriceResearchChatCard data={message.priceResearchData} />
                        ) : null}
                        {message.sources?.length ? (
                          <p className="mt-3 border-t border-border pt-2 text-[11px] font-medium text-muted-foreground">
                            Fontes: {message.sources.slice(0, 4).map((source) => {
                              const total = source.totalDisponivel ?? source.totalAmostra;
                              return total !== null && total !== undefined ? `${source.label} (${total})` : source.label;
                            }).join(', ')}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-primary-foreground">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {!hasConversation && !isLoading ? (
                <div className="grid gap-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sugestões para começar</p>
                  {startSuggestions.map((suggestion) => {
                    const Icon = suggestion.icon;

                    return (
                      <button
                        key={suggestion.prompt}
                        type="button"
                        className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-foreground shadow-xs transition hover:border-primary/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
                        onClick={() => void askAssistant(suggestion.prompt)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>{suggestion.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {messages.length > 1 && !isLoading && latestSuggestions.length ? (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Próximas perguntas</p>
                  {latestSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-semibold text-foreground shadow-xs transition hover:border-primary/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
                      onClick={() => void askAssistant(suggestion)}
                    >
                      <span>{suggestion}</span>
                      <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : null}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/30 bg-card px-4 py-3 text-sm font-semibold text-primary shadow-xs">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingTexts[loadingTextIndex]}</span>
                  </div>
                </div>
              ) : null}

              <div ref={scrollRef} />
            </div>
          </div>

          <form className="border-t border-border bg-card p-3" onSubmit={handleSubmit}>
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="assistente-gerencial-input">
                Pergunta para o Assistente Gerencial
              </label>
              <textarea
                id="assistente-gerencial-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void askAssistant(input);
                  }
                }}
                placeholder="Pergunte sobre saldos, empenhos, contratos ou execução..."
                rows={1}
                disabled={isLoading}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                disabled={!input.trim() || isLoading}
                aria-label="Enviar pergunta"
                title="Enviar"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
              As respostas usam somente dados disponíveis para o usuário autenticado.
            </p>
          </form>
        </section>

        <button
          type="button"
          className={cn(
            'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition duration-200 hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 border border-primary-foreground/20 cursor-pointer',
            isOpen && 'scale-95 opacity-0 pointer-events-none',
          )}
          onClick={() => setIsOpen(true)}
          aria-label="Abrir Assistente Gerencial"
          title="Abrir Assistente Gerencial"
        >
          <Bot className="h-6 w-6" />
        </button>
      </div>
    </>
  );
}
