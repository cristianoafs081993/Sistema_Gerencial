/**
 * Regras de saldo retido em Requisições de Compra.
 *
 * Requisições nos status `enviada_fornecedor`, `review` e `approved` comprometem parte do saldo
 * do empenho. A requisição que está sendo editada não conta (senão ela descontaria de si mesma).
 */

export type RequisicaoSaldoItem = {
  empenhoId?: string | null;
  quantity: number;
  unitPrice: number;
};

export type RequisicaoSaldoRequisicao = {
  id: string;
  status: string;
  empenhoId?: string | null;
  totalValue?: number | null;
  items?: RequisicaoSaldoItem[] | null;
};

const STATUS_QUE_RETEM_SALDO = new Set(['enviada_fornecedor', 'review', 'approved']);

export function requisicaoRetemSaldo(status: string): boolean {
  return STATUS_QUE_RETEM_SALDO.has(status);
}

/**
 * Soma, por empenho, o valor comprometido em requisições que retêm saldo.
 * Usa os itens quando existem (cada item pode apontar para outro empenho); sem itens, usa o total da requisição.
 */
export function somarEnviadoFornecedorPorEmpenho(
  requisicoes: RequisicaoSaldoRequisicao[],
  editingRequisicaoId?: string | null,
): Map<string, number> {
  const totais = new Map<string, number>();

  for (const requisicao of requisicoes) {
    if (!requisicaoRetemSaldo(requisicao.status)) continue;
    if (editingRequisicaoId && requisicao.id === editingRequisicaoId) continue;

    if (requisicao.items && requisicao.items.length > 0) {
      for (const item of requisicao.items) {
        const empenhoId = item.empenhoId || requisicao.empenhoId;
        if (!empenhoId) continue;
        totais.set(empenhoId, (totais.get(empenhoId) ?? 0) + item.quantity * item.unitPrice);
      }
    } else if (requisicao.empenhoId && requisicao.totalValue) {
      totais.set(requisicao.empenhoId, (totais.get(requisicao.empenhoId) ?? 0) + requisicao.totalValue);
    }
  }

  return totais;
}

/** Saldo efetivamente disponível: saldo oficial menos o retido, nunca negativo. */
export function saldoDisponivelEfetivo(saldoOficial: number, retido: number): number {
  return Math.max(0, saldoOficial - retido);
}
