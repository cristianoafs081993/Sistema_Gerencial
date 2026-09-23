import { supabase } from '@/lib/supabase';

export type PortariaEventoTipo =
  | 'academico'
  | 'cultural'
  | 'esportivo'
  | 'reuniao'
  | 'palestra'
  | 'externo'
  | 'outro';

export type PortariaEventoStatus = 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado';

export interface PortariaEvento {
  id: string;
  org_id?: string | null;
  campus_uasg: string;
  titulo: string;
  descricao?: string | null;
  local: string;
  ambiente_id?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  responsavel_nome?: string | null;
  responsavel_contato?: string | null;
  tipo: PortariaEventoTipo;
  status: PortariaEventoStatus;
  observacoes_portaria?: string | null;
  created_at: string;
  updated_at: string;
  total_participantes?: number;
  total_presentes?: number;
}

export interface PortariaParticipante {
  id: string;
  evento_id: string;
  nome: string;
  documento?: string | null;
  instituicao?: string | null;
  tipo: 'participante' | 'palestrante' | 'organizador' | 'autoridade' | 'convidado';
  presente: boolean;
  horario_entrada?: string | null;
  veiculo_placa?: string | null;
  observacao?: string | null;
  created_at: string;
}

export type CreateEventoPayload = {
  titulo: string;
  descricao?: string | null;
  local: string;
  ambiente_id?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  responsavel_nome?: string | null;
  responsavel_contato?: string | null;
  tipo: PortariaEventoTipo;
  status?: PortariaEventoStatus;
  observacoes_portaria?: string | null;
  campus_uasg?: string;
};

export type CreateParticipantePayload = {
  evento_id: string;
  nome: string;
  documento?: string | null;
  instituicao?: string | null;
  tipo?: 'participante' | 'palestrante' | 'organizador' | 'autoridade' | 'convidado';
  veiculo_placa?: string | null;
  observacao?: string | null;
};

export const portariaEventosService = {
  async listEventos(campusUasg = '158366'): Promise<PortariaEvento[]> {
    const { data, error } = await supabase
      .from('portaria_eventos')
      .select(`
        *,
        portaria_evento_participantes (
          id,
          presente
        )
      `)
      .eq('campus_uasg', campusUasg)
      .order('data_inicio', { ascending: true });

    if (error) throw error;

    return (data || []).map((row: any) => {
      const participantes = Array.isArray(row.portaria_evento_participantes)
        ? row.portaria_evento_participantes
        : [];
      const total_participantes = participantes.length;
      const total_presentes = participantes.filter((p: any) => p.presente === true).length;

      return {
        ...row,
        total_participantes,
        total_presentes,
      };
    });
  },

  async getEvento(id: string): Promise<PortariaEvento | null> {
    const { data, error } = await supabase
      .from('portaria_eventos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async createEvento(payload: CreateEventoPayload): Promise<PortariaEvento> {
    const { data, error } = await supabase
      .from('portaria_eventos')
      .insert({
        campus_uasg: payload.campus_uasg || '158366',
        titulo: payload.titulo,
        descricao: payload.descricao || null,
        local: payload.local,
        ambiente_id: payload.ambiente_id || null,
        data_inicio: payload.data_inicio,
        data_fim: payload.data_fim || null,
        responsavel_nome: payload.responsavel_nome || null,
        responsavel_contato: payload.responsavel_contato || null,
        tipo: payload.tipo || 'academico',
        status: payload.status || 'confirmado',
        observacoes_portaria: payload.observacoes_portaria || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEvento(id: string, payload: Partial<CreateEventoPayload>): Promise<PortariaEvento> {
    const { data, error } = await supabase
      .from('portaria_eventos')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEvento(id: string): Promise<void> {
    const { error } = await supabase
      .from('portaria_eventos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async listParticipantes(eventoId: string): Promise<PortariaParticipante[]> {
    const { data, error } = await supabase
      .from('portaria_evento_participantes')
      .select('*')
      .eq('evento_id', eventoId)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createParticipante(payload: CreateParticipantePayload): Promise<PortariaParticipante> {
    const { data, error } = await supabase
      .from('portaria_evento_participantes')
      .insert({
        evento_id: payload.evento_id,
        nome: payload.nome.trim(),
        documento: payload.documento?.trim() || null,
        instituicao: payload.instituicao?.trim() || null,
        tipo: payload.tipo || 'participante',
        veiculo_placa: payload.veiculo_placa?.trim().toUpperCase() || null,
        observacao: payload.observacao?.trim() || null,
        presente: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async batchCreateParticipantes(
    eventoId: string,
    items: Array<{
      nome: string;
      documento?: string | null;
      instituicao?: string | null;
      tipo?: string;
      veiculo_placa?: string | null;
      observacao?: string | null;
    }>
  ): Promise<number> {
    if (!items.length) return 0;

    const rows = items.map((item) => ({
      evento_id: eventoId,
      nome: item.nome.trim(),
      documento: item.documento?.trim() || null,
      instituicao: item.instituicao?.trim() || null,
      tipo: item.tipo || 'participante',
      veiculo_placa: item.veiculo_placa?.trim().toUpperCase() || null,
      observacao: item.observacao?.trim() || null,
      presente: false,
    }));

    const { data, error } = await supabase
      .from('portaria_evento_participantes')
      .insert(rows)
      .select('id');

    if (error) throw error;
    return data?.length || 0;
  },

  async togglePresenca(participanteId: string, presente: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('portaria_evento_participantes')
      .update({
        presente,
        horario_entrada: presente ? new Date().toISOString() : null,
      })
      .eq('id', participanteId);

    if (error) throw error;
    return true;
  },

  async deleteParticipante(id: string): Promise<void> {
    const { error } = await supabase
      .from('portaria_evento_participantes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
