import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BadgePercent,
  Car,
  CircleDollarSign,
  FileSpreadsheet,
  Leaf,
  LineChart as LineChartIcon,
  Receipt,
  SunMedium,
  Trees,
  Upload,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { ChartPanel } from '@/components/design-system/ChartPanel';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadEnergiaCampusData,
  parseEnergiaCampusWorkbook,
  saveEnergiaCampusImport,
  type EnergiaCampusData,
  type EnergiaConsumoFatura,
  type EnergiaFonte,
  type EnergiaSolarGeracao,
} from '@/services/energiaCampusService';
import { buildEnergyMetrics, filterEnergyData } from '@/utils/energyMetrics';

type EnergiaView = 'overview' | 'cosern' | 'mercatto' | 'solar' | 'contratos' | 'financeiro' | 'esg';

const SOURCE_COLORS: Record<EnergiaFonte, string> = {
  cosern: '#1a5ce6',
  mercatto: '#f97316',
  solar: '#2f9e41',
};

const SOURCE_LABELS: Record<EnergiaFonte, string> = {
  cosern: 'COSERN',
  mercatto: 'Mercatto',
  solar: 'UFVs',
};

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_START_DATE = `${CURRENT_YEAR}-01-01`;
const DEFAULT_END_DATE = `${CURRENT_YEAR}-12-31`;

const emptyData: EnergiaCampusData = {
  latestRun: null,
  consumoFaturas: [],
  solarGeracao: [],
  contratos: [],
  contratoExecucoes: [],
  warnings: [],
  mercattoContratosApi: {
    contratos: [],
    faturas: [],
    liquidacoes: [],
  },
};

function getView(pathname: string): EnergiaView {
  if (pathname.endsWith('/cosern')) return 'cosern';
  if (pathname.endsWith('/mercatto')) return 'mercatto';
  if (pathname.endsWith('/geracao-solar')) return 'solar';
  if (pathname.endsWith('/contratos')) return 'contratos';
  if (pathname.endsWith('/financeiro')) return 'financeiro';
  if (pathname.endsWith('/esg')) return 'esg';
  return 'overview';
}

function getTitle(view: EnergiaView) {
  const titles: Record<EnergiaView, string> = {
    overview: 'Energia Campus',
    cosern: 'Energia Campus - COSERN',
    mercatto: 'Energia Campus - Mercatto',
    solar: 'Energia Campus - Geração Solar',
    contratos: 'Energia Campus - Contratos',
    financeiro: 'Energia Campus - Financeiro',
    esg: 'Energia Campus - Indicadores ESG',
  };
  return titles[view];
}

function formatNumber(value: number | null | undefined, options: Intl.NumberFormatOptions = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/D';
  return new Intl.NumberFormat('pt-BR', options).format(value);
}

function formatKwh(value: number | null | undefined) {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/D';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/D';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatCompetencia(value?: string | null) {
  if (!value) return '-';
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function rowsBySource(data: EnergiaCampusData, source: Exclude<EnergiaFonte, 'solar'>) {
  return data.consumoFaturas.filter((item) => item.fonte === source);
}

function latestRows<T>(rows: T[], count = 10) {
  return rows.slice().reverse().slice(0, count);
}

function sumNullableValues(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0);
}

function solarAnnualByUfv(rows: EnergiaSolarGeracao[]) {
  const map = new Map<string, number>();
  rows
    .filter((row) => row.granularidade === 'anual')
    .forEach((row) => {
      map.set(row.ufvNome, (map.get(row.ufvNome) || 0) + (row.energiaGeradaKwh || 0));
    });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function buildSubstationMonthly(data: EnergiaCampusData) {
  const buckets = new Map<string, { key: string; label: string; sub1Kwh: number | null; sub2Kwh: number | null }>();
  const getBucket = (key: string) => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const [, month] = key.split('-');
    const next = { key, label: `${month}/${key.slice(2, 4)}`, sub1Kwh: null, sub2Kwh: null };
    buckets.set(key, next);
    return next;
  };

  rowsBySource(data, 'cosern').forEach((row) => {
    const key = (row.competencia || row.leituraFim || '').slice(0, 7);
    if (!key || !row.consumoTotalKwh) return;
    const bucket = getBucket(key);
    const substation = row.subestacao?.toLocaleLowerCase('pt-BR') || '';
    if (substation.includes('sub i') && !substation.includes('sub ii')) {
      bucket.sub1Kwh = sumNullableValues([bucket.sub1Kwh, row.consumoTotalKwh]);
    } else if (substation.includes('sub ii')) {
      bucket.sub2Kwh = sumNullableValues([bucket.sub2Kwh, row.consumoTotalKwh]);
    }
  });

  return Array.from(buckets.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function latestCompetencia(data: EnergiaCampusData) {
  const values = [
    ...data.consumoFaturas.map((row) => row.competencia || row.leituraFim),
    ...data.solarGeracao.map((row) => row.dataReferencia),
  ].filter((value): value is string => Boolean(value));
  const sorted = values.sort();
  return sorted[sorted.length - 1] || null;
}

function monthStart(value?: string | null) {
  if (!value) return null;
  return `${value.slice(0, 7)}-01`;
}

function buildMercattoApiEstimatedRows(data: EnergiaCampusData, referenceTariff: number | null): EnergiaConsumoFatura[] {
  if (!referenceTariff || referenceTariff <= 0) return [];

  const hasFaturas = data.mercattoContratosApi.faturas.length > 0;
  const rows = hasFaturas ? data.mercattoContratosApi.faturas : data.mercattoContratosApi.liquidacoes;

  return rows.flatMap((row): EnergiaConsumoFatura[] => {
    const valorFaturado = row.valorLiquido ?? row.valorBruto ?? null;
    const competencia = hasFaturas
      ? monthStart(row.dataEmissao || row.dataPagamento)
      : monthStart(row.dataLiquidacao || row.dataPagamento || row.dataEmissao);

    if (!valorFaturado || !competencia) return [];

    return [{
      fonte: 'mercatto',
      ambiente: 'Mercado Livre',
      contrato: hasFaturas ? String(row.contratoApiId || '') : row.contratoNumero || undefined,
      competencia,
      ano: Number(competencia.slice(0, 4)),
      consumoTotalKwh: valorFaturado / referenceTariff,
      valorFaturado,
      faturaNumero: row.numeroInstrumentoCobranca || undefined,
      fornecedor: 'MERCATTO ENERGIA LTDA',
      rawData: {
        source: hasFaturas ? 'contratos_api_faturas' : 'contratos_api_empenho_liquidacoes_cache',
        estimatedKwh: true,
        referenceTariff,
      },
    }];
  });
}

export default function EnergiaCampus() {
  const location = useLocation();
  const view = getView(location.pathname);
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<EnergiaCampusData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [sourceFilter, setSourceFilter] = useState<'all' | EnergiaFonte>('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const loaded = await loadEnergiaCampusData();
      setData(loaded);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao carregar dados de energia.');
      setData(emptyData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredData = useMemo(
    () =>
      filterEnergyData(data, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        fontes: sourceFilter === 'all' ? undefined : [sourceFilter],
      }),
    [data, startDate, endDate, sourceFilter],
  );

  const allDataMetrics = useMemo(() => buildEnergyMetrics(data), [data]);
  const metrics = useMemo(() => buildEnergyMetrics(filteredData), [filteredData]);
  const mercattoContratosApi = filteredData.mercattoContratosApi;
  const mercattoReferenceTariff =
    metrics.tarifaMediaMercatto ??
    metrics.tarifaMediaCosern ??
    metrics.tarifaMediaConhecida ??
    allDataMetrics.tarifaMediaMercatto ??
    allDataMetrics.tarifaMediaCosern ??
    allDataMetrics.tarifaMediaConhecida;
  const mercattoApiEstimatedRows = useMemo(
    () => buildMercattoApiEstimatedRows(filteredData, mercattoReferenceTariff),
    [filteredData, mercattoReferenceTariff],
  );
  const overviewData = useMemo<EnergiaCampusData>(() => {
    if (!mercattoApiEstimatedRows.length) return filteredData;
    return {
      ...filteredData,
      consumoFaturas: [
        ...filteredData.consumoFaturas.filter((row) => row.fonte !== 'mercatto' || row.consumoTotalKwh !== null),
        ...mercattoApiEstimatedRows,
      ],
    };
  }, [filteredData, mercattoApiEstimatedRows]);
  const overviewMetrics = useMemo(() => buildEnergyMetrics(overviewData), [overviewData]);
  const overviewSubstationMonthly = useMemo(() => buildSubstationMonthly(overviewData), [overviewData]);
  const overviewSourceBars = useMemo(
    () =>
      overviewMetrics.sourceSummaries.map((item) => ({
        ...item,
        label: SOURCE_LABELS[item.fonte],
        value: item.consumoKwh,
      })),
    [overviewMetrics.sourceSummaries],
  );
  const energiaMonitoradaKwh = useMemo(
    () => sumNullableValues([overviewMetrics.consumoFaturadoConhecidoKwh, overviewMetrics.energiaSolarGeradaKwh]),
    [overviewMetrics.consumoFaturadoConhecidoKwh, overviewMetrics.energiaSolarGeradaKwh],
  );
  const competenciaMaisRecente = useMemo(() => latestCompetencia(filteredData), [filteredData]);
  const registrosImportados = filteredData.consumoFaturas.length + filteredData.solarGeracao.length + filteredData.contratos.length + filteredData.contratoExecucoes.length;
  const mercattoValorFaturasApi = useMemo(
    () => sumNullableValues(mercattoContratosApi.faturas.map((fatura) => fatura.valorLiquido ?? fatura.valorBruto)),
    [mercattoContratosApi.faturas],
  );
  const mercattoValorLiquidadoApi = useMemo(
    () => sumNullableValues(mercattoContratosApi.liquidacoes.map((liquidacao) => liquidacao.valorLiquido ?? liquidacao.valorBruto)),
    [mercattoContratosApi.liquidacoes],
  );
  const quantidadeFaturasVisaoGeral = metrics.faturasQuantidade + mercattoContratosApi.faturas.length;
  const title = getTitle(view);

  const commonActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input
        type="date"
        value={startDate}
        onChange={(event) => setStartDate(event.target.value)}
        className="h-9 rounded-lg border border-border-default bg-white px-3 text-xs font-medium text-text-primary shadow-sm"
        aria-label="Data inicial"
      />
      <input
        type="date"
        value={endDate}
        onChange={(event) => setEndDate(event.target.value)}
        className="h-9 rounded-lg border border-border-default bg-white px-3 text-xs font-medium text-text-primary shadow-sm"
        aria-label="Data final"
      />
      <select
        value={sourceFilter}
        onChange={(event) => setSourceFilter(event.target.value as 'all' | EnergiaFonte)}
        className="h-9 rounded-lg border border-border-default bg-white px-3 text-xs font-medium text-text-primary shadow-sm"
        aria-label="Fonte de energia"
      >
        <option value="all">Todas as fontes</option>
        <option value="cosern">COSERN</option>
        <option value="mercatto">Mercatto</option>
        <option value="solar">UFVs</option>
      </select>
    </div>
  );

  const renderOverview = () => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Energia monitorada" value={formatKwh(energiaMonitoradaKwh)} subtitle="COSERN + Mercatto + geração solar" icon={Zap} stitchColor="vibrant-blue" />
        <StatCard title="Consumo COSERN" value={formatKwh(overviewMetrics.consumoCosernKwh)} subtitle="2 subestações" icon={Zap} stitchColor="vibrant-blue" />
        <StatCard title="Consumo Mercatto" value={formatKwh(overviewMetrics.consumoMercattoKwh)} subtitle={mercattoApiEstimatedRows.length ? 'Estimado por faturas/liquidações' : 'Mercado livre'} icon={LineChartIcon} stitchColor="amber" />
        <StatCard title="Energia solar gerada" value={formatKwh(overviewMetrics.energiaSolarGeradaKwh)} subtitle="UFVs do campus" icon={SunMedium} stitchColor="emerald-green" />
        <StatCard title="Quantidade de faturas" value={quantidadeFaturasVisaoGeral} subtitle="Planilha + contratos API" icon={Receipt} stitchColor="purple" />
        <StatCard title="Economia estimada" value={formatCurrency(overviewMetrics.economiaSolarEstimada)} subtitle="Solar x tarifa média conhecida" icon={CircleDollarSign} stitchColor="emerald-green" />
      </div>

      <ChartPanel title="Evolução do consumo total do campus (kWh)" loading={isLoading}>
        <div className="h-[380px]">
          <ResponsiveContainer>
            <LineChart data={overviewMetrics.monthly} margin={{ top: 16, right: 28, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={72} />
              <Tooltip formatter={(value) => formatKwh(Number(value))} />
              <Line type="monotone" dataKey="totalKwh" name="Consumo total" stroke={SOURCE_COLORS.cosern} strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mercattoKwh" name="Mercatto" stroke={SOURCE_COLORS.mercatto} strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="solarKwh" name="UFVs" stroke={SOURCE_COLORS.solar} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Participação das fontes no consumo total (kWh)" loading={isLoading}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={overviewMetrics.sourceSummaries.filter((item) => item.consumoKwh !== null)}
                  dataKey="consumoKwh"
                  nameKey="fonte"
                  innerRadius={70}
                  outerRadius={110}
                  label={(item) => SOURCE_LABELS[item.fonte as EnergiaFonte]}
                >
                  {overviewMetrics.sourceSummaries.map((entry) => (
                    <Cell key={entry.fonte} fill={SOURCE_COLORS[entry.fonte]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatKwh(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {mercattoApiEstimatedRows.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Mercatto estimado por faturas/liquidações do contrato usando tarifa média conhecida.
            </p>
          ) : null}
        </ChartPanel>
        <ChartPanel title="Consumo por subestação - COSERN (kWh)" loading={isLoading}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <BarChart data={overviewSubstationMonthly} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} width={72} />
                <Tooltip formatter={(value) => formatKwh(Number(value))} />
                <Bar dataKey="sub1Kwh" name="SUB I - CTq" fill={SOURCE_COLORS.cosern} radius={[4, 4, 0, 0]} />
                <Bar dataKey="sub2Kwh" name="SUB II - Campo" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Evolução da geração solar (UFVs) - kWh" loading={isLoading}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <LineChart data={overviewMetrics.monthly} margin={{ top: 16, right: 20, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} width={72} />
                <Tooltip formatter={(value) => formatKwh(Number(value))} />
                <Line type="monotone" dataKey="solarKwh" name="UFVs" stroke={SOURCE_COLORS.solar} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Consumo acumulado por fonte (kWh)" loading={isLoading}>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <BarChart data={overviewSourceBars} layout="vertical" margin={{ top: 16, left: 32, right: 40, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="label" width={104} fontSize={12} />
                <Tooltip formatter={(value) => formatKwh(Number(value))} />
                <Bar dataKey="value" name="kWh" radius={[0, 4, 4, 0]}>
                  {overviewSourceBars.map((entry) => (
                    <Cell key={entry.fonte} fill={SOURCE_COLORS[entry.fonte]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-primary" />
          <p>
            Indicadores baseados nas abas COSERN, Mercatto, UFVs e no contrato Mercatto. Geração solar fica separada do consumo faturado; Mercatto usa kWh real quando existe e estimativa financeira quando só há fatura/liquidação.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Período analisado</p>
          <p className="font-medium text-foreground">{startDate ? formatDate(startDate) : 'Início'} a {endDate ? formatDate(endDate) : 'fim'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Competência mais recente</p>
          <p className="font-medium text-foreground">{formatCompetencia(competenciaMaisRecente)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Registros importados</p>
          <p className="font-medium text-foreground">{formatNumber(registrosImportados)} registros</p>
        </div>
      </div>

      {mercattoContratosApi.contratos.length || mercattoContratosApi.faturas.length || mercattoContratosApi.liquidacoes.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          <SectionPanel title="Mercatto nos contratos">
            <p className="text-2xl font-bold text-foreground">{mercattoContratosApi.contratos.length}</p>
            <p className="text-sm text-muted-foreground">contrato(s) localizado(s) em contratos_api por fornecedor/CNPJ/objeto.</p>
          </SectionPanel>
          <SectionPanel title="Faturas Mercatto API">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(mercattoValorFaturasApi)}</p>
            <p className="text-sm text-muted-foreground">{formatNumber(mercattoContratosApi.faturas.length)} fatura(s) sincronizada(s) no módulo de contratos.</p>
          </SectionPanel>
          <SectionPanel title="Liquidações Mercatto">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(mercattoValorLiquidadoApi)}</p>
            <p className="text-sm text-muted-foreground">{formatNumber(mercattoContratosApi.liquidacoes.length)} registro(s) no cache de liquidações Comprasnet.</p>
          </SectionPanel>
        </div>
      ) : null}
    </>
  );

  const renderCosern = () => {
    const rows = latestRows(rowsBySource(filteredData, 'cosern'), 12);
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Consumo COSERN" value={formatKwh(metrics.consumoCosernKwh)} subtitle="kWh no período" icon={Zap} stitchColor="vibrant-blue" />
          <StatCard title="Valor faturado" value={formatCurrency(metrics.custoCosern)} subtitle="Mercado cativo" icon={CircleDollarSign} stitchColor="vibrant-blue" />
          <StatCard title="Preço médio" value={metrics.tarifaMediaCosern === null ? 'N/D' : `${formatCurrency(metrics.tarifaMediaCosern)}/kWh`} subtitle="Custo dividido por kWh" icon={BadgePercent} stitchColor="purple" />
          <StatCard title="Quantidade de faturas" value={rowsBySource(filteredData, 'cosern').length} subtitle="Registros COSERN" icon={Receipt} stitchColor="amber" />
          <StatCard title="Subestações" value={new Set(rowsBySource(filteredData, 'cosern').map((item) => item.subestacao).filter(Boolean)).size} subtitle="Com consumo importado" icon={FileSpreadsheet} stitchColor="emerald-green" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Consumo mensal COSERN">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <BarChart data={metrics.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => formatKwh(Number(value))} />
                  <Bar dataKey="cosernKwh" name="COSERN" fill={SOURCE_COLORS.cosern} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
          <ChartPanel title="Custo mensal COSERN">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <LineChart data={metrics.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="cosernCost" name="Custo COSERN" stroke={SOURCE_COLORS.cosern} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        <ConsumptionTable title="Detalhamento das faturas COSERN" rows={rows} />
      </>
    );
  };

  const renderMercatto = () => {
    const rows = latestRows(rowsBySource(filteredData, 'mercatto'), 12);
    const hasDirectKwh = metrics.consumoMercattoKwh !== null;
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Consumo Mercatto" value={formatKwh(metrics.consumoMercattoKwh)} subtitle={hasDirectKwh ? 'kWh real importado' : 'N/D sem kWh direto'} icon={Zap} stitchColor="amber" />
          <StatCard title="Valor previsto/faturado" value={formatCurrency(metrics.custoMercatto)} subtitle="Mercado livre" icon={CircleDollarSign} stitchColor="amber" />
          <StatCard title="Preço médio" value={metrics.tarifaMediaMercatto === null ? 'N/D' : `${formatCurrency(metrics.tarifaMediaMercatto)}/kWh`} subtitle="Depende de kWh real" icon={BadgePercent} stitchColor="purple" />
          <StatCard title="Registros" value={rowsBySource(filteredData, 'mercatto').length} subtitle="Previsões importadas" icon={Receipt} stitchColor="vibrant-blue" />
          <StatCard title="Economia solar" value={formatCurrency(metrics.economiaSolarEstimada)} subtitle="Estimativa geral do painel" icon={CircleDollarSign} stitchColor="emerald-green" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <ChartPanel title="Valores Mercatto por competência">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <BarChart data={metrics.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="mercattoCost" name="Mercatto" fill={SOURCE_COLORS.mercatto} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
          <SectionPanel title="Metodologia Mercatto">
            <div className="space-y-3 text-sm leading-6 text-muted-foreground">
              <p>A planilha atual traz valores, competências, leituras e vencimentos do Mercado Livre.</p>
              <p>Quando a base traz kWh direto de Mercatto, consumo, preço médio por kWh e participação energética usam esse valor real. Linhas sem kWh direto continuam como N/D nesta aba.</p>
              <p>A estimativa por faturas/liquidações de contratos API aparece apenas na Visão Geral para compor KPIs e gráficos agregados; ela não é persistida como consumo real.</p>
            </div>
          </SectionPanel>
        </div>

        <ConsumptionTable title="Detalhamento Mercatto" rows={rows} />
      </>
    );
  };

  const renderSolar = () => {
    const annual = solarAnnualByUfv(filteredData.solarGeracao);
    const monthly = filteredData.solarGeracao.filter((item) => item.granularidade === 'mensal');
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Energia gerada" value={formatKwh(metrics.energiaSolarGeradaKwh)} subtitle="kWh com dados anuais" icon={SunMedium} stitchColor="emerald-green" />
          <StatCard title="UFVs ativas" value={annual.length} subtitle="Usinas com geração registrada" icon={SunMedium} stitchColor="emerald-green" />
          <StatCard title="Economia estimada" value={formatCurrency(metrics.economiaSolarEstimada)} subtitle="Tarifa média conhecida" icon={CircleDollarSign} stitchColor="emerald-green" />
          <StatCard title="CO₂ evitado" value={formatNumber(metrics.emissoesEvitadasTco2e, { maximumFractionDigits: 2 })} subtitle="tCO₂e" icon={Leaf} stitchColor="emerald-green" />
          <StatCard title="Participação limpa" value={formatPercent(metrics.reducaoEmissoesPercentual)} subtitle="Solar sobre energia conhecida" icon={BadgePercent} stitchColor="purple" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Geração por UFV">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <BarChart data={annual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => formatKwh(Number(value))} />
                  <Bar dataKey="value" name="kWh" fill={SOURCE_COLORS.solar} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
          <ChartPanel title="Geração mensal disponível">
            <div className="h-[320px]">
              <ResponsiveContainer>
                <LineChart data={monthly.map((item) => ({ label: `${String(item.mes).padStart(2, '0')}/${String(item.ano).slice(2)}`, value: item.energiaGeradaKwh }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => formatKwh(Number(value))} />
                  <Line type="monotone" dataKey="value" name="UFVs" stroke={SOURCE_COLORS.solar} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        </div>

        <SolarTable rows={filteredData.solarGeracao.filter((item) => item.granularidade === 'anual')} />
      </>
    );
  };

  const renderContratos = () => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Contratos ativos" value={metrics.contratosAtivos} subtitle="Energia importada" icon={FileSpreadsheet} stitchColor="vibrant-blue" />
        <StatCard title="Valor contratado" value={formatCurrency(filteredData.contratos.reduce((total, item) => total + (item.valorContratado || 0), 0))} subtitle="Quando disponível" icon={CircleDollarSign} stitchColor="amber" />
        <StatCard title="Consumo conhecido" value={formatKwh(metrics.consumoFaturadoConhecidoKwh)} subtitle="Execução em kWh" icon={Zap} stitchColor="vibrant-blue" />
        <StatCard title="Custo total" value={formatCurrency(metrics.custoTotal)} subtitle="COSERN + Mercatto" icon={CircleDollarSign} stitchColor="purple" />
        <StatCard title="Execuções COSERN" value={filteredData.contratoExecucoes.length} subtitle="Parcelas importadas" icon={Receipt} stitchColor="emerald-green" />
      </div>
      <ContractsTable contratos={filteredData.contratos} execucoes={filteredData.contratoExecucoes} />
    </>
  );

  const renderFinanceiro = () => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Custo total" value={formatCurrency(metrics.custoTotal)} subtitle="Fontes com valor" icon={CircleDollarSign} stitchColor="purple" />
        <StatCard title="Custo COSERN" value={formatCurrency(metrics.custoCosern)} subtitle="Mercado cativo" icon={CircleDollarSign} stitchColor="vibrant-blue" />
        <StatCard title="Custo Mercatto" value={formatCurrency(metrics.custoMercatto)} subtitle="Mercado livre" icon={CircleDollarSign} stitchColor="amber" />
        <StatCard title="Economia solar" value={formatCurrency(metrics.economiaSolarEstimada)} subtitle="Estimada" icon={CircleDollarSign} stitchColor="emerald-green" />
        <StatCard title="Tarifa média" value={metrics.tarifaMediaConhecida === null ? 'N/D' : `${formatCurrency(metrics.tarifaMediaConhecida)}/kWh`} subtitle="Base conhecida" icon={BadgePercent} stitchColor="purple" />
        <StatCard title="Faturas" value={metrics.faturasQuantidade} subtitle="Registros financeiros" icon={Receipt} stitchColor="vibrant-blue" />
      </div>

      <ChartPanel title="Custo mensal por fonte">
        <div className="h-[340px]">
          <ResponsiveContainer>
            <BarChart data={metrics.monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="cosernCost" name="COSERN" fill={SOURCE_COLORS.cosern} radius={[4, 4, 0, 0]} />
              <Bar dataKey="mercattoCost" name="Mercatto" fill={SOURCE_COLORS.mercatto} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      <FinancialTable data={filteredData} />
    </>
  );

  const renderEsg = () => (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Emissões evitadas" value={formatNumber(metrics.emissoesEvitadasTco2e, { maximumFractionDigits: 2 })} subtitle="tCO₂e" icon={Leaf} stitchColor="emerald-green" />
        <StatCard title="Energia solar" value={formatKwh(metrics.energiaSolarGeradaKwh)} subtitle="kWh gerados" icon={SunMedium} stitchColor="emerald-green" />
        <StatCard title="Árvores equivalentes" value={formatNumber(metrics.arvoresEquivalentes, { maximumFractionDigits: 0 })} subtitle="Mantidas por 20 anos" icon={Trees} stitchColor="emerald-green" />
        <StatCard title="Carros equivalentes" value={formatNumber(metrics.carrosEquivalentes, { maximumFractionDigits: 0 })} subtitle="Retirados por 1 ano" icon={Car} stitchColor="vibrant-blue" />
        <StatCard title="Redução estimada" value={formatPercent(metrics.reducaoEmissoesPercentual)} subtitle="Solar sobre energia conhecida" icon={BadgePercent} stitchColor="purple" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <ChartPanel title="Emissões evitadas por base solar">
          <div className="h-[320px]">
            <ResponsiveContainer>
              <BarChart data={solarAnnualByUfv(filteredData.solarGeracao).map((item) => ({ name: item.name, value: (item.value / 1000) * 0.5989 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => formatNumber(Number(value), { maximumFractionDigits: 2 })} />
                <Bar dataKey="value" name="tCO₂e" fill={SOURCE_COLORS.solar} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>
        <SectionPanel title="Metodologia e referências">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Emissões evitadas: kWh solar / 1000 × 0,5989 tCO₂e/MWh.</p>
            <p>Árvores equivalentes: tCO₂e / 0,147. Carros equivalentes: tCO₂e / 2,25.</p>
            <p>Indicadores sem dado-fonte direto são exibidos como N/D.</p>
          </div>
        </SectionPanel>
      </div>
    </>
  );

  const contentByView: Record<EnergiaView, () => JSX.Element> = {
    overview: renderOverview,
    cosern: renderCosern,
    mercatto: renderMercatto,
    solar: renderSolar,
    contratos: renderContratos,
    financeiro: renderFinanceiro,
    esg: renderEsg,
  };

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <HeaderSubtitle>
        <span>{title}</span>
      </HeaderSubtitle>
      <HeaderActions>{commonActions}</HeaderActions>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-text-primary">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Painel consolidado de consumo, custos, geração solar e indicadores ESG do campus.
          </p>
        </div>
        {data.latestRun ? (
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Base: {data.latestRun.sourceFile} · {formatDate(data.latestRun.importedAt.slice(0, 10))}
          </Badge>
        ) : null}
      </div>

      {!data.latestRun && !isLoading ? (
        <Alert>
          <FileSpreadsheet className="h-4 w-4" />
          <AlertDescription>
            Nenhuma base de energia foi importada ainda. Um superadministrador pode importar a planilha XLSX pelo botão no cabeçalho.
          </AlertDescription>
        </Alert>
      ) : null}

      {data.warnings.length ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertDescription>{data.warnings.join(' ')}</AlertDescription>
        </Alert>
      ) : null}

      {contentByView[view]()}
    </div>
  );
}

function ConsumptionTable({ title, rows }: { title: string; rows: ReturnType<typeof rowsBySource> }) {
  return (
    <DataTablePanel title={title}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Competência</TableHead>
            <TableHead>Leitura</TableHead>
            <TableHead>Subestação</TableHead>
            <TableHead>Fatura</TableHead>
            <TableHead>Parcela</TableHead>
            <TableHead className="text-right">Consumo FP</TableHead>
            <TableHead className="text-right">Consumo NP</TableHead>
            <TableHead className="text-right">Total kWh</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? rows.map((row, index) => (
            <TableRow key={`${row.fonte}-${row.faturaNumero}-${row.parcela}-${index}`}>
              <TableCell>{formatCompetencia(row.competencia)}</TableCell>
              <TableCell>{formatDate(row.leituraInicio)} - {formatDate(row.leituraFim)}</TableCell>
              <TableCell>{row.subestacao || '-'}</TableCell>
              <TableCell>{row.faturaNumero || '-'}</TableCell>
              <TableCell>{row.parcela || '-'}</TableCell>
              <TableCell className="text-right">{formatKwh(row.consumoAtivoFpKwh)}</TableCell>
              <TableCell className="text-right">{formatKwh(row.consumoAtivoNpKwh)}</TableCell>
              <TableCell className="text-right font-semibold">{formatKwh(row.consumoTotalKwh)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(row.valorFaturado)}</TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Nenhum registro no filtro atual.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTablePanel>
  );
}

function SolarTable({ rows }: { rows: EnergiaSolarGeracao[] }) {
  return (
    <DataTablePanel title="Resumo anual por UFV">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ano</TableHead>
            <TableHead>UFV</TableHead>
            <TableHead className="text-right">Energia gerada</TableHead>
            <TableHead>Observação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {latestRows(rows, 15).map((row, index) => (
            <TableRow key={`${row.ufvNome}-${row.ano}-${index}`}>
              <TableCell>{row.ano || '-'}</TableCell>
              <TableCell>{row.ufvNome}</TableCell>
              <TableCell className="text-right font-semibold">{formatKwh(row.energiaGeradaKwh)} kWh</TableCell>
              <TableCell>{row.observacao || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTablePanel>
  );
}

function ContractsTable({
  contratos,
  execucoes,
}: {
  contratos: EnergiaCampusData['contratos'];
  execucoes: EnergiaCampusData['contratoExecucoes'];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <DataTablePanel title="Contratos de energia">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fonte</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((row) => (
              <TableRow key={`${row.fonte}-${row.contratoNumero}`}>
                <TableCell>{SOURCE_LABELS[row.fonte]}</TableCell>
                <TableCell>{row.modalidade || '-'}</TableCell>
                <TableCell>{row.fornecedor || '-'}</TableCell>
                <TableCell>{row.contratoNumero || '-'}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(row.valorContratado)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.situacao || 'N/D'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTablePanel>

      <DataTablePanel title="Execução COSERN por parcela">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parcela</TableHead>
              <TableHead className="text-right">Executado</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {latestRows(execucoes, 12).map((row, index) => (
              <TableRow key={`${row.parcela}-${index}`}>
                <TableCell>{row.parcela}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.valorExecutado)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.valorPrevisto)}</TableCell>
                <TableCell className="text-right">{formatPercent(row.percentualExecucao)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}

function FinancialTable({ data }: { data: EnergiaCampusData }) {
  const rows = latestRows(data.consumoFaturas, 14);
  return (
    <DataTablePanel title="Resumo financeiro por fatura/previsão">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fonte</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead>Processo</TableHead>
            <TableHead className="text-right">Consumo</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.fonte}-${row.parcela}-${index}`}>
              <TableCell>{SOURCE_LABELS[row.fonte]}</TableCell>
              <TableCell>{formatCompetencia(row.competencia)}</TableCell>
              <TableCell>{row.fornecedor || '-'}</TableCell>
              <TableCell>{row.processo || '-'}</TableCell>
              <TableCell className="text-right">{formatKwh(row.consumoTotalKwh)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(row.valorFaturado)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTablePanel>
  );
}
