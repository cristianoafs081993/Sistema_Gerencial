export type SuapPlanActivity = {
  suapActivityId: string;
  dimensao: string;
  atividade: string;
  componenteFuncional: string;
  origemRecurso: string;
  origemRecursoRaw: string;
  planoInterno: string;
  valorTotal: number;
  rawData: Record<string, string>;
};

export type SuapPlanParseResult = {
  activities: SuapPlanActivity[];
  dimensions: string[];
};

type HtmlParserConstructor = new () => { parseFromString: (html: string, type: string) => Document | null };

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function foldText(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseCurrency(value: string): number {
  const normalized = normalizeText(value).replace(/[^\d,.-]/g, '');
  if (!normalized) return 0;

  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');
  let canonical = normalized;
  if (commaIndex >= 0 && (dotIndex < 0 || commaIndex > dotIndex)) {
    canonical = normalized.replace(/\./g, '').replace(',', '.');
  } else if (dotIndex >= 0 && commaIndex < 0 && /\.\d{1,2}$/.test(normalized)) {
    canonical = normalized;
  } else {
    canonical = normalized.replace(/,/g, '');
  }

  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function extractDimension(value: string): string | null {
  const text = normalizeText(value);
  const match = text.match(/\b([A-Z]{2})\s*-\s*([^|\n]+)/i);
  if (!match) return null;
  return `${match[1].toUpperCase()} - ${normalizeText(match[2])}`;
}

function parseSuapActivityId(row: HTMLTableRowElement): string | null {
  const link = row.querySelector<HTMLAnchorElement>('a[href*="/plan_estrategico/listar_requisicoes_despesa/8/"]');
  const href = link?.getAttribute('href') ?? '';
  const match = href.match(/\/plan_estrategico\/listar_requisicoes_despesa\/8\/(\d+)\/?/);
  return match?.[1] ?? null;
}

function findColumn(headers: string[], ...needles: string[]): number {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function findDimensionForTable(table: HTMLTableElement): string {
  let ancestor = table.parentElement;
  while (ancestor) {
    const directHeading = Array.from(ancestor.children)
      .filter((child) => /^H[1-6]$/.test(child.tagName))
      .map((child) => extractDimension(child.textContent ?? ''))
      .find((value): value is string => Boolean(value));
    if (directHeading) return directHeading;

    ancestor = ancestor.parentElement;
  }

  let current: Element | null = table;
  while (current?.parentElement) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      const siblingHeading = Array.from(sibling.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .map((heading) => extractDimension(heading.textContent ?? ''))
        .filter((value): value is string => Boolean(value))
        .at(-1);
      if (siblingHeading) return siblingHeading;
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return '';
}

export function parseSuapPlanHtml(html: string, Parser: HtmlParserConstructor = DOMParser): SuapPlanParseResult {
  const parser = new Parser();
  const document = parser.parseFromString(html, 'text/html');
  if (!document) throw new Error('HTML do SUAP inválido.');
  if (document.querySelector('form[action*="/accounts/login/"], input[type="password"]')) {
    throw new Error('Sessão do SUAP expirada.');
  }

  const activities: SuapPlanActivity[] = [];
  const dimensions = new Set<string>();
  const seenIds = new Set<string>();
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table'));

  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th')).map((cell) => foldText(cell.textContent ?? ''));
    const activityIndex = findColumn(headers, 'atividade');
    const updatedValueIndex = findColumn(headers, 'valor atualizado da atividade');
    if (activityIndex < 0 || updatedValueIndex < 0) continue;

    const origemIndex = findColumn(headers, 'origem de recurso');
    const planoIndex = findColumn(headers, 'plano interno');
    const componenteIndex = findColumn(headers, 'componente funcional');
    const tableBodies = table.tBodies ? Array.from(table.tBodies) : [];
    const rows = (tableBodies.length ? tableBodies : [table]).flatMap((body) =>
      Array.from(body.querySelectorAll<HTMLTableRowElement>('tr')),
    );

    const dimension = findDimensionForTable(table) || extractDimension(table.parentElement?.textContent ?? '') || '';
    if (dimension) dimensions.add(dimension);

    for (const row of rows) {
      const suapActivityId = parseSuapActivityId(row);
      if (!suapActivityId) continue;
      if (seenIds.has(suapActivityId)) throw new Error(`Atividade SUAP duplicada: ${suapActivityId}.`);

      const rowCells = row.cells ? Array.from(row.cells) : Array.from(row.querySelectorAll('td, th'));
      const cells = rowCells.map((cell) => normalizeText(cell.textContent));
      const atividade = cells[activityIndex] ?? '';
      if (!atividade || foldText(atividade) === 'total') continue;
      const origemRecursoRaw = cells[origemIndex] ?? '';
      const origemRecurso = origemRecursoRaw.match(/\b\d{6}\b/)?.[0] ?? origemRecursoRaw;

      seenIds.add(suapActivityId);
      activities.push({
        suapActivityId,
        dimensao: dimension || 'Não informada',
        atividade,
        componenteFuncional: cells[componenteIndex] || '-',
        origemRecurso,
        origemRecursoRaw,
        planoInterno: cells[planoIndex] ?? '',
        valorTotal: parseCurrency(cells[updatedValueIndex] ?? ''),
        rawData: {
          atividade,
          dimensao: dimension,
          componenteFuncional: cells[componenteIndex] ?? '',
          origemRecurso: origemRecursoRaw,
          planoInterno: cells[planoIndex] ?? '',
          valorAtualizado: cells[updatedValueIndex] ?? '',
        },
      });
    }
  }

  if (activities.length === 0) throw new Error('Nenhuma atividade do Plano 8 foi encontrada no SUAP.');
  if (dimensions.size < 1) throw new Error('Nenhuma dimensão do Plano 8 foi encontrada no SUAP.');

  return { activities, dimensions: Array.from(dimensions) };
}

export function canonicalSuapPlanSourceKey(planId: number, activityId: string): string {
  return `suap:${planId}:${activityId}`;
}
