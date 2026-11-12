import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { LcSavedList, LcSavedListExtraction, LcSavedListOrigin } from '@/lib/lcSavedLists';

const SAVED_LIST_SELECT = 'id,name,created_at,updated_at,source_pdf_names,rows,suap_id,process_number,origin,extraction';

type LcSavedListDbRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  source_pdf_names: unknown;
  rows: unknown;
  suap_id?: string | null;
  process_number?: string | null;
  origin?: string | null;
  extraction?: unknown;
};

export type SaveSharedLcListInput<Row = unknown> = {
  id?: string | null;
  name: string;
  sourcePdfNames: string[];
  rows: Row[];
  /** Somente listas montadas pela extensao a partir de um processo SUAP. */
  suapId?: string | null;
  processNumber?: string | null;
  origin?: LcSavedListOrigin;
  extraction?: LcSavedListExtraction | null;
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
    ...(row.suap_id ? { suapId: row.suap_id } : {}),
    ...(row.process_number ? { processNumber: row.process_number } : {}),
    ...(row.origin === 'extensao' ? { origin: 'extensao' as const } : {}),
    ...(row.extraction && typeof row.extraction === 'object' && !Array.isArray(row.extraction)
      ? { extraction: row.extraction as LcSavedListExtraction }
      : {}),
  };
}

export async function loadSharedLcSavedLists<Row = unknown>(
  client: SupabaseClient = supabase,
): Promise<LcSavedList<Row>[]> {
  const { data, error } = await client
    .from('lc_saved_lists')
    .select(SAVED_LIST_SELECT)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as LcSavedListDbRow[]).map(mapSavedList<Row>);
}

/** Lista montada para o processo SUAP no orgao do usuario, se existir. */
export async function findSharedLcSavedListBySuapId<Row = unknown>(
  suapId: string,
  client: SupabaseClient = supabase,
): Promise<LcSavedList<Row> | null> {
  const { data, error } = await client
    .from('lc_saved_lists')
    .select(SAVED_LIST_SELECT)
    .eq('suap_id', suapId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSavedList<Row>(data as unknown as LcSavedListDbRow) : null;
}

export async function saveSharedLcSavedList<Row = unknown>(
  input: SaveSharedLcListInput<Row>,
  client: SupabaseClient = supabase,
): Promise<LcSavedList<Row>> {
  const payload: Record<string, unknown> = {
    name: input.name.trim().slice(0, 160) || 'Lista de trabalho',
    source_pdf_names: [...input.sourcePdfNames],
    rows: input.rows,
  };
  if (input.suapId) payload.suap_id = input.suapId;
  if (input.processNumber) payload.process_number = input.processNumber;
  if (input.origin) payload.origin = input.origin;
  if (input.extraction !== undefined) payload.extraction = input.extraction;

  const query = input.id
    ? client.from('lc_saved_lists').update(payload).eq('id', input.id).select(SAVED_LIST_SELECT).single()
    : client.from('lc_saved_lists').insert(payload).select(SAVED_LIST_SELECT).single();

  const { data, error } = await query;
  if (error) throw error;
  return mapSavedList<Row>(data as unknown as LcSavedListDbRow);
}

export async function deleteSharedLcSavedList(id: string, client: SupabaseClient = supabase): Promise<void> {
  const { error } = await client.from('lc_saved_lists').delete().eq('id', id);
  if (error) throw error;
}
