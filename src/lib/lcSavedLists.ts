export type LcSavedList<Row = unknown> = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourcePdfNames: string[];
  rows: Row[];
};

type SaveLcListInput<Row> = {
  id?: string | null;
  name: string;
  sourcePdfNames: string[];
  rows: Row[];
};

const STORAGE_KEY = 'lc:work-lists:v1';

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `lc-list-${crypto.randomUUID()}`;
  }

  return `lc-list-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isSavedList(value: unknown): value is LcSavedList {
  if (!value || typeof value !== 'object') return false;

  const list = value as Partial<LcSavedList>;
  return (
    typeof list.id === 'string' &&
    typeof list.name === 'string' &&
    typeof list.createdAt === 'string' &&
    typeof list.updatedAt === 'string' &&
    Array.isArray(list.sourcePdfNames) &&
    list.sourcePdfNames.every((name) => typeof name === 'string') &&
    Array.isArray(list.rows)
  );
}

export function loadLcSavedLists<Row = unknown>(): LcSavedList<Row>[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isSavedList)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) as LcSavedList<Row>[];
  } catch (error) {
    console.warn('Erro ao ler listas de trabalho da LC', error);
    return [];
  }
}

export function saveLcSavedList<Row>(input: SaveLcListInput<Row>): LcSavedList<Row> {
  if (typeof window === 'undefined') {
    throw new Error('O salvamento de listas da LC exige um navegador.');
  }

  const name = input.name.trim() || 'Lista de trabalho';
  const now = new Date().toISOString();
  const lists = loadLcSavedLists<Row>();
  const existing = input.id ? lists.find((list) => list.id === input.id) : undefined;
  const savedList: LcSavedList<Row> = {
    id: existing?.id || createId(),
    name,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    sourcePdfNames: [...input.sourcePdfNames],
    rows: input.rows,
  };
  const nextLists = [savedList, ...lists.filter((list) => list.id !== savedList.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLists));
  return savedList;
}

export function deleteLcSavedList(id: string) {
  if (typeof window === 'undefined') return;

  const nextLists = loadLcSavedLists().filter((list) => list.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLists));
}
