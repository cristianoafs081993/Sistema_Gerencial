import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileDown,
  FilePenLine,
  Landmark,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  FileText,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { SuapConclusaoDialog } from '@/components/modals/SuapConclusaoDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { suapExtensionGithubUrl } from '@/lib/suapExtension';
import { getNotasFiscais, hasNotaFiscalNumero } from '@/lib/suapNotaFiscal';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { SuapProcesso } from '@/types';
import { suapProcessosService } from '@/services/suapProcessos';
import { suapScraperService } from '@/services/suapScraperService';
import { SuapDocumentGeneratorDialog } from '@/components/suap/SuapDocumentGeneratorDialog';
import {
  clearDispatchQueue,
  createDispatchQueue,
  loadDispatchQueue,
  createStandaloneDispatchQueue,
  saveDispatchQueue,
  type DispatchQueueState,
} from '@/lib/suapDispatchGeneration';

type StatusFilter = 'active' | 'concluded';
type ProcessAction = 'download' | 'ai' | 'full';


const isErrorStatus = (status: string) =>
  status.includes('error') || status.includes('fail');

const getProcessWorkflow = (processo: SuapProcesso) => processo.dadosCompletos?.workflow;

const isProcessConcluded = (processo: SuapProcesso) =>
  Boolean(getProcessWorkflow(processo)?.concluido);

const isCopyableValue = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '-' && normalized !== 'null' && normalized !== 'undefined';
};

const getNsNumero = (processo: SuapProcesso) =>
  getProcessWorkflow(processo)?.nsNumero || processo.dadosCompletos?.ns_numero || '-';

const getProcessCompleteness = (processo: SuapProcesso) => {
  const notasFiscais = getNotasFiscais(processo.dadosCompletos);
  const dadosBancarios = processo.dadosCompletos?.dados_bancarios;
  const retencoes = processo.dadosCompletos?.retencoes_tributarias;
  const listaEmpenhos = processo.dadosCompletos?.empenhos || [];

  const requiredFlags = [
    isCopyableValue(processo.beneficiario),
    isCopyableValue(processo.cpfCnpj),
    isCopyableValue(processo.assunto),
    isCopyableValue(processo.contrato || processo.dadosCompletos?.contrato_numero),
    isCopyableValue(processo.dadosCompletos?.val_nf),
    isCopyableValue(getNsNumero(processo)),
    hasNotaFiscalNumero(notasFiscais),
    isCopyableValue(dadosBancarios?.banco) &&
      isCopyableValue(dadosBancarios?.agencia) &&
      isCopyableValue(dadosBancarios?.conta),
    listaEmpenhos.length > 0,
  ];

  const hasRetencoes =
    Boolean(retencoes?.optante_simples_nacional) ||
    ['iss', 'inss', 'ir', 'csll', 'cofins', 'pis_pasep'].some((field) =>
      isCopyableValue(retencoes?.[field as keyof typeof retencoes] as string | undefined),
    );

  const requiredCount = requiredFlags.filter(Boolean).length;

  return {
    requiredCount,
    hasRetencoes,
    hasExtractedInfo: requiredCount > 0 || hasRetencoes,
    isComplete: requiredCount === requiredFlags.length,
    score: requiredCount * 10 + (hasRetencoes ? 1 : 0),
  };
};

const getCaixaBadgeColor = (caixa: string) => {
  const normalized = caixa.toLowerCase();
  if (normalized.includes('entrada') || normalized.includes('recebido')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-50';
  }
  if (normalized.includes('meus') || normalized.includes('criado')) {
    return 'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-50';
  }
  if (normalized.includes('interessado')) {
    return 'bg-violet-50 text-violet-700 border-violet-200/80 hover:bg-violet-50';
  }
  if (normalized.includes('aguardando') || normalized.includes('envio') || normalized.includes('saida')) {
    return 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-50';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-50';
};

const getVisibleProcesses = (
  processos: SuapProcesso[],
  searchTerm: string,
  statusFilter: StatusFilter,
  caixaFilter: string
) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return processos
    .filter((processo) => {
      const isConcluded = isProcessConcluded(processo);
      const matchesSearch =
        normalizedSearch === '' ||
        processo.suapId.toLowerCase().includes(normalizedSearch) ||
        (processo.numProcesso || '').toLowerCase().includes(normalizedSearch) ||
        (processo.beneficiario || '').toLowerCase().includes(normalizedSearch) ||
        (processo.assunto || '').toLowerCase().includes(normalizedSearch) ||
        (processo.cpfCnpj || '').toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        (statusFilter === 'active' && !isConcluded) ||
        (statusFilter === 'concluded' && isConcluded);

      const matchesCaixa =
        caixaFilter === 'all' ||
        (processo.caixa && processo.caixa.toLowerCase().includes(caixaFilter.toLowerCase())) ||
        (caixaFilter === 'none' && !processo.caixa);

      return matchesSearch && matchesStatus && matchesCaixa;
    })
    .sort((left, right) => {
      const leftCompleteness = getProcessCompleteness(left);
      const rightCompleteness = getProcessCompleteness(right);

      if (leftCompleteness.isComplete !== rightCompleteness.isComplete) {
        return Number(rightCompleteness.isComplete) - Number(leftCompleteness.isComplete);
      }

      if (leftCompleteness.score !== rightCompleteness.score) {
        return rightCompleteness.score - leftCompleteness.score;
      }

      return (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0);
    });
};

const formatUpdatedAt = (date?: Date) => {
  if (!date || Number.isNaN(date.getTime())) {
    return 'Sem data';
  }

  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const copyText = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch (error) {
    console.error(error);
    toast.error('Não foi possível copiar este valor.');
  }
};

const getStatusMeta = (processo: SuapProcesso) => {
  if (isProcessConcluded(processo) || processo.status.toLowerCase() === 'concluido') {
    return {
      label: 'Concluído',
      badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentClassName: 'before:bg-emerald-500',
    };
  }

  const normalized = processo.status.toLowerCase();

  if (normalized === 'pending_extraction') {
    return {
      label: 'Inventário',
      badgeClassName: 'bg-slate-50 text-slate-700 border-slate-200',
      accentClassName: 'before:bg-slate-400',
    };
  }

  if (normalized === 'pdf_uploaded') {
    return {
      label: 'PDF pronto',
      badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200',
      accentClassName: 'before:bg-blue-500',
    };
  }

  if (normalized === 'queued_extraction') {
    return {
      label: 'IA em fila',
      badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      accentClassName: 'before:bg-amber-500',
    };
  }

  if (normalized === 'processing_extraction' || normalized === 'processing_chunks') {
    return {
      label: 'IA processando',
      badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      accentClassName: 'before:bg-amber-500',
    };
  }

  if (normalized === 'success' || normalized === 'incomplete_extraction') {
    return {
      label: 'Extraído',
      badgeClassName: 'bg-sky-50 text-sky-700 border-sky-200',
      accentClassName: 'before:bg-sky-500',
    };
  }

  if (isErrorStatus(normalized)) {
    return {
      label: 'Erro',
      badgeClassName: 'bg-rose-50 text-rose-700 border-rose-200',
      accentClassName: 'before:bg-rose-500',
    };
  }

  return {
    label: processo.status,
    badgeClassName: 'bg-slate-100 text-slate-700 border-slate-200',
    accentClassName: 'before:bg-slate-400',
  };
};

const getExtractionIssue = (processo: SuapProcesso) => {
  const job = processo.dadosCompletos?.extraction_job;
  if (!job?.last_error_code) return null;

  if (job.last_error_code === 'provider_rate_limit') {
    return job.last_error_message?.includes('OpenAI/OpenRouter (fallback) falhou')
      ? 'Gemini indisponivel por limite de cota; o fallback tambem falhou'
      : 'Gemini indisponivel por limite de cota';
  }

  return job.last_error_message || 'A extracao por IA precisa ser refeita.';
};

const getAnaliseMeta = (status?: 'ok' | 'warning' | 'error') => {
  if (status === 'ok') {
    return {
      badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      itemClassName: 'border-emerald-200/70 bg-emerald-50/70',
      icon: CheckCircle2,
      label: 'Análise sem divergências',
    };
  }

  if (status === 'error') {
    return {
      badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
      itemClassName: 'border-rose-200/70 bg-rose-50/70',
      icon: AlertTriangle,
      label: 'Análise com erros',
    };
  }

  return {
    badgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    itemClassName: 'border-amber-200/70 bg-amber-50/70',
    icon: Sparkles,
    label: 'Análise com alertas',
  };
};

function CopyAction({
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
        'inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition',
        'hover:border-slate-300 hover:bg-white hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      onClick={() => {
        if (canCopy) {
          void copyText(value!, message);
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function InfoPanel({
  icon,
  label,
  children,
  tone = 'slate',
  className,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan';
  className?: string;
}) {
  const toneClasses = {
    slate: {
      shell: 'border-slate-200/80 bg-white',
      label: 'text-slate-500',
      iconWrap: 'bg-slate-100/90 text-slate-500',
      accent: 'bg-slate-300',
    },
    blue: {
      shell: 'border-sky-200/70 bg-sky-50/35',
      label: 'text-sky-700/85',
      iconWrap: 'bg-sky-50 text-sky-600',
      accent: 'bg-sky-400',
    },
    emerald: {
      shell: 'border-emerald-200/70 bg-emerald-50/35',
      label: 'text-emerald-700/85',
      iconWrap: 'bg-emerald-50 text-emerald-600',
      accent: 'bg-emerald-400',
    },
    amber: {
      shell: 'border-amber-200/70 bg-amber-50/35',
      label: 'text-amber-700/85',
      iconWrap: 'bg-amber-50 text-amber-600',
      accent: 'bg-amber-400',
    },
    violet: {
      shell: 'border-violet-200/70 bg-violet-50/35',
      label: 'text-violet-700/85',
      iconWrap: 'bg-violet-50 text-violet-600',
      accent: 'bg-violet-400',
    },
    cyan: {
      shell: 'border-cyan-200/70 bg-cyan-50/35',
      label: 'text-cyan-700/85',
      iconWrap: 'bg-cyan-50 text-cyan-600',
      accent: 'bg-cyan-400',
    },
  }[tone];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-soft',
        toneClasses.shell,
        className,
      )}
    >
      <div className={cn('absolute inset-x-4 top-0 h-[3px] rounded-full', toneClasses.accent)} />
      <div className={cn('mb-3 flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.14em]', toneClasses.label)}>
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-lg', toneClasses.iconWrap)}>
          {icon}
        </span>
        {label}
      </div>
      {children}
    </div>
  );
}

function ProcessDetailsContent({ processo }: { processo: SuapProcesso }) {
  const statusMeta = getStatusMeta(processo);
  const workflow = getProcessWorkflow(processo);
  const analiseLiquidacao = workflow?.analiseLiquidacao;
  const analiseMeta = analiseLiquidacao ? getAnaliseMeta(analiseLiquidacao.statusGeral) : null;
  const AnaliseIcon = analiseMeta?.icon;
  const notasFiscais = getNotasFiscais(processo.dadosCompletos);
  const dadosBancarios = processo.dadosCompletos?.dados_bancarios;
  const retencoes = processo.dadosCompletos?.retencoes_tributarias;
  const retencoesVisiveis = [
    ['ISS', retencoes?.iss],
    ['INSS', retencoes?.inss],
    ['IR', retencoes?.ir],
    ['CSLL', retencoes?.csll],
    ['COFINS', retencoes?.cofins],
    ['PIS/PASEP', retencoes?.pis_pasep],
  ].filter(([, value]) => isCopyableValue(value));

  const contrato = processo.contrato || processo.dadosCompletos?.contrato_numero || '-';
  const valorLiquido = processo.dadosCompletos?.val_nf || '-';
  const nsNumero = getNsNumero(processo);
  const listaEmpenhos = processo.dadosCompletos?.empenhos || [];
  const hasBeneficiarioPanel = isCopyableValue(processo.beneficiario) || isCopyableValue(processo.cpfCnpj);
  const hasValorNsPanel = isCopyableValue(valorLiquido) || isCopyableValue(nsNumero);
  const hasAssuntoPanel = isCopyableValue(processo.assunto);
  const hasContratoNfPanel =
    isCopyableValue(contrato) ||
    notasFiscais.some((nota) => isCopyableValue(nota.numero) || isCopyableValue(nota.data_emissao) || isCopyableValue(nota.valor));
  const hasDadosBancariosPanel =
    isCopyableValue(dadosBancarios?.banco) ||
    isCopyableValue(dadosBancarios?.agencia) ||
    isCopyableValue(dadosBancarios?.conta);
  const hasRetencoesEmpenhosPanel =
    Boolean(retencoes?.optante_simples_nacional) || retencoesVisiveis.length > 0 || listaEmpenhos.length > 0;
  const hasExtractedDetails =
    hasBeneficiarioPanel || hasValorNsPanel || hasAssuntoPanel || hasContratoNfPanel || hasDadosBancariosPanel || hasRetencoesEmpenhosPanel;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border-default/70 bg-surface-subtle/40 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="font-ui text-sm font-semibold text-text-primary">
            {processo.numProcesso || processo.suapId}
          </p>
          <p className="font-mono text-xs text-text-secondary">SUAP ID: {processo.suapId}</p>
          {processo.caixa ? (
            <Badge variant="outline" className={cn('mt-1 border text-[11px] font-semibold', getCaixaBadgeColor(processo.caixa))}>
              {processo.caixa}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={statusMeta.badgeClassName}>{statusMeta.label}</Badge>
          <span className="text-xs text-text-secondary">Atualizado: {formatUpdatedAt(processo.updatedAt)}</span>
        </div>
      </div>

      {!hasExtractedDetails && !workflow?.concluido ? (
        <div className="rounded-xl border border-dashed border-border-default/80 bg-white p-6 text-sm text-text-secondary">
          Nenhum dado extraído pela IA foi salvo ainda para este processo.
        </div>
      ) : null}

      {hasBeneficiarioPanel || hasValorNsPanel ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {hasBeneficiarioPanel ? (
            <InfoPanel icon={<Building2 className="h-3.5 w-3.5" />} label="Beneficiário" tone="cyan">
              <div className="flex items-start justify-between gap-3">
                <p className="font-ui text-sm font-semibold leading-6 text-text-primary">
                  {processo.beneficiario || processo.cpfCnpj}
                </p>
                <CopyAction value={processo.beneficiario} message="Beneficiário copiado." />
              </div>
              {isCopyableValue(processo.cpfCnpj) ? (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-default/70 pt-3 font-ui text-xs text-text-secondary">
                  <span className="font-mono">{processo.cpfCnpj}</span>
                  <CopyAction value={processo.cpfCnpj} message="Documento copiado." />
                </div>
              ) : null}
            </InfoPanel>
          ) : null}

          {hasValorNsPanel ? (
            <InfoPanel icon={<Wallet className="h-3.5 w-3.5" />} label="Valor e NS" tone="blue">
              {isCopyableValue(valorLiquido) ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="font-ui text-lg font-black tracking-tight text-sky-700">{valorLiquido}</p>
                  <CopyAction value={valorLiquido} message="Valor copiado." />
                </div>
              ) : null}
              {isCopyableValue(nsNumero) ? (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-sky-100 pt-3 font-ui text-sm text-text-primary">
                  <span>NS final: <span className="font-mono font-semibold">{nsNumero}</span></span>
                  <CopyAction value={nsNumero} message="NS copiada." />
                </div>
              ) : null}
            </InfoPanel>
          ) : null}
        </div>
      ) : null}

      {hasAssuntoPanel ? (
        <InfoPanel icon={<ReceiptText className="h-3.5 w-3.5" />} label="Assunto" tone="amber">
          <div className="flex items-start justify-between gap-3">
            <p className="font-ui text-sm leading-6 text-text-primary">{processo.assunto}</p>
            <CopyAction value={processo.assunto} message="Assunto copiado." />
          </div>
        </InfoPanel>
      ) : null}

      {hasContratoNfPanel || hasDadosBancariosPanel ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {hasContratoNfPanel ? (
            <InfoPanel icon={<Landmark className="h-3.5 w-3.5" />} label="Contrato e NF" tone="violet">
              {isCopyableValue(contrato) ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-ui text-xs uppercase tracking-[0.12em] text-text-muted">Contrato</p>
                    <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{contrato}</p>
                  </div>
                  <CopyAction value={contrato} message="Contrato copiado." />
                </div>
              ) : null}
              {notasFiscais.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-violet-100 pt-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Notas Fiscais</p>
                  {notasFiscais.map((nota, index) => (
                    <div key={`${nota.numero || 'nota'}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2">
                      <div className="font-ui text-sm text-text-secondary">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                          {notasFiscais.length > 1 ? `Nota Fiscal ${index + 1}` : 'Nota Fiscal'}
                        </p>
                        {isCopyableValue(nota.numero) ? <p className="mt-1 font-semibold text-violet-700">{nota.numero}</p> : null}
                        {isCopyableValue(nota.data_emissao) ? <p className="mt-1 text-xs text-text-secondary">{nota.data_emissao}</p> : null}
                        {isCopyableValue(nota.valor) ? <p className="mt-1 text-xs text-text-secondary">Valor: {nota.valor}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <CopyAction value={nota.numero} message="Número da nota fiscal copiado." />
                        <CopyAction value={nota.data_emissao} message="Data de emissão copiada." />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </InfoPanel>
          ) : null}

          {hasDadosBancariosPanel ? (
            <InfoPanel icon={<Building2 className="h-3.5 w-3.5" />} label="Dados Bancários" tone="emerald">
              {isCopyableValue(dadosBancarios?.banco) ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-ui text-xs uppercase tracking-[0.12em] text-text-muted">Banco</p>
                    <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{dadosBancarios?.banco}</p>
                  </div>
                  <CopyAction value={dadosBancarios?.banco} message="Banco copiado." />
                </div>
              ) : null}
              {isCopyableValue(dadosBancarios?.agencia) || isCopyableValue(dadosBancarios?.conta) ? (
                <div className="mt-3 grid gap-2 border-t border-emerald-100 pt-3 sm:grid-cols-2">
                  {isCopyableValue(dadosBancarios?.agencia) ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                      <div>
                        <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-text-muted">Agência</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{dadosBancarios?.agencia}</p>
                      </div>
                      <CopyAction value={dadosBancarios?.agencia} message="Agência copiada." className="h-7 w-7" />
                    </div>
                  ) : null}
                  {isCopyableValue(dadosBancarios?.conta) ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                      <div>
                        <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-text-muted">Conta</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{dadosBancarios?.conta}</p>
                      </div>
                      <CopyAction value={dadosBancarios?.conta} message="Conta copiada." className="h-7 w-7" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </InfoPanel>
          ) : null}
        </div>
      ) : null}

      {hasRetencoesEmpenhosPanel ? (
        <InfoPanel icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Retenções e Empenhos" tone="slate">
          {retencoes?.optante_simples_nacional ? (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Optante pelo Simples Nacional
            </Badge>
          ) : null}
          {retencoesVisiveis.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {retencoesVisiveis.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-dashed border-border-default/90 bg-surface-subtle/40 px-3 py-2 font-ui text-sm">
                  <span className="text-text-secondary">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{value}</span>
                    <CopyAction value={value} message={`${label} copiado.`} className="h-7 w-7" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {listaEmpenhos.length ? (
            <div className="mt-4 border-t border-border-default/70 pt-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Empenhos</p>
                <CopyAction value={listaEmpenhos.join(', ')} message="Lista de empenhos copiada." />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {listaEmpenhos.map((empenho) => (
                  <div key={empenho} className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-subtle/40 px-3 py-1.5 text-xs shadow-sm">
                    <span className="font-mono font-semibold text-text-primary">{empenho}</span>
                    <CopyAction value={empenho} message="Empenho copiado." className="h-6 w-6 border-0 bg-transparent shadow-none" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </InfoPanel>
      ) : null}

      {workflow?.concluido ? (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conclusão do processo
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                NS registrada: <span className="font-mono">{workflow.nsNumero || nsNumero}</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {workflow.concluidoEm ? `Concluído em ${formatUpdatedAt(new Date(workflow.concluidoEm))}` : 'Processo concluído sem data registrada.'}
                {workflow.concluidoPor ? ` por ${workflow.concluidoPor}` : ''}
              </p>
            </div>
            {analiseMeta && AnaliseIcon ? (
              <Badge variant="outline" className={analiseMeta.badgeClassName}>
                <AnaliseIcon className="mr-1 h-3.5 w-3.5" />
                {analiseMeta.label}
              </Badge>
            ) : null}
          </div>
          {analiseLiquidacao ? (
            <div className="mt-4 border-t border-emerald-200/70 pt-4">
              <p className="text-sm leading-6 text-slate-700">{analiseLiquidacao.resumo}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
export default function Suap() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [caixaFilter, setCaixaFilter] = useState<string>('all');
  const [processActionId, setProcessActionId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<ProcessAction | null>(null);
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<string>>(new Set());
  const [reopeningProcessId, setReopeningProcessId] = useState<string | null>(null);
  const [selectedProcesso, setSelectedProcesso] = useState<SuapProcesso | null>(null);
  const [detailsProcesso, setDetailsProcesso] = useState<SuapProcesso | null>(null);
  const [isConclusaoDialogOpen, setIsConclusaoDialogOpen] = useState(false);
  const [dispatchQueue, setDispatchQueue] = useState<DispatchQueueState | null>(() => loadDispatchQueue());
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(() => Boolean(loadDispatchQueue()));

  // local login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [isCaixasDialogOpen, setIsCaixasDialogOpen] = useState(false);
  const [newCaixaNome, setNewCaixaNome] = useState('');
  const [newCaixaUrl, setNewCaixaUrl] = useState('');
  const [isAddingCaixa, setIsAddingCaixa] = useState(false);

  useEffect(() => {
    setSelectedProcesso(null);
    setDetailsProcesso(null);
    setIsConclusaoDialogOpen(false);
  }, [session?.user.id]);

  const {
    data: processos = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['suap-processos'],
    queryFn: suapProcessosService.getAll,
    enabled: !!session,
    refetchInterval: (query) => {
      const items = (query.state.data || []) as SuapProcesso[];
      const hasPendingAi = items.some((processo) =>
        ['queued_extraction', 'processing_extraction', 'processing_chunks', 'consolidating_extraction'].includes(processo.status),
      );
      return hasPendingAi ? 5000 : 30000;
    },
  });

  const {
    data: registeredCaixas = [],
    isLoading: isCaixasLoading,
    refetch: refetchCaixas,
  } = useQuery({
    queryKey: ['suap-caixas'],
    queryFn: suapProcessosService.getRegisteredCaixas,
    enabled: !!session,
  });



  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Informe e-mail e senha do Supabase.');
      return;
    }
    setIsAuthLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      toast.success('Login realizado com sucesso.');
      setPassword('');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAddCaixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaixaNome.trim() || !newCaixaUrl.trim()) {
      toast.error('Preencha o nome e o link da caixa.');
      return;
    }
    setIsAddingCaixa(true);
    try {
      await suapProcessosService.addRegisteredCaixa(newCaixaNome.trim(), newCaixaUrl.trim());
      toast.success('Caixa cadastrada com sucesso.');
      setNewCaixaNome('');
      setNewCaixaUrl('');
      void refetchCaixas();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar caixa.');
    } finally {
      setIsAddingCaixa(false);
    }
  };

  const handleDeleteCaixa = async (id: string) => {
    const loadingToast = toast.loading('Removendo caixa...');
    try {
      await suapProcessosService.deleteRegisteredCaixa(id);
      toast.success('Caixa removida.', { id: loadingToast });
      void refetchCaixas();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover caixa.', { id: loadingToast });
    }
  };

  const visibleProcesses = getVisibleProcesses(processos, searchTerm, statusFilter, caixaFilter);
  const processCounts = useMemo(
    () => ({
      active: getVisibleProcesses(processos, '', 'active', caixaFilter).length,
      concluded: getVisibleProcesses(processos, '', 'concluded', caixaFilter).length,
    }),
    [processos, caixaFilter],
  );
  const selectedProcesses = useMemo(
    () => visibleProcesses.filter((processo) => selectedProcessIds.has(processo.id)),
    [visibleProcesses, selectedProcessIds],
  );
  const allVisibleSelected = visibleProcesses.length > 0 && visibleProcesses.every((processo) => selectedProcessIds.has(processo.id));

  useEffect(() => {
    if (dispatchQueue) {
      saveDispatchQueue(dispatchQueue);
    } else {
      clearDispatchQueue();
    }
  }, [dispatchQueue]);

  const startDispatchGeneration = (selected: SuapProcesso[]) => {
    if (selected.length === 0) return;
    setDispatchQueue(createDispatchQueue(selected));
    setIsDispatchDialogOpen(true);
  };


  const startStandaloneDispatchGeneration = () => {
    setDispatchQueue(createStandaloneDispatchQueue());
    setIsDispatchDialogOpen(true);
  };
  const handleDispatchDialogOpenChange = (open: boolean) => {
    setIsDispatchDialogOpen(open);
    if (!open) {
      setDispatchQueue(null);
    }
  };

  const getSuapSessionId = () => {
    const savedSession = localStorage.getItem('suap_session_id');
    if (!savedSession || savedSession === 'undefined' || savedSession === 'null') {
      toast.error('Conecte-se ao SUAP no importador antes de baixar PDFs.');
      return null;
    }
    return savedSession;
  };

  const toScrapedProcess = (processo: SuapProcesso) => ({
    suapId: processo.suapId,
    numProcesso: processo.numProcesso,
    url: processo.url,
    caixa: processo.caixa,
  });

  const toggleProcessSelection = (processoId: string) => {
    setSelectedProcessIds((current) => {
      const next = new Set(current);
      if (next.has(processoId)) {
        next.delete(processoId);
      } else {
        next.add(processoId);
      }
      return next;
    });
  };

  const toggleSelectVisibleProcesses = () => {
    setSelectedProcessIds((current) => {
      if (allVisibleSelected) {
        return new Set([...current].filter((id) => !visibleProcesses.some((processo) => processo.id === id)));
      }
      return new Set([...current, ...visibleProcesses.map((processo) => processo.id)]);
    });
  };

  const replaceCachedProcess = (processoAtualizado: SuapProcesso) => {
    queryClient.setQueryData<SuapProcesso[]>(['suap-processos'], (current = []) =>
      current.map((item) => (item.id === processoAtualizado.id ? processoAtualizado : item)),
    );
  };

  const handleConclusaoSuccess = (processoAtualizado: SuapProcesso) => {
    replaceCachedProcess(processoAtualizado);
    setSelectedProcesso(null);
    setStatusFilter('concluded');
  };

  const handleOpenConclusaoDialog = (processo: SuapProcesso) => {
    setSelectedProcesso(processo);
    setIsConclusaoDialogOpen(true);
  };

  const handleReopenProcess = async (processo: SuapProcesso) => {
    setReopeningProcessId(processo.id);
    const loadingToast = toast.loading('Reabrindo processo...');

    try {
      const processoAtualizado = await suapProcessosService.reabrirProcesso(processo);
      replaceCachedProcess(processoAtualizado);
      toast.success('Processo reaberto com sucesso.', { id: loadingToast });
      if (statusFilter === 'concluded') {
        setStatusFilter('active');
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reabrir o processo.', {
        id: loadingToast,
      });
    } finally {
      setReopeningProcessId(null);
    }
  };

  const handleDownloadPdfStage = async (processo: SuapProcesso, force = false) => {
    if (!session?.user?.id) return;
    const suapSessionId = getSuapSessionId();
    if (!suapSessionId) return;

    const actionId = `${processo.id}:download`;
    setProcessActionId(actionId);
    const loadingToast = toast.loading(force ? 'Atualizando PDF do processo...' : 'Baixando PDF do processo...');

    try {
      await suapScraperService.downloadPdfForProcess(
        toScrapedProcess(processo),
        suapSessionId,
        session.user.id,
        (message) => console.info(message),
        { force },
      );
      toast.success('PDF sincronizado.', { id: loadingToast });
      await refetch();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao baixar PDF.', { id: loadingToast });
    } finally {
      setProcessActionId(null);
    }
  };

  const handleAiExtractionStage = async (processo: SuapProcesso, force = false) => {
    if (!session?.user?.id) return;
    if (!processo.pdfUrl) {
      toast.info('Baixe o PDF antes de iniciar a extracao por IA.');
      return;
    }

    const actionId = `${processo.id}:ai`;
    setProcessActionId(actionId);
    const loadingToast = toast.loading(force ? 'Refazendo extracao por IA...' : 'Executando extracao por IA...');

    try {
      const result = await suapScraperService.runAiExtractionForProcess(
        { suapId: processo.suapId },
        session.user.id,
        (message) => console.info(message),
        { force },
      );
      toast.success(
        result.queued ? 'Extracao por IA enfileirada. A tabela sera atualizada automaticamente.' : 'Extracao por IA ja estava concluida.',
        { id: loadingToast },
      );
      await refetch();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha na extracao por IA.', { id: loadingToast });
    } finally {
      setProcessActionId(null);
    }
  };

  const handleIndividualDocumentPilot = async (processo: SuapProcesso) => {
    if (!session?.user?.id) return;
    const suapSessionId = getSuapSessionId();
    if (!suapSessionId) return;

    const actionId = `${processo.id}:pilot`;
    setProcessActionId(actionId);
    const loadingToast = toast.loading('Preparando extração com PDFs individuais...');
    try {
      const result = await suapScraperService.runIndividualDocumentPilotForProcess(
        toScrapedProcess(processo),
        suapSessionId,
        session.user.id,
        (message) => console.info(message),
      );
      const summary = `${result.includedDocuments} documento(s) útil(eis), ${result.excludedDocuments} ignorado(s)`;
      toast.success(
        result.usedFullPdfFallback
          ? `Nenhum PDF útil ficou disponível; extração enfileirada com PDF completo (${summary}).`
          : result.hasUnavailableDocuments
            ? `Extração iniciada com os PDFs úteis disponíveis; o completo fica reservado para complementar dados ausentes (${summary}).`
            : `Extração do piloto enfileirada com PDFs individuais (${summary}).`,
        { id: loadingToast },
      );
      await refetch();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha no piloto de PDFs individuais.', { id: loadingToast });
    } finally {
      setProcessActionId(null);
    }
  };

  const runBulkAction = async (action: ProcessAction) => {
    if (!session?.user?.id || selectedProcesses.length === 0) return;

    const suapSessionId = action === 'ai' ? null : getSuapSessionId();
    if (action !== 'ai' && !suapSessionId) return;

    setBulkAction(action);
    const labels = {
      download: 'Baixando PDFs selecionados...',
      ai: 'Extraindo por IA os processos selecionados...',
      full: 'Executando fluxo completo nos processos selecionados...',
    };
    const loadingToast = toast.loading(labels[action]);

    let completed = 0;
    let skipped = 0;
    let errors = 0;

    for (const processo of selectedProcesses) {
      try {
        if (action === 'download') {
          await suapScraperService.downloadPdfForProcess(
            toScrapedProcess(processo),
            suapSessionId!,
            session.user.id,
            (message) => console.info(message),
          );
        } else if (action === 'ai') {
          if (!processo.pdfUrl) {
            skipped++;
            continue;
          }
          await suapScraperService.runAiExtractionForProcess(
            { suapId: processo.suapId },
            session.user.id,
            (message) => console.info(message),
          );
        } else {
          await suapScraperService.processAndSyncSingle(
            toScrapedProcess(processo),
            suapSessionId!,
            session.user.id,
            (message) => console.info(message),
          );
        }
        completed++;
      } catch (error) {
        console.error(error);
        errors++;
      }
    }

    await refetch();
    setSelectedProcessIds(new Set());
    setBulkAction(null);

    if (errors > 0) {
      toast.warning(`${completed} concluido(s), ${skipped} pulado(s), ${errors} erro(s).`, { id: loadingToast });
    } else {
      toast.success(`${completed} concluido(s), ${skipped} pulado(s).`, { id: loadingToast });
    }
  };
  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        Espelho dos processos sincronizados no SUAP.
      </HeaderSubtitle>

      <HeaderActions>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(suapExtensionGithubUrl, '_blank', 'noopener,noreferrer')}
            className="h-space-9 gap-space-2 border-border-default bg-white text-slate-700 shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
          >
            <ExternalLink className="h-4 w-4" />
            Baixar extensão
          </Button>
        </div>
      </HeaderActions>


      <SuapConclusaoDialog
        open={isConclusaoDialogOpen}
        onOpenChange={(open) => {
          setIsConclusaoDialogOpen(open);
          if (!open) {
            setSelectedProcesso(null);
          }
        }}
        processo={selectedProcesso}
        userEmail={session?.user?.email}
        onSuccess={handleConclusaoSuccess}
      />

      <SuapDocumentGeneratorDialog
        open={isDispatchDialogOpen}
        onOpenChange={handleDispatchDialogOpenChange}
        processos={processos}
        queue={dispatchQueue}
        onQueueChange={setDispatchQueue}
      />

      <Dialog
        open={Boolean(detailsProcesso)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsProcesso(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto bg-surface-card sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-ui text-lg text-text-primary">
              Detalhes do processo SUAP
            </DialogTitle>
          </DialogHeader>
          {detailsProcesso ? <ProcessDetailsContent processo={detailsProcesso} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCaixasDialogOpen} onOpenChange={setIsCaixasDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg bg-surface-card border-border-default overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-ui text-lg text-text-primary">
              Gerenciar Caixas do SUAP
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2 w-full min-w-0 overflow-hidden">
            <form onSubmit={handleAddCaixa} className="space-y-3 border-b border-border-default/60 pb-5 w-full min-w-0">
              <h4 className="font-ui text-xs font-semibold text-text-secondary uppercase tracking-[0.1em]">
                Cadastrar Nova Caixa
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 w-full min-w-0">
                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] font-medium text-text-secondary">Nome da Caixa</label>
                  <Input
                    value={newCaixaNome}
                    onChange={(e) => setNewCaixaNome(e.target.value)}
                    placeholder="Ex: Caixa de Entrada"
                    className="h-9 bg-white w-full"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-[11px] font-medium text-text-secondary">Link (URL) do SUAP</label>
                  <Input
                    value={newCaixaUrl}
                    onChange={(e) => setNewCaixaUrl(e.target.value)}
                    placeholder="https://suap.ifrn.edu.br/..."
                    className="h-9 bg-white w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={isAddingCaixa} className="h-9 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <Plus className="h-4 w-4" />
                  Adicionar Caixa
                </Button>
              </div>
            </form>

            <div className="space-y-3 w-full min-w-0">
              <h4 className="font-ui text-xs font-semibold text-text-secondary uppercase tracking-[0.1em]">
                Caixas Cadastradas
              </h4>
              {isCaixasLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : registeredCaixas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma caixa cadastrada.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-border-default/50 rounded-xl divide-y divide-border-default/50 bg-white w-full min-w-0">
                  {registeredCaixas.map((caixa) => (
                    <div key={caixa.id} className="flex items-center justify-between p-3 hover:bg-slate-50/50 transition-colors w-full min-w-0">
                      <div className="space-y-0.5 min-w-0 flex-1 pr-4">
                        <p className="text-xs font-bold text-text-primary truncate">{caixa.nome}</p>
                        <p className="text-[10px] text-muted-foreground truncate block" title={caixa.url}>{caixa.url}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const separator = caixa.url.includes('?') ? '&' : '?';
                            window.open(`${caixa.url}${separator}suap-auto-sync=true`, '_blank', 'noopener,noreferrer');
                          }}
                          title="Sincronizar esta caixa"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteCaixa(caixa.id)}
                          title="Excluir caixa"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por processo, beneficiário, assunto ou documento..."
                  className="pl-9"
                />
              </div>

              <div className="w-full sm:w-56 shrink-0">
                <Select value={caixaFilter} onValueChange={setCaixaFilter}>
                  <SelectTrigger className="w-full bg-white border-border-default/80">
                    <SelectValue placeholder="Filtrar por caixa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as caixas</SelectItem>
                    {registeredCaixas.map((caixa) => (
                      <SelectItem key={caixa.id} value={caixa.nome}>
                        {caixa.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">Sem caixa atribuída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

              <Tabs
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                className="w-full lg:w-auto"
              >
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-lg border border-border-default/60 bg-surface-card p-1 shadow-sm lg:inline-grid lg:w-auto lg:grid-cols-2">
                  {([
                    ['active', 'Em andamento'],
                    ['concluded', 'Concluidos'],
                  ] as Array<[StatusFilter, string]>).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="flex h-9 items-center gap-2 rounded-md px-3 font-ui text-xs font-semibold text-text-secondary transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                      <span>{label}</span>
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-current/80">
                        {processCounts[value]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

          </div>

      {session ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border-default/70 bg-surface-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 font-ui text-xs font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectVisibleProcesses}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            {selectedProcesses.length > 0
              ? `${selectedProcesses.length} processo(s) selecionado(s)`
              : 'Selecionar processos visíveis'}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkAction !== null}
                  className="h-9 gap-2 bg-white text-xs"
                >
                  <FilePenLine className="h-4 w-4" />
                  Gerar documentos
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={startStandaloneDispatchGeneration}>
                  <FileText className="mr-2 h-4 w-4" />
                  Despacho de Liquidacao avulso
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedProcesses.length === 0 || bulkAction !== null}
                  onClick={() => startDispatchGeneration(selectedProcesses)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Despacho de Liquidacao
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedProcesses.length === 0 || bulkAction !== null}
              onClick={() => void runBulkAction('download')}
              className="h-9 gap-2 bg-white text-xs"
            >
              <FileDown className="h-4 w-4" />
              {bulkAction === 'download' ? 'Baixando...' : 'Baixar PDF'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedProcesses.length === 0 || bulkAction !== null}
              onClick={() => void runBulkAction('ai')}
              className="h-9 gap-2 bg-white text-xs"
            >
              <Sparkles className="h-4 w-4" />
              {bulkAction === 'ai' ? 'Extraindo...' : 'Extrair IA'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedProcesses.length === 0 || bulkAction !== null}
              onClick={() => void runBulkAction('full')}
              className="h-9 gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <RefreshCw className={cn('h-4 w-4', bulkAction === 'full' && 'animate-spin')} />
              {bulkAction === 'full' ? 'Executando...' : 'Fluxo completo'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selectedProcesses.length === 0 || bulkAction !== null}
              onClick={() => setSelectedProcessIds(new Set())}
              className="h-9 text-xs text-slate-600"
            >
              Limpar seleção
            </Button>
          </div>
        </div>
      ) : null}

      {isError ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="flex flex-col gap-3 py-6 text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-semibold">Não consegui carregar o espelho do SUAP.</p>
                <p className="text-sm text-rose-700">
                  {error instanceof Error ? error.message : 'Erro desconhecido ao consultar o Supabase.'}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => void refetch()} className="border-rose-200 bg-white">
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border-default/70 bg-surface-card shadow-soft">
        <CardContent className="p-0">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 px-4">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectVisibleProcesses}
                    aria-label="Selecionar processos filtrados"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Caixa</TableHead>
                <TableHead>Informacoes</TableHead>
                <TableHead>Andamento</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-12 w-72" /></TableCell>
                    <TableCell><Skeleton className="h-12 w-36" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-8 w-44" /></TableCell>
                  </TableRow>
                ))
              ) : (
                visibleProcesses.map((processo) => {
                  const statusMeta = getStatusMeta(processo);
                  const extractionIssue = getExtractionIssue(processo);
                  const isSelected = selectedProcessIds.has(processo.id);
                  const isDownloading = processActionId === `${processo.id}:download`;
                  const isExtractingAi = processActionId === `${processo.id}:ai`;
                  const isExtractingIndividual = processActionId === `${processo.id}:pilot`;
                  const isConcluded = isProcessConcluded(processo);
                  const processLabel = processo.numProcesso || processo.suapId || 'Processo sem SUAP ID';
                  const valorLiquido = processo.dadosCompletos?.val_nf;
                  const nsNumero = getNsNumero(processo);
                  const contrato = processo.contrato || processo.dadosCompletos?.contrato_numero;
                  const notasFiscais = getNotasFiscais(processo.dadosCompletos);
                  const dadosBancarios = processo.dadosCompletos?.dados_bancarios;
                  const empenhos = processo.dadosCompletos?.empenhos || [];
                  const retencoes = processo.dadosCompletos?.retencoes_tributarias;
                  const hasRetencoes = Boolean(retencoes?.optante_simples_nacional) ||
                    ['iss', 'inss', 'ir', 'csll', 'cofins', 'pis_pasep'].some((field) =>
                      isCopyableValue(retencoes?.[field as keyof typeof retencoes] as string | undefined),
                    );
                  const rowDetails = [
                    processo.beneficiario,
                    processo.cpfCnpj,
                    processo.assunto,
                    isCopyableValue(valorLiquido) ? `Valor: ${valorLiquido}` : null,
                    isCopyableValue(nsNumero) ? `NS: ${nsNumero}` : null,
                    isCopyableValue(contrato) ? `Contrato: ${contrato}` : null,
                    notasFiscais.some((nota) => isCopyableValue(nota.numero))
                      ? `NF: ${notasFiscais.map((nota) => nota.numero).filter((numero): numero is string => Boolean(numero)).join(", ")}`
                      : null,
                    isCopyableValue(dadosBancarios?.banco) ? `Banco: ${dadosBancarios?.banco}` : null,
                    empenhos.length > 0 ? `Empenhos: ${empenhos.join(', ')}` : null,
                    hasRetencoes ? 'Retencoes registradas' : null,
                  ].filter((item): item is string => Boolean(item));

                  return (
                    <TableRow key={processo.id} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell className="px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProcessSelection(processo.id)}
                          aria-label={`Selecionar processo ${processLabel}`}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-ui text-sm font-semibold text-text-primary">{processLabel}</span>
                            <CopyAction
                              value={processo.numProcesso || processo.suapId}
                              message="Processo copiado."
                              className="h-7 w-7 rounded-lg shadow-none"
                            />
                          </div>
                          {processo.numProcesso ? <p className="font-mono text-[11px] text-text-muted">SUAP ID: {processo.suapId}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {processo.caixa ? (
                          <Badge
                            variant="outline"
                            className={cn('max-w-[220px] truncate border px-2.5 py-0.5 text-[11px] font-semibold', getCaixaBadgeColor(processo.caixa))}
                            title={processo.caixa}
                          >
                            {processo.caixa}
                          </Badge>
                        ) : (
                          <span className="text-xs text-text-muted">Sem caixa</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[460px]">
                        {rowDetails.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {rowDetails.map((detail) => (
                              <span
                                key={detail}
                                className="max-w-[220px] truncate rounded-md border border-border-default/70 bg-surface-subtle/60 px-2 py-1 text-[11px] font-medium text-text-secondary"
                                title={detail}
                              >
                                {detail}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">Aguardando dados da IA</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={cn('whitespace-nowrap', statusMeta.badgeClassName)}>
                              {statusMeta.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                'whitespace-nowrap border text-[11px]',
                                processo.pdfUrl
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-500',
                              )}
                            >
                              {processo.pdfUrl ? 'PDF pronto' : 'Sem PDF'}
                            </Badge>
                          </div>
                          <p className="whitespace-nowrap text-xs text-text-secondary">
                            Atualizado em {formatUpdatedAt(processo.updatedAt)}
                          </p>
                          {extractionIssue ? (
                            <p className="max-w-[220px] text-xs text-rose-700" title={processo.dadosCompletos?.extraction_job?.last_error_message}>
                              {extractionIssue}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Gerar documento"
                                aria-label={`Gerar documento para ${processLabel}`}
                                className="h-8 w-8 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                              >
                                <FilePenLine className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startDispatchGeneration([processo])}>
                                <FileText className="mr-2 h-4 w-4" />
                                Despacho de Liquidacao
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Visualizar detalhes"
                            className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => setDetailsProcesso(processo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Abrir processo no SUAP"
                            className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            onClick={() => window.open(processo.url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={processo.pdfUrl ? 'Atualizar PDF' : 'Baixar PDF'}
                            className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            disabled={isDownloading || processActionId !== null}
                            onClick={() => void handleDownloadPdfStage(processo, Boolean(processo.pdfUrl))}
                          >
                            <FileDown className={cn('h-4 w-4', isDownloading && 'animate-pulse')} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Extrair com PDFs individuais — piloto"
                            aria-label={`Extrair com PDFs individuais — piloto: ${processLabel}`}
                            className="h-8 w-8 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                            disabled={isExtractingIndividual || processActionId !== null}
                            onClick={() => void handleIndividualDocumentPilot(processo)}
                          >
                            <Sparkles className={cn('h-4 w-4', isExtractingIndividual && 'animate-pulse')} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title={processo.status === 'success' ? 'Refazer extração por IA' : 'Extrair com IA'}
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            disabled={!processo.pdfUrl || isExtractingAi || processActionId !== null}
                            onClick={() => void handleAiExtractionStage(processo, processo.status === 'success')}
                          >
                            <Sparkles className={cn('h-4 w-4', isExtractingAi && 'animate-pulse')} />
                          </Button>
                          {isConcluded ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Reabrir processo"
                              className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              disabled={reopeningProcessId === processo.id}
                              onClick={() => void handleReopenProcess(processo)}
                            >
                              <RefreshCw className={cn('h-4 w-4', reopeningProcessId === processo.id && 'animate-spin')} />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Concluir processo"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => handleOpenConclusaoDialog(processo)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!isLoading && !isError && visibleProcesses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center flex flex-col items-center justify-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum processo encontrado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou sincronize novos processos pela extensão do SUAP.
            </p>
            {(() => {
              const selectedCaixaObj = registeredCaixas.find(c => c.nome === caixaFilter);
              if (!selectedCaixaObj) return null;
              return (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const separator = selectedCaixaObj.url.includes('?') ? '&' : '?';
                    window.open(`${selectedCaixaObj.url}${separator}suap-auto-sync=true`, '_blank', 'noopener,noreferrer');
                  }}
                  className="mt-4 gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                >
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  Sincronizar caixa "{selectedCaixaObj.nome}" agora
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}


