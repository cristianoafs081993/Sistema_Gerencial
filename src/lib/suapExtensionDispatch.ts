import type { SuapPlanSummary } from '@/services/suapPlanSummary';

export const SUAP_EXTENSION_ORIGIN = 'https://suap.ifrn.edu.br';

export type SuapExtensionProcessContext = {
  suapId: string;
  processNumber?: string;
  processUrl: string;
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
    (payload.processNumber !== undefined && typeof payload.processNumber !== 'string')
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

  const { suapId, processUrl, processNumber } = event.data.payload;
  return { suapId, processUrl, processNumber: processNumber?.trim() || undefined };
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
