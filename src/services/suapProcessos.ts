import {
  SuapDadosCompletos,
  SuapLiquidacaoAnalise,
  SuapProcesso,
  SuapWorkflowConclusao,
} from '@/types';
import { supabase } from '@/lib/supabase';

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

type SuapScreenshotPayload = {
  name: string;
  type: string;
  dataUrl: string;
};

type ConcluirProcessoParams = {
  processo: SuapProcesso;
  nsNumero: string;
  solicitarAnaliseLiquidacao: boolean;
  analiseLiquidacao?: SuapLiquidacaoAnalise;
  arquivosSiafi?: string[];
  concluidoPor?: string;
};

const PROCESSOS_SELECT =
  'id,tenant_id,suap_id,url,status,num_processo,beneficiario,cpf_cnpj,assunto,contrato,pdf_url,dados_completos,created_at,updated_at';

const mapProcessoRow = (item: SuapProcessoRow): SuapProcesso => ({
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
});

const upsertWorkflow = async (processoId: string, dadosCompletos: SuapDadosCompletos): Promise<SuapProcesso> => {
  const { data, error } = await supabase
    .from('processos')
    .update({ dados_completos: dadosCompletos })
    .eq('id', processoId)
    .select(PROCESSOS_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapProcessoRow(data as SuapProcessoRow);
};

export const suapProcessosService = {
  async getAll(): Promise<SuapProcesso[]> {
    const { data, error } = await supabase
      .from('processos')
      .select(PROCESSOS_SELECT)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as SuapProcessoRow[] | null) || []).map(mapProcessoRow);
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

  async concluirProcesso({
    processo,
    nsNumero,
    solicitarAnaliseLiquidacao,
    analiseLiquidacao,
    arquivosSiafi,
    concluidoPor,
  }: ConcluirProcessoParams): Promise<SuapProcesso> {
    const workflowAnterior = processo.dadosCompletos?.workflow;
    const workflow: SuapWorkflowConclusao = {
      ...workflowAnterior,
      concluido: true,
      concluidoEm: new Date().toISOString(),
      concluidoPor,
      nsNumero,
      solicitarAnaliseLiquidacao,
      arquivosSiafi: arquivosSiafi || workflowAnterior?.arquivosSiafi,
      analiseLiquidacao: analiseLiquidacao || workflowAnterior?.analiseLiquidacao,
    };

    return upsertWorkflow(processo.id, {
      ...(processo.dadosCompletos || {}),
      ns_numero: nsNumero,
      workflow,
    });
  },

  async reabrirProcesso(processo: SuapProcesso): Promise<SuapProcesso> {
    const workflowAnterior = processo.dadosCompletos?.workflow;
    const workflow: SuapWorkflowConclusao = {
      ...workflowAnterior,
      concluido: false,
      reabertoEm: new Date().toISOString(),
    };

    return upsertWorkflow(processo.id, {
      ...(processo.dadosCompletos || {}),
      workflow,
    });
  },

  async analisarLiquidacaoSiafi(params: {
    processo: SuapProcesso;
    nsNumero: string;
    screenshots: SuapScreenshotPayload[];
  }): Promise<SuapLiquidacaoAnalise> {
    const { data, error } = await supabase.functions.invoke('analisar-liquidacao-siafi', {
      body: {
        processo: {
          id: params.processo.id,
          suapId: params.processo.suapId,
          numProcesso: params.processo.numProcesso,
          beneficiario: params.processo.beneficiario,
          cpfCnpj: params.processo.cpfCnpj,
          assunto: params.processo.assunto,
          contrato: params.processo.contrato || params.processo.dadosCompletos?.contrato_numero,
          notaFiscal: params.processo.dadosCompletos?.notas_fiscais?.[0],
          valorLiquido: params.processo.dadosCompletos?.val_nf,
          nsNumero: params.nsNumero,
          dadosBancarios: params.processo.dadosCompletos?.dados_bancarios,
          retencoesTributarias: params.processo.dadosCompletos?.retencoes_tributarias,
          empenhos: params.processo.dadosCompletos?.empenhos || [],
        },
        screenshots: params.screenshots,
      },
    });

    if (error) {
      throw error;
    }

    return data as SuapLiquidacaoAnalise;
  },
};
