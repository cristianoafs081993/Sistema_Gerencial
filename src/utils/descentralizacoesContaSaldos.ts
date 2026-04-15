import type { ContaDescentralizacaoSaldo, Descentralizacao } from '@/types';
import { getDimensionLabel, matchesDimensionFilter, resolveRecordDimensionCode } from '@/utils/dimensionFilters';

export type ContaDescentralizacaoSaldoImportInput = {
  ptres: string;
  metrica?: string;
  valor: number;
};

export type DescentralizacaoResumoRow = {
  dimensao: string;
  origemRecurso: string;
  valor: number;
};

const parseValorBR = (valorStr: string): number => {
  const cleaned = valorStr
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');

  return Number.parseFloat(cleaned) || 0;
};

const resolveDescentralizacaoDimensionLabel = (descentralizacao: Descentralizacao) => {
  const dimensionCode = resolveRecordDimensionCode({
    dimensionValue: descentralizacao.dimensao,
    planInternal: descentralizacao.planoInterno,
    description: descentralizacao.descricao,
  });

  if (dimensionCode) {
    return getDimensionLabel(dimensionCode) || dimensionCode;
  }

  return descentralizacao.dimensao?.trim() || 'Sem Dimensao';
};

const aggregateRows = (rows: DescentralizacaoResumoRow[]) => {
  const map = new Map<string, DescentralizacaoResumoRow>();

  rows.forEach((row) => {
    const origemRecurso = row.origemRecurso.trim();
    const dimensao = row.dimensao.trim() || 'Sem Dimensao';
    const key = `${dimensao}|${origemRecurso}`;
    const existing = map.get(key);

    if (existing) {
      existing.valor += row.valor;
      return;
    }

    map.set(key, {
      dimensao,
      origemRecurso,
      valor: row.valor,
    });
  });

  return Array.from(map.values());
};

export const normalizeContaDescentralizacaoImportRows = (
  rows: Record<string, string>[],
): ContaDescentralizacaoSaldoImportInput[] => {
  const groupedRows = new Map<string, ContaDescentralizacaoSaldoImportInput>();

  rows.forEach((row) => {
    const ptres = String(row.ptres || '').trim();
    if (!ptres) return;

    const metrica = String(row.metrica || row['mtrica'] || '').trim();
    const valor = parseValorBR(String(row.valor || '0'));
    const existing = groupedRows.get(ptres);

    if (existing) {
      existing.valor += valor;
      if (!existing.metrica && metrica) {
        existing.metrica = metrica;
      }
      return;
    }

    groupedRows.set(ptres, {
      ptres,
      metrica,
      valor,
    });
  });

  return Array.from(groupedRows.values()).sort((left, right) => left.ptres.localeCompare(right.ptres));
};

export const buildDescentralizacaoSummaryRows = ({
  descentralizacoes,
  contaSaldos,
}: {
  descentralizacoes: Descentralizacao[];
  contaSaldos: ContaDescentralizacaoSaldo[];
}): DescentralizacaoResumoRow[] => {
  if (contaSaldos.length === 0) {
    return aggregateRows(
      descentralizacoes.map((descentralizacao) => ({
        dimensao: resolveDescentralizacaoDimensionLabel(descentralizacao),
        origemRecurso: descentralizacao.origemRecurso?.trim() || 'Sem Origem',
        valor: descentralizacao.valor,
      })),
    );
  }

  const detailByOrigem = new Map<string, Map<string, number>>();

  descentralizacoes.forEach((descentralizacao) => {
    const origemRecurso = descentralizacao.origemRecurso?.trim();
    if (!origemRecurso) return;

    const dimensao = resolveDescentralizacaoDimensionLabel(descentralizacao);
    const dimensionMap = detailByOrigem.get(origemRecurso) || new Map<string, number>();

    dimensionMap.set(dimensao, (dimensionMap.get(dimensao) || 0) + descentralizacao.valor);
    detailByOrigem.set(origemRecurso, dimensionMap);
  });

  const summaryRows: DescentralizacaoResumoRow[] = [];

  contaSaldos.forEach((saldo) => {
    const origemRecurso = saldo.ptres.trim();
    const detailDimensions = detailByOrigem.get(origemRecurso);

    if (!detailDimensions || detailDimensions.size === 0) {
      summaryRows.push({
        dimensao: 'Sem Dimensao',
        origemRecurso,
        valor: saldo.valor,
      });
      return;
    }

    const detailEntries = Array.from(detailDimensions.entries());
    const totalWeight = detailEntries.reduce((sum, [, value]) => sum + Math.abs(value), 0);

    if (totalWeight <= 0) {
      summaryRows.push({
        dimensao: detailEntries[0]?.[0] || 'Sem Dimensao',
        origemRecurso,
        valor: saldo.valor,
      });
      return;
    }

    let allocatedValue = 0;

    detailEntries.forEach(([dimensao, value], index) => {
      const isLast = index === detailEntries.length - 1;
      const proportionalValue = isLast
        ? saldo.valor - allocatedValue
        : saldo.valor * (Math.abs(value) / totalWeight);

      allocatedValue += proportionalValue;

      summaryRows.push({
        dimensao,
        origemRecurso,
        valor: proportionalValue,
      });
    });
  });

  return aggregateRows(summaryRows);
};

export const getFilteredDescentralizacaoSummaryTotal = ({
  rows,
  filterDimensao,
  filterOrigem,
}: {
  rows: DescentralizacaoResumoRow[];
  filterDimensao: string;
  filterOrigem: string;
}) =>
  rows
    .filter((row) => {
      const matchesDimensao = matchesDimensionFilter({
        dimensionValue: row.dimensao,
        filterValue: filterDimensao,
      });
      const matchesOrigem = filterOrigem === 'all' || row.origemRecurso === filterOrigem;

      return matchesDimensao && matchesOrigem;
    })
    .reduce((sum, row) => sum + row.valor, 0);
