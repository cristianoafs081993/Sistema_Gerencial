import { describe, expect, it } from 'vitest';

import { getValorTotalFromHistorico } from '@/utils/contratosApiHistorico';
import type { ContratoApiHistoricoRow } from '@/services/contratosApi';

const row = (overrides: Partial<ContratoApiHistoricoRow>): ContratoApiHistoricoRow => ({
  id: 'historico',
  contrato_api_id: 'contrato-api',
  api_historico_id: 1,
  numero: '00153/2024',
  tipo: 'Contrato',
  qualificacao_termo: [],
  observacao: null,
  ug: '158366',
  codigo_unidade_origem: '158366',
  nome_unidade_origem: null,
  data_assinatura: '2024-08-26',
  data_publicacao: null,
  vigencia_inicio: '2024-09-02',
  vigencia_fim: '2026-09-02',
  valor_inicial: 0,
  valor_global: 0,
  num_parcelas: null,
  valor_parcela: 0,
  novo_valor_global: 0,
  novo_num_parcelas: null,
  novo_valor_parcela: 0,
  data_inicio_novo_valor: null,
  retroativo: null,
  retroativo_valor: 0,
  situacao_contrato: 'Ativo',
  ...overrides,
});

describe('getValorTotalFromHistorico', () => {
  it('usa o valor da assinatura quando o valor local/API resumido seria menor', () => {
    expect(getValorTotalFromHistorico([
      row({ valor_inicial: 1528056, valor_global: 1528056 }),
    ])).toBe(1528056);
  });

  it('soma assinatura e aditivo com valor proprio do termo', () => {
    expect(getValorTotalFromHistorico([
      row({ api_historico_id: 1, valor_inicial: 108000, valor_global: 108000 }),
      row({
        api_historico_id: 2,
        tipo: 'Termo Aditivo',
        data_assinatura: '2025-12-04',
        qualificacao_termo: [{ codigo: 1, descricao: 'ACRESCIMO / SUPRESSAO' }],
        valor_inicial: 27000,
        valor_global: 27000,
        novo_valor_global: 135000,
      }),
    ])).toBe(135000);
  });

  it('soma aditivos de vigencia quando eles renovam o mesmo valor do termo', () => {
    expect(getValorTotalFromHistorico([
      row({ api_historico_id: 1, valor_inicial: 3346.57, valor_global: 6693.13 }),
      row({
        api_historico_id: 2,
        tipo: 'Termo Aditivo',
        data_assinatura: '2025-02-24',
        qualificacao_termo: [{ codigo: 2, descricao: 'VIGÊNCIA' }],
        valor_inicial: 3346.57,
        valor_global: 3346.57,
      }),
      row({
        api_historico_id: 3,
        tipo: 'Termo Aditivo',
        data_assinatura: '2026-03-06',
        qualificacao_termo: [{ codigo: 2, descricao: 'VIGÊNCIA' }],
        valor_inicial: 3346.57,
        valor_global: 3346.57,
      }),
    ])).toBe(10039.71);
  });

  it('ignora valor_global quando valor_inicial nao vier preenchido', () => {
    expect(getValorTotalFromHistorico([
      row({ valor_inicial: 0, valor_global: 5000 }),
    ])).toBe(0);
  });
});
