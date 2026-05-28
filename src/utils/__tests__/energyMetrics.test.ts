import { buildEnergyMetrics, filterEnergyData } from '@/utils/energyMetrics';
import type { EnergiaCampusData } from '@/services/energiaCampusService';

const baseData: EnergiaCampusData = {
  latestRun: null,
  warnings: [],
  consumoFaturas: [
    {
      fonte: 'cosern',
      competencia: '2025-01-01',
      consumoTotalKwh: 1000,
      valorFaturado: 900,
      faturaNumero: '1',
    },
    {
      fonte: 'mercatto',
      competencia: '2025-01-01',
      consumoTotalKwh: null,
      valorFaturado: 700,
      faturaNumero: '2',
    },
    {
      fonte: 'cosern',
      competencia: '2025-02-01',
      consumoTotalKwh: 500,
      valorFaturado: 450,
      faturaNumero: '3',
    },
  ],
  solarGeracao: [
    {
      ufvNome: 'UFV 01',
      dataReferencia: '2025-01-01',
      ano: 2025,
      granularidade: 'anual',
      energiaGeradaKwh: 2000,
    },
  ],
  contratos: [
    { fonte: 'cosern', situacao: 'Ativo' },
    { fonte: 'mercatto', situacao: 'Ativo' },
  ],
  contratoExecucoes: [],
};

describe('energyMetrics', () => {
  it('calcula totais conhecidos sem inventar kWh ausente de Mercatto', () => {
    const metrics = buildEnergyMetrics(baseData);

    expect(metrics.consumoCosernKwh).toBe(1500);
    expect(metrics.consumoMercattoKwh).toBeNull();
    expect(metrics.consumoFaturadoConhecidoKwh).toBe(1500);
    expect(metrics.custoTotal).toBe(2050);
    expect(metrics.tarifaMediaMercatto).toBeNull();
    expect(metrics.economiaSolarEstimada).toBe(1800);
  });

  it('calcula indicadores ESG com os fatores definidos', () => {
    const metrics = buildEnergyMetrics(baseData);

    expect(metrics.emissoesEvitadasTco2e).toBeCloseTo(1.1978, 4);
    expect(metrics.arvoresEquivalentes).toBeCloseTo(8.148, 3);
    expect(metrics.carrosEquivalentes).toBeCloseTo(0.532, 3);
  });

  it('filtra por período e fonte', () => {
    const filtered = filterEnergyData(baseData, {
      startDate: '2025-02-01',
      endDate: '2025-02-28',
      fontes: ['cosern'],
    });

    expect(filtered.consumoFaturas).toHaveLength(1);
    expect(filtered.consumoFaturas[0].competencia).toBe('2025-02-01');
    expect(filtered.solarGeracao).toHaveLength(0);
    expect(filtered.contratos).toHaveLength(1);
  });
});
