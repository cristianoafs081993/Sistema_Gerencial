import { useMemo } from 'react';
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
    <div className="min-w-[240px] rounded-2xl border border-border-default/65 bg-white/95 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-[2px]">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
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

function ContractProjectionTraceHover({ item }: { item: ContractProjectionBulletItem }) {
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
            Projecao = liquidado / {item.mesesConsiderados || 1} mes(es) observado(s) x 12.
          </p>
        </div>

        <div className="grid gap-2 border-b border-border-default/60 px-4 py-3 sm:grid-cols-4">
          {[
            ['Empenhado', item.empenhado],
            ['Liquidado', item.liquidado],
            ['Saldo', item.saldoEmpenhos],
            ['Projetado', item.projetado],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white">
              <p className="font-ui text-[11px] font-semibold uppercase text-text-muted">{label}</p>
              <p className="mt-1 font-ui text-sm font-bold text-text-primary">{formatCurrency(Number(value))}</p>
            </div>
          ))}
        </div>

        <div className="max-h-[420px] overflow-y-auto px-4 py-3">
          <div className="space-y-4">
            <section>
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-ui text-xs font-bold uppercase text-text-secondary">Liquidacoes consideradas</h4>
                <span className="font-ui text-xs font-semibold text-text-muted">{item.liquidacoes.length} registro(s)</span>
              </div>
              {visibleLiquidacoes.length > 0 ? (
                <div className="mt-2 divide-y divide-border-default/55 rounded-xl border border-border-default/60 bg-white">
                  {visibleLiquidacoes.map((liquidacao) => (
                    <div key={liquidacao.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <p className="truncate font-ui text-xs font-semibold text-text-primary">{liquidacao.numeroInstrumento}</p>
                        <p className="font-ui text-[11px] text-text-muted">
                          {formatTraceDate(liquidacao.dataEmissao)} · {liquidacao.situacao}
                        </p>
                      </div>
                      <p className="font-ui text-xs font-bold text-emerald-700">{formatCurrency(liquidacao.valor)}</p>
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
                <div className="mt-2 divide-y divide-border-default/55 rounded-xl border border-border-default/60 bg-white">
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

  return (
    <div className="space-y-6">
      <section className="rounded-[18px] border border-border-default/80 bg-white px-4 py-4 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-ui text-sm font-bold text-text-primary">Contratos analisados</h3>
                <p className="font-ui text-xs text-text-muted">A selecao abaixo filtra o gasto mensal e a projecao anual.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <span className="inline-flex h-9 items-center rounded-full border border-border-default/60 bg-surface-subtle/50 px-3 font-ui text-xs font-semibold text-text-secondary">
              {selectedContractExpenseIds.length} de {contractExpenseOptions.length} contrato(s)
            </span>
          </div>
        </div>

        {hasContractExpenseOptions ? (
          <div className="mt-4 flex max-h-[148px] flex-wrap gap-2 overflow-y-auto pr-1">
            {contractExpenseOptions.map((contrato) => {
              const selected = selectedContractExpenseSet.has(contrato.id);

              return (
                <button
                  key={contrato.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onToggleContractExpense(contrato.id)}
                  className={cn(
                    'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 font-ui text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
                    selected
                      ? 'bg-white text-text-primary shadow-[0_8px_18px_rgba(15,23,42,0.08)]'
                      : 'border-border-default/60 bg-surface-subtle/45 text-text-secondary hover:border-border-default hover:bg-white',
                  )}
                  style={selected ? { borderColor: contrato.color, backgroundColor: `${contrato.color}14` } : undefined}
                  title={contrato.label}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: contrato.color }} />
                  <span className="max-w-[240px] truncate">{contrato.label}</span>
                  {contrato.total <= 0 ? <span className="shrink-0 text-[11px] font-semibold text-text-muted">sem fatura</span> : null}
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border-default/70 bg-surface-subtle/40 px-3 py-2 font-ui text-xs text-text-muted">
            Nenhum contrato ativo encontrado para selecao.
          </p>
        )}
      </section>

      <ChartPanel
        title="Gasto Mensal por Contrato"
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

              <div className="h-[380px] rounded-[22px] border border-border-default/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.85))] p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={contractExpenseData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe3f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={74}
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
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
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-text-primary focus:border-primary/50 focus:outline-none cursor-pointer"
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

            <div className="space-y-3">
              {contractProjectionBullets.map((item) => {
                const scaleMax = Math.max(item.liquidado + item.saldoEmpenhos, item.projetado, 1);
                const liquidadoWidth = Math.min((item.liquidado / scaleMax) * 100, 100);
                const projetadoWidth = Math.min((item.projetado / scaleMax) * 100, 100);
                const saldoPosition = Math.min(((item.liquidado + item.saldoEmpenhos) / scaleMax) * 100, 100);
                const status = getProjectionStatus(item);

                return (
                  <div
                    key={item.id}
                    className="rounded-[18px] border border-border-default/70 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-surface-subtle" style={{ backgroundColor: item.color }} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-ui text-sm font-bold text-text-primary">{item.label}</p>
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 font-ui text-[11px] font-bold', status.className)}>
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-1 font-ui text-xs text-text-muted">
                            Projetado em {item.percentualProjetado.toFixed(0)}% do saldo com {item.mesesConsiderados} mes(es) observado(s).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="grid min-w-[min(100%,440px)] grid-cols-3 gap-2 text-right font-ui">
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-text-muted">Saldo</p>
                            <p className="mt-1 text-sm font-bold text-text-primary">{formatCurrency(item.saldoEmpenhos)}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-emerald-700/80">Liquidado</p>
                            <p className="mt-1 text-sm font-bold text-emerald-700">{formatCurrency(item.liquidado)}</p>
                          </div>
                          <div className="rounded-xl bg-blue-50 px-3 py-2">
                            <p className="text-[11px] font-semibold text-blue-700/80">Projetado</p>
                            <p className="mt-1 text-sm font-bold text-blue-700">{formatCurrency(item.projetado)}</p>
                          </div>
                        </div>
                        <ContractProjectionTraceHover item={item} />
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="relative h-8 rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
                        <div
                          className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-blue-500/20"
                          style={{ width: `${projetadoWidth}%` }}
                        />
                        <div
                          className="absolute left-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-emerald-600 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
                          style={{ width: `${liquidadoWidth}%` }}
                        />
                        <div
                          className="absolute top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-slate-900 shadow-[0_0_0_3px_rgba(15,23,42,0.08)]"
                          style={{ left: `${saldoPosition}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-ui text-[11px] font-semibold text-text-muted">
                        <span>
                          Provável necessidade de empenho:{' '}
                          <span className={cn('font-bold', item.necessidadeEmpenho > 0 ? 'text-status-warning' : 'text-status-success')}>
                            {formatCurrency(item.necessidadeEmpenho)}
                          </span>
                        </span>
                        <span>
                          Cobertura provável até:{' '}
                          <span className="font-bold text-text-primary">
                            {item.coberturaMes || 'N/D'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-[180px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
            <div>
              <p className="font-ui text-sm font-semibold text-text-primary">Sem dados de empenho para projecao.</p>
              <p className="mt-1 font-ui text-xs text-text-muted">
                Selecione contratos com empenhos e liquidacoes sincronizados para comparar a projecao anual.
              </p>
            </div>
          </div>
        )}
      </ChartPanel>

      {/* Heatmap de Cobertura de Empenhos */}
      <ChartPanel
        title="Heatmap de Cobertura de Empenhos"
        description="Percentual de cobertura dos empenhos vigentes (Liquidado + Saldo) frente à provável necessidade anual projetada para todos os contratos ativos."
        loading={isLoading || isContractExpenseLoading}
      >
        {(allContractProjectionBullets.length > 0 ? allContractProjectionBullets : contractProjectionBullets).length > 0 ? (
          <div className="space-y-6">
            {/* Legenda do Heatmap */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-lg bg-rose-600 ring-2 ring-rose-600/20" />
                  <span className="font-ui text-xs font-semibold text-text-muted">Crítico (&lt; 70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-lg bg-yellow-500 ring-2 ring-yellow-500/20" />
                  <span className="font-ui text-xs font-semibold text-text-muted">Atenção (70% - 99%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-lg bg-emerald-600 ring-2 ring-emerald-600/20" />
                  <span className="font-ui text-xs font-semibold text-text-muted">Adequado (&ge; 100%)</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-ui text-[11px] font-medium text-text-muted">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-secondary">Projetar cobertura até:</span>
                  <select
                    value={projectionTargetMonths}
                    onChange={(e) => onProjectionTargetMonthsChange?.(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-text-primary focus:border-primary/50 focus:outline-none cursor-pointer"
                  >
                    {projectionOptions.map((opt) => (
                      <option key={opt.months} value={opt.months}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden sm:block text-slate-200">|</div>
                <div>Fórmula: (Liquidado + Saldo) / Projetado</div>
              </div>
            </div>

            {/* Grid do Heatmap */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {(allContractProjectionBullets.length > 0 ? allContractProjectionBullets : contractProjectionBullets).map((item) => {
                const totalCapacidade = item.liquidado + item.saldoEmpenhos;
                const ratio = item.projetado > 0 ? (totalCapacidade / item.projetado) * 100 : 100;
                
                const getCellColorClass = (percent: number) => {
                  if (percent < 70) return 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 ring-2 ring-rose-600/20';
                  if (percent < 100) return 'bg-yellow-500 text-slate-950 shadow-sm hover:bg-yellow-600 ring-2 ring-yellow-500/20';
                  return 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 ring-2 ring-emerald-600/20';
                };

                return (
                  <HoverCard key={item.id} openDelay={100} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div
                        className={cn(
                          "flex flex-col justify-between rounded-2xl p-4 transition-all duration-200 cursor-pointer h-28 border border-black/5 font-ui",
                          getCellColorClass(ratio)
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-90 truncate text-current">
                            {item.label.split(' - ').slice(-1)[0]}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-tight line-clamp-2 text-current">
                            {item.label.split(' - ')[0]}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-[10px] font-medium opacity-75">Cobertura</span>
                          <span className="text-lg font-black tracking-tight">{ratio.toFixed(0)}%</span>
                        </div>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80 rounded-2xl p-4 shadow-xl border border-border-default/80 bg-white font-ui text-sm z-50">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Contrato</p>
                          <p className="font-bold text-text-primary mt-0.5">{item.label}</p>
                        </div>

                        <div className="h-px bg-slate-100" />

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
                              <span className="text-text-muted font-semibold">Projetado Anual</span>
                              <span className="font-bold text-text-primary">{formatCurrency(item.projetado)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 text-xs">
                          <span className="font-semibold text-text-muted">Cobertura Realizada</span>
                          <span className={cn(
                            'font-black',
                            ratio < 70 ? 'text-rose-600' : ratio < 100 ? 'text-amber-600' : 'text-emerald-600'
                          )}>
                            {ratio.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
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
      </ChartPanel>
    </div>
  );
}
