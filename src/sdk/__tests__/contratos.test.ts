import { describe, expect, it } from 'vitest';
import { ContratosModule } from '../contratos';

describe('GovFlow Core SDK - ContratosModule', () => {
  it('deve calcular corretamente a projeção contratual e detectar necessidade de reforço de empenho', async () => {
    const mockContratoApi = {
      id: 101,
      numero: '05/2024',
      fornecedor_nome: 'EMPRESA SERVIÇOS LTDA',
      objeto: 'Serviço de Limpeza e Conservação',
      situacao: 'Ativo',
      unidade_codigo: '158366',
      vigencia_inicio: '2024-01-01',
      vigencia_fim: '2026-12-31',
      vigencia_fim_derivada: '2026-12-31',
      valor_global: 120000,
    };

    // Empenhos vinculados cobrindo 30.000, já liquidado 20.000 -> Saldo disponível: 10.000
    const mockEmpenhos = [
      { id: 'v1', contrato_api_id: 101, numero: '2026NE000005', valor_empenhado: 30000, valor_liquidado: 20000 },
    ];

    // Faturas mensais de 10.000 cada
    const mockFaturas = [
      { id: 1, contrato_api_id: 101, valor_bruto: 10000, situacao: 'PAGA' },
      { id: 2, contrato_api_id: 101, valor_bruto: 10000, situacao: 'PAGA' },
    ];

    const mockClient: any = {
      from: (table: string) => {
        return {
          select: () => ({
            or: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: mockContratoApi, error: null }),
              }),
            }),
            eq: () => {
              if (table === 'contratos_api_empenhos') return Promise.resolve({ data: mockEmpenhos, error: null });
              if (table === 'contratos_api_faturas') {
                return {
                  order: () => Promise.resolve({ data: mockFaturas, error: null }),
                };
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        };
      },
    };

    const contratos = new ContratosModule(mockClient);
    const ficha = await contratos.getFichaContrato('05/2024');

    expect(ficha.numero).toBe('05/2024');
    expect(ficha.contratada).toBe('EMPRESA SERVIÇOS LTDA');
    expect(ficha.totalEmpenhadoVinculado).toBe(30000);
    expect(ficha.saldoEmpenhosVinculados).toBe(10000); // 30.000 - 20.000
    expect(ficha.isCampusCurraisNovos).toBe(true);

    const projecao = await contratos.projetarExecucaoContratual('05/2024', 2026);
    expect(projecao.valorMensalMedio).toBe(10000);
    expect(projecao.saldoEmpenhosAtuais).toBe(10000);

    // Se restarem mais de 1 mês no exercício, a necessidade superará os 10.000 de saldo
    if (projecao.mesesRestantesExercicio > 1) {
      expect(projecao.requerReforcoExercicio).toBe(true);
      expect(projecao.valorReforcoEstimado).toBeGreaterThan(0);
      expect(projecao.alertas.some((a) => a.includes('Alerta de Insuficiência'))).toBe(true);
    }
  });
});
