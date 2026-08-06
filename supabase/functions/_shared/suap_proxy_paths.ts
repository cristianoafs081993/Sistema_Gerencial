const SUAP_ORIGIN = "https://suap.ifrn.edu.br";
const ORIGINAL_DOCUMENT_PATH = /^\/documento_eletronico\/visualizar_documento(?:_digitalizado)?\/\d+\/?$/;
const PLAN_8_PATH = /^\/plan_estrategico\/plano_concluido\/8\/?$/;

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
    if (PLAN_8_PATH.test(url.pathname) && url.search === "") return true;

    return isSuapOriginalDocumentPath(rawPath);
  } catch {
    return false;
  }
}






