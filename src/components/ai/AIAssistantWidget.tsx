import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Database,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

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
  'Resumindo execucao e saldos...',
  'Conferindo contratos e empenhos...',
  'Preparando resposta gerencial...',
];

const startSuggestions = [
  {
    icon: Database,
    label: 'Resumo da execucao',
    prompt: 'Qual o resumo da execucao orcamentaria?',
  },
  {
    icon: FileText,
    label: 'Maiores empenhos',
    prompt: 'Quais empenhos tem maior saldo?',
  },
  {
    icon: Sparkles,
    label: 'Alertas gerenciais',
    prompt: 'Quais pontos dos dados exigem atencao agora?',
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

    const interval = setInterval(() => {
      setLoadingTextIndex((current) => (current + 1) % loadingTexts.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const updateMessages = (updater: (messages: AssistenteGerencialMessage[]) => AssistenteGerencialMessage[]) => {
    setSession((current) => replaceAssistenteGerencialMessages(current, updater(current.messages)));
  };

  const askAssistant = async (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isLoading) return;

    const userMessage = createMessage('user', trimmedPrompt);
    const nextMessages = [...messages, userMessage];

    updateMessages(() => nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await assistenteGerencialService.ask({
        message: trimmedPrompt,
        history: messages,
      });
      const assistantMessage: AssistenteGerencialMessage = {
        ...createMessage('assistant', result.response),
        suggestions: result.suggestions,
      };

      updateMessages((currentMessages) => [...currentMessages, assistantMessage]);

      if (result.warnings.length > 0) {
        toast.warning(result.warnings[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao consultar o assistente.';
      updateMessages((currentMessages) => [
        ...currentMessages,
        createMessage('assistant', `Nao consegui consultar os dados agora. ${message}`),
      ]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void askAssistant(input);
  };

  const handleClear = () => {
    setSession(clearAssistenteGerencialSession(storageKey));
    setInput('');
  };

  const hasConversation = messages.some((message) => message.role === 'user');
  const latestSuggestions = messages[messages.length - 1]?.suggestions || [];

  return (
    <>
      {isOpen && isExpanded ? (
        <button
          type="button"
          aria-label="Fechar modo expandido do Assistente Gerencial"
          className="fixed inset-0 z-40 cursor-default bg-slate-900/40 backdrop-blur-sm"
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
            'pointer-events-auto mb-3 flex origin-bottom-right flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all duration-200',
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none',
            isExpanded
              ? 'h-full w-full'
              : 'h-[min(660px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] sm:w-[440px]',
          )}
        >
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <Bot className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-950">Assistente Gerencial IA</h2>
                <p className="truncate text-xs font-medium text-slate-500">Dados do GovFlow em linguagem natural</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {hasConversation ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
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
                className="h-10 w-10 rounded-lg text-slate-500"
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
                className="h-10 w-10 rounded-lg text-slate-500"
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

          <div className="flex-1 overflow-y-auto bg-slate-50/80 px-4 py-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'border border-slate-200 bg-white text-slate-800',
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-2 prose-li:my-1 prose-strong:text-slate-950">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {!hasConversation && !isLoading ? (
                <div className="grid gap-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sugestoes para comecar</p>
                  {startSuggestions.map((suggestion) => {
                    const Icon = suggestion.icon;

                    return (
                      <button
                        key={suggestion.prompt}
                        type="button"
                        className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        onClick={() => void askAssistant(suggestion.prompt)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proximas perguntas</p>
                  {latestSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      onClick={() => void askAssistant(suggestion)}
                    >
                      <span>{suggestion}</span>
                      <ChevronDown className="h-4 w-4 rotate-[-90deg] text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : null}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="flex min-h-12 items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingTexts[loadingTextIndex]}</span>
                  </div>
                </div>
              ) : null}

              <div ref={scrollRef} />
            </div>
          </div>

          <form className="border-t border-slate-200 bg-white p-3" onSubmit={handleSubmit}>
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
                placeholder="Pergunte sobre saldos, empenhos, contratos ou execucao..."
                rows={1}
                disabled={isLoading}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-lg bg-primary text-white hover:bg-primary/90"
                disabled={!input.trim() || isLoading}
                aria-label="Enviar pergunta"
                title="Enviar"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
              As respostas usam somente dados disponiveis para o usuario autenticado.
            </p>
          </form>
        </section>

        <button
          type="button"
          className={cn(
            'pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
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
