import { describe, expect, it } from 'vitest';
import {
  calculateContractInstallmentMetrics,
  calculateRobustInvoiceBaseline,
  getContractTotalExpectedInstallments,
  getProjectionHistoryPeriod,
  isExecutedFatura,
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

  it('identifica faturas apropriadas / executadas vs pendentes', () => {
    expect(isExecutedFatura('Siafi Apropriado')).toBe(true);
    expect(isExecutedFatura('Pago')).toBe(true);
    expect(isExecutedFatura('Pagamento Parcial')).toBe(true);
    expect(isExecutedFatura('Pendente')).toBe(false);
    expect(isExecutedFatura('Em análise')).toBe(false);
    expect(isExecutedFatura('Em Ateste')).toBe(false);
    expect(isExecutedFatura(null)).toBe(false);
  });

  it('calcula métricas de parcelas para contrato com faturas apropriadas e pendentes (caso real 00153/2024)', () => {

    const contrato = {
      vigencia_inicio: '2024-09-03',
      vigencia_fim: '2026-09-03',
      vigencia_inicio_derivada: '2024-09-03',
      vigencia_fim_derivada: '2026-09-03',
      categoria: 'Mão de Obra',
    };

    const historico = [
      {
        tipo: 'Contrato',
        num_parcelas: 24,
        novo_num_parcelas: null,
        data_assinatura: '2024-08-26',
        vigencia_inicio: '2024-09-03',
        vigencia_fim: '2026-09-03',
      },
    ];

    expect(getContractTotalExpectedInstallments(contrato, historico)).toBe(24);

    // 22 faturas liquidadas + 1 fatura pendente
    const faturas = [
      ...Array.from({ length: 22 }, (_, index) => ({
        id: `f-${index + 1}`,
        contrato_api_id: 'c1',
        api_fatura_id: index + 1,
        numero_instrumento_cobranca: `NF-${index + 1}`,
        situacao: 'Siafi Apropriado',
        valor_liquido: 57000,
        valor_bruto: 57000,
        data_emissao: `2025-${String((index % 12) + 1).padStart(2, '0')}-10`,
        data_pagamento: null,
      })),
      {
        id: 'f-23',
        contrato_api_id: 'c1',
        api_fatura_id: 23,
        numero_instrumento_cobranca: 'NF-370',
        situacao: 'Pendente',
        valor_liquido: 57094.72,
        valor_bruto: 57094.72,
        data_emissao: '2026-08-12',
        data_pagamento: null,
      },
    ];

    const metrics = calculateContractInstallmentMetrics(contrato, faturas as never, historico as never);

    expect(metrics.totalParcelasPrevistas).toBe(24);
    expect(metrics.qtdApropriadas).toBe(22);
    expect(metrics.qtdPendentes).toBe(1);
    expect(metrics.parcelasNaoEmitidas).toBe(1);
    expect(metrics.parcelasRestantesContrato).toBe(2);
    expect(metrics.faturasApropriadas).toHaveLength(22);
    expect(metrics.faturasPendentes).toHaveLength(1);
    expect(metrics.valorLiquidadoTotal).toBe(22 * 57000);
    expect(metrics.valorPendenteTotal).toBe(57094.72);
  });
});
