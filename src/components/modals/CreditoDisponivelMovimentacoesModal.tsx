import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Eye,
  FileText,
  Filter,
  Layers,
  PiggyBank,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import type { Atividade, Descentralizacao, Empenho } from '@/types';
import type { CreditoDisponivelDetalheRow } from '@/services/creditosDisponiveisDetalhes';

export interface CreditoDisponivelMovimentacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRow: CreditoDisponivelDetalheRow | null;
  descentralizacoes?: Descentralizacao[];
  empenhos?: Empenho[];
  atividades?: Atividade[];
  onSaveEmpenho?: (id: string, data: Partial<Empenho>) => void;
}

const statusColors: Record<string, string> = {
  pendente: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  liquidado: 'bg-action-primary/20 text-action-primary border-action-primary/30',
  pago: 'bg-status-success/20 text-status-success border-status-success/30',
  cancelado: 'bg-status-error/20 text-status-error border-status-error/30',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

function formatDateBR(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function matchesPtres(origemRecurso: string | undefined, targetPtres: string): boolean {
  if (!origemRecurso || !targetPtres) return false;
  const o = origemRecurso.trim().toLowerCase();
  const t = targetPtres.trim().toLowerCase();
  return o === t || o.startsWith(`${t} `) || o.startsWith(`${t}-`) || o.startsWith(`${t}/`);
}

export function isEmpenhoDoAno(empenho: Empenho, currentYear = new Date().getFullYear()): boolean {
  if (empenho.tipo === 'rap') return false;

  if (empenho.numero) {
    const match = empenho.numero.match(/^(\d{4})NE/i);
    if (match) {
      return Number(match[1]) === currentYear;
    }
  }

  if (empenho.dataEmpenho) {
    const d = new Date(empenho.dataEmpenho);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() === currentYear;
    }
  }

  return empenho.tipo === 'exercicio';
}

function getEmpenhoSortTime(empenho: Empenho): number {
  if (empenho.dataEmpenho) {
    const d = new Date(empenho.dataEmpenho);
    const time = d.getTime();
    if (!isNaN(time)) return time;
  }
  if (empenho.createdAt) {
    const d = new Date(empenho.createdAt);
    const time = d.getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

export function CreditoDisponivelMovimentacoesModal({
  open,
  onOpenChange,
  selectedRow,
  descentralizacoes = [],
  empenhos = [],
  atividades = [],
  onSaveEmpenho,
}: CreditoDisponivelMovimentacoesModalProps) {
  const [activeTab, setActiveTab] = useState<'descentralizacoes' | 'empenhos'>('empenhos');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOnlyCurrentPi, setFilterOnlyCurrentPi] = useState(false);
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab('empenhos');
      setSearchTerm('');
      setFilterOnlyCurrentPi(false);
    }
  }, [open, selectedRow]);

  const targetPtres = selectedRow?.ptres?.trim() || '';
  const targetPi = selectedRow?.planoInterno?.trim() || '';

  // Filtra descentralizações daquele PTRES
  const descentralizacoesDoPtres = useMemo(() => {
    if (!targetPtres) return [];
    return descentralizacoes.filter((d) => matchesPtres(d.origemRecurso, targetPtres));
  }, [descentralizacoes, targetPtres]);

  // Filtra apenas empenhos do ano daquele PTRES
  const empenhosDoPtres = useMemo(() => {
    if (!targetPtres) return [];
    return empenhos.filter((e) => matchesPtres(e.origemRecurso, targetPtres) && isEmpenhoDoAno(e));
  }, [empenhos, targetPtres]);

  // Métricas agregadas da origem inteira (somente empenhos do ano)
  const metricasOrigem = useMemo(() => {
    const totalDescentralizado = descentralizacoesDoPtres.reduce((acc, d) => acc + d.valor, 0);
    const empenhosNaoCancelados = empenhosDoPtres.filter((e) => e.status !== 'cancelado');
    const totalEmpenhado = empenhosNaoCancelados.reduce((acc, e) => acc + e.valor, 0);
    const totalLiquidado = empenhosNaoCancelados.reduce((acc, e) => acc + (e.valorLiquidado || 0), 0);
    const totalPago = empenhosNaoCancelados.reduce((acc, e) => acc + (e.valorPago || 0), 0);
    const saldoEmpenhos = totalEmpenhado - totalLiquidado;

    return {
      creditoDisponivelRelatorio: selectedRow?.valor ?? 0,
      totalDescentralizado,
      totalEmpenhado,
      totalLiquidado,
      totalPago,
      saldoEmpenhos,
      countDescentralizacoes: descentralizacoesDoPtres.length,
      countEmpenhos: empenhosDoPtres.length,
    };
  }, [descentralizacoesDoPtres, empenhosDoPtres, selectedRow?.valor]);

  // Filtros aplicados às descentralizações
  const filteredDescentralizacoes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return descentralizacoesDoPtres
      .filter((d) => {
        if (filterOnlyCurrentPi && targetPi && (d.planoInterno || '').trim().toUpperCase() !== targetPi.toUpperCase()) {
          return false;
        }
        if (!search) return true;
        return (
          (d.dimensao || '').toLowerCase().includes(search) ||
          (d.notaCredito || '').toLowerCase().includes(search) ||
          (d.operacaoTipo || '').toLowerCase().includes(search) ||
          (d.naturezaDespesa || '').toLowerCase().includes(search) ||
          (d.planoInterno || '').toLowerCase().includes(search) ||
          (d.descricao || '').toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const timeA = a.dataEmissao ? new Date(a.dataEmissao).getTime() : 0;
        const timeB = b.dataEmissao ? new Date(b.dataEmissao).getTime() : 0;
        return timeB - timeA;
      });
  }, [descentralizacoesDoPtres, filterOnlyCurrentPi, targetPi, searchTerm]);

  // Filtros aplicados aos empenhos (ordenados do mais recente para o mais antigo)
  const filteredEmpenhos = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return empenhosDoPtres
      .filter((e) => {
        if (filterOnlyCurrentPi && targetPi && (e.planoInterno || '').trim().toUpperCase() !== targetPi.toUpperCase()) {
          return false;
        }
        if (!search) return true;
        return (
          (e.numero || '').toLowerCase().includes(search) ||
          (e.processo || '').toLowerCase().includes(search) ||
          (e.favorecidoNome || '').toLowerCase().includes(search) ||
          (e.favorecidoDocumento || '').toLowerCase().includes(search) ||
          (e.naturezaDespesa || '').toLowerCase().includes(search) ||
          (e.planoInterno || '').toLowerCase().includes(search) ||
          (e.descricao || '').toLowerCase().includes(search) ||
          (statusLabels[e.status] || '').toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        const timeA = getEmpenhoSortTime(a);
        const timeB = getEmpenhoSortTime(b);
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        return (b.numero || '').localeCompare(a.numero || '', undefined, { numeric: true });
      });
  }, [empenhosDoPtres, filterOnlyCurrentPi, targetPi, searchTerm]);

  // Totais visíveis das listas filtradas
  const totaisDescentralizacoesVisiveis = useMemo(() => {
    return filteredDescentralizacoes.reduce((acc, d) => acc + d.valor, 0);
  }, [filteredDescentralizacoes]);

  const totaisEmpenhosVisiveis = useMemo(() => {
    return filteredEmpenhos.reduce(
      (acc, e) => {
        const isCancelado = e.status === 'cancelado';
        return {
          empenhado: acc.empenhado + (isCancelado ? 0 : e.valor),
          liquidado: acc.liquidado + (isCancelado ? 0 : (e.valorLiquidado || 0)),
          pago: acc.pago + (isCancelado ? 0 : (e.valorPago || 0)),
          saldo: acc.saldo + (isCancelado ? 0 : (e.valor - (e.valorLiquidado || 0))),
        };
      },
      { empenhado: 0, liquidado: 0, pago: 0, saldo: 0 },
    );
  }, [filteredEmpenhos]);

  const handleOpenEmpenhoDetails = (emp: Empenho) => {
    setSelectedEmpenhoForDialog(emp);
    setIsEmpenhoDialogOpen(true);
  };

  const handleSaveEmpenhoDialog = (id: string, data: Partial<Empenho>) => {
    if (onSaveEmpenho) {
      onSaveEmpenho(id, data);
    }
    setIsEmpenhoDialogOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
          {/* Header */}
          <DialogHeader className="border-b border-border-default/60 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-base font-semibold text-text-primary">
                      Movimentações da Origem / PTRES
                    </DialogTitle>
                    <Badge variant="brand" className="font-mono text-xs font-semibold">
                      PTRES: {targetPtres || 'Sem PTRES'}
                    </Badge>
                    {targetPi && (
                      <Badge variant="outline" className="font-mono text-xs">
                        PI: {targetPi}
                      </Badge>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-text-muted mt-0.5">
                    {selectedRow?.descricao ? (
                      <span className="line-clamp-1">{selectedRow.descricao}</span>
                    ) : (
                      'Detalhamento de descentralizações e empenhos vinculados a este recurso orçamentário'
                    )}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* KPI Cards da Seleção */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs font-medium text-status-success">
                  <span>Crédito Disponível</span>
                  <Wallet className="h-3.5 w-3.5 text-status-success" />
                </div>
                <div className="mt-1 text-lg font-bold text-status-success">
                  {formatCurrency(metricasOrigem.creditoDisponivelRelatorio)}
                </div>
                <span className="text-[10px] text-text-muted">Posição no relatório SIAFI</span>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Total Descentralizado</span>
                  <TrendingUp className="h-3.5 w-3.5 text-action-primary" />
                </div>
                <div className="mt-1 text-lg font-bold text-text-primary">
                  {formatCurrency(metricasOrigem.totalDescentralizado)}
                </div>
                <span className="text-[10px] text-text-muted">
                  {metricasOrigem.countDescentralizacoes} {metricasOrigem.countDescentralizacoes === 1 ? 'nota' : 'notas'} de crédito
                </span>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Empenhado no Ano</span>
                  <Receipt className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-lg font-bold text-text-primary">
                  {formatCurrency(metricasOrigem.totalEmpenhado)}
                </div>
                <span className="text-[10px] text-text-muted">
                  {metricasOrigem.countEmpenhos} {metricasOrigem.countEmpenhos === 1 ? 'empenho' : 'empenhos'} do ano
                </span>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Saldo a Executar</span>
                  <PiggyBank className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-lg font-bold text-text-primary">
                  {formatCurrency(metricasOrigem.saldoEmpenhos)}
                </div>
                <span className="text-[10px] text-text-muted">
                  Liq: {formatCurrency(metricasOrigem.totalLiquidado)}
                </span>
              </div>
            </div>

            {/* Barra de Filtros, Busca e Abas */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, PI, ND, credor, número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                {targetPi && (
                  <button
                    type="button"
                    onClick={() => setFilterOnlyCurrentPi((prev) => !prev)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all border ${
                      filterOnlyCurrentPi
                        ? 'border-primary/40 bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                        : 'border-border-default bg-background text-text-muted hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {filterOnlyCurrentPi ? 'Todos os PIs' : `Apenas PI ${targetPi}`}
                  </button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Abas e Listas de Movimentação */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'descentralizacoes' | 'empenhos')}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="border-b border-border-default/60 bg-slate-50/70 px-6 py-2 dark:bg-slate-900/40">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="empenhos" className="text-xs gap-2">
                  <ArrowUpRight className="h-3.5 w-3.5 text-amber-500" />
                  Empenhos do Ano ({empenhosDoPtres.length})
                </TabsTrigger>
                <TabsTrigger value="descentralizacoes" className="text-xs gap-2">
                  <ArrowDownRight className="h-3.5 w-3.5 text-action-primary" />
                  Descentralizações ({descentralizacoesDoPtres.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB: DESCENTRALIZAÇÕES */}
            <TabsContent value="descentralizacoes" className="m-0 flex-1 overflow-y-auto overflow-x-auto p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100/90 shadow-sm backdrop-blur-sm dark:bg-slate-800/90">
                  <TableRow className="border-b border-border-default/60 hover:bg-transparent">
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Data
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Dimensão
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Nota / Operação
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      PI / ND
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Descrição
                    </TableHead>
                    <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDescentralizacoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <span className="text-sm">
                            {filterOnlyCurrentPi
                              ? `Nenhuma descentralização encontrada para o PI ${targetPi} neste PTRES.`
                              : 'Nenhuma descentralização encontrada para este PTRES com os filtros atuais.'}
                          </span>
                          {filterOnlyCurrentPi && descentralizacoesDoPtres.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setFilterOnlyCurrentPi(false)}
                              className="text-xs text-primary underline hover:bg-transparent"
                            >
                              Ver todas as {descentralizacoesDoPtres.length} descentralizações do PTRES
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDescentralizacoes.map((item) => {
                      const isDevolucaoOuAnulacao = item.valor < 0 || (item.operacaoTipo || '').toLowerCase().includes('devolucao');
                      return (
                        <TableRow
                          key={item.id}
                          className="border-b border-border-default/40 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          {/* Data */}
                          <TableCell className="px-4 py-3 align-top whitespace-nowrap text-xs text-text-muted font-mono">
                            {formatDateBR(item.dataEmissao)}
                          </TableCell>

                          {/* Dimensão */}
                          <TableCell className="px-4 py-3 align-top">
                            <Badge variant="secondary" className="whitespace-nowrap font-medium text-[11px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {item.dimensao ? item.dimensao.split(' - ')[0] : '—'}
                            </Badge>
                          </TableCell>

                          {/* Nota de Crédito / Operação */}
                          <TableCell className="px-4 py-3 align-top font-mono text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-text-primary">
                                {item.notaCredito || item.operacaoTipo || 'Crédito'}
                              </span>
                              {item.operacaoTipo && item.notaCredito && (
                                <span className="text-[10px] text-text-muted uppercase">
                                  {item.operacaoTipo}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* PI / ND */}
                          <TableCell className="px-4 py-3 align-top text-xs">
                            {item.planoInterno ? (
                              <div className="font-mono text-xs font-semibold text-text-primary">
                                PI: {item.planoInterno}
                              </div>
                            ) : (
                              <span className="italic text-slate-400">—</span>
                            )}
                            {item.naturezaDespesa && (
                              <div className="mt-0.5 font-mono text-[10px] text-text-muted" title={item.naturezaDespesa}>
                                ND: {item.naturezaDespesa}
                              </div>
                            )}
                          </TableCell>

                          {/* Descrição */}
                          <TableCell className="max-w-[280px] px-4 py-3 align-top">
                            <p className="line-clamp-2 text-xs text-text-muted" title={item.descricao}>
                              {item.descricao || '—'}
                            </p>
                          </TableCell>

                          {/* Valor */}
                          <TableCell className="px-4 py-3 text-right align-top text-xs font-bold whitespace-nowrap">
                            <span className={isDevolucaoOuAnulacao ? 'text-status-error' : 'text-action-primary'}>
                              {formatCurrency(item.valor)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            {/* TAB: EMPENHOS */}
            <TabsContent value="empenhos" className="m-0 flex-1 overflow-y-auto overflow-x-auto p-0">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-slate-100/90 shadow-sm backdrop-blur-sm dark:bg-slate-800/90">
                  <TableRow className="border-b border-border-default/60 hover:bg-transparent">
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Número / Processo
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Favorecido
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      PI / ND
                    </TableHead>
                    <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Descrição
                    </TableHead>
                    <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Status
                    </TableHead>
                    <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Empenhado / Liq
                    </TableHead>
                    <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Saldo
                    </TableHead>
                    <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-text-primary">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpenhos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                          <span className="text-sm">
                            {filterOnlyCurrentPi
                              ? `Nenhum empenho encontrado para o PI ${targetPi} neste PTRES.`
                              : 'Nenhum empenho encontrado para este PTRES com os filtros atuais.'}
                          </span>
                          {filterOnlyCurrentPi && empenhosDoPtres.length > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setFilterOnlyCurrentPi(false)}
                              className="text-xs text-primary underline hover:bg-transparent"
                            >
                              Ver todos os {empenhosDoPtres.length} empenhos do PTRES
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmpenhos.map((emp) => {
                      const isCancelado = emp.status === 'cancelado';
                      const saldo = emp.valor - (emp.valorLiquidado || 0);

                      return (
                        <TableRow
                          key={emp.id || emp.numero}
                          className="border-b border-border-default/40 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          {/* Número / Processo */}
                          <TableCell className="px-4 py-3 align-top font-mono text-xs font-semibold text-text-primary">
                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                              {emp.numero}
                            </span>
                            {emp.processo && (
                              <div className="text-[11px] font-normal text-text-muted mt-0.5">
                                Proc: {emp.processo}
                              </div>
                            )}
                          </TableCell>

                          {/* Favorecido */}
                          <TableCell className="max-w-[200px] px-4 py-3 align-top">
                            <div className="truncate text-xs font-medium text-text-primary" title={emp.favorecidoNome}>
                              {emp.favorecidoNome || 'Não informado'}
                            </div>
                            {emp.favorecidoDocumento && (
                              <div className="font-mono text-[11px] text-text-muted">
                                {formatarDocumento(emp.favorecidoDocumento)}
                              </div>
                            )}
                          </TableCell>

                          {/* PI / ND */}
                          <TableCell className="px-4 py-3 align-top text-xs">
                            {emp.planoInterno ? (
                              <div className="font-mono text-xs font-semibold text-text-primary">
                                PI: {emp.planoInterno}
                              </div>
                            ) : (
                              <span className="italic text-slate-400">—</span>
                            )}
                            {emp.naturezaDespesa && (
                              <div className="mt-0.5 font-mono text-[10px] text-text-muted" title={emp.naturezaDespesa}>
                                ND: {emp.naturezaDespesa}
                              </div>
                            )}
                          </TableCell>

                          {/* Descrição */}
                          <TableCell className="max-w-[220px] px-4 py-3 align-top">
                            <p className="line-clamp-2 text-xs text-text-muted" title={emp.descricao}>
                              {emp.descricao || '—'}
                            </p>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-4 py-3 text-center align-top whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-medium uppercase px-1.5 py-0 ${statusColors[emp.status] || ''}`}
                            >
                              {statusLabels[emp.status] || emp.status}
                            </Badge>
                          </TableCell>

                          {/* Empenhado / Liquidado */}
                          <TableCell className="px-4 py-3 text-right align-top text-xs whitespace-nowrap">
                            <div className={`font-semibold ${isCancelado ? 'line-through text-slate-400' : 'text-text-primary'}`}>
                              {formatCurrency(emp.valor)}
                            </div>
                            {(emp.valorLiquidado || 0) > 0 && (
                              <div className="text-[11px] text-status-info">
                                Liq: {formatCurrency(emp.valorLiquidado || 0)}
                              </div>
                            )}
                            {(emp.valorPago || 0) > 0 && (
                              <div className="text-[10px] text-status-success">
                                Pg: {formatCurrency(emp.valorPago || 0)}
                              </div>
                            )}
                          </TableCell>

                          {/* Saldo */}
                          <TableCell className="px-4 py-3 text-right align-top text-xs font-semibold whitespace-nowrap">
                            {isCancelado ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span className={saldo > 0 ? 'text-status-success font-bold' : saldo < 0 ? 'text-status-error font-bold' : 'text-slate-500'}>
                                {formatCurrency(saldo)}
                              </span>
                            )}
                          </TableCell>

                          {/* Ações */}
                          <TableCell className="px-4 py-3 text-center align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEmpenhoDetails(emp)}
                              title="Ver detalhes completos do empenho"
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
            </TabsContent>
          </Tabs>

          {/* Footer com Totais da Seleção */}
          <DialogFooter className="flex flex-col border-t border-border-default/60 bg-slate-50/50 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/30">
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
              {activeTab === 'descentralizacoes' ? (
                <>
                  <span>
                    Notas exibidas: <strong className="text-text-primary">{filteredDescentralizacoes.length}</strong>
                  </span>
                  <span>
                    Total descentralizado:{' '}
                    <strong className="text-action-primary font-bold">
                      {formatCurrency(totaisDescentralizacoesVisiveis)}
                    </strong>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Empenhos exibidos: <strong className="text-text-primary">{filteredEmpenhos.length}</strong>
                  </span>
                  <span>
                    Empenhado: <strong className="text-text-primary">{formatCurrency(totaisEmpenhosVisiveis.empenhado)}</strong>
                  </span>
                  <span>
                    Liquidado: <strong className="text-text-primary">{formatCurrency(totaisEmpenhosVisiveis.liquidado)}</strong>
                  </span>
                  <span>
                    Saldo:{' '}
                    <strong className={totaisEmpenhosVisiveis.saldo >= 0 ? 'text-status-success font-bold' : 'text-status-error font-bold'}>
                      {formatCurrency(totaisEmpenhosVisiveis.saldo)}
                    </strong>
                  </span>
                </>
              )}
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

      {/* Modal de Detalhes do Empenho individual */}
      {selectedEmpenhoForDialog && (
        <EmpenhoDialog
          open={isEmpenhoDialogOpen}
          onOpenChange={(isOpen) => {
            setIsEmpenhoDialogOpen(isOpen);
            if (!isOpen) {
              setSelectedEmpenhoForDialog(null);
            }
          }}
          empenho={selectedEmpenhoForDialog}
          atividades={atividades}
          onSave={handleSaveEmpenhoDialog}
        />
      )}
    </>
  );
}
