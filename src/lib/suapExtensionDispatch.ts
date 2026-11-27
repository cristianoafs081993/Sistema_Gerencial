import type { SuapPlanSummary } from '@/services/suapPlanSummary';
import { DESPACHO_FINALIDADES, DESPACHO_TEMPLATE_FIELDS, type DespachoModelo } from '@/lib/despachoModelo';
import type { SuapDocumentReviewType } from '@/lib/suapDocumentReview';
import type { SuapProcesso } from '@/types';
import type { ProcessMappingRecord, SuapProcessFlowSummary, SuapProcessRouteSnapshot } from '@/types/processMapping';

export const SUAP_EXTENSION_ORIGIN = 'https://suap.ifrn.edu.br';

export type SuapExtensionProcessContext = {
  suapId: string;
  processNumber?: string;
  processUrl: string;
  assunto?: string;
  /** Campo "Tipo" dos dados gerais do SUAP (ex.: "Ensino: Pagamento de Bolsa"). */
  tipoProcesso?: string;
  beneficiario?: string;
  cpfCnpj?: string;
  caixa?: string;
  /** JWT efêmero enviado pelo worker; nunca inclui refresh token. */
  extensionSession?: {
    accessToken: string;
    expiresAt?: number;
    campusUasg?: string;
  };
  route?: SuapProcessRouteSnapshot;
  customMappings?: ProcessMappingRecord[];
  /** Textos do despacho de liquidação personalizados pelo servidor no popup da extensão. */
  despachoModelo?: Omit<DespachoModelo, 'campus'>;
};

const DESPACHO_MODELO_LIMITS = { destinatario: 300, assunto: 200, encaminhamento: 1500, fecho: 300 } as const;
const DESPACHO_TEMPLATE_LIMITS = { ...DESPACHO_MODELO_LIMITS, corpo: 2000 } as const;

/** Aceita só os campos conhecidos, como texto e dentro do limite; o restante é descartado. */
export function sanitizeDespachoModelo(value: unknown): SuapExtensionProcessContext['despachoModelo'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const modelo: NonNullable<SuapExtensionProcessContext['despachoModelo']> = {};
  for (const [field, max] of Object.entries(DESPACHO_MODELO_LIMITS) as Array<[keyof typeof DESPACHO_MODELO_LIMITS, number]>) {
    const text = typeof source[field] === 'string' ? source[field].trim().slice(0, max) : '';
    if (text) modelo[field] = text;
  }
  // Modelos por finalidade: só finalidades e campos conhecidos, como texto e dentro do limite.
  const rawModelos = source.modelos;
  if (rawModelos && typeof rawModelos === 'object' && !Array.isArray(rawModelos)) {
    const modelos: NonNullable<DespachoModelo['modelos']> = {};
    for (const finalidade of DESPACHO_FINALIDADES) {
      const rawTemplate = (rawModelos as Record<string, unknown>)[finalidade];
      if (!rawTemplate || typeof rawTemplate !== 'object' || Array.isArray(rawTemplate)) continue;
      const template: Record<string, string> = {};
      for (const field of DESPACHO_TEMPLATE_FIELDS) {
        const raw = (rawTemplate as Record<string, unknown>)[field];
        const text = typeof raw === 'string' ? raw.trim().slice(0, DESPACHO_TEMPLATE_LIMITS[field]) : '';
        if (text) template[field] = text;
      }
      if (Object.keys(template).length) modelos[finalidade] = template;
    }
    if (Object.keys(modelos).length) modelo.modelos = modelos;
  }
  return Object.keys(modelo).length ? modelo : undefined;
}

export type SuapExtensionProcessContextMessage = {
  source: 'siages-suap-extension';
  type: 'siages:suap-process-context';
  version: 1;
  payload: SuapExtensionProcessContext;
};

export const SUAP_EXTENSION_DISPATCH_READY_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-dispatch-ready',
  version: 1,
} as const;

export const SUAP_EXTENSION_DISPATCH_CLOSE_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-dispatch-close',
  version: 1,
} as const;

export const SUAP_EXTENSION_PROCESS_INFO_READY_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-process-info-ready',
  version: 1,
} as const;

export const SUAP_EXTENSION_PROCESS_FINANCE_SUMMARY_TYPE = 'siages:suap-process-finance-summary' as const;
export const SUAP_EXTENSION_PROCESS_SNAPSHOT_TYPE = 'siages:suap-process-snapshot' as const;
export const SUAP_EXTENSION_PROCESS_SYNC_STATUS_TYPE = 'siages:suap-process-sync-status' as const;
export const SUAP_EXTENSION_PROCESS_PDF_REQUEST_TYPE = 'siages:suap-process-pdf-request' as const;
export const SUAP_EXTENSION_PROCESS_PDF_RESULT_TYPE = 'siages:suap-process-pdf-result' as const;
export const SUAP_EXTENSION_PROCESS_RETRY_TYPE = 'siages:suap-process-retry' as const;
export const SUAP_EXTENSION_PROCESS_FLOW_TYPE = 'siages:suap-process-flow' as const;
export const SUAP_EXTENSION_PROCESS_BENEFICIARY_DOCS_TYPE = 'siages:suap-process-beneficiary-docs' as const;
export const SUAP_EXTENSION_PROCESS_BENEFICIARY_DOCS_MORE_TYPE = 'siages:suap-process-beneficiary-docs-more' as const;

export type SuapExtensionBeneficiaryDocItem = {
  id: string;
  valorOriginal: number;
  valorPago: number;
  estado: string;
  processo?: string;
  dataEmissao?: string;
  empenhoNumero?: string;
};

export type SuapExtensionProcessBeneficiaryDocsPayload = {
  suapId: string;
  cpfCnpj: string;
  total: number;
  page: number;
  perPage: number;
  append?: boolean;
  items: SuapExtensionBeneficiaryDocItem[];
  error?: string;
};

export function getSuapExtensionBeneficiaryDocsMoreRequest(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
): { suapId: string; cpfCnpj: string; page: number } | null {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource) return null;
  const message = event.data as { source?: unknown; type?: unknown; version?: unknown; payload?: Record<string, unknown> } | null;
  if (
    !message ||
    message.source !== 'siages-suap-extension' ||
    message.type !== SUAP_EXTENSION_PROCESS_BENEFICIARY_DOCS_MORE_TYPE ||
    message.version !== 1 ||
    !message.payload ||
    typeof message.payload !== 'object'
  ) {
    return null;
  }
  const { suapId, cpfCnpj, page } = message.payload;
  if (suapId !== expectedSuapId || typeof cpfCnpj !== 'string' || !cpfCnpj.trim()) return null;
  const parsedPage = typeof page === 'number' && Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return { suapId, cpfCnpj: cpfCnpj.trim(), page: parsedPage };
}

export type SuapExtensionProcessFlowPayload = {
  suapId: string;
  summary: SuapProcessFlowSummary;
  mappings: Array<Pick<ProcessMappingRecord, 'id' | 'title' | 'code' | 'version'>>;
};

export type SuapExtensionDocumentAnalysisContext = {
  suapId: string;
  processNumber?: string;
  processUrl: string;
  documentId: string;
  documentTitle: string;
  documentType: SuapDocumentReviewType;
  documentOriginalPath: string;
  reviewMode?: 'latest';
  extensionSession?: {
    accessToken: string;
    expiresAt?: number;
  };
};

export type SuapExtensionDocumentAnalysisContextMessage = {
  source: 'siages-suap-extension';
  type: 'siages:suap-document-analysis-context';
  version: 1;
  payload: SuapExtensionDocumentAnalysisContext;
};

export const SUAP_EXTENSION_DOCUMENT_ANALYSIS_READY_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-document-analysis-ready',
  version: 1,
} as const;

export const SUAP_EXTENSION_DOCUMENT_ANALYSIS_CLOSE_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-document-analysis-close',
  version: 1,
} as const;

export const SUAP_EXTENSION_DOCUMENT_PDF_REQUEST_TYPE = 'siages:suap-document-pdf-request' as const;
export const SUAP_EXTENSION_DOCUMENT_PDF_RESULT_TYPE = 'siages:suap-document-pdf-result' as const;

export type SuapExtensionDocumentPdfRequestMessage = {
  source: 'siages';
  type: typeof SUAP_EXTENSION_DOCUMENT_PDF_REQUEST_TYPE;
  version: 1;
  payload: {
    suapId: string;
    documentId: string;
    documentOriginalPath: string;
  };
};

export type SuapExtensionDocumentPdfResultMessage = {
  source: 'siages-suap-extension';
  type: typeof SUAP_EXTENSION_DOCUMENT_PDF_RESULT_TYPE;
  version: 1;
  payload: {
    suapId: string;
    documentId: string;
    bytes?: ArrayBuffer;
    error?: string;
  };
};

export type SuapExtensionProcessSnapshot = {
  process: SuapProcesso | null;
  fallback: {
    suapId: string;
    processNumber?: string;
    processUrl: string;
  };
};

export type SuapExtensionProcessFlowMessage = {
  source: 'siages';
  type: typeof SUAP_EXTENSION_PROCESS_FLOW_TYPE;
  version: 1;
  payload: SuapExtensionProcessFlowPayload;
};

export type SuapExtensionProcessSyncStatus = {
  stage: 'checking' | 'registering' | 'requesting-pdf' | 'uploading-pdf' | 'queued' | 'processing' | 'ready' | 'error';
  message: string;
  retryable?: boolean;
};

export type SuapExtensionProcessPdfResultMessage = {
  source: 'siages-suap-extension';
  type: typeof SUAP_EXTENSION_PROCESS_PDF_RESULT_TYPE;
  version: 1;
  payload: {
    suapId: string;
    bytes?: ArrayBuffer;
    error?: string;
  };
};

export function isValidSuapExtensionProcessPdfResult(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
): event is MessageEvent<SuapExtensionProcessPdfResultMessage> {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource) return false;
  const message = event.data as Partial<SuapExtensionProcessPdfResultMessage> | null;
  const payload = message?.payload;
  return message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_PROCESS_PDF_RESULT_TYPE &&
    message.version === 1 &&
    Boolean(payload) &&
    payload?.suapId === expectedSuapId &&
    (payload.bytes instanceof ArrayBuffer || typeof payload.error === 'string');
}

const SUPPORTED_DOCUMENT_PATH = /^\/documento_eletronico\/visualizar_documento(?:_digitalizado)?\/(\d+)\/?$/;

export function isValidSuapExtensionDocumentAnalysisContext(value: unknown): value is SuapExtensionDocumentAnalysisContextMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<SuapExtensionDocumentAnalysisContextMessage>;
  const payload = message.payload;
  if (
    message.source !== 'siages-suap-extension' ||
    message.type !== 'siages:suap-document-analysis-context' ||
    message.version !== 1 ||
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.suapId !== 'string' ||
    !/^\d+$/.test(payload.suapId) ||
    typeof payload.processUrl !== 'string' ||
    typeof payload.documentId !== 'string' ||
    !/^\d+$/.test(payload.documentId) ||
    typeof payload.documentTitle !== 'string' ||
    !payload.documentTitle.trim() ||
    payload.documentTitle.length > 4000 ||
    (payload.documentType !== 'tr' && payload.documentType !== 'etp') ||
    typeof payload.documentOriginalPath !== 'string' ||
    (payload.reviewMode !== undefined && payload.reviewMode !== 'latest') ||
    (payload.processNumber !== undefined && typeof payload.processNumber !== 'string') ||
    (payload.extensionSession !== undefined && (
      typeof payload.extensionSession !== 'object' ||
      typeof payload.extensionSession.accessToken !== 'string' ||
      !payload.extensionSession.accessToken ||
      payload.extensionSession.accessToken.length > 10000 ||
      (payload.extensionSession.expiresAt !== undefined && (!Number.isFinite(payload.extensionSession.expiresAt) || payload.extensionSession.expiresAt <= 0)) ||
      (payload.extensionSession.campusUasg !== undefined && (typeof payload.extensionSession.campusUasg !== 'string' || !/^\d{6}$/.test(payload.extensionSession.campusUasg.trim())))
    ))
  ) return false;

  try {
    const processUrl = new URL(payload.processUrl);
    const documentUrl = new URL(payload.documentOriginalPath, SUAP_EXTENSION_ORIGIN);
    const processId = SUPPORTED_PROCESS_PATH.exec(processUrl.pathname)?.[1];
    const documentId = SUPPORTED_DOCUMENT_PATH.exec(documentUrl.pathname)?.[1];
    const queryKeys = [...documentUrl.searchParams.keys()];
    return processUrl.origin === SUAP_EXTENSION_ORIGIN &&
      processId === payload.suapId &&
      documentUrl.origin === SUAP_EXTENSION_ORIGIN &&
      documentId === payload.documentId &&
      queryKeys.length === 1 &&
      documentUrl.searchParams.get('original') === 'sim';
  } catch {
    return false;
  }
}

export function getSuapExtensionDocumentAnalysisContext(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
): SuapExtensionDocumentAnalysisContext | null {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource || !isValidSuapExtensionDocumentAnalysisContext(event.data)) {
    return null;
  }
  const { extensionSession, ...payload } = event.data.payload;
  return {
    ...payload,
    ...(extensionSession ? { extensionSession } : {}),
  };
}

export function isValidSuapExtensionDocumentPdfResult(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
  expectedDocumentId: string,
): event is MessageEvent<SuapExtensionDocumentPdfResultMessage> {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource) return false;
  const message = event.data as Partial<SuapExtensionDocumentPdfResultMessage> | null;
  const payload = message?.payload;
  return message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_DOCUMENT_PDF_RESULT_TYPE &&
    message.version === 1 &&
    Boolean(payload) &&
    payload?.suapId === expectedSuapId &&
    payload?.documentId === expectedDocumentId &&
    (payload.bytes instanceof ArrayBuffer || typeof payload.error === 'string');
}

// --- Lista de credores montada pela extensao em processos de bolsa ---------------------------------

export const SUAP_EXTENSION_LC_DOCUMENTS_REQUEST_TYPE = 'siages:suap-lc-documents-request' as const;
export const SUAP_EXTENSION_LC_DOCUMENTS_RESULT_TYPE = 'siages:suap-lc-documents-result' as const;
export const SUAP_EXTENSION_LC_STATUS_TYPE = 'siages:suap-lc-status' as const;
export const SUAP_EXTENSION_LC_REBUILD_TYPE = 'siages:suap-lc-rebuild' as const;
export const SUAP_EXTENSION_LC_MAX_DOCUMENTS = 15;

/** Documento do processo lido pela extensao: texto do documento eletronico ou bytes do PDF anexado. */
export type SuapExtensionLcDocument = {
  id: string;
  title: string;
  type: string;
  kind: 'text' | 'pdf';
  text?: string;
  bytes?: ArrayBuffer;
  error?: string;
};

export type SuapExtensionLcDocumentsResultMessage = {
  source: 'siages-suap-extension';
  type: typeof SUAP_EXTENSION_LC_DOCUMENTS_RESULT_TYPE;
  version: 1;
  payload: {
    suapId: string;
    documents: SuapExtensionLcDocument[];
    error?: string;
  };
};

export type SuapExtensionLcStage =
  | 'collecting'
  | 'reading'
  | 'ai'
  | 'saving'
  | 'ready'
  | 'existing'
  | 'empty'
  | 'error';

export type SuapExtensionLcStatus = {
  suapId: string;
  stage: SuapExtensionLcStage;
  message: string;
  listId?: string;
  listName?: string;
  found?: number;
  expected?: number;
  pendencias?: number;
  method?: 'script' | 'ia';
  warnings?: string[];
  retryable?: boolean;
  /** Aluno da lista quando ha um so: e o beneficiario do processo de bolsa. */
  beneficiario?: { nome: string; cpf: string };
};

function isValidLcDocument(value: unknown): value is SuapExtensionLcDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<SuapExtensionLcDocument>;
  return typeof doc.id === 'string' && /^\d{1,12}$/.test(doc.id) &&
    typeof doc.title === 'string' && doc.title.length <= 500 &&
    typeof doc.type === 'string' && doc.type.length <= 200 &&
    (doc.kind === 'text' || doc.kind === 'pdf') &&
    (doc.text === undefined || (typeof doc.text === 'string' && doc.text.length <= 500_000)) &&
    (doc.bytes === undefined || doc.bytes instanceof ArrayBuffer) &&
    (doc.error === undefined || typeof doc.error === 'string');
}

export function isValidSuapExtensionLcDocumentsResult(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
): event is MessageEvent<SuapExtensionLcDocumentsResultMessage> {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource) return false;
  const message = event.data as Partial<SuapExtensionLcDocumentsResultMessage> | null;
  const payload = message?.payload;
  return message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_LC_DOCUMENTS_RESULT_TYPE &&
    message.version === 1 &&
    Boolean(payload) &&
    payload?.suapId === expectedSuapId &&
    Array.isArray(payload.documents) &&
    payload.documents.length <= SUAP_EXTENSION_LC_MAX_DOCUMENTS &&
    payload.documents.every(isValidLcDocument) &&
    (payload.error === undefined || typeof payload.error === 'string');
}

// --- Aluno pela matricula: o documento traz a matricula no lugar do CPF ------------------------------
// A extensao le /edu/aluno/<matricula>/ com a sessao do SUAP e devolve CPF e nome do cadastro.

export const SUAP_EXTENSION_ALUNO_REQUEST_TYPE = 'siages:suap-aluno-request' as const;
export const SUAP_EXTENSION_ALUNO_RESULT_TYPE = 'siages:suap-aluno-result' as const;
export const SUAP_EXTENSION_ALUNO_MAX_MATRICULAS = 50;

export type SuapExtensionAluno = { matricula: string; cpf?: string; nome?: string; error?: string };

export type SuapExtensionAlunoResultMessage = {
  source: 'siages-suap-extension';
  type: typeof SUAP_EXTENSION_ALUNO_RESULT_TYPE;
  version: 1;
  payload: { suapId: string; alunos: SuapExtensionAluno[]; error?: string };
};

function isValidAluno(value: unknown): value is SuapExtensionAluno {
  if (!value || typeof value !== 'object') return false;
  const aluno = value as Partial<SuapExtensionAluno>;
  return typeof aluno.matricula === 'string' && /^\d{10,15}$/.test(aluno.matricula) &&
    (aluno.cpf === undefined || (typeof aluno.cpf === 'string' && /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(aluno.cpf))) &&
    (aluno.nome === undefined || (typeof aluno.nome === 'string' && aluno.nome.length <= 200)) &&
    (aluno.error === undefined || typeof aluno.error === 'string');
}

export function isValidSuapExtensionAlunoResult(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
): event is MessageEvent<SuapExtensionAlunoResultMessage> {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource) return false;
  const message = event.data as Partial<SuapExtensionAlunoResultMessage> | null;
  const payload = message?.payload;
  return message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_ALUNO_RESULT_TYPE &&
    message.version === 1 &&
    Boolean(payload) &&
    payload?.suapId === expectedSuapId &&
    Array.isArray(payload.alunos) &&
    payload.alunos.length <= SUAP_EXTENSION_ALUNO_MAX_MATRICULAS &&
    payload.alunos.every(isValidAluno) &&
    (payload.error === undefined || typeof payload.error === 'string');
}

export function isValidSuapExtensionLcRebuild(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
) {
  const message = event.data as { source?: string; type?: string; version?: number; payload?: { suapId?: string } } | null;
  return event.origin === SUAP_EXTENSION_ORIGIN &&
    event.source === expectedSource &&
    message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_LC_REBUILD_TYPE &&
    message.version === 1 &&
    message.payload?.suapId === expectedSuapId;
}

export function isValidSuapExtensionProcessRetry(
  event: MessageEvent,
  expectedSource: WindowProxy | null,
  expectedSuapId: string,
) {
  const message = event.data as { source?: string; type?: string; version?: number; payload?: { suapId?: string } } | null;
  return event.origin === SUAP_EXTENSION_ORIGIN &&
    event.source === expectedSource &&
    message?.source === 'siages-suap-extension' &&
    message.type === SUAP_EXTENSION_PROCESS_RETRY_TYPE &&
    message.version === 1 &&
    message.payload?.suapId === expectedSuapId;
}

export type SuapExtensionPlanContext = {
  planId: 8;
  planUrl: string;
};

export type SuapExtensionPlanContextMessage = {
  source: 'siages-suap-extension';
  type: 'siages:suap-plan-context';
  version: 1;
  payload: SuapExtensionPlanContext;
};

export const SUAP_EXTENSION_PLAN_SUMMARY_READY_MESSAGE = {
  source: 'siages',
  type: 'siages:suap-plan-summary-ready',
  version: 1,
} as const;

export const SUAP_EXTENSION_PLAN_SUMMARY_TYPE = 'siages:suap-plan-summary' as const;
export const SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE = 'siages:suap-plan-summary-error' as const;

export type SuapExtensionPlanSummaryMessage = {
  source: 'siages';
  type: typeof SUAP_EXTENSION_PLAN_SUMMARY_TYPE;
  version: 1;
  payload: SuapPlanSummary;
};

export type SuapExtensionPlanSummaryErrorMessage = {
  source: 'siages';
  type: typeof SUAP_EXTENSION_PLAN_SUMMARY_ERROR_TYPE;
  version: 1;
  payload: { message: string };
};

const SUPPORTED_PROCESS_PATH = /^\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?$/;
const SUPPORTED_PLAN_PATH = /^\/plan_estrategico\/plano_concluido\/8\/?$/;

export function isValidSuapExtensionProcessContext(value: unknown): value is SuapExtensionProcessContextMessage {
  if (!value || typeof value !== 'object') return false;

  const message = value as Partial<SuapExtensionProcessContextMessage>;
  const payload = message.payload;
  if (
    message.source !== 'siages-suap-extension' ||
    message.type !== 'siages:suap-process-context' ||
    message.version !== 1 ||
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.suapId !== 'string' ||
    !/^\d+$/.test(payload.suapId) ||
    typeof payload.processUrl !== 'string' ||
    (payload.processNumber !== undefined && typeof payload.processNumber !== 'string') ||
    (payload.assunto !== undefined && typeof payload.assunto !== 'string') ||
    (payload.tipoProcesso !== undefined && typeof payload.tipoProcesso !== 'string') ||
    (payload.beneficiario !== undefined && typeof payload.beneficiario !== 'string') ||
    (payload.cpfCnpj !== undefined && typeof payload.cpfCnpj !== 'string') ||
    (payload.caixa !== undefined && typeof payload.caixa !== 'string') ||
    (payload.route !== undefined && (
      typeof payload.route !== 'object' ||
      !Array.isArray(payload.route.events) ||
      payload.route.events.length > 200 ||
      payload.route.events.some((event) => !event || typeof event !== 'object' || typeof event.id !== 'string' || typeof event.label !== 'string' || typeof event.rawText !== 'string' || typeof event.order !== 'number') ||
      (payload.route.selectedMappingId !== undefined && typeof payload.route.selectedMappingId !== 'string') ||
      (payload.route.assunto !== undefined && typeof payload.route.assunto !== 'string') ||
      (payload.route.manualCurrentStepNodeId !== undefined && typeof payload.route.manualCurrentStepNodeId !== 'string')
    )) ||
    (payload.extensionSession !== undefined && (
      typeof payload.extensionSession !== 'object' ||
      typeof payload.extensionSession.accessToken !== 'string' ||
      !payload.extensionSession.accessToken ||
      payload.extensionSession.accessToken.length > 10000 ||
      (payload.extensionSession.expiresAt !== undefined && (!Number.isFinite(payload.extensionSession.expiresAt) || payload.extensionSession.expiresAt <= 0)) ||
      (payload.extensionSession.campusUasg !== undefined && (typeof payload.extensionSession.campusUasg !== 'string' || !/^\d{6}$/.test(payload.extensionSession.campusUasg.trim())))
    ))
  ) {
    return false;
  }

  try {
    const url = new URL(payload.processUrl);
    const matchedProcessId = SUPPORTED_PROCESS_PATH.exec(url.pathname)?.[1];
    return url.origin === SUAP_EXTENSION_ORIGIN && matchedProcessId === payload.suapId;
  } catch {
    return false;
  }
}

export function getSuapExtensionProcessContext(event: MessageEvent, expectedSource: WindowProxy | null): SuapExtensionProcessContext | null {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource || !isValidSuapExtensionProcessContext(event.data)) {
    return null;
  }

  const { suapId, processUrl, processNumber, assunto, tipoProcesso, beneficiario, cpfCnpj, caixa, extensionSession, route } = event.data.payload;
  const despachoModelo = sanitizeDespachoModelo((event.data.payload as { despachoModelo?: unknown }).despachoModelo);
  return {
    suapId,
    processUrl,
    processNumber: processNumber?.trim() || undefined,
    assunto: typeof assunto === 'string' ? assunto.trim() || undefined : undefined,
    ...(typeof tipoProcesso === 'string' && tipoProcesso.trim() ? { tipoProcesso: tipoProcesso.trim().slice(0, 200) } : {}),
    beneficiario: typeof beneficiario === 'string' ? beneficiario.trim() || undefined : undefined,
    cpfCnpj: typeof cpfCnpj === 'string' ? cpfCnpj.trim() || undefined : undefined,
    caixa: typeof caixa === 'string' ? caixa.trim() || undefined : undefined,
    ...(extensionSession ? {
      extensionSession: {
        accessToken: extensionSession.accessToken,
        ...(extensionSession.expiresAt ? { expiresAt: extensionSession.expiresAt } : {}),
        ...(extensionSession.campusUasg?.trim() ? { campusUasg: extensionSession.campusUasg.trim() } : {}),
      },
    } : {}),
    ...(route ? { route } : {}),
    ...(despachoModelo ? { despachoModelo } : {}),
  };
}

export function isValidSuapExtensionPlanContext(value: unknown): value is SuapExtensionPlanContextMessage {
  if (!value || typeof value !== 'object') return false;

  const message = value as Partial<SuapExtensionPlanContextMessage>;
  const payload = message.payload;
  if (
    message.source !== 'siages-suap-extension' ||
    message.type !== 'siages:suap-plan-context' ||
    message.version !== 1 ||
    !payload ||
    typeof payload !== 'object' ||
    payload.planId !== 8 ||
    typeof payload.planUrl !== 'string'
  ) {
    return false;
  }

  try {
    const url = new URL(payload.planUrl);
    return url.origin === SUAP_EXTENSION_ORIGIN && SUPPORTED_PLAN_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function getSuapExtensionPlanContext(event: MessageEvent, expectedSource: WindowProxy | null): SuapExtensionPlanContext | null {
  if (event.origin !== SUAP_EXTENSION_ORIGIN || event.source !== expectedSource || !isValidSuapExtensionPlanContext(event.data)) {
    return null;
  }

  return { planId: 8, planUrl: event.data.payload.planUrl };
}

/** Valida o contrato serializável entregue ao content script pelo iframe autenticado. */
export function isValidSuapExtensionPlanSummaryPayload(value: unknown): value is SuapPlanSummary {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Partial<SuapPlanSummary>;
  if (payload.planId !== 8 || !Array.isArray(payload.dimensoes)) return false;

  return payload.dimensoes.every((dimension) => {
    if (!dimension || typeof dimension !== 'object') return false;
    const candidate = dimension as Record<string, unknown>;
    return typeof candidate.key === 'string' &&
      typeof candidate.dimensao === 'string' &&
      ['totalPlanejado', 'totalDescentralizado', 'aDescentralizar', 'totalEmpenhado', 'aEmpenhar']
        .every((field) => typeof candidate[field] === 'number' && Number.isFinite(candidate[field])) &&
      ['atividades', 'descentralizacoes', 'empenhos'].every((field) => Array.isArray(candidate[field]));
  });
}
