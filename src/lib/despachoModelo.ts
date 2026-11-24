/**
 * Partes do despacho de liquidação que o servidor pode personalizar na extensão
 * (popup → "Modelos e preenchimentos"). Campos vazios mantêm o texto padrão do SIAGES;
 * `{campus}` vira o nome do campus. O corpo (considerandos e AUTORIZO) continua
 * montado pelo SIAGES conforme o tipo de despesa.
 */
export type DespachoModelo = {
  campus?: string;
  destinatario?: string;
  assunto?: string;
  encaminhamento?: string;
  fecho?: string;
};

export type DespachoModeloTexto = Exclude<keyof DespachoModelo, 'campus'>;

export const DEFAULT_DESPACHO_CAMPUS = 'Currais Novos';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function resolveDespachoCampus(modelo?: DespachoModelo) {
  return modelo?.campus?.trim() || DEFAULT_DESPACHO_CAMPUS;
}

/** Nome do campus pronto para entrar no HTML do despacho. */
export function despachoCampusHtml(modelo?: DespachoModelo) {
  return escapeHtml(resolveDespachoCampus(modelo));
}

/** Texto do servidor em HTML seguro: {campus} substituído, "Campus" em itálico e quebras de linha preservadas. */
export function renderDespachoModeloText(value: string, campus: string) {
  return escapeHtml(value.trim().split('{campus}').join(campus))
    .replace(/\bCampus\b/g, '<i>Campus</i>')
    .replace(/\r?\n/g, '<br>');
}

/** HTML do campo personalizado ou, sem personalização, o trecho padrão já em HTML. */
export function despachoModeloHtml(modelo: DespachoModelo | undefined, field: DespachoModeloTexto, fallbackHtml: string) {
  const value = modelo?.[field]?.trim();
  return value ? renderDespachoModeloText(value, resolveDespachoCampus(modelo)) : fallbackHtml;
}
