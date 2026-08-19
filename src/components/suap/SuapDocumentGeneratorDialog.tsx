import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, Loader2, RotateCcw, SkipForward, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import RichTextEditor from '@/components/Editor/RichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { buildDespachoLiquidacaoHtml, buildResolvedContextFromSuapProcess } from '@/lib/documentGeneration';
import { copySuapDocumentToClipboard } from '@/lib/suapClipboard';
import { buildSuapCloneUrl, type SuapCloneAutomationMode } from '@/lib/suapCloneAutomation';
import {
  buildManualDespachoHtml,
  createManualDespachoFields,
  createManualDespachoFieldsFromResolvedContext,
  isAiAssistedDispatch,
  createStandaloneManualDespachoFields,
  type DispatchQueueState,
  type ManualDespachoFields,
} from '@/lib/suapDispatchGeneration';
import type { SuapProcesso } from '@/types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processos: SuapProcesso[];
  queue: DispatchQueueState | null;
  onQueueChange: (queue: DispatchQueueState | null) => void;
};

const updateCurrentItem = (
  queue: DispatchQueueState,
  patch: Partial<DispatchQueueState['items'][number]>,
): DispatchQueueState => ({
  ...queue,
  items: queue.items.map((item, index) => index === queue.currentIndex ? { ...item, ...patch } : item),
});

export function SuapDocumentGeneratorDialog({ open, onOpenChange, processos, queue, onQueueChange }: Props) {
  const { empenhos, contratos, contratosEmpenhos } = useData();
  const [isResolving, setIsResolving] = useState(false);
  const resolvingProcessId = useRef<string | null>(null);

  const currentItem = queue?.items[queue.currentIndex] || null;
  const processo = useMemo(() => currentItem?.standalone ? null : processos.find((item) => item.id === currentItem?.processId) || null, [currentItem?.processId, currentItem?.standalone, processos]);
  const latestOpenRef = useRef(open);
  const currentProcessIdRef = useRef<string | null>(currentItem?.processId || null);
  latestOpenRef.current = open;
  currentProcessIdRef.current = currentItem?.processId || null;
  const isAssisted = Boolean(processo && isAiAssistedDispatch(processo));
  const manualFields = currentItem?.manualFields || (processo ? createManualDespachoFields(processo) : currentItem?.standalone ? createStandaloneManualDespachoFields() : null);
  const isLast = Boolean(queue && queue.currentIndex === queue.items.length - 1);
  const isFirst = !queue || queue.currentIndex === 0;
  const pendingCount = queue?.items.filter((item) => item.status === 'pending').length || 0;

  useEffect(() => {
    if (!open || !queue || !currentItem || !processo || !isAssisted || currentItem.html || currentItem.error || resolvingProcessId.current === processo.id) {
      return;
    }

    resolvingProcessId.current = processo.id;
    setIsResolving(true);
    void buildResolvedContextFromSuapProcess(processo, { empenhos, contratos, contratosEmpenhos })
      .then((context) => {
        if (!latestOpenRef.current || currentProcessIdRef.current !== processo.id) return;
        onQueueChange(updateCurrentItem(queue, {
          html: buildDespachoLiquidacaoHtml(context),
          manualFields: currentItem.manualFields || createManualDespachoFieldsFromResolvedContext(context),
        }));
      })
      .catch((error) => {
        if (!latestOpenRef.current || currentProcessIdRef.current !== processo.id) return;
        onQueueChange(updateCurrentItem(queue, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Nao foi possivel montar o contexto do processo.',
        }));
      })
      .finally(() => {
        if (resolvingProcessId.current === processo.id) {
          resolvingProcessId.current = null;
          setIsResolving(false);
        }
      });
  }, [contratos, contratosEmpenhos, currentItem, empenhos, isAssisted, onQueueChange, open, processo, queue]);

  useEffect(() => {
    if (!open || !queue || !currentItem || (!processo && !currentItem.standalone) || isAssisted || currentItem.manualFields) return;
    onQueueChange(updateCurrentItem(queue, { manualFields: processo ? createManualDespachoFields(processo) : createStandaloneManualDespachoFields() }));
  }, [currentItem, isAssisted, onQueueChange, open, processo, queue]);

  const move = (direction: -1 | 1) => {
    if (!queue) return;
    onQueueChange({
      ...queue,
      currentIndex: Math.max(0, Math.min(queue.items.length - 1, queue.currentIndex + direction)),
    });
  };

  const changeManualField = <K extends keyof ManualDespachoFields>(key: K, value: ManualDespachoFields[K]) => {
    if (!queue || !manualFields) return;
    onQueueChange(updateCurrentItem(queue, { manualFields: { ...manualFields, [key]: value } }));
  };

  const generateManual = () => {
    if (!queue || !manualFields) return;
    onQueueChange(updateCurrentItem(queue, { html: buildManualDespachoHtml(manualFields), status: 'pending', error: undefined }));
  };

  const updateHtml = (html: string) => {
    if (!queue) return;
    onQueueChange(updateCurrentItem(queue, { html }));
  };

  const copyCurrent = async () => {
    if (!queue || !currentItem?.html) return;
    try {
      const result = await copySuapDocumentToClipboard(currentItem.html);
      onQueueChange(updateCurrentItem(queue, { status: 'copied' }));
      toast.success(result === 'html' ? 'Despacho copiado.' : 'Despacho copiado em texto simples.');
    } catch {
      toast.error('Nao foi possivel copiar o despacho.');
    }
  };

  const cloneCurrent = () => {
    if (!queue || !currentItem?.html) return;
    const url = buildSuapCloneUrl({ documentType: 'despacho', html: currentItem.html, mode: 'review' });
    window.open(url, '_blank', 'noopener,noreferrer');
    onQueueChange(updateCurrentItem(queue, { status: 'cloned' }));
    toast.success('Clone aberto para revisao no SUAP.');
  };

  const skipCurrent = () => {
    if (!queue) return;
    const nextQueue = updateCurrentItem(queue, { status: 'skipped' });
    onQueueChange(isLast ? nextQueue : { ...nextQueue, currentIndex: nextQueue.currentIndex + 1 });
  };

  const retryCurrent = () => {
    if (!queue) return;
    onQueueChange(updateCurrentItem(queue, { status: 'pending', error: undefined }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || pendingCount === 0 || window.confirm('Ha documentos pendentes nesta fila. Deseja descartar o trabalho?')) {
      onOpenChange(nextOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="grid h-[min(92vh,900px)] w-[min(96vw,1160px)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-surface-card p-0">
        <DialogHeader className="border-b border-border-default/70 px-5 py-4 pr-12">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 font-ui text-lg text-text-primary">
                <FileText className="h-5 w-5 text-emerald-600" />
                Despacho de Liquidacao
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {queue ? `${queue.currentIndex + 1} de ${queue.items.length} documento(s)` : 'Preparando fila'}
              </DialogDescription>
            </div>
            {processo ? (
              <div className="text-right">
                <p className="font-mono text-xs font-semibold text-text-primary">{processo.numProcesso || `SUAP ${processo.suapId}`}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {isAssisted ? 'Dados extraidos por IA' : 'Preenchimento manual'}
                </Badge>
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {!queue || !currentItem ? null : !processo && !currentItem.standalone ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
              <TriangleAlert className="h-8 w-8 text-amber-600" />
              <p className="text-sm text-text-secondary">Este processo nao esta mais disponivel no espelho SUAP.</p>
            </div>
          ) : isResolving ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Montando despacho com os dados extraidos...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
              <section className="space-y-4 rounded-lg border border-border-default/70 bg-surface-subtle/30 p-4">
                {currentItem.error ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <p>{currentItem.error}</p>
                    {isAssisted ? <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 px-2 text-rose-800" onClick={retryCurrent}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Tentar novamente</Button> : null}
                  </div>
                ) : null}
                {isAssisted ? (
                  <div className="space-y-4">
                    <div className="space-y-2 text-xs text-text-secondary">
                      <p className="font-semibold text-text-primary">Minuta assistida</p>
                      <p>A IA ja preencheu os dados encontrados. Marcadores no texto indicam campos pendentes.</p>
                    </div>
                    {manualFields ? (
                      <ManualDespachoForm
                        fields={manualFields}
                        onChange={changeManualField}
                        onGenerate={generateManual}
                        title="Modelo da minuta"
                        description="Troque o modelo quando a IA classificar o caso errado e aplique para regerar o texto."
                        submitLabel="Aplicar modelo"
                      />
                    ) : null}
                  </div>
                ) : manualFields ? (
                  <ManualDespachoForm fields={manualFields} onChange={changeManualField} onGenerate={generateManual} />
                ) : null}
              </section>

              <section aria-label="Previa editavel do despacho" className="min-w-0 overflow-hidden border border-border-default/70 bg-white shadow-sm">
                {currentItem.html ? (
                  <RichTextEditor
                    content={currentItem.html}
                    onChange={updateHtml}
                    highlightPendingFields
                    highlightBracketPlaceholders
                    placeholder="Edite o despacho..."
                    contentClassName="font-serif text-[20px] leading-[1.65] text-black [&_.tiptap]:font-serif [&_.tiptap]:text-[20px] [&_.tiptap]:leading-[1.65] [&_.tiptap]:text-justify [&_.tiptap_p]:!my-0 [&_.tiptap_p]:!text-[20px] [&_.tiptap_p]:!leading-[1.65] [&_.tiptap_p]:!text-black [&_.tiptap_strong]:!text-black [&_.tiptap_em]:!text-black [&_.tiptap>p:nth-child(2)]:!mt-8 [&_.tiptap>p:nth-child(2)]:font-bold [&_.tiptap>p:nth-child(3)]:!mt-8 [&_.tiptap>p:nth-child(3)]:!mb-6 [&_.tiptap>p:nth-child(3)]:indent-[2.5cm] [&_.tiptap>p:last-child]:!mt-10"
                  />
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center text-sm text-text-muted">
                    Preencha os campos e gere a previa do despacho.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t border-border-default/70 px-5 py-3 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isFirst || isResolving} onClick={() => move(-1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!queue || isLast || isResolving} onClick={() => move(1)}>
              Proximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!queue || isResolving} onClick={skipCurrent}>
              <SkipForward className="mr-1 h-4 w-4" /> Pular
            </Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!currentItem?.html} onClick={() => void copyCurrent()}>
              {currentItem?.status === 'copied' ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              Copiar
            </Button>
            <Button type="button" size="sm" disabled={!currentItem?.html} onClick={cloneCurrent}>
              <ExternalLink className="mr-1 h-4 w-4" /> Clonar no SUAP
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualDespachoForm({
  fields,
  onChange,
  onGenerate,
  title = 'Preenchimento manual',
  description,
  submitLabel = 'Gerar despacho',
}: {
  fields: ManualDespachoFields;
  onChange: <K extends keyof ManualDespachoFields>(key: K, value: ManualDespachoFields[K]) => void;
  onGenerate: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const noFavorecido = ['auxilio-transporte', 'pafe', 'auxilio-moradia'].includes(fields.finalidade);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-semibold text-text-primary"><Sparkles className="h-4 w-4 text-amber-600" /> {title}</p>
        {description ? <p className="text-xs leading-5 text-text-secondary">{description}</p> : null}
      </div>
      <div className="space-y-1"><Label>Finalidade</Label><Select value={fields.finalidade} onValueChange={(value) => onChange('finalidade', value as ManualDespachoFields['finalidade'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contrato">Contrato ou aquisicao</SelectItem><SelectItem value="projeto">Projeto</SelectItem><SelectItem value="bolsa-sem-projeto">Bolsa sem projeto</SelectItem><SelectItem value="auxilio-transporte">Auxilio transporte</SelectItem><SelectItem value="pafe">PAFE</SelectItem><SelectItem value="auxilio-moradia">Auxilio moradia</SelectItem></SelectContent></Select></div>
      <div className="space-y-1"><Label>Processo (opcional)</Label><Input value={fields.processo} onChange={(event) => onChange('processo', event.target.value)} /></div>
      {!noFavorecido ? <div className="space-y-1"><Label>Favorecido</Label><Input value={fields.favorecido} onChange={(event) => onChange('favorecido', event.target.value)} /></div> : null}
      {fields.finalidade === 'contrato' ? <><div className="space-y-1"><Label>Tipo</Label><Select value={fields.tipo} onValueChange={(value) => onChange('tipo', value as ManualDespachoFields['tipo'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="servico">Servico</SelectItem><SelectItem value="aquisicao">Aquisicao</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Descricao</Label><Textarea value={fields.descricao} onChange={(event) => onChange('descricao', event.target.value)} /></div></> : null}
      {fields.finalidade === 'projeto' ? <><div className="space-y-1"><Label>Projeto</Label><Input value={fields.projeto} onChange={(event) => onChange('projeto', event.target.value)} /></div><div className="space-y-1"><Label>Edital</Label><Input value={fields.edital} onChange={(event) => onChange('edital', event.target.value)} /></div></> : null}
      <div className="space-y-1"><Label>Valor (R$)</Label><Input value={fields.valor} onChange={(event) => onChange('valor', event.target.value)} /></div>
      <div className="space-y-1"><Label>Empenho(s)</Label><Input value={fields.empenho} onChange={(event) => onChange('empenho', event.target.value)} /></div>
      <Button type="button" className="w-full" onClick={onGenerate}>{submitLabel}</Button>
    </div>
  );
}
