export type RapHistoricoAnualInput = {
  ugExecutora: string;
  ugNome: string;
  ano: number;
  metrica: string;
  itemInformacaoCodigo: string;
  itemInformacaoNome: string;
  valor: number;
};

export type RapHistoricoAnualEvolutionRow = {
  ano: number;
  processadoInscrito: number;
  naoProcessadoInscrito: number;
  naoProcessadoReinscrito: number;
  total: number;
};

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
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

const findHeaderIndex = (headers: string[], predicate: (header: string) => boolean) =>
  headers.findIndex((header) => predicate(header));

export function parseRapHistoricoAnualTable(rows: unknown[][]): RapHistoricoAnualInput[] {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    const hasUg = headers.some((h) => 
      h === 'ugexecutora' || 
      h === 'ug' || 
      h.includes('ugexec') || 
      (h.includes('unidade') && h.includes('executora'))
    );
    const hasAno = headers.some((h) => 
      (h.includes('ano') && !h.includes('plano')) || 
      h.includes('exercicio') || 
      h.includes('exer')
    );
    const hasMetrica = headers.some((h) => h.includes('metrica'));
    const hasItem = headers.some((h) => 
      h.includes('iteminformacao') || 
      (h.includes('item') && h.includes('informacao'))
    );

    return hasUg && hasAno && hasMetrica && hasItem;
  });

  if (headerRowIndex === -1) {
    throw new Error('Nao foi possivel localizar as colunas do historico anual de RAP.');
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const ugIndex = findHeaderIndex(headers, (header) => 
    header === 'ugexecutora' || 
    header === 'ug' || 
    header.includes('ugexec') || 
    (header.includes('unidade') && header.includes('executora'))
  );
  const ugNameIndex = ugIndex + 1;
  const anoIndex = findHeaderIndex(headers, (header) => 
    (header.includes('ano') && !header.includes('plano')) || 
    header.includes('exercicio') || 
    header.includes('exer')
  );
  const metricaIndex = findHeaderIndex(headers, (header) => header.includes('metrica'));
  const itemCodigoIndex = findHeaderIndex(headers, (header) => 
    (header.includes('iteminformacao') || (header.includes('item') && header.includes('informacao'))) &&
    !header.includes('desc') && 
    !header.includes('nome')
  );
  
  // Find description column dynamically
  let itemNomeIndex = findHeaderIndex(headers, (header) => 
    (header.includes('iteminformacao') || (header.includes('item') && header.includes('informacao'))) &&
    (header.includes('desc') || header.includes('nome'))
  );
  if (itemNomeIndex < 0) {
    const secondItemIndex = headers.findIndex((header, idx) => 
      idx > itemCodigoIndex && 
      (header.includes('iteminformacao') || (header.includes('item') && header.includes('informacao')))
    );
    itemNomeIndex = secondItemIndex >= 0 ? secondItemIndex : itemCodigoIndex + 1;
  }

  const namedValorIndex = findHeaderIndex(headers, (header) => header === 'valor' || header.includes('saldo'));
  const valorIndex = namedValorIndex >= 0 ? namedValorIndex : itemNomeIndex + 1;

  if ([ugIndex, anoIndex, metricaIndex, itemCodigoIndex, valorIndex].some((index) => index < 0)) {
    throw new Error('Cabecalho do historico anual de RAP incompleto.');
  }

  const parsedRows = rows
    .slice(headerRowIndex + 1)
    .map((row): RapHistoricoAnualInput | null => {
      const ugExecutora = normalizeText(row[ugIndex]);
      const anoRaw = normalizeText(row[anoIndex]);
      const itemInformacaoCodigo = normalizeText(row[itemCodigoIndex]);
      const itemInformacaoNome = normalizeText(row[itemNomeIndex]);
      const valor = parseCurrencyBR(row[valorIndex]);
      const ano = Number(anoRaw);

      if (!ugExecutora || ugExecutora.toLowerCase() === 'total') return null;
      if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) return null;
      if (!itemInformacaoCodigo || itemInformacaoCodigo.toLowerCase() === 'total') return null;
      if (!itemInformacaoNome || valor == null) return null;

      return {
        ugExecutora,
        ugNome: normalizeText(row[ugNameIndex]),
        ano,
        metrica: normalizeText(row[metricaIndex]),
        itemInformacaoCodigo,
        itemInformacaoNome,
        valor,
      };
    })
    .filter((row): row is RapHistoricoAnualInput => row !== null);

  if (parsedRows.length === 0) {
    throw new Error('Nenhuma linha valida foi encontrada no historico anual de RAP.');
  }

  return parsedRows;
}

export function buildRapHistoricoAnualEvolution(
  rows: RapHistoricoAnualInput[],
  ugExecutora: string,
): RapHistoricoAnualEvolutionRow[] {
  const groupedRows = new Map<number, RapHistoricoAnualEvolutionRow & { explicitTotal?: number }>();

  rows
    .filter((row) => row.ugExecutora === ugExecutora)
    .forEach((row) => {
      const current =
        groupedRows.get(row.ano) ||
        ({
          ano: row.ano,
          processadoInscrito: 0,
          naoProcessadoInscrito: 0,
          naoProcessadoReinscrito: 0,
          total: 0,
        } as RapHistoricoAnualEvolutionRow & { explicitTotal?: number });

      if (row.itemInformacaoCodigo === '35') current.processadoInscrito += row.valor;
      if (row.itemInformacaoCodigo === '40') current.naoProcessadoInscrito += row.valor;
      if (row.itemInformacaoCodigo === '41') current.naoProcessadoReinscrito += row.valor;
      if (row.itemInformacaoCodigo === '50') current.explicitTotal = (current.explicitTotal || 0) + row.valor;

      groupedRows.set(row.ano, current);
    });

  return Array.from(groupedRows.values())
    .map((row) => {
      const componentTotal = row.processadoInscrito + row.naoProcessadoInscrito + row.naoProcessadoReinscrito;
      const total = row.explicitTotal != null ? row.explicitTotal : componentTotal;
      const { explicitTotal, ...publicRow } = row;
      return { ...publicRow, total };
    })
    .sort((left, right) => left.ano - right.ano);
}
