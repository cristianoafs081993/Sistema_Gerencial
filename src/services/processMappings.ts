import { DEFAULT_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPINGS } from '@/data/defaultProcessMapping';
import { supabase } from '@/lib/supabase';
import type { ProcessMappingDefinition, ProcessMappingPublicationStatus, ProcessMappingRecord } from '@/types/processMapping';

type ProcessMappingRow = {
  id: string;
  org_id?: string | null;
  code: string;
  title: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  status: ProcessMappingPublicationStatus;
  definition: ProcessMappingDefinition;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
};

const select = 'id,org_id,code,title,description,category,version,status,definition,created_at,updated_at,published_at';

function normalizeRow(row: ProcessMappingRow): ProcessMappingRecord {
  const definition = row.definition && typeof row.definition === 'object' ? row.definition : DEFAULT_PROCESS_MAPPING;
  return {
    ...definition,
    id: row.id || definition.id,
    code: row.code || definition.code,
    title: row.title || definition.title,
    description: row.description || definition.description,
    category: row.category || definition.category,
    version: row.version || definition.version,
    createdAt: row.created_at || definition.createdAt,
    updatedAt: row.updated_at || definition.updatedAt,
    publicationStatus: row.status,
    orgId: row.org_id || undefined,
    publishedAt: row.published_at || undefined,
  };
}

function fallbackById(id?: string | null) {
  if (!id) return DEFAULT_PROCESS_MAPPING;
  return DEFAULT_PROCESS_MAPPINGS.find((mapping) => mapping.id === id || mapping.code === id) || null;
}

export const processMappingsService = {
  async listPublished(): Promise<ProcessMappingRecord[]> {
    if (typeof (supabase as { from?: unknown }).from !== 'function') return DEFAULT_PROCESS_MAPPINGS;
    const { data, error } = await supabase
      .from('process_mappings')
      .select(select)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('processMappingsService.listPublished: usando mapa publicado local', error);
      return DEFAULT_PROCESS_MAPPINGS;
    }

    const records = ((data || []) as ProcessMappingRow[]).map(normalizeRow);
    return records.length ? records : DEFAULT_PROCESS_MAPPINGS;
  },

  async getById(id?: string | null): Promise<ProcessMappingRecord | null> {
    const fallback = fallbackById(id);
    if (!id) return fallback;
    if (fallback?.id === id) return fallback;
    if (typeof (supabase as { from?: unknown }).from !== 'function') return fallback;

    const { data, error } = await supabase
      .from('process_mappings')
      .select(select)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.warn('processMappingsService.getById: usando mapa publicado local', error);
      return fallback;
    }

    return data ? normalizeRow(data as ProcessMappingRow) : fallback;
  },
};
