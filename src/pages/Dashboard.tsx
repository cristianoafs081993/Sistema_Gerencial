import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, scaleIn } from '@/lib/animations';
import {
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  ArrowDownRight,
  Filter,
  X,
  SlidersHorizontal,
  Flag,
  Lock,
  ArrowDown
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  const { atividades, empenhos, descentralizacoes, getTotalDescentralizado, getADescentralizar, isLoading } = useData();

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
    descentralizacoes.forEach(d => { if (d.origemRecurso) origens.add(d.origemRecurso); });
    return Array.from(origens).sort();
  }, [atividades, empenhos, descentralizacoes]);

  // --- Dados Filtrados ---
  const filteredData = useMemo(() => {
    // Filtrar Atividades (Planejado)
    const filteredAtividades = atividades.filter(a => {
      const matchDimensao = filterDimensao === 'all' || a.dimensao.includes(filterDimensao);
      const matchOrigem = filterOrigem === 'all' || a.origemRecurso === filterOrigem;
      return matchDimensao && matchOrigem;
    });

    // Filtrar Empenhos (Executado)
    const empenhosCorrente = empenhos.filter(e => e.tipo === 'exercicio');
    const empenhosRap = empenhos.filter(e => e.tipo === 'rap');

    const filteredEmpenhosCorrente = empenhosCorrente.filter(e => {
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

    const filteredEmpenhosRap = empenhosRap.filter(e => {
      const matchDimensao = filterDimensao === 'all' || e.dimensao.includes(filterDimensao);
      const matchOrigem = filterOrigem === 'all' || e.origemRecurso === filterOrigem;

      // RAP date filter might be based on ultimaAtualizacaoSiafi or ignored, we'll keep the same date logic for simplicity but use dataEmpenho which is usually 01/01
      let matchDate = true;
      if (dateStart && dateEnd) {
        const d = new Date(e.dataEmpenho);
        const start = startOfDay(parseISO(dateStart));
        const end = endOfDay(parseISO(dateEnd));
        matchDate = isWithinInterval(d, { start, end });
      }

      return matchDimensao && matchOrigem && matchDate && e.status !== 'cancelado';
    });


    // Filtrar Descentralizações
    const filteredDescentralizacoes = descentralizacoes.filter(d => {
      const matchDimensao = filterDimensao === 'all' || d.dimensao.includes(filterDimensao);
      const matchOrigem = filterOrigem === 'all' || d.origemRecurso === filterOrigem;
      return matchDimensao && matchOrigem;
    });

    return {
      atividades: filteredAtividades,
      empenhosCorrente: filteredEmpenhosCorrente,
      empenhosRap: filteredEmpenhosRap,
      descentralizacoes: filteredDescentralizacoes
    };
  }, [atividades, empenhos, descentralizacoes, filterDimensao, filterOrigem, dateStart, dateEnd]);

  // --- KPI Calculations (Exercício Corrente) ---
  const totalPlanejado = filteredData.atividades.reduce((acc, a) => acc + a.valorTotal, 0);
  const totalEmpenhado = filteredData.empenhosCorrente.reduce((acc, e) => acc + e.valor, 0);
  const totalDescentralizado = filteredData.descentralizacoes.reduce((acc, d) => acc + d.valor, 0);
  const aDescentralizar = totalPlanejado - totalDescentralizado;
  const saldoTotal = totalPlanejado - totalEmpenhado;
  const percentualExecutado = totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0;

  const totalLiquidado = filteredData.empenhosCorrente.reduce((acc, e) => acc + ((e.valorLiquidadoOficial || e.valorLiquidado) || 0), 0);
  const totalPago = filteredData.empenhosCorrente.reduce((acc, e) => acc + (e.valorPagoOficial || e.valorPago || 0), 0);

  // --- KPI Calculations (RAP) ---
  const rapTotalInscrito = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapInscrito || 0), 0);
  const rapTotalALiquidar = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapALiquidar || 0), 0);
  const rapTotalLiquidado = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapLiquidado || 0), 0);
  const rapTotalPago = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapPago || 0), 0);
  const rapSaldoPagar = filteredData.empenhosRap.reduce((acc, e) => acc + (e.saldoRapOficial || 0), 0);

  // --- Gráficos & Tabelas ---

  // 1. Resumo por Origem
  const dadosPorOrigem = useMemo(() => {
    const map = new Map<string, { planejado: number; empenhado: number }>();

    filteredData.atividades.forEach((a) => {
      const existing = map.get(a.origemRecurso) || { planejado: 0, empenhado: 0 };
      existing.planejado += a.valorTotal;
      map.set(a.origemRecurso, existing);
    });

    filteredData.empenhosCorrente.forEach((e) => {
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

    filteredData.empenhosCorrente.forEach((e) => {
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
    filteredData.empenhosCorrente.forEach((e) => {
      const nature = e.naturezaDespesa.split(' - ')[0];
      map.set(nature, (map.get(nature) || 0) + e.valor);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filteredData]);

  // 4. Evolução Mensal
  const dadosMensais = useMemo(() => {
    const mapEmpenhado = new Map<string, number>();
    const mapPago = new Map<string, number>();
    const mapLiquidado = new Map<string, number>();

    const sortedEmpenhos = [...filteredData.empenhosCorrente].sort((a, b) => new Date(a.dataEmpenho).getTime() - new Date(b.dataEmpenho).getTime());

    sortedEmpenhos.forEach(e => {
      const mes = format(new Date(e.dataEmpenho), 'MMM/yy', { locale: ptBR });
      mapEmpenhado.set(mes, (mapEmpenhado.get(mes) || 0) + e.valor);

      const vPago = e.valorPagoOficial || e.valorPago || 0;
      mapPago.set(mes, (mapPago.get(mes) || 0) + vPago);

      const vLiq = e.valorLiquidadoOficial || e.valorLiquidado || 0;
      mapLiquidado.set(mes, (mapLiquidado.get(mes) || 0) + vLiq);
    });

    let accEmpenhado = 0;
    let accPago = 0;

    // As "Planejado" is mostly static in the context of year budget unless broken by project, we use totalPlanejado 
    return Array.from(mapEmpenhado.entries()).map(([mes, valEmp]) => {
      accEmpenhado += valEmp;
      accPago += mapPago.get(mes) || 0;

      return {
        name: mes,
        planejado: totalPlanejado > 0 ? totalPlanejado : accEmpenhado * 1.2,
        empenhado: accEmpenhado,
        pago: accPago,
      };
    });
  }, [filteredData, totalPlanejado]);

  // 5. Funil (Exercício Corrente)
  const dadosFunil = [
    { name: 'Planejado', value: totalPlanejado, fill: '#3b82f6' }, // vibrant-blue
    { name: 'Empenhado', value: totalEmpenhado, fill: '#a855f7' }, // purple
    { name: 'Liquidado', value: totalLiquidado, fill: '#f59e0b' }, // amber
    { name: 'Pago', value: totalPago, fill: '#10b981' }, // emerald-green
  ];

  // 5.1 Stack de Dimensão x Componente Funcional
  const { dadosStack, uniqueComponents } = useMemo(() => {
    // Dimensão -> { name: Dimensao, Componente A: valor, Componente B: valor, ... }
    const dimMap = new Map<string, Record<string, any>>();
    const compSet = new Set<string>();

    filteredData.atividades.forEach(a => {
      const dim = a.dimensao || 'Sem Dimensão';
      const comp = a.componenteFuncional?.trim();

      // Filter out empty components or "Sem Componente"
      if (!comp || comp.toLowerCase() === 'sem componente') return;

      compSet.add(comp);

      const dimObj = dimMap.get(dim) || { name: dim };
      dimObj[comp] = ((dimObj[comp] as number) || 0) + a.valorTotal;
      dimMap.set(dim, dimObj);
    });

    return {
      dadosStack: Array.from(dimMap.values()).sort((a, b) => {
        const totalA = Object.keys(a).filter(k => k !== 'name').reduce((sum, k) => sum + (a[k] as number), 0);
        const totalB = Object.keys(b).filter(k => k !== 'name').reduce((sum, k) => sum + (b[k] as number), 0);
        return totalB - totalA;
      }),
      uniqueComponents: Array.from(compSet)
    };
  }, [filteredData]);

  // 5.2 Descentralizações por Dimensão e Origem
  const { dadosDescentralizacao, uniqueOrigens } = useMemo(() => {
    const dimMap = new Map<string, Record<string, any>>();
    const origemSet = new Set<string>();

    filteredData.descentralizacoes.forEach(d => {
      const dim = d.dimensao || 'Sem Dimensão';
      const origem = d.origemRecurso || 'Sem Origem';

      origemSet.add(origem);

      const dimObj = dimMap.get(dim) || { name: dim };
      dimObj[origem] = ((dimObj[origem] as number) || 0) + d.valor;
      dimMap.set(dim, dimObj);
    });

    return {
      dadosDescentralizacao: Array.from(dimMap.values()).sort((a, b) => {
        const totalA = Object.keys(a).filter(k => k !== 'name').reduce((sum, k) => sum + (a[k] as number), 0);
        const totalB = Object.keys(b).filter(k => k !== 'name').reduce((sum, k) => sum + (b[k] as number), 0);
        return totalB - totalA;
      }),
      uniqueOrigens: Array.from(origemSet)
    };
  }, [filteredData]);

  // 6. Resumo RAP por Origem
  const dadosRapPorOrigem = useMemo(() => {
    const map = new Map<string, { inscrito: number; saldo: number; }>();

    filteredData.empenhosRap.forEach((e) => {
      const existing = map.get(e.origemRecurso || 'Geral') || { inscrito: 0, saldo: 0 };
      existing.inscrito += (e.rapInscrito || 0);
      existing.saldo += (e.saldoRapOficial || 0);
      map.set(e.origemRecurso || 'Geral', existing);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        inscrito: values.inscrito,
        saldo: values.saldo,
        pago: values.inscrito - values.saldo,
        percentual: values.inscrito > 0 ? ((values.inscrito - values.saldo) / values.inscrito) * 100 : 0
      }))
      .filter(item => item.inscrito > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [filteredData]);

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
      <Tabs defaultValue="corrente" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <TabsList className="bg-slate-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="corrente" className="px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 hover:text-slate-900 rounded-md text-sm font-semibold transition-all">Exercício Atual</TabsTrigger>
            <TabsTrigger value="rap" className="px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 hover:text-slate-900 rounded-md text-sm font-semibold transition-all">Restos a Pagar (RAP)</TabsTrigger>
          </TabsList>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 relative bg-white border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground absolute -top-2 -right-2">
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
                  <Button variant="ghost" onClick={clearFilters} className="w-full text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
                <SheetClose asChild>
                  <Button type="submit" className="w-full bg-primary hover:bg-brand-700 text-white shadow-sm">Aplicar</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <TabsContent value="corrente" className="space-y-6 border-none p-0">

          {/* Bento Grid com Framer Motion stagger */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(130px,auto)]"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >

            {/* ── HERO CARD — Total Planejado (row-span-2) ── */}
            <motion.div
              variants={scaleIn}
              className={`
              md:row-span-2 relative overflow-hidden rounded-2xl
              border border-primary/20
              bg-gradient-to-br from-primary/8 via-primary/4 to-transparent
              p-6 flex flex-col justify-between
              shadow-[0_8px_30px_rgba(26,92,230,0.12)]
              hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(26,92,230,0.18)]
              transition-all duration-300 animate-fade-in
            `}>
              {/* Glow decorativo — Aura Style */}
              <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

              {/* Ícone */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary/60">
                    Total Planejado
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {filteredData.atividades.length} atividades filtradas
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              {/* Valor principal — text-gradient-primary, fonte grande */}
              <div>
                {isLoading ? (
                  <div className="h-10 w-4/5 bg-primary/10 rounded-lg animate-pulse mt-2" />
                ) : (
                  <p className={`
                    text-3xl lg:text-4xl font-black tracking-tighter leading-none mt-2 mb-4
                    bg-gradient-to-br from-[#1a5ce6] to-[#3b82f6]
                    bg-clip-text text-transparent
                  `}>
                    {formatCurrency(totalPlanejado)}
                  </p>
                )}

                {/* Progress integrado no hero */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Execução orçamentária</span>
                    <span className="font-bold text-primary">{percentualExecutado.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700 ease-spring"
                      style={{ width: `${Math.min(percentualExecutado, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalEmpenhado)} empenhados
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Descentralizado ── */}
            <motion.div variants={staggerItem}>
              <StatCard
              title="Descentralizado"
              value={formatCurrency(totalDescentralizado)}
              subtitle={`${filteredData.descentralizacoes.length} descentralizações`}
              icon={Receipt}
              stitchColor="emerald-green"
              progress={totalPlanejado > 0 ? (totalDescentralizado / totalPlanejado) * 100 : 0}
              isLoading={isLoading}
            />
            </motion.div>

            {/* ── Total Empenhado ── */}
            <motion.div variants={staggerItem}>
              <StatCard
              title="Total Empenhado"
              value={formatCurrency(totalEmpenhado)}
              subtitle={`${filteredData.empenhosCorrente.length} empenhos filtrados`}
              icon={TrendingUp}
              stitchColor="purple"
              progress={totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0}
              isLoading={isLoading}
            />
            </motion.div>

            {/* ── A Descentralizar ── */}
            <motion.div variants={staggerItem}>
              <StatCard
              title="A Descentralizar"
              value={formatCurrency(aDescentralizar)}
              subtitle={aDescentralizar >= 0 ? "Dentro do orçamento" : "Acima do orçamento"}
              icon={PiggyBank}
              stitchColor="amber"
              progress={totalPlanejado > 0 ? (Math.max(0, aDescentralizar) / totalPlanejado) * 100 : 0}
              isLoading={isLoading}
            />
            </motion.div>

            {/* ── Mini card: Liquidado / Pago ── */}
            <motion.div variants={staggerItem} className={`
              relative overflow-hidden rounded-2xl
              border border-border/70 bg-card
              shadow-soft hover:shadow-card hover:-translate-y-[1px]
              transition-all duration-200 p-5 flex flex-col justify-between
              animate-fade-in
            `}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Liquidado · Pago
              </p>

              <div className="space-y-3 mt-2">
                {/* Liquidado */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Liquidado</span>
                    {isLoading ? (
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    ) : (
                      <span className={`
                        text-sm font-black tracking-tight
                        bg-gradient-to-r from-[#b45309] to-[#f59e0b]
                        bg-clip-text text-transparent
                      `}>
                        {formatCurrency(totalLiquidado)}
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#f59e0b]/70 to-[#f59e0b] rounded-full transition-all duration-700 ease-spring"
                      style={{ width: totalEmpenhado > 0 ? `${Math.min((totalLiquidado / totalEmpenhado) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="h-px bg-border/60" />

                {/* Pago */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Pago</span>
                    {isLoading ? (
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    ) : (
                      <span className={`
                        text-sm font-black tracking-tight
                        bg-gradient-to-r from-[#047857] to-[#10b981]
                        bg-clip-text text-transparent
                      `}>
                        {formatCurrency(totalPago)}
                      </span>
                    )}
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#10b981]/70 to-[#10b981] rounded-full transition-all duration-700 ease-spring"
                      style={{ width: totalLiquidado > 0 ? `${Math.min((totalPago / totalLiquidado) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

          </motion.div>
          {/* Fim do Bento Grid */}

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
                        <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorEmpenhado" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000000).toFixed(1)}M`} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="planejado" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPlanejado)" name="Planejado" />
                      <Area type="monotone" dataKey="empenhado" stroke="#a855f7" fillOpacity={1} fill="url(#colorEmpenhado)" name="Empenhado" />
                      <Area type="monotone" dataKey="pago" stroke="#10b981" fillOpacity={1} fill="url(#colorPago)" name="Pago" />
                      <Legend />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <CardTitle>Funil de Execução</CardTitle>
                <CardDescription>Eficiência da despesa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex-1 flex flex-col justify-center gap-2 relative py-4 min-h-[300px]">
                  {/* Connecting lines behind */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -translate-x-1/2 z-0 hidden md:block"></div>

                  {/* Funnel Steps */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="bg-vibrant-blue text-white px-4 py-2 rounded-lg w-full text-center shadow-sm max-w-[240px]">
                      <p className="text-[10px] font-medium text-blue-100 uppercase tracking-wider mb-0.5">Planejado</p>
                      <p className="font-bold text-sm">{formatCurrency(totalPlanejado)}</p>
                    </div>

                    <div className="h-4 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-purple text-white px-4 py-2 rounded-lg w-11/12 text-center shadow-sm max-w-[220px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-purple text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalPlanejado ? ((totalEmpenhado / totalPlanejado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-[10px] font-medium text-purple-100 uppercase tracking-wider mb-0.5">Empenhado</p>
                      <p className="font-bold text-sm">{formatCurrency(totalEmpenhado)}</p>
                    </div>

                    <div className="h-4 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-amber text-white px-4 py-2 rounded-lg w-5/6 text-center shadow-sm max-w-[200px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-amber text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalEmpenhado ? ((totalLiquidado / totalEmpenhado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-[10px] font-medium text-amber-100 uppercase tracking-wider mb-0.5">Liquidado</p>
                      <p className="font-bold text-sm">{formatCurrency(totalLiquidado)}</p>
                    </div>

                    <div className="h-4 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-emerald-green text-white px-4 py-2 rounded-lg w-4/5 text-center shadow-sm max-w-[180px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-emerald-green text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalLiquidado ? ((totalPago / totalLiquidado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-[10px] font-medium text-green-100 uppercase tracking-wider mb-0.5">Pago</p>
                      <p className="font-bold text-sm">{formatCurrency(totalPago)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Linha 2: Distribuição Stacked */}
          <div className="grid gap-6 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição do Orçamento (Dimensão x Componentes Funcionais)</CardTitle>
                <CardDescription>Composição do Planejado por área de atuação e programas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosStack} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      {uniqueComponents.map((comp, index) => {
                        const colors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#8b5cf6', '#06b6d4'];
                        return <Bar key={comp} dataKey={comp} stackId="a" fill={colors[index % colors.length]} radius={index === uniqueComponents.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos Linha 3: Radar & Naturezas */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Descentralizações</CardTitle>
                <CardDescription>Volume distribuído por Dimensão</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosDescentralizacao} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      {uniqueOrigens.map((origem, index) => {
                        const colors = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];
                        return <Bar key={origem} dataKey={origem} stackId="a" fill={colors[index % colors.length]} radius={index === uniqueOrigens.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]} barSize={24} />
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="">
              <CardHeader>
                <CardTitle>Top Naturezas</CardTitle>
                <CardDescription>Valor emepnhado por Naturezade Despesa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosPorNatureza} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#10b981" name="Valor Gasto" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Resumo */}
          <Card className="">
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
        </TabsContent>

        <TabsContent value="rap" className="space-y-6 border-none p-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Inscrito"
              value={formatCurrency(rapTotalInscrito)}
              subtitle={`${filteredData.empenhosRap.length} RAPs`}
              icon={Flag}
              stitchColor="vibrant-blue"
              progress={100}
              isLoading={isLoading}
            />
            <StatCard
              title="A liquidar"
              value={formatCurrency(rapTotalALiquidar)}
              icon={Receipt}
              stitchColor="amber"
              progress={rapTotalInscrito > 0 ? (rapTotalALiquidar / rapTotalInscrito) * 100 : 0}
              isLoading={isLoading}
            />
            <StatCard
              title="Liquidado"
              value={formatCurrency(rapTotalLiquidado)}
              icon={Lock}
              stitchColor="purple"
              progress={rapTotalInscrito > 0 ? (rapTotalLiquidado / rapTotalInscrito) * 100 : 0}
              isLoading={isLoading}
            />
            <StatCard
              title="Pago"
              value={formatCurrency(rapTotalPago)}
              icon={Wallet}
              stitchColor="emerald-green"
              progress={rapTotalLiquidado > 0 ? (rapTotalPago / rapTotalLiquidado) * 100 : 0}
              isLoading={isLoading}
            />
          </div>

          <Card className="">
            <CardHeader>
              <CardTitle>Resumo de RAPs por Origem</CardTitle>
              <CardDescription>Acompanhamento de inscritos vs pagamentos efetivados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Origem de Recurso</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Inscrito Original</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Pago</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Saldo Restante</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Taxa de Pgto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosRapPorOrigem.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-muted-foreground italic">Nenhum RAP correspondente aos filtros foi encontrado.</td>
                      </tr>
                    ) : (
                      dadosRapPorOrigem.map((item, index) => (
                        <tr key={index} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-sm font-medium">{item.origem}</td>
                          <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.inscrito)}</td>
                          <td className="py-3 px-4 text-sm text-right">{formatCurrency(item.pago)}</td>
                          <td className="py-3 px-4 text-sm text-right font-medium text-red-600 dark:text-red-500">
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
