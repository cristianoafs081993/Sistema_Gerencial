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

const SUPPORTED_PROCESS_PATH = /^\/processo_eletronico\/(?:processo|visualizar_processo)\/(\d+)\/?$/;

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