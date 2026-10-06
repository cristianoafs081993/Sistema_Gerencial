import { useMemo, useState, type ReactNode } from 'react';
import {
  Eye,
  Layers,
  Wallet,
  CheckCircle2,
  FileText,
  Search,
  PiggyBank,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AtividadeDialog } from '@/components/modals/AtividadeDialog';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { formatCurrency } from '@/lib/utils';
import { extractPlanoInternoCode, matchEmpenhosToAtividades } from '@/utils/atividadeEmpenhoMatching';
import type { Atividade, Empenho } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { useOptionalAuth } from '@/contexts/AuthContext';
import { getSuapPlanUnitForCampus } from '@/lib/suapPlanUnits';
import { suapRdService, type RdLink } from '@/services/suapRdService';
import { SuapRdCaptureNotice } from '@/components/suap/SuapRdCaptureNotice';

const NAO_ASSOCIADOS_KEY = '__nao_associados__';

type EmpenhosListaPopoverProps = {
  titulo: string;
  empenhos: Empenho[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (empenho: Empenho) => void;
  triggerClassName?: string;
  nota?: string;
  children: ReactNode;
};

function EmpenhosListaPopover({ titulo, empenhos, open, onOpenChange, onSelect, triggerClassName, nota, children }: EmpenhosListaPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-primary underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none ${triggerClassName ?? ''}`}
          title={titulo}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border-default/60 px-3 py-2">
          <p className="text-xs font-semibold text-text-primary">{titulo}</p>
          {nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{nota}</p>}
        </div>
        <ul className="max-h-64 overflow-y-auto py-1" aria-label={titulo}>
          {[...empenhos]
            .sort((left, right) => (right.valor || 0) - (left.valor || 0))
            .map((empenho) => (
              <li key={empenho.id || empenho.numero}>
                <button
                  type="button"
                  onClick={() => onSelect(empenho)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-text-primary">{empenho.numero}</div>
                    {empenho.favorecidoNome && (
                      <div className="truncate text-[11px] text-muted-foreground" title={empenho.favorecidoNome}>
                        {empenho.favorecidoNome}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-text-primary">{formatCurrency(empenho.valor || 0)}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export interface DashboardOrigemAtividadesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem: string | null;
  atividades: Atividade[];
  empenhos?: Empenho[];
  onSuccessAtividade?: () => void;
}

export function DashboardOrigemAtividadesModal({
  open,
  onOpenChange,
  origem,
  atividades = [],
  empenhos = [],
  onSuccessAtividade,
}: DashboardOrigemAtividadesModalProps) {
  const auth = useOptionalAuth();
  const org = auth?.userOrg?.id;
  const campus = auth?.userCampus.codigo ?? '158366';
  const unit = getSuapPlanUnitForCampus(campus).value;
  const rdQuery = useQuery({ queryKey: ['suap-rds', 'links', org, campus, unit],
    queryFn: () => suapRdService.read<RdLink>('atividade_empenho_vinculos', org!, campus, unit),
    enabled: open && !!org, staleTime: 60000, retry: false });
  const [selectedAtividadeForDialog, setSelectedAtividadeForDialog] = useState<Atividade | null>(null);
  const [isAtividadeDialogOpen, setIsAtividadeDialogOpen] = useState(false);
  const [empenhosPopoverAtividadeId, setEmpenhosPopoverAtividadeId] = useState<string | null>(null);
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [apenasComSaldo, setApenasComSaldo] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra as atividades pertencentes à origem selecionada
  const atividadesDaOrigem = useMemo(() => {
    if (!origem) return [];
    return atividades.filter((a) => (a.origemRecurso || 'Sem origem') === origem);
  }, [atividades, origem]);

  // Empenhos totais da origem
  const empenhosDaOrigem = useMemo(() => {
    if (!origem) return [];
    return empenhos.filter((e) => (e.origemRecurso || 'Sem origem') === origem && e.status !== 'cancelado');
  }, [empenhos, origem]);

  // Resolve before filtering by origin so classification differences cannot reassign official links.
  const { empenhosPorAtividadeMap, unmatchedEmpenhos } = useMemo(() => {
    if (!origem) return { empenhosPorAtividadeMap: new Map(), unmatchedEmpenhos: [] as Empenho[] };
    const resolved = matchEmpenhosToAtividades(atividades, empenhos, rdQuery.data ?? []);
    return { empenhosPorAtividadeMap: resolved.empenhosPorAtividadeMap,
      unmatchedEmpenhos: resolved.unmatchedEmpenhos.filter(e => empenhosDaOrigem.some(item => item.id === e.id)) };
  }, [atividades, empenhos, rdQuery.data, empenhosDaOrigem, origem]);

  const totalEmpenhadoOrigem = useMemo(
    () => empenhosDaOrigem.reduce((total, empenho) => total + (empenho.valor || 0), 0),
    [empenhosDaOrigem],
  );
  const totalNaoAssociado = useMemo(
    () => unmatchedEmpenhos.reduce((total, empenho) => total + (empenho.valor || 0), 0),
    [unmatchedEmpenhos],
  );

  // Enriquece as atividades com execução e com o saldo oficial do Plano 8 do SUAP.
  // O fallback preserva atividades legadas que ainda não possuem o campo sincronizado.
  const enrichedAtividades = useMemo(() => {
    return atividadesDaOrigem.map((atividade) => {
      const empInfo = empenhosPorAtividadeMap.get(atividade.id) || { total: 0, count: 0, empenhos: [] };
      const planejado = atividade.valorTotal || 0;
      const empenhadoIdentificado = empInfo.total;
      const saldo = atividade.saldoDisponivel ?? (planejado - empenhadoIdentificado);
      // Com o saldo oficial do SUAP, o empenhado e o que o SUAP ja consumiu da atividade
      // (planejado - saldo), para que Planejado - Empenhado = Saldo nos cards e nas linhas.
      const empenhado = atividade.saldoDisponivel != null ? Math.max(0, planejado - saldo) : empenhadoIdentificado;
      const percentual = planejado > 0 ? (empenhado / planejado) * 100 : 0;

      return {
        atividade,
        planejado,
        empenhado,
        saldo,
        percentual,
        empenhadoIdentificado,
        qtdEmpenhos: empInfo.count,
        empenhos: empInfo.empenhos,
      };
    });
  }, [atividadesDaOrigem, empenhosPorAtividadeMap]);

  // Métricas agregadas da origem inteira
  const metricasOrigem = useMemo(() => ({
    totalAtividades: enrichedAtividades.length,
  }), [enrichedAtividades]);

  // Lista filtrada e ordenada (maior saldo primeiro)
  const filteredAtividades = useMemo(() => {
    return enrichedAtividades
      .filter((item) => {
        if (apenasComSaldo && item.saldo <= 0) {
          return false;
        }

        if (!searchTerm.trim()) return true;
        const search = searchTerm.trim().toLowerCase();
        const matchCodigo = (item.atividade.atividade || '').toLowerCase().includes(search);
        const matchDesc = (item.atividade.descricao || '').toLowerCase().includes(search);
        const matchDim = (item.atividade.dimensao || '').toLowerCase().includes(search);
        const matchComp = (item.atividade.componenteFuncional || '').toLowerCase().includes(search);
        const matchPi = (item.atividade.planoInterno || '').toLowerCase().includes(search);
        const matchNd = (item.atividade.naturezaDespesa || '').toLowerCase().includes(search);

        return matchCodigo || matchDesc || matchDim || matchComp || matchPi || matchNd;
      })
      .sort((a, b) => {
        if (b.saldo !== a.saldo) {
          return b.saldo - a.saldo;
        }
        return (a.atividade.atividade || '').localeCompare(b.atividade.atividade || '');
      });
  }, [enrichedAtividades, apenasComSaldo, searchTerm]);

  // Totais dos itens exibidos
  const totaisVisiveis = useMemo(() => {
    return filteredAtividades.reduce(
      (acc, item) => ({
        planejado: acc.planejado + item.planejado,
        empenhado: acc.empenhado + item.empenhado,
        saldo: acc.saldo + item.saldo,
      }),
      { planejado: 0, empenhado: 0, saldo: 0 },
    );
  }, [filteredAtividades]);

  const handleOpenAtividadeDetails = (atv: Atividade) => {
    setSelectedAtividadeForDialog(atv);
    setIsAtividadeDialogOpen(true);
  };

  const handleOpenEmpenhoDetails = (empenho: Empenho) => {
    setEmpenhosPopoverAtividadeId(null);
    setSelectedEmpenhoForDialog(empenho);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
          <p className="px-6 pt-3 text-xs text-muted-foreground">Empenhos identificados por vínculo manual ou pelas RDs oficiais do SUAP. Pendências permanecem sem associação.</p>
          {rdQuery.isError && <p className="px-6 text-xs text-status-warning" role="alert">Não foi possível consultar os vínculos oficiais das RDs.</p>}
          {/* Header */}
          <DialogHeader className="border-b border-border-default/60 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-semibold text-text-primary">
                      Atividades com Saldo da Origem
                    </DialogTitle>
                    <Badge variant="brand" className="font-mono text-xs font-semibold">
                      Origem / PTRES: {origem || 'Sem origem'}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Detalhamento do saldo disponível e execução orçamentária por atividade planejada
                  </DialogDescription>
                </div>
              </div>
            </div>

            {!rdQuery.isLoading && !rdQuery.isError && !rdQuery.data?.length && <SuapRdCaptureNotice campus={campus} unit={unit} enabled={open} />}
            {/* KPI Cards da selecao atual */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Atividades exibidas</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-text-primary">
                    {filteredAtividades.length}
                  </span>
                  <span className="text-xs text-text-muted">
                    de {metricasOrigem.totalAtividades}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs font-medium text-status-success">
                  <span>Saldo Disponível (SUAP)</span>
                  <Wallet className="h-3.5 w-3.5 text-status-success" />
                </div>
                <div className="mt-1 text-lg font-bold text-status-success">
                  {formatCurrency(totaisVisiveis.saldo)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Planejado</span>
                  <PiggyBank className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(totaisVisiveis.planejado)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Empenhado (SUAP)</span>
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(totaisVisiveis.empenhado)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted" data-testid="origem-empenhos-resumo">
              <span>
                Empenhado na origem (SIAFI):{' '}
                <strong className="text-text-primary">{formatCurrency(totalEmpenhadoOrigem)}</strong> em {empenhosDaOrigem.length}{' '}
                {empenhosDaOrigem.length === 1 ? 'empenho' : 'empenhos'}
              </span>
              {unmatchedEmpenhos.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <EmpenhosListaPopover
                    titulo="Empenhos sem atividade identificada"
                    empenhos={unmatchedEmpenhos}
                    open={empenhosPopoverAtividadeId === NAO_ASSOCIADOS_KEY}
                    onOpenChange={(isOpen) => setEmpenhosPopoverAtividadeId(isOpen ? NAO_ASSOCIADOS_KEY : null)}
                    onSelect={handleOpenEmpenhoDetails}
                    triggerClassName="text-xs"
                  >
                    {formatCurrency(totalNaoAssociado)} em {unmatchedEmpenhos.length}{' '}
                    {unmatchedEmpenhos.length === 1 ? 'empenho' : 'empenhos'} sem atividade identificada
                  </EmpenhosListaPopover>
                </>
              )}
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar atividade, descrição, PI, componente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApenasComSaldo((prev) => !prev)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all border ${
                    apenasComSaldo
                      ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-border-default bg-background text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${apenasComSaldo ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {apenasComSaldo ? 'Apenas com saldo' : 'Todas as atividades'}
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* Table Body Container */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-100/90 shadow-sm backdrop-blur-sm dark:bg-slate-800/90">
                <TableRow className="border-b border-border-default/60 hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Atividade
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Descrição / Objeto
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Dimensão / Componente
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Plano Interno / ND
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Planejado
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Empenhado
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Saldo
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Execução
                  </TableHead>
                  <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAtividades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <span className="text-sm">
                          {apenasComSaldo
                            ? 'Nenhuma atividade com saldo remanescente nesta origem.'
                            : 'Nenhuma atividade encontrada nesta origem com os filtros atuais.'}
                        </span>
                        {apenasComSaldo && metricasOrigem.totalAtividades > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setApenasComSaldo(false)}
                            className="text-xs text-primary underline hover:bg-transparent"
                          >
                            Ver todas as {metricasOrigem.totalAtividades} atividades
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAtividades.map(({ atividade, planejado, empenhado, empenhadoIdentificado, saldo, percentual, qtdEmpenhos, empenhos: empenhosDaAtividade }) => {
                    const isPositiveBalance = saldo > 0;

                    return (
                      <TableRow
                        key={atividade.id || atividade.atividade}
                        className="border-b border-border-default/40 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        {/* Atividade / Código */}
                        <TableCell className="px-4 py-3 align-top font-medium text-xs text-text-primary">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-text-primary">
                              {atividade.atividade || 'Sem código'}
                            </span>
                            {atividade.tipoAtividade && (
                              <span className="inline-flex w-fit items-center rounded border border-border-default/60 bg-muted/40 px-1.5 py-0 text-[10px] font-medium uppercase text-muted-foreground">
                                {atividade.tipoAtividade}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Descrição / Objeto */}
                        <TableCell className="max-w-[240px] px-4 py-3 align-top">
                          <p
                            className="line-clamp-2 text-xs text-text-muted"
                            title={atividade.descricao}
                          >
                            {atividade.descricao || 'Sem descrição cadastrada'}
                          </p>
                        </TableCell>

                        {/* Dimensão / Componente Funcional */}
                        <TableCell className="px-4 py-3 align-top text-xs text-text-muted">
                          <div className="font-medium text-text-primary">
                            {atividade.dimensao || '—'}
                          </div>
                          {atividade.componenteFuncional && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={atividade.componenteFuncional}>
                              {atividade.componenteFuncional}
                            </div>
                          )}
                        </TableCell>

                        {/* Plano Interno / Natureza de Despesa */}
                        <TableCell className="px-4 py-3 align-top text-xs text-text-muted">
                          {atividade.planoInterno ? (
                            <div>
                              <div className="font-mono text-xs font-semibold text-text-primary">
                                PI: {extractPlanoInternoCode(atividade.planoInterno) || atividade.planoInterno}
                              </div>
                              {atividade.planoInterno.includes(' - ') && (
                                <div
                                  className="text-[11px] text-muted-foreground line-clamp-2 max-w-[200px] mt-0.5"
                                  title={atividade.planoInterno}
                                >
                                  {atividade.planoInterno.split(' - ').slice(1).join(' - ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">—</span>
                          )}
                          {atividade.naturezaDespesa && (
                            <div
                              className="mt-1 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]"
                              title={atividade.naturezaDespesa}
                            >
                              ND: {atividade.naturezaDespesa}
                            </div>
                          )}
                        </TableCell>

                        {/* Planejado */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs font-medium text-text-primary">
                          {formatCurrency(planejado)}
                        </TableCell>

                        {/* Empenhado */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs text-text-primary">
                          <div>{formatCurrency(empenhado)}</div>
                          {qtdEmpenhos > 0 && (
                            <EmpenhosListaPopover
                              titulo="Empenhos identificados"
                              empenhos={empenhosDaAtividade}
                              open={empenhosPopoverAtividadeId === atividade.id}
                              onOpenChange={(isOpen) => setEmpenhosPopoverAtividadeId(isOpen ? atividade.id : null)}
                              onSelect={handleOpenEmpenhoDetails}
                              triggerClassName="text-[10px]"
                              nota={
                                Math.abs(empenhadoIdentificado - empenhado) >= 0.01
                                  ? `Somam ${formatCurrency(empenhadoIdentificado)}; o SUAP indica ${formatCurrency(empenhado)} já consumido da atividade.`
                                  : undefined
                              }
                            >
                              ({qtdEmpenhos} {qtdEmpenhos === 1 ? 'empenho' : 'empenhos'})
                            </EmpenhosListaPopover>
                          )}
                        </TableCell>

                        {/* Saldo */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs font-semibold">
                          <span className={isPositiveBalance ? 'text-status-success font-bold' : saldo < 0 ? 'text-status-error font-bold' : 'text-slate-500'}>
                            {formatCurrency(saldo)}
                          </span>
                        </TableCell>

                        {/* Execução */}
                        <TableCell className="px-4 py-3 text-right align-top">
                          <div className="flex items-center justify-end gap-1.5">
                            <Progress value={Math.min(percentual, 100)} className="h-1.5 w-14" />
                            <span className="w-10 text-right text-xs text-muted-foreground">{percentual.toFixed(0)}%</span>
                          </div>
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="px-4 py-3 text-center align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenAtividadeDetails(atividade)}
                            title="Ver / Editar detalhes da atividade"
                            className="h-7 w-7 p-0 text-text-muted hover:text-primary"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Ver detalhes</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer com Totais da Seleção */}
          <DialogFooter className="flex flex-col border-t border-border-default/60 bg-slate-50/50 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/30">
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
              <span>
                Atividades exibidas: <strong className="text-text-primary">{filteredAtividades.length}</strong>
              </span>
              <span>
                Planejado: <strong className="text-text-primary">{formatCurrency(totaisVisiveis.planejado)}</strong>
              </span>
              <span>
                Empenhado: <strong className="text-text-primary">{formatCurrency(totaisVisiveis.empenhado)}</strong>
              </span>
              <span>
                Saldo:{' '}
                <strong className={totaisVisiveis.saldo >= 0 ? 'text-status-success font-bold' : 'text-status-error font-bold'}>
                  {formatCurrency(totaisVisiveis.saldo)}
                </strong>
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-4 text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedEmpenhoForDialog && (
        <EmpenhoDialog
          readOnly
          open={!!selectedEmpenhoForDialog}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedEmpenhoForDialog(null);
          }}
          empenho={selectedEmpenhoForDialog}
          atividades={atividades}
          onSave={() => {}}
        />
      )}

      {/* Modal de Detalhes da Atividade individual quando o usuário clica em "Ver detalhes" */}
      {selectedAtividadeForDialog && (
        <AtividadeDialog
          open={isAtividadeDialogOpen}
          onOpenChange={(isOpen) => {
            setIsAtividadeDialogOpen(isOpen);
            if (!isOpen) {
              setSelectedAtividadeForDialog(null);
            }
          }}
          atividade={selectedAtividadeForDialog}
          defaultTipoAtividade={selectedAtividadeForDialog.tipoAtividade || 'campus'}
          onSuccess={() => {
            if (onSuccessAtividade) {
              onSuccessAtividade();
            }
          }}
        />
      )}
    </>
  );
}
