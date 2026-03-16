import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseCurrency = (value: string | number): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;

  if (value === '0') return 0;
  const cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
    .trim();

  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(cleaned.replace(/,/g, '')) || 0;
  }

  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }

  return parseFloat(cleaned) || 0;
};

// Função para formatar o ID do documento, removendo o prefixo técnico se presente
export const formatDocumentoId = (id: string): string => {
  if (!id) return id;
  // Remove o prefixo 15836626435 (UG + Gestão) se ele existir no início do ID
  const prefixo = "15836626435";
  if (id.startsWith(prefixo)) {
    return id.substring(prefixo.length);
  }
  return id;
};

export const formatarDocumento = (doc: string): string => {
  if (!doc) return doc;
  const cleanDoc = doc.replace(/\D/g, '');
  if (!cleanDoc) return doc;

  // CNPJ (14 dígitos)
  if (cleanDoc.length === 14) {
    return cleanDoc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  // CPF (11 dígitos)
  if (cleanDoc.length === 11) {
    return cleanDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  // Se tiver entre 12 e 13 dígitos, provavelmente é um CNPJ que perdeu zero à esquerda no Excel
  if (cleanDoc.length > 11 && cleanDoc.length < 14) {
    const padded = cleanDoc.padStart(14, '0');
    return padded.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  // Se tiver 9 ou 10 dígitos, é provavelmente um CPF que perdeu zero à esquerda
  if (cleanDoc.length >= 9 && cleanDoc.length <= 10) {
    const padded = cleanDoc.padStart(11, '0');
    return padded.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  // Outros formatos (como UG de 6 dígitos) não são modificados
  return cleanDoc;
};

