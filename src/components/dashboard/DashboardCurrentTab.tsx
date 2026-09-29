import { useState } from 'react';
import { PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '@/components/StatCard';
import { ChartPanel } from '@/components/design-system/ChartPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { Atividade, Descentralizacao, Empenho } from '@/types';
import { ExecutionTooltip } from './DashboardChartBits';
import { GaugeChart } from './GaugeChart';
import { DashboardOrigemAtividadesModal } from './DashboardOrigemAtividadesModal';
import { formatCompactCurrency } from './utils';

type DashboardFilteredData = {
  atividades: Atividade[];
  empenhosCorrente: Empenho[];
  empenhosRap: Empenho[];
  descentralizacoes: Descentralizacao[];
};

type OrigemResumo = {
  origem: string;
  planejado: number;
  empenhado: number;
  saldo: number;
  percentual: number;
};

type MensalResumo = {
  name: string;
  planejado: number;
  empenhado: number;
  liquidado: number;
};

type NaturezaResumo = {
  name: string;
  value: number;
};

type BudgetTreemapChild = {
  name: string;
  dimensionCode: string;
  value: number;
  fill: string;
  textColor: string;
  nodeType: string;
  parentName: string;
};

type BudgetTreemapNode = {
  name: string;
  dimensionCode: string;
  value: number;
  fill: string;
  textColor: string;
  nodeType: string;
  children: BudgetTreemapChild[];
};

const EXECUTION_CHART_COLORS = {
  planejado: '#1565C0',
  empenhado: '#1E88E5',
  liquidado: '#00B7DC',
} as const;

// Paleta de séries do design system Céu (azul-céu, ciano, azul profundo, âmbar, verde, cinza-azulado)
const SERIES_COLORS = ['#1E88E5', '#00B7DC', '#1565C0', '#F2A93B', '#2E9E6A', '#7C8DA6', '#90CAF9', '#D64545'];

type DashboardCurrentTabProps = {
  isLoading: boolean;
  filteredData: DashboardFilteredData;
  totalPlanejado: number;
  totalEmpenhado: number;
  totalDescentralizado: number;
  aDescentralizar: number;
  percentualExecutado: number;
  totalLiquidado: number;
  totalPago: number;
  dadosPorOrigem: OrigemResumo[];
  dadosMensais: MensalResumo[];
  budgetTreemapData: BudgetTreemapNode[];
  activeBudgetDimension: string | null;
  highlightedBudgetDimension: string | null;
  hoveredBudgetDimension: string | null;
  onHoverBudgetDimension: (value: string | null) => void;
  onSelectBudgetDimension: (value?: string | null) => void;
  dadosDescentralizacao: Array<Record<string, string | number>>;
  uniqueOrigens: string[];
  dadosPorNatureza: NaturezaResumo[];
  onSuccessAtividade?: () => void;
};

export function DashboardCurrentTab({
  isLoading,
  filteredData,
  totalPlanejado,
  totalEmpenhado,
  totalDescentralizado,
  aDescentralizar,
  totalLiquidado,
  totalPago,
  dadosPorOrigem,
  dadosMensais,
  budgetTreemapData,
  activeBudgetDimension,
  highlightedBudgetDimension,
  hoveredBudgetDimension,
  onHoverBudgetDimension,
  onSelectBudgetDimension,
  dadosDescentralizacao,
  uniqueOrigens,
  dadosPorNatureza,
  onSuccessAtividade,
}: DashboardCurrentTabProps) {
  const [selectedOrigem, setSelectedOrigem] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleRowClick = (origem: string) => {
    setSelectedOrigem(origem);
    setIsModalOpen(true);
  };

  const percent = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

  const funnelSteps = [
    {
      label: 'Planejado',
      value: totalPlanejado,
      ratio: 100,
      ratioLabel: `${filteredData.atividades.length} atividades`,
      barClassName: 'bg-primary',
    },
    {
      label: 'Empenhado',
      value: totalEmpenhado,
      ratio: percent(totalEmpenhado, totalPlanejado),
      ratioLabel: `${percent(totalEmpenhado, totalPlanejado).toFixed(1)}% do planejado · ${percent(totalEmpenhado, totalDescentralizado).toFixed(1)}% do descentralizado`,
      barClassName: 'bg-brand-sky',
    },
    {
      label: 'Liquidado',
      value: totalLiquidado,
      ratio: percent(totalLiquidado, totalPlanejado),
      ratioLabel: `${percent(totalLiquidado, totalEmpenhado).toFixed(1)}% do empenhado · ${percent(totalLiquidado, totalDescentralizado).toFixed(1)}% do descentralizado`,
      barClassName: 'bg-brand-cyan',
    },
    {
      label: 'Pago',
      value: totalPago,
      ratio: percent(totalPago, totalPlanejado),
      ratioLabel: `${percent(totalPago, totalLiquidado).toFixed(1)}% do liquidado`,
      barClassName: 'bg-brand-green',
    },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Indicadores de execução" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Planejado"
          value={formatCurrency(totalPlanejado)}
          icon={Wallet}
          stitchColor="vibrant-blue"
          progress={100}
          isLoading={isLoading}
        />
        <StatCard
          title="Descentralizado"
          value={formatCurrency(totalDescentralizado)}
          icon={Receipt}
          stitchColor={aDescentralizar >= 0 ? 'emerald-green' : 'red-500'}
          progress={percent(totalDescentralizado, totalPlanejado)}
          progressLabel="do planejado"
          isLoading={isLoading}
        />
        <StatCard
          title="Empenhado"
          value={formatCurrency(totalEmpenhado)}
          icon={TrendingUp}
          stitchColor="purple"
          progress={percent(totalEmpenhado, totalPlanejado)}
          progressLabel="do planejado"
          isLoading={isLoading}
        />
        <div data-testid="liquidado-pago-card" className="rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow duration-200 hover:shadow-md">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Liquidado / Pago</p>
            <PiggyBank className="h-4 w-4 shrink-0 text-success" />
          </div>
          <div className="space-y-3">
            {[
              { label: 'Liquidado', value: totalLiquidado, ratio: percent(totalLiquidado, totalEmpenhado), bar: 'bg-brand-cyan', text: 'text-brand-aqua' },
              { label: 'Pago', value: totalPago, ratio: percent(totalPago, totalLiquidado), bar: 'bg-brand-green', text: 'text-brand-green' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  {isLoading ? (
                    <span className="h-4 w-24 animate-pulse rounded bg-muted" />
                  ) : (
                    <span className={`text-base font-bold tracking-tight ${item.text}`}>{formatCurrency(item.value)}</span>
                  )}
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-spring ${item.bar}`}
                    style={{ width: `${Math.min(item.ratio, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Velocímetros de execução" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { title: 'Empenhado / Descentralizado', value: totalEmpenhado, label: 'Empenhado' },
          { title: 'Liquidado / Descentralizado', value: totalLiquidado, label: 'Liquidado' },
        ].map((gauge) => (
          <div
            key={gauge.title}
            className="flex min-h-[226px] items-stretch justify-center rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow duration-200 hover:shadow-md"
          >
            <div className="flex w-full max-w-[420px] flex-col items-center justify-between">
              <p className="mb-1 text-center text-xs font-semibold text-muted-foreground">{gauge.title}</p>
              <GaugeChart
                value={gauge.value}
                total={totalDescentralizado}
                label={gauge.label}
                sublabel="sobre Descentralizado"
                isLoading={isLoading}
              />
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <ChartPanel
          className="h-full lg:col-span-2"
          title="Evolução da execução"
          loading={isLoading}
          actions={
            <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
              {(['planejado', 'empenhado', 'liquidado'] as const).map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5 capitalize">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXECUTION_CHART_COLORS[key] }} />
                  {key}
                </span>
              ))}
            </div>
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosMensais} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmpenhado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EXECUTION_CHART_COLORS.empenhado} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={EXECUTION_CHART_COLORS.empenhado} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorLiquidado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EXECUTION_CHART_COLORS.liquidado} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={EXECUTION_CHART_COLORS.liquidado} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
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
                <Tooltip content={<ExecutionTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="empenhado" stroke={EXECUTION_CHART_COLORS.empenhado} strokeWidth={2.5} fill="url(#colorEmpenhado)" name="Empenhado" />
                <Area type="monotone" dataKey="liquidado" stroke={EXECUTION_CHART_COLORS.liquidado} strokeWidth={2.5} fill="url(#colorLiquidado)" name="Liquidado" />
                <Line
                  type="monotone"
                  dataKey="planejado"
                  stroke={EXECUTION_CHART_COLORS.planejado}
                  strokeWidth={2}
                  strokeDasharray="7 7"
                  dot={false}
                  activeDot={{ r: 4, fill: EXECUTION_CHART_COLORS.planejado, stroke: '#ffffff', strokeWidth: 2 }}
                  name="Planejado"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Funil de execução" loading={isLoading} className="h-full">
          <ol className="space-y-4" aria-label="Funil de execução">
            {funnelSteps.map((step) => (
              <li key={step.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-bold text-foreground">{step.label}</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(step.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-spring ${step.barClassName}`}
                    style={{ width: `${Math.min(step.ratio, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{step.ratioLabel}</p>
              </li>
            ))}
          </ol>
        </ChartPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel
          title="Descentralizações"
          loading={isLoading}
          heightClassName="h-[350px]"
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosDescentralizacao} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-muted-foreground" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fill: 'currentColor', fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                {uniqueOrigens.map((origem, index) => (
                  <Bar
                    key={origem}
                    dataKey={origem}
                    stackId="a"
                    fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                    radius={index === uniqueOrigens.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                    barSize={24}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Top naturezas"
          loading={isLoading}
          heightClassName="h-[350px]"
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPorNatureza} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} tick={{ fill: 'currentColor', fontSize: 12 }} className="text-muted-foreground" />
                <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'currentColor', fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill={SERIES_COLORS[0]} name="Valor gasto" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <Card className="card-system overflow-hidden">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle>Detalhamento por origem</CardTitle>
          <CardDescription>
            Execução por fonte de recurso. Selecione uma linha para ver as atividades com saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="border-b border-border-default/50 hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Planejado</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Empenhado</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Execução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosPorOrigem.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center italic text-muted-foreground">
                      Nenhuma origem de recurso correspondente aos filtros foi encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  dadosPorOrigem.map((item, index) => (
                    <TableRow
                      key={index}
                      className="border-b transition-colors last:border-0 row-hover cursor-pointer group focus-visible:outline-none focus-visible:bg-accent"
                      onClick={() => handleRowClick(item.origem)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(item.origem);
                        }
                      }}
                      title={`Clique para ver as atividades com saldo da origem ${item.origem}`}
                    >
                      <TableCell className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {item.origem}
                          </span>
                          <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 font-normal">
                            (ver atividades)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right font-mono text-sm">{formatCurrency(item.planejado)}</TableCell>
                      <TableCell className="px-4 py-4 text-right font-mono text-sm">{formatCurrency(item.empenhado)}</TableCell>
                      <TableCell className={`px-4 py-4 text-right font-mono text-sm font-semibold ${item.saldo >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {formatCurrency(item.saldo)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={Math.min(item.percentual, 100)} className="h-2 w-16" />
                          <span className="w-12 text-right text-sm text-muted-foreground">{item.percentual.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DashboardOrigemAtividadesModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        origem={selectedOrigem}
        atividades={filteredData.atividades}
        empenhos={filteredData.empenhosCorrente}
        onSuccessAtividade={onSuccessAtividade}
      />
    </div>
  );
}
