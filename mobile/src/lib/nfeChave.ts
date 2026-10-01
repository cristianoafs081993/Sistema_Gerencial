/**
 * Validação estrutural da chave de acesso de documentos fiscais eletrônicos (44 dígitos),
 * com cruzamento opcional contra os dados da fatura. Não consulta a SEFAZ: confirma que a chave
 * é bem formada e coerente, não que a nota está autorizada.
 */

export type ChaveNfeEstado = 'valida' | 'inconsistente' | 'incompleta' | 'nao-nfe';

export interface ChaveNfeValidacao {
  estado: ChaveNfeEstado;
  /** Explicação curta, exibida ao usuário nos estados que não são "valida". */
  motivo: string | null;
}

export interface ChaveNfeContexto {
  /** CNPJ do fornecedor da fatura (com ou sem máscara). */
  fornecedorCnpj?: string | null;
  /** Número do instrumento de cobrança (ex.: "1.808"). */
  numeroDocumento?: string | null;
}

const UFS = new Set([11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53]);
// 55 NF-e, 65 NFC-e, 66 NF3-e (energia), 57 CT-e, 67 CT-e OS.
const MODELOS = new Set(['55', '65', '66', '57', '67']);

const soDigitos = (texto: string) => texto.replace(/\D/g, '');

function digitoVerificadorChave(chave: string): number {
  let soma = 0;
  for (let i = 0; i < 43; i += 1) {
    const peso = ((42 - i) % 8) + 2;
    soma += Number(chave[i]) * peso;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = soDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const dv = (base: string, pesos: number[]) => {
    const resto = base.split('').reduce((soma, d, i) => soma + Number(d) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, ...pesos1];
  return dv(cnpj.slice(0, 12), pesos1) === Number(cnpj[12]) && dv(cnpj.slice(0, 13), pesos2) === Number(cnpj[13]);
}

/** Retorna `null` quando não há nada a validar (campo vazio). */
export function validarChaveNfe(bruto: string | null | undefined, contexto: ChaveNfeContexto = {}): ChaveNfeValidacao | null {
  const texto = String(bruto ?? '').trim();
  if (!texto) return null;

  const chave = soDigitos(texto);
  const somenteNumerica = /^[\d\s.\-]+$/.test(texto);

  // Códigos alfanuméricos e números curtos são de outros documentos (ex.: NFS-e municipal).
  if (!somenteNumerica || chave.length < 30) return { estado: 'nao-nfe', motivo: 'Não é uma chave de NF-e (código de outro tipo de nota)' };
  if (chave.length < 44) return { estado: 'incompleta', motivo: `Chave incompleta: ${chave.length} dígitos de 44` };
  if (chave.length > 44) return { estado: 'inconsistente', motivo: `Dígitos a mais: ${chave.length} em vez de 44` };

  if (!UFS.has(Number(chave.slice(0, 2)))) return { estado: 'inconsistente', motivo: 'Código de UF inválido' };
  if (!MODELOS.has(chave.slice(20, 22))) return { estado: 'inconsistente', motivo: `Modelo de documento inválido (${chave.slice(20, 22)})` };
  if (!cnpjValido(chave.slice(6, 20))) return { estado: 'inconsistente', motivo: 'CNPJ do emitente inválido' };
  if (digitoVerificadorChave(chave) !== Number(chave[43])) return { estado: 'inconsistente', motivo: 'Dígito verificador não confere' };

  const fornecedor = soDigitos(String(contexto.fornecedorCnpj ?? ''));
  if (fornecedor.length === 14 && fornecedor !== chave.slice(6, 20)) {
    return { estado: 'inconsistente', motivo: 'O CNPJ da chave é diferente do fornecedor da fatura' };
  }

  const numeroFatura = soDigitos(String(contexto.numeroDocumento ?? ''));
  if (numeroFatura && Number(numeroFatura) !== Number(chave.slice(25, 34))) {
    return { estado: 'inconsistente', motivo: `O número da nota na chave (${Number(chave.slice(25, 34))}) difere do da fatura` };
  }

  return { estado: 'valida', motivo: null };
}
