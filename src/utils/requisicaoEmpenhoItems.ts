import type { ContratoApiPublicLiquidacaoRow } from '@/services/contratosApi';
import type { PortalTransparenciaItemEmpenho } from '@/services/transparencia';
import { normalizeEmpenhoNumero } from '@/services/transparencia';
import type { RequisicaoCompraItem } from '@/types';

type RequisicaoFormItem = Omit<RequisicaoCompraItem, 'id' | 'requisicaoCompraId' | 'createdAt' | 'updatedAt'>;

export type EmpenhoItemBalance = {
  sourceItemKey: string;
  item: PortalTransparenciaItemEmpenho;
  valorAtual: number;
  liquidadoCalculado: number;
  saldoItem: number;
  liquidacoes: ContratoApiPublicLiquidacaoRow[];
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const getLiquidacaoValue = (liquidacao: ContratoApiPublicLiquidacaoRow) =>
  Number(liquidacao.valor_bruto ?? liquidacao.valor_liquido ?? liquidacao.valor_empenho ?? 0) || 0;

const getItemUnitPrice = (item: PortalTransparenciaItemEmpenho) => {
  const historyUnitPrice = item.historico.find((row) => Number(row.valorUnitario) > 0)?.valorUnitario;
  return Number(historyUnitPrice || item.valorAtual || 0);
};

const getItemQuantity = (item: PortalTransparenciaItemEmpenho) => {
  const historyQuantity = item.historico?.find((row) => Number(row.quantidade) > 0)?.quantidade;
  return Number(historyQuantity || 0);
};

export const buildEmpenhoItemSourceKey = (numeroEmpenho: string, item: PortalTransparenciaItemEmpenho) =>
  [
    normalizeEmpenhoNumero(numeroEmpenho),
    item.codigoItemEmpenho || 'sem-codigo',
    String(item.sequencial || 0),
  ].join('|');

export function buildEmpenhoItemBalances(
  numeroEmpenho: string,
  itens: PortalTransparenciaItemEmpenho[],
  liquidacoes: ContratoApiPublicLiquidacaoRow[] = [],
): EmpenhoItemBalance[] {
  const itemsBySubelemento = itens.reduce((map, item) => {
    const key = normalizeText(item.codigoSubelemento || item.descricaoSubelemento);
    if (!key) return map;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
    return map;
  }, new Map<string, PortalTransparenciaItemEmpenho[]>());

  const liquidacoesBySubelemento = liquidacoes.reduce((map, liquidacao) => {
    const key = normalizeText(liquidacao.subelemento);
    if (!key) return map;
    const list = map.get(key) ?? [];
    list.push(liquidacao);
    map.set(key, list);
    return map;
  }, new Map<string, ContratoApiPublicLiquidacaoRow[]>());

  const allocatedLiquidacoes = new Map<string, ContratoApiPublicLiquidacaoRow[]>();
  const allocatedValues = new Map<string, number>();

  for (const [subelemento, matchingLiquidacoes] of liquidacoesBySubelemento.entries()) {
    const matchingItems = itemsBySubelemento.get(subelemento) ?? [];
    if (matchingItems.length === 0) continue;

    let remainingLiquidado = matchingLiquidacoes.reduce((sum, liquidacao) => sum + getLiquidacaoValue(liquidacao), 0);

    for (const item of matchingItems) {
      const sourceItemKey = buildEmpenhoItemSourceKey(numeroEmpenho, item);
      const liquidadoForItem =
        matchingItems.length === 1 ? remainingLiquidado : Math.min(Number(item.valorAtual) || 0, remainingLiquidado);

      if (liquidadoForItem > 0) {
        allocatedValues.set(sourceItemKey, liquidadoForItem);
        allocatedLiquidacoes.set(sourceItemKey, matchingLiquidacoes);
        remainingLiquidado = Math.max(0, remainingLiquidado - liquidadoForItem);
      }

      if (remainingLiquidado <= 0) break;
    }
  }

  return itens.map((item) => {
    const sourceItemKey = buildEmpenhoItemSourceKey(numeroEmpenho, item);
    const valorAtual = Number(item.valorAtual || 0);
    const liquidadoCalculado = allocatedValues.get(sourceItemKey) ?? 0;

    return {
      sourceItemKey,
      item,
      valorAtual,
      liquidadoCalculado,
      saldoItem: Math.max(0, valorAtual - liquidadoCalculado),
      liquidacoes: allocatedLiquidacoes.get(sourceItemKey) ?? [],
    };
  });
}

export function buildRequisicaoItemsFromEmpenho(
  numeroEmpenho: string,
  balances: EmpenhoItemBalance[],
): RequisicaoFormItem[] {
  return balances.map(({ item, sourceItemKey, valorAtual, liquidadoCalculado, saldoItem, liquidacoes }, index) => ({
    description: (item.descricao || item.descricaoSubelemento || `Subitem ${item.sequencial || index + 1}`).replace(/^item\s+compra\s*:\s*/i, '').trim(),
    quantity: getItemQuantity(item),
    unit: 'UN',
    unitPrice: getItemUnitPrice(item),
    sortOrder: index,
    sourceType: 'portal_transparencia_empenho_item',
    sourceItemKey,
    sourceReference: [item.codigoSubelemento, item.descricaoSubelemento].filter(Boolean).join(' - '),
    sourceSnapshot: {
      empenhoNumero: normalizeEmpenhoNumero(numeroEmpenho),
      codigoItemEmpenho: item.codigoItemEmpenho,
      sequencial: item.sequencial,
      codigoSubelemento: item.codigoSubelemento,
      descricaoSubelemento: item.descricaoSubelemento,
      valorAtual,
      liquidadoCalculado,
      saldoItem,
      liquidacoes: liquidacoes.map((liquidacao) => ({
        contratoNumero: liquidacao.contrato_numero,
        faturaId: liquidacao.fatura_id,
        instrumento: liquidacao.numero_instrumento_cobranca,
        situacao: liquidacao.situacao,
        valor: getLiquidacaoValue(liquidacao),
        dataEmissao: liquidacao.data_emissao,
        dataLiquidacao: liquidacao.data_liquidacao,
      })),
    },
  }));
}

export function getRequisicaoItemAvailableBalance(
  item: Pick<RequisicaoFormItem, 'sourceItemKey' | 'sourceSnapshot'>,
  balances: EmpenhoItemBalance[],
) {
  if (!item.sourceItemKey) return null;
  const freshBalance = balances.find((balance) => balance.sourceItemKey === item.sourceItemKey);
  if (freshBalance) return freshBalance.saldoItem;
  const valorAtual = item.sourceSnapshot?.valorAtual;
  const liquidadoCalculado = item.sourceSnapshot?.liquidadoCalculado;
  if (typeof valorAtual === 'number' && typeof liquidadoCalculado === 'number') {
    return Math.max(0, valorAtual - liquidadoCalculado);
  }
  const snapshotValue = item.sourceSnapshot?.saldoItem;
  return typeof snapshotValue === 'number' ? snapshotValue : null;
}
