import { supabase } from '@/lib/supabase';
import type {
  RequisicaoCompra,
  RequisicaoCompraEmpenho,
  RequisicaoCompraItem,
  RequisicaoCompraRecord,
  TerceirizadoPermission,
  Terceirizado,
} from '@/types';

type DbRequisicaoCompraRow = {
  id: string;
  title: string;
  number: string;
  process_number: string | null;
  contrato_id: string | null;
  contrato_numero: string | null;
  empenho_id: string | null;
  empenho_numero: string | null;
  requisicao_compra_empenhos?: DbRequisicaoCompraEmpenhoRow[] | null;
  notes: string | null;
  status: RequisicaoCompra['status'];
  created_by: string;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

type DbRequisicaoCompraItemRow = {
  id: string;
  requisicao_compra_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  empenho_id: string | null;
  empenho_numero: string | null;
  source_type: string | null;
  source_item_key: string | null;
  source_reference: string | null;
  source_snapshot: Record<string, unknown> | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type DbRequisicaoCompraEmpenhoRow = {
  id: string;
  requisicao_compra_id: string;
  empenho_id: string;
  empenho_numero: string | null;
  sort_order: number;
};

type DbPermissionRow = {
  id: string;
  user_id: string | null;
  user_email: string;
  user_matricula: string | null;
  contrato_id: string | null;
  empenho_id: string | null;
  created_by: string;
  created_at: string;
};

const REQUISICAO_SELECT = [
  'id',
  'title',
  'number',
  'process_number',
  'contrato_id',
  'contrato_numero',
  'empenho_id',
  'empenho_numero',
  'requisicao_compra_empenhos(id,requisicao_compra_id,empenho_id,empenho_numero,sort_order)',
  'notes',
  'status',
  'created_by',
  'created_by_email',
  'created_at',
  'updated_at',
].join(',');

function mapRequisicaoEmpenhoRow(row: DbRequisicaoCompraEmpenhoRow): RequisicaoCompraEmpenho {
  return {
    id: row.id,
    requisicaoCompraId: row.requisicao_compra_id,
    empenhoId: row.empenho_id,
    empenhoNumero: row.empenho_numero || '',
    sortOrder: row.sort_order,
  };
}

function mapRequisicaoRow(row: DbRequisicaoCompraRow): RequisicaoCompra {
  const linkedEmpenhos = (row.requisicao_compra_empenhos || []).map((item) => mapRequisicaoEmpenhoRow(item));
  const empenhos = linkedEmpenhos.length > 0
    ? linkedEmpenhos.sort((a, b) => a.sortOrder - b.sortOrder)
    : row.empenho_id
      ? [{
          empenhoId: row.empenho_id,
          empenhoNumero: row.empenho_numero || '',
          sortOrder: 0,
        }]
      : [];

  return {
    id: row.id,
    title: row.title,
    number: row.number,
    processNumber: row.process_number || undefined,
    contratoId: row.contrato_id || undefined,
    contratoNumero: row.contrato_numero || undefined,
    empenhoId: row.empenho_id || undefined,
    empenhoNumero: row.empenho_numero || undefined,
    empenhos,
    notes: row.notes || undefined,
    status: row.status,
    createdBy: row.created_by,
    createdByEmail: row.created_by_email,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapItemRow(row: DbRequisicaoCompraItemRow): RequisicaoCompraItem {
  return {
    id: row.id,
    requisicaoCompraId: row.requisicao_compra_id,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    empenhoId: row.empenho_id || undefined,
    empenhoNumero: row.empenho_numero || undefined,
    sourceType: row.source_type as RequisicaoCompraItem['sourceType'] || undefined,
    sourceItemKey: row.source_item_key || undefined,
    sourceReference: row.source_reference || undefined,
    sourceSnapshot: row.source_snapshot || undefined,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapPermissionRow(row: DbPermissionRow): TerceirizadoPermission {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    userEmail: row.user_email,
    userMatricula: row.user_matricula || undefined,
    contratoId: row.contrato_id || undefined,
    empenhoId: row.empenho_id || undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
  };
}

export const requisicoesCompraService = {
  async listRecentRequisicoes(): Promise<RequisicaoCompra[]> {
    const { data, error } = await supabase
      .from('requisicoes_compra')
      .select(REQUISICAO_SELECT)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapRequisicaoRow(row as DbRequisicaoCompraRow));
  },

  async getRequisicaoById(id: string): Promise<RequisicaoCompraRecord | null> {
    const [{ data: requisicao, error: reqError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from('requisicoes_compra').select(REQUISICAO_SELECT).eq('id', id).maybeSingle(),
      supabase.from('requisicao_compra_itens').select('*').eq('requisicao_compra_id', id).order('sort_order'),
    ]);

    if (reqError) throw reqError;
    if (itemsError) throw itemsError;
    if (!requisicao) return null;

    return {
      ...mapRequisicaoRow(requisicao as DbRequisicaoCompraRow),
      items: (items || []).map((row) => mapItemRow(row as DbRequisicaoCompraItemRow)),
    };
  },

  async saveRequisicao(
    data: Omit<RequisicaoCompra, 'id' | 'createdBy' | 'createdByEmail' | 'createdAt' | 'updatedAt'>,
    items: Omit<RequisicaoCompraItem, 'id' | 'requisicaoCompraId' | 'createdAt' | 'updatedAt'>[],
    options: { id?: string; status?: RequisicaoCompra['status'] } = {},
  ): Promise<string> {
    const payload = {
      title: data.title || 'Requisição de Compra',
      number: data.number,
      processNumber: data.processNumber || null,
      contratoId: data.contratoId || null,
      contratoNumero: data.contratoNumero || null,
      empenhoId: data.empenhoId || null,
      empenhoNumero: data.empenhoNumero || null,
      empenhos: data.empenhos || [],
      notes: data.notes || null,
      status: options.status ?? data.status ?? 'draft',
    };

    const itemRows = items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'UN',
      unitPrice: item.unitPrice,
      empenhoId: item.empenhoId || null,
      empenhoNumero: item.empenhoNumero || null,
      sourceType: item.sourceType || 'manual',
      sourceItemKey: item.sourceItemKey || null,
      sourceReference: item.sourceReference || null,
      sourceSnapshot: item.sourceSnapshot || null,
    }));

    const { data: requisicaoId, error } = await supabase.rpc('save_requisicao_compra', {
      p_requisicao: payload,
      p_items: itemRows,
      p_id: options.id || null,
    });
    if (error) throw error;

    return requisicaoId;
  },

  async deleteRequisicao(id: string): Promise<void> {
    const { error } = await supabase.from('requisicoes_compra').delete().eq('id', id);
    if (error) throw error;
  },

  async listTerceirizados(): Promise<Terceirizado[]> {
    const { data, error } = await supabase
      .from('terceirizados')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id || undefined,
      name: row.name,
      matricula: row.matricula || '',
      email: row.email || undefined,
      tipo: row.tipo as 'limpeza_manutencao' | 'refeitorio',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  },

  async saveTerceirizado(
    data: Omit<Terceirizado, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; previousMatricula?: string }
  ): Promise<string> {
    const payload = {
      name: data.name,
      matricula: data.matricula,
      email: data.email || null,
      tipo: data.tipo,
      user_id: data.userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabase.from('terceirizados').update(payload).eq('id', data.id);
      if (error) throw error;

      const permissionIdentityPayload = {
        user_matricula: data.matricula,
        user_id: data.userId || null,
      };

      if (data.previousMatricula && data.previousMatricula !== data.matricula) {
        const { error: permissionError } = await supabase
          .from('terceirizado_permissions')
          .update(permissionIdentityPayload)
          .eq('user_matricula', data.previousMatricula);
        if (permissionError) throw permissionError;
      }

      if (data.userId) {
        const { error: permissionError } = await supabase
          .from('terceirizado_permissions')
          .update(permissionIdentityPayload)
          .eq('user_id', data.userId);
        if (permissionError) throw permissionError;
      }

      if (data.email) {
        const { error: permissionError } = await supabase
          .from('terceirizado_permissions')
          .update(permissionIdentityPayload)
          .eq('user_email', data.email);
        if (permissionError) throw permissionError;
      }

      return data.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('terceirizados')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      return inserted.id;
    }
  },

  async deleteTerceirizado(id: string): Promise<void> {
    const { error } = await supabase.from('terceirizados').delete().eq('id', id);
    if (error) throw error;
  },

  async listPermissions(): Promise<TerceirizadoPermission[]> {
    const { data, error } = await supabase
      .from('terceirizado_permissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapPermissionRow(row as DbPermissionRow));
  },

  async addPermission(
    matricula: string,
    type: 'contrato' | 'empenho',
    entityId: string,
    userId?: string,
    email?: string,
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      user_id: userId || null,
      user_matricula: matricula,
      user_email: email || '',
    };

    if (type === 'contrato') {
      payload.contrato_id = entityId;
      payload.empenho_id = null;
    } else {
      payload.contrato_id = null;
      payload.empenho_id = entityId;
    }

    const { error } = await supabase.from('terceirizado_permissions').insert(payload);
    if (error) throw error;
  },

  async removePermission(id: string): Promise<void> {
    const { error } = await supabase.from('terceirizado_permissions').delete().eq('id', id);
    if (error) throw error;
  },
};
