import { useEffect, useMemo, useState } from 'react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeaderActions } from '@/components/HeaderParts';
import { DashboardCurrentTab } from '@/components/dashboard/DashboardCurrentTab';
import { DashboardFiltersSheet } from '@/components/dashboard/DashboardFiltersSheet';
import { DashboardRapTab } from '@/components/dashboard/DashboardRapTab';
import { getReadableTextColor, mixHexColors } from '@/components/dashboard/utils';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapReferenceYear,
  getRapSaldoAtual,
  isRapReinscrito,
} from '@/utils/rapMetrics';
import { useData } from '@/contexts/DataContext';
import { extractDimensionCode, getDimensionLabel, matchesDimensionFilter } from '@/utils/dimensionFilters';

export default function Dashboard() {
  const { atividades, empenhos, descentralizacoes, isLoading } = useData();
  const [hoveredBudgetDimension, setHoveredBudgetDimension] = useState<string | null>(null);
  const [selectedBudgetDimensionCode, setSelectedBudgetDimensionCode] = useState<string | null>(null);
  const [filterDimensao, setFilterDimensao] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [activeTab, setActiveTab] = useState<'corrente' | 'rap'>('corrente');

  const effectiveFilterDimensao = useMemo(() => {
    if (filterDimensao === 'all') return 'all';
    return extractDimensionCode(filterDimensao) || 'all';
  }, [filterDimensao]);

  useEffect(() => {
    if (filterDimensao !== 'all' && effectiveFilterDimensao === 'all') {
      setFilterDimensao('all');
    }
  }, [filterDimensao, effectiveFilterDimensao]);

  const origensDisponiveis = useMemo(() => {
    const origens = new Set<string>();

    atividades.forEach((atividade) => {
      if (atividade.origemRecurso) origens.add(atividade.origemRecurso);
    });
    empenhos.forEach((empenho) => {
      if (empenho.origemRecurso) origens.add(empenho.origemRecurso);
    });
    descentralizacoes.forEach((descentralizacao) => {
      if (descentralizacao.origemRecurso) origens.add(descentralizacao.origemRecurso);
    });

    return Array.from(origens).sort();
  }, [atividades, empenhos, descentralizacoes]);

  const filteredData = useMemo(() => {
    const filteredAtividades = atividades.filter((atividade) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: atividade.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || atividade.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem;
    });

    const empenhosCorrente = empenhos.filter((empenho) => empenho.tipo === 'exercicio');
    const empenhosRap = empenhos.filter((empenho) => empenho.tipo === 'rap');

    const matchDateRange = (data: string) => {
      if (!dateStart || !dateEnd) return true;

      const start = startOfDay(parseISO(dateStart));
      const end = endOfDay(parseISO(dateEnd));

      return isWithinInterval(new Date(data), { start, end });
    };

    const filteredEmpenhosCorrente = empenhosCorrente.filter((empenho) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: empenho.dimensao,
        planInternal: empenho.planoInterno,
        description: empenho.descricao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || empenho.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem && matchDateRange(empenho.dataEmpenho) && empenho.status !== 'cancelado';
    });

    const filteredEmpenhosRap = empenhosRap.filter((empenho) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: empenho.dimensao,
        planInternal: empenho.planoInterno,
        description: empenho.descricao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || empenho.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem && matchDateRange(empenho.dataEmpenho) && empenho.status !== 'cancelado';
    });

    const filteredDescentralizacoes = descentralizacoes.filter((descentralizacao) => {
      const matchDimensao = matchesDimensionFilter({
        dimensionValue: descentralizacao.dimensao,
        filterValue: effectiveFilterDimensao,
      });
      const matchOrigem = filterOrigem === 'all' || descentralizacao.origemRecurso === filterOrigem;

      return matchDimensao && matchOrigem;
    });

    return {
      atividades: filteredAtividades,
      empenhosCorrente: filteredEmpenhosCorrente,
      empenhosRap: filteredEmpenhosRap,
      descentralizacoes: filteredDescentralizacoes,
    };
  }, [atividades, empenhos, descentralizacoes, effectiveFilterDimensao, filterOrigem, dateStart, dateEnd]);

  const totalPlanejado = filteredData.atividades.reduce((total, atividade) => total + atividade.valorTotal, 0);
  const totalEmpenhado = filteredData.empenhosCorrente.reduce((total, empenho) => total + empenho.valor, 0);
  const totalDescentralizado = filteredData.descentralizacoes.reduce((total, descentralizacao) => total + descentralizacao.valor, 0);
  const aDescentralizar = totalPlanejado - totalDescentralizado;
  const percentualExecutado = totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0;
  const totalLiquidado = filteredData.empenhosCorrente.reduce(
    (total, empenho) => total + (empenho.valorLiquidadoOficial || empenho.valorLiquidado || 0),
    0,
  );
  const totalPago = filteredData.empenhosCorrente.reduce(
    (total, empenho) => total + (empenho.valorPagoOficial || empenho.valorPago || 0),
    0,
  );

  const rapReferenceYear = useMemo(() => getRapReferenceYear(empenhos), [empenhos]);

  const rapTotalInscrito = filteredData.empenhosRap.reduce((total, empenho) => {
    if (isRapReinscrito(empenho, rapReferenceYear)) return total;
    return total + getRapBaseVigente(empenho, rapReferenceYear);
  }, 0);
  const rapTotalReinscrito = filteredData.empenhosRap.reduce((total, empenho) => {
    if (!isRapReinscrito(empenho, rapReferenceYear)) return total;
    return total + getRapBaseVigente(empenho, rapReferenceYear);
  }, 0);
  const rapTotalLiquidadoNoAno = filteredData.empenhosRap.reduce(
    (total, empenho) => total + getRapLiquidadoNoAno(empenho),
    0,
  );
  const rapTotalSaldoAtual = filteredData.empenhosRap.reduce(
    (total, empenho) => total + getRapSaldoAtual(empenho, rapReferenceYear),
    0,
  );

  const dadosPorOrigem = useMemo(() => {
    const map = new Map<string, { planejado: number; empenhado: number }>();

    filteredData.atividades.forEach((atividade) => {
      const item = map.get(atividade.origemRecurso) || { planejado: 0, empenhado: 0 };
      item.planejado += atividade.valorTotal;
      map.set(atividade.origemRecurso, item);
    });

    filteredData.empenhosCorrente.forEach((empenho) => {
      const item = map.get(empenho.origemRecurso) || { planejado: 0, empenhado: 0 };
      item.empenhado += empenho.valor;
      map.set(empenho.origemRecurso, item);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        planejado: values.planejado,
        empenhado: values.empenhado,
        saldo: values.planejado - values.empenhado,
        percentual: values.planejado > 0 ? (values.empenhado / values.planejado) * 100 : 0,
      }))
      .filter((item) => item.planejado > 0 || item.empenhado > 0)
      .sort((a, b) => b.planejado - a.planejado);
  }, [filteredData]);

  const dadosPorNatureza = useMemo(() => {
    const map = new Map<string, number>();

    filteredData.empenhosCorrente.forEach((empenho) => {
      const natureza = empenho.naturezaDespesa.split(' - ')[0];
      map.set(natureza, (map.get(natureza) || 0) + empenho.valor);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filteredData]);

  const dadosMensais = useMemo(() => {
    const mapEmpenhado = new Map<string, number>();
    const mapPago = new Map<string, number>();
    const sortedEmpenhos = [...filteredData.empenhosCorrente].sort(
      (left, right) => new Date(left.dataEmpenho).getTime() - new Date(right.dataEmpenho).getTime(),
    );

    sortedEmpenhos.forEach((empenho) => {
      const mes = format(new Date(empenho.dataEmpenho), 'MMM/yy', { locale: ptBR });
      mapEmpenhado.set(mes, (mapEmpenhado.get(mes) || 0) + empenho.valor);
      mapPago.set(mes, (mapPago.get(mes) || 0) + (empenho.valorPagoOficial || empenho.valorPago || 0));
    });

    let accEmpenhado = 0;
    let accPago = 0;

    return Array.from(mapEmpenhado.entries()).map(([mes, valorEmpenhado]) => {
      accEmpenhado += valorEmpenhado;
      accPago += mapPago.get(mes) || 0;

      return {
        name: mes,
        planejado: totalPlanejado > 0 ? totalPlanejado : accEmpenhado * 1.2,
        empenhado: accEmpenhado,
        pago: accPago,
      };
    });
  }, [filteredData, totalPlanejado]);

  const budgetTreemapData = useMemo(() => {
    const dimensionPalette = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6', '#6366f1', '#f43f5e'];
    const dimensionMap = new Map<string, Record<string, string | number>>();

    filteredData.atividades.forEach((atividade) => {
      const dimensao = atividade.dimensao || 'Sem Dimensao';
      const componente = atividade.componenteFuncional?.trim();

      if (!componente || componente.toLowerCase() === 'sem componente') return;

      const dimensionItem = dimensionMap.get(dimensao) || { name: dimensao };
      dimensionItem[componente] = ((dimensionItem[componente] as number) || 0) + atividade.valorTotal;
      dimensionMap.set(dimensao, dimensionItem);
    });

    return Array.from(dimensionMap.values())
      .map((dimension, index) => {
        const fill = dimensionPalette[index % dimensionPalette.length];
        const entries = Object.entries(dimension).filter(([key]) => key !== 'name');
        const total = entries.reduce((sum, [, value]) => sum + (value as number), 0);

        return {
          name: dimension.name as string,
          dimensionCode: extractDimensionCode(dimension.name as string) || '',
          value: total,
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

  const handleBudgetDimensionSelect = (dimensionValue?: string | null) => {
    const nextValue = extractDimensionCode(dimensionValue) || 'all';
    if (nextValue === 'all') return;

    setSelectedBudgetDimensionCode((currentValue) => (currentValue === nextValue ? null : nextValue));
    setHoveredBudgetDimension(null);
  };

  const { dadosDescentralizacao, uniqueOrigens } = useMemo(() => {
    const dimensionMap = new Map<string, Record<string, string | number>>();
    const origemSet = new Set<string>();

    filteredData.descentralizacoes.forEach((descentralizacao) => {
      const dimensao = descentralizacao.dimensao || 'Sem Dimensao';
      const origem = descentralizacao.origemRecurso || 'Sem Origem';

      origemSet.add(origem);

      const dimensionItem = dimensionMap.get(dimensao) || { name: dimensao };
      dimensionItem[origem] = ((dimensionItem[origem] as number) || 0) + descentralizacao.valor;
      dimensionMap.set(dimensao, dimensionItem);
    });

    return {
      dadosDescentralizacao: Array.from(dimensionMap.values()).sort((left, right) => {
        const totalLeft = Object.entries(left)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);
        const totalRight = Object.entries(right)
          .filter(([key]) => key !== 'name')
          .reduce((sum, [, value]) => sum + (value as number), 0);

        return totalRight - totalLeft;
      }),
      uniqueOrigens: Array.from(origemSet).sort(),
    };
  }, [filteredData]);

  const dadosRapPorOrigem = useMemo(() => {
    const map = new Map<string, { baseVigente: number; liquidadoNoAno: number; saldoAtual: number }>();

    filteredData.empenhosRap.forEach((empenho) => {
      const origem = empenho.origemRecurso || 'Sem origem';
      const item = map.get(origem) || { baseVigente: 0, liquidadoNoAno: 0, saldoAtual: 0 };

      item.baseVigente += getRapBaseVigente(empenho, rapReferenceYear);
      item.liquidadoNoAno += getRapLiquidadoNoAno(empenho);
      item.saldoAtual += getRapSaldoAtual(empenho, rapReferenceYear);

      map.set(origem, item);
    });

    return Array.from(map.entries())
      .map(([origem, values]) => ({
        origem,
        baseVigente: values.baseVigente,
        liquidadoNoAno: values.liquidadoNoAno,
        saldoAtual: values.saldoAtual,
        percentual: values.baseVigente > 0 ? (values.liquidadoNoAno / values.baseVigente) * 100 : 0,
      }))
      .filter((item) => item.baseVigente > 0)
      .sort((a, b) => b.saldoAtual - a.saldoAtual);
  }, [filteredData, rapReferenceYear]);

  const clearFilters = () => {
    setFilterDimensao('all');
    setFilterOrigem('all');
    setDateStart('');
    setDateEnd('');
    setHoveredBudgetDimension(null);
    setSelectedBudgetDimensionCode(null);
  };

  const hasActiveFilters =
    filterDimensao !== 'all' || filterOrigem !== 'all' || dateStart !== '' || dateEnd !== '';
  const activeFiltersCount = [filterDimensao !== 'all', filterOrigem !== 'all', dateStart !== '' || dateEnd !== ''].filter(Boolean).length;
  const activeDimensionLabel = getDimensionLabel(effectiveFilterDimensao);

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'corrente' | 'rap')}
        className="space-y-6"
      >
        <HeaderActions>
          <div className="hidden h-9 items-center gap-2 md:flex">
            <TabsList className="h-8 rounded-lg border border-border-default/60 bg-surface-card p-0.5 shadow-sm sm:h-9">
              <TabsTrigger
                value="corrente"
                className="h-7 rounded-md px-3 text-[11px] font-semibold text-slate-600 transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white sm:h-8 sm:px-4 sm:text-xs"
              >
                Exercicio Atual
              </TabsTrigger>
              <TabsTrigger
                value="rap"
                className="h-7 rounded-md px-3 text-[11px] font-semibold text-slate-600 transition-all data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white sm:h-8 sm:px-4 sm:text-xs"
              >
                RAP
              </TabsTrigger>
            </TabsList>

            <DashboardFiltersSheet
              buttonClassName="relative h-8 gap-2 border-border-default bg-surface-card text-xs text-text-primary shadow-sm transition-all hover:bg-surface-subtle sm:h-9 sm:text-sm"
              filterDimensao={filterDimensao}
              filterOrigem={filterOrigem}
              dateStart={dateStart}
              dateEnd={dateEnd}
              origensDisponiveis={origensDisponiveis}
              hasActiveFilters={hasActiveFilters}
              activeFiltersCount={activeFiltersCount}
              onFilterDimensaoChange={setFilterDimensao}
              onFilterOrigemChange={setFilterOrigem}
              onDateStartChange={setDateStart}
              onDateEndChange={setDateEnd}
              onClearFilters={clearFilters}
            />
          </div>
        </HeaderActions>

        <div className="mb-2 flex flex-col items-start gap-4 md:hidden sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-auto rounded-lg bg-slate-100 p-1">
            <TabsTrigger
              value="corrente"
              className="rounded-md px-6 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Exercicio Atual
            </TabsTrigger>
            <TabsTrigger
              value="rap"
              className="rounded-md px-6 py-2 text-sm font-semibold text-slate-500 transition-all hover:text-slate-900 data-[state=active]:bg-[#2f9e41] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Restos a Pagar (RAP)
            </TabsTrigger>
          </TabsList>

          <DashboardFiltersSheet
            buttonClassName="relative gap-2 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            filterDimensao={filterDimensao}
            filterOrigem={filterOrigem}
            dateStart={dateStart}
            dateEnd={dateEnd}
            origensDisponiveis={origensDisponiveis}
            hasActiveFilters={hasActiveFilters}
            activeFiltersCount={activeFiltersCount}
            onFilterDimensaoChange={setFilterDimensao}
            onFilterOrigemChange={setFilterOrigem}
            onDateStartChange={setDateStart}
            onDateEndChange={setDateEnd}
            onClearFilters={clearFilters}
          />
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
          <DashboardCurrentTab
            isLoading={isLoading}
            filteredData={filteredData}
            totalPlanejado={totalPlanejado}
            totalEmpenhado={totalEmpenhado}
            totalDescentralizado={totalDescentralizado}
            aDescentralizar={aDescentralizar}
            percentualExecutado={percentualExecutado}
            totalLiquidado={totalLiquidado}
            totalPago={totalPago}
            dadosPorOrigem={dadosPorOrigem}
            dadosMensais={dadosMensais}
            budgetTreemapData={budgetTreemapData}
            activeBudgetDimension={activeBudgetDimension}
            highlightedBudgetDimension={highlightedBudgetDimension}
            hoveredBudgetDimension={hoveredBudgetDimension}
            onHoverBudgetDimension={setHoveredBudgetDimension}
            onSelectBudgetDimension={handleBudgetDimensionSelect}
            dadosDescentralizacao={dadosDescentralizacao}
            uniqueOrigens={uniqueOrigens}
            dadosPorNatureza={dadosPorNatureza}
          />
        </TabsContent>

        <TabsContent value="rap" className="space-y-6 border-none p-0">
          <DashboardRapTab
            isLoading={isLoading}
            rapTotalInscrito={rapTotalInscrito}
            rapTotalReinscrito={rapTotalReinscrito}
            rapTotalLiquidadoNoAno={rapTotalLiquidadoNoAno}
            rapTotalSaldoAtual={rapTotalSaldoAtual}
            filteredRapCount={filteredData.empenhosRap.length}
            dadosRapPorOrigem={dadosRapPorOrigem}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
