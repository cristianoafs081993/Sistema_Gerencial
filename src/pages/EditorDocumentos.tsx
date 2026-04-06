import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, Copy, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import RichTextEditor from '@/components/Editor/RichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import {
  buildDespachoLiquidacaoHtml,
  documentDefinitions,
  extractProcessNumbers,
  resolveDocumentIntent,
  type DocumentIntent,
  type ResolvedDocumentContext,
} from '@/lib/documentGeneration';
import { suapProcessosService } from '@/services/suapProcessos';

type ScreenState = 'idle' | 'resolving' | 'ambiguous' | 'not_found';
type FeedbackTone = 'neutral' | 'warning' | 'success';

type ExampleProcessCard = {
  id: string;
  processo: string;
  beneficiario?: string;
};

type GeneratedDispatch = {
  id: string;
  title: string;
  subtitle?: string;
  processo?: string;
  html: string;
};

const stripHtml = (html: string) => {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const dividerHtml =
  '<hr style="margin:32px 0;border:none;border-top:4px dotted #475569;page-break-after:always;" />';
const cloneDocumentUrl = 'https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/1026154/';

const buildIntentFromProcess = (processo: string): DocumentIntent => ({
  documentType: 'despacho-liquidacao',
  lookupType: 'processo',
  lookupValue: processo,
  rawPrompt: `Gerar despacho de liquidacao do processo ${processo}`,
});

const feedbackClasses: Record<FeedbackTone, string> = {
  neutral: 'border-border-default bg-surface-subtle/70 text-text-secondary',
  warning: 'border-warning/20 bg-warning/10 text-amber-900',
  success: 'border-status-success/20 bg-status-success/10 text-emerald-900',
};

function ModelSubmenu({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-radius-lg border border-border-default/70 bg-surface-subtle/50 px-3 py-2">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Modelos</p>
      </div>

      <div className="space-y-1.5 pl-2">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/70">Liquidação</p>
        <button
          type="button"
          onClick={onClick}
          className="group flex w-full items-start gap-3 rounded-radius-lg border border-primary/15 bg-primary/[0.06] px-3 py-3 text-left transition-all duration-200 hover:border-primary/25 hover:bg-primary/[0.09]"
        >
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-radius-md bg-primary text-primary-foreground shadow-soft">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{title}</p>
            <p className="mt-1 font-ui text-[11px] leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function ExampleCard({
  processo,
  beneficiario,
  onClick,
}: {
  processo: string;
  beneficiario?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-radius-lg border border-border-default/70 bg-surface-card px-3 py-2.5 text-left shadow-xs transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/40 hover:shadow-soft"
    >
      <span className="font-mono text-[12px] font-semibold text-text-primary">{processo}</span>
      <span className="mt-1 line-clamp-2 font-ui text-[10px] leading-relaxed text-text-secondary">{beneficiario || 'Sincronizado no SUAP'}</span>
    </button>
  );
}

function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: ResolvedDocumentContext;
  onSelect: (candidate: ResolvedDocumentContext) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className="w-full rounded-radius-xl border border-border-default bg-surface-card px-4 py-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/30 hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-ui text-sm font-semibold tracking-tight text-text-primary">{candidate.title}</p>
          <p className="mt-1 font-ui text-sm text-text-secondary">{candidate.subtitle || 'Selecionar esta minuta'}</p>
        </div>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary/45" />
      </div>
    </button>
  );
}

export default function EditorDocumentos() {
  const { empenhos, contratos, contratosEmpenhos } = useData();
  const [processInput, setProcessInput] = useState('');
  const [screenState, setScreenState] = useState<ScreenState>('idle');
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('neutral');
  const [pendingCandidates, setPendingCandidates] = useState<ResolvedDocumentContext[]>([]);
  const [editorContent, setEditorContent] = useState('<p></p>');
  const [selectedTitle, setSelectedTitle] = useState('Despacho de Liquidacao');
  const [generatedDispatches, setGeneratedDispatches] = useState<GeneratedDispatch[]>([]);
  const [copiedDispatchIds, setCopiedDispatchIds] = useState<string[]>([]);
  const [clonedDispatchIds, setClonedDispatchIds] = useState<string[]>([]);

  const resources = useMemo(
    () => ({ empenhos, contratos, contratosEmpenhos }),
    [empenhos, contratos, contratosEmpenhos],
  );

  const activeDocument = documentDefinitions[0];

  const { data: syncedProcesses = [] } = useQuery({
    queryKey: ['suap-processos', 'editor-exemplos'],
    queryFn: suapProcessosService.getAll,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const exampleProcesses = useMemo<ExampleProcessCard[]>(
    () =>
      syncedProcesses
        .filter((processo) => processo.numProcesso)
        .map((processo) => ({
          id: processo.id,
          processo: processo.numProcesso!.trim(),
          beneficiario: processo.beneficiario || processo.assunto,
        })),
    [syncedProcesses],
  );

  const detectedProcesses = useMemo(() => extractProcessNumbers(processInput), [processInput]);

  const openContext = (context: ResolvedDocumentContext) => {
    const html = buildDespachoLiquidacaoHtml(context);
    setSelectedTitle(context.title || activeDocument.name);
    setEditorContent(html);
    setGeneratedDispatches([
      {
        id: context.candidateId,
        title: context.title || activeDocument.name,
        subtitle: context.subtitle,
        processo: context.processo,
        html,
      },
    ]);
    setCopiedDispatchIds([]);
    setClonedDispatchIds([]);
    setPendingCandidates([]);
    setFeedback('');
    setScreenState('idle');
  };

  const handleAppendProcess = (processo: string) => {
    const processValue = processo.trim();

    if (!processValue) {
      return;
    }

    setProcessInput((current) => {
      const existing = extractProcessNumbers(current);
      if (existing.includes(processValue)) return current;
      return current.trim() ? `${current.trim()}\n${processValue}` : processValue;
    });
  };

  const handleBatchResolve = async (rawInput = processInput) => {
    const processes = extractProcessNumbers(rawInput);

    if (processes.length === 0) {
      const message = 'Informe pelo menos um numero de processo valido para gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setPendingCandidates([]);
      setScreenState('not_found');
      toast.error(message);
      return;
    }

    setPendingCandidates([]);
    setFeedback('');
    setScreenState('resolving');

    try {
      const results = await Promise.all(
        processes.map((processo) => resolveDocumentIntent(buildIntentFromProcess(processo), resources)),
      );

      if (processes.length === 1) {
        const result = results[0];

        if (result.status === 'resolved') {
          openContext(result.context);
          return;
        }

        if (result.status === 'ambiguous') {
          setPendingCandidates(result.candidates);
          setFeedback(result.message);
          setFeedbackTone('neutral');
          setScreenState('ambiguous');
          return;
        }

        setFeedback(result.message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const resolvedContexts = results.flatMap((result) => (result.status === 'resolved' ? [result.context] : []));
      const ambiguousResults = results.flatMap((result) =>
        result.status === 'ambiguous' ? [{ processo: result.intent.lookupValue, count: result.candidates.length }] : [],
      );
      const notFoundProcesses = results.flatMap((result) =>
        result.status === 'not_found' ? [result.intent.lookupValue] : [],
      );

      if (resolvedContexts.length === 0) {
        const message = ambiguousResults.length > 0
          ? 'Nao consegui montar o lote automaticamente. Gere os processos pendentes individualmente.'
          : 'Nao encontrei dados suficientes para os processos informados.';
        setFeedback(message);
        setFeedbackTone('warning');
        setScreenState('not_found');
        return;
      }

      const combinedHtml = resolvedContexts
        .map((context) => buildDespachoLiquidacaoHtml(context))
        .join(dividerHtml);
      const dispatches = resolvedContexts.map((context) => ({
        id: context.candidateId,
        title: context.title || activeDocument.name,
        subtitle: context.subtitle,
        processo: context.processo,
        html: buildDespachoLiquidacaoHtml(context),
      }));

      setSelectedTitle(
        resolvedContexts.length === 1 ? resolvedContexts[0].title || activeDocument.name : 'Lote de Despachos de Liquidacao',
      );
      setEditorContent(combinedHtml);
      setGeneratedDispatches(dispatches);
      setCopiedDispatchIds([]);
      setClonedDispatchIds([]);
      setPendingCandidates([]);
      setScreenState('idle');

      const messageParts = [`${resolvedContexts.length} minuta${resolvedContexts.length > 1 ? 's' : ''} gerada${resolvedContexts.length > 1 ? 's' : ''}`];
      if (ambiguousResults.length > 0) {
        messageParts.push(
          `${ambiguousResults.length} processo${ambiguousResults.length > 1 ? 's' : ''} precisa${ambiguousResults.length > 1 ? 'm' : ''} de selecao manual`,
        );
      }
      if (notFoundProcesses.length > 0) {
        messageParts.push(
          `${notFoundProcesses.length} processo${notFoundProcesses.length > 1 ? 's' : ''} sem dados suficientes`,
        );
      }

      setFeedback(`${messageParts.join('. ')}.`);
      setFeedbackTone(ambiguousResults.length > 0 || notFoundProcesses.length > 0 ? 'neutral' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleCopy = async () => {
    const html = editorContent;
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const clipboard = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([stripHtml(html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      toast.success('Minuta copiada com sucesso.');
    } catch {
      await navigator.clipboard.writeText(stripHtml(html));
      toast.success('Minuta copiada em texto simples.');
    }
  };

  const handleCopyDispatch = async (dispatch: GeneratedDispatch) => {
    try {
      const blob = new Blob([dispatch.html], { type: 'text/html' });
      const clipboard = new ClipboardItem({
        'text/html': blob,
        'text/plain': new Blob([stripHtml(dispatch.html)], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      setCopiedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
      toast.success(`Despacho ${dispatch.processo || dispatch.title} copiado.`);
    } catch {
      await navigator.clipboard.writeText(stripHtml(dispatch.html));
      setCopiedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
      toast.success(`Despacho ${dispatch.processo || dispatch.title} copiado em texto simples.`);
    }
  };

  const handleCloneDispatch = (dispatch: GeneratedDispatch) => {
    setClonedDispatchIds((current) => (current.includes(dispatch.id) ? current : [...current, dispatch.id]));
    window.open(cloneDocumentUrl, '_blank', 'noopener,noreferrer');
    toast.success(`Clonagem aberta para ${dispatch.processo || dispatch.title}.`);
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] w-[calc(100%+2rem)] bg-surface-page lg:-m-8 lg:w-[calc(100%+4rem)]">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-5 px-4 py-5 lg:px-8 lg:py-6">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
            <CardContent className="p-4">
              <ModelSubmenu
                title={activeDocument.name}
                subtitle="Gera a minuta a partir do numero do processo"
                onClick={() => setProcessInput('')}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {exampleProcesses.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                        Processos sincronizados
                      </p>
                    </div>
                    <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {exampleProcesses.map((example) => (
                        <ExampleCard
                          key={example.id}
                          processo={example.processo}
                          beneficiario={example.beneficiario}
                          onClick={() => handleAppendProcess(example.processo)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 rounded-radius-xl border border-border-default/70 bg-surface-subtle/40 p-3">
                  <Textarea
                    value={processInput}
                    onChange={(event) => setProcessInput(event.target.value)}
                    placeholder="Cole um ou mais numeros de processo, um por linha."
                    className="min-h-[116px] resize-none rounded-radius-lg border-border-default bg-surface-card font-mono text-sm text-text-primary shadow-xs placeholder:font-ui placeholder:text-text-muted"
                  />

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 font-ui text-xs text-text-secondary">
                      <Badge variant="outline" className="border-border-default bg-surface-card text-text-secondary">
                        {detectedProcesses.length} processo{detectedProcesses.length !== 1 ? 's' : ''}
                      </Badge>
                      <span></span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="h-10 gap-2"
                        onClick={() => void handleBatchResolve()}
                        disabled={screenState === 'resolving'}
                      >
                        {screenState === 'resolving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Gerar minuta
                      </Button>
                    </div>
                  </div>
                </div>

                {feedback ? (
                  <div className={`rounded-radius-xl border px-4 py-3 font-ui text-sm ${feedbackClasses[feedbackTone]}`}>{feedback}</div>
                ) : null}

                {screenState === 'ambiguous' && pendingCandidates.length > 0 ? (
                  <div className="space-y-3 rounded-radius-xl border border-border-default/70 bg-surface-subtle/40 p-3">
                    <div className="grid gap-3 lg:grid-cols-2">
                      {pendingCandidates.map((candidate) => (
                        <CandidateCard key={candidate.candidateId} candidate={candidate} onSelect={openContext} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
          <CardContent className="p-0">
            <RichTextEditor
              content={editorContent}
              onChange={setEditorContent}
              placeholder="A minuta sera montada aqui..."
              toolbarLeft={
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-radius-md bg-primary/10 text-primary">
                    <Wand2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-ui text-xs font-semibold text-text-primary">{selectedTitle}</span>
                </div>
              }
              toolbarRight={
                <div className="hidden items-center gap-2 sm:flex">
                  <Badge variant="outline" className="border-border-default bg-surface-subtle text-text-secondary">
                    Editor
                  </Badge>
                </div>
              }
            />
          </CardContent>
        </Card>

        {generatedDispatches.length > 1 ? (
          <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
            <CardContent className="bg-surface-subtle/40 px-4 py-3">
              <div className="mb-3 flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                <Copy className="h-3.5 w-3.5" />
                Copiar por despacho
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {generatedDispatches.map((dispatch, index) => {
                  const isCopied = copiedDispatchIds.includes(dispatch.id);
                  const isCloned = clonedDispatchIds.includes(dispatch.id);

                  return (
                    <div
                      key={dispatch.id}
                      className="rounded-radius-lg border border-border-default/70 bg-surface-card px-2.5 py-2 shadow-xs transition-all duration-200 hover:-translate-y-[1px] hover:border-primary/15 hover:shadow-soft"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] font-semibold text-text-primary">
                          {dispatch.processo || `Despacho ${index + 1}`}
                        </p>
                        <p className="mt-0.5 truncate font-ui text-[11px] text-text-secondary">
                          {dispatch.subtitle || dispatch.title}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-border-default/60 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={isCopied ? 'Despacho copiado' : 'Copiar despacho'}
                          className={[
                            'h-7 px-2 transition-all duration-200 hover:-translate-y-px active:scale-95',
                            isCopied
                              ? 'bg-status-success/12 text-status-success shadow-sm hover:bg-status-success/18 hover:text-status-success'
                              : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
                          ].join(' ')}
                          onClick={() => void handleCopyDispatch(dispatch)}
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={[
                            'h-7 bg-surface-card px-2.5 font-ui text-[11px] transition-all duration-200 hover:-translate-y-px active:scale-95',
                            isCloned
                              ? 'border-primary/30 bg-primary/[0.08] text-primary shadow-sm hover:bg-primary/[0.12]'
                              : 'border-border-default text-text-primary hover:border-primary/20 hover:bg-surface-subtle',
                          ].join(' ')}
                          onClick={() => handleCloneDispatch(dispatch)}
                        >
                          {isCloned ? 'Clonado' : 'Clonar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
