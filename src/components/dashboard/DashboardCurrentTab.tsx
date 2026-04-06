import { ArrowDown, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
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
  Treemap,
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
import { BudgetHierarchyTooltip, BudgetTreemapContent, ExecutionTooltip } from './DashboardChartBits';
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
  pago: number;
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
};

export function DashboardCurrentTab({
  isLoading,
  filteredData,
  totalPlanejado,
  totalEmpenhado,
  totalDescentralizado,
  aDescentralizar,
  percentualExecutado,
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
}: DashboardCurrentTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 auto-rows-[minmax(130px,auto)] md:grid-cols-3">
        <div
          className={`
            relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-6 shadow-[0_8px_30px_rgba(26,92,230,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(26,92,230,0.18)]
            md:row-span-2
          `}
        >
          <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary/60">Total Planejado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filteredData.atividades.length} atividades filtradas
              </p>
            </div>
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="mt-2 h-10 w-4/5 animate-pulse rounded-lg bg-primary/10" />
            ) : (
              <p
                className={`
                  mt-2 mb-4 bg-gradient-to-br from-[#1a5ce6] to-[#3b82f6] bg-clip-text text-3xl font-black leading-none tracking-tighter text-transparent
                  lg:text-4xl
                `}
              >
                {formatCurrency(totalPlanejado)}
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Execucao orcamentaria</span>
                <span className="font-bold text-primary">{percentualExecutado.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700 ease-spring"
                  style={{ width: `${Math.min(percentualExecutado, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalEmpenhado)} empenhados</p>
            </div>
          </div>
        </div>

        <div>
          <StatCard
            title="Descentralizado"
            value={formatCurrency(totalDescentralizado)}
            subtitle={`${filteredData.descentralizacoes.length} descentralizacoes`}
            icon={Receipt}
            stitchColor="emerald-green"
            progress={totalPlanejado > 0 ? (totalDescentralizado / totalPlanejado) * 100 : 0}
            isLoading={isLoading}
          />
        </div>

        <div>
          <StatCard
            title="Total Empenhado"
            value={formatCurrency(totalEmpenhado)}
            subtitle={`${filteredData.empenhosCorrente.length} empenhos filtrados`}
            icon={TrendingUp}
            stitchColor="purple"
            progress={totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0}
            isLoading={isLoading}
          />
        </div>

        <div>
          <StatCard
            title="A Descentralizar"
            value={formatCurrency(aDescentralizar)}
            subtitle={aDescentralizar >= 0 ? 'Dentro do orcamento' : 'Acima do orcamento'}
            icon={PiggyBank}
            stitchColor="amber"
            progress={totalPlanejado > 0 ? (Math.max(0, aDescentralizar) / totalPlanejado) * 100 : 0}
            isLoading={isLoading}
          />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-[1px] hover:shadow-card">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Liquidado / Pago</p>

          <div className="mt-2 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Liquidado</span>
                {isLoading ? (
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <span className="bg-gradient-to-r from-[#b45309] to-[#f59e0b] bg-clip-text text-sm font-black tracking-tight text-transparent">
                    {formatCurrency(totalLiquidado)}
                  </span>
                )}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f59e0b]/70 to-[#f59e0b] transition-all duration-700 ease-spring"
                  style={{ width: totalEmpenhado > 0 ? `${Math.min((totalLiquidado / totalEmpenhado) * 100, 100)}%` : '0%' }}
                />
              </div>
            </div>

            <div className="h-px bg-border/60" />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pago</span>
                {isLoading ? (
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                ) : (
                  <span className="bg-gradient-to-r from-[#047857] to-[#10b981] bg-clip-text text-sm font-black tracking-tight text-transparent">
                    {formatCurrency(totalPago)}
                  </span>
                )}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#10b981]/70 to-[#10b981] transition-all duration-700 ease-spring"
                  style={{ width: totalLiquidado > 0 ? `${Math.min((totalPago / totalLiquidado) * 100, 100)}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <ChartPanel
          className="md:col-span-2"
          title="Evolucao da Execucao"
          description="Acumulado de empenhos no periodo"
          loading={isLoading}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Planejado
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/8 px-3 py-1 text-xs font-semibold text-fuchsia-700">
              <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
              Empenhado
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/8 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Pago
            </span>
          </div>

          <div className="h-[300px] rounded-[22px] border border-border-default/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.85))] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosMensais} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEmpenhado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe3f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={74}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={formatCompactCurrency}
                />
                <Tooltip content={<ExecutionTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="empenhado" stroke="#a855f7" strokeWidth={2.5} fill="url(#colorEmpenhado)" name="Empenhado" />
                <Area type="monotone" dataKey="pago" stroke="#10b981" strokeWidth={2.5} fill="url(#colorPago)" name="Pago" />
                <Line
                  type="monotone"
                  dataKey="planejado"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="7 7"
                  dot={false}
                  activeDot={{ r: 4, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
                  name="Planejado"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle>Funil de Execucao</CardTitle>
            <CardDescription>Eficiencia da despesa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex min-h-[300px] flex-1 flex-col justify-center gap-4 py-4">
              <div className="absolute left-1/2 top-0 bottom-0 z-0 hidden w-px -translate-x-1/2 bg-slate-100 md:block" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="w-full max-w-[240px] rounded-lg bg-vibrant-blue px-4 py-3 text-center text-white shadow-sm">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/85">Planejado</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(totalPlanejado)}</p>
                </div>

                <div className="flex h-6 items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-slate-300" />
                </div>

                <div className="relative w-11/12 max-w-[220px] rounded-lg bg-purple px-4 py-3 text-center text-white shadow-sm">
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-purple shadow-sm md:block">
                    {totalPlanejado ? ((totalEmpenhado / totalPlanejado) * 100).toFixed(1) : '0'}%
                  </div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/85">Empenhado</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(totalEmpenhado)}</p>
                </div>

                <div className="flex h-6 items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-slate-300" />
                </div>

                <div className="relative w-5/6 max-w-[200px] rounded-lg bg-amber px-4 py-3 text-center text-white shadow-sm">
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber shadow-sm md:block">
                    {totalEmpenhado ? ((totalLiquidado / totalEmpenhado) * 100).toFixed(1) : '0'}%
                  </div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/85">Liquidado</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(totalLiquidado)}</p>
                </div>

                <div className="flex h-6 items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-slate-300" />
                </div>

                <div className="relative w-4/5 max-w-[180px] rounded-lg bg-emerald-green px-4 py-3 text-center text-white shadow-sm">
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-100 bg-white px-1.5 py-0.5 text-[10px] font-bold text-emerald-green shadow-sm md:block">
                    {totalLiquidado ? ((totalPago / totalLiquidado) * 100).toFixed(1) : '0'}%
                  </div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-white/85">Pago</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(totalPago)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <ChartPanel
          title="Distribuicao do Orcamento (Dimensao x Componentes Funcionais)"
          description="Composicao do Planejado por area de atuacao e programas"
          loading={isLoading}
          heightClassName="h-[468px]"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {budgetTreemapData.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.06)] transition-all ${
                    activeBudgetDimension === item.name
                      ? 'border-slate-400 bg-white text-text-primary shadow-[0_12px_28px_rgba(15,23,42,0.14)] ring-2 ring-slate-200/80'
                      : hoveredBudgetDimension === item.name
                        ? 'border-slate-300 bg-white text-text-primary shadow-[0_10px_24px_rgba(15,23,42,0.12)]'
                        : hoveredBudgetDimension && hoveredBudgetDimension !== item.name
                          ? 'border-border-default/40 bg-white/55 text-text-muted opacity-60'
                          : 'border-border-default/60 bg-white/85 text-text-secondary'
                  }`}
                  title={`${item.name} | ${formatCurrency(item.value || 0)}`}
                  onClick={() => onSelectBudgetDimension(item.dimensionCode)}
                  onMouseEnter={() => onHoverBudgetDimension(item.name)}
                  onMouseLeave={() => onHoverBudgetDimension(null)}
                  onFocus={() => onHoverBudgetDimension(item.name)}
                  onBlur={() => onHoverBudgetDimension(null)}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="max-w-[220px] truncate font-ui text-xs font-semibold">{item.name}</span>
                </button>
              ))}
            </div>

            <div className="h-[400px] rounded-[24px] border border-border-default/60 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.06),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.92))] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={budgetTreemapData}
                  dataKey="value"
                  aspectRatio={16 / 9}
                  stroke="#ffffff"
                  isAnimationActive={false}
                  content={<BudgetTreemapContent highlightedDimension={highlightedBudgetDimension} />}
                  onClick={(node: { dimensionCode?: string }) => onSelectBudgetDimension(node.dimensionCode)}
                >
                  <Tooltip content={<BudgetHierarchyTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartPanel
          title="Descentralizacoes"
          description="Volume distribuido por Dimensao"
          loading={isLoading}
          heightClassName="h-[350px]"
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosDescentralizacao} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                {uniqueOrigens.map((origem, index) => {
                  const colors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];
                  return (
                    <Bar
                      key={origem}
                      dataKey={origem}
                      stackId="a"
                      fill={colors[index % colors.length]}
                      radius={index === uniqueOrigens.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                      barSize={24}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Top Naturezas"
          description="Valor empenhado por Natureza de Despesa"
          loading={isLoading}
          heightClassName="h-[350px]"
        >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPorNatureza} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#10b981" name="Valor Gasto" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <Card className="card-system overflow-hidden">
        <CardHeader className="border-b border-border-default/50 px-6 py-4">
          <CardTitle className="table-title">Detalhamento por Origem</CardTitle>
          <CardDescription>Execucao financeira por fonte de recurso</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-border-default/50 hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Planejado</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Empenhado</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Execucao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosPorOrigem.map((item, index) => (
                  <TableRow key={index} className="border-b transition-colors last:border-0 hover:bg-slate-50/80">
                    <TableCell className="px-6 py-4 text-sm font-medium">{item.origem}</TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.planejado)}</TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.empenhado)}</TableCell>
                    <TableCell className={`px-4 py-4 text-right text-sm font-medium ${item.saldo >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {formatCurrency(item.saldo)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={Math.min(item.percentual, 100)} className="h-2 w-16" />
                        <span className="w-12 text-right text-sm text-muted-foreground">{item.percentual.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
