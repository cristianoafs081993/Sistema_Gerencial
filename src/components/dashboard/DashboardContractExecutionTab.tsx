import { useMemo, useState } from 'react';
import { Check, Info, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartPanel } from '@/components/design-system/ChartPanel';
import { Card, CardContent } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  ContractExpenseDataPoint,
  ContractExpenseOption,
  ContractExpenseSeries,
  ContractProjectionBulletItem,
} from '@/pages/Dashboard';
import { formatCompactCurrency } from './utils';

const CONTRACT_EXPENSE_PENDING_OPACITY = 0.34;

type DashboardContractExecutionTabProps = {
  isLoading: boolean;
  contractExpenseData: ContractExpenseDataPoint[];
  contractExpenseOptions: ContractExpenseOption[];
  contractExpenseSeries: ContractExpenseSeries[];
  selectedContractExpenseIds: string[];
  contractProjectionBullets: ContractProjectionBulletItem[];
  allContractProjectionBullets?: ContractProjectionBulletItem[];
  isContractExpenseLoading: boolean;
  onToggleContractExpense: (contratoId: string) => void;
  projectionTargetMonths?: number;
  onProjectionTargetMonthsChange?: (months: number) => void;
  contractExpensePeriod?: { startDate: string; endDate: string };
  contractsWithRenewalAllowed?: string[];
  onToggleContractRenewal?: (id: string) => void;
};

function ContractExpenseTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: ContractExpenseDataPoint }>;
  label?: string;
  series: ContractExpenseSeries[];
}) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .map((item) => {
      const serie = series.find((entry) => entry.dataKey === item.dataKey);
      if (!serie) return null;

      const value = Number(item.value || 0);
      if (value <= 0) return null;

      return {
        label: serie.label,
        value,
        color: serie.color,
      };
    })
    .filter((item): item is { label: string; value: number; color: string } => Boolean(item));

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="min-w-[240px] rounded-2xl border border-border bg-card/95 px-4 py-3 text-foreground shadow-xl backdrop-blur-sm">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-2">
        {rows.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
                <span className="truncate font-ui text-sm font-medium text-text-secondary">{item.label}</span>
              </div>
            </div>
            <span className="shrink-0 font-ui text-sm font-semibold text-text-primary">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border-default/60 pt-2">
        <span className="font-ui text-xs font-semibold text-text-muted">Total do mes</span>
        <span className="font-ui text-sm font-bold text-text-primary">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function formatTraceDate(value: string | null) {
  if (!value) return 'Sem data';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getProjectionStatus(item: ContractProjectionBulletItem) {
  if (item.projetado === 0) {
    return {
      label: 'Sem gasto',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    };
  }

  if (item.percentualProjetado > 100) {
    return {
      label: 'Acima do saldo',
      className: 'border-red-200 bg-red-50 text-red-700',
    };
  }

  if (item.percentualProjetado >= 85) {
    return {
      label: 'Atencao',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Dentro do ritmo',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function ContractProjectionTraceHover({ item, targetMonths = 12 }: { item: ContractProjectionBulletItem; targetMonths?: number }) {
  const visibleLiquidacoes = item.liquidacoes.slice(0, 5);
  const visibleEmpenhos = item.empenhos.slice(0, 5);
  const hiddenLiquidacoes = Math.max(0, item.liquidacoes.length - visibleLiquidacoes.length);
  const hiddenEmpenhos = Math.max(0, item.empenhos.length - visibleEmpenhos.length);

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-default/70 bg-white text-text-muted shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          aria-label={`Ver rastreabilidade de ${item.label}`}
        >
          <Info className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" sideOffset={10} className="w-[min(92vw,520px)] rounded-2xl border-border-default/80 p-0 shadow-[0_18px_44px_rgba(15,23,42,0.14)]">
        <div className="border-b border-border-default/60 bg-surface-subtle/60 px-4 py-3">
          <p className="line-clamp-1 font-ui text-sm font-semibold text-text-primary">{item.label}</p>
          <p className="mt-1 font-ui text-xs text-text-muted">
            Projecao = liquidado atual + media por nota ({formatCurrency(item.mediaNota || 0)}) x {item.mesesRestantes || 0} mes(es) restante(s), ate o horizonte de {targetMonths} mes(es)
            {item.isCapped && !item.isRenewalAllowed && " (Limitada ao teto do contrato)"}
            {item.isRenewalAllowed && " (Simulacao de Renovacao)"}.
          </p>
        </div>

        <div className="grid gap-2 border-b border-border-default/60 px-4 py-3 sm:grid-cols-4">
          {[
            ['Empenhado', item.empenhado],
            ['Liquidado', item.liquidado],
            ['Saldo', item.saldoEmpenhos],
            ['Projetado', item.projetado],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card border border-border/60 p-2.5">
              <p className="font-ui text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 font-ui text-sm font-bold text-foreground">{formatCurrency(Number(value))}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-border-default/60 px-4 py-3">
          <div className="grid gap-2 text-[11px] text-text-muted sm:grid-cols-2">
            {item.totalParcelasContrato ? (
              <span className="col-span-full font-medium text-text-secondary">
                Parcelas: {item.totalParcelasContrato} previstas ({item.parcelasApropriadas || 0} liquidadas, {item.parcelasPendentes || 0} pendentes, {item.parcelasNaoEmitidas || 0} a emitir) · Faltam liquidar: {item.parcelasRestantes ?? 0}
              </span>
            ) : null}
            <span>Notas historicas: {item.notasUtilizadas || 0} usadas de {item.notasTotais || 0}</span>
            <span>Desconsideradas: {item.notasDesconsideradas || 0}</span>
            <span>Meses historicos: {item.mesesHistorico || item.mesesConsiderados || 0}</span>
            <span>Mes atual: {item.mesAtualTemNota ? 'nota encontrada; mes encerrado' : 'sem nota; mes reservado'}</span>
            <span>Ultima emissao: {item.ultimaEmissao ? formatTraceDate(item.ultimaEmissao) : 'nao informada'}</span>
            <span>Ultima competencia: {item.ultimaCompetencia || 'nao informada'}</span>
          </div>
        </div>
        <div className="max-h-[420px] overflow-y-auto px-4 py-3">
          <div className="space-y-4">
            <section>
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-ui text-xs font-bold uppercase text-text-secondary">Liquidacoes consideradas</h4>
                <span className="font-ui text-xs font-semibold text-text-muted">{item.liquidacoes.length} registro(s)</span>
              </div>
              {visibleLiquidacoes.length > 0 ? (
                <div className="mt-2 divide-y divide-border-default/55 rounded-xl border border-border bg-card/70">
                  {visibleLiquidacoes.map((liquidacao) => (
                    <div key={liquidacao.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <p className="truncate font-ui text-xs font-semibold text-text-primary">{liquidacao.numeroInstrumento}</p>
                        <p className="font-ui text-[11px] text-text-muted">
                          {formatTraceDate(liquidacao.dataEmissao)} · {liquidacao.situacao}
                        </p>
                      </div>
                      <p className="font-ui text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(liquidacao.valor)}</p>
                    </div>
                  ))}
                  {hiddenLiquidacoes > 0 ? <p className="px-3 py-2 font-ui text-xs font-semibold text-text-muted">+{hiddenLiquidacoes} liquidacao(oes)</p> : null}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-border-default/70 bg-surface-subtle/40 px-3 py-2 font-ui text-xs text-text-muted">
                  Nenhuma liquidacao executada entrou no periodo filtrado.
                </p>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-ui text-xs font-bold uppercase text-text-secondary">Empenhos vinculados</h4>
                <span className="font-ui text-xs font-semibold text-text-muted">{item.empenhos.length} registro(s)</span>
              </div>
              {visibleEmpenhos.length > 0 ? (
                <div className="mt-2 divide-y divide-border-default/55 rounded-xl border border-border bg-card/70">
                  {visibleEmpenhos.map((empenho) => (
                    <div key={empenho.id} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-ui text-xs font-semibold text-text-primary">{empenho.numero}</p>
                          <p className="font-ui text-[11px] text-text-muted">{formatTraceDate(empenho.dataEmissao)}</p>
                        </div>
                        <p className="shrink-0 font-ui text-xs font-bold text-text-primary">{formatCurrency(empenho.valorEmpenhado)}</p>
                      </div>
                      <div className="mt-2 grid gap-2 font-ui text-[11px] text-text-muted sm:grid-cols-3">
                        <span>Liquidado: {formatCurrency(empenho.valorLiquidado)}</span>
                        <span>Pago: {formatCurrency(empenho.valorPago)}</span>
                        <span>Saldo: {formatCurrency(empenho.saldo)}</span>
                      </div>
                    </div>
                  ))}
                  {hiddenEmpenhos > 0 ? <p className="px-3 py-2 font-ui text-xs font-semibold text-text-muted">+{hiddenEmpenhos} empenho(s)</p> : null}
                </div>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-border-default/70 bg-surface-subtle/40 px-3 py-2 font-ui text-xs text-text-muted">
                  Nenhum empenho sincronizado foi encontrado para este contrato no ano do filtro.
                </p>
              )}
            </section>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function DashboardContractExecutionTab({
  isLoading,
  contractExpenseData,
  contractExpenseOptions,
  contractExpenseSeries,
  selectedContractExpenseIds,
  contractProjectionBullets,
  allContractProjectionBullets = [],
  isContractExpenseLoading,
  onToggleContractExpense,
  projectionTargetMonths = 12,
  onProjectionTargetMonthsChange,
  contractExpensePeriod,
  contractsWithRenewalAllowed = [],
  onToggleContractRenewal,
}: DashboardContractExecutionTabProps) {
  const selectedContractExpenseSet = new Set(selectedContractExpenseIds);
  const hasContractExpenseOptions = contractExpenseOptions.length > 0;
  const hasContractExpenseData = contractExpenseData.length > 0 && contractExpenseSeries.length > 0;

  const projectionOptions = useMemo(() => {
    let filterYear = new Date().getFullYear();
    if (contractExpensePeriod?.startDate) {
      const parts = contractExpensePeriod.startDate.split('-');
      if (parts[0]) {
        filterYear = Number(parts[0]);
      }
    }
      
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth(); // 0-based

    const options: Array<{ months: number; label: string }> = [];
    const startMonth = filterYear === todayYear ? todayMonth + 1 : 0;
    const startYear = filterYear;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Current filtered year months
    for (let m = startMonth; m < 12; m++) {
      const isDefault = m === 11; // December is default
      options.push({
        months: m + 1,
        label: `${monthNames[m]} / ${startYear}${isDefault ? ' (Padrão)' : ''}`,
      });
    }

    // Next year months
    const nextYear = startYear + 1;
    for (let m = 0; m < 12; m++) {
      options.push({
        months: 12 + m + 1,
        label: `${monthNames[m]} / ${nextYear}`,
      });
    }

    return options;
  }, [contractExpensePeriod]);

  const selectedTargetLabel = useMemo(() => {
    const selectedOpt = projectionOptions.find((opt) => opt.months === projectionTargetMonths);
    return selectedOpt ? selectedOpt.label.replace(' (Padrão)', '') : '';
  }, [projectionOptions, projectionTargetMonths]);

  const [heatmapFilter, setHeatmapFilter] = useState<'all' | 'continuos_exclusiva' | 'continuos_geral' | 'obras' | 'outros'>('continuos_exclusiva');

  const isMaoDeObraExclusiva = (objeto: string | null, categoria: string | null) => {
    if (categoria === 'Mão de Obra') return true;
    if (!objeto) return false;
    const obj = objeto.toLowerCase();
    
    // Se explicitamente contiver exclusões como "sem regime de dedicação exclusiva", não é exclusiva
    const hasSemRegime = 
      obj.includes('sem regime de dedicação') ||
      obj.includes('sem regime de dedicacao') ||
      obj.includes('sem dedicação') ||
      obj.includes('sem dedicacao') ||
      obj.includes('sem mão de obra') ||
      obj.includes('sem mao de obra') ||
      obj.includes('sem mão-de-obra') ||
      obj.includes('sem mao-de-obra');
    
    if (hasSemRegime) return false;

    return (
      obj.includes('dedicação exclusiva') ||
      obj.includes('dedicacao exclusiva') ||
      obj.includes('mão de obra') ||
      obj.includes('mao de obra') ||
      obj.includes('mão-de-obra') ||
      obj.includes('mao-de-obra')
    );
  };

  const heatmapBullets = useMemo(() => {
    const rawBullets = allContractProjectionBullets.length > 0 ? allContractProjectionBullets : contractProjectionBullets;
    const filtered = rawBullets.filter((item) => {
      const isService = item.categoria === 'Serviços' || item.categoria === 'Mão de Obra';
      const isContinuo = isService;
      const isExclusiva = isContinuo && isMaoDeObraExclusiva(item.objeto || null, item.categoria || null);
      const isObras = item.categoria === 'Obras';

      if (heatmapFilter === 'continuos_exclusiva') return isExclusiva;
      if (heatmapFilter === 'continuos_geral') return isContinuo && !isExclusiva;
      if (heatmapFilter === 'obras') return isObras;
      if (heatmapFilter === 'outros') return !isContinuo && !isObras;
      return true;
    });

    // Ordenar do maior para o menor percentual de cobertura (ratio)
    return [...filtered].sort((a, b) => {
      const totalA = a.liquidado + a.saldoEmpenhos;
      const ratioA = a.projetado > 0 ? (totalA / a.projetado) * 100 : 0;

      const totalB = b.liquidado + b.saldoEmpenhos;
      const ratioB = b.projetado > 0 ? (totalB / b.projetado) * 100 : 0;

      return ratioB - ratioA;
    });
  }, [allContractProjectionBullets, contractProjectionBullets, heatmapFilter]);

  return (
    <div className="space-y-6">
      {/* Heatmap de Cobertura de Empenhos (Seletor de Contratos) */}
      <Card className="border border-border-default/80 bg-card p-5 rounded-[18px] shadow-soft">
        <CardContent className="p-0">
          {(allContractProjectionBullets.length > 0 ? allContractProjectionBullets : contractProjectionBullets).length > 0 ? (
            <div className="space-y-6">
              {/* Configuração de Filtros e Projeção */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-muted/40 p-4 border border-border shadow-xs">
                <div className="flex flex-wrap items-center gap-4 font-ui text-[11px] font-medium text-text-muted w-full justify-between gap-y-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-secondary">Filtrar por:</span>
                      <select
                        value={heatmapFilter}
                        onChange={(e) => setHeatmapFilter(e.target.value as any)}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground focus:border-primary/50 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Todos os Contratos</option>
                        <option value="continuos_exclusiva">Serviços Continuados (Mão de Obra Exclusiva)</option>
                        <option value="continuos_geral">Serviços Continuados (Geral)</option>
                        <option value="obras">Obras</option>
                        <option value="outros">Outras Categorias</option>
                      </select>
                    </div>
                    <div className="hidden sm:block text-border">|</div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-secondary">Projetar cobertura até:</span>
                      <select
                        value={projectionTargetMonths}
                        onChange={(e) => onProjectionTargetMonthsChange?.(Number(e.target.value))}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground focus:border-primary/50 focus:outline-none cursor-pointer"
                      >
                        {projectionOptions.map((opt) => (
                          <option key={opt.months} value={opt.months}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {selectedContractExpenseIds.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary font-bold font-sans px-2.5 py-1 rounded-lg border border-primary/20 shadow-xs">
                        {selectedContractExpenseIds.length} selecionado(s)
                      </span>
                    )}
                    <div className="hidden sm:block text-slate-200">|</div>
                    <div>Fórmula: (Liquidado + Saldo) / Projetado</div>
                  </div>
                </div>
              </div>

              {/* Grid do Heatmap */}
              {heatmapBullets.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {heatmapBullets.map((item) => {
                      const totalCapacidade = item.liquidado + item.saldoEmpenhos;
                      const ratio = item.projetado > 0 ? (totalCapacidade / item.projetado) * 100 : 0;
                      
                      const getCellColorClass = (percent: number) => {
                        if (percent === 0) {
                          return 'bg-muted/40 border-border text-muted-foreground opacity-70 hover:bg-muted/60 shadow-xs';
                        }
                        if (percent < 80) {
                          // Gradação de Vermelho para níveis críticos
                          if (percent < 40) {
                            return 'bg-[#991b1b] border border-red-900/20 text-white hover:bg-[#7f1d1d] shadow-sm hover:brightness-105 ring-2 ring-red-800/10';
                          }
                          if (percent < 65) {
                            return 'bg-[#dc2626] border border-red-700/20 text-white hover:bg-[#b91c1c] shadow-sm hover:brightness-105 ring-2 ring-red-600/10';
                          }
                          return 'bg-[#ef4444] border border-red-500/20 text-white hover:bg-[#dc2626] shadow-sm hover:brightness-105 ring-2 ring-red-500/10';
                        }
                        if (percent < 90) {
                          return 'bg-[#f97316] border border-orange-600/20 text-white hover:bg-[#ea580c] shadow-sm hover:brightness-105 ring-2 ring-orange-500/10';
                        }
                        if (percent < 100) {
                          return 'bg-[#fbbf24] border border-amber-500/20 text-slate-950 hover:bg-[#f59e0b] shadow-sm hover:brightness-105 ring-2 ring-amber-400/10 font-semibold';
                        }
                        // Gradação de Verde para níveis adequados
                        if (percent >= 115) {
                          return 'bg-[#166534] border border-green-800/20 text-white hover:bg-[#14532d] shadow-md hover:brightness-105 ring-2 ring-green-700/10';
                        }
                        if (percent >= 105) {
                          return 'bg-[#15803d] border border-green-700/20 text-white hover:bg-[#166534] shadow-md hover:brightness-105 ring-2 ring-green-600/10';
                        }
                        return 'bg-[#22c55e] border border-green-600/20 text-white hover:bg-[#16a34a] shadow-md hover:brightness-105 ring-2 ring-green-500/10';
                      };

                      const isAmberBackground = ratio >= 90 && ratio < 100;
                      const isZeroRatio = ratio === 0;
                      const isSelected = selectedContractExpenseSet.has(item.id);
                      const hasSelection = selectedContractExpenseIds.length > 0;

                      return (
                        <HoverCard key={item.id} openDelay={100} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div
                              className={cn(
                                "flex flex-col justify-between rounded-xl p-4 transition-all duration-200 cursor-pointer h-24 border font-ui translate-z-0 select-none",
                                getCellColorClass(ratio),
                                hasSelection && (isSelected ? "ring-2 ring-offset-2 ring-primary scale-[1.02] z-10 shadow-lg" : "opacity-40 scale-[0.97]")
                              )}
                              onClick={() => onToggleContractExpense(item.id)}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider opacity-90 truncate",
                                    isAmberBackground ? "text-slate-800" : isZeroRatio ? "text-muted-foreground" : "text-white/80"
                                  )}>
                                    {item.label.split(' - ').slice(-1)[0]}
                                  </p>
                                  {isSelected && (
                                    <Check className={cn(
                                      "w-3 h-3 shrink-0 stroke-[3px]",
                                      isAmberBackground ? "text-slate-950" : isZeroRatio ? "text-foreground" : "text-white"
                                    )} />
                                  )}
                                </div>
                                <p className={cn(
                                  "mt-0.5 text-[11px] font-bold leading-tight line-clamp-2",
                                  isAmberBackground ? "text-slate-950" : isZeroRatio ? "text-foreground" : "text-white"
                                )}>
                                  {item.label.split(' - ')[0]}
                                </p>
                              </div>
                              <div className="flex items-baseline justify-between mt-1">
                                <span className={cn(
                                  "text-[9px] font-extrabold tracking-wider uppercase",
                                  isAmberBackground ? "text-slate-800" : isZeroRatio ? "text-muted-foreground" : "text-white/70"
                                )}>
                                  Cobertura
                                </span>
                                <span className={cn(
                                  "text-sm font-black tracking-tight",
                                  isAmberBackground ? "text-slate-950" : isZeroRatio ? "text-foreground" : "text-white"
                                )}>
                                  {ratio.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80 rounded-2xl p-4 shadow-xl border border-border bg-popover text-popover-foreground font-ui text-sm z-50">
                            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detalhamento Orçamentário</p>
                                <p className="font-bold text-foreground mt-0.5">{item.label}</p>
                              </div>

                              <div className="h-px bg-border" />

                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-text-muted font-medium">Liquidado</span>
                                  <p className="font-bold text-text-primary mt-0.5">{formatCurrency(item.liquidado)}</p>
                                </div>
                                <div>
                                  <span className="text-text-muted font-medium">Saldo Empenhos</span>
                                  <p className="font-bold text-text-primary mt-0.5">{formatCurrency(item.saldoEmpenhos)}</p>
                                </div>
                                <div className="col-span-2 bg-slate-50 rounded-xl p-2.5 mt-1 border border-slate-100">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-text-muted font-semibold">Capacidade Vigente</span>
                                    <span className="font-bold text-text-primary">{formatCurrency(totalCapacidade)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-slate-200/60">
                                    <span className="text-text-muted font-semibold">Projetado</span>
                                    <span className="font-bold text-text-primary">{formatCurrency(item.projetado)}</span>
                                  </div>
                                </div>
                              </div>

                              {item.totalParcelasContrato != null && item.totalParcelasContrato > 0 && (
                                <div className="space-y-1 rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-[11px]">
                                  <div className="flex justify-between items-center text-text-muted">
                                    <span>Parcelas previstas:</span>
                                    <span className="font-bold text-text-primary">{item.totalParcelasContrato}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-text-muted">
                                    <span>• Liquidadas:</span>
                                    <span className="font-bold text-emerald-600">{item.parcelasApropriadas ?? 0}</span>
                                  </div>
                                  {(item.parcelasPendentes ?? 0) > 0 && (
                                    <div className="flex justify-between items-center text-amber-700">
                                      <span>• Pendentes:</span>
                                      <span className="font-bold">{item.parcelasPendentes} ({formatCurrency(item.valorPendente ?? 0)})</span>
                                    </div>
                                  )}
                                  {(item.parcelasNaoEmitidas ?? 0) > 0 && (
                                    <div className="flex justify-between items-center text-text-muted">
                                      <span>• A emitir:</span>
                                      <span className="font-bold text-text-primary">{item.parcelasNaoEmitidas}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 font-semibold text-text-primary">
                                    <span>Faltam liquidar:</span>
                                    <span className="font-bold text-primary">{item.parcelasRestantes ?? 0} parcela(s)</span>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 text-xs">
                                <span className="font-semibold text-text-muted">Cobertura Realizada</span>
                                <span className={cn(
                                  'font-black',
                                  ratio === 0 ? 'text-slate-400' : ratio < 80 ? 'text-[#ef4444]' : ratio < 90 ? 'text-[#f97316]' : ratio < 100 ? 'text-[#b45309]' : 'text-[#16a34a]'
                                )}>
                                  {ratio.toFixed(1)}%
                                </span>
                              </div>

                              {/* Indicadores de Teto e Vigência no Heatmap */}
                              {(item.isCapped || item.exceedsValiditySugestion) && (
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  {item.isCapped && !item.isRenewalAllowed && (
                                    <div className="rounded-lg bg-amber-50 px-2 py-1.5 border border-amber-200/50 text-[10px] font-semibold text-amber-700 leading-relaxed">
                                      ⚠️ Projeção limitada ao valor vigente do contrato ({formatCurrency(item.valorTotalContrato)}).
                                    </div>
                                  )}
                                  {item.isRenewalAllowed && (
                                    <div className="rounded-lg bg-sky-50 px-2 py-1.5 border border-sky-200/50 text-[10px] font-semibold text-sky-700 leading-relaxed">
                                      🔮 Simulação de Renovação (teto desconsiderado).
                                    </div>
                                  )}
                                  {item.exceedsValiditySugestion && !item.isCapped && !item.isRenewalAllowed && (
                                    <div className="rounded-lg bg-slate-50 px-2 py-1.5 border border-slate-200/50 text-[10px] font-semibold text-slate-500 leading-relaxed">
                                      💡 A data final excede a vigência deste contrato (que encerra em {formatTraceDate(item.vigenciaFim ?? null)}).
                                    </div>
                                  )}
                                  {onToggleContractRenewal && (
                                    item.prorrogavel === 'Sim' ? (
                                      <label className="flex items-center gap-2 cursor-pointer select-none font-ui text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors py-1">
                                        <input
                                          type="checkbox"
                                          checked={item.isRenewalAllowed}
                                          onChange={() => onToggleContractRenewal(item.id)}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span>Simular renovação (ignorar limite)</span>
                                      </label>
                                    ) : (
                                      <span className="text-[10px] text-text-muted font-bold py-1 block">
                                        🚫 Renovação indisponível (não prorrogável)
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </div>

                  {/* Heatmap Legend Plate */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-muted-gray bg-slate-50/50 p-4 rounded-xl mt-2 font-ui">
                    <div className="font-semibold text-slate-600 uppercase tracking-wider">Legenda de Cobertura (Heatmap):</div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200/50" />
                        <span>Sem Gasto / Vazio (0%)</span>
                      </div>
                      
                      {/* Crítico Gradation */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-1.5 mr-0.5">
                          <span className="w-3.5 h-3.5 rounded bg-[#ef4444] border border-red-500/10 z-20" />
                          <span className="w-3.5 h-3.5 rounded bg-[#dc2626] border border-red-700/10 z-10" />
                          <span className="w-3.5 h-3.5 rounded bg-[#991b1b] border border-red-900/10 z-0" />
                        </div>
                        <span>Crítico (&lt; 80%)</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-[#f97316] border border-orange-600/20" />
                        <span>Alerta (80% - 89%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 rounded bg-[#fbbf24] border border-amber-500/20" />
                        <span>Atenção (90% - 99%)</span>
                      </div>
                      
                      {/* Adequado Gradation */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-1.5 mr-0.5">
                          <span className="w-3.5 h-3.5 rounded bg-[#22c55e] border border-green-600/10 z-20" />
                          <span className="w-3.5 h-3.5 rounded bg-[#15803d] border border-green-700/10 z-10" />
                          <span className="w-3.5 h-3.5 rounded bg-[#166534] border border-green-800/10 z-0" />
                        </div>
                        <span>Adequado (&ge; 100%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[140px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
                  <div>
                    <p className="font-ui text-sm font-semibold text-text-primary">Nenhum contrato ativo corresponde a esta categoria.</p>
                    <p className="mt-1 font-ui text-xs text-text-muted">
                      Selecione outra opção de filtro no painel acima para visualizar os percentuais de cobertura.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[180px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
              <div>
                <p className="font-ui text-sm font-semibold text-text-primary">Sem dados de empenho para cobertura.</p>
                <p className="mt-1 font-ui text-xs text-text-muted">
                  Os percentuais de cobertura aparecerão quando houver faturas e empenhos sincronizados.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exibir cards de detalhamento condicionalmente quando há contratos selecionados */}
      {selectedContractExpenseIds.length > 0 && (
        <>
          <ChartPanel
            title="Gasto Mensal por Contrato"
            titleClassName="text-lg sm:text-xl font-bold text-text-primary"
            description="Faturas emitidas no periodo (valor total acumulado mensal)"
            loading={isLoading || isContractExpenseLoading}
            heightClassName="h-[380px]"
          >
            <div className="space-y-4">
              {hasContractExpenseData ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {contractExpenseSeries.map((serie) => (
                      <span
                        key={serie.contratoId}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-border-default/60 bg-white px-3 py-1 text-xs font-semibold text-text-secondary shadow-[0_6px_16px_rgba(15,23,42,0.05)]"
                        title={serie.label}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: serie.color }} />
                        <span className="max-w-[220px] truncate">{serie.label}</span>
                      </span>
                    ))}
                  </div>

                  <div className="h-[380px] rounded-[22px] border border-border bg-card/50 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={contractExpenseData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }} className="text-muted-foreground" />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          width={74}
                          tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 600 }}
                          className="text-muted-foreground"
                          tickFormatter={formatCompactCurrency}
                        />
                        <Tooltip content={<ContractExpenseTooltip series={contractExpenseSeries} />} />
                        {contractExpenseSeries.map((serie) => (
                          <Line
                            key={serie.contratoId}
                            type="monotone"
                            dataKey={serie.dataKey}
                            name={serie.label}
                            stroke={serie.color}
                            strokeWidth={2.5}
                            dot={{ r: 2.5, fill: serie.color }}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                        ))}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="flex h-[260px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
                  <div>
                    <p className="font-ui text-sm font-semibold text-text-primary">
                      {hasContractExpenseOptions ? 'Nenhum contrato selecionado.' : 'Nenhuma fatura encontrada para contratos ativos.'}
                    </p>
                    <p className="mt-1 font-ui text-xs text-text-muted">
                      {hasContractExpenseOptions
                        ? 'Selecione um ou mais contratos para montar o grafico.'
                        : 'O grafico sera exibido quando houver faturas sincronizadas.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ChartPanel>

          <ChartPanel
            title={`Projeção de Cobertura por Contrato (até ${selectedTargetLabel})`}
            titleClassName="text-lg sm:text-xl font-bold text-text-primary"
            description={`Liquidações executadas projetadas até ${selectedTargetLabel} frente ao saldo dos empenhos`}
            loading={isLoading || isContractExpenseLoading}
            heightClassName="min-h-[260px]"
          >
            {contractProjectionBullets.length > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      <span className="h-3 w-0.5 rounded-full bg-slate-700" />
                      Saldo dos empenhos
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      Liquidado
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <span className="h-2 w-5 rounded-full bg-blue-500/45" />
                      Projetado
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-ui text-[11px] font-medium text-text-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-secondary">Projetar cobertura até:</span>
                      <select
                        value={projectionTargetMonths}
                        onChange={(e) => onProjectionTargetMonthsChange?.(Number(e.target.value))}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground focus:border-primary/50 focus:outline-none cursor-pointer"
                      >
                        {projectionOptions.map((opt) => (
                          <option key={opt.months} value={opt.months}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {contractProjectionBullets.map((item) => {
                    const totalCapacidade = item.liquidado + item.saldoEmpenhos;
                    const ratio = item.projetado > 0 ? (totalCapacidade / item.projetado) * 100 : 0;
                    
                    let statusColor = 'bg-emerald-600';
                    let statusBg = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                    let statusText = 'Adequado';

                    if (ratio === 0) {
                      statusColor = 'bg-slate-400';
                      statusBg = 'bg-muted text-muted-foreground border-border';
                      statusText = 'Sem Gasto';
                    } else if (ratio < 70) {
                      statusColor = 'bg-rose-600';
                      statusBg = 'bg-destructive/15 text-destructive border-destructive/30';
                      statusText = 'Crítico';
                    } else if (ratio < 100) {
                      statusColor = 'bg-yellow-500';
                      statusBg = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
                      statusText = 'Atenção';
                    }

                    const formatTraceDate = (val: string | null) => {
                      if (!val) return '';
                      const parts = val.split('-');
                      if (parts.length < 3) return val;
                      return `${parts[2]}/${parts[1]}/${parts[0]}`;
                    };

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <h4 className="font-ui text-xs font-bold text-text-primary uppercase tracking-wide truncate">{item.label}</h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-text-muted">
                              <span>Teto Contrato: {formatCurrency(item.valorTotalContrato)}</span>
                              <span>•</span>
                              <span>Vigência Fim: {formatTraceDate(item.vigenciaFim ?? null)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-ui text-[11px] font-bold', statusBg)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', statusColor)} />
                              {statusText}
                            </span>
                            <span className="font-ui text-lg font-black tracking-tight text-text-primary">{ratio.toFixed(1)}%</span>
                            <ContractProjectionTraceHover item={item} targetMonths={projectionTargetMonths} />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
                          <div className="flex-1">
                            <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/50 p-0.5 flex relative">
                              {/* Barra de Liquidado */}
                              <div
                                className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${item.projetado > 0 ? (item.liquidado / item.projetado) * 100 : 0}%` }}
                                title={`Liquidado: ${formatCurrency(item.liquidado)}`}
                              />
                              {/* Barra de Saldo Empenhado */}
                              <div
                                className="h-full bg-slate-400/90 transition-all duration-500"
                                style={{ width: `${item.projetado > 0 ? (item.saldoEmpenhos / item.projetado) * 100 : 0}%` }}
                                title={`Saldo Empenhos: ${formatCurrency(item.saldoEmpenhos)}`}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 shrink-0 text-right font-ui text-xs">
                            <div>
                              <span className="text-[10px] font-semibold text-text-muted uppercase">Liquidado</span>
                              <p className="font-bold text-text-primary mt-0.5">{formatCurrency(item.liquidado)}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-text-muted uppercase">Saldo Empenhos</span>
                              <p className="font-bold text-text-primary mt-0.5">{formatCurrency(item.saldoEmpenhos)}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-text-muted uppercase">Projetado</span>
                              <p className="font-bold text-text-primary mt-0.5">{formatCurrency(item.projetado)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Indicadores de Teto, Vigência e Necessidade */}
                        {(item.isCapped || item.exceedsValiditySugestion || item.necessidadeEmpenho > 0) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-text-secondary leading-relaxed">
                            {item.isCapped && !item.isRenewalAllowed && (
                              <div className="rounded-lg bg-amber-50 px-2 py-1 border border-amber-200/40 text-amber-700">
                                ⚠️ Projeção limitada ao valor vigente do contrato ({formatCurrency(item.valorTotalContrato)}).
                              </div>
                            )}
                            {item.isRenewalAllowed && (
                              <div className="rounded-lg bg-sky-50 px-2 py-1 border border-sky-200/40 text-sky-700">
                                🔮 Simulação de Renovação ativa (limite de teto desconsiderado).
                              </div>
                            )}
                            {item.exceedsValiditySugestion && !item.isCapped && !item.isRenewalAllowed && (
                              <div className="rounded-lg bg-slate-50 px-2 py-1 border border-slate-200/40 text-slate-500">
                                💡 Cobertura provável até:{' '}
                                <span className="font-bold">{item.coberturaMes || 'N/D'}</span> devido ao encerramento do contrato em{' '}
                                <span className="font-bold">{formatTraceDate(item.vigenciaFim ?? null)}</span>.
                              </div>
                            )}
                            {item.necessidadeEmpenho > 0 && (
                              <div className="rounded-lg bg-rose-50 px-2 py-1 border border-rose-200/45 text-rose-700">
                                🚨 Necessidade de empenho complementar: {formatCurrency(item.necessidadeEmpenho)}.
                              </div>
                            )}
                            {onToggleContractRenewal && (
                              item.prorrogavel === 'Sim' ? (
                                <label className="rounded-lg bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 border border-slate-300/40 text-slate-700 flex items-center gap-2 cursor-pointer select-none font-ui text-[10px] font-semibold transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={item.isRenewalAllowed}
                                    onChange={() => onToggleContractRenewal(item.id)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
                                  />
                                  <span>Simular renovação (ignorar limite)</span>
                                </label>
                              ) : (
                                <div className="rounded-lg bg-slate-50 px-2 py-1 border border-slate-200/30 text-text-muted text-[10px] font-bold flex items-center gap-1.5">
                                  🚫 Renovação indisponível (não prorrogável)
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex h-[180px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
                <div className="space-y-1">
                  <p className="font-ui text-sm font-semibold text-text-primary">Sem dados de empenho para projecao.</p>
                  <p className="mt-1 font-ui text-xs text-text-muted">
                    Selecione contratos com empenhos e liquidacoes sincronizados para comparar a projecao anual.
                  </p>
                </div>
              </div>
            )}
          </ChartPanel>
        </>
      )}
    </div>
  );
}
