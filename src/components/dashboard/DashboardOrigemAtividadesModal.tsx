import { useMemo, useState } from 'react';
import {
  Eye,
  Layers,
  Wallet,
  CheckCircle2,
  FileText,
  Search,
  PiggyBank,
  TrendingUp,
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
import { AtividadeDialog } from '@/components/modals/AtividadeDialog';
import { formatCurrency } from '@/lib/utils';
import { extractPlanoInternoCode, matchEmpenhosToAtividades } from '@/utils/atividadeEmpenhoMatching';
import type { Atividade, Empenho } from '@/types';

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
  const [selectedAtividadeForDialog, setSelectedAtividadeForDialog] = useState<Atividade | null>(null);
  const [isAtividadeDialogOpen, setIsAtividadeDialogOpen] = useState(false);
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

  // Correlaciona de forma inteligente os empenhos às atividades da origem
  const { empenhosPorAtividadeMap, unmatchedEmpenhos } = useMemo(() => {
    if (!origem) return { empenhosPorAtividadeMap: new Map(), unmatchedEmpenhos: [] };
    return matchEmpenhosToAtividades(atividadesDaOrigem, empenhosDaOrigem);
  }, [atividadesDaOrigem, empenhosDaOrigem, origem]);

  // Enriquece as atividades com valores de execução e saldo
  const enrichedAtividades = useMemo(() => {
    return atividadesDaOrigem.map((atividade) => {
      const empInfo = empenhosPorAtividadeMap.get(atividade.id) || { total: 0, count: 0, empenhos: [] };
      const planejado = atividade.valorTotal || 0;
      const empenhado = empInfo.total;
      const saldo = planejado - empenhado;
      const percentual = planejado > 0 ? (empenhado / planejado) * 100 : 0;

      return {
        atividade,
        planejado,
        empenhado,
        saldo,
        percentual,
        qtdEmpenhos: empInfo.count,
        empenhos: empInfo.empenhos,
      };
    });
  }, [atividadesDaOrigem, empenhosPorAtividadeMap]);

  // Métricas agregadas da origem inteira
  const metricasOrigem = useMemo(() => {
    let totalPlanejado = 0;
    let totalEmpenhadoAtividades = 0;
    let totalSaldo = 0;
    let countComSaldo = 0;

    enrichedAtividades.forEach((item) => {
      totalPlanejado += item.planejado;
      totalEmpenhadoAtividades += item.empenhado;
      totalSaldo += item.saldo;
      if (item.saldo > 0) {
        countComSaldo += 1;
      }
    });

    const totalEmpenhadoGeralOrigem = empenhosDaOrigem.reduce((acc, e) => acc + (e.valor || 0), 0);
    const empenhadoReal = totalEmpenhadoGeralOrigem > 0 ? totalEmpenhadoGeralOrigem : totalEmpenhadoAtividades;

    return {
      totalPlanejado,
      totalEmpenhado: empenhadoReal,
      totalSaldo: totalPlanejado - empenhadoReal,
      totalAtividades: enrichedAtividades.length,
      countComSaldo,
    };
  }, [enrichedAtividades, empenhosDaOrigem]);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
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

            {/* KPI Cards da Origem */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Atividades c/ saldo</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-text-primary">
                    {metricasOrigem.countComSaldo}
                  </span>
                  <span className="text-xs text-text-muted">
                    de {metricasOrigem.totalAtividades}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between text-xs font-medium text-status-success">
                  <span>Saldo Disponível</span>
                  <Wallet className="h-3.5 w-3.5 text-status-success" />
                </div>
                <div className="mt-1 text-lg font-bold text-status-success">
                  {formatCurrency(metricasOrigem.totalSaldo)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Total Planejado</span>
                  <PiggyBank className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(metricasOrigem.totalPlanejado)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Total Empenhado</span>
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(metricasOrigem.totalEmpenhado)}
                </div>
              </div>
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
                  filteredAtividades.map(({ atividade, planejado, empenhado, saldo, percentual, qtdEmpenhos }) => {
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
                            <span className="text-[10px] text-muted-foreground">
                              ({qtdEmpenhos} {qtdEmpenhos === 1 ? 'empenho' : 'empenhos'})
                            </span>
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
