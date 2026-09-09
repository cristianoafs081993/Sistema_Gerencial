const SUAP_ORIGIN = "https://suap.ifrn.edu.br";
const ORIGINAL_DOCUMENT_PATH = /^\/documento_eletronico\/visualizar_documento(?:_digitalizado)?\/\d+\/?$/;
const PLAN_8_PATH = /^\/plan_estrategico\/plano_concluido\/8\/?$/;
const PLAN_8_UNITS = new Set([
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16',
  '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44',
]);

export function isSuapOriginalDocumentPath(rawPath: string): boolean {
  try {
    const url = new URL(rawPath, SUAP_ORIGIN);
    if (url.origin !== SUAP_ORIGIN) return false;

    if (!ORIGINAL_DOCUMENT_PATH.test(url.pathname)) return false;
    return url.searchParams.get("original") === "sim" && [...url.searchParams.keys()].length === 1;
  } catch {
    return false;
  }
}

export function isAllowedSuapProxyPath(rawPath: string): boolean {
  try {
    const url = new URL(rawPath, SUAP_ORIGIN);
    if (url.origin !== SUAP_ORIGIN) return false;

    if (url.pathname.startsWith("/processo_eletronico/") || url.pathname.startsWith("/djtools/")) {
      return true;
    }
    if (PLAN_8_PATH.test(url.pathname)) {
      const entries = [...url.searchParams.entries()];
      return entries.length === 0
        || (entries.length === 1 && entries[0][0] === 'unidade_gestora' && PLAN_8_UNITS.has(entries[0][1]));
    }

    return isSuapOriginalDocumentPath(rawPath);
  } catch {
    return false;
  }
}





