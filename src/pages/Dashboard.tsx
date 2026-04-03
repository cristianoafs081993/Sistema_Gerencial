import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, scaleIn } from '@/lib/animations';
import {
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  X,
  SlidersHorizontal,
  Flag,
  Lock,
  ArrowDown
} from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { StatCard } from '@/components/StatCard';
import { ChartPanel } from '@/components/design-system/ChartPanel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ComposedChart,
  Treemap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  Area,
  Line
} from 'recharts';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DIMENSOES } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { HeaderActions } from '@/components/HeaderParts';
import { extractDimensionCode, getDimensionLabel, matchesDimensionFilter } from '@/utils/dimensionFilters';

const getRapSaldo = (rapALiquidar?: number, saldoRapOficial?: number) => {
  const aLiq = rapALiquidar || 0;
  if (aLiq > 0) return aLiq;
  return saldoRapOficial || 0;
};

const formatCompactCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `R$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
  return formatCurrency(value);
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mixHexColors = (baseColor: string, targetColor: string, amount: number) => {
  const safeAmount = clamp(amount, 0, 1);
  const normalize = (color: string) => color.replace('#', '');
  const base = normalize(baseColor);
  const target = normalize(targetColor);

  const baseRgb = {
    r: parseInt(base.slice(0, 2), 16),
    g: parseInt(base.slice(2, 4), 16),
    b: parseInt(base.slice(4, 6), 16),
  };

  const targetRgb = {
    r: parseInt(target.slice(0, 2), 16),
    g: parseInt(target.slice(2, 4), 16),
    b: parseInt(target.slice(4, 6), 16),
  };

  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

  return `#${toHex(baseRgb.r + (targetRgb.r - baseRgb.r) * safeAmount)}${toHex(
    baseRgb.g + (targetRgb.g - baseRgb.g) * safeAmount,
  )}${toHex(baseRgb.b + (targetRgb.b - baseRgb.b) * safeAmount)}`;
};

const getReadableTextColor = (hexColor: string) => {
  const normalized = hexColor.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.56 ? '#0f172a' : '#ffffff';
};

const truncateTreemapLabel = (label: string, width: number, depth: number) => {
  const charWidth = depth === 1 ? 7.1 : 6.3;
  const maxChars = Math.max(8, Math.floor((width - 18) / charWidth));

  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}...` : label;
};

function ExecutionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[210px] rounded-2xl border border-border-default/70 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </p>
      <div className="mt-2 space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
              <span className="font-ui text-sm font-medium text-text-secondary">{item.name}</span>
            </div>
            <span className="font-ui text-sm font-semibold text-text-primary">
              {formatCurrency(item.value || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetHierarchyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { name?: string; value?: number; nodeType?: string; parentName?: string } }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="min-w-[220px] rounded-2xl border border-border-default/70 bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {item.nodeType === 'componente' ? 'Componente funcional' : 'Dimensao'}
      </p>
      <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{item.name}</p>
      {item.parentName ? (
        <p className="mt-1 font-ui text-xs text-text-muted">{item.parentName}</p>
      ) : null}
      <p className="mt-3 font-ui text-sm font-bold text-text-primary">{formatCurrency(item.value || 0)}</p>
    </div>
  );
}

function BudgetTreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  value?: number;
  fill?: string;
  textColor?: string;
  nodeType?: string;
  parentName?: string;
  root?: { x?: number; y?: number; width?: number; height?: number };
  highlightedDimension?: string | null;
}) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    depth = 1,
    name = '',
    value = 0,
    fill,
    textColor,
    nodeType,
    parentName,
    highlightedDimension,
  } = props;

  if (depth === 0) return null;
  if (width < 10 || height < 10) return null;

  const nodeFill = fill || '#2563eb';
  const nodeTextColor = textColor || getReadableTextColor(nodeFill);
  const textStroke = nodeTextColor === '#ffffff' ? 'rgba(15,23,42,0.42)' : 'rgba(255,255,255,0.92)';
  const isPrimary = depth === 1;
  const nodeDimension = nodeType === 'dimensao' ? name : parentName;
  const isHighlighted = !highlightedDimension || nodeDimension === highlightedDimension;
  const showLabel = width > (isPrimary ? 120 : 82) && height > (isPrimary ? 56 : 36);
  const showValue = width > (isPrimary ? 148 : 108) && height > (isPrimary ? 84 : 54);
  const label = truncateTreemapLabel(name, width, depth);

  return (
    <g opacity={isHighlighted ? 1 : 0.18}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={0}
        ry={0}
        fill={nodeFill}
        stroke={isHighlighted ? '#ffffff' : 'rgba(255,255,255,0.55)'}
        strokeWidth={isHighlighted ? (isPrimary ? 3 : 2) : 1.2}
      />
      {showLabel ? (
        <text
          x={x + 12}
          y={y + (isPrimary ? 24 : 20)}
          fill={nodeTextColor}
          fontSize={isPrimary ? 12 : 11}
          fontWeight={isPrimary ? 800 : 700}
          stroke={textStroke}
          strokeWidth={isPrimary ? 2.6 : 2.2}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {label}
        </text>
      ) : null}
      {showValue ? (
        <text
          x={x + 12}
          y={y + (isPrimary ? 46 : 38)}
          fill={nodeTextColor}
          fontSize={isPrimary ? 14 : 12}
          fontWeight={800}
          stroke={textStroke}
          strokeWidth={isPrimary ? 3 : 2.4}
          strokeLinejoin="round"
          paintOrder="stroke fill"
        >
          {formatCompactCurrency(value)}
        </text>
      ) : null}
    </g>
  );
}


export default function Dashboard() {
  const { atividades, empenhos, descentralizacoes, isLoading } = useData();
  const [hoveredBudgetDimension, setHoveredBudgetDimension] = useState<string | null>(null);
  const [selectedBudgetDimensionCode, setSelectedBudgetDimensionCode] = useState<string | null>(null);

  // --- Filtros ---
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'corrente' | 'rap'>('corrente');

  const resolveDimensionFilterValue = (dimensionLabel?: string | null) => {
    return extractDimensionCode(dimensionLabel) || 'all';
  };

  const effectiveFilterDimensao = useMemo(() => {
    if (filterDimensao === 'all') return 'all';
    return extractDimensionCode(filterDimensao) || 'all';
  }, [filterDimensao]);

  useEffect(() => {
    if (filterDimensao !== 'all' && effectiveFilterDimensao === 'all') {
      setFilterDimensao('all');
    }
  }, [filterDimensao, effectiveFilterDimensao]);
  // Extrair origens unicas para o filtro
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
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: a.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || a.origemRecurso === filterOrigem;
      return matchDimensao && matchOrigem;
    });

    // Filtrar Empenhos (Executado)
    const empenhosCorrente = empenhos.filter(e => e.tipo === 'exercicio');
    const empenhosRap = empenhos.filter(e => e.tipo === 'rap');

    const filteredEmpenhosCorrente = empenhosCorrente.filter(e => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: e.dimensao,
        planInternal: e.planoInterno,
        description: e.descricao,
        filterValue: effectiveFilterDimensao,
      });
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
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: e.dimensao,
        planInternal: e.planoInterno,
        description: e.descricao,
        filterValue: effectiveFilterDimensao,
      });
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
    // Filtrar descentralizacoes
    const filteredDescentralizacoes = descentralizacoes.filter(d => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: d.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || d.origemRecurso === filterOrigem;
      return matchDimensao && matchOrigem;
    });

    return {
      atividades: filteredAtividades,
      empenhosCorrente: filteredEmpenhosCorrente,
      empenhosRap: filteredEmpenhosRap,
      descentralizacoes: filteredDescentralizacoes
    };
  }, [atividades, empenhos, descentralizacoes, effectiveFilterDimensao, filterOrigem, dateStart, dateEnd]);
  // --- KPI Calculations (Exercicio Corrente) ---
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
  const rapTotalALiquidar = filteredData.empenhosRap.reduce((acc, e) => acc + getRapSaldo(e.rapALiquidar, e.saldoRapOficial), 0);
  const rapTotalLiquidado = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapLiquidado || 0), 0);
  const rapTotalPago = filteredData.empenhosRap.reduce((acc, e) => acc + (e.rapPago || 0), 0);
  const rapSaldoPagar = filteredData.empenhosRap.reduce((acc, e) => acc + (e.saldoRapOficial || 0), 0);

  // --- Graficos e Tabelas ---

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
    const normalize = (s: string) => s?.trim() || 'Nao Informado';

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

  // 4. Evolucao Mensal
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
  // 5. Funil (Exercicio Corrente)
  const dadosFunil = [
    { name: 'Planejado', value: totalPlanejado, fill: '#3b82f6' }, // vibrant-blue
    { name: 'Empenhado', value: totalEmpenhado, fill: '#a855f7' }, // purple
    { name: 'Liquidado', value: totalLiquidado, fill: '#f59e0b' }, // amber
    { name: 'Pago', value: totalPago, fill: '#10b981' }, // emerald-green
  ];

  // 5.1 Hierarquia de Dimensao x Componente Funcional
  const budgetTreemapData = useMemo(() => {
    const dimensionPalette = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];
    const dimMap = new Map<string, Record<string, string | number>>();

    filteredData.atividades.forEach((atividade) => {
      const dim = atividade.dimensao || 'Sem Dimensao';
      const comp = atividade.componenteFuncional?.trim();

      if (!comp || comp.toLowerCase() === 'sem componente') return;

      const dimObj = dimMap.get(dim) || { name: dim };
      dimObj[comp] = ((dimObj[comp] as number) || 0) + atividade.valorTotal;
      dimMap.set(dim, dimObj);
    });

    return Array.from(dimMap.values())
      .map((dimension, index) => {
        const fill = dimensionPalette[index % dimensionPalette.length];
        const entries = Object.entries(dimension).filter(([key]) => key !== 'name');
        const totalDimensao = entries.reduce((sum, [, value]) => sum + (value as number), 0);

        return {
          name: dimension.name as string,
          dimensionCode: extractDimensionCode(dimension.name as string) || '',
          value: totalDimensao,
          fill,
          textColor: getReadableTextColor(fill),
          nodeType: 'dimensao',
          children: entries
            .map(([componente, valor], componentIndex) => {
              const componentFill = mixHexColors(
                fill,
                '#ffffff',
                entries.length === 1 ? 0.12 : 0.12 + (componentIndex / Math.max(entries.length - 1, 1)) * 0.38,
              );

              return {
                name: componente,
                dimensionCode: extractDimensionCode(dimension.name as string) || '',
                value: valor as number,
                fill: componentFill,
                textColor: getReadableTextColor(componentFill),
                nodeType: 'componente',
                parentName: dimension.name as string,
              };
            })
            .sort((a, b) => (b.value || 0) - (a.value || 0)),
        };
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [filteredData]);

  const filteredBudgetDimension = useMemo(() => {
    if (effectiveFilterDimensao === 'all') return null;

    return (
      budgetTreemapData.find((item) => item.dimensionCode === effectiveFilterDimensao)?.name ||
      getDimensionLabel(effectiveFilterDimensao) ||
      null
    );
  }, [budgetTreemapData, effectiveFilterDimensao]);

  const selectedBudgetDimension = useMemo(() => {
    if (!selectedBudgetDimensionCode) return null;

    return (
      budgetTreemapData.find((item) => item.dimensionCode === selectedBudgetDimensionCode)?.name ||
      getDimensionLabel(selectedBudgetDimensionCode) ||
      null
    );
  }, [budgetTreemapData, selectedBudgetDimensionCode]);

  const activeBudgetDimension = selectedBudgetDimension || filteredBudgetDimension;
  const highlightedBudgetDimension = hoveredBudgetDimension || activeBudgetDimension;

  const handleBudgetDimensionSelect = (dimensionLabel?: string | null) => {
    const nextValue = resolveDimensionFilterValue(dimensionLabel);
    if (nextValue === 'all') return;

    setSelectedBudgetDimensionCode((currentValue) => (
      currentValue === nextValue ? null : nextValue
    ));
    setHoveredBudgetDimension(null);
  };

  const { dadosDescentralizacao, uniqueOrigens } = useMemo(() => {
    const dimMap = new Map<string, Record<string, string | number>>();
    const origemSet = new Set<string>();

    filteredData.descentralizacoes.forEach((descentralizacao) => {
      const dim = descentralizacao.dimensao || 'Sem Dimensao';
      const origem = descentralizacao.origemRecurso || 'Sem Origem';

      origemSet.add(origem);

      const dimObj = dimMap.get(dim) || { name: dim };
      dimObj[origem] = ((dimObj[origem] as number) || 0) + descentralizacao.valor;
      dimMap.set(dim, dimObj);
    });

    return {
      dadosDescentralizacao: Array.from(dimMap.values()).sort((a, b) => {
        const totalA = Object.entries(a)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);
        const totalB = Object.entries(b)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);
        return totalB - totalA;
      }),
      uniqueOrigens: Array.from(origemSet).sort(),
    };
  }, [filteredData]);

  const dadosRapPorOrigem = useMemo(() => {
    const map = new Map<string, { inscrito: number; pago: number }>();

    filteredData.empenhosRap.forEach((empenho) => {
      const origem = empenho.origemRecurso || 'Sem origem';
      const existing = map.get(origem) || { inscrito: 0, pago: 0 };

      existing.inscrito += empenho.valor || 0;
      existing.pago += empenho.valorPagoOficial || empenho.valorPago || 0;

      map.set(origem, existing);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        inscrito: values.inscrito,
        pago: values.pago,
        saldo: values.inscrito - values.pago,
        percentual: values.inscrito > 0 ? (values.pago / values.inscrito) * 100 : 0,
      }))
      .filter((item) => item.inscrito > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [filteredData]);

  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterOrigem('all');
    setDateStart('');
    setDateEnd('');
    setHoveredBudgetDimension(null);
    setSelectedBudgetDimensionCode(null);
  };

  const hasActiveFilters = filterDimensao !== 'all' || filterOrigem !== 'all' || dateStart !== '' || dateEnd !== '';
  const activeFiltersCount = [filterDimensao !== 'all', filterOrigem !== 'all', (dateStart !== '' || dateEnd !== '')].filter(Boolean).length;
  const activeDimensionLabel = getDimensionLabel(effectiveFilterDimensao);

  const renderFiltersSheet = (buttonClassName: string) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className={buttonClassName}>
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
            Selecione os criterios para visualizar os dados.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Dimensao</Label>
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
            <Label>Periodo de Inicio</Label>
            <Input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Periodo Final</Label>
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
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'corrente' | 'rap')} className="space-y-6">
        <HeaderActions>
          <div className="hidden md:flex items-center gap-2 h-9">
            <TabsList className="h-8 sm:h-9 bg-surface-card border border-border-default/60 p-0.5 rounded-lg shadow-sm">
              <TabsTrigger
                value="corrente"
                className="h-7 sm:h-8 px-3 sm:px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white text-slate-600 rounded-md text-[11px] sm:text-xs font-semibold transition-all"
              >
                Exercicio Atual
              </TabsTrigger>
              <TabsTrigger
                value="rap"
                className="h-7 sm:h-8 px-3 sm:px-4 data-[state=active]:bg-slate-900 data-[state=active]:text-white text-slate-600 rounded-md text-[11px] sm:text-xs font-semibold transition-all"
              >
                RAP
              </TabsTrigger>
            </TabsList>
            {renderFiltersSheet("gap-2 h-8 text-xs sm:h-9 sm:text-sm relative bg-surface-card border-border-default shadow-sm transition-all text-text-primary hover:bg-surface-subtle")}
          </div>
        </HeaderActions>

        <div className="md:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <TabsList className="bg-slate-100 p-1 rounded-lg h-auto">
            <TabsTrigger value="corrente" className="px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-slate-500 hover:text-slate-900 rounded-md text-sm font-semibold transition-all">Exercicio Atual</TabsTrigger>
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
                  Selecione os criterios para visualizar os dados.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Dimensao</Label>
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
                  <Label>Periodo de Inicio</Label>
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={e => setDateStart(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Periodo Final</Label>
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

        {activeDimensionLabel ? (
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-ui text-xs font-semibold text-primary"
            >
              Dimensao ativa: {activeDimensionLabel}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-text-muted hover:text-text-primary"
              onClick={() => setFilterDimensao('all')}
            >
              Limpar selecao
            </Button>
          </div>
        ) : null}

        <TabsContent value="corrente" className="space-y-6 border-none p-0">

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(130px,auto)]">

            {/* Hero card: Total Planejado */}
            <div
              className={`
              md:row-span-2 relative overflow-hidden rounded-2xl
              border border-primary/20
              bg-gradient-to-br from-primary/8 via-primary/4 to-transparent
              p-6 flex flex-col justify-between
              shadow-[0_8px_30px_rgba(26,92,230,0.12)]
              hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(26,92,230,0.18)]
              transition-all duration-300
            `}>
              {/* Glow decorativo */}
              <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

              {/* Icone */}
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
              {/* Valor principal */}
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
                    <span className="text-muted-foreground">Execucao orcamentaria</span>
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
            </div>
            {/* Descentralizado */}
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
            {/* Total Empenhado */}
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
            {/* A Descentralizar */}
            <div>
              <StatCard
                title="A Descentralizar"
                value={formatCurrency(aDescentralizar)}
                subtitle={aDescentralizar >= 0 ? "Dentro do orcamento" : "Acima do orcamento"}
                icon={PiggyBank}
                stitchColor="amber"
                progress={totalPlanejado > 0 ? (Math.max(0, aDescentralizar) / totalPlanejado) * 100 : 0}
                isLoading={isLoading}
              />
            </div>
            {/* Mini card: Liquidado / Pago */}
            <div className={`
              relative overflow-hidden rounded-2xl
              border border-border/70 bg-card
              shadow-soft hover:shadow-card hover:-translate-y-[1px]
              transition-all duration-200 p-5 flex flex-col justify-between
            `}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Liquidado / Pago
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
            </div>
          </div>
          {/* Fim do Bento Grid */}

          {/* Graficos Linha 1 */}
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
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={74}
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                        tickFormatter={formatCompactCurrency}
                      />
                      <Tooltip content={<ExecutionTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
                      <Area
                        type="monotone"
                        dataKey="empenhado"
                        stroke="#a855f7"
                        strokeWidth={2.5}
                        fill="url(#colorEmpenhado)"
                        name="Empenhado"
                      />
                      <Area
                        type="monotone"
                        dataKey="pago"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#colorPago)"
                        name="Pago"
                      />
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
                <div className="flex-1 flex flex-col justify-center gap-4 relative py-4 min-h-[300px]">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-100 -translate-x-1/2 z-0 hidden md:block" />

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="bg-vibrant-blue text-white px-4 py-3 rounded-lg w-full text-center shadow-sm max-w-[240px]">
                      <p className="text-xs font-medium text-white/85 uppercase tracking-wider mb-1">Planejado</p>
                      <p className="font-bold text-lg text-white">{formatCurrency(totalPlanejado)}</p>
                    </div>

                    <div className="h-6 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-purple text-white px-4 py-3 rounded-lg w-11/12 text-center shadow-sm max-w-[220px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-purple text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalPlanejado ? ((totalEmpenhado / totalPlanejado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-xs font-medium text-white/85 uppercase tracking-wider mb-1">Empenhado</p>
                      <p className="font-bold text-lg text-white">{formatCurrency(totalEmpenhado)}</p>
                    </div>

                    <div className="h-6 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-amber text-white px-4 py-3 rounded-lg w-5/6 text-center shadow-sm max-w-[200px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-amber text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalEmpenhado ? ((totalLiquidado / totalEmpenhado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-xs font-medium text-white/85 uppercase tracking-wider mb-1">Liquidado</p>
                      <p className="font-bold text-lg text-white">{formatCurrency(totalLiquidado)}</p>
                    </div>

                    <div className="h-6 flex items-center justify-center">
                      <ArrowDown className="text-slate-300 w-4 h-4" />
                    </div>

                    <div className="bg-emerald-green text-white px-4 py-3 rounded-lg w-4/5 text-center shadow-sm max-w-[180px] relative">
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-white text-emerald-green text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-100 hidden md:block">
                        {totalLiquidado ? ((totalPago / totalLiquidado) * 100).toFixed(1) : '0'}%
                      </div>
                      <p className="text-xs font-medium text-white/85 uppercase tracking-wider mb-1">Pago</p>
                      <p className="font-bold text-lg text-white">{formatCurrency(totalPago)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Graficos Linha 2: Distribuicao Stacked */}
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
                        onClick={() => handleBudgetDimensionSelect(item.dimensionCode)}
                        onMouseEnter={() => setHoveredBudgetDimension(item.name)}
                        onMouseLeave={() => setHoveredBudgetDimension(null)}
                        onFocus={() => setHoveredBudgetDimension(item.name)}
                        onBlur={() => setHoveredBudgetDimension(null)}
                      >
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                        <span className="max-w-[220px] truncate font-ui text-xs font-semibold">
                          {item.name}
                        </span>
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
                        onClick={(node: { dimensionCode?: string }) =>
                          handleBudgetDimensionSelect(node.dimensionCode)
                        }
                      >
                        <Tooltip content={<BudgetHierarchyTooltip />} />
                      </Treemap>
                    </ResponsiveContainer>
                  </div>
                </div>
            </ChartPanel>
          </div>

          {/* Graficos Linha 3: Radar e Naturezas */}
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
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="value" fill="#10b981" name="Valor Gasto" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
            </ChartPanel>
          </div>

          {/* Tabela de Resumo */}
          <Card className="card-system overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-border-default/50">
              <CardTitle className="table-title">Detalhamento por Origem</CardTitle>
                <CardDescription>Execucao financeira por fonte de recurso</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-b border-border-default/50">
                      <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Planejado</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Empenhado</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Execucao</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosPorOrigem.map((item, index) => (
                      <TableRow key={index} className="hover:bg-slate-50/80 transition-colors border-b last:border-0">
                        <TableCell className="py-4 px-6 text-sm font-medium">{item.origem}</TableCell>
                        <TableCell className="py-4 px-4 text-sm text-right">{formatCurrency(item.planejado)}</TableCell>
                        <TableCell className="py-4 px-4 text-sm text-right">{formatCurrency(item.empenhado)}</TableCell>
                        <TableCell className={`py-4 px-4 text-sm text-right font-medium ${item.saldo >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          {formatCurrency(item.saldo)}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={Math.min(item.percentual, 100)} className="w-16 h-2" />
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {item.percentual.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

          <Card className="card-system overflow-hidden">
            <CardHeader className="px-6 py-4 border-b border-border-default/50">
              <CardTitle className="table-title">Resumo de RAPs por Origem</CardTitle>
              <CardDescription>Acompanhamento de inscritos vs pagamentos efetivados</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-b border-border-default/50">
                      <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Inscrito Original</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Pago</TableHead>
                      <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo Restante</TableHead>
                      <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Taxa de Pgto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosRapPorOrigem.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">Nenhum RAP correspondente aos filtros foi encontrado.</TableCell>
                      </TableRow>
                    ) : (
                      dadosRapPorOrigem.map((item, index) => (
                        <TableRow key={index} className="hover:bg-slate-50/80 transition-colors border-b last:border-0">
                          <TableCell className="py-4 px-6 text-sm font-medium">{item.origem}</TableCell>
                          <TableCell className="py-4 px-4 text-sm text-right">{formatCurrency(item.inscrito)}</TableCell>
                          <TableCell className="py-4 px-4 text-sm text-right">{formatCurrency(item.pago)}</TableCell>
                          <TableCell className="py-4 px-4 text-sm text-right font-medium text-status-error">
                            {formatCurrency(item.saldo)}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={Math.min(item.percentual, 100)} className="w-16 h-2" />
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {item.percentual.toFixed(0)}%
                              </span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}


