import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import type { ContratoApiDetails, ContratoApiRow, ContratoApiSyncRun } from '@/services/contratosApi';

const contrato: ContratoApiRow = {
  id: 'contrato-api-1',
  api_contrato_id: 22024,
  numero: '00062/2018',
  fornecedor_nome: 'Fornecedor Teste',
  unidade_codigo: '158366',
  unidade_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
  unidade_origem_codigo: '158155',
  unidade_origem_nome: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
  objeto: 'Objeto',
  processo: '23000.000000/2023-00',
  vigencia_inicio: '2023-01-01',
  vigencia_fim: '2023-12-31',
  valor_global: 201994.8,
  valor_acumulado: 201994.8,
  situacao: true,
  updated_at: '2026-04-14T00:00:00Z',
};

const lastSyncRun: ContratoApiSyncRun = {
  id: 'run-1',
  unidade_codigo: '158366',
  started_at: '2026-04-14T03:00:00Z',
  finished_at: '2026-04-14T03:05:00Z',
  status: 'success',
  contratos_ativos: 1,
  contratos_inativos: 0,
  contratos_upserted: 1,
  empenhos_upserted: 1,
  faturas_upserted: 2,
  itens_upserted: 1,
  historicos_upserted: 2,
  fatura_itens_upserted: 1,
  fatura_empenhos_upserted: 1,
  error_message: null,
  details: null,
};

const details: ContratoApiDetails = {
  historico: [
    {
      id: 'historico-1',
      contrato_api_id: 'contrato-api-1',
      api_historico_id: 314882,
      numero: '00158/2021',
      tipo: 'Contrato',
      qualificacao_termo: [],
      observacao: 'Assinatura inicial',
      ug: '158366',
      codigo_unidade_origem: '158155',
      nome_unidade_origem: 'INST.FED.DE EDUC.,CIENC.E TEC.DO RN',
      data_assinatura: '2021-12-10',
      data_publicacao: '2021-12-11',
      vigencia_inicio: '2021-12-10',
      vigencia_fim: '2022-12-10',
      valor_inicial: 108000,
      valor_global: 108000,
      num_parcelas: 12,
      valor_parcela: 9000,
      novo_valor_global: 0,
      novo_num_parcelas: null,
      novo_valor_parcela: 0,
      data_inicio_novo_valor: null,
      retroativo: 'Nao',
      retroativo_valor: 0,
      situacao_contrato: 'Ativo',
    },
    {
      id: 'historico-2',
      contrato_api_id: 'contrato-api-1',
      api_historico_id: 1312633,
      numero: '00371/2025',
      tipo: 'Termo Aditivo',
      qualificacao_termo: [{ codigo: 1, descricao: 'ACRESCIMO / SUPRESSAO' }],
      observacao: 'Aditivo',
      ug: '158366',
      codigo_unidade_origem: null,
      nome_unidade_origem: null,
      data_assinatura: '2025-12-04',
      data_publicacao: null,
      vigencia_inicio: '2025-12-10',
      vigencia_fim: '2026-12-10',
      valor_inicial: 108000,
      valor_global: 27000,
      num_parcelas: 12,
      valor_parcela: 2250,
      novo_valor_global: 135000,
      novo_num_parcelas: 12,
      novo_valor_parcela: 11250,
      data_inicio_novo_valor: null,
      retroativo: 'Nao',
      retroativo_valor: 0,
      situacao_contrato: 'Ativo',
    },
  ],
  empenhos: [
    {
      id: 'api-empenho-1',
      contrato_api_id: 'contrato-api-1',
      api_empenho_id: 12819022,
      numero: '2024NE000319',
      unidade_gestora: '158366',
      gestao: '26435',
      data_emissao: '2024-12-19',
      credor: 'Fornecedor Teste',
      fonte_recurso: '1000000000',
      plano_interno: 'PI123',
      natureza_despesa: '339039',
      valor_empenhado: 11732.4,
      valor_a_liquidar: 9033.11,
      valor_liquidado: 1000,
      valor_pago: 2699.29,
      rp_inscrito: 9033.11,
      rp_a_pagar: 8500,
    },
  ],
  itens: [
    {
      id: 'item-1',
      contrato_api_id: 'contrato-api-1',
      api_item_id: 325154,
      catmatseritem_id: 'PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO',
      descricao_complementar: null,
      quantidade: 1,
      valor_unitario: 16832.9,
      valor_total: 201994.8,
      numero_item_compra: '00008',
      historico_item: [
        {
          tipo_historico: 'Contrato',
          data_termo: '2021-12-10',
          quantidade: '1',
          periodicidade: 12,
          valor_unitario: '16.832,90',
          valor_total: '201.994,80',
        },
        {
          tipo_historico: 'Termo Aditivo',
          data_termo: '2025-12-04',
          quantidade: '1',
          periodicidade: 12,
          valor_unitario: '2.250,00',
          valor_total: '27.000,00',
        },
      ],
    },
    {
      id: 'item-2',
      contrato_api_id: 'contrato-api-1',
      api_item_id: 325155,
      catmatseritem_id: 'APARELHO / ACESSÓRIO - ACONDICIONAMENTO FÍSICO',
      descricao_complementar: null,
      quantidade: 12,
      valor_unitario: 1060,
      valor_total: 12720,
      numero_item_compra: '00002',
      historico_item: [
        {
          tipo_historico: 'Contrato',
          data_termo: '2023-02-07',
          quantidade: '12',
          periodicidade: 1,
          valor_unitario: '1.060,00',
          valor_total: '12.720,00',
        },
        {
          tipo_historico: 'Termo Aditivo',
          data_termo: '2024-01-16',
          quantidade: '12',
          periodicidade: 1,
          valor_unitario: '1.060,00',
          valor_total: '12.720,00',
        },
        {
          tipo_historico: 'Termo Aditivo',
          data_termo: '2025-01-25',
          quantidade: '12',
          periodicidade: 1,
          valor_unitario: '1.060,00',
          valor_total: '12.720,00',
        },
        {
          tipo_historico: 'Termo Aditivo',
          data_termo: '2026-01-29',
          quantidade: '12',
          periodicidade: 1,
          valor_unitario: '1.060,00',
          valor_total: '12.720,00',
        },
      ],
    },
  ],
  faturas: [
    {
      id: 'fatura-paga',
      contrato_api_id: 'contrato-api-1',
      api_fatura_id: 188319,
      numero_instrumento_cobranca: '48161',
      situacao: 'Pago',
      valor_bruto: 12368.06,
      valor_liquido: 12368.06,
      data_emissao: '2023-05-08',
      data_pagamento: null,
    },
    {
      id: 'fatura-sem-item',
      contrato_api_id: 'contrato-api-1',
      api_fatura_id: 188320,
      numero_instrumento_cobranca: '48162',
      situacao: 'Em análise',
      valor_bruto: 500,
      valor_liquido: 500,
      data_emissao: '2023-06-08',
      data_pagamento: null,
    },
    {
      id: 'fatura-siafi',
      contrato_api_id: 'contrato-api-1',
      api_fatura_id: 188321,
      numero_instrumento_cobranca: '48163',
      situacao: 'Siafi Apropriado',
      valor_bruto: 1000,
      valor_liquido: 1000,
      data_emissao: '2023-07-08',
      data_pagamento: null,
    },
  ],
  faturaItens: [
    {
      id: 'fatura-item-1',
      contrato_api_id: 'contrato-api-1',
      contrato_api_fatura_id: 'fatura-paga',
      contrato_api_item_id: 'item-1',
      api_item_id: 325154,
      quantidade_faturado: 1,
      valor_unitario_faturado: 12368.06,
      valor_total_faturado: 12368.06,
    },
    {
      id: 'fatura-item-2',
      contrato_api_id: 'contrato-api-1',
      contrato_api_fatura_id: 'fatura-siafi',
      contrato_api_item_id: 'item-1',
      api_item_id: 325154,
      quantidade_faturado: 1,
      valor_unitario_faturado: 1000,
      valor_total_faturado: 1000,
    },
  ],
  faturaEmpenhos: [
    {
      id: 'fatura-empenho-1',
      contrato_api_id: 'contrato-api-1',
      contrato_api_fatura_id: 'fatura-paga',
      contrato_api_empenho_id: 'api-empenho-1',
      api_empenho_id: 12819022,
      numero_empenho: '2024NE000319',
      valor_empenho: 1000,
      subelemento: '01',
    },
    {
      id: 'fatura-empenho-2',
      contrato_api_id: 'contrato-api-1',
      contrato_api_fatura_id: 'fatura-siafi',
      contrato_api_empenho_id: 'api-empenho-1',
      api_empenho_id: 12819022,
      numero_empenho: '2024NE000319',
      valor_empenho: 1000,
      subelemento: '01',
    },
  ],
};

describe('ContratoApiDetailsSheet', () => {
  it('mostra execução por item e soma histórico contratado em contratos com mais de um item', () => {
    render(
      <ContratoApiDetailsSheet
        open
        onOpenChange={vi.fn()}
        contrato={contrato}
        details={details}
        lastSyncRun={lastSyncRun}
      />,
    );

    expect(screen.getByText('Contrato 00062/2018')).toBeInTheDocument();
    expect(screen.getAllByText('Origem Reitoria').length).toBeGreaterThan(0);
    expect(screen.getByText('Histórico do contrato')).toBeInTheDocument();
    expect(screen.getByText(/Assinatura - 00158\/2021/i)).toBeInTheDocument();
    expect(screen.getByText(/Termo Aditivo - 00371\/2025/i)).toBeInTheDocument();
    expect(screen.queryByText('Empenhos da API')).not.toBeInTheDocument();
    expect(screen.getAllByText('PRESTAÇÃO DE SERVIÇOS DE APOIO ADMINISTRATIVO').length).toBeGreaterThan(0);
    expect(screen.getByText('APARELHO / ACESSÓRIO - ACONDICIONAMENTO FÍSICO')).toBeInTheDocument();
    expect(screen.getAllByText('Histórico do item').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contrato').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Termo Aditivo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('10/12/2021').length).toBeGreaterThan(0);
    expect(screen.getAllByText('07/02/2023').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Qtd. 12').length).toBeGreaterThan(0);
    expect(screen.queryByText('Periodicidade 12')).not.toBeInTheDocument();
    expect(screen.queryByText('Periodicidade 1')).not.toBeInTheDocument();
    expect(screen.getByText('Unitário R$ 16.832,90')).toBeInTheDocument();
    expect(screen.getAllByText('Unitário R$ 1.060,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total R$ 12.720,00').length).toBeGreaterThan(0);
    expect(screen.getByText('R$ 228.994,80')).toBeInTheDocument();
    expect(screen.getByText('R$ 50.880,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 13.368,06')).toBeInTheDocument();
    expect(screen.getByText('Qtd. 1 | Unitário R$ 12.368,06')).toBeInTheDocument();
    expect(screen.getByText('Qtd. 1 | Unitário R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('Qtd. contratada 2')).toBeInTheDocument();
    expect(screen.getByText('Qtd. contratada 48')).toBeInTheDocument();
    expect(screen.getByText('Qtd. executada 2')).toBeInTheDocument();
    expect(screen.getByText('Qtd. executada 0')).toBeInTheDocument();
    expect(screen.getByText('Siafi Apropriado')).toBeInTheDocument();
    expect(screen.getByText('Sem item vinculado')).toBeInTheDocument();
    expect(screen.getByText('48162')).toBeInTheDocument();
    expect(screen.getByText(/não entram na execução oficial por item/i)).toBeInTheDocument();
  });
});
