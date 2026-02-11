import { useState, useMemo } from 'react';
import {
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  ArrowDownRight,
  Filter,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  AreaChart,
  Area,
  Line
} from 'recharts';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DIMENSOES } from '@/types';
import { formatCurrency } from '@/lib/utils';


export default function Dashboard() {
  const { atividades, empenhos } = useData();

  // --- Filtros ---
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Extrair Origens Únicas para o Filtro
  const origensDisponiveis = useMemo(() => {
    const origens = new Set<string>();
    atividades.forEach(a => { if (a.origemRecurso) origens.add(a.origemRecurso); });
    empenhos.forEach(e => { if (e.origemRecurso) origens.add(e.origemRecurso); });
    return Array.from(origens).sort();
  }, [atividades, empenhos]);

  // --- Dados Filtrados ---
  const filteredData = useMemo(() => {
    // Filtrar Atividades (Planejado)
    const filteredAtividades = atividades.filter(a => {
      const matchDimensao = filterDimensao === 'all' || a.dimensao.includes(filterDimensao);
      const matchOrigem = filterOrigem === 'all' || a.origemRecurso === filterOrigem;
      return matchDimensao && matchOrigem;
    });

    // Filtrar Empenhos (Executado)
    const filteredEmpenhos = empenhos.filter(e => {
      const matchDimensao = filterDimensao === 'all' || e.dimensao.includes(filterDimensao);
      const matchOrigem = filterOrigem === 'all' || e.origemRecurso === filterOrigem;

      let matchDate = true;
      if (dateStart && dateEnd) {
        const d = new Date(e.dataEmpenho);
        const start = startOfDay(parseISO(dateStart));
        const end = endOfDay(parseISO(dateEnd));
        matchDate = isWithinInterval(d, { start, end });
      }

      return matchDimensao && matchOrigem && matchDate && e.status !== 'cancelado';
    });

    return { atividades: filteredAtividades, empenhos: filteredEmpenhos };
  }, [atividades, empenhos, filterDimensao, filterOrigem, dateStart, dateEnd]);

  // --- KPI Calculations ---
  const totalPlanejado = filteredData.atividades.reduce((acc, a) => acc + a.valorTotal, 0);
  const totalEmpenhado = filteredData.empenhos.reduce((acc, e) => acc + e.valor, 0);
  const saldoTotal = totalPlanejado - totalEmpenhado;
  const percentualExecutado = totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0;

  const totalLiquidado = filteredData.empenhos.reduce((acc, e) => acc + (e.valorLiquidado || 0), 0);
  const totalPago = filteredData.empenhos.filter(e => e.status === 'pago').reduce((acc, e) => acc + e.valor, 0);

  // --- Gráficos & Tabelas ---

  // 1. Resumo por Origem
  const dadosPorOrigem = useMemo(() => {
    const map = new Map<string, { planejado: number; empenhado: number }>();

    filteredData.atividades.forEach((a) => {
      const existing = map.get(a.origemRecurso) || { planejado: 0, empenhado: 0 };
      existing.planejado += a.valorTotal;
      map.set(a.origemRecurso, existing);
    });

    filteredData.empenhos.forEach((e) => {
      const existing = map.get(e.origemRecurso) || { planejado: 0, empenhado: 0 };
      existing.empenhado += e.valor;
      map.set(e.origemRecurso, existing);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        planejado: values.planejado,
        empenhado: values.empenhado,
        saldo: values.planejado - values.empenhado,
        percentual: values.planejado > 0 ? (values.empenhado / values.planejado) * 100 : 0
      }))
      .filter(item => item.planejado > 0 || item.empenhado > 0)
      .sort((a, b) => b.planejado - a.planejado);
  }, [filteredData]);

  // 2. Top 5 Componentes
  const dadosPorComponente = useMemo(() => {
    const map = new Map<string, { planejado: number; empenhado: number }>();
    const normalize = (s: string) => s?.trim() || 'Não Informado';

    filteredData.atividades.forEach((a) => {
      const key = normalize(a.componenteFuncional);
      const existing = map.get(key) || { planejado: 0, empenhado: 0 };
      existing.planejado += a.valorTotal;
      map.set(key, existing);
    });

    filteredData.empenhos.forEach((e) => {
      const key = normalize(e.componenteFuncional);
      const existing = map.get(key) || { planejado: 0, empenhado: 0 };
      existing.empenhado += e.valor;
      map.set(key, existing);
    });

    return Array.from(map.entries())
      .map(([name, values]) => ({
        name,
        planejado: values.planejado,
        empenhado: values.empenhado,
      }))
      .sort((a, b) => b.planejado - a.planejado)
      .slice(0, 5);
  }, [filteredData]);

  // 3. Natureza de Despesa
  const dadosPorNatureza = useMemo(() => {
    const map = new Map<string, number>();
    filteredData.empenhos.forEach((e) => {
      const nature = e.naturezaDespesa.split(' - ')[0];
      map.set(nature, (map.get(nature) || 0) + e.valor);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  // 4. Evolução Mensal
  const dadosMensais = useMemo(() => {
    const mapAcumulado = new Map<string, number>();
    const sortedEmpenhos = [...filteredData.empenhos].sort((a, b) => new Date(a.dataEmpenho).getTime() - new Date(b.dataEmpenho).getTime());

    sortedEmpenhos.forEach(e => {
      const mes = format(new Date(e.dataEmpenho), 'MMM/yy', { locale: ptBR });
      mapAcumulado.set(mes, (mapAcumulado.get(mes) || 0) + e.valor);
    });

    let acc = 0;
    return Array.from(mapAcumulado.entries()).map(([mes, val]) => {
      acc += val;
      return { name: mes, empenhado: val, acumulado: acc };
    });
  }, [filteredData]);

  // 5. Funil
  const dadosFunil = [
    { name: 'Planejado', value: totalPlanejado, fill: '#1e5bb0' },
    { name: 'Empenhado', value: totalEmpenhado, fill: '#f59e0b' },
    { name: 'Liquidado', value: totalLiquidado, fill: '#3b82f6' },
    { name: 'Pago', value: totalPago, fill: '#22c55e' },
  ];

  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterOrigem('all');
    setDateStart('');
    setDateEnd('');
  };

  const hasActiveFilters = filterDimensao !== 'all' || filterOrigem !== 'all' || dateStart !== '' || dateEnd !== '';
  const activeFiltersCount = [filterDimensao !== 'all', filterOrigem !== 'all', (dateStart !== '' || dateEnd !== '')].filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Header com Botão de Filtro */}
      <div className="flex justify-end mb-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 relative">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filtrar Dashboard</SheetTitle>
              <SheetDescription>
                Selecione os critérios para visualizar os dados.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Dimensão</Label>
                <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {DIMENSOES.map((d) => (
                      <SelectItem key={d.codigo} value={d.codigo}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Origem de Recurso</Label>
                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {origensDisponiveis.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período de Início</Label>
                <Input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Período Final</Label>
                <Input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                />
              </div>
            </div>
            <SheetFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Limpar Filtros
                </Button>
              )}
              <SheetClose asChild>
                <Button type="submit" className="w-full">Aplicar</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* KPI Cards (rest of the dashboard remains the same) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* ... (Same Stats) */}
        <StatCard
          title="Total Planejado"
          value={formatCurrency(totalPlanejado)}
          subtitle={`${filteredData.atividades.length} atividades filtradas`}
          icon={Wallet}
          variant="primary"
        />
        <StatCard
          title="Total Empenhado"
          value={formatCurrency(totalEmpenhado)}
          subtitle={`${filteredData.empenhos.length} empenhos filtrados`}
          icon={Receipt}
          variant="accent"
        />
        <StatCard
          title="Saldo Disponível"
          value={formatCurrency(saldoTotal)}
          subtitle={saldoTotal >= 0 ? 'Dentro do orçamento' : 'Orçamento excedido'}
          icon={saldoTotal >= 0 ? PiggyBank : ArrowDownRight}
          variant={saldoTotal >= 0 ? 'default' : 'warning'}
        />
        <StatCard
          title="Execução"
          value={`${percentualExecutado.toFixed(1)}%`}
          subtitle="do orçamento filtrado"
          icon={TrendingUp}
          variant="default"
        />
      </div>

      {/* Progresso Geral */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">Progresso da Execução</CardTitle>
          <CardDescription>Visão geral do consumo do orçamento selecionado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(totalEmpenhado)} de {formatCurrency(totalPlanejado)}
              </span>
              <span className="font-medium text-primary">{percentualExecutado.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(percentualExecutado, 100)} className="h-4" />
          </div>
        </CardContent>
      </Card>

      {/* Gráficos Linha 1 */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Evolução da Execução</CardTitle>
            <CardDescription>Acumulado de empenhos no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosMensais} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e5bb0" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#1e5bb0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area
                    type="monotone"
                    dataKey="acumulado"
                    stroke="#1e5bb0"
                    fillOpacity={1}
                    fill="url(#colorAcumulado)"
                    name="Acumulado"
                  />
                  <Line type="monotone" dataKey="empenhado" stroke="#f59e0b" name="Mensal" strokeDasharray="5 5" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de Execução</CardTitle>
            <CardDescription>Eficiência da despesa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFunil} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                    {dadosFunil.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Linha 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Componentes</CardTitle>
            <CardDescription>Maiores orçamentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorComponente} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="planejado" fill="#1e5bb0" name="Planejado" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="empenhado" fill="#f59e0b" name="Empenhado" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Naturezas</CardTitle>
            <CardDescription>Maiores gastos por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorNatureza} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#2a8f5c" name="Valor Gasto" radius={[0, 4, 4, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Origem</CardTitle>
          <CardDescription>Execução financeira por fonte de recurso</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Origem de Recurso</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Planejado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Empenhado</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Saldo</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Execução</th>
                </tr>
              </thead>
              <tbody>
                {dadosPorOrigem.map((item, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-sm font-medium">{item.origem}</td>
                    <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.planejado)}</td>
                    <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.empenhado)}</td>
                    <td className={`py-3 px-4 text-sm text-right font-medium ${item.saldo >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {formatCurrency(item.saldo)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={Math.min(item.percentual, 100)} className="w-16 h-2" />
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {item.percentual.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
