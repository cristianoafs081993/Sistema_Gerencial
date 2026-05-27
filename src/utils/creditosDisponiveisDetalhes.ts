export type CreditoDisponivelDetalheInput = {
  ptres: string;
  planoInterno: string;
  descricao: string;
  metrica: string;
  valor: number;
};

export type CreditoDisponivelResumo = {
  ptres: string;
  metrica: string;
  valor: number;
};

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function parseCurrencyBR(value: unknown): number | null {
  const raw = String(value || '').replace(/R\$\s*/gi, '').replace(/\s/g, '').trim();
  if (!raw) return null;

  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) {
    normalized =
      raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
  } else if (raw.includes(',')) {
    normalized = raw.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCreditoDisponivelTable(rows: unknown[][]): CreditoDisponivelDetalheInput[] {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes('ptres') && headers.some((header) => header.includes('metrica'));
  });

  if (headerRowIndex === -1) {
    throw new Error('Nao foi possivel localizar as colunas PTRES e Metrica no arquivo de credito disponivel.');
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const ptresIndex = headers.findIndex((header) => header === 'ptres');
  const planoInternoIndex = headers.findIndex((header) => header === 'pi' || header.includes('planointerno'));
  const metricaIndex = headers.findIndex((header) => header.includes('metrica'));
  const namedDescricaoIndex = headers.findIndex((header) => header.includes('descricao'));
  const namedValorIndex = headers.findIndex(
    (header) => header === 'valor' || header.includes('valordisponivel') || header.includes('saldo'),
  );
  const descricaoIndex =
    namedDescricaoIndex >= 0
      ? namedDescricaoIndex
      : planoInternoIndex >= 0 && metricaIndex > planoInternoIndex + 1
        ? planoInternoIndex + 1
        : -1;
  const valorIndex = namedValorIndex >= 0 ? namedValorIndex : metricaIndex + 1;

  const parsedRows = rows
    .slice(headerRowIndex + 1)
    .map((row): CreditoDisponivelDetalheInput | null => {
      const ptres = String(row[ptresIndex] || '').trim();
      const valor = parseCurrencyBR(row[valorIndex]);
      if (!ptres || valor == null) return null;

      return {
        ptres,
        planoInterno: planoInternoIndex >= 0 ? String(row[planoInternoIndex] || '').trim() : '',
        descricao: descricaoIndex >= 0 ? String(row[descricaoIndex] || '').trim() : '',
        metrica: metricaIndex >= 0 ? String(row[metricaIndex] || '').trim() : '',
        valor,
      };
    })
    .filter((row): row is CreditoDisponivelDetalheInput => row !== null);

  if (parsedRows.length === 0) {
    throw new Error('Nenhuma linha valida foi encontrada no arquivo de credito disponivel.');
  }

  return parsedRows;
}

export function aggregateCreditoDisponivelRows(
  rows: CreditoDisponivelDetalheInput[],
): CreditoDisponivelResumo[] {
  const groupedRows = new Map<string, CreditoDisponivelResumo>();

  rows.forEach((row) => {
    const current = groupedRows.get(row.ptres);
    if (current) {
      current.valor += row.valor;
      if (!current.metrica && row.metrica) current.metrica = row.metrica;
      return;
    }

    groupedRows.set(row.ptres, {
      ptres: row.ptres,
      metrica: row.metrica,
      valor: row.valor,
    });
  });

  return Array.from(groupedRows.values()).sort((left, right) => left.ptres.localeCompare(right.ptres));
}
