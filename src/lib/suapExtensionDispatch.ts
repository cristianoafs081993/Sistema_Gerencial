import type { SuapPlanSummary } from '@/services/suapPlanSummary';
import type { SuapDocumentReviewType } from '@/lib/suapDocumentReview';
import type { SuapProcesso } from '@/types';

export const SUAP_EXTENSION_ORIGIN = 'https://suap.ifrn.edu.br';

export type SuapExtensionProcessContext = {
  suapId: string;
  processNumber?: string;
  processUrl: string;
  /** Sessao efemera enviada pelo armazenamento privado da extensao. */
  extensionSession?: {
    accessToken: string;
    refreshToken: string;
  };
};

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

export type SuapExtensionDocumentAnalysisContext = {
  suapId: string;
  processNumber?: string;
  processUrl: string;
  documentId: string;
  documentTitle: string;
  documentType: SuapDocumentReviewType;
  documentOriginalPath: string;
  extensionSession?: {
    accessToken: string;
    refreshToken: string;
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
    (payload.processNumber !== undefined && typeof payload.processNumber !== 'string') ||
    (payload.extensionSession !== undefined && (
      typeof payload.extensionSession !== 'object' ||
      typeof payload.extensionSession.accessToken !== 'string' ||
      typeof payload.extensionSession.refreshToken !== 'string' ||
      !payload.extensionSession.accessToken ||
      !payload.extensionSession.refreshToken ||
      payload.extensionSession.accessToken.length > 10000 ||
      payload.extensionSession.refreshToken.length > 10000
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
    (payload.extensionSession !== undefined && (
      typeof payload.extensionSession !== 'object' ||
      typeof payload.extensionSession.accessToken !== 'string' ||
      typeof payload.extensionSession.refreshToken !== 'string' ||
      !payload.extensionSession.accessToken ||
      !payload.extensionSession.refreshToken ||
      payload.extensionSession.accessToken.length > 10000 ||
      payload.extensionSession.refreshToken.length > 10000
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

  const { suapId, processUrl, processNumber, extensionSession } = event.data.payload;
  return {
    suapId,
    processUrl,
    processNumber: processNumber?.trim() || undefined,
    ...(extensionSession ? {
      extensionSession: {
        accessToken: extensionSession.accessToken,
        refreshToken: extensionSession.refreshToken,
      },
    } : {}),
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
