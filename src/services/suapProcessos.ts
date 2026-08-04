import {
  SuapDadosCompletos,
  SuapLiquidacaoAnalise,
  SuapProcesso,
  SuapWorkflowConclusao,
  SuapCaixa,
} from '@/types';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
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
  caixa?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SuapProcessoCaixaRow = {
  processo_id: string;
  suap_caixas?: { nome?: string | null } | Array<{ nome?: string | null }> | null;
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
  'id,tenant_id,suap_id,url,status,num_processo,beneficiario,cpf_cnpj,assunto,contrato,pdf_url,dados_completos,caixa,created_at,updated_at';

const mapProcessoRow = (item: SuapProcessoRow, caixas: string[] = []): SuapProcesso => ({
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
  caixa: caixas.join(' · ') || item.caixa || undefined,
  createdAt: item.created_at ? new Date(item.created_at) : undefined,
  updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
});

const getMembershipBoxNames = (membership: SuapProcessoCaixaRow): string[] => {
  const caixas = Array.isArray(membership.suap_caixas)
    ? membership.suap_caixas
    : membership.suap_caixas
      ? [membership.suap_caixas]
      : [];

  return caixas
    .map((caixa) => caixa.nome?.trim())
    .filter((nome): nome is string => Boolean(nome));
};

const mapActiveProcessos = (
  processos: SuapProcessoRow[],
  memberships: SuapProcessoCaixaRow[],
): SuapProcesso[] => {
  const caixasByProcessoId = new Map<string, string[]>();

  memberships.forEach((membership) => {
    const current = caixasByProcessoId.get(membership.processo_id) || [];
    caixasByProcessoId.set(membership.processo_id, [...new Set([...current, ...getMembershipBoxNames(membership)])]);
  });

  return processos
    .filter((processo) => caixasByProcessoId.has(processo.id))
    .map((processo) => mapProcessoRow(processo, caixasByProcessoId.get(processo.id)));
};
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
    const fetchFallback = async () => {
      const [processos, memberships] = await Promise.all([
        fetchSupabaseRestRows<SuapProcessoRow>('processos', PROCESSOS_SELECT, {
          orderBy: 'updated_at',
          ascending: false,
        }),
        fetchSupabaseRestRows<SuapProcessoCaixaRow>('suap_processo_caixas', 'processo_id,suap_caixas(nome)'),
      ]);

      return mapActiveProcessos(processos, memberships);
    };

    const [processosResult, membershipsResult] = await Promise.all([
      supabase
        .from('processos')
        .select(PROCESSOS_SELECT)
        .order('updated_at', { ascending: false }),
      supabase
        .from('suap_processo_caixas')
        .select('processo_id,suap_caixas(nome)'),
    ]);

    if (processosResult.error || membershipsResult.error) {
      console.warn(
        'suapProcessosService.getAll: fallback para Supabase REST',
        processosResult.error || membershipsResult.error,
      );
      return fetchFallback();
    }

    return mapActiveProcessos(
      (processosResult.data as SuapProcessoRow[] | null) || [],
      (membershipsResult.data as SuapProcessoCaixaRow[] | null) || [],
    );
  },
  async getBySuapId(suapId: string): Promise<SuapProcesso | null> {
    const normalizedSuapId = suapId.trim();
    if (!normalizedSuapId) return null;

    const { data, error } = await supabase
      .from('processos')
      .select(PROCESSOS_SELECT)
      .eq('suap_id', normalizedSuapId)
      .maybeSingle();

    if (error) throw error;

    return data ? mapProcessoRow(data as SuapProcessoRow) : null;
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
          notasFiscais: params.processo.dadosCompletos?.notas_fiscais || [],
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

  async getRegisteredCaixas(): Promise<SuapCaixa[]> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .select('id,tenant_id,nome,url,created_at,updated_at')
      .order('nome', { ascending: true });

    if (error) {
      throw error;
    }

    return ((data as any[] | null) || []).map((item) => ({
      id: item.id,
      tenantId: item.tenant_id,
      nome: item.nome,
      url: item.url,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }));
  },

  async addRegisteredCaixa(nome: string, url: string): Promise<SuapCaixa> {
    const { data, error } = await supabase
      .from('suap_caixas')
      .insert({ nome, url })
      .select('id,tenant_id,nome,url,created_at,updated_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      tenantId: data.tenant_id,
      nome: data.nome,
      url: data.url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  },

  async deleteRegisteredCaixa(id: string): Promise<void> {
    const { error } = await supabase
      .from('suap_caixas')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  },
};
