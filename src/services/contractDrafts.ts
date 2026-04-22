import { analyzeContractPdfFromArrayBuffer, type ContractPdfAnalysis, type ContractTemplateCandidate } from '@/lib/contractProcessPdf';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseFunctionErrors';
import { supabase } from '@/lib/supabase';
import type { SuapProcesso } from '@/types';
import { suapProcessosService } from '@/services/suapProcessos';

export type ContractDraftField = {
  key: string;
  label: string;
  value?: string;
  status: 'confirmed' | 'inferred' | 'missing';
  source: string;
};

export type ContractDraftSource = {
  label: string;
  pageStart: number;
  pageEnd: number;
};

export type ContractDraftResult = {
  status: 'generated' | 'blocked';
  title: string;
  subtitle?: string;
  html?: string;
  warnings: string[];
  missingRequiredFields: string[];
  fields: ContractDraftField[];
  sources: ContractDraftSource[];
  blockedReason?: string;
  model?: string;
};

type GenerateContractParams = {
  processo: SuapProcesso;
  analysis: ContractPdfAnalysis;
  candidate: ContractTemplateCandidate;
};

async function fetchPdfArrayBuffer(processo: SuapProcesso): Promise<ArrayBuffer> {
  if (!processo.pdfUrl) {
    throw new Error('Este processo ainda nao possui PDF sincronizado.');
  }

  const signedUrl = await suapProcessosService.getPdfSignedUrl(processo.pdfUrl);
  if (!signedUrl) {
    throw new Error('Nao foi possivel gerar o link temporario do PDF do processo.');
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar o PDF sincronizado. HTTP ${response.status}.`);
  }

  return response.arrayBuffer();
}

export const contractDraftsService = {
  async analyzeProcessPdf(processo: SuapProcesso): Promise<ContractPdfAnalysis> {
    const arrayBuffer = await fetchPdfArrayBuffer(processo);
    return analyzeContractPdfFromArrayBuffer(arrayBuffer);
  },

  async generateDraft({ processo, analysis, candidate }: GenerateContractParams): Promise<ContractDraftResult> {
    const payload = {
      processo: {
        id: processo.id,
        suapId: processo.suapId,
        numProcesso: processo.numProcesso,
        beneficiario: processo.beneficiario,
        cpfCnpj: processo.cpfCnpj,
        assunto: processo.assunto,
        contrato: processo.contrato || processo.dadosCompletos?.contrato_numero,
        valorLiquido: processo.dadosCompletos?.val_nf,
        empenhos: processo.dadosCompletos?.empenhos || [],
      },
      selectedModel: {
        id: candidate.id,
        title: candidate.title,
        subtitle: candidate.subtitle,
        pageStart: candidate.pageStart,
        pageEnd: candidate.pageEnd,
        pageNumbers: candidate.pageNumbers,
        excerpt: candidate.excerpt,
        templateText: candidate.templateText,
        truncated: candidate.truncated,
      },
      contextSnippets: analysis.snippets.map((snippet) => ({
        id: snippet.id,
        kind: snippet.kind,
        label: snippet.label,
        pageNumber: snippet.pageNumber,
        excerpt: snippet.excerpt,
      })),
      analysisWarnings: analysis.warnings,
    };

    const { data, error } = await supabase.functions.invoke('gerar-contrato-licitacao', {
      body: payload,
    });

    if (error) {
      throw new Error(await getSupabaseFunctionErrorMessage(error));
    }

    return data as ContractDraftResult;
  },
};
