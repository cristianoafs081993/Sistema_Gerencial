import { describe, expect, it } from 'vitest';

import type { ContratoApiPublicLiquidacaoRow } from '@/services/contratosApi';
import type { PortalTransparenciaItemEmpenho } from '@/services/transparencia';
import {
  buildEmpenhoItemBalances,
  buildEmpenhoItemSourceKey,
  buildRequisicaoItemsFromEmpenho,
  getRequisicaoItemAvailableBalance,
} from '@/utils/requisicaoEmpenhoItems';

const buildPortalItem = (patch: Partial<PortalTransparenciaItemEmpenho>): PortalTransparenciaItemEmpenho => ({
  codigoItemEmpenho: '158366264352026NE000083',
  sequencial: 1,
  descricao: 'Generos alimenticios',
  codigoSubelemento: '30',
  descricaoSubelemento: 'MATERIAL DE CONSUMO',
  valorAtual: 1000,
  historico: [],
  ...patch,
});

const buildLiquidacao = (patch: Partial<ContratoApiPublicLiquidacaoRow>): ContratoApiPublicLiquidacaoRow => ({
  contrato_api_id: 1,
  contrato_numero: '00337/2025',
  contrato_objeto: 'Fornecimento de alimentos',
  fatura_id: 10,
  numero_instrumento_cobranca: 'NF-10',
  situacao: 'Siafi Apropriado',
  valor_bruto: 250,
  valor_liquido: 250,
  data_emissao: '2026-07-10',
  data_vencimento: null,
  data_pagamento: null,
  data_liquidacao: '2026-07-12',
  processo: null,
  empenho_numero: '2026NE000083',
  valor_empenho: null,
  subelemento: '30',
  ...patch,
});

describe('requisicaoEmpenhoItems', () => {
  it('calcula saldo do item abatendo apenas liquidacoes oficiais por subelemento', () => {
    const item = buildPortalItem({ valorAtual: 1000 });
    const sourceKey = buildEmpenhoItemSourceKey('2026NE000083', item);

    const [balance] = buildEmpenhoItemBalances(
      '2026NE000083',
      [item],
      [buildLiquidacao({ valor_bruto: 250 })],
    );

    expect(balance).toMatchObject({
      sourceItemKey: sourceKey,
      valorAtual: 1000,
      liquidadoCalculado: 250,
      saldoItem: 750,
    });
  });

  it('monta itens da requisicao com origem e snapshot do subitem da NE', () => {
    const item = buildPortalItem({
      sequencial: 2,
      historico: [
        {
          data: '10/07/2026',
          operacao: 'INCLUSAO',
          quantidade: 5,
          valorUnitario: 20,
          valorTotal: 100,
        },
      ],
    });
    const balances = buildEmpenhoItemBalances('2026NE000083', [item], []);

    const [requisicaoItem] = buildRequisicaoItemsFromEmpenho('2026NE000083', balances);

    expect(requisicaoItem).toMatchObject({
      description: 'Generos alimenticios',
      quantity: 5,
      unit: 'UN',
      unitPrice: 20,
      sourceType: 'portal_transparencia_empenho_item',
      sourceReference: '30 - MATERIAL DE CONSUMO',
      sourceSnapshot: expect.objectContaining({
        empenhoNumero: '2026NE000083',
        sequencial: 2,
        valorAtual: 1000,
        saldoItem: 1000,
      }),
    });
  });

  it('mantem saldo integral quando a liquidacao nao pertence ao subelemento do item', () => {
    const [balance] = buildEmpenhoItemBalances(
      '2026NE000083',
      [buildPortalItem({ codigoSubelemento: '52', valorAtual: 800 })],
      [buildLiquidacao({ subelemento: '30', valor_bruto: 250 })],
    );

    expect(balance.saldoItem).toBe(800);
    expect(balance.liquidadoCalculado).toBe(0);
  });

  it('ignora reservas legadas do snapshot ao calcular o saldo do item', () => {
    expect(
      getRequisicaoItemAvailableBalance(
        {
          sourceItemKey: 'item-1',
          sourceSnapshot: {
            valorAtual: 1000,
            liquidadoCalculado: 250,
            reservado: 500,
            saldoItem: 250,
          },
        },
        [],
      ),
    ).toBe(750);
  });

  it('abate valores de requisicoes enviadas ao fornecedor do saldo do item', () => {
    const item = buildPortalItem({ valorAtual: 3374.4 });
    const sourceKey = buildEmpenhoItemSourceKey('2026NE000078', item);
    const enviadoMap = new Map<string, number>([
      [sourceKey.toLowerCase(), 843.6],
    ]);

    const [balance] = buildEmpenhoItemBalances('2026NE000078', [item], [], enviadoMap);

    expect(balance).toMatchObject({
      sourceItemKey: sourceKey,
      valorAtual: 3374.4,
      liquidadoCalculado: 0,
      enviadoCalculado: 843.6,
      saldoItem: 2530.8,
    });

    const available = getRequisicaoItemAvailableBalance(
      { sourceItemKey: sourceKey },
      [balance],
      enviadoMap,
    );
    expect(available).toBe(2530.8);
  });

  it('abate valores de requisicoes enviadas ao fornecedor usando fallback por descricao', () => {
    const item = buildPortalItem({
      descricao: 'Item Compra: Queijo tipo minas artesanal',
      valorAtual: 1000,
    });
    const fallbackKey = '2026NE000078|queijo tipo minas artesanal';
    const enviadoMap = new Map<string, number>([[fallbackKey, 200]]);

    const [balance] = buildEmpenhoItemBalances('2026NE000078', [item], [], enviadoMap);

    expect(balance.enviadoCalculado).toBe(200);
    expect(balance.saldoItem).toBe(800);
  });
});

