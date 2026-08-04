import { describe, expect, it } from 'vitest';

import {
  calculateRobustInvoiceBaseline,
  getProjectionHistoryPeriod,
  resolveFaturaCompetencia,
} from '@/utils/contractProjection';

describe('contractProjection', () => {
  it('resolve a competencia mais recente em dados_referencia quando mesref/anoref estao vazios', () => {
    const competencia = resolveFaturaCompetencia({
      mes_referencia: null,
      ano_referencia: null,
      raw_data: {
        mes_referencia: '',
        ano_referencia: '',
        mesref: '03',
        anoref: '2026',
        dados_referencia: [
          { mesref: '04', anoref: '2026' },
          { mesref: '05', anoref: '2026' },
        ],
      },
    });

    expect(competencia?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('usa os doze meses completos anteriores ao mes atual', () => {
    expect(getProjectionHistoryPeriod(new Date('2026-08-04T12:00:00Z'))).toMatchObject({
      startDate: '2025-08-01',
      endDate: '2026-07-31',
      currentMonth: '2026-08',
    });
  });

  it('remove uma nota muito distante usando o escore robusto MAD', () => {
    const baseline = calculateRobustInvoiceBaseline([100, 110, 105, 1000]);

    expect(baseline.mediaNota).toBeCloseTo(105, 5);
    expect(baseline.notasTotais).toBe(4);
    expect(baseline.notasUtilizadas).toBe(3);
    expect(baseline.notasDesconsideradas).toBe(1);
  });

  it('usa valores iguais a mediana quando o MAD e zero', () => {
    const baseline = calculateRobustInvoiceBaseline([100, 100, 1000]);

    expect(baseline.mediaNota).toBe(100);
    expect(baseline.notasUtilizadas).toBe(3);
    expect(baseline.notasDesconsideradas).toBe(0);
  });

  it('usa a mediana como fallback para poucas notas', () => {
    const baseline = calculateRobustInvoiceBaseline([100, 1000]);

    expect(baseline.mediaNota).toBe(550);
    expect(baseline.notasUtilizadas).toBe(2);
    expect(baseline.notasDesconsideradas).toBe(0);
    expect(baseline.usouFallbackMediana).toBe(true);
  });
});
