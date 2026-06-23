import type { ContratoApiDetails, ContratoApiFaturaRow, ContratoApiItemRow } from '@/services/contratosApi';

const EXECUTED_STATUSES = new Set(['pago', 'siafi apropriado']);

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function parseContratoApiNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (value == null) return 0;
  const cleaned = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  if (cleaned.includes(',')) return Number(cleaned.replace(',', '.')) || 0;
  return Number(cleaned) || 0;
}

function getContractedTotal(item: ContratoApiItemRow) {
  const historyTotal = (item.historico_item ?? []).reduce(
    (sum, row) => sum + parseContratoApiNumber(row?.valor_total),
    0,
  );
  return historyTotal > 0 ? historyTotal : Number(item.valor_total) || 0;
}

function isExecuted(fatura?: ContratoApiFaturaRow) {
  return EXECUTED_STATUSES.has(normalize(fatura?.situacao));
}

export function buildContratoItemBalances(details: ContratoApiDetails) {
  const faturaById = new Map(details.faturas.map((fatura) => [fatura.id, fatura]));

  return details.itens.map((item) => {
    const contracted = getContractedTotal(item);
    const executed = details.faturaItens
      .filter((link) => link.contrato_api_item_id === item.id && isExecuted(faturaById.get(link.contrato_api_fatura_id)))
      .reduce((sum, link) => sum + (Number(link.valor_total_faturado) || 0), 0);

    return {
      id: item.id,
      number: item.numero_item_compra || String(item.api_item_id),
      description: [item.catmatseritem_id, item.descricao_complementar].filter(Boolean).join(' - ') || `Item ${item.api_item_id}`,
      contracted,
      executed,
      available: Math.max(0, contracted - executed),
    };
  });
}
