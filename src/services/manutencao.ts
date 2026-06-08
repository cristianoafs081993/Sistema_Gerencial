import { supabase } from '@/lib/supabase';

export interface Ambiente {
  id: string;
  codigo: string;
  nome: string;
  bloco: string | null;
  tipo: 'sala' | 'banheiro' | 'laboratorio' | 'corredor' | 'outros';
  status: 'ativo' | 'inativo';
  created_at: string;
}

export interface Ocorrencia {
  id: string;
  ambiente_id: string;
  respondente_tipo: string;
  avaliacao: number;
  problemas: string[];
  observacao: string | null;
  status: 'pendente' | 'em_andamento' | 'resolvido' | 'arquivado';
  resolvido_em: string | null;
  resolvido_por: string | null;
  created_at: string;
  ambiente?: {
    nome: string;
    codigo: string;
  };
}

export interface Checkin {
  id: string;
  ambiente_id: string;
  responsavel_nome: string;
  acao_realizada: 'limpeza_padrao' | 'reposicao_insumos' | 'inspecao' | 'manutencao_corretiva';
  observacao: string | null;
  created_at: string;
  ambiente?: {
    nome: string;
    codigo: string;
  };
}

export const manutencaoService = {
  async getAmbientes(): Promise<Ambiente[]> {
    const { data, error } = await supabase
      .from('manutencao_ambientes')
      .select('*')
      .order('bloco', { ascending: true })
      .order('nome', { ascending: true });

    if (error) throw error;
    return (data || []) as Ambiente[];
  },

  async getAmbienteByCodigo(codigo: string): Promise<Ambiente | null> {
    const { data, error } = await supabase
      .from('manutencao_ambientes')
      .select('*')
      .eq('codigo', codigo.trim())
      .eq('status', 'ativo')
      .maybeSingle();

    if (error) throw error;
    return data as Ambiente | null;
  },

  async createAmbiente(payload: Omit<Ambiente, 'id' | 'created_at'>): Promise<Ambiente> {
    const { data, error } = await supabase
      .from('manutencao_ambientes')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Ambiente;
  },

  async deleteAmbiente(id: string): Promise<void> {
    const { error } = await supabase
      .from('manutencao_ambientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getOcorrencias(): Promise<Ocorrencia[]> {
    const { data, error } = await supabase
      .from('manutencao_ocorrencias')
      .select('*, ambiente:ambiente_id(nome, codigo)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Ocorrencia[];
  },

  async createOcorrencia(payload: Omit<Ocorrencia, 'id' | 'status' | 'resolvido_em' | 'resolvido_por' | 'created_at'>): Promise<Ocorrencia> {
    const { data, error } = await supabase
      .from('manutencao_ocorrencias')
      .insert({
        ...payload,
        status: 'pendente',
      })
      .select()
      .single();

    if (error) throw error;
    return data as Ocorrencia;
  },

  async resolveOcorrencia(id: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('manutencao_ocorrencias')
      .update({
        status: 'resolvido',
        resolvido_em: new Date().toISOString(),
        resolvido_por: userId || null,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async getCheckins(): Promise<Checkin[]> {
    const { data, error } = await supabase
      .from('manutencao_checkins')
      .select('*, ambiente:ambiente_id(nome, codigo)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Checkin[];
  },

  async createCheckin(payload: Omit<Checkin, 'id' | 'created_at'>): Promise<Checkin> {
    const { data, error } = await supabase
      .from('manutencao_checkins')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data as Checkin;
  },
};
