import { DEFAULT_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPINGS } from '@/data/defaultProcessMapping';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
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

export const PROCESS_MAPPINGS_STORAGE_KEY = 'siages_process_mappings_v2';

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export function loadLocalStoredMappings(): ProcessMappingRecord[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(PROCESS_MAPPINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveLocalStoredMappings(processes: ProcessMappingRecord[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROCESS_MAPPINGS_STORAGE_KEY, JSON.stringify(processes));
  } catch {
    // ignore
  }
}

function normalizeRow(row: ProcessMappingRow): ProcessMappingRecord {
  const definition = row.definition && typeof row.definition === 'object' ? row.definition : DEFAULT_PROCESS_MAPPING;
  const canonicalId = definition.id || row.id;
  return {
    ...definition,
    id: canonicalId,
    code: row.code || definition.code,
    title: row.title || definition.title,
    description: row.description ?? definition.description,
    category: row.category ?? definition.category,
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
  const local = loadLocalStoredMappings().find((mapping) => mapping.id === id || mapping.code === id);
  if (local) return local;
  return DEFAULT_PROCESS_MAPPINGS.find((mapping) => mapping.id === id || mapping.code === id) || null;
}

export function mergePublishedMappings(
  remoteRecords: ProcessMappingRecord[],
  localMappings: ProcessMappingRecord[] = loadLocalStoredMappings(),
): ProcessMappingRecord[] {
  const localMap = new Map<string, ProcessMappingRecord>();
  localMappings.forEach((m) => localMap.set(m.id, m));

  const result: ProcessMappingRecord[] = [];
  const handledIds = new Set<string>();

  // 1. Process remote records (database)
  for (const remote of remoteRecords) {
    handledIds.add(remote.id);
    const local = localMap.get(remote.id);
    if (local) {
      const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
      const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      if (localTime >= remoteTime) {
        result.push(local);
      } else {
        result.push(remote);
      }
    } else {
      result.push(remote);
    }
  }

  // 2. Process local mappings not yet in remote records
  for (const local of localMappings) {
    if (!handledIds.has(local.id)) {
      handledIds.add(local.id);
      result.push(local);
    }
  }

  // 3. Fallback defaults not yet in result
  for (const def of DEFAULT_PROCESS_MAPPINGS) {
    if (!handledIds.has(def.id)) {
      handledIds.add(def.id);
      result.push(def);
    }
  }

  return result;
}

export const processMappingsService = {
  async listPublished(client: SupabaseClient = supabase): Promise<ProcessMappingRecord[]> {
    const localMappings = loadLocalStoredMappings();
    if (typeof (client as { from?: unknown }).from !== 'function') {
      return mergePublishedMappings([], localMappings);
    }

    try {
      const { data, error } = await client
        .from('process_mappings')
        .select(select)
        .eq('status', 'published')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('processMappingsService.listPublished: usando mapa local/padrão', error);
        return mergePublishedMappings([], localMappings);
      }

      const records = ((data || []) as ProcessMappingRow[]).map(normalizeRow);
      return mergePublishedMappings(records, localMappings);
    } catch (err) {
      console.warn('processMappingsService.listPublished: erro ao consultar Supabase, usando local', err);
      return mergePublishedMappings([], localMappings);
    }
  },

  async getById(id?: string | null): Promise<ProcessMappingRecord | null> {
    const fallback = fallbackById(id);
    if (!id) return fallback;

    const localMappings = loadLocalStoredMappings();
    const local = localMappings.find((m) => m.id === id || m.code === id);

    if (typeof (supabase as { from?: unknown }).from !== 'function') {
      return local || fallback;
    }

    try {
      const { data, error } = await supabase
        .from('process_mappings')
        .select(select)
        .or(`id.eq.${id},slug.eq.${id},code.eq.${id}`)
        .eq('status', 'published')
        .maybeSingle();

      if (error || !data) {
        return local || fallback;
      }

      const remote = normalizeRow(data as ProcessMappingRow);
      if (local) {
        const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
        const remoteTime = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
        return localTime >= remoteTime ? local : remote;
      }
      return remote;
    } catch {
      return local || fallback;
    }
  },

  async saveMapping(record: ProcessMappingRecord, client: SupabaseClient = supabase): Promise<void> {
    // 1. Sempre persiste localmente
    const currentList = loadLocalStoredMappings();
    const existingIdx = currentList.findIndex((m) => m.id === record.id);
    const nextList = existingIdx >= 0
      ? currentList.map((m, idx) => (idx === existingIdx ? record : m))
      : [...currentList, record];
    saveLocalStoredMappings(nextList);

    // 2. Persiste no Supabase se cliente disponível
    if (typeof (client as { from?: unknown }).from === 'function') {
      try {
        const idIsUuid = isUuid(record.id);
        const slug = record.id;
        const now = new Date().toISOString();
        const payload: Record<string, unknown> = {
          code: record.code,
          slug,
          title: record.title,
          description: record.description || null,
          category: record.category || null,
          version: record.version || '1.0',
          status: record.publicationStatus || 'published',
          definition: record,
          updated_at: record.updatedAt || now,
          published_at: record.publishedAt || (record.publicationStatus === 'published' ? now : null),
        };
        if (idIsUuid) {
          payload.id = record.id;
        }

        const { data: existing } = await client
          .from('process_mappings')
          .select('id')
          .eq('slug', slug)
          .eq('version', record.version || '1.0')
          .maybeSingle();

        if (existing?.id) {
          await client
            .from('process_mappings')
            .update(payload)
            .eq('id', existing.id);
        } else {
          await client
            .from('process_mappings')
            .insert(payload);
        }
      } catch (err) {
        console.warn('processMappingsService.saveMapping: salvo localmente, sincronização remota ignorada', err);
      }
    }
  },

  async saveAll(records: ProcessMappingRecord[], client: SupabaseClient = supabase): Promise<void> {
    saveLocalStoredMappings(records);
    for (const record of records) {
      void this.saveMapping(record, client);
    }
  },
};
