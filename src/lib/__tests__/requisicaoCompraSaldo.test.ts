// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  requisicaoRetemSaldo,
  saldoDisponivelEfetivo,
  somarEnviadoFornecedorPorEmpenho,
  type RequisicaoSaldoRequisicao,
} from '@/lib/requisicaoCompraSaldo';

const requisicaoEnviada: RequisicaoSaldoRequisicao = {
  id: 'req-enviada-anterior',
  status: 'enviada_fornecedor',
  empenhoId: 'emp-100',
  totalValue: 2500,
  items: [{ empenhoId: 'emp-100', quantity: 25, unitPrice: 100 }],
};

describe('requisicaoCompraSaldo', () => {
  it('considera enviada ao fornecedor, em revisão e aprovada como retenção de saldo', () => {
    expect(requisicaoRetemSaldo('enviada_fornecedor')).toBe(true);
    expect(requisicaoRetemSaldo('review')).toBe(true);
    expect(requisicaoRetemSaldo('approved')).toBe(true);
    expect(requisicaoRetemSaldo('rascunho')).toBe(false);
    expect(requisicaoRetemSaldo('liquidada')).toBe(false);
  });

  it('desconta do empenho o valor dos itens de requisições enviadas ao fornecedor', () => {
    const totais = somarEnviadoFornecedorPorEmpenho([requisicaoEnviada]);

    expect(totais.get('emp-100')).toBe(2500);
    expect(saldoDisponivelEfetivo(10000, totais.get('emp-100') ?? 0)).toBe(7500);
  });

  it('não desconta requisições em rascunho nem liquidadas', () => {
    const totais = somarEnviadoFornecedorPorEmpenho([
      { ...requisicaoEnviada, id: 'req-rascunho', status: 'rascunho' },
      { ...requisicaoEnviada, id: 'req-liquidada', status: 'liquidada' },
    ]);

    expect(totais.size).toBe(0);
  });

  it('ignora a requisição que está sendo editada para ela não descontar de si mesma', () => {
    const totais = somarEnviadoFornecedorPorEmpenho([requisicaoEnviada], 'req-enviada-anterior');

    expect(totais.get('emp-100')).toBeUndefined();
  });

  it('soma várias requisições e distribui por empenho conforme o item', () => {
    const totais = somarEnviadoFornecedorPorEmpenho([
      requisicaoEnviada,
      {
        id: 'req-2',
        status: 'approved',
        empenhoId: 'emp-100',
        items: [
          { empenhoId: 'emp-100', quantity: 1, unitPrice: 500 },
          { empenhoId: 'emp-200', quantity: 2, unitPrice: 300 },
          { quantity: 1, unitPrice: 50 },
        ],
      },
    ]);

    expect(totais.get('emp-100')).toBe(2500 + 500 + 50);
    expect(totais.get('emp-200')).toBe(600);
  });

  it('usa o total da requisição quando não há itens', () => {
    const totais = somarEnviadoFornecedorPorEmpenho([
      { id: 'req-sem-itens', status: 'review', empenhoId: 'emp-300', totalValue: 1200, items: [] },
      { id: 'req-sem-valor', status: 'review', empenhoId: 'emp-300', totalValue: 0, items: null },
      { id: 'req-sem-empenho', status: 'review', totalValue: 999, items: [] },
    ]);

    expect(totais.get('emp-300')).toBe(1200);
    expect(totais.size).toBe(1);
  });

  it('nunca retorna saldo disponível negativo', () => {
    expect(saldoDisponivelEfetivo(1000, 1500)).toBe(0);
    expect(saldoDisponivelEfetivo(1000, 0)).toBe(1000);
  });
});
