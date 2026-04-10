import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { Contrato } from '@/types';
import type { ContratoEmpenho } from '@/types';
const CONTRATOS_SELECT = 'id,numero,contratada,valor,data_inicio,data_termino,created_at,updated_at';
const CONTRATOS_EMPENHOS_SELECT = 'id,contrato_id,empenho_id,created_at';

type ContratoWriteRow = {
  numero: string;
  contratada?: string;
  valor?: number | null;
  data_inicio?: string | null;
  data_termino?: string | null;
};

type ContratoRow = {
  id: string;
  numero: string;
  contratada: string;
  valor?: number | string | null;
  data_inicio?: string | null;
  data_termino?: string | null;
  created_at: string;
  updated_at: string;
};

type ContratoEmpenhoRow = {
  id: string;
  contrato_id: string;
  empenho_id: string;
  created_at: string;
};

const mapContratoRow = (item: ContratoRow): Contrato => ({
  id: item.id,
  numero: item.numero,
  contratada: item.contratada || '',
  valor: item.valor != null ? Number(item.valor) : undefined,
  data_inicio: item.data_inicio ? new Date(item.data_inicio) : undefined,
  data_termino: item.data_termino ? new Date(item.data_termino) : undefined,
  created_at: new Date(item.created_at),
  updated_at: new Date(item.updated_at),
});

const mapContratoEmpenhoRow = (item: ContratoEmpenhoRow): ContratoEmpenho => ({
  id: item.id,
  contrato_id: item.contrato_id,
  empenho_id: item.empenho_id,
  created_at: new Date(item.created_at),
});

const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> =>
  Object.prototype.hasOwnProperty.call(value, key);

const toDateOnlyString = (value: Date | string | null | undefined): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
};

const chooseDate = (
  current: string | null | undefined,
  incoming: string | null | undefined,
  strategy: 'earliest' | 'latest',
): string | null | undefined => {
  if (incoming === undefined) return current;
  if (incoming === null) return current ?? null;
  if (!current) return incoming;

  if (strategy === 'earliest') {
    return incoming < current ? incoming : current;
  }

  return incoming > current ? incoming : current;
};

const buildContratoWriteRow = (item: Partial<Contrato>): ContratoWriteRow | null => {
  const numero = String(item.numero ?? '').trim();
  if (!numero) return null;

  const row: ContratoWriteRow = { numero };

  if (hasOwn(item, 'contratada')) {
    row.contratada = typeof item.contratada === 'string' ? item.contratada.trim() : '';
  }

  if (hasOwn(item, 'valor')) {
    if (item.valor === null || item.valor === undefined || item.valor === '') {
      row.valor = null;
    } else {
      const parsed = Number(item.valor);
      if (Number.isFinite(parsed)) {
        row.valor = parsed;
      }
    }
  }

  if (hasOwn(item, 'data_inicio')) {
    row.data_inicio = toDateOnlyString(item.data_inicio as Date | string | null | undefined);
  }

  if (hasOwn(item, 'data_termino')) {
    row.data_termino = toDateOnlyString(item.data_termino as Date | string | null | undefined);
  }

  return row;
};

const mergeContratoWriteRows = (current: ContratoWriteRow, incoming: ContratoWriteRow): ContratoWriteRow => {
  const merged: ContratoWriteRow = {
    numero: current.numero,
    contratada: current.contratada,
    valor: current.valor,
    data_inicio: current.data_inicio,
    data_termino: current.data_termino,
  };

  if (incoming.contratada !== undefined) {
    if (incoming.contratada !== '' || merged.contratada === undefined) {
      merged.contratada = incoming.contratada;
    }
  }

  if (incoming.valor !== undefined) {
    merged.valor = incoming.valor;
  }

  merged.data_inicio = chooseDate(merged.data_inicio, incoming.data_inicio, 'earliest');
  merged.data_termino = chooseDate(merged.data_termino, incoming.data_termino, 'latest');

  return merged;
};

const normalizeContratoWriteRows = (data: Partial<Contrato>[]): ContratoWriteRow[] => {
  const rowsByNumero = new Map<string, ContratoWriteRow>();

  for (const item of data) {
    const row = buildContratoWriteRow(item);
    if (!row) continue;

    const current = rowsByNumero.get(row.numero);
    rowsByNumero.set(row.numero, current ? mergeContratoWriteRows(current, row) : row);
  }

  return Array.from(rowsByNumero.values());
};

const buildContratoInsertPayload = (row: ContratoWriteRow) => {
  if (row.contratada === undefined) {
    throw new Error(`Nao foi possivel inserir o contrato ${row.numero} sem a coluna "contratada".`);
  }

  return {
    numero: row.numero,
    contratada: row.contratada,
    ...(row.valor !== undefined ? { valor: row.valor } : {}),
    ...(row.data_inicio !== undefined ? { data_inicio: row.data_inicio } : {}),
    ...(row.data_termino !== undefined ? { data_termino: row.data_termino } : {}),
  };
};

const buildContratoUpdatePayload = (row: ContratoWriteRow) => ({
  ...(row.contratada !== undefined ? { contratada: row.contratada } : {}),
  ...(row.valor !== undefined ? { valor: row.valor } : {}),
  ...(row.data_inicio !== undefined ? { data_inicio: row.data_inicio } : {}),
  ...(row.data_termino !== undefined ? { data_termino: row.data_termino } : {}),
});

const saveContratosBatchWithoutUpsert = async (rows: ContratoWriteRow[]) => {
  const numeros = Array.from(new Set(rows.map((row) => row.numero)));
  const { data: existingRows, error: existingError } = await supabase
    .from('contratos')
    .select('numero')
    .in('numero', numeros);

  if (existingError) throw existingError;

  const existingNumeros = new Set((existingRows ?? []).map((item) => item.numero as string));
  const rowsToInsert = rows
    .filter((row) => !existingNumeros.has(row.numero))
    .map(buildContratoInsertPayload);
  const rowsToUpdate = rows
    .filter((row) => existingNumeros.has(row.numero))
    .map((row) => ({ numero: row.numero, payload: buildContratoUpdatePayload(row) }))
    .filter((item) => Object.keys(item.payload).length > 0);

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('contratos')
      .insert(rowsToInsert);

    if (insertError) throw insertError;
  }

  for (const row of rowsToUpdate) {
    const { error: updateError } = await supabase
      .from('contratos')
      .update(row.payload)
      .eq('numero', row.numero);

    if (updateError) throw updateError;
  }
};

export const contratosService = {
  async getContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select(CONTRATOS_SELECT)
      .order('numero', { ascending: true });

    if (error) {
      console.warn('contratosService.getContratos: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<ContratoRow>('contratos', CONTRATOS_SELECT, {
        orderBy: 'numero',
        ascending: true,
      });
      return fallbackData.map(mapContratoRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<ContratoRow>('contratos', CONTRATOS_SELECT, {
        orderBy: 'numero',
        ascending: true,
      });
      return fallbackData.map(mapContratoRow);
    }

    return (data as ContratoRow[]).map(mapContratoRow);
  },

  async getContratosEmpenhos(): Promise<ContratoEmpenho[]> {
    const { data, error } = await supabase
      .from('contratos_empenhos')
      .select(CONTRATOS_EMPENHOS_SELECT);

    if (error) {
      console.warn('contratosService.getContratosEmpenhos: fallback para Supabase REST', error);
      const fallbackData = await fetchSupabaseRestRows<ContratoEmpenhoRow>('contratos_empenhos', CONTRATOS_EMPENHOS_SELECT);
      return fallbackData.map(mapContratoEmpenhoRow);
    }

    if (!data || data.length === 0) {
      const fallbackData = await fetchSupabaseRestRows<ContratoEmpenhoRow>('contratos_empenhos', CONTRATOS_EMPENHOS_SELECT);
      return fallbackData.map(mapContratoEmpenhoRow);
    }

    return (data as ContratoEmpenhoRow[]).map(mapContratoEmpenhoRow);
  },

  async upsertBatch(data: Partial<Contrato>[]) {
    const rows = normalizeContratoWriteRows(data);
    if (rows.length === 0) return;

    const { error } = await supabase
      .from('contratos')
      .upsert(rows, {
        onConflict: 'numero' 
      });

    if (!error) return;

    console.warn('contratosService.upsertBatch: fallback para insert/update manual', error);

    try {
      await saveContratosBatchWithoutUpsert(rows);
    } catch (fallbackError) {
      console.error('Error in contratosService.upsertBatch:', fallbackError);
      throw fallbackError;
    }
  },

  async linkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert({ contrato_id: contratoId, empenho_id: empenhoId }, {
        onConflict: 'contrato_id,empenho_id'
      });

    if (error) throw error;
  },

  async unlinkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .delete()
      .match({ contrato_id: contratoId, empenho_id: empenhoId });

    if (error) throw error;
  },

  async deleteByNumeros(numeros: string[]) {
    if (numeros.length === 0) return;
    const { error } = await supabase
      .from('contratos')
      .delete()
      .in('numero', numeros);
    if (error) throw error;
  },

  async upsertLinks(links: { contrato_id: string; empenho_id: string }[]) {
    if (links.length === 0) return;
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert(links, { onConflict: 'contrato_id,empenho_id' });
    if (error) throw error;
  },

  async getEmpenhos() {
    const { data, error } = await supabase
      .from('empenhos')
      .select('id, numero');
    if (error) throw error;
    return data as { id: string; numero: string }[];
  },
};
