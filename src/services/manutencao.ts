import { supabase } from '@/lib/supabase';

const OCORRENCIA_FOTOS_BUCKET = 'manutencao-ocorrencias';
export const OCORRENCIA_FOTO_MAX_BYTES = 5 * 1024 * 1024;
export const OCORRENCIA_FOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

const FOTO_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const validateOcorrenciaFoto = (file: Pick<File, 'size' | 'type'>) => {
  if (!FOTO_EXTENSION_BY_MIME[file.type]) {
    return 'Envie uma foto nos formatos JPEG, PNG ou WebP.';
  }

  if (file.size > OCORRENCIA_FOTO_MAX_BYTES) {
    return 'A foto deve ter no máximo 5 MB.';
  }

  return null;
};

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
  foto_path: string | null;
  foto_url?: string | null;
  status: 'pendente' | 'em_andamento' | 'resolvido' | 'arquivado';
  resolvido_em: string | null;
  resolvido_por: string | null;
  created_at: string;
  ambiente?: {
    nome: string;
    codigo: string;
    bloco: string | null;
  };
}

export interface Checkin {
  id: string;
  ambiente_id: string;
  responsavel_nome: string;
  acoes_realizadas: string[];
  observacao: string | null;
  created_at: string;
  ambiente?: {
    nome: string;
    codigo: string;
  };
  materiais?: {
    material: 'papel_higienico' | 'sabonete_liquido' | 'papel_toalha' | 'saco_lixo' | 'outros';
    quantidade: number;
  }[];
}

export interface ConsumoInsumo {
  id: string;
  origem: 'checkin' | 'requisicao_compra';
  consumo_em: string;
  ambiente_id: string;
  ambiente_nome: string;
  ambiente_codigo: string;
  ambiente_bloco: string | null;
  material: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  requisicao_compra_id: string | null;
  requisicao_numero: string | null;
  requisicao_status: 'draft' | 'enviada_fornecedor' | 'liquidada' | null;
}

export interface BlocoMapa {
  id: string;
  nome: string;
  badge_x: number;
  badge_y: number;
  geometria_tipo: 'rect' | 'circle' | 'polygon' | 'path';
  geometria_data: any;
  created_at?: string;
  updated_at?: string;
}

type CreateOcorrenciaPayload = Pick<
  Ocorrencia,
  'ambiente_id' | 'respondente_tipo' | 'avaliacao' | 'problemas' | 'observacao'
>;

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
      .select('*, ambiente:ambiente_id(nome, codigo, bloco)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const ocorrencias = (data || []) as Ocorrencia[];

    return Promise.all(
      ocorrencias.map(async (ocorrencia) => {
        if (!ocorrencia.foto_path) return ocorrencia;

        if (
          ocorrencia.foto_path.startsWith('http://') ||
          ocorrencia.foto_path.startsWith('https://') ||
          ocorrencia.foto_path.startsWith('data:')
        ) {
          return { ...ocorrencia, foto_url: ocorrencia.foto_path };
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(OCORRENCIA_FOTOS_BUCKET)
          .createSignedUrl(ocorrencia.foto_path, 60 * 60);

        if (signedError) {
          console.warn('Não foi possível assinar a foto da ocorrência:', signedError);
          return { ...ocorrencia, foto_url: null };
        }

        return { ...ocorrencia, foto_url: signedData?.signedUrl || null };
      }),
    );
  },

  async createOcorrencia(payload: CreateOcorrenciaPayload, foto?: File | null): Promise<Ocorrencia> {
    const ocorrenciaId = crypto.randomUUID();
    let fotoPath: string | null = null;

    if (foto) {
      const validationError = validateOcorrenciaFoto(foto);
      if (validationError) throw new Error(validationError);

      const extension = FOTO_EXTENSION_BY_MIME[foto.type];
      fotoPath = `${payload.ambiente_id}/${ocorrenciaId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(OCORRENCIA_FOTOS_BUCKET)
        .upload(fotoPath, foto, {
          cacheControl: '3600',
          contentType: foto.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
    }

    const { data, error } = await supabase
      .from('manutencao_ocorrencias')
      .insert({
        id: ocorrenciaId,
        ...payload,
        foto_path: fotoPath,
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
      .select('*, ambiente:ambiente_id(nome, codigo), materiais:manutencao_checkin_materiais(material, quantidade)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Checkin[];
  },

  async getConsumosInsumos(): Promise<ConsumoInsumo[]> {
    const { data, error } = await supabase
      .from('manutencao_consumo_insumos')
      .select('*')
      .order('consumo_em', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => ({
      ...(row as Omit<ConsumoInsumo, 'quantidade' | 'valor_unitario' | 'valor_total'>),
      quantidade: Number(row.quantidade || 0),
      valor_unitario: Number(row.valor_unitario || 0),
      valor_total: Number(row.valor_total || 0),
    }));
  },

  async createCheckin(payload: Omit<Checkin, 'id' | 'created_at'>): Promise<Checkin> {
    const { materiais, ...checkinData } = payload;
    const { data, error } = await supabase
      .from('manutencao_checkins')
      .insert(checkinData)
      .select()
      .single();

    if (error) throw error;
    const newCheckin = data as Checkin;

    if (materiais && materiais.length > 0) {
      const materialsPayload = materiais.map((m) => ({
        checkin_id: newCheckin.id,
        material: m.material,
        quantidade: m.quantidade,
      }));
      const { error: matError } = await supabase
        .from('manutencao_checkin_materiais')
        .insert(materialsPayload);

      if (matError) throw matError;
    }

    return { ...newCheckin, materiais };
  },

  async getBlocosMapa(): Promise<BlocoMapa[]> {
    const { data, error } = await supabase
      .from('manutencao_blocos_mapa')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return (data || []) as BlocoMapa[];
  },

  async saveBlocoMapa(bloco: Omit<BlocoMapa, 'created_at' | 'updated_at'>): Promise<BlocoMapa> {
    const { data, error } = await supabase
      .from('manutencao_blocos_mapa')
      .upsert(bloco)
      .select()
      .single();

    if (error) throw error;
    return data as BlocoMapa;
  },

  async deleteBlocoMapa(id: string): Promise<void> {
    const { error } = await supabase
      .from('manutencao_blocos_mapa')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
