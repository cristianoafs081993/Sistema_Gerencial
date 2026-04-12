import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Landmark,
  Loader2,
  PanelRightOpen,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import RichTextEditor from '@/components/Editor/RichTextEditor';
import { HeaderActions } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import {
  buildDespachoLiquidacaoHtml,
  buildResolvedContextFromSuapProcess,
  documentDefinitions,
  extractProcessNumbers,
  resolveDocumentIntent,
  type DocumentIntent,
  type ResolvedDocumentContext,
} from '@/lib/documentGeneration';
import { suapExtensionGithubUrl } from '@/lib/suapExtension';
import { cn, formatarDocumento } from '@/lib/utils';
import { suapProcessosService } from '@/services/suapProcessos';
import type { SuapProcesso } from '@/types';

type ScreenState = 'idle' | 'resolving' | 'ambiguous' | 'not_found';
type FeedbackTone = 'neutral' | 'warning' | 'success';

type ExampleProcessCard = {
  id: string;
  processo: string;
  beneficiario?: string;
  processoCompleto: SuapProcesso;
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

const isCopyableValue = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '-' && normalized !== 'null' && normalized !== 'undefined';
};

const copyValue = async (value: string | undefined | null, message: string) => {
  if (!isCopyableValue(value)) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value!);
    toast.success(message);
  } catch {
    toast.error('Nao foi possivel copiar este valor.');
  }
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

function CopyValueButton({
  value,
  message,
  className,
}: {
  value?: string | null;
  message: string;
  className?: string;
}) {
  const canCopy = isCopyableValue(value);

  return (
    <button
      type="button"
      disabled={!canCopy}
      title={message}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-radius-md border border-border-default/70 bg-surface-card text-text-secondary shadow-xs transition',
        'hover:border-border-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      onClick={() => {
        void copyValue(value, message);
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function SidebarSection({
  icon,
  title,
  children,
  contentClassName,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="h-0.5 w-full bg-slate-200" />
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 font-ui text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </span>
        {title}
      </div>
        <div className={cn('space-y-2', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}

function SidebarField({
  label,
  value,
  copyValue: valueToCopy,
  copyMessage,
  mono = false,
}: {
  label: string;
  value: string;
  copyValue?: string | null;
  copyMessage: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <div className="min-w-0">
        <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className={cn('mt-0.5 break-words font-ui text-[13px] text-slate-900', mono && 'font-mono text-[12px] font-semibold')}>
          {value}
        </p>
      </div>
      <CopyValueButton value={valueToCopy} message={copyMessage} className="h-7 w-7 shrink-0 border-slate-200 bg-white shadow-none" />
    </div>
  );
}

function ExampleProcessRow({
  processo,
  beneficiario,
  onPreview,
  onAppend,
  isSelected,
  appendDisabled = false,
  appendTitle = 'Adicionar ao lote',
}: {
  processo: string;
  beneficiario?: string;
  onPreview: () => void;
  onAppend: () => void;
  isSelected: boolean;
  appendDisabled?: boolean;
  appendTitle?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-radius-lg border bg-surface-card p-1.5 shadow-xs transition-all duration-200',
        isSelected
          ? 'border-primary/30 bg-primary/[0.05] shadow-soft'
          : 'border-border-default/70 hover:-translate-y-[1px] hover:border-primary/20 hover:bg-surface-subtle/40 hover:shadow-soft',
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 rounded-radius-md px-2 py-1 text-left"
      >
        <span className="block truncate font-mono text-[11px] font-semibold text-text-primary">{processo}</span>
        <span className="mt-0.5 line-clamp-1 block font-ui text-[10px] leading-snug text-text-secondary">
          {beneficiario || 'Sincronizado no SUAP'}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/80">
          <PanelRightOpen className="h-3 w-3" />
          Ver detalhes
        </span>
      </button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-9 shrink-0 rounded-radius-md border-border-default bg-surface-card p-0 text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onAppend}
        aria-label={appendTitle}
        title={appendTitle}
        disabled={appendDisabled}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
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
  const editorCardRef = useRef<HTMLDivElement | null>(null);
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
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);

  const resources = useMemo(
    () => ({ empenhos, contratos, contratosEmpenhos }),
    [empenhos, contratos, contratosEmpenhos],
  );

  const activeDocument = documentDefinitions[0];

  const {
    data: syncedProcesses = [],
    isLoading: isLoadingSyncedProcesses,
    isError: isSyncedProcessesError,
  } = useQuery({
    queryKey: ['suap-processos', 'editor-exemplos'],
    queryFn: suapProcessosService.getAll,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const exampleProcesses = useMemo<ExampleProcessCard[]>(
    () =>
      [...syncedProcesses]
        .filter((processo) => processo.numProcesso || processo.suapId)
        .sort((left, right) => {
          const leftHasProcessNumber = Boolean(left.numProcesso?.trim());
          const rightHasProcessNumber = Boolean(right.numProcesso?.trim());

          if (leftHasProcessNumber !== rightHasProcessNumber) {
            return Number(rightHasProcessNumber) - Number(leftHasProcessNumber);
          }

          return (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0);
        })
        .map((processo) => ({
          id: processo.id,
          processo: processo.numProcesso?.trim() || `SUAP ${processo.suapId}`,
          beneficiario: processo.beneficiario || processo.assunto,
          processoCompleto: processo,
        })),
    [syncedProcesses],
  );

  const detectedProcesses = useMemo(() => extractProcessNumbers(processInput), [processInput]);
  const selectedProcess = useMemo(
    () => exampleProcesses.find((processo) => processo.id === selectedProcessId)?.processoCompleto || null,
    [exampleProcesses, selectedProcessId],
  );
  const visibleRetencoes = useMemo(
    () =>
      selectedProcess
        ? ([
            ['ISS', selectedProcess.dadosCompletos?.retencoes_tributarias?.iss],
            ['INSS', selectedProcess.dadosCompletos?.retencoes_tributarias?.inss],
            ['IR', selectedProcess.dadosCompletos?.retencoes_tributarias?.ir],
            ['CSLL', selectedProcess.dadosCompletos?.retencoes_tributarias?.csll],
            ['COFINS', selectedProcess.dadosCompletos?.retencoes_tributarias?.cofins],
            ['PIS/PASEP', selectedProcess.dadosCompletos?.retencoes_tributarias?.pis_pasep],
          ] as Array<[string, string | undefined]>).filter(([, value]) => isCopyableValue(value))
        : [],
    [selectedProcess],
  );

  const focusEditor = () => {
    window.setTimeout(() => {
      editorCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const editable = editorCardRef.current?.querySelector('[contenteditable="true"]') as HTMLElement | null;
      editable?.focus();
    }, 0);
  };

  const openContext = (
    context: ResolvedDocumentContext,
    options?: {
      feedbackMessage?: string;
      feedbackTone?: FeedbackTone;
    },
  ) => {
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
    setFeedback(options?.feedbackMessage || '');
    setFeedbackTone(options?.feedbackTone || 'neutral');
    setScreenState('idle');
    focusEditor();
  };

  const handleAppendProcess = (processo: SuapProcesso) => {
    const processValue = processo.numProcesso?.trim();

    if (!processValue) {
      setSelectedProcessId(processo.id);
      toast.info('Este processo ainda nao possui numero sincronizado para entrar no lote. Gere a minuta individualmente pelos detalhes.');
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
          openContext(result.context, {
            feedbackMessage: '1 minuta gerada.',
            feedbackTone: 'success',
          });
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
      focusEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleGenerateProcess = async (processo: SuapProcesso) => {
    const processValue = processo.numProcesso?.trim() || processo.suapId.trim();

    if (!processValue) {
      return;
    }

    if (processo.numProcesso?.trim()) {
      setProcessInput(processo.numProcesso.trim());
    }
    setPendingCandidates([]);
    setFeedback('');
    setScreenState('resolving');

    try {
      const context = await buildResolvedContextFromSuapProcess(processo, resources);
      openContext(context, {
        feedbackMessage: '1 minuta gerada.',
        feedbackTone: 'success',
      });
      setSelectedProcessId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao gerar a minuta.';
      setFeedback(message);
      setFeedbackTone('warning');
      setScreenState('not_found');
      toast.error(message);
    }
  };

  const handleOpenPdf = async (processo: SuapProcesso) => {
    if (!processo.pdfUrl) {
      toast.info('Este processo ainda nao possui PDF sincronizado.');
      return;
    }

    setOpeningPdfId(processo.id);
    try {
      const signedUrl = await suapProcessosService.getPdfSignedUrl(processo.pdfUrl);
      if (!signedUrl) {
        toast.error('Nao foi possivel gerar o link do PDF.');
        return;
      }

      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      toast.error('Falha ao abrir o PDF sincronizado.');
    } finally {
      setOpeningPdfId(null);
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
      <HeaderActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-space-9 gap-space-2 border-border-default bg-white text-slate-700 shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
          onClick={() => window.open(suapExtensionGithubUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" />
          Baixar extensão
        </Button>
      </HeaderActions>

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

                      <div className="rounded-radius-xl border border-border-default/70 bg-surface-subtle/35 p-2">
                        <div>
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                          {exampleProcesses.map((example) => (
                            <ExampleProcessRow
                              key={example.id}
                              processo={example.processo}
                              beneficiario={example.beneficiario}
                              isSelected={selectedProcessId === example.id}
                              onPreview={() => setSelectedProcessId(example.id)}
                              onAppend={() => handleAppendProcess(example.processoCompleto)}
                              appendDisabled={!example.processoCompleto.numProcesso?.trim()}
                              appendTitle={
                                example.processoCompleto.numProcesso?.trim()
                                  ? 'Adicionar ao lote'
                                  : 'Numero de processo indisponivel para lote'
                              }
                            />
                          ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isLoadingSyncedProcesses ? (
                    <div className="rounded-radius-xl border border-border-default/70 bg-surface-subtle/35 px-4 py-3">
                      <p className="font-ui text-sm text-text-secondary">Carregando processos sincronizados...</p>
                    </div>
                  ) : null}

                  {!isLoadingSyncedProcesses && !isSyncedProcessesError && exampleProcesses.length === 0 ? (
                    <div className="rounded-radius-xl border border-dashed border-border-default/70 bg-surface-subtle/35 px-4 py-3">
                      <p className="font-ui text-sm text-text-secondary">
                        Nenhum processo sincronizado disponivel para atalho no modo publico. Use o botao Baixar extensão no cabecalho ou continue colando os numeros de processo manualmente.
                      </p>
                    </div>
                  ) : null}

                  {isSyncedProcessesError ? (
                    <div className="rounded-radius-xl border border-warning/20 bg-warning/10 px-4 py-3">
                      <p className="font-ui text-sm text-amber-900">
                        Nao foi possivel carregar a lista publica de processos sincronizados agora. A geracao manual continua disponivel.
                      </p>
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
                          <CandidateCard
                            key={candidate.candidateId}
                            candidate={candidate}
                            onSelect={(selectedCandidate) =>
                              openContext(selectedCandidate, {
                                feedbackMessage: '1 minuta gerada.',
                                feedbackTone: 'success',
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

        <Card ref={editorCardRef} className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
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

        {generatedDispatches.length > 0 ? (
          <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
            <CardContent className="bg-surface-subtle/40 px-4 py-3">
              <div className="mb-3 flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                <Copy className="h-3.5 w-3.5" />
                {generatedDispatches.length > 1 ? 'Copiar por despacho' : 'Acoes da minuta'}
              </div>
              <div className={cn('grid gap-2', generatedDispatches.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : 'max-w-md')}>
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
                          {isCloned ? 'Clonado' : 'Clonar no SUAP'}
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

      <Dialog open={Boolean(selectedProcess)} onOpenChange={(open) => !open && setSelectedProcessId(null)}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[min(95vw,1140px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-none bg-white p-0 text-slate-900 shadow-2xl">
          {selectedProcess ? (
            <>
              <DialogHeader className="relative space-y-1 border-b border-slate-100 bg-slate-50/80 p-4">
                <div className="absolute left-0 top-0 h-1 w-full bg-cyan-500" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-600">
                      <PanelRightOpen className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DialogTitle className="font-ui text-[24px] font-black tracking-tight text-slate-900">
                          {selectedProcess.numProcesso || selectedProcess.suapId}
                        </DialogTitle>
                        <CopyValueButton
                          value={selectedProcess.numProcesso || selectedProcess.suapId}
                          message="Numero do processo copiado."
                          className="h-7 w-7 border-slate-200 bg-white shadow-none"
                        />
                      </div>
                      <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600/70">
                        Processo Sincronizado
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[24px] font-black tracking-tight text-slate-900">
                        {selectedProcess.suapId}
                      </span>
                      <CopyValueButton
                        value={selectedProcess.suapId}
                        message="SUAP ID copiado."
                        className="h-7 w-7 border-slate-200 bg-white shadow-none"
                      />
                    </div>
                    <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                      SUAP ID
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto bg-white p-4">
                <div className="space-y-3">
                <SidebarSection
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  title="Beneficiario e assunto"
                  contentClassName="space-y-3"
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    <SidebarField label="Nome" value={selectedProcess.beneficiario || 'Nao extraido'} copyValue={selectedProcess.beneficiario} copyMessage="Beneficiario copiado." />
                    <SidebarField
                      label="Documento"
                      value={selectedProcess.cpfCnpj ? formatarDocumento(selectedProcess.cpfCnpj) : 'Sem documento'}
                      copyValue={selectedProcess.cpfCnpj}
                      copyMessage="Documento copiado."
                      mono
                    />
                  </div>

                  <div className="space-y-2">
                    <SidebarField
                      label="Descricao"
                      value={selectedProcess.assunto || 'Sem assunto extraido'}
                      copyValue={selectedProcess.assunto}
                      copyMessage="Assunto copiado."
                    />
                  </div>
                </SidebarSection>

                <SidebarSection
                  icon={<Landmark className="h-3.5 w-3.5" />}
                  title="Contrato, nota fiscal, bancos, retencoes e empenhos"
                  contentClassName="space-y-3"
                >
                    <div className="space-y-2.5">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <SidebarField
                          label="Contrato"
                          value={selectedProcess.contrato || selectedProcess.dadosCompletos?.contrato_numero || '-'}
                          copyValue={selectedProcess.contrato || selectedProcess.dadosCompletos?.contrato_numero}
                          copyMessage="Contrato copiado."
                        />
                        <SidebarField
                          label="Nota fiscal"
                          value={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.numero || '-'}
                          copyValue={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.numero}
                          copyMessage="Numero da nota fiscal copiado."
                          mono
                        />
                        <SidebarField
                          label="Emissao"
                          value={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.data_emissao || 'Sem data de emissao'}
                          copyValue={selectedProcess.dadosCompletos?.notas_fiscais?.[0]?.data_emissao}
                          copyMessage="Data de emissao copiada."
                        />
                        <SidebarField
                          label="Valor"
                          value={selectedProcess.dadosCompletos?.val_nf || '-'}
                          copyValue={selectedProcess.dadosCompletos?.val_nf}
                          copyMessage="Valor copiado."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                          Dados bancarios
                        </p>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                          <div className="grid gap-2 md:grid-cols-3">
                            <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Banco</p>
                                <p className="mt-0.5 break-words font-ui text-[13px] text-slate-900">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.banco || 'Sem banco extraido'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.banco}
                                message="Banco copiado."
                                className="h-7 w-7 shrink-0 border-slate-200 bg-white shadow-none"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Agencia</p>
                                <p className="mt-0.5 break-words font-mono text-[12px] font-semibold text-slate-900">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.agencia || '-'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.agencia}
                                message="Agencia copiada."
                                className="h-7 w-7 shrink-0 border-slate-200 bg-white shadow-none"
                              />
                            </div>

                            <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <p className="font-ui text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Conta</p>
                                <p className="mt-0.5 break-words font-mono text-[12px] font-semibold text-slate-900">
                                  {selectedProcess.dadosCompletos?.dados_bancarios?.conta || '-'}
                                </p>
                              </div>
                              <CopyValueButton
                                value={selectedProcess.dadosCompletos?.dados_bancarios?.conta}
                                message="Conta copiada."
                                className="h-7 w-7 shrink-0 border-slate-200 bg-white shadow-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {(selectedProcess.dadosCompletos?.empenhos || []).length > 0 ? (
                        <div className="min-w-0 xl:w-[38%] xl:max-w-[420px] space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                              Empenhos
                            </p>
                            <CopyValueButton value={(selectedProcess.dadosCompletos?.empenhos || []).join(', ')} message="Lista de empenhos copiada." className="h-7 w-7" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
                            {(selectedProcess.dadosCompletos?.empenhos || []).map((empenho) => (
                              <div
                                key={empenho}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1"
                              >
                                <span className="font-mono text-[12px] font-semibold text-text-primary">{empenho}</span>
                                <CopyValueButton value={empenho} message="Empenho copiado." className="h-6 w-6 border-0 bg-transparent shadow-none" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {(selectedProcess.dadosCompletos?.retencoes_tributarias?.optante_simples_nacional ||
                      visibleRetencoes.length > 0) ? (
                      <>
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-ui text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                              Retencoes
                            </p>
                            {selectedProcess.dadosCompletos?.retencoes_tributarias?.optante_simples_nacional ? (
                              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-amber-900">
                                Optante pelo Simples Nacional
                              </Badge>
                            ) : null}
                          </div>

                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {visibleRetencoes.map(([label, value]) => (
                              <SidebarField key={label} label={label} value={value || '-'} copyValue={value} copyMessage={`${label} copiado.`} />
                            ))}
                          </div>
                        </div>

                      </>
                    ) : (
                      <p className="font-ui text-sm text-slate-500">Nenhuma retencao extraida para este processo.</p>
                    )}
                  </SidebarSection>
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 border-slate-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm shadow-slate-200/50 hover:bg-slate-100"
                  onClick={() => window.open(selectedProcess.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir no SUAP
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 border-slate-200 bg-white px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm shadow-slate-200/50 hover:bg-slate-100"
                  onClick={() => void handleOpenPdf(selectedProcess)}
                  disabled={!selectedProcess.pdfUrl || openingPdfId === selectedProcess.id}
                >
                  {openingPdfId === selectedProcess.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Abrir PDF
                </Button>
                <Button
                  type="button"
                  className="h-9 gap-2 px-3.5 text-[10px] font-bold uppercase tracking-[0.16em]"
                  onClick={() => void handleGenerateProcess(selectedProcess)}
                  disabled={!selectedProcess.numProcesso}
                >
                  <FileText className="h-4 w-4" />
                  Gerar Documento
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedProcessId(null)}
                  className="border border-slate-200 bg-white px-6 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 shadow-sm shadow-slate-200/50 hover:bg-slate-100"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
