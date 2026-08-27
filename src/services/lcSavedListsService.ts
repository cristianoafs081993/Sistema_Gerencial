import { supabase } from '@/lib/supabase';
import type { LcSavedList } from '@/lib/lcSavedLists';

const SAVED_LIST_SELECT = 'id,name,created_at,updated_at,source_pdf_names,rows';

type LcSavedListDbRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  source_pdf_names: unknown;
  rows: unknown;
};

export type SaveSharedLcListInput<Row = unknown> = {
  id?: string | null;
  name: string;
  sourcePdfNames: string[];
  rows: Row[];
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function mapSavedList<Row = unknown>(row: LcSavedListDbRow): LcSavedList<Row> {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourcePdfNames: stringArray(row.source_pdf_names),
    rows: (Array.isArray(row.rows) ? row.rows : []) as Row[],
  };
}

export async function loadSharedLcSavedLists<Row = unknown>(): Promise<LcSavedList<Row>[]> {
  const { data, error } = await supabase
    .from('lc_saved_lists')
    .select(SAVED_LIST_SELECT)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as LcSavedListDbRow[]).map(mapSavedList);
}

export async function saveSharedLcSavedList<Row = unknown>(
  input: SaveSharedLcListInput<Row>,
): Promise<LcSavedList<Row>> {
  const payload = {
    name: input.name.trim() || 'Lista de trabalho',
    source_pdf_names: [...input.sourcePdfNames],
    rows: input.rows,
  };

  const query = input.id
    ? supabase.from('lc_saved_lists').update(payload).eq('id', input.id).select(SAVED_LIST_SELECT).single()
    : supabase.from('lc_saved_lists').insert(payload).select(SAVED_LIST_SELECT).single();

  const { data, error } = await query;
  if (error) throw error;
  return mapSavedList<Row>(data as unknown as LcSavedListDbRow);
}

export async function deleteSharedLcSavedList(id: string): Promise<void> {
  const { error } = await supabase.from('lc_saved_lists').delete().eq('id', id);
  if (error) throw error;
}
