// Oficios de bolsa trazem o banco pelo nome ("Banco do Brasil S.A.", "Nu Pagamentos S.A. (Nubank)").
// A LC e a macro SIAFI usam o codigo COMPE de 3 digitos, entao o nome e convertido aqui.

type BancoPattern = { codigo: string; pattern: RegExp };

const BANCO_PATTERNS: BancoPattern[] = [
  { codigo: '001', pattern: /\bBANCO DO BRASIL\b|^BB\b|\bBB S\.?A\b/ },
  { codigo: '104', pattern: /\bCAIXA\b|\bCEF\b/ },
  { codigo: '237', pattern: /\bBRADESCO\b/ },
  { codigo: '341', pattern: /\bITAU\b/ },
  { codigo: '033', pattern: /\bSANTANDER\b/ },
  { codigo: '260', pattern: /\bNU PAGAMENTOS\b|\bNUBANK\b|\bNU BANK\b/ },
  { codigo: '077', pattern: /\bINTER\b/ },
  { codigo: '336', pattern: /\bC6\b/ },
  { codigo: '004', pattern: /\bBANCO DO NORDESTE\b|\bBNB\b/ },
  { codigo: '756', pattern: /\bSICOOB\b|\bBANCOOB\b/ },
  { codigo: '748', pattern: /\bSICREDI\b/ },
  { codigo: '290', pattern: /\bPAGSEGURO\b|\bPAGBANK\b|\bPAG SEGURO\b/ },
  { codigo: '323', pattern: /\bMERCADO PAGO\b|\bMERCADOPAGO\b/ },
  { codigo: '380', pattern: /\bPICPAY\b/ },
  { codigo: '403', pattern: /\bCORA\b/ },
  { codigo: '212', pattern: /\bBANCO ORIGINAL\b/ },
  { codigo: '655', pattern: /\bVOTORANTIM\b|\bNEON\b/ },
];

function normalizeBancoName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte o banco lido do documento em codigo de 3 digitos.
 * Aceita o codigo ("1", "001", "077 - Inter") ou o nome ("Banco do Brasil S.A.").
 * Retorna '' quando nao reconhece, para o chamador decidir o padrao.
 */
export function resolveBancoCodigo(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const leadingCode = raw.match(/^\s*(\d{1,3})(?!\d)/);
  if (leadingCode) return leadingCode[1].padStart(3, '0');

  const normalized = normalizeBancoName(raw);
  return BANCO_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.codigo ?? '';
}
