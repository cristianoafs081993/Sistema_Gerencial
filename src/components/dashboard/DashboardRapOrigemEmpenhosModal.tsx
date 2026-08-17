import { useMemo, useState } from 'react';
import {
  Eye,
  Receipt,
  Wallet,
  Layers,
  Lock,
  Flag,
  FileText,
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
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapSaldoAtual,
} from '@/utils/rapMetrics';
import type { Atividade, Empenho } from '@/types';

export interface DashboardRapOrigemEmpenhosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem: string | null;
  empenhos: Empenho[];
  rapReferenceYear: number;
  atividades?: Atividade[];
  onSaveEmpenho?: (updated: Empenho) => Promise<void> | void;
}

export function DashboardRapOrigemEmpenhosModal({
  open,
  onOpenChange,
  origem,
  empenhos,
  rapReferenceYear,
  atividades = [],
  onSaveEmpenho,
}: DashboardRapOrigemEmpenhosModalProps) {
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);

  // Filtra empenhos pertencentes à origem selecionada
  const empenhosDaOrigem = useMemo(() => {
    if (!origem) return [];
    return empenhos.filter((empenho) => {
      const empenhoOrigem = empenho.origemRecurso || 'Sem origem';
      return empenhoOrigem === origem;
    });
  }, [empenhos, origem]);

  // Enriquece os dados com métricas de RAP calculadas
  const enrichedEmpenhos = useMemo(() => {
    return empenhosDaOrigem.map((emp) => {
      const baseVigente = getRapBaseVigente(emp, rapReferenceYear);
      const liquidadoNoAno = getRapLiquidadoNoAno(emp);
      const saldoAtual = getRapSaldoAtual(emp, rapReferenceYear);

      return {
        empenho: emp,
        baseVigente,
        liquidadoNoAno,
        saldoAtual,
      };
    });
  }, [empenhosDaOrigem, rapReferenceYear]);

  // Métricas agregadas da origem inteira
  const metricasOrigem = useMemo(() => {
    let totalBase = 0;
    let totalLiquidado = 0;
    let totalSaldo = 0;
    let countComSaldo = 0;

    enrichedEmpenhos.forEach((item) => {
      totalBase += item.baseVigente;
      totalLiquidado += item.liquidadoNoAno;
      totalSaldo += item.saldoAtual;
      if (item.saldoAtual > 0) {
        countComSaldo += 1;
      }
    });

    return {
      totalBase,
      totalLiquidado,
      totalSaldo,
      totalEmpenhos: enrichedEmpenhos.length,
      countComSaldo,
    };
  }, [enrichedEmpenhos]);

  // Lista de empenhos — SEMPRE apenas com saldo remanescente > 0
  const empenhosComSaldo = useMemo(() => {
    return enrichedEmpenhos
      .filter((item) => item.saldoAtual > 0)
      .sort((a, b) => {
        // Ordena primeiro pelo maior saldo atual, depois pelo número da NE
        if (b.saldoAtual !== a.saldoAtual) {
          return b.saldoAtual - a.saldoAtual;
        }
        return (b.empenho.numero || '').localeCompare(a.empenho.numero || '');
      });
  }, [enrichedEmpenhos]);

  // Totais dos empenhos com saldo exibidos
  const totaisVisiveis = useMemo(() => {
    return empenhosComSaldo.reduce(
      (acc, item) => ({
        base: acc.base + item.baseVigente,
        liquidado: acc.liquidado + item.liquidadoNoAno,
        saldo: acc.saldo + item.saldoAtual,
      }),
      { base: 0, liquidado: 0, saldo: 0 },
    );
  }, [empenhosComSaldo]);

  const handleOpenEmpenhoDetails = (emp: Empenho) => {
    setSelectedEmpenhoForDialog(emp);
    setIsEmpenhoDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
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
                      Empenhos de Restos a Pagar com Saldo
                    </DialogTitle>
                    <Badge variant="brand" className="font-mono text-xs font-semibold">
                      Origem / PTRES: {origem || 'Sem origem'}
                    </Badge>
                  </div>
                  <DialogDescription className="sr-only">
                    Listagem de empenhos de restos a pagar com saldo remanescente da origem {origem}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* KPI Cards da Origem */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Empenhos c/ saldo</span>
                  <Receipt className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold text-text-primary">
                    {metricasOrigem.countComSaldo}
                  </span>
                  <span className="text-xs text-text-muted">
                    de {metricasOrigem.totalEmpenhos}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 dark:bg-red-950/20">
                <div className="flex items-center justify-between text-xs font-medium text-status-error">
                  <span>Saldo Atual Total</span>
                  <Wallet className="h-3.5 w-3.5 text-status-error" />
                </div>
                <div className="mt-1 text-lg font-bold text-status-error">
                  {formatCurrency(metricasOrigem.totalSaldo)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Inscrito / Reinscrito</span>
                  <Flag className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(metricasOrigem.totalBase)}
                </div>
              </div>

              <div className="rounded-lg border border-border-default/70 bg-slate-50/50 p-3 dark:bg-slate-900/30">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Liquidado no Ano</span>
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 text-base font-semibold text-text-primary">
                  {formatCurrency(metricasOrigem.totalLiquidado)}
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Table Body Container */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-slate-100/90 shadow-sm backdrop-blur-sm dark:bg-slate-800/90">
                <TableRow className="border-b border-border-default/60 hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Número (NE)
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Favorecido
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Processo / PI
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Descrição / Objeto
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Inscrito/Reinscrito
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Liquidado no Ano
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Saldo Atual
                  </TableHead>
                  <TableHead className="h-10 px-4 text-center text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empenhosComSaldo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <span className="text-sm">
                          Nenhum empenho com saldo remanescente nesta origem.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  empenhosComSaldo.map(({ empenho, baseVigente, liquidadoNoAno, saldoAtual }) => {
                    const isPositiveBalance = saldoAtual > 0;

                    return (
                      <TableRow
                        key={empenho.id || empenho.numero}
                        className="border-b border-border-default/40 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        {/* NE */}
                        <TableCell className="px-4 py-3 align-top font-mono text-xs font-semibold text-text-primary">
                          <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                            {empenho.numero}
                          </span>
                        </TableCell>

                        {/* Favorecido */}
                        <TableCell className="max-w-[200px] px-4 py-3 align-top">
                          <div className="truncate text-xs font-medium text-text-primary" title={empenho.favorecidoNome}>
                            {empenho.favorecidoNome || 'Não informado'}
                          </div>
                          {empenho.favorecidoDocumento && (
                            <div className="font-mono text-[11px] text-text-muted">
                              {formatarDocumento(empenho.favorecidoDocumento)}
                            </div>
                          )}
                        </TableCell>

                        {/* Processo / PI */}
                        <TableCell className="px-4 py-3 align-top text-xs text-text-muted">
                          {empenho.processo ? (
                            <div className="font-mono text-[11px] font-medium text-text-primary">
                              {empenho.processo}
                            </div>
                          ) : (
                            <span className="italic text-slate-400">—</span>
                          )}
                          {empenho.planoInterno && (
                            <div className="mt-0.5">
                              <Badge variant="outline" className="px-1 py-0 text-[10px] font-mono">
                                PI: {empenho.planoInterno}
                              </Badge>
                            </div>
                          )}
                        </TableCell>

                        {/* Descrição / Objeto */}
                        <TableCell className="max-w-[240px] px-4 py-3 align-top">
                          <p
                            className="line-clamp-2 text-xs text-text-muted"
                            title={empenho.descricao}
                          >
                            {empenho.descricao || 'Sem descrição cadastrada'}
                          </p>
                        </TableCell>

                        {/* Inscrito / Reinscrito */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs text-text-primary">
                          {formatCurrency(baseVigente)}
                        </TableCell>

                        {/* Liquidado no Ano */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs text-text-primary">
                          {formatCurrency(liquidadoNoAno)}
                        </TableCell>

                        {/* Saldo Atual */}
                        <TableCell className="px-4 py-3 text-right align-top text-xs font-semibold">
                          <span className={isPositiveBalance ? 'text-status-error font-bold' : 'text-slate-500'}>
                            {formatCurrency(saldoAtual)}
                          </span>
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="px-4 py-3 text-center align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEmpenhoDetails(empenho)}
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
          </div>

          {/* Footer com Totais da Seleção */}
          <DialogFooter className="flex flex-col border-t border-border-default/60 bg-slate-50/50 px-6 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-900/30">
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
              <span>
                Empenhos com saldo: <strong className="text-text-primary">{empenhosComSaldo.length}</strong>
              </span>
              <span>
                Base: <strong className="text-text-primary">{formatCurrency(totaisVisiveis.base)}</strong>
              </span>
              <span>
                Liquidado: <strong className="text-text-primary">{formatCurrency(totaisVisiveis.liquidado)}</strong>
              </span>
              <span>
                Saldo:{' '}
                <strong className={totaisVisiveis.saldo > 0 ? 'text-status-error font-bold' : 'text-text-primary'}>
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

      {/* Modal de Detalhes do Empenho individual quando o usuário clica em "Ver detalhes" */}
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
          onSave={onSaveEmpenho}
        />
      )}
    </>
  );
}
