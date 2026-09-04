import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  ClipboardList,
  Maximize2,
  Boxes,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import {
  manutencaoService,
  type ConsumoInsumo,
  type Ambiente,
  type Checkin,
  type BlocoMapa,
} from '@/services/manutencao';

export const materialLabels: Record<string, string> = {
  papel_higienico: 'Papel Higiênico (rolos)',
  sabonete_liquido: 'Sabonete Líquido (L)',
  papel_toalha: 'Papel Toalha (pct)',
  saco_lixo: 'Saco de Lixo (un)',
  outros: 'Outros',
};

export const materialEmojis: Record<string, string> = {
  papel_higienico: '🧻',
  sabonete_liquido: '🧼',
  papel_toalha: '🧻',
  saco_lixo: '🗑️',
  outros: '📦',
};

export function formatMaterialDisplayName(raw: string): string {
  if (!raw) return 'Insumo';
  if (materialLabels[raw]) return materialLabels[raw];

  // Remove leading catalog/CATMAT codes (e.g. "00020 - ")
  const cleaned = raw.replace(/^\d{3,7}\s*-\s*/, '').trim();
  const parts = cleaned.split(/\s*-\s*/);
  let category = parts[0]?.trim() || '';
  const details = parts.slice(1).join(' - ');

  const variedadeMatch = details.match(/\bvariedade:\s*([^,;]+)/i);
  const saborMatch = details.match(/\bsabor:\s*([^,;]+)/i);
  const tipoMatch = details.match(/\btipo:\s*([^,;]+)/i);
  const specific = (variedadeMatch?.[1] || saborMatch?.[1] || tipoMatch?.[1] || '').trim();

  // Shorten common verbose prefix categories
  category = category
    .replace(/^Polpa De Fruta/i, 'Polpa')
    .replace(/^Legume In Natura/i, 'Legume')
    .replace(/^Bolo Alimenticio/i, 'Bolo');

  if (specific && specific.length > 2 && !/^(sem|com|padrao|b|a|c)\b/i.test(specific)) {
    const formattedSpecific = specific.charAt(0).toUpperCase() + specific.slice(1);
    return `${category}: ${formattedSpecific}`;
  }

  return category || raw;
}

export function getMaterialCategory(raw: string): string {
  if (!raw) return 'Outros';
  const lower = raw.toLowerCase();

  if (/papel_|sabonete_|saco_lixo|desinfetante|limpeza/i.test(lower)) {
    return 'Higiene e Limpeza';
  }
  if (/polpa/i.test(lower)) {
    return 'Polpas de Frutas';
  }
  if (/fruta/i.test(lower)) {
    return 'Frutas';
  }
  if (/legume|verdura|hortali/i.test(lower)) {
    return 'Legumes e Verduras';
  }
  if (/leite|queijo|iogurte|lactea|láctea|manteiga/i.test(lower)) {
    return 'Laticínios';
  }
  if (/bolo|p[aã]o|biscoito|farinha|trigo/i.test(lower)) {
    return 'Panificação e Confeitaria';
  }
  if (/carne|frango|peixe|ovo|proteina|proteína/i.test(lower)) {
    return 'Proteínas e Carnes';
  }
  if (/arroz|feij[aã]o|macarr[aã]o|[oó]leo|azeite|a[cç]ucar/i.test(lower)) {
    return 'Mercearia e Grãos';
  }

  const cleaned = raw.replace(/^\d{3,7}\s*-\s*/, '').trim();
  const parts = cleaned.split(/\s*-\s*/);
  if (parts[0] && parts[0].length > 1) {
    return parts[0].trim();
  }
  return 'Outros';
}

const CATEGORY_CHART_COLORS = [
  '#0d9488', // teal
  '#0284c7', // sky
  '#16a34a', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#64748b', // slate
];

export interface InsumosDashboardViewProps {
  consumosInsumos?: ConsumoInsumo[];
  ambientes?: Ambiente[];
  checkins?: Checkin[];
  blocosMapa?: BlocoMapa[];
  defaultBloco?: string;
  hideFilterBarHeader?: boolean;
}

export function InsumosDashboardView({
  consumosInsumos: propConsumos,
  ambientes: propAmbientes,
  checkins: propCheckins,
  blocosMapa: propBlocos,
  defaultBloco = 'todos',
}: InsumosDashboardViewProps) {
  const [internalConsumos, setInternalConsumos] = useState<ConsumoInsumo[]>([]);
  const [internalAmbientes, setInternalAmbientes] = useState<Ambiente[]>([]);
  const [internalCheckins, setInternalCheckins] = useState<Checkin[]>([]);
  const [internalBlocos, setInternalBlocos] = useState<BlocoMapa[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters state
  const [dashPeriodFilter, setDashPeriodFilter] = useState<string>('mes_atual');
  const [dashBlocoFilter, setDashBlocoFilter] = useState<string>(defaultBloco);
  const [dashTipoFilter, setDashTipoFilter] = useState<string>('todos');
  const [dashMaterialFilter, setDashMaterialFilter] = useState<string>('todos');
  const [dashMaterialsLimit, setDashMaterialsLimit] = useState<'top8' | 'all'>('top8');

  // Drilldown modal state
  const [isConsumoDrilldownOpen, setIsConsumoDrilldownOpen] = useState(false);
  const [consumoDrilldownSearch, setConsumoDrilldownSearch] = useState('');
  const [consumoDrilldownFilterDate, setConsumoDrilldownFilterDate] = useState<string | null>(null);
  const [consumoDrilldownFilterMaterial, setConsumoDrilldownFilterMaterial] = useState<string | null>(null);

  const needsFetch = !propConsumos || !propAmbientes || !propCheckins;

  useEffect(() => {
    if (!needsFetch) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      manutencaoService.getConsumosInsumos(),
      manutencaoService.getAmbientes(),
      manutencaoService.getCheckins(),
      manutencaoService.getBlocosMapa(),
    ])
      .then(([c, a, ch, b]) => {
        if (!mounted) return;
        setInternalConsumos(c);
        setInternalAmbientes(a);
        setInternalCheckins(ch);
        setInternalBlocos(b);
      })
      .catch((err) => {
        console.error('Erro ao carregar dados de insumos:', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [needsFetch]);

  const consumosInsumos = propConsumos ?? internalConsumos;
  const ambientes = propAmbientes ?? internalAmbientes;
  const checkins = propCheckins ?? internalCheckins;
  const blocosMapa = propBlocos ?? internalBlocos;

  const ambienteMap = useMemo(() => {
    return new Map<string, Ambiente>(ambientes.map((amb) => [amb.id, amb]));
  }, [ambientes]);

  const uniqueBlocos = useMemo(() => {
    const set = new Set<string>();
    ambientes.forEach((a) => {
      if (a.bloco) set.add(a.bloco);
    });
    blocosMapa.forEach((b) => {
      if (b.nome) set.add(b.nome);
    });
    return Array.from(set).sort();
  }, [ambientes, blocosMapa]);

  useEffect(() => {
    if (defaultBloco && defaultBloco !== 'todos') {
      const match = uniqueBlocos.find(
        (b) => normalizeStr(b) === normalizeStr(defaultBloco)
      );
      if (match) {
        setDashBlocoFilter(match);
      }
    }
  }, [defaultBloco, uniqueBlocos]);

  const isWithinPeriod = (dateIso?: string | null, period: string = 'mes_atual') => {
    if (!dateIso) return false;
    if (period === 'todos') return true;
    const date = new Date(dateIso);
    const now = new Date();
    if (period === 'hoje') {
      return date.toDateString() === now.toDateString();
    }
    if (period === '7d') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= past7;
    }
    if (period === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return date >= past30;
    }
    if (period === 'mes_atual') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const normalizeStr = (s?: string | null) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const dashFilteredCheckins = useMemo(() => {
    return checkins.filter((ch) => {
      if (!isWithinPeriod(ch.created_at, dashPeriodFilter)) return false;
      const amb = ambienteMap.get(ch.ambiente_id) || ch.ambiente;
      if (dashBlocoFilter !== 'todos' && normalizeStr(amb?.bloco) !== normalizeStr(dashBlocoFilter)) return false;
      if (dashTipoFilter !== 'todos' && amb?.tipo !== dashTipoFilter) return false;
      return true;
    });
  }, [checkins, dashPeriodFilter, dashBlocoFilter, dashTipoFilter, ambienteMap]);

  const dashFilteredConsumos = useMemo(() => {
    return consumosInsumos.filter((consumo) => {
      if (!isWithinPeriod(consumo.consumo_em, dashPeriodFilter)) return false;
      if (dashBlocoFilter !== 'todos' && normalizeStr(consumo.ambiente_bloco) !== normalizeStr(dashBlocoFilter)) return false;
      const ambiente = ambienteMap.get(consumo.ambiente_id);
      if (dashTipoFilter !== 'todos' && ambiente?.tipo !== dashTipoFilter) return false;
      if (dashMaterialFilter !== 'todos' && consumo.material !== dashMaterialFilter) return false;
      return consumo.quantidade > 0;
    });
  }, [consumosInsumos, dashPeriodFilter, dashBlocoFilter, dashTipoFilter, dashMaterialFilter, ambienteMap]);

  const dashMaterialsMap = useMemo(() => {
    const map: Record<string, number> = {};
    dashFilteredConsumos.forEach((consumo) => {
      map[consumo.material] = (map[consumo.material] || 0) + consumo.quantidade;
    });
    return map;
  }, [dashFilteredConsumos]);

  const dashMaterialsChartData = useMemo(() => {
    return Object.entries(dashMaterialsMap)
      .filter(([, val]) => val > 0)
      .map(([key, val]) => {
        const fullDisplay = formatMaterialDisplayName(key);
        const axisLabel = fullDisplay.length > 20 ? `${fullDisplay.slice(0, 19)}…` : fullDisplay;
        return {
          key,
          name: axisLabel,
          displayTitle: fullDisplay,
          fullName: materialLabels[key] || key,
          quantidade: val,
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [dashMaterialsMap]);

  const materialOptions = useMemo(
    () =>
      Array.from(new Set(consumosInsumos.map((consumo) => consumo.material))).sort((left, right) =>
        formatMaterialDisplayName(left).localeCompare(formatMaterialDisplayName(right), 'pt-BR')
      ),
    [consumosInsumos]
  );

  const displayedMaterialsData = useMemo(() => {
    if (dashMaterialsLimit === 'top8') {
      return dashMaterialsChartData.slice(0, 8);
    }
    return dashMaterialsChartData;
  }, [dashMaterialsChartData, dashMaterialsLimit]);

  const dashTotalMateriais = useMemo(() => {
    return Object.values(dashMaterialsMap).reduce((a, b) => a + b, 0);
  }, [dashMaterialsMap]);

  const dashTotalValor = useMemo(() => {
    return dashFilteredConsumos.reduce((acc, consumo) => acc + Number(consumo.valor_total || 0), 0);
  }, [dashFilteredConsumos]);

  const dashTotalRequisicoes = useMemo(() => {
    const reqIds = new Set<string>();
    dashFilteredConsumos.forEach((consumo) => {
      if (consumo.requisicao_compra_id) {
        reqIds.add(consumo.requisicao_compra_id);
      }
    });
    if (reqIds.size > 0) {
      return reqIds.size;
    }
    return dashFilteredCheckins.length;
  }, [dashFilteredConsumos, dashFilteredCheckins]);

  const dashCategoryChartData = useMemo(() => {
    const map: Record<string, { name: string; valor: number; quantidade: number }> = {};
    dashFilteredConsumos.forEach((c) => {
      const cat = getMaterialCategory(c.material);
      if (!map[cat]) {
        map[cat] = { name: cat, valor: 0, quantidade: 0 };
      }
      map[cat].valor += Number(c.valor_total || 0);
      map[cat].quantidade += Number(c.quantidade || 0);
    });

    const list = Object.values(map);
    const hasValor = list.some((item) => item.valor > 0);
    list.sort((a, b) => (hasValor ? b.valor - a.valor : b.quantidade - a.quantidade));
    return {
      items: list,
      hasValor,
      totalValor: list.reduce((acc, curr) => acc + curr.valor, 0),
      totalQuantidade: list.reduce((acc, curr) => acc + curr.quantidade, 0),
    };
  }, [dashFilteredConsumos]);

  const dashTimelineData = useMemo(() => {
    const dayMap = new Map<string, { dateStr: string; timestamp: number; limpezas: number; insumos: number; valor: number }>();
    const ensureDay = (dateValue: string) => {
      const d = new Date(dateValue);
      const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (!dayMap.has(key)) {
        dayMap.set(key, { dateStr: key, timestamp: dayStart, limpezas: 0, insumos: 0, valor: 0 });
      }
      return dayMap.get(key)!;
    };
    dashFilteredCheckins.forEach((checkin) => {
      ensureDay(checkin.created_at).limpezas += 1;
    });
    dashFilteredConsumos.forEach((consumo) => {
      const day = ensureDay(consumo.consumo_em);
      day.insumos += Number(consumo.quantidade || 0);
      day.valor += Number(consumo.valor_total || 0);
    });
    return Array.from(dayMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [dashFilteredCheckins, dashFilteredConsumos]);

  const dashTopConsumoAmbientes = useMemo(() => {
    const map = new Map<string, { nome: string; bloco: string; codigo: string; total: number }>();
    dashFilteredConsumos.forEach((c) => {
      const amb = ambienteMap.get(c.ambiente_id);
      const key = c.ambiente_id || c.ambiente_nome;
      const current = map.get(key) || {
        nome: c.ambiente_nome || amb?.nome || 'Ambiente',
        bloco: c.ambiente_bloco || amb?.bloco || 'Geral',
        codigo: c.ambiente_codigo || amb?.codigo || '—',
        total: 0,
      };
      current.total += c.quantidade;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [dashFilteredConsumos, ambienteMap]);

  const maxConsumo = useMemo(() => {
    return Math.max(...dashTopConsumoAmbientes.map((a) => a.total), 1);
  }, [dashTopConsumoAmbientes]);

  const sortedConsumoData = useMemo(() => {
    return [...dashFilteredConsumos]
      .filter((item) => {
        if (consumoDrilldownFilterDate) {
          const itemDate = new Date(item.consumo_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (itemDate !== consumoDrilldownFilterDate) return false;
        }
        if (consumoDrilldownFilterMaterial && consumoDrilldownFilterMaterial !== 'todos') {
          if (item.material !== consumoDrilldownFilterMaterial) return false;
        }
        if (consumoDrilldownSearch.trim()) {
          const term = consumoDrilldownSearch.toLowerCase();
          const matchAmbiente = item.ambiente_nome?.toLowerCase().includes(term);
          const matchCodigo = item.ambiente_codigo?.toLowerCase().includes(term);
          const matchBloco = item.ambiente_bloco?.toLowerCase().includes(term);
          const matchMaterial = item.material?.toLowerCase().includes(term) || (materialLabels[item.material] || '').toLowerCase().includes(term);
          const matchReq = item.requisicao_numero?.toLowerCase().includes(term);
          return matchAmbiente || matchCodigo || matchBloco || matchMaterial || matchReq;
        }
        return true;
      })
      .sort((a, b) => new Date(b.consumo_em).getTime() - new Date(a.consumo_em).getTime());
  }, [dashFilteredConsumos, consumoDrilldownFilterDate, consumoDrilldownFilterMaterial, consumoDrilldownSearch]);

  if (loading && needsFetch) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar de Filtros */}
      <div className="bg-surface-subtle/40 border border-border-default/60 rounded-xl p-3.5 mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary pr-1">
            <Filter className="h-3.5 w-3.5 text-emerald-600" />
            <span>Filtros do Painel:</span>
          </div>

          {/* Período */}
          <div className="w-40">
            <Select value={dashPeriodFilter} onValueChange={(val: any) => setDashPeriodFilter(val)}>
              <SelectTrigger className="h-8 text-xs bg-white input-system">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes_atual">Mês Atual</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="todos">Todo o Histórico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bloco */}
          <div className="w-44">
            <Select value={dashBlocoFilter} onValueChange={setDashBlocoFilter}>
              <SelectTrigger className="h-8 text-xs bg-white input-system">
                <SelectValue placeholder="Bloco / Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Blocos</SelectItem>
                {uniqueBlocos.map((bloco) => (
                  <SelectItem key={bloco} value={bloco}>
                    {bloco}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Ambiente */}
          <div className="w-36">
            <Select value={dashTipoFilter} onValueChange={setDashTipoFilter}>
              <SelectTrigger className="h-8 text-xs bg-white input-system">
                <SelectValue placeholder="Tipo de Espaço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="refeitorio">Refeitório</SelectItem>
                <SelectItem value="banheiro">Banheiros</SelectItem>
                <SelectItem value="sala">Salas de Aula</SelectItem>
                <SelectItem value="laboratorio">Laboratórios</SelectItem>
                <SelectItem value="corredor">Convivência / Foyer</SelectItem>
                <SelectItem value="outros">Outros Espaços</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de Insumo */}
          <div className="w-48 sm:w-56">
            <Select value={dashMaterialFilter} onValueChange={setDashMaterialFilter}>
              <SelectTrigger className="h-8 text-xs bg-white input-system">
                <SelectValue placeholder="Tipo de Insumo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Insumos</SelectItem>
                {materialOptions.map((material) => (
                  <SelectItem key={material} value={material} title={material}>
                    {materialEmojis[material] || '🔹'} {formatMaterialDisplayName(material)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(dashPeriodFilter !== 'mes_atual' || dashBlocoFilter !== defaultBloco || dashTipoFilter !== 'todos' || dashMaterialFilter !== 'todos') && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setDashPeriodFilter('mes_atual');
              setDashBlocoFilter(defaultBloco);
              setDashTipoFilter('todos');
              setDashMaterialFilter('todos');
            }}
            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold"
          >
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Executive KPIs: Insumos e Requisições */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted">Total de Requisições</span>
            <ClipboardList className="h-4 w-4 text-emerald-600 opacity-70" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {dashTotalRequisicoes}
          </div>
          <div className="text-[10px] text-text-muted truncate">
            {dashTotalRequisicoes === 1 ? 'requisição atendida no período' : 'requisições atendidas no período'}
          </div>
        </div>

        <div className="p-3.5 bg-surface-card rounded-xl border border-border-default/70 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted">Valor Total Gasto</span>
            <TrendingUp className="h-4 w-4 text-teal-600 opacity-70" />
          </div>
          <div className="text-2xl font-black text-teal-700">
            {formatCurrency(dashTotalValor)}
          </div>
          <div className="text-[10px] text-text-muted truncate">
            {dashTotalMateriais.toLocaleString('pt-BR')} itens consumidos no período
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Chart 1: Distribution by Category */}
        <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Distribuição por Categoria
              </h4>
              <p className="text-xs text-text-muted">
                {dashCategoryChartData.hasValor
                  ? 'Participação financeira por grupo de insumos.'
                  : 'Distribuição da quantidade por grupo de insumos.'}
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setConsumoDrilldownFilterMaterial(null);
                setConsumoDrilldownSearch('');
                setIsConsumoDrilldownOpen(true);
              }}
              className="h-7 text-xs gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50 shrink-0 font-semibold"
              title="Abrir detalhamento de insumos"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Detalhar
            </Button>
          </div>
          <div className="min-h-72 w-full pt-2 flex items-center justify-center">
            {dashCategoryChartData.items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                Sem dados de categorias para o período selecionado.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full py-2">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashCategoryChartData.items}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey={dashCategoryChartData.hasValor ? 'valor' : 'quantidade'}
                        nameKey="name"
                      >
                        {dashCategoryChartData.items.map((entry, index) => (
                          <Cell
                            key={`cell-cat-${index}`}
                            fill={CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: number, name: string) => {
                          const total = dashCategoryChartData.hasValor
                            ? dashCategoryChartData.totalValor
                            : dashCategoryChartData.totalQuantidade;
                          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                          const formattedVal = dashCategoryChartData.hasValor
                            ? formatCurrency(val)
                            : `${val} un`;
                          return [`${formattedVal} (${pct}%)`, name];
                        }}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 w-full sm:max-w-[220px]">
                  {dashCategoryChartData.items.map((item, index) => {
                    const total = dashCategoryChartData.hasValor
                      ? dashCategoryChartData.totalValor
                      : dashCategoryChartData.totalQuantidade;
                    const currentVal = dashCategoryChartData.hasValor ? item.valor : item.quantidade;
                    const pct = total > 0 ? ((currentVal / total) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-2 text-xs bg-surface-subtle/40 px-2.5 py-1.5 rounded-lg border border-border-default/40"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length] }}
                          />
                          <span className="font-medium text-text-secondary truncate" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold text-text-primary text-[11px]">
                            {dashCategoryChartData.hasValor ? formatCurrency(item.valor) : `${item.quantidade} un`}
                          </span>
                          <span className="text-[10px] font-semibold text-text-muted">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Temporal Evolution of Material Inputs */}
        <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Evolução Temporal de Insumos
              </h4>
              <p className="text-xs text-text-muted">Valor diário gasto com materiais e insumos repostos.</p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setConsumoDrilldownFilterDate(null);
                setConsumoDrilldownFilterMaterial(dashMaterialFilter !== 'todos' ? dashMaterialFilter : null);
                setConsumoDrilldownSearch('');
                setIsConsumoDrilldownOpen(true);
              }}
              className="h-7 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0 font-semibold"
              title="Abrir detalhamento de consumo"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Detalhar
            </Button>
          </div>
          <div className="h-72 w-full pt-2">
            {dashTimelineData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                Sem registros de reposição para o período selecionado.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dashTimelineData}
                  margin={{ top: 10, right: 15, left: -5, bottom: 20 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload.length > 0) {
                      const clickedItem = data.activePayload[0].payload;
                      if (clickedItem && clickedItem.dateStr) {
                        setConsumoDrilldownFilterDate(clickedItem.dateStr);
                        setConsumoDrilldownFilterMaterial(null);
                        setIsConsumoDrilldownOpen(true);
                      }
                    }
                  }}
                  className="cursor-pointer"
                >
                  <defs>
                    <linearGradient id="colorInsumosComp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    allowDecimals={false}
                    tickFormatter={(val: number) =>
                      val >= 1000 ? `R$ ${(val / 1000).toFixed(1)}k` : `R$ ${val}`
                    }
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-neutral-800 p-2.5 rounded-lg shadow-md border border-slate-200 dark:border-neutral-700 text-xs space-y-1">
                          <p className="font-semibold text-slate-800 dark:text-neutral-100">{item.dateStr}</p>
                          <div className="flex items-center justify-between gap-4 text-slate-600 dark:text-neutral-300 pt-1 border-t border-slate-100 dark:border-neutral-700/60">
                            <span>Valor Gasto:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(item.valor || 0)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-neutral-400 text-[11px]">
                            <span>Quantidade:</span>
                            <span className="font-semibold">{item.insumos || 0} un</span>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-neutral-400 italic pt-0.5">
                            Clique para detalhar
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    name="Valor Gasto"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorInsumosComp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Material Consumption by Category */}
        <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Consumo Geral de Insumos
              </h4>
              <p className="text-xs text-text-muted">Distribuição acumulada de reposição por tipo de material no período.</p>
            </div>
            <div className="flex items-center gap-2">
              {dashMaterialsChartData.length > 8 && (
                <div className="flex items-center rounded-lg border border-border-default/70 bg-surface-base p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDashMaterialsLimit('top8')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      dashMaterialsLimit === 'top8'
                        ? 'bg-white shadow-xs text-teal-700 font-semibold dark:bg-neutral-800 dark:text-teal-400'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Top 8
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashMaterialsLimit('all')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      dashMaterialsLimit === 'all'
                        ? 'bg-white shadow-xs text-teal-700 font-semibold dark:bg-neutral-800 dark:text-teal-400'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Todos ({dashMaterialsChartData.length})
                  </button>
                </div>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setConsumoDrilldownFilterDate(null);
                  setConsumoDrilldownFilterMaterial(dashMaterialFilter !== 'todos' ? dashMaterialFilter : null);
                  setConsumoDrilldownSearch('');
                  setIsConsumoDrilldownOpen(true);
                }}
                className="h-7 text-xs gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50 shrink-0 font-semibold"
                title="Abrir detalhamento de consumo"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Detalhar
              </Button>
            </div>
          </div>
          <div
            className="w-full pt-2 transition-all duration-200"
            style={{
              height: `${Math.min(650, Math.max(288, displayedMaterialsData.length * 38 + 40))}px`,
            }}
          >
            {displayedMaterialsData.length === 0 || displayedMaterialsData.every((d) => d.quantidade === 0) ? (
              <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                Nenhum consumo de material registrado com os filtros selecionados.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={displayedMaterialsData}
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  onClick={(data: any) => {
                    if (data && data.activePayload && data.activePayload.length > 0) {
                      const clickedItem = data.activePayload[0].payload;
                      if (clickedItem && clickedItem.key) {
                        setConsumoDrilldownFilterMaterial(clickedItem.key);
                        setConsumoDrilldownFilterDate(null);
                        setIsConsumoDrilldownOpen(true);
                      }
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={135}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-neutral-800 p-2.5 rounded-lg shadow-md border border-slate-200 dark:border-neutral-700 text-xs max-w-xs space-y-1">
                          <p className="font-semibold text-slate-800 dark:text-neutral-100 leading-snug break-words">
                            {item.displayTitle || item.name}
                          </p>
                          {item.fullName && item.fullName !== item.displayTitle && (
                            <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2">
                              {item.fullName}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-slate-600 dark:text-neutral-300 pt-1 border-t border-slate-100 dark:border-neutral-700/60">
                            <span>Quantidade:</span>
                            <span className="font-bold text-teal-700 dark:text-teal-400">{item.quantidade} un</span>
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-neutral-400 italic pt-0.5">
                            Clique na barra para detalhar
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="quantidade"
                    fill="#0d9488"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top Consuming Environments */}
      <div className="bg-surface-card rounded-xl p-4 border border-border-default/70 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-text-primary text-sm uppercase tracking-wide flex items-center gap-2">
            <Boxes className="h-4 w-4 text-emerald-600" />
            Top 5 Ambientes em Consumo de Insumos
          </h4>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setConsumoDrilldownFilterDate(null);
              setConsumoDrilldownFilterMaterial(dashMaterialFilter !== 'todos' ? dashMaterialFilter : null);
              setConsumoDrilldownSearch('');
              setIsConsumoDrilldownOpen(true);
            }}
            className="h-6 text-[11px] text-emerald-700 hover:bg-emerald-50 px-2 font-semibold"
          >
            Ver detalhamento
          </Button>
        </div>
        {dashTopConsumoAmbientes.length === 0 ? (
          <div className="py-8 text-center text-text-muted italic text-xs">
            Nenhum consumo registrado no período.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {dashTopConsumoAmbientes.map((amb, idx) => {
              const percentage = Math.round((amb.total / maxConsumo) * 100);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setConsumoDrilldownSearch(amb.codigo);
                    setConsumoDrilldownFilterDate(null);
                    setConsumoDrilldownFilterMaterial(null);
                    setIsConsumoDrilldownOpen(true);
                  }}
                  className="space-y-1.5 p-2.5 rounded-lg border border-border-default/50 bg-surface-subtle/30 hover:bg-emerald-50/60 transition-colors cursor-pointer"
                  title="Clique para ver o detalhamento deste ambiente"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-text-primary truncate max-w-[180px]">
                      {amb.nome}
                      <span className="text-text-muted font-normal text-[10px] ml-1.5">({amb.bloco})</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700">{amb.total} un</span>
                  </div>
                  <div className="w-full h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drilldown Modal */}
      <Dialog open={isConsumoDrilldownOpen} onOpenChange={setIsConsumoDrilldownOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white rounded-2xl shadow-lifted">
          <DialogHeader className="pb-3 border-b border-border-default/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Detalhamento de Consumo de Insumos
                    <Badge variant="outline" className="text-[11px] font-normal border-emerald-300 text-emerald-800 bg-emerald-50">
                      Detalhamento
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Registro analítico detalhado das reposições realizadas no período ({sortedConsumoData.length} registros).
                  </DialogDescription>
                </div>
              </div>
              {(consumoDrilldownFilterDate || consumoDrilldownFilterMaterial) && (
                <div className="flex items-center gap-1.5">
                  {consumoDrilldownFilterDate && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 text-blue-800">
                      Data: {consumoDrilldownFilterDate}
                      <button onClick={() => setConsumoDrilldownFilterDate(null)} className="ml-1 hover:text-blue-950 font-bold">×</button>
                    </Badge>
                  )}
                  {consumoDrilldownFilterMaterial && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-emerald-100 text-emerald-800">
                      Material: {materialLabels[consumoDrilldownFilterMaterial] || consumoDrilldownFilterMaterial}
                      <button onClick={() => setConsumoDrilldownFilterMaterial(null)} className="ml-1 hover:text-emerald-950 font-bold">×</button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="py-3 flex items-center justify-between gap-3 flex-wrap bg-slate-50/70 px-4 -mx-6 border-b border-slate-200/80">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={consumoDrilldownSearch}
                  onChange={(e) => setConsumoDrilldownSearch(e.target.value)}
                  placeholder="Buscar por ambiente, código, bloco..."
                  className="h-8 pl-8 text-xs bg-white input-system"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(consumoDrilldownSearch || consumoDrilldownFilterDate || consumoDrilldownFilterMaterial) && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setConsumoDrilldownSearch('');
                    setConsumoDrilldownFilterDate(null);
                    setConsumoDrilldownFilterMaterial(null);
                  }}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-2">
            <Table className="table-system">
              <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-xs">
                <TableRow>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="w-28">Data</TableHead>
                  <TableHead className="text-right font-bold">Quantidade</TableHead>
                  <TableHead className="text-right font-bold">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedConsumoData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center italic text-muted-foreground">
                      Nenhum registro de consumo localizado com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedConsumoData.map((row) => (
                    <TableRow key={`${row.origem}-${row.id}`} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-semibold text-slate-900">{row.ambiente_nome}</div>
                        <div className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
                          <span>{row.ambiente_codigo}</span>
                          {row.ambiente_bloco && <span>• {row.ambiente_bloco}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {materialLabels[row.material] || row.material}
                      </TableCell>
                      <TableCell>
                        {row.origem === 'requisicao_compra' ? (
                          <div className="space-y-0.5">
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Requisição de compra</Badge>
                            <div className="text-xs text-slate-500">{row.requisicao_numero} • {row.requisicao_status === 'liquidada' ? 'Encaminhada para pagamento' : 'Enviada ao fornecedor'}</div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800">Check-in</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">
                        {new Date(row.consumo_em).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-extrabold text-emerald-800 font-mono bg-emerald-50/40">
                        {row.quantidade} {row.unidade}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800 font-mono">
                        {Number(row.valor_total || 0) > 0 ? formatCurrency(Number(row.valor_total)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="pt-3 border-t border-border-default/60 flex items-center justify-between w-full">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>
                Total consolidado:{' '}
                <strong className="text-slate-800">
                  {sortedConsumoData.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString('pt-BR')} unidades
                </strong>
              </span>
              <span>•</span>
              <span>
                Valor:{' '}
                <strong className="text-emerald-700 font-bold">
                  {formatCurrency(sortedConsumoData.reduce((acc, r) => acc + Number(r.valor_total || 0), 0))}
                </strong>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConsumoDrilldownOpen(false)}
              className="text-xs"
            >
              Fechar Detalhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
