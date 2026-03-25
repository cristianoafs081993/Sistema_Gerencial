import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DocumentoDespesa } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calcula o valor pago de um documento com base em seu estado e itens (OBs/NSs)
 */
export function calculateDocumentoValorPago(doc: DocumentoDespesa): number {
    const situacoes = doc.situacoes || [];
    const items = doc.itens || [];
    const temOB = items.some(i => i.doc_tipo === 'OB');
    const estado = doc.estado?.toUpperCase() || '';
    
    if (estado === 'REALIZADO') {
        return doc.valor_original || 0;
    }
    
    if (estado === 'CANCELADO') {
        return 0;
    }
    
    // Regra específica: Pendente de Realização
    // Se temos OBs com valores válidos, usamos a soma delas como o valor pago primário
    // Se não houver OBs ou os valores forem zero (ainda não importados), calculamos com base nas retenções
    if (estado === 'PENDENTE DE REALIZACAO') {
        const obs = items.filter(i => i.doc_tipo === 'OB');
        const somaOBs = obs.reduce((acc, i) => acc + (i.valor || 0), 0);
        
        if (obs.length > 0 && somaOBs > 0) {
            return somaOBs;
        }

        const retencoesPendentes = situacoes
            .filter(s => {
                const code = s.situacao_codigo?.toUpperCase() || '';
                return code === 'DSP021' || code === 'DSP025' || code === 'DDF021' || code === 'DDF025';
            })
            .reduce((acc, s) => acc + (s.valor || 0), 0);
        
        return Math.max(0, (doc.valor_original || 0) - retencoesPendentes);
    }
    
    // Regra geral para outros estados (ex: EM LIQUIDACAO) que possuem OB
    if (temOB) {
         const totalRetencoes = situacoes.filter(s => 
            s.is_retencao || 
            s.situacao_codigo === 'DOB001' || 
            s.situacao_codigo === 'DOB035'
        ).reduce((acc, s) => acc + (s.valor || 0), 0) || 0;
        
        return Math.max(0, (doc.valor_original || 0) - totalRetencoes);
    }

    return 0;
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

