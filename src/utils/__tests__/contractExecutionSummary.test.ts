// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildContractExecutionSummary,
  buildLocalEmpenhoLookupMap,
} from '@/utils/contractExecutionSummary';
import type { ContratoApiRow } from '@/services/contratosApi';
import type { Empenho } from '@/types';

describe('contractExecutionSummary', () => {
  const localEmpenhos: Empenho[] = [
    {
      id: 'emp-local-1',
      numero: '2026NE000010',
      descricao: 'Serviço continuado',
      valor: 50000,
      valorLiquidadoAPagar: 5000,
      valorPagoOficial: 15000,
      valorLiquidado: 20000,
      dimensao: 'Administração',
      componenteFuncional: 'Contratos',
      origemRecurso: 'Tesouro',
      naturezaDespesa: '339037',
      planoInterno: 'PI01',
      tipo: 'exercicio',
      dataEmpenho: new Date('2026-01-10'),
      status: 'liquidado',
      createdAt: new Date('2026-01-10'),
      updatedAt: new Date('2026-01-10'),
    },
  ];

  const apiContrato: ContratoApiRow = {
    id: 'api-cont-1',
    api_contrato_id: 9001,
    numero: '00045/2025',
    fornecedor_nome: 'SERVICOS GERAIS LTDA',
    fornecedor_documento: '12.345.678/0001-99',
    unidade_codigo: '158366',
    unidade_nome: 'IFRN Campus Currais Novos',
    unidade_origem_codigo: '158155',
    unidade_origem_nome: 'IFRN Reitoria',
    objeto: 'Limpeza e conservação',
    processo: '23035.000100/2025-11',
    vigencia_inicio: '2025-06-01',
    vigencia_fim: '2026-06-01',
    valor_global: 120000,
    valor_acumulado: 120000,
    situacao: true,
    situacao_derivada: true,
    updated_at: '2026-11-18T06:00:00Z',
  };

  it('consolida valor histórico, empenhos locais e API sem duplicar NEs equivalentes', () => {
    const summary = buildContractExecutionSummary({
      localContratoId: 'loc-cont-1',
      fallbackValor: 100000,
      apiContrato,
      empenhos: localEmpenhos,
      contratosEmpenhos: [
        {
          id: 'link-1',
          contrato_id: 'loc-cont-1',
          empenho_id: 'emp-local-1',
          created_at: new Date('2026-01-10'),
        },
      ],
      localEmpenhoByLookupKey: buildLocalEmpenhoLookupMap(localEmpenhos),
      apiEmpenhos: [
        {
          id: 'api-emp-dup',
          contrato_api_id: 'api-cont-1',
          api_empenho_id: 1,
          numero: '158366264352026NE000010',
          unidade_gestora: '158366',
          gestao: '26435',
          data_emissao: '2026-01-10',
          credor: 'SERVICOS GERAIS LTDA',
          fonte_recurso: '1000000000',
          plano_interno: 'PI01',
          natureza_despesa: '339037',
          valor_empenhado: 50000,
          valor_a_liquidar: 40000,
          valor_liquidado: 10000,
          valor_pago: 10000,
          rp_inscrito: 0,
          rp_a_pagar: 0,
        },
        {
          id: 'api-emp-novo',
          contrato_api_id: 'api-cont-1',
          api_empenho_id: 2,
          numero: '2026NE000099',
          unidade_gestora: '158366',
          gestao: '26435',
          data_emissao: '2026-05-10',
          credor: 'SERVICOS GERAIS LTDA',
          fonte_recurso: '1000000000',
          plano_interno: 'PI01',
          natureza_despesa: '339037',
          valor_empenhado: 25000,
          valor_a_liquidar: 12000,
          valor_liquidado: 13000,
          valor_pago: 13000,
          rp_inscrito: 0,
          rp_a_pagar: 0,
        },
      ],
      historico: [
        {
          id: 'hist-1',
          contrato_api_id: 'api-cont-1',
          api_historico_id: 10,
          numero: '00045/2025',
          tipo: 'Contrato',
          qualificacao_termo: null,
          observacao: null,
          ug: '158366',
          codigo_unidade_origem: '158155',
          nome_unidade_origem: 'IFRN Reitoria',
          data_assinatura: '2025-06-01',
          data_publicacao: '2025-06-02',
          vigencia_inicio: '2025-06-01',
          vigencia_fim: '2026-06-01',
          valor_inicial: 240000,
          valor_global: 240000,
          num_parcelas: 12,
          valor_parcela: 20000,
          novo_valor_global: null,
          novo_num_parcelas: null,
          novo_valor_parcela: null,
          data_inicio_novo_valor: null,
          retroativo: null,
          retroativo_valor: null,
          situacao_contrato: 'Ativo',
        },
      ],
      faturas: [
        {
          id: 'fat-1',
          contrato_api_id: 'api-cont-1',
          api_fatura_id: 100,
          numero_instrumento_cobranca: 'NF-01',
          situacao: 'Pago',
          valor_bruto: 20000,
          valor_liquido: 20000,
          data_emissao: '2026-02-01',
          data_pagamento: '2026-02-10',
        },
        {
          id: 'fat-2',
          contrato_api_id: 'api-cont-1',
          api_fatura_id: 101,
          numero_instrumento_cobranca: 'NF-02',
          situacao: 'Em Ateste',
          valor_bruto: 20000,
          valor_liquido: 20000,
          data_emissao: '2026-03-01',
          data_pagamento: null,
        },
      ],
    });

    expect(summary.valorGlobal).toBe(240000);
    expect(summary.empenhado).toBe(75000);
    // Saldo local de 2026NE000010 = 50000 - (5000 + 15000) = 30000; saldo API de 2026NE000099 = 12000 -> total 42000
    expect(summary.aLiquidar).toBe(42000);
    expect(summary.empenhosCount).toBe(2);
    expect(summary.openFaturas).toHaveLength(1);
    expect(summary.hasReitoriaOrigin).toBe(true);
    expect(summary.rows.map((r) => r.numero)).toEqual(['2026NE000010', '2026NE000099']);
  });
});
