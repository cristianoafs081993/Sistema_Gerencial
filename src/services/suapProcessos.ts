import { supabase } from '@/lib/supabase';
import { SuapDadosCompletos, SuapProcesso } from '@/types';

type SuapProcessoRow = {
  id: string;
  tenant_id?: string | null;
  suap_id: string;
  url: string;
  status: string;
  num_processo?: string | null;
  beneficiario?: string | null;
  cpf_cnpj?: string | null;
  assunto?: string | null;
  contrato?: string | null;
  pdf_url?: string | null;
  dados_completos?: SuapDadosCompletos | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const suapProcessosService = {
  async getAll(): Promise<SuapProcesso[]> {
    const { data, error } = await supabase
      .from('processos')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as SuapProcessoRow[] | null) || []).map((item) => ({
      id: item.id,
      tenantId: item.tenant_id || undefined,
      suapId: item.suap_id,
      url: item.url,
      status: item.status,
      numProcesso: item.num_processo || undefined,
      beneficiario: item.beneficiario || undefined,
      cpfCnpj: item.cpf_cnpj || undefined,
      assunto: item.assunto || undefined,
      contrato: item.contrato || undefined,
      pdfUrl: item.pdf_url || undefined,
      dadosCompletos: item.dados_completos || undefined,
      createdAt: item.created_at ? new Date(item.created_at) : undefined,
      updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
    }));
  },

  async getPdfSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('suap-pdfs')
      .createSignedUrl(path, 60);

    if (error) {
      throw error;
    }

    return data?.signedUrl || null;
  },
};
