import { ReactNode, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileDown,
  Landmark,
  RefreshCw,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  Inbox,
  FileText,
  Users,
  Send,
  ChevronDown,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { SuapConclusaoDialog } from '@/components/modals/SuapConclusaoDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useAuth } from '@/contexts/AuthContext';
import { suapExtensionGithubUrl } from '@/lib/suapExtension';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { SuapProcesso, SuapCaixa } from '@/types';
import { suapProcessosService } from '@/services/suapProcessos';
import { SuapSyncPanel } from '@/components/suap/SuapSyncPanel';

type StatusFilter = 'all' | 'active' | 'concluded' | 'pending' | 'error';

const isPendingStatus = (status: string) =>
  status === 'pending_extraction' || status === 'pdf_uploaded';

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
  const notaPrincipal = processo.dadosCompletos?.notas_fiscais?.[0];
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
    isCopyableValue(notaPrincipal?.numero),
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
      const status = processo.status.toLowerCase();
      const { hasExtractedInfo } = getProcessCompleteness(processo);
      const matchesSearch =
        normalizedSearch === '' ||
        processo.suapId.toLowerCase().includes(normalizedSearch) ||
        (processo.numProcesso || '').toLowerCase().includes(normalizedSearch) ||
        (processo.beneficiario || '').toLowerCase().includes(normalizedSearch) ||
        (processo.assunto || '').toLowerCase().includes(normalizedSearch) ||
        (processo.cpfCnpj || '').toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isConcluded) ||
        (statusFilter === 'concluded' && isConcluded) ||
        (statusFilter === 'pending' && isPendingStatus(status)) ||
        (statusFilter === 'error' && isErrorStatus(status));

      const matchesCaixa =
        caixaFilter === 'all' ||
        (processo.caixa && processo.caixa.toLowerCase().includes(caixaFilter.toLowerCase())) ||
        (caixaFilter === 'none' && !processo.caixa);

      const visibleInCurrentFilter = statusFilter === 'pending' ? true : hasExtractedInfo;

      return matchesSearch && matchesStatus && matchesCaixa && visibleInCurrentFilter;
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
  if (isProcessConcluded(processo)) {
    return {
      label: 'Concluído',
      badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentClassName: 'before:bg-emerald-500',
    };
  }

  const normalized = processo.status.toLowerCase();

  if (normalized === 'concluido') {
    return {
      label: 'Concluído',
      badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accentClassName: 'before:bg-emerald-500',
    };
  }

  if (normalized === 'success') {
    return {
      label: 'Extraído',
      badgeClassName: 'bg-sky-50 text-sky-700 border-sky-200',
      accentClassName: 'before:bg-sky-500',
    };
  }

  if (isPendingStatus(normalized)) {
    return {
      label: 'Pendente',
      badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      accentClassName: 'before:bg-amber-500',
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

export default function Suap() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [caixaFilter, setCaixaFilter] = useState<string>('all');
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [reopeningProcessId, setReopeningProcessId] = useState<string | null>(null);
  const [selectedProcesso, setSelectedProcesso] = useState<SuapProcesso | null>(null);
  const [isConclusaoDialogOpen, setIsConclusaoDialogOpen] = useState(false);

  // local login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // registered caixas states
  const [isCaixasDialogOpen, setIsCaixasDialogOpen] = useState(false);
  const [newCaixaNome, setNewCaixaNome] = useState('');
  const [newCaixaUrl, setNewCaixaUrl] = useState('');
  const [isAddingCaixa, setIsAddingCaixa] = useState(false);

  useEffect(() => {
    setSelectedProcesso(null);
    setIsConclusaoDialogOpen(false);
  }, [session?.user.id]);

  const {
    data: processos = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['suap-processos'],
    queryFn: suapProcessosService.getAll,
    enabled: !!session,
    refetchInterval: 30000,
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
      pending: getVisibleProcesses(processos, '', 'pending', caixaFilter).length,
      error: getVisibleProcesses(processos, '', 'error', caixaFilter).length,
      all: getVisibleProcesses(processos, '', 'all', caixaFilter).length,
    }),
    [processos, caixaFilter],
  );

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

  const handleOpenPdf = async (processo: SuapProcesso) => {
    if (!processo.pdfUrl) {
      toast.info('Este processo ainda não possui PDF sincronizado.');
      return;
    }

    setOpeningPdfId(processo.id);
    try {
      const signedUrl = await suapProcessosService.getPdfSignedUrl(processo.pdfUrl);
      if (!signedUrl) {
        toast.error('Não foi possível gerar o link do PDF.');
        return;
      }

      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      console.error(openError);
      toast.error('Falha ao abrir o PDF sincronizado.');
    } finally {
      setOpeningPdfId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        Espelho dos processos sincronizados no SUAP.
      </HeaderSubtitle>

      <HeaderActions>
        <div className="flex items-center gap-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-border-default bg-white text-slate-700 shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
                >
                  <RefreshCw className="h-4 w-4 text-emerald-600" />
                  <span>Sincronizar caixa...</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-ui">
                  Abrir caixa no SUAP:
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {registeredCaixas.length === 0 ? (
                  <div className="py-3 px-2 text-center text-xs text-muted-foreground font-ui">
                    Nenhuma caixa cadastrada
                  </div>
                ) : (
                  registeredCaixas.map((caixa) => {
                    const normalized = caixa.nome.toLowerCase();
                    let IconComponent = FileText;
                    let colorClass = 'text-slate-500';
                    if (normalized.includes('entrada') || normalized.includes('recebido')) {
                      IconComponent = Inbox;
                      colorClass = 'text-emerald-600';
                    } else if (normalized.includes('meus') || normalized.includes('criado')) {
                      IconComponent = FileText;
                      colorClass = 'text-sky-600';
                    } else if (normalized.includes('interessado')) {
                      IconComponent = Users;
                      colorClass = 'text-violet-600';
                    } else if (normalized.includes('aguardando') || normalized.includes('envio') || normalized.includes('saida')) {
                      IconComponent = Send;
                      colorClass = 'text-amber-600';
                    }
                    return (
                      <DropdownMenuItem
                        key={caixa.id}
                        onClick={() => {
                          const separator = caixa.url.includes('?') ? '&' : '?';
                          window.open(`${caixa.url}${separator}suap-auto-sync=true`, '_blank', 'noopener,noreferrer');
                        }}
                        className="flex items-center gap-2 cursor-pointer py-2 text-sm"
                      >
                        <IconComponent className={cn('h-4 w-4', colorClass)} />
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary text-xs">{caixa.nome}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={caixa.url}>
                            {caixa.url}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsCaixasDialogOpen(true)}
                  className="flex items-center gap-2 cursor-pointer py-2 text-sm font-semibold text-primary hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" />
                  <span>Gerenciar caixas...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(suapExtensionGithubUrl, '_blank', 'noopener,noreferrer')}
            className="h-space-9 gap-space-2 border-border-default bg-white text-slate-700 shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
          >
            <ExternalLink className="h-4 w-4" />
            Baixar extensão
          </Button>
          {session ? (
            <>
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="gap-2 h-9 text-sm"
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                {isFetching ? 'Atualizando...' : 'Atualizar'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const { error: signOutError } = await supabase.auth.signOut();
                  if (signOutError) {
                    toast.error('Erro ao sair.');
                  } else {
                    toast.success('Sessão encerrada.');
                  }
                }}
                className="h-9 text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Sair
              </Button>
            </>
          ) : null}
        </div>
      </HeaderActions>

      <SuapSyncPanel onSyncComplete={() => void refetch()} />

      {session ? (
        <Card className="border-emerald-100 bg-emerald-50/20 overflow-hidden shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-ui text-sm font-semibold text-emerald-950">Sincronização de Processos do SUAP</h4>
                <p className="text-xs text-emerald-800/90 mt-0.5 leading-5">
                  Para importar ou atualizar processos de uma caixa específica, clique em <strong>"Sincronizar caixa..."</strong> no menu acima, faça login no SUAP se necessário, e utilize a extensão instalada no seu navegador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

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

      {session ? (
        <Card className="border-emerald-200/50 bg-emerald-50/30 shadow-sm max-w-full mb-6">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900 text-sm">Conectado ao Espelho SUAP</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Sincronização configurada para o usuário <strong>{session.user.email}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-emerald-700 bg-white/60 px-3 py-2 rounded-lg border border-emerald-100">
              <RefreshCw className="h-4 w-4 text-emerald-500" />
              <span>A extensão sincroniza automaticamente as caixas ativas a cada hora.</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-lg border border-border-default/60 bg-surface-card p-1 shadow-sm lg:inline-grid lg:w-auto lg:grid-cols-5">
                  {([
                    ['active', 'Em andamento'],
                    ['concluded', 'Concluídos'],
                    ['pending', 'Pendentes'],
                    ['error', 'Erros'],
                    ['all', 'Todos'],
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

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          : visibleProcesses.map((processo) => {
              const statusMeta = getStatusMeta(processo);
              const workflow = getProcessWorkflow(processo);
              const analiseLiquidacao = workflow?.analiseLiquidacao;
              const analiseMeta = analiseLiquidacao ? getAnaliseMeta(analiseLiquidacao.statusGeral) : null;
              const AnaliseIcon = analiseMeta?.icon;
              const notasFiscais = processo.dadosCompletos?.notas_fiscais || [];
              const notaPrincipal = notasFiscais[0];
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

              return (
                <Card
                  key={processo.id}
                  className={cn(
                    'group relative overflow-hidden border-border-default/70 bg-surface-card shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-card before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1',
                    statusMeta.accentClassName,
                  )}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/8 blur-3xl transition-opacity duration-200 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-surface-subtle blur-3xl" />
                  <CardHeader className="gap-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <CardTitle className="font-ui text-lg tracking-tight text-text-primary">
                            {processo.suapId || processo.numProcesso || 'Processo sem SUAP ID'}
                          </CardTitle>
                          <CopyAction
                            value={processo.suapId}
                            message="SUAP ID copiado."
                            className="mt-0.5 h-7 w-7 shrink-0 rounded-lg"
                          />
                        </div>
                        {processo.caixa && (
                          <div className="pt-1 flex">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-xs transition-colors',
                                getCaixaBadgeColor(processo.caixa)
                              )}
                            >
                              {processo.caixa}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {isProcessConcluded(processo) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 border-border-default bg-surface-card text-text-primary"
                          disabled={reopeningProcessId === processo.id}
                          onClick={() => void handleReopenProcess(processo)}
                        >
                          <RefreshCw className={cn('h-4 w-4', reopeningProcessId === processo.id && 'animate-spin')} />
                          {reopeningProcessId === processo.id ? 'Reabrindo...' : 'Reabrir'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2 border-border-default bg-surface-card text-text-primary"
                          onClick={() => handleOpenConclusaoDialog(processo)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Concluir
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 gap-2 border-border-default bg-surface-card text-text-primary"
                        disabled={!processo.pdfUrl || openingPdfId === processo.id}
                        onClick={() => void handleOpenPdf(processo)}
                      >
                        <FileDown className="h-4 w-4" />
                        {openingPdfId === processo.id ? 'Abrindo...' : 'PDF'}
                      </Button>

                      <div className="flex h-11 items-center gap-2 rounded-xl border border-border-default bg-surface-subtle/40 px-3 font-ui text-xs text-text-secondary shadow-xs">
                        <span className="font-semibold uppercase tracking-[0.12em] text-text-muted">Processo</span>
                        <span className="font-mono font-semibold text-text-primary">{processo.numProcesso || '-'}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            title="Abrir processo no SUAP"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-default/70 bg-surface-card text-text-secondary transition hover:border-border-default hover:text-text-primary"
                            onClick={() => window.open(processo.url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <CopyAction
                            value={processo.numProcesso}
                            message="Número do processo copiado."
                            className="h-7 w-7 border-border-default/70 bg-surface-card shadow-none"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoPanel icon={<Building2 className="h-3.5 w-3.5" />} label="Beneficiário" tone="cyan">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-ui text-sm font-semibold leading-6 text-text-primary">
                              {processo.beneficiario || 'Não extraído'}
                          </p>
                            <CopyAction value={processo.beneficiario} message="Beneficiário copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-default/70 pt-3 font-ui text-xs text-text-secondary">
                          <span className="font-mono">{processo.cpfCnpj || 'Sem documento'}</span>
                          <CopyAction value={processo.cpfCnpj} message="Documento copiado." />
                        </div>
                      </InfoPanel>

                      <InfoPanel icon={<Wallet className="h-3.5 w-3.5" />} label="Valor e NS" tone="blue">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-ui text-lg font-black tracking-tight text-sky-700">{valorLiquido}</p>
                          </div>
                          <CopyAction value={valorLiquido} message="Valor copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-sky-100 pt-3 font-ui text-sm text-text-primary">
                          <span>NS final: <span className="font-mono font-semibold">{nsNumero}</span></span>
                          <CopyAction value={nsNumero} message="NS copiada." />
                        </div>
                      </InfoPanel>
                    </div>

                    <InfoPanel icon={<ReceiptText className="h-3.5 w-3.5" />} label="Assunto" tone="amber">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-ui text-sm leading-6 text-text-primary">
                          {processo.assunto || 'Sem assunto extraído'}
                        </p>
                        <CopyAction value={processo.assunto} message="Assunto copiado." />
                      </div>
                    </InfoPanel>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoPanel icon={<Landmark className="h-3.5 w-3.5" />} label="Contrato e NF" tone="violet">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-ui text-xs uppercase tracking-[0.12em] text-text-muted">Contrato</p>
                            <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{contrato}</p>
                          </div>
                          <CopyAction value={contrato} message="Contrato copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-violet-100 pt-3">
                          <div className="font-ui text-sm text-text-secondary">
                            <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Nota Fiscal</p>
                            <p className="mt-1 font-semibold text-violet-700">{notaPrincipal?.numero || '-'}</p>
                            <p className="mt-1 text-xs text-text-secondary">{notaPrincipal?.data_emissao || 'Sem data de emissão'}</p>
                          </div>
                          <div className="flex gap-2">
                            <CopyAction value={notaPrincipal?.numero} message="Número da nota fiscal copiado." />
                            <CopyAction value={notaPrincipal?.data_emissao} message="Data de emissão copiada." />
                          </div>
                        </div>
                      </InfoPanel>

                      <InfoPanel icon={<Building2 className="h-3.5 w-3.5" />} label="Dados Bancários" tone="emerald">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-ui text-xs uppercase tracking-[0.12em] text-text-muted">Banco</p>
                            <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{dadosBancarios?.banco || 'Sem banco extraído'}</p>
                          </div>
                          <CopyAction value={dadosBancarios?.banco} message="Banco copiado." />
                        </div>
                        <div className="mt-3 grid gap-2 border-t border-emerald-100 pt-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                            <div>
                              <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-text-muted">Agência</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{dadosBancarios?.agencia || '-'}</p>
                            </div>
                            <CopyAction value={dadosBancarios?.agencia} message="Agência copiada." className="h-7 w-7" />
                          </div>

                          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                            <div>
                              <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-text-muted">Conta</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-text-primary">{dadosBancarios?.conta || '-'}</p>
                            </div>
                            <CopyAction value={dadosBancarios?.conta} message="Conta copiada." className="h-7 w-7" />
                          </div>
                        </div>
                      </InfoPanel>
                    </div>

                    <InfoPanel icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Retenções e Empenhos" tone="slate">
                      {retencoes?.optante_simples_nacional ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                          Optante pelo Simples Nacional
                        </Badge>
                      ) : null}

                      {retencoesVisiveis.length > 0 ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {retencoesVisiveis.map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-center justify-between rounded-xl border border-dashed border-border-default/90 bg-surface-subtle/40 px-3 py-2 font-ui text-sm"
                            >
                              <span className="text-text-secondary">{label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary">{value}</span>
                                <CopyAction value={value} message={`${label} copiado.`} className="h-7 w-7" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sem retenções detalhadas extraídas.</p>
                      )}

                      <div className="mt-4 border-t border-border-default/70 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-ui text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                            Empenhos
                          </p>
                          <CopyAction value={listaEmpenhos.length ? listaEmpenhos.join(', ') : undefined} message="Lista de empenhos copiada." />
                        </div>
                        {listaEmpenhos.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {listaEmpenhos.map((empenho) => (
                              <div
                                key={empenho}
                                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-subtle/40 px-3 py-1.5 text-xs shadow-sm"
                              >
                                <span className="font-mono font-semibold text-text-primary">{empenho}</span>
                                <CopyAction value={empenho} message="Empenho copiado." className="h-6 w-6 border-0 bg-transparent shadow-none" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Nenhum empenho associado.</p>
                        )}
                      </div>
                    </InfoPanel>

                    {workflow?.concluido ? (
                      <div className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98))] p-4 shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
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
                              {workflow.concluidoEm
                                ? `Concluído em ${formatUpdatedAt(new Date(workflow.concluidoEm))}`
                                : 'Processo concluído sem data registrada.'}
                              {workflow.concluidoPor ? ` por ${workflow.concluidoPor}` : ''}
                            </p>
                          </div>

                          {analiseMeta && AnaliseIcon ? (
                            <Badge variant="outline" className={analiseMeta.badgeClassName}>
                              <AnaliseIcon className="mr-1 h-3.5 w-3.5" />
                              {analiseMeta.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-slate-200 bg-white/80 text-slate-600">
                              Sem análise de liquidação
                            </Badge>
                          )}
                        </div>

                        {workflow.solicitarAnaliseLiquidacao ? (
                          <div className="mt-4 space-y-3 border-t border-emerald-200/70 pt-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span>Análise da liquidação solicitada</span>
                              {workflow.arquivosSiafi?.length ? (
                                <>
                                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                                  <span>{workflow.arquivosSiafi.length} print(s) enviados</span>
                                </>
                              ) : null}
                            </div>

                            {analiseLiquidacao ? (
                              <>
                                <p className="text-sm leading-6 text-slate-700">{analiseLiquidacao.resumo}</p>

                                {analiseLiquidacao.itens.length > 0 ? (
                                  <div className="grid gap-2">
                                    {analiseLiquidacao.itens.slice(0, 4).map((item, index) => (
                                      <div
                                        key={`${item.campo}-${index}`}
                                        className={cn(
                                          'rounded-xl border px-3 py-2 text-sm',
                                          item.status === 'ok'
                                            ? 'border-emerald-200/70 bg-emerald-50/80'
                                            : item.status === 'error'
                                              ? 'border-rose-200/70 bg-rose-50/80'
                                              : 'border-amber-200/70 bg-amber-50/80',
                                        )}
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-semibold text-slate-900">{item.campo}</span>
                                          <Badge variant="outline" className="border-white/70 bg-white/70 text-slate-600">
                                            {item.status === 'ok'
                                              ? 'OK'
                                              : item.status === 'error'
                                                ? 'Erro'
                                                : 'Alerta'}
                                          </Badge>
                                        </div>
                                        <p className="mt-1 text-slate-700">{item.observacao}</p>
                                        {item.esperado || item.encontrado ? (
                                          <p className="mt-1 text-xs text-slate-500">
                                            {item.esperado ? `Esperado: ${item.esperado}. ` : ''}
                                            {item.encontrado ? `Encontrado: ${item.encontrado}.` : ''}
                                          </p>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {analiseLiquidacao.recomendacao ? (
                                  <p className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-700">
                                    <strong>Recomendação:</strong> {analiseLiquidacao.recomendacao}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-sm text-slate-600">
                                A análise foi solicitada, mas nenhum resultado foi salvo ainda.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="mt-4 border-t border-emerald-200/70 pt-4 text-sm text-slate-600">
                            O processo foi concluído sem solicitar análise automática da liquidação.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
      </div>

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


