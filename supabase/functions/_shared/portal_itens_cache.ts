export type PortalEmpenhoCacheStage = 'rap' | 'exercicio';

export type PortalEmpenhoBalanceRow = {
  tipo?: string | null;
  valor?: number | string | null;
  valor_liquidado_a_pagar?: number | string | null;
  valor_pago_oficial?: number | string | null;
  saldo_rap_oficial?: number | string | null;
  rap_a_liquidar?: number | string | null;
  rap_inscrito?: number | string | null;
  rap_pago?: number | string | null;
};

const toNumber = (value: unknown) => {
  if (value == null || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (value: unknown) => {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const matchesPortalEmpenhoCacheStage = (
  row: Pick<PortalEmpenhoBalanceRow, 'tipo'>,
  stage: PortalEmpenhoCacheStage,
) => stage === 'rap' ? row.tipo === 'rap' : row.tipo == null || row.tipo === '' || row.tipo === 'exercicio';

/** Mirrors fn_empenho_saldo_disponivel so cache discovery never skips an active NE. */
export const getPortalEmpenhoAvailableBalance = (row: PortalEmpenhoBalanceRow) => {
  if (row.tipo === 'rap') {
    const officialRapBalance = toNullableNumber(row.saldo_rap_oficial);
    if (officialRapBalance != null) return Math.max(0, officialRapBalance);

    const rapBase = row.rap_a_liquidar ?? row.rap_inscrito ?? row.valor;
    return Math.max(0, toNumber(rapBase) - toNumber(row.rap_pago));
  }

  return Math.max(
    0,
    toNumber(row.valor) - toNumber(row.valor_liquidado_a_pagar) - toNumber(row.valor_pago_oficial),
  );
};
