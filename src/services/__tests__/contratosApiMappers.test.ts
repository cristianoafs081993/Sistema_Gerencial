import { describe, expect, it } from 'vitest';

import {
  getFaturaEmpenhos,
  getFaturaItens,
  mapContrato,
  mapEmpenho,
  mapFatura,
  mapHistorico,
  mapItem,
} from '@/services/contratosApiMappers';

describe('contratosApiMappers', () => {
  it('mapeia contrato com unidade gestora aninhada no contratante', () => {
    expect(
      mapContrato(
        {
          id: 314882,
          numero: '00158/2021',
          contratante: {
            orgao: {
              codigo: '26435',
              nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
              unidade_gestora: {
                codigo: '158366',
                nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
                nome_resumido: 'IFRN/CAMPUS C.NOVOS',
              },
            },
            orgao_origem: {
              codigo: '26435',
              nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
              unidade_gestora_origem: {
                codigo: '158155',
                nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
              },
            },
          },
          fornecedor: {
            tipo: 'JURIDICA',
            cnpj_cpf_idgener: '00.000.000/0001-00',
            nome: 'Fornecedor Teste',
          },
          valor_global: '27.000,00',
          valor_acumulado: '135.000,00',
        },
        true,
      ),
    ).toMatchObject({
      api_contrato_id: 314882,
      numero: '00158/2021',
      orgao_codigo: '26435',
      unidade_codigo: '158366',
      unidade_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
      unidade_origem_codigo: '158155',
      unidade_origem_nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
      fornecedor_nome: 'Fornecedor Teste',
      valor_global: 27000,
      valor_acumulado: 135000,
    });
  });

  it('mapeia empenho da API com valores de execucao e RAP', () => {
    expect(
      mapEmpenho('contrato-api-1', {
        id: 12819022,
        unidade_gestora: '158366',
        gestao: '26435',
        numero: '2024NE000319',
        data_emissao: '2024-12-19',
        credor: '08.334.385/0001-35 - COMPANHIA TESTE',
        fonte_recurso: '1000000000',
        planointerno: 'PI123',
        naturezadespesa: '339039',
        empenhado: '11.732,40',
        aliquidar: '9.033,11',
        liquidado: '1.000,00',
        pago: '2.699,29',
        rpinscrito: '9.033,11',
        rpapagar: '8.500,00',
      }),
    ).toMatchObject({
      contrato_api_id: 'contrato-api-1',
      api_empenho_id: 12819022,
      numero: '2024NE000319',
      unidade_gestora: '158366',
      data_emissao: '2024-12-19',
      valor_empenhado: 11732.4,
      valor_a_liquidar: 9033.11,
      valor_liquidado: 1000,
      valor_pago: 2699.29,
      rp_inscrito: 9033.11,
      rp_a_pagar: 8500,
    });
  });

  it('mapeia historico de contrato com termo e origem Reitoria', () => {
    expect(
      mapHistorico('contrato-api-1', {
        id: 1312633,
        contrato_id: 314882,
        receita_despesa: 'Despesa',
        numero: '00371/2025',
        tipo: 'Termo Aditivo',
        qualificacao_termo: [
          { codigo: 2, descricao: 'VIGENCIA' },
          { codigo: 1, descricao: 'ACRESCIMO / SUPRESSAO' },
        ],
        observacao: 'Termo de teste',
        ug: '158366',
        gestao: '26435',
        codigo_unidade_origem: '158155',
        nome_unidade_origem: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
        data_assinatura: '2025-12-04',
        vigencia_inicio: '2025-12-10',
        vigencia_fim: '2026-12-10',
        valor_inicial: '108.000,00',
        valor_global: '27.000,00',
        num_parcelas: 12,
        valor_parcela: '2.250,00',
        novo_valor_global: '135.000,00',
        novo_num_parcelas: 12,
        novo_valor_parcela: '11.250,00',
        retroativo: 'Nao',
        retroativo_valor: '0,00',
        situacao_contrato: 'Ativo',
      }),
    ).toMatchObject({
      contrato_api_id: 'contrato-api-1',
      api_historico_id: 1312633,
      numero: '00371/2025',
      tipo: 'Termo Aditivo',
      ug: '158366',
      codigo_unidade_origem: '158155',
      valor_inicial: 108000,
      valor_global: 27000,
      novo_valor_global: 135000,
      novo_valor_parcela: 11250,
      retroativo_valor: 0,
    });
  });

  it('mapeia fatura com os nomes reais retornados pela API do Comprasnet', () => {
    const raw = {
      id: 188319,
      numero: '48161',
      emissao: '2023-05-08',
      vencimento: '2023-06-26',
      valor: '12.368,06',
      valorliquido: '12.368,06',
      mesref: '04',
      anoref: '2023',
      situacao: 'Pago',
      dados_empenho: [
        {
          id_empenho: 8009682,
          numero_empenho: '2021NE000062',
          valor_empenho: '12.368,06',
          subelemento: '01',
        },
      ],
      dados_item_faturado: [
        {
          id_item_contrato: 325154,
          quantidade_faturado: '1,00000',
          valorunitario_faturado: '12.368,0600',
          valortotal_faturado: '12.368,06',
        },
      ],
    };

    expect(mapFatura('contrato-api-1', raw)).toMatchObject({
      contrato_api_id: 'contrato-api-1',
      api_fatura_id: 188319,
      numero_instrumento_cobranca: '48161',
      data_emissao: '2023-05-08',
      data_vencimento: '2023-06-26',
      valor_bruto: 12368.06,
      valor_liquido: 12368.06,
      mes_referencia: '04',
      ano_referencia: '2023',
      situacao: 'Pago',
    });
    expect(getFaturaItens(raw)).toHaveLength(1);
    expect(getFaturaEmpenhos(raw)).toHaveLength(1);
  });

  it('mapeia item de contrato com descricao e historico de valores', () => {
    expect(
      mapItem('contrato-api-1', {
        id: 325154,
        tipo_id: 'Serviço',
        grupo_id: 'GRUPO GENERICO SERVICO',
        catmatseritem_id: 'PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO',
        descricao_complementar: null,
        quantidade: '1',
        valorunitario: '16.832,90',
        valortotal: '201.994,80',
        numero_item_compra: '00008',
        data_inicio_item: {
          date: '2021-01-01 15:40:28.000000',
          timezone_type: 3,
          timezone: 'America/Sao_Paulo',
        },
        historico_item: [
          {
            contrato_historico_id: 452827,
            tipo_historico: 'Termo de Apostilamento',
            valor_total: '201.994,80',
          },
        ],
      }),
    ).toMatchObject({
      contrato_api_id: 'contrato-api-1',
      api_item_id: 325154,
      catmatseritem_id: 'PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO',
      descricao_complementar: null,
      quantidade: 1,
      valor_unitario: 16832.9,
      valor_total: 201994.8,
      numero_item_compra: '00008',
      data_inicio_item: '2021-01-01',
      historico_item: [
        {
          contrato_historico_id: 452827,
          tipo_historico: 'Termo de Apostilamento',
          valor_total: '201.994,80',
        },
      ],
    });
  });

  it('trata fatura sem item vinculado como arrays vazios', () => {
    const raw = {
      id: 49245,
      numero: '501415',
      valor: '36.693,29',
      valorliquido: '36.693,29',
      dados_empenho: null,
      dados_item_faturado: null,
    };

    expect(mapFatura('contrato-api-1', raw).valor_liquido).toBe(36693.29);
    expect(getFaturaItens(raw)).toEqual([]);
    expect(getFaturaEmpenhos(raw)).toEqual([]);
  });
});
