import { describe, expect, it } from 'vitest';

import { buildContratoItemBalances } from '@/utils/contratoItemBalance';

describe('buildContratoItemBalances', () => {
  it('desconta apenas faturas executadas e vinculadas ao item', () => {
    const balances = buildContratoItemBalances({
      historico: [], empenhos: [], faturaEmpenhos: [],
      itens: [{ id: 'item-1', contrato_api_id: 'c1', api_item_id: 1, catmatseritem_id: 'Arroz', descricao_complementar: null, quantidade: 10, valor_unitario: 10, valor_total: 100, numero_item_compra: '1', historico_item: null }],
      faturas: [
        { id: 'f1', contrato_api_id: 'c1', api_fatura_id: 1, numero_instrumento_cobranca: null, situacao: 'Pago', valor_bruto: 30, valor_liquido: 30, data_emissao: null, data_pagamento: null },
        { id: 'f2', contrato_api_id: 'c1', api_fatura_id: 2, numero_instrumento_cobranca: null, situacao: 'Pendente', valor_bruto: 20, valor_liquido: 20, data_emissao: null, data_pagamento: null },
      ],
      faturaItens: [
        { id: 'fi1', contrato_api_id: 'c1', contrato_api_fatura_id: 'f1', contrato_api_item_id: 'item-1', api_item_id: 1, quantidade_faturado: 3, valor_unitario_faturado: 10, valor_total_faturado: 30 },
        { id: 'fi2', contrato_api_id: 'c1', contrato_api_fatura_id: 'f2', contrato_api_item_id: 'item-1', api_item_id: 1, quantidade_faturado: 2, valor_unitario_faturado: 10, valor_total_faturado: 20 },
      ],
    });

    expect(balances[0]).toMatchObject({ contracted: 100, executed: 30, available: 70 });
  });
});
