import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suapProcessosService } from '@/services/suapProcessos';
import { SuapLiquidacaoAnalise, SuapProcesso } from '@/types';

type ScreenshotItem = {
  file: File;
  previewUrl: string;
};

interface SuapConclusaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: SuapProcesso | null;
  userEmail?: string;
  onSuccess: (processoAtualizado: SuapProcesso) => void;
}

const MAX_FILES = 6;
const MAX_FILE_SIZE = 8 * 1024 * 1024;

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Não foi possível ler o arquivo ${file.name}.`));
    reader.readAsDataURL(file);
  });

export function SuapConclusaoDialog({
  open,
  onOpenChange,
  processo,
  userEmail,
  onSuccess,
}: SuapConclusaoDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotsRef = useRef<ScreenshotItem[]>([]);
  const [nsNumero, setNsNumero] = useState('');
  const [solicitarAnaliseLiquidacao, setSolicitarAnaliseLiquidacao] = useState(false);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !processo) return;

    const workflow = processo.dadosCompletos?.workflow;
    setNsNumero(workflow?.nsNumero || processo.dadosCompletos?.ns_numero || '');
    setSolicitarAnaliseLiquidacao(Boolean(workflow?.solicitarAnaliseLiquidacao));
    setScreenshots([]);
  }, [open, processo]);

  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  useEffect(() => {
    return () => {
      screenshotsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const processoLabel = useMemo(() => {
    if (!processo) return '';
    return processo.numProcesso || `Processo ${processo.suapId}`;
  }, [processo]);

  const resetScreenshots = () => {
    setScreenshots((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    if (!nextOpen) {
      resetScreenshots();
    }

    onOpenChange(nextOpen);
  };

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    const remainingSlots = MAX_FILES - screenshots.length;
    if (remainingSlots <= 0) {
      toast.error(`Você pode enviar no máximo ${MAX_FILES} prints por análise.`);
      return;
    }

    const validFiles = selectedFiles
      .filter((file) => {
        if (!file.type.startsWith('image/')) {
          toast.error(`O arquivo ${file.name} não é uma imagem válida.`);
          return false;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(`O arquivo ${file.name} ultrapassa 8 MB.`);
          return false;
        }

        return true;
      })
      .slice(0, remainingSlots)
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));

    if (validFiles.length < selectedFiles.length && remainingSlots < selectedFiles.length) {
      toast.info(`Só os primeiros ${remainingSlots} prints disponíveis foram adicionados.`);
    }

    setScreenshots((current) => [...current, ...validFiles]);
    event.target.value = '';
  };

  const removeScreenshot = (name: string) => {
    setScreenshots((current) => {
      const next = current.filter((item) => item.file.name !== name);
      const removed = current.find((item) => item.file.name === name);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!processo) return;

    const ns = nsNumero.trim();
    if (!ns) {
      toast.error('Informe o número da NS antes de concluir o processo.');
      return;
    }

    if (solicitarAnaliseLiquidacao && screenshots.length === 0) {
      toast.error('Adicione pelo menos um print do SIAFI para a análise da liquidação.');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading(
      solicitarAnaliseLiquidacao
        ? 'Conferindo os prints do SIAFI e concluindo o processo...'
        : 'Concluindo o processo...',
    );

    try {
      let analiseLiquidacao: SuapLiquidacaoAnalise | undefined;

      if (solicitarAnaliseLiquidacao) {
        const screenshotsPayload = await Promise.all(
          screenshots.map(async (item) => ({
            name: item.file.name,
            type: item.file.type,
            dataUrl: await fileToDataUrl(item.file),
          })),
        );

        analiseLiquidacao = await suapProcessosService.analisarLiquidacaoSiafi({
          processo,
          nsNumero: ns,
          screenshots: screenshotsPayload,
        });
      }

      const processoAtualizado = await suapProcessosService.concluirProcesso({
        processo,
        nsNumero: ns,
        solicitarAnaliseLiquidacao,
        analiseLiquidacao,
        arquivosSiafi: screenshots.map((item) => item.file.name),
        concluidoPor: userEmail,
      });

      onSuccess(processoAtualizado);
      toast.success('Processo concluído com sucesso.', { id: loadingToast });
      resetScreenshots();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível concluir o processo agora.',
        { id: loadingToast },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Concluir processo</DialogTitle>
          <DialogDescription>
            Finalize <strong>{processoLabel}</strong>, registre a NS e, se quiser, peça a conferência automática dos
            prints do SIAFI com base nos dados extraídos do processo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="suap-ns-numero">Número da NS</Label>
            <Input
              id="suap-ns-numero"
              value={nsNumero}
              onChange={(event) => setNsNumero(event.target.value)}
              placeholder="Ex.: 2026NS000123"
              disabled={isSubmitting}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="suap-analise-liquidacao"
                checked={solicitarAnaliseLiquidacao}
                disabled={isSubmitting}
                onCheckedChange={(checked) => setSolicitarAnaliseLiquidacao(checked === true)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor="suap-analise-liquidacao" className="text-sm font-semibold text-slate-900">
                  Desejo fazer a análise da liquidação
                </Label>
                <p className="text-sm text-slate-600">
                  A conferência automática compara os prints do SIAFI com beneficiário, contrato, nota fiscal, dados
                  bancários, retenções, empenhos, valor e NS do processo.
                </p>
              </div>
            </div>
          </div>

          {solicitarAnaliseLiquidacao ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Prints do SIAFI</p>
                  <p className="text-sm text-slate-500">
                    Envie telas relevantes da liquidação para a LLM identificar divergências de preenchimento.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleSelectFiles}
                />

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={isSubmitting || screenshots.length >= MAX_FILES}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Adicionar prints
                </Button>
              </div>

              {screenshots.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {screenshots.map((item) => (
                    <div key={item.file.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex items-start justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{item.file.name}</p>
                          <p className="text-xs text-slate-500">{formatFileSize(item.file.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-slate-500"
                          disabled={isSubmitting}
                          onClick={() => removeScreenshot(item.file.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                  <Image className="h-10 w-10 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">Nenhum print adicionado ainda</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Você pode enviar até {MAX_FILES} imagens, com até 8 MB cada.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              'Concluir processo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
