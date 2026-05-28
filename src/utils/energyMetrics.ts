import type {
  EnergiaCampusData,
  EnergiaConsumoFatura,
  EnergiaContrato,
  EnergiaContratoExecucao,
  EnergiaFonte,
  EnergiaSolarGeracao,
} from '@/services/energiaCampusService';

export const ENERGY_EMISSION_FACTOR_TCO2E_PER_MWH = 0.5989;
export const ENERGY_TREE_TCO2E_20_YEARS = 0.147;
export const ENERGY_CAR_TCO2E_YEAR = 2.25;

export type EnergyMonthlyPoint = {
  key: string;
  label: string;
  cosernKwh: number | null;
  mercattoKwh: number | null;
  solarKwh: number | null;
  totalKwh: number | null;
  cosernCost: number | null;
  mercattoCost: number | null;
  totalCost: number | null;
};

export type EnergySourceSummary = {
  fonte: EnergiaFonte;
  consumoKwh: number | null;
  valor: number | null;
  participacaoConsumo: number | null;
};

export type EnergyMetrics = {
  consumoCosernKwh: number | null;
  consumoMercattoKwh: number | null;
  consumoFaturadoConhecidoKwh: number | null;
  energiaSolarGeradaKwh: number | null;
  custoCosern: number | null;
  custoMercatto: number | null;
  custoTotal: number | null;
  tarifaMediaCosern: number | null;
  tarifaMediaMercatto: number | null;
  tarifaMediaConhecida: number | null;
  economiaSolarEstimada: number | null;
  emissoesEvitadasTco2e: number | null;
  arvoresEquivalentes: number | null;
  carrosEquivalentes: number | null;
  reducaoEmissoesPercentual: number | null;
  faturasQuantidade: number;
  contratosAtivos: number;
  monthly: EnergyMonthlyPoint[];
  sourceSummaries: EnergySourceSummary[];
};

export type EnergyFilter = {
  startDate?: string;
  endDate?: string;
  fontes?: EnergiaFonte[];
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(isFiniteNumber);
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0);
}

function monthKeyFromDate(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 7);
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${month}/${year.slice(2)}`;
}

function isInDateRange(value: string | null | undefined, filter: EnergyFilter): boolean {
  if (!value) return true;
  if (filter.startDate && value < filter.startDate) return false;
  if (filter.endDate && value > filter.endDate) return false;
  return true;
}

export function filterEnergyData(data: EnergiaCampusData, filter: EnergyFilter): EnergiaCampusData {
  const fonteSet = new Set(filter.fontes || []);
  const shouldFilterFonte = fonteSet.size > 0;
  const includeMercattoApi = !shouldFilterFonte || fonteSet.has('mercatto');
  const isMercattoApiDateInRange = (value?: string | null) => isInDateRange(value, filter);

  return {
    ...data,
    consumoFaturas: data.consumoFaturas.filter((fatura) => {
      if (shouldFilterFonte && !fonteSet.has(fatura.fonte)) return false;
      return isInDateRange(fatura.competencia || fatura.leituraFim, filter);
    }),
    solarGeracao: data.solarGeracao.filter((geracao) => {
      if (shouldFilterFonte && !fonteSet.has('solar')) return false;
      return isInDateRange(geracao.dataReferencia, filter);
    }),
    contratos: data.contratos.filter((contrato) => !shouldFilterFonte || fonteSet.has(contrato.fonte)),
    mercattoContratosApi: includeMercattoApi
      ? {
          contratos: data.mercattoContratosApi.contratos,
          faturas: data.mercattoContratosApi.faturas.filter((fatura) => isMercattoApiDateInRange(fatura.dataEmissao || fatura.dataPagamento)),
          liquidacoes: data.mercattoContratosApi.liquidacoes.filter((liquidacao) =>
            isMercattoApiDateInRange(liquidacao.dataLiquidacao || liquidacao.dataPagamento || liquidacao.dataEmissao),
          ),
        }
      : { contratos: [], faturas: [], liquidacoes: [] },
  };
}

function sumConsumo(faturas: EnergiaConsumoFatura[], fonte: Exclude<EnergiaFonte, 'solar'>): number | null {
  return sumNullable(faturas.filter((item) => item.fonte === fonte).map((item) => item.consumoTotalKwh));
}

function sumCusto(faturas: EnergiaConsumoFatura[], fonte: Exclude<EnergiaFonte, 'solar'>): number | null {
  return sumNullable(faturas.filter((item) => item.fonte === fonte).map((item) => item.valorFaturado));
}

function sumSolar(geracoes: EnergiaSolarGeracao[]): number | null {
  const annualRows = geracoes.filter((item) => item.granularidade === 'anual');
  const baseRows = annualRows.length ? annualRows : geracoes.filter((item) => item.granularidade === 'mensal');
  return sumNullable(baseRows.map((item) => item.energiaGeradaKwh));
}

function divideNullable(numerator: number | null, denominator: number | null): number | null {
  if (!isFiniteNumber(numerator) || !isFiniteNumber(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function buildMonthly(consumoFaturas: EnergiaConsumoFatura[], solarGeracao: EnergiaSolarGeracao[]): EnergyMonthlyPoint[] {
  const buckets = new Map<string, EnergyMonthlyPoint>();
  const getBucket = (key: string) => {
    const existing = buckets.get(key);
    if (existing) return existing;
    const next: EnergyMonthlyPoint = {
      key,
      label: monthLabel(key),
      cosernKwh: null,
      mercattoKwh: null,
      solarKwh: null,
      totalKwh: null,
      cosernCost: null,
      mercattoCost: null,
      totalCost: null,
    };
    buckets.set(key, next);
    return next;
  };

  consumoFaturas.forEach((fatura) => {
    const key = monthKeyFromDate(fatura.competencia || fatura.leituraFim);
    if (!key) return;
    const bucket = getBucket(key);
    if (fatura.fonte === 'cosern') {
      bucket.cosernKwh = sumNullable([bucket.cosernKwh, fatura.consumoTotalKwh]);
      bucket.cosernCost = sumNullable([bucket.cosernCost, fatura.valorFaturado]);
    } else {
      bucket.mercattoKwh = sumNullable([bucket.mercattoKwh, fatura.consumoTotalKwh]);
      bucket.mercattoCost = sumNullable([bucket.mercattoCost, fatura.valorFaturado]);
    }
  });

  solarGeracao
    .filter((item) => item.granularidade === 'mensal')
    .forEach((item) => {
      const key = monthKeyFromDate(item.dataReferencia);
      if (!key) return;
      const bucket = getBucket(key);
      bucket.solarKwh = sumNullable([bucket.solarKwh, item.energiaGeradaKwh]);
    });

  const monthlySolarYears = new Set(
    solarGeracao
      .filter((item) => item.granularidade === 'mensal' && item.dataReferencia)
      .map((item) => String(item.dataReferencia).slice(0, 4)),
  );

  const annualSolarByYear = new Map<string, number>();
  solarGeracao
    .filter((item) => item.granularidade === 'anual' && item.ano && isFiniteNumber(item.energiaGeradaKwh))
    .forEach((item) => {
      const year = String(item.ano);
      annualSolarByYear.set(year, (annualSolarByYear.get(year) || 0) + Number(item.energiaGeradaKwh));
    });

  annualSolarByYear.forEach((annualKwh, year) => {
    if (monthlySolarYears.has(year)) return;
    const existingMonthKeys = Array.from(buckets.keys()).filter((key) => key.startsWith(`${year}-`));
    const monthKeys = existingMonthKeys.length
      ? existingMonthKeys
      : Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);

    monthKeys.forEach((key) => {
      const bucket = getBucket(key);
      bucket.solarKwh = sumNullable([bucket.solarKwh, annualKwh / 12]);
    });
  });

  return Array.from(buckets.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((bucket) => ({
      ...bucket,
      totalKwh: sumNullable([bucket.cosernKwh, bucket.mercattoKwh]),
      totalCost: sumNullable([bucket.cosernCost, bucket.mercattoCost]),
    }));
}

function buildSourceSummaries(
  consumoCosernKwh: number | null,
  consumoMercattoKwh: number | null,
  energiaSolarGeradaKwh: number | null,
  custoCosern: number | null,
  custoMercatto: number | null,
): EnergySourceSummary[] {
  const consumoConhecido = sumNullable([consumoCosernKwh, consumoMercattoKwh, energiaSolarGeradaKwh]);
  const participation = (value: number | null) => divideNullable(value, consumoConhecido);

  return [
    { fonte: 'cosern', consumoKwh: consumoCosernKwh, valor: custoCosern, participacaoConsumo: participation(consumoCosernKwh) },
    { fonte: 'mercatto', consumoKwh: consumoMercattoKwh, valor: custoMercatto, participacaoConsumo: participation(consumoMercattoKwh) },
    { fonte: 'solar', consumoKwh: energiaSolarGeradaKwh, valor: null, participacaoConsumo: participation(energiaSolarGeradaKwh) },
  ];
}

export function buildEnergyMetrics(data: {
  consumoFaturas: EnergiaConsumoFatura[];
  solarGeracao: EnergiaSolarGeracao[];
  contratos: EnergiaContrato[];
  contratoExecucoes?: EnergiaContratoExecucao[];
}): EnergyMetrics {
  const consumoCosernKwh = sumConsumo(data.consumoFaturas, 'cosern');
  const consumoMercattoKwh = sumConsumo(data.consumoFaturas, 'mercatto');
  const consumoFaturadoConhecidoKwh = sumNullable([consumoCosernKwh, consumoMercattoKwh]);
  const energiaSolarGeradaKwh = sumSolar(data.solarGeracao);
  const custoCosern = sumCusto(data.consumoFaturas, 'cosern');
  const custoMercatto = sumCusto(data.consumoFaturas, 'mercatto');
  const custoTotal = sumNullable([custoCosern, custoMercatto]);
  const tarifaMediaCosern = divideNullable(custoCosern, consumoCosernKwh);
  const tarifaMediaMercatto = divideNullable(custoMercatto, consumoMercattoKwh);
  const custoComConsumoConhecido = sumNullable([
    isFiniteNumber(consumoCosernKwh) ? custoCosern : null,
    isFiniteNumber(consumoMercattoKwh) ? custoMercatto : null,
  ]);
  const tarifaMediaConhecida = divideNullable(custoComConsumoConhecido, consumoFaturadoConhecidoKwh);
  const economiaSolarEstimada = isFiniteNumber(energiaSolarGeradaKwh) && isFiniteNumber(tarifaMediaConhecida)
    ? energiaSolarGeradaKwh * tarifaMediaConhecida
    : null;
  const emissoesEvitadasTco2e = isFiniteNumber(energiaSolarGeradaKwh)
    ? (energiaSolarGeradaKwh / 1000) * ENERGY_EMISSION_FACTOR_TCO2E_PER_MWH
    : null;
  const arvoresEquivalentes = isFiniteNumber(emissoesEvitadasTco2e)
    ? emissoesEvitadasTco2e / ENERGY_TREE_TCO2E_20_YEARS
    : null;
  const carrosEquivalentes = isFiniteNumber(emissoesEvitadasTco2e)
    ? emissoesEvitadasTco2e / ENERGY_CAR_TCO2E_YEAR
    : null;
  const reducaoEmissoesPercentual = divideNullable(energiaSolarGeradaKwh, sumNullable([consumoFaturadoConhecidoKwh, energiaSolarGeradaKwh]));

  return {
    consumoCosernKwh,
    consumoMercattoKwh,
    consumoFaturadoConhecidoKwh,
    energiaSolarGeradaKwh,
    custoCosern,
    custoMercatto,
    custoTotal,
    tarifaMediaCosern,
    tarifaMediaMercatto,
    tarifaMediaConhecida,
    economiaSolarEstimada,
    emissoesEvitadasTco2e,
    arvoresEquivalentes,
    carrosEquivalentes,
    reducaoEmissoesPercentual,
    faturasQuantidade: data.consumoFaturas.filter((item) => item.faturaNumero || item.valorFaturado || item.consumoTotalKwh).length,
    contratosAtivos: data.contratos.filter((item) => item.situacao?.toLowerCase() === 'ativo').length,
    monthly: buildMonthly(data.consumoFaturas, data.solarGeracao),
    sourceSummaries: buildSourceSummaries(consumoCosernKwh, consumoMercattoKwh, energiaSolarGeradaKwh, custoCosern, custoMercatto),
  };
}
