import { useMemo, useState } from 'react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Filter,
  LayoutDashboard,
  RefreshCw,
  SlidersHorizontal,
  WalletCards,
} from 'lucide-react';
import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { useData } from '@/contexts/DataContext';
import { DIMENSOES, type Atividade, type Descentralizacao, type Empenho } from '@/types';
import { matchesDimensionFilter } from '@/utils/dimensionFilters';
import { formatCurrency } from '@/lib/utils';
import { isOrigemRecursoIgnoradaNoEmpenhado } from '@/pages/Dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PreviewTab = 'orcamento' | 'rap' | 'contratos';

const panelClass = 'rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]';
const mutedTextClass = 'text-[12px] leading-5 text-slate-500';

const toDate = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sum = (values: number[]) => values.reduce((total, value) => total + (Number(value) || 0), 0);

const getExecutionValue = (empenho: Empenho, kind: 'liquidado' | 'pago') => {
  if (kind === 'liquidado') return empenho.valorLiquidadoOficial ?? empenho.valorLiquidado ?? 0;
  return empenho.valorPagoOficial ?? empenho.valorPago ?? 0;
};

const getReferenceDate = (item: Atividade | Descentralizacao | Empenho) => {
  if ('dataEmpenho' in item) return toDate(item.dataEmpenho);
  if ('dataEmissao' in item) return toDate(item.dataEmissao) || toDate(item.createdAt);
  return toDate(item.createdAt);
};

const matchesDateFilter = (
  item: Atividade | Descentralizacao | Empenho,
  dateStart: string,
  dateEnd: string,
) => {
  if (!dateStart && !dateEnd) return true;
  const date = getReferenceDate(item);
  if (!date) return false;
  const start = dateStart ? startOfDay(parseISO(dateStart)) : new Date(2000, 0, 1);
  const end = dateEnd ? endOfDay(parseISO(dateEnd)) : new Date(2100, 0, 1);
  return isWithinInterval(date, { start, end });
};

const getDimensionLabel = (value: string) => {
  const match = DIMENSOES.find((dimension) => dimension.codigo === value || dimension.nome === value);
  return match?.nome || value || 'Sem dimensão';
};

function PreviewPanel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${panelClass} ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {description ? <p className={`mt-1 ${mutedTextClass}`}>{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  helper,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  color: string;
  icon: typeof WalletCards;
}) {
  return (
    <article className={`${panelClass} relative overflow-hidden p-5`}>
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-3 text-[25px] font-semibold tracking-[-0.025em] text-slate-950">{value}</p>
          <p className="mt-2 text-[12px] text-slate-500">{helper}</p>
        </div>
        <span className="rounded-md bg-slate-50 p-2.5 text-slate-600" aria-hidden="true">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>
    </article>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <p className="text-right text-[11px] tabular-nums text-slate-500">{percentage.toFixed(1)}% da base</p>
    </div>
  );
}

export default function DashboardCloudscapePreview() {
  const navigate = useNavigate();
  const {
    atividades,
    empenhos,
    descentralizacoes,
    contratos,
    isLoading,
    refreshData,
  } = useData();
  const [activeTab, setActiveTab] = useState<PreviewTab>('orcamento');
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const origensDisponiveis = useMemo(
    () => Array.from(new Set([...atividades.map((item) => item.origemRecurso), ...empenhos.map((item) => item.origemRecurso)])).filter(Boolean).sort(),
    [atividades, empenhos],
  );

  const filtered = useMemo(() => {
    const activityMatches = (item: Atividade) =>
      (filterDimensao === 'all' || matchesDimensionFilter(item.dimensao, filterDimensao)) &&
      (filterOrigem === 'all' || item.origemRecurso === filterOrigem) &&
      matchesDateFilter(item, dateStart, dateEnd);
    const empenhoMatches = (item: Empenho) =>
      (filterDimensao === 'all' || matchesDimensionFilter(item.dimensao, filterDimensao)) &&
      (filterOrigem === 'all' || item.origemRecurso === filterOrigem) &&
      matchesDateFilter(item, dateStart, dateEnd);
    const descentralizacaoMatches = (item: Descentralizacao) =>
      (filterDimensao === 'all' || matchesDimensionFilter(item.dimensao, filterDimensao)) &&
      (filterOrigem === 'all' || item.origemRecurso === filterOrigem) &&
      matchesDateFilter(item, dateStart, dateEnd);

    return {
      atividades: atividades.filter(activityMatches),
      empenhos: empenhos.filter(empenhoMatches),
      descentralizacoes: descentralizacoes.filter(descentralizacaoMatches),
    };
  }, [atividades, empenhos, descentralizacoes, filterDimensao, filterOrigem, dateStart, dateEnd]);

  const metrics = useMemo(() => {
    const currentEmpenhos = filtered.empenhos.filter((item) => item.tipo === 'exercicio' && item.status !== 'cancelado');
    const currentEmpenhosParaSoma =
      filterOrigem !== 'all'
        ? currentEmpenhos
        : currentEmpenhos.filter((item) => !isOrigemRecursoIgnoradaNoEmpenhado(item.origemRecurso));
    const rapEmpenhos = filtered.empenhos.filter((item) => item.tipo === 'rap' && item.status !== 'cancelado');
    const planejado = sum(filtered.atividades.map((item) => item.valorTotal));
    const empenhado = sum(currentEmpenhosParaSoma.map((item) => item.valor));
    const descentralizado = sum(filtered.descentralizacoes.map((item) => item.valor));
    const liquidado = sum(currentEmpenhos.map((item) => getExecutionValue(item, 'liquidado')));
    const pago = sum(currentEmpenhos.map((item) => getExecutionValue(item, 'pago')));
    const rapBase = sum(rapEmpenhos.map((item) => item.rapInscrito ?? item.rapALiquidar ?? item.valor));
    const rapSaldo = sum(rapEmpenhos.map((item) => item.saldoRapOficial ?? Math.max(0, (item.rapInscrito ?? item.valor) - (item.rapLiquidado ?? 0))));

    const monthly = Array.from({ length: 12 }, (_, month) => {
      const monthEnd = new Date(new Date().getFullYear(), month + 1, 0, 23, 59, 59);
      const plannedToDate = sum(filtered.atividades.filter((item) => (toDate(item.createdAt) || monthEnd) <= monthEnd).map((item) => item.valorTotal));
      const monthEmpenhos = currentEmpenhosParaSoma.filter((item) => (toDate(item.dataEmpenho) || monthEnd).getMonth() === month);
      const committedToDate = sum(currentEmpenhosParaSoma.filter((item) => (toDate(item.dataEmpenho) || monthEnd) <= monthEnd).map((item) => item.valor));
      const paidToDate = sum(currentEmpenhos.filter((item) => (toDate(item.dataEmpenho) || monthEnd) <= monthEnd).map((item) => getExecutionValue(item, 'pago')));
      return {
        name: format(new Date(new Date().getFullYear(), month, 1), 'MMM', { locale: ptBR }).replace('.', ''),
        planejado: plannedToDate,
        empenhado: committedToDate || sum(monthEmpenhos.map((item) => item.valor)),
        pago: paidToDate,
      };
    });

    const dimensionMap = new Map<string, { planejado: number; empenhado: number }>();
    filtered.atividades.forEach((item) => {
      const label = getDimensionLabel(item.dimensao);
      const row = dimensionMap.get(label) || { planejado: 0, empenhado: 0 };
      row.planejado += item.valorTotal;
      dimensionMap.set(label, row);
    });
    currentEmpenhos.forEach((item) => {
      const label = getDimensionLabel(item.dimensao);
      const row = dimensionMap.get(label) || { planejado: 0, empenhado: 0 };
      row.empenhado += item.valor;
      dimensionMap.set(label, row);
    });
    const dimensions = Array.from(dimensionMap.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.planejado - a.planejado)
      .slice(0, 8);

    const originMap = new Map<string, { planejado: number; empenhado: number; saldo: number }>();
    filtered.atividades.forEach((item) => {
      const row = originMap.get(item.origemRecurso) || { planejado: 0, empenhado: 0, saldo: 0 };
      row.planejado += item.valorTotal;
      originMap.set(item.origemRecurso, row);
    });
    currentEmpenhos.forEach((item) => {
      const row = originMap.get(item.origemRecurso) || { planejado: 0, empenhado: 0, saldo: 0 };
      row.empenhado += item.valor;
      row.saldo = row.planejado - row.empenhado;
      originMap.set(item.origemRecurso, row);
    });
    const origins = Array.from(originMap.entries()).map(([origem, values]) => ({ origem, ...values })).sort((a, b) => b.planejado - a.planejado).slice(0, 8);

    return {
      currentEmpenhos,
      rapEmpenhos,
      planejado,
      empenhado,
      descentralizado,
      liquidado,
      pago,
      saldo: planejado - empenhado,
      executionRate: planejado > 0 ? (empenhado / planejado) * 100 : 0,
      rapBase,
      rapSaldo,
      monthly,
      dimensions,
      origins,
    };
  }, [filtered]);

  const activeFiltersCount = [filterDimensao !== 'all', filterOrigem !== 'all', Boolean(dateStart || dateEnd)].filter(Boolean).length;
  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterOrigem('all');
    setDateStart('');
    setDateEnd('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-full space-y-5 bg-[#f7f8f8] pb-10 text-slate-900">
      <HeaderSubtitle>Protótipo Cloudscape · Dashboard</HeaderSubtitle>
      <HeaderActions>
        <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" onClick={() => void handleRefresh()} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar dados
        </Button>
      </HeaderActions>

      <div className="rounded-md border border-slate-300 bg-[#eaeded] px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="rounded-sm bg-[#2f9e41] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#2f9e41]">Protótipo</Badge>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">dados reais do sistema</span>
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-slate-950">Painel de governança orçamentária</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-600">Uma leitura operacional compacta para identificar execução, saldo e pontos que precisam de atenção.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:pt-1">
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" onClick={() => navigate('/')}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard atual
            </Button>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-9 gap-2 bg-white">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                  {activeFiltersCount > 0 ? <span className="rounded-full bg-[#2f9e41] px-1.5 text-[10px] font-semibold text-white">{activeFiltersCount}</span> : null}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros do painel</SheetTitle>
                  <SheetDescription>Refine a leitura sem sair do contexto do dashboard.</SheetDescription>
                </SheetHeader>
                <div className="space-y-5 py-6">
                  <div className="space-y-2">
                    <Label htmlFor="preview-dimensao">Dimensão</Label>
                    <select id="preview-dimensao" value={filterDimensao} onChange={(event) => setFilterDimensao(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#2f9e41] focus:ring-2 focus:ring-[#2f9e41]/20">
                      <option value="all">Todas as dimensões</option>
                      {DIMENSOES.map((dimension) => <option key={dimension.codigo} value={dimension.codigo}>{dimension.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preview-origem">Origem de recurso</Label>
                    <select id="preview-origem" value={filterOrigem} onChange={(event) => setFilterOrigem(event.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#2f9e41] focus:ring-2 focus:ring-[#2f9e41]/20">
                      <option value="all">Todas as origens</option>
                      {origensDisponiveis.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="preview-start">Período inicial</Label><Input id="preview-start" type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="preview-end">Período final</Label><Input id="preview-end" type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} /></div>
                  </div>
                </div>
                <SheetFooter className="gap-2 sm:justify-between">
                  <Button type="button" variant="ghost" onClick={clearFilters} disabled={activeFiltersCount === 0}>Limpar filtros</Button>
                  <SheetClose asChild><Button type="button" className="bg-[#2f9e41] text-white hover:bg-[#247d33]">Aplicar</Button></SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PreviewTab)}>
        <div className={`${panelClass} flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between`}>
          <TabsList className="h-9 w-full justify-start gap-1 bg-transparent p-0 sm:w-auto">
            {[
              { value: 'orcamento', label: 'Orçamento' },
              { value: 'rap', label: 'Restos a pagar' },
              { value: 'contratos', label: 'Contratos' },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-9 rounded-sm px-4 text-xs font-semibold text-slate-600 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm">{tab.label}</TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><Filter className="h-3.5 w-3.5" />{filtered.atividades.length} atividades · {filtered.empenhos.length} empenhos</div>
        </div>

        <TabsContent value="orcamento" className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Planejado" value={formatCurrency(metrics.planejado)} helper={`${filtered.atividades.length} atividades no recorte`} color="#1a5ce6" icon={WalletCards} />
            <KpiCard label="Empenhado" value={formatCurrency(metrics.empenhado)} helper={`${metrics.executionRate.toFixed(1)}% de execução`} color="#7c3aed" icon={CircleDollarSign} />
            <KpiCard label="Descentralizado" value={formatCurrency(metrics.descentralizado)} helper={`${filtered.descentralizacoes.length} lançamentos encontrados`} color="#0f766e" icon={ArrowUpRight} />
            <KpiCard label="Saldo disponível" value={formatCurrency(metrics.saldo)} helper="Planejado menos empenhado" color={metrics.saldo >= 0 ? '#2f9e41' : '#b42318'} icon={CheckCircle2} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
            <PreviewPanel title="Evolução da execução" description="Acumulado mensal calculado a partir dos lançamentos carregados" actions={<Badge variant="outline" className="rounded-sm text-[10px] font-medium">Recharts · preservado</Badge>}>
              <div className="h-[310px] w-full" aria-label="Gráfico de evolução da execução">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.monthly} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="preview-committed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.24} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient>
                      <linearGradient id="preview-paid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f9e41" stopOpacity={0.2} /><stop offset="95%" stopColor="#2f9e41" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} width={72} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 6, borderColor: '#d5dbdb', boxShadow: '0 2px 8px rgba(15,23,42,.08)' }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, color: '#475569' }} />
                    <Area type="monotone" dataKey="planejado" name="Planejado" stroke="#1a5ce6" strokeWidth={2} strokeDasharray="6 5" fill="transparent" />
                    <Area type="monotone" dataKey="empenhado" name="Empenhado" stroke="#7c3aed" strokeWidth={2.5} fill="url(#preview-committed)" />
                    <Area type="monotone" dataKey="pago" name="Pago" stroke="#2f9e41" strokeWidth={2.5} fill="url(#preview-paid)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </PreviewPanel>

            <PreviewPanel title="Caminho de execução" description="Acompanhamento do fluxo financeiro">
              <div className="space-y-5">
                <ProgressRow label="Empenhado" value={metrics.empenhado} total={metrics.planejado} color="#7c3aed" />
                <ProgressRow label="Liquidado" value={metrics.liquidado} total={metrics.empenhado} color="#f59e0b" />
                <ProgressRow label="Pago" value={metrics.pago} total={metrics.liquidado} color="#2f9e41" />
                <div className="rounded-md border border-[#b7dfbf] bg-[#f1faf3] px-3 py-3 text-[12px] leading-5 text-[#1f5e2c]">O fluxo apresenta <strong>{metrics.executionRate.toFixed(1)}%</strong> do planejado já empenhado.</div>
              </div>
            </PreviewPanel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PreviewPanel title="Planejamento por dimensão" description="Principais dimensões pelo valor planejado">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.dimensions} layout="vertical" margin={{ top: 0, right: 10, left: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="#eef0f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => `R$ ${(Number(value) / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={155} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 6, borderColor: '#d5dbdb' }} />
                    <Bar dataKey="planejado" name="Planejado" fill="#1a5ce6" radius={[0, 3, 3, 0]} barSize={18} />
                    <Bar dataKey="empenhado" name="Empenhado" fill="#7c3aed" radius={[0, 3, 3, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PreviewPanel>
            <PreviewPanel title="Resumo por origem" description="Base para priorização e acompanhamento">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12px]" aria-label="Resumo orçamentário por origem">
                  <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500"><th className="pb-3 pr-3 font-semibold">Origem</th><th className="pb-3 px-3 text-right font-semibold">Planejado</th><th className="pb-3 px-3 text-right font-semibold">Empenhado</th><th className="pb-3 pl-3 text-right font-semibold">Saldo</th></tr></thead>
                  <tbody>{metrics.origins.map((row) => <tr key={row.origem} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3 font-medium text-slate-700">{row.origem || 'Sem origem'}</td><td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatCurrency(row.planejado)}</td><td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatCurrency(row.empenhado)}</td><td className={`py-3 pl-3 text-right font-semibold tabular-nums ${row.saldo >= 0 ? 'text-[#247d33]' : 'text-[#b42318]'}`}>{formatCurrency(row.saldo)}</td></tr>)}</tbody>
                </table>
                {metrics.origins.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhum dado no recorte selecionado.</p> : null}
              </div>
            </PreviewPanel>
          </div>
        </TabsContent>

        <TabsContent value="rap" className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Base vigente" value={formatCurrency(metrics.rapBase)} helper={`${metrics.rapEmpenhos.length} empenhos de RAP`} color="#1a5ce6" icon={WalletCards} /><KpiCard label="Saldo atual" value={formatCurrency(metrics.rapSaldo)} helper="Saldo informado ou calculado" color="#2f9e41" icon={CircleDollarSign} /><KpiCard label="Liquidado" value={formatCurrency(sum(metrics.rapEmpenhos.map((item) => getExecutionValue(item, 'liquidado'))))} helper="Execução acumulada" color="#f59e0b" icon={CheckCircle2} /></div>
          <PreviewPanel title="Restos a pagar por origem" description="Visão compacta para acompanhamento do passivo"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]"><thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500"><th className="pb-3 pr-3 font-semibold">Empenho</th><th className="pb-3 px-3 font-semibold">Origem</th><th className="pb-3 px-3 text-right font-semibold">Base</th><th className="pb-3 pl-3 text-right font-semibold">Saldo</th></tr></thead><tbody>{metrics.rapEmpenhos.slice(0, 10).map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="py-3 pr-3 font-mono text-slate-700">{item.numero}</td><td className="px-3 py-3 text-slate-600">{item.origemRecurso || 'Sem origem'}</td><td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatCurrency(item.rapInscrito ?? item.rapALiquidar ?? item.valor)}</td><td className="py-3 pl-3 text-right font-semibold tabular-nums text-[#247d33]">{formatCurrency(item.saldoRapOficial ?? 0)}</td></tr>)}</tbody></table>{metrics.rapEmpenhos.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhum RAP no recorte selecionado.</p> : null}</div></PreviewPanel>
        </TabsContent>

        <TabsContent value="contratos" className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3"><KpiCard label="Contratos locais" value={String(contratos.length)} helper="Registros disponíveis no contexto" color="#1a5ce6" icon={LayoutDashboard} /><KpiCard label="Empenhos vinculados" value={String(filtered.empenhos.filter((item) => contratos.some((contrato) => contrato.numero && item.numero.includes(contrato.numero))).length)} helper="Correspondências por número" color="#7c3aed" icon={CircleDollarSign} /><KpiCard label="Visão operacional" value="Ativa" helper="Use a aba Contratos atual para detalhes" color="#2f9e41" icon={CheckCircle2} /></div>
          <PreviewPanel title="Acesso rápido à execução de contratos" description="O protótipo mantém o gráfico de contratos atual na tela de produção"><div className="flex flex-col items-start gap-4 rounded-md border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">A análise completa continua disponível no dashboard atual.</p><p className={`mt-1 ${mutedTextClass}`}>Esta aba demonstra como o shell Cloudscape pode coexistir antes de substituir fluxos complexos.</p></div><Button className="h-9 gap-2 bg-[#2f9e41] text-white hover:bg-[#247d33]" onClick={() => navigate('/')}>Abrir execução atual <ArrowUpRight className="h-4 w-4" /></Button></div></PreviewPanel>
        </TabsContent>
      </Tabs>

      <p className="text-center text-[11px] text-slate-500">Protótipo visual isolado · shell inspirado no Cloudscape · gráficos e dados permanecem no stack atual.</p>
    </div>
  );
}
