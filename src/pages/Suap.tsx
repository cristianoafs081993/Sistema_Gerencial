import { ReactNode, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Session } from '@supabase/supabase-js';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { SuapProcesso } from '@/types';
import { suapProcessosService } from '@/services/suapProcessos';

type StatusFilter = 'all' | 'active' | 'concluded' | 'pending' | 'error';

const isPendingStatus = (status: string) =>
  status === 'pending_extraction' || status === 'pdf_uploaded';

const isErrorStatus = (status: string) =>
  status.includes('error') || status.includes('fail');

const getVisibleProcesses = (processos: SuapProcesso[], searchTerm: string, statusFilter: StatusFilter) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  return processos.filter((processo) => {
    const status = processo.status.toLowerCase();
    const matchesSearch =
      normalizedSearch === '' ||
      processo.suapId.toLowerCase().includes(normalizedSearch) ||
      (processo.numProcesso || '').toLowerCase().includes(normalizedSearch) ||
      (processo.beneficiario || '').toLowerCase().includes(normalizedSearch) ||
      (processo.assunto || '').toLowerCase().includes(normalizedSearch) ||
      (processo.cpfCnpj || '').toLowerCase().includes(normalizedSearch);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && status !== 'concluido') ||
      (statusFilter === 'concluded' && status === 'concluido') ||
      (statusFilter === 'pending' && isPendingStatus(status)) ||
      (statusFilter === 'error' && isErrorStatus(status));

    return matchesSearch && matchesStatus;
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

const isCopyableValue = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '-' && normalized !== 'null' && normalized !== 'undefined';
};

const getStatusMeta = (status: string) => {
  const normalized = status.toLowerCase();

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
    label: status,
    badgeClassName: 'bg-slate-100 text-slate-700 border-slate-200',
    accentClassName: 'before:bg-slate-400',
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
  className,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export default function Suap() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
    enabled: authChecked && !!session,
    refetchInterval: 30000,
  });

  const visibleProcesses = getVisibleProcesses(processos, searchTerm, statusFilter);
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

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Informe e-mail e senha do Supabase usados na extensão.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      toast.success('Login realizado. Carregando processos do SUAP...');
      setPassword('');
    } catch (loginError) {
      console.error(loginError);
      toast.error(loginError instanceof Error ? loginError.message : 'Falha ao autenticar no Supabase.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
      toast.success('Sessão SUAP encerrada.');
    } catch (logoutError) {
      console.error(logoutError);
      toast.error(logoutError instanceof Error ? logoutError.message : 'Falha ao encerrar a sessão.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        Espelho dos processos sincronizados pela extensão no SUAP.
      </HeaderSubtitle>

      <HeaderActions>
        <div className="flex items-center gap-2">
          {session?.user?.email ? (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {session.user.email}
            </Badge>
          ) : null}

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
                onClick={() => void handleLogout()}
                disabled={isAuthLoading}
                className="h-9 text-sm"
              >
                Sair
              </Button>
            </>
          ) : null}
        </div>
      </HeaderActions>

      {!authChecked ? (
        <Card className="overflow-hidden">
          <CardContent className="py-10">
            <div className="space-y-4">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {authChecked && !session ? (
        <Card className="border-border-default/70 shadow-sm">
          <CardHeader>
            <CardTitle>Entrar para ver o espelho do SUAP</CardTitle>
            <CardDescription>
              A extensão sincroniza em um espaço autenticado no Supabase. Use aqui o mesmo login da extensão para ver os seus processos.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">E-mail Supabase</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@exemplo.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleLogin();
                  }
                }}
              />
            </div>
            <Button onClick={() => void handleLogin()} disabled={isAuthLoading} className="h-10">
              {isAuthLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por processo, beneficiário, assunto ou documento..."
                  className="pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {([
                  ['active', 'Em andamento'],
                  ['concluded', 'Concluídos'],
                  ['pending', 'Pendentes'],
                  ['error', 'Erros'],
                  ['all', 'Todos'],
                ] as Array<[StatusFilter, string]>).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={statusFilter === value ? 'default' : 'outline'}
                    className="h-9"
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{visibleProcesses.length} processos visíveis</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>
                Última sincronização: {processos[0]?.updatedAt ? formatUpdatedAt(processos[0].updatedAt) : 'sem registros'}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Atualização automática a cada 30 segundos</span>
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
              const statusMeta = getStatusMeta(processo.status);
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
              const nsNumero = processo.dadosCompletos?.ns_numero || '-';
              const listaEmpenhos = processo.dadosCompletos?.empenhos || [];

              return (
                <Card
                  key={processo.id}
                  className={cn(
                    'group relative overflow-hidden border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(15,23,42,0.13)] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1',
                    statusMeta.accentClassName,
                  )}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-300/15 blur-3xl transition-opacity duration-200 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-violet-300/10 blur-3xl" />
                  <CardHeader className="gap-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <CardTitle className="text-lg tracking-tight text-slate-900">
                            {processo.numProcesso || `Processo ${processo.suapId}`}
                          </CardTitle>
                          <CopyAction
                            value={processo.suapId}
                            message="SUAP ID copiado."
                            className="mt-0.5 h-7 w-7 shrink-0 rounded-lg"
                          />
                        </div>
                      </div>

                      <Badge variant="outline" className={statusMeta.badgeClassName}>
                        {statusMeta.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 gap-2 border-slate-200 bg-white/90"
                        onClick={() => window.open(processo.url, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir no SUAP
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-11 gap-2 border-slate-200 bg-white/90"
                        disabled={!processo.pdfUrl || openingPdfId === processo.id}
                        onClick={() => void handleOpenPdf(processo)}
                      >
                        <FileDown className="h-4 w-4" />
                        {openingPdfId === processo.id ? 'Abrindo...' : 'PDF'}
                      </Button>

                      <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs text-slate-600 shadow-sm">
                        <span className="font-semibold uppercase tracking-[0.12em] text-slate-400">Processo</span>
                        <span className="font-mono font-semibold text-slate-800">{processo.numProcesso || '-'}</span>
                        <CopyAction
                          value={processo.numProcesso}
                          message="Número do processo copiado."
                          className="h-6 w-6 border-0 shadow-none"
                        />
                      </div>

                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Beneficiário
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-6 text-slate-900">
                              {processo.beneficiario || 'Não extraído'}
                          </p>
                            <CopyAction value={processo.beneficiario} message="Beneficiário copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-500">
                          <span className="font-mono">{processo.cpfCnpj || 'Sem documento'}</span>
                          <CopyAction value={processo.cpfCnpj} message="Documento copiado." />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <Wallet className="h-3.5 w-3.5" />
                          Valor e NS
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-black tracking-tight text-slate-900">{valorLiquido}</p>
                          </div>
                          <CopyAction value={valorLiquido} message="Valor copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3 text-sm text-slate-700">
                          <span>NS final: <span className="font-mono font-semibold">{nsNumero}</span></span>
                          <CopyAction value={nsNumero} message="NS copiada." />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <ReceiptText className="h-3.5 w-3.5" />
                        Assunto
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-6 text-slate-800">
                          {processo.assunto || 'Sem assunto extraído'}
                        </p>
                        <CopyAction value={processo.assunto} message="Assunto copiado." />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <Landmark className="h-3.5 w-3.5" />
                          Contrato e NF
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Contrato</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{contrato}</p>
                          </div>
                          <CopyAction value={contrato} message="Contrato copiado." />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
                          <div className="text-sm text-slate-700">
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Nota Fiscal</p>
                            <p className="mt-1 font-semibold text-slate-900">{notaPrincipal?.numero || '-'}</p>
                            <p className="mt-1 text-xs text-slate-500">{notaPrincipal?.data_emissao || 'Sem data de emissão'}</p>
                          </div>
                          <div className="flex gap-2">
                            <CopyAction value={notaPrincipal?.numero} message="Número da nota fiscal copiado." />
                            <CopyAction value={notaPrincipal?.data_emissao} message="Data de emissão copiada." />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          Dados Bancários
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Banco</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{dadosBancarios?.banco || 'Sem banco extraído'}</p>
                          </div>
                          <CopyAction value={dadosBancarios?.banco} message="Banco copiado." />
                        </div>
                        <div className="mt-3 grid gap-2 border-t border-slate-200/80 pt-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-2 border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Agência</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{dadosBancarios?.agencia || '-'}</p>
                            </div>
                            <CopyAction value={dadosBancarios?.agencia} message="Agência copiada." className="h-7 w-7" />
                          </div>

                          <div className="flex items-center justify-between gap-2 border border-slate-200/70 bg-slate-50/80 px-3 py-2">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Conta</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{dadosBancarios?.conta || '-'}</p>
                            </div>
                            <CopyAction value={dadosBancarios?.conta} message="Conta copiada." className="h-7 w-7" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.95))] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Retenções e Empenhos
                      </div>

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
                              className="flex items-center justify-between border border-dashed border-slate-200/90 bg-slate-50/70 px-3 py-2 text-sm"
                            >
                              <span className="text-slate-500">{label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{value}</span>
                                <CopyAction value={value} message={`${label} copiado.`} className="h-7 w-7" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Sem retenções detalhadas extraídas.</p>
                      )}

                      <div className="mt-4 border-t border-slate-200/80 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Empenhos
                          </p>
                          <CopyAction value={listaEmpenhos.length ? listaEmpenhos.join(', ') : undefined} message="Lista de empenhos copiada." />
                        </div>
                        {listaEmpenhos.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {listaEmpenhos.map((empenho) => (
                              <div
                                key={empenho}
                                className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs shadow-sm"
                              >
                                <span className="font-mono font-semibold text-slate-800">{empenho}</span>
                                <CopyAction value={empenho} message="Empenho copiado." className="h-6 w-6 border-0 bg-transparent shadow-none" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">Nenhum empenho associado.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {!isLoading && !isError && visibleProcesses.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum processo encontrado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajuste os filtros ou sincronize novos processos pela extensão do SUAP.
            </p>
          </CardContent>
        </Card>
      ) : null}
        </>
      ) : null}
    </div>
  );
}


