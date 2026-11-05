import * as XLSX from 'xlsx';

import type { Empenho } from '@/types';
import { getRapBase, getRapLiquidado, getRapSaldo } from '@/pages/empenhosFilters';
import { getRapReferenceYear, isRapReinscrito } from '@/utils/rapMetrics';

export type EmpenhosExportType = 'execucao' | 'restos';

export type EmpenhoExportRow = Record<string, string | number>;

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const formatDate = (value: Date | string | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

/**
 * Converte a lista (ja filtrada) de empenhos em linhas planas para planilha.
 * As colunas seguem os mesmos calculos exibidos na tabela da tela.
 */
export const buildEmpenhosExportRows = (
  empenhos: Empenho[],
  type: EmpenhosExportType,
): EmpenhoExportRow[] => {
  const referenceYear = getRapReferenceYear(empenhos);

  return empenhos.map((empenho) => {
    const common = {
      'Número (NE)': empenho.numero,
      Processo: empenho.processo || '',
      Favorecido: empenho.favorecidoNome || '',
      'CPF/CNPJ': empenho.favorecidoDocumento || '',
      Descrição: empenho.descricao || '',
      Dimensão: empenho.dimensao || '',
      'Componente Funcional': empenho.componenteFuncional || '',
      'Origem de Recurso': empenho.origemRecurso || '',
      'Plano Interno': empenho.planoInterno || '',
      'Natureza de Despesa': empenho.naturezaDespesa || '',
      'Data do Empenho': formatDate(empenho.dataEmpenho),
      Status: statusLabels[empenho.status] || empenho.status,
    };

    if (type === 'restos') {
      return {
        ...common,
        Situação: isRapReinscrito(empenho, referenceYear) ? 'Reinscrito' : 'Inscrito',
        'Inscrito / Reinscrito': getRapBase(empenho, referenceYear),
        'Pago no Ano': getRapLiquidado(empenho),
        'Saldo Atual': getRapSaldo(empenho, referenceYear),
      };
    }

    const liquidado = empenho.valorLiquidado || 0;
    return {
      ...common,
      Empenhado: empenho.valor,
      Liquidado: liquidado,
      Pago: empenho.valorPago || 0,
      'A Liquidar': empenho.valor - liquidado,
    };
  });
};

export const getEmpenhosExportFileName = (type: EmpenhosExportType, date = new Date()) => {
  const stamp = date.toISOString().slice(0, 10);
  return `empenhos-${type === 'restos' ? 'restos-a-pagar' : 'execucao'}-${stamp}.xlsx`;
};

/**
 * Gera e baixa o arquivo Excel. Retorna a quantidade de linhas exportadas.
 */
export const exportEmpenhosToExcel = (empenhos: Empenho[], type: EmpenhosExportType): number => {
  const rows = buildEmpenhosExportRows(empenhos, type);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  if (rows.length > 0) {
    worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({
      wch: Math.min(
        50,
        Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length)) + 2,
      ),
    }));
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, type === 'restos' ? 'Restos a Pagar' : 'Execução');
  XLSX.writeFile(workbook, getEmpenhosExportFileName(type));

  return rows.length;
};
