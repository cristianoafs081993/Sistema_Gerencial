import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListChecks,
  RefreshCw,
  TimerReset,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import { ChartPanel } from '@/components/design-system/ChartPanel';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { loadAutomationSavingsSummary, type AutomationSavingsSummary } from '@/services/automationSavingsService';
import {
  getMonthlySavingsProjectionMinutes,
  summarizeAutomationSavings,
  type AutomationSavingsRow,
} from '@/utils/automationSavings';
import { cn } from '@/lib/utils';

const formatInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthStart = () => {
  const date = new Date();
  date.setDate(1);
  return formatInputDate(date);
};

const getToday = () => formatInputDate(new Date());

const formatHours = (minutes: number) => {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  return `${(minutes / 60).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: minutes >= 600 ? 0 : 1,
  })} h`;
};

const formatExecutions = (value: number) =>
  value.toLocaleString('pt-BR', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  });

const toHours = (minutes: number) => Number((minutes / 60).toFixed(1));

function buildModuleChartData(rows: AutomationSavingsRow[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(row.moduleName, (map.get(row.moduleName) || 0) + row.totalSavedMinutes);
  });

  return Array.from(map.entries())
    .map(([moduleName, savedMinutes]) => ({
      moduleName,
      horas: toHours(savedMinutes),
    }))
    .sort((left, right) => right.horas - left.horas);
}

export default function EconomiaTempo() {
  const [startDate, setStartDate] = useState(getCurrentMonthStart);
  const [endDate, setEndDate] = useState(getToday);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [summary, setSummary] = useState<AutomationSavingsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const nextSummary = await loadAutomationSavingsSummary({ startDate, endDate });
      setSummary(nextSummary);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar a economia de tempo.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const visibleRows = useMemo(() => {
    const rows = summary?.rows || [];
    if (moduleFilter === 'all') return rows;
    return rows.filter((row) => row.moduleName === moduleFilter);
  }, [summary?.rows, moduleFilter]);

  const visibleTotals = useMemo(() => summarizeAutomationSavings(visibleRows), [visibleRows]);
  const visibleMonthlyProjection = useMemo(
    () => getMonthlySavingsProjectionMinutes(visibleTotals.totalSavedMinutes, startDate, endDate),
    [endDate, startDate, visibleTotals.totalSavedMinutes],
  );

  const manualVsSystemData = useMemo(
    () =>
      visibleRows.map((row) => ({
        name: row.interactionName,
        manual: toHours(row.totalManualMinutes),
        sistema: toHours(row.totalAutomatedMinutes),
      })),
    [visibleRows],
  );

  const moduleChartData = useMemo(() => buildModuleChartData(visibleRows), [visibleRows]);

  const modules = summary?.modules || [];
  const realEventsCount = summary?.events.length || 0;

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        Estimativas e registros reais de automações conectadas ao sistema.
      </HeaderSubtitle>

      <HeaderActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => void loadSummary()}
          className="h-space-9 gap-space-2 border-border-default bg-white text-slate-700 shadow-shadow-sm hover:bg-[hsl(var(--secondary))]"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </HeaderActions>

      <FilterPanel
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setStartDate(getCurrentMonthStart());
              setEndDate(getToday());
              setModuleFilter('all');
            }}
          >
            Limpar filtros
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1.2fr)]">
          <label className="space-y-1.5">
            <span className="label-eyebrow block text-[10px]">Início</span>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="label-eyebrow block text-[10px]">Fim</span>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="label-eyebrow block text-[10px]">Módulo</span>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os módulos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {modules.map((moduleName) => (
                  <SelectItem key={moduleName} value={moduleName}>
                    {moduleName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </FilterPanel>

      {errorMessage ? (
        <SectionPanel className="border-destructive/30 bg-destructive/5">
          <p className="font-ui text-sm font-semibold text-destructive">{errorMessage}</p>
        </SectionPanel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tempo economizado"
          value={formatHours(visibleTotals.totalSavedMinutes)}
          subtitle={summary?.usedFallback ? 'Inclui estimativas locais' : 'Período selecionado'}
          icon={Clock3}
          stitchColor="emerald-green"
          isLoading={isLoading}
        />
        <StatCard
          title="Projeção mensal"
          value={formatHours(visibleMonthlyProjection)}
          subtitle="Ritmo médio do período"
          icon={CalendarClock}
          stitchColor="vibrant-blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Interações mapeadas"
          value={visibleTotals.mappedInteractions}
          subtitle={`${formatExecutions(visibleTotals.totalEstimatedExecutions)} execuções estimadas`}
          icon={ListChecks}
          stitchColor="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="Eventos reais"
          value={realEventsCount}
          subtitle={`${formatExecutions(visibleTotals.totalRealExecutions)} execuções registradas`}
          icon={Activity}
          stitchColor="purple"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel
          title="Manual versus sistema"
          description="Horas totais por interação no período selecionado."
          loading={isLoading}
          heightClassName="h-[340px]"
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={manualVsSystemData} margin={{ top: 8, right: 8, left: 0, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={90} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(value) => `${value} h`} />
                <Legend />
                <Bar dataKey="manual" name="Manual" fill="#cd191e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sistema" name="Sistema" fill="#2f9e41" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel
          title="Economia acumulada por módulo"
          description="Horas economizadas agregadas por módulo ou extensão."
          loading={isLoading}
          heightClassName="h-[340px]"
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleChartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="moduleName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip formatter={(value) => `${value} h`} />
                <Bar dataKey="horas" name="Horas economizadas" fill="#2f9e41" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <DataTablePanel
        title="Interações mapeadas"
        description="Comparativo entre execução manual, execução automatizada e economia consolidada."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[240px]">Interação</TableHead>
              <TableHead>Módulo/extensão</TableHead>
              <TableHead className="text-right">Manual</TableHead>
              <TableHead className="text-right">Sistema</TableHead>
              <TableHead className="text-right">Economia/execução</TableHead>
              <TableHead className="text-right">Execuções reais</TableHead>
              <TableHead className="text-right">Economia total</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-semibold text-text-primary">{row.interactionName}</p>
                    <p className="text-xs text-text-secondary">{row.source}</p>
                  </div>
                </TableCell>
                <TableCell>{row.moduleName}</TableCell>
                <TableCell className="text-right font-mono">{formatHours(row.baselineMinutes)}</TableCell>
                <TableCell className="text-right font-mono">{formatHours(row.automatedMinutes)}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">
                  {formatHours(row.savedMinutesPerRun)}
                </TableCell>
                <TableCell className="text-right font-mono">{formatExecutions(row.realExecutions)}</TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {formatHours(row.totalSavedMinutes)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'gap-1 rounded-full',
                      row.dataOrigin === 'real'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {row.dataOrigin === 'real' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <TimerReset className="h-3.5 w-3.5" />
                    )}
                    {row.dataOrigin === 'real' ? 'Evento real' : 'Estimativa'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {!isLoading && visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Nenhuma interação encontrada para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}
