import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as pdfjsLib from 'pdfjs-dist';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseEnv, getSupabaseFunctionUrl } from '@/lib/env';
import {
  clearConsultorSessions,
  createConsultorSession,
  type ConsultorMessage as Message,
  type ConsultorSession,
  type ConsultorSourceRef as SourceRef,
  getConsultorStorageKey,
  getResetConsultorSessions,
  loadConsultorSessions,
  replaceSessionMessages,
  saveConsultorSessions,
} from '@/lib/consultorSessions';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ANONYMOUS_STORAGE_KEY = 'consultor-chat-sessions:v2:anonymous-preview';

const loadingTexts = [
  'Analisando normativos do IFRN...',
  'Consultando a base juridica...',
  'Lendo documentos e extraindo contexto...',
  'Procurando regras aplicaveis ao caso...',
  'Formulando resposta do Consultor...',
];

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
};

const formatSessionTimestamp = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

type PendingAttachment = {
  name: string;
  text: string;
  base64?: string;
  file: File;
};

export default function ConsultorSessions() {
  const { user } = useAuth();
  const isAnonymousPreview = !user?.id && !user?.email;
  const storageKey = useMemo(
    () => getConsultorStorageKey(user?.id, user?.email) || ANONYMOUS_STORAGE_KEY,
    [user?.email, user?.id],
  );
  const [sessions, setSessions] = useState<ConsultorSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [portalTargets, setPortalTargets] = useState<{
    actions: HTMLElement | null;
    subtitle: HTMLElement | null;
  }>({ actions: null, subtitle: null });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [attachedFile, setAttachedFile] = useState<PendingAttachment | null>(null);
  const [metadataFilters, setMetadataFilters] = useState({
    categoria: '',
    servico: '',
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || null,
    [activeSessionId, sessions],
  );
  const messages = activeSession?.messages || [];

  useEffect(() => {
    setPortalTargets({
      actions: document.getElementById('header-actions'),
      subtitle: document.getElementById('header-subtitle'),
    });
  }, []);

  useEffect(() => {
    if (!storageKey) {
      setSessions([]);
      setActiveSessionId(null);
      return;
    }

    const loadedSessions = loadConsultorSessions(storageKey);
    if (loadedSessions.length > 0) {
      setSessions(loadedSessions);
      setActiveSessionId((current) =>
        current && loadedSessions.some((session) => session.id === current) ? current : loadedSessions[0].id,
      );
      setAttachedFile(null);
      return;
    }

    const initialSession = createConsultorSession();
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
    setAttachedFile(null);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || sessions.length === 0) return;

    try {
      saveConsultorSessions(storageKey, sessions);
    } catch (error) {
      console.warn('Falha ao salvar sessoes do Consultor', error);
      toast.warning('Nao foi possivel persistir o historico do Consultor neste navegador.');
    }
  }, [sessions, storageKey]);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const updateSession = (sessionId: string, updater: (messages: Message[]) => Message[]) => {
    setSessions((currentSessions) => {
      const targetSession = currentSessions.find((session) => session.id === sessionId);
      if (!targetSession) return currentSessions;

      const updatedMessages = updater(targetSession.messages);
      const updatedSession = replaceSessionMessages(targetSession, updatedMessages);
      return [updatedSession, ...currentSessions.filter((session) => session.id !== sessionId)];
    });
  };

  const handleCreateSession = () => {
    const nextSession = createConsultorSession();
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setAttachedFile(null);
    setInput('');
  };

  const handleClearHistory = () => {
    if (!storageKey) return;
    const confirmMessage = isAnonymousPreview
      ? 'Limpar todas as conversas salvas deste navegador no modo demonstracao?'
      : 'Limpar todas as conversas salvas deste usuario neste navegador?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    clearConsultorSessions(storageKey);
    const resetSessions = getResetConsultorSessions();
    setSessions(resetSessions);
    setActiveSessionId(resetSessions[0].id);
    setAttachedFile(null);
    setInput('');
    toast.success(
      isAnonymousPreview
        ? 'Historico do Consultor limpo neste navegador.'
        : 'Historico do Consultor limpo para este usuario.',
    );
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((currentSessions) => {
      const nextSessions = currentSessions.filter((session) => session.id !== sessionId);

      if (nextSessions.length === 0) {
        const replacement = createConsultorSession();
        setActiveSessionId(replacement.id);
        setAttachedFile(null);
        return [replacement];
      }

      if (activeSessionId === sessionId) {
        setActiveSessionId(nextSessions[0].id);
        setAttachedFile(null);
      }

      return nextSessions;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Por favor, envie apenas arquivos PDF.');
      return;
    }

    const loadToast = toast.loading('Lendo PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

      let fullText = '';
      for (let index = 1; index <= pdf.numPages; index += 1) {
        const page = await pdf.getPage(index);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => ('str' in item ? String(item.str) : '')).join(' ');
        fullText += `${pageText}\n\n`;

        if (fullText.length > 35000) {
          break;
        }
      }

      const scanContext = fullText.slice(0, 5000).toLowerCase();
      let autoService = '';
      if (scanContext.includes('limpeza e conservacao') || scanContext.includes('servicos continuos de limpeza')) {
        autoService = 'limpeza';
      } else if (
        scanContext.includes('manutencao predial') ||
        scanContext.includes('servicos continuados de engenharia')
      ) {
        autoService = 'manutencao';
      } else if (scanContext.includes('conducao de veiculos') || scanContext.includes('motorista')) {
        autoService = 'veiculos';
      } else if (scanContext.includes('vigilancia') || scanContext.includes('seguranca armada')) {
        autoService = 'vigilancia';
      }
      setMetadataFilters((current) => ({ ...current, servico: autoService }));

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setAttachedFile({
        name: file.name,
        text: fullText,
        base64: base64Data,
        file,
      });
      toast.success('PDF carregado. Agora envie a pergunta.', { id: loadToast });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao ler o PDF. Tente novamente.', { id: loadToast });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || !activeSession) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      attachedFile: attachedFile
        ? {
            name: attachedFile.name,
            text: attachedFile.text,
            base64: attachedFile.base64,
          }
        : undefined,
    };

    const sessionId = activeSession.id;
    const nextMessages = activeSession.messages.concat(userMessage);

    updateSession(sessionId, () => nextMessages);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const functionUrl = getSupabaseFunctionUrl('consultor');
      const { anonKey } = getSupabaseEnv();
      const activeFileMeta = [...nextMessages].reverse().find((message) => message.attachedFile?.text)?.attachedFile;
      const metadataPayload = metadataFilters.servico ? { servicos: [metadataFilters.servico] } : null;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-10).map((message) => ({ role: message.role, content: message.content })),
          fileText: activeFileMeta?.text || null,
          fileBase64: activeFileMeta?.base64 || null,
          tipoFiltro: metadataFilters.categoria || null,
          metadataFiltro: metadataPayload,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Falha de conexao com o Consultor.';

        try {
          const responseText = await response.text();
          if (responseText) {
            try {
              const parsedBody = JSON.parse(responseText);
              const parsedMessage =
                parsedBody?.error ||
                parsedBody?.message ||
                parsedBody?.msg ||
                parsedBody?.details ||
                parsedBody?.hint;

              if (typeof parsedMessage === 'string' && parsedMessage.trim()) {
                errorMessage = parsedMessage.trim();
              }
            } catch {
              errorMessage = responseText.trim() || errorMessage;
            }
          }
        } catch {
          // Mantem a mensagem padrao quando nao for possivel ler o corpo.
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('O Consultor nao retornou conteudo.');
      }

      const aiMessageId = `assistant-${Date.now()}`;
      updateSession(sessionId, (currentMessages) => [
        ...currentMessages,
        { id: aiMessageId, role: 'assistant', content: '', sources: [] },
      ]);
      setIsLoading(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let availableSources: SourceRef[] = [];

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!line.startsWith('data: ')) {
            continue;
          }

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') {
            continue;
          }

          try {
            const data = JSON.parse(jsonStr);
            if (data.__metadata) {
              availableSources = data.fontes_disponiveis || [];
              continue;
            }

            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              assistantText += data.candidates[0].content.parts[0].text;

              updateSession(sessionId, (currentMessages) =>
                currentMessages.map((message) => {
                  if (message.id !== aiMessageId) return message;

                  const citationsMatch = assistantText.match(/\[(\d+)\]/g);
                  const citedNumbers = citationsMatch
                    ? [...new Set(citationsMatch.map((value: string) => Number.parseInt(value.replace(/\D/g, ''), 10)))]
                    : [];

                  return {
                    ...message,
                    content: assistantText.replace(/(\s*\[\d+\]\s*,?)+/g, '').trim(),
                    sources: citedNumbers
                      .filter((value) => value > 0 && value <= availableSources.length)
                      .map((value) => availableSources[value - 1]),
                  };
                }),
              );
              continue;
            }

            const finishReason = data.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP') {
              assistantText += `\n\n*[Aviso do sistema: a analise foi interrompida. Motivo tecnico: ${finishReason}]*`;
              updateSession(sessionId, (currentMessages) =>
                currentMessages.map((message) =>
                  message.id === aiMessageId
                    ? {
                        ...message,
                        content: assistantText.replace(/(\s*\[\d+\]\s*,?)+/g, '').trim(),
                      }
                    : message,
                ),
              );
            }
          } catch (error) {
            console.error('Falha ao interpretar resposta SSE do Consultor', error, jsonStr.substring(0, 120));
          }
        }

        if (done) break;
      }
    } catch (error) {
      console.error(error);
      toast.error(`Erro de conexao com o Consultor IA: ${getErrorMessage(error)}`);
      updateSession(sessionId, (currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'Desculpe, enfrentei um erro ao buscar a resposta. Pode tentar novamente?',
        },
      ]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-50 md:flex-row">
      {portalTargets.actions &&
        createPortal(
          <div className="flex items-center gap-2">
            {isAnonymousPreview && (
              <span className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                Modo demonstracao
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[12px] text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
              onClick={handleClearHistory}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Limpar historico
            </Button>
          </div>,
          portalTargets.actions,
        )}

      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white md:w-80 md:border-b-0 md:border-r">
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Conversas</h2>
            <Button type="button" size="sm" className="h-9" onClick={handleCreateSession}>
              <Plus className="mr-2 h-4 w-4" />
              Nova
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-[180px] flex-1">
          <div className="space-y-2 p-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group w-full rounded-2xl border px-4 py-3 transition-all',
                  activeSession?.id === session.id
                    ? 'border-primary/20 bg-primary/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSessionId(session.id);
                      setAttachedFile(null);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">{session.title}</p>
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
                        {formatSessionTimestamp(session.updatedAt)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{session.lastMessagePreview}</p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleDeleteSession(session.id)}
                    title="Excluir conversa"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="w-full space-y-8 px-4 py-6 md:px-10 md:py-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex gap-4 sm:gap-6', message.role === 'user' ? 'ml-auto max-w-[85%] flex-row-reverse' : 'w-full')}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
                    message.role === 'user' ? 'bg-slate-300' : 'bg-primary',
                  )}
                >
                  {message.role === 'user' ? <User className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
                </div>

                <div className={cn('relative top-1 flex flex-col gap-2', message.role === 'user' ? 'items-end' : 'min-w-0 flex-1')}>
                  {message.attachedFile && (
                    <div className="flex w-fit items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{message.attachedFile.name}</span>
                    </div>
                  )}

                  {message.content && (
                    <div
                      className={cn(
                        'text-[12px] leading-relaxed',
                        message.role === 'user'
                          ? 'rounded-2xl rounded-tr-sm bg-slate-100 px-5 py-3.5 text-slate-800'
                          : 'prose prose-sm max-w-none rounded-2xl rounded-tl-sm border border-primary/10 bg-primary/5 px-5 py-4 text-slate-900 prose-p:mb-2 prose-p:text-[12px] prose-p:leading-relaxed prose-li:mb-3 prose-li:text-[12px] prose-a:text-primary prose-ul:my-3',
                      )}
                    >
                      {message.role === 'user' ? (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      )}
                    </div>
                  )}

                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex w-full flex-col gap-1.5">
                      <h4 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <ShieldCheck className="h-3 w-3" />
                        Fontes consultadas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(
                          message.sources.reduce((acc: Record<string, SourceRef[]>, source: SourceRef) => {
                            if (!acc[source.titulo]) acc[source.titulo] = [];
                            if (!acc[source.titulo].find((item) => item.referencia === source.referencia)) {
                              acc[source.titulo].push(source);
                            }
                            return acc;
                          }, {}),
                        ).map(([title, refs], index) => (
                          <div key={`${title}-${index}`} className="max-w-sm rounded-lg border bg-slate-50 p-2.5">
                            <p className="text-[11px] font-bold text-slate-700">{title}</p>
                            <div className="mt-1 space-y-1">
                              {refs.slice(0, 2).map((ref, refIndex) => (
                                <p
                                  key={`${ref.referencia}-${refIndex}`}
                                  className="flex items-center gap-1 truncate text-[10px] text-slate-500"
                                >
                                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                                  {ref.referencia}
                                </p>
                              ))}
                              {refs.length > 2 && (
                                <p className="text-[10px] italic text-slate-400">...e mais {refs.length - 2} trechos</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex w-full gap-4 transition-opacity duration-300 sm:gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Bot className="h-6 w-6 animate-pulse" />
                </div>
                <div className="relative top-1 flex min-w-[280px] items-center gap-3 overflow-hidden rounded-2xl rounded-tl-sm border border-primary/10 bg-primary/5 px-6 py-4 text-[15px] font-semibold text-primary">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span key={loadingTextIndex} className="animate-pulse">
                    {loadingTexts[loadingTextIndex]}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
          <div className="w-full px-4 pb-4 pt-3 md:px-10 md:pb-5">
            {attachedFile && (
              <div className="mb-3 flex max-w-full items-center justify-between rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="shrink truncate">
                    <p className="truncate text-sm font-bold text-slate-700">{attachedFile.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      PDF anexado para analise ({(attachedFile.file.size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-4 shrink-0 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setAttachedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="relative flex items-end gap-3">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />

              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-12 w-12 shrink-0 border-slate-300 bg-white text-slate-500 hover:border-primary hover:text-primary disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || Boolean(attachedFile)}
                title="Anexar arquivo PDF para analise"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <textarea
                className="min-h-[48px] max-h-32 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={
                  attachedFile
                    ? 'Faca uma pergunta ou peca para analisar o PDF anexado...'
                    : 'Tire uma duvida com o Consultor Juridico...'
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !activeSession}
                rows={1}
                style={{ height: 'auto' }}
              />

              <Button
                type="button"
                size="icon"
                className="h-12 w-12 shrink-0 bg-primary text-white shadow-md hover:bg-primary/90 disabled:bg-primary/50"
                disabled={(!input.trim() && !attachedFile) || isLoading || !activeSession}
                onClick={() => void handleSend()}
              >
                <Send className="ml-1 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
