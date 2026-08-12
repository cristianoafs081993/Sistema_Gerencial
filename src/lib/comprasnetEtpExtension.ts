export const COMPRASNET_EXTENSION_ORIGIN = 'https://www.siages.com.br';
export const COMPRASNET_ETP_READY_MESSAGE = 'siages:comprasnet-etp-ready';
export const COMPRASNET_ETP_CONTEXT_MESSAGE = 'siages:comprasnet-etp-context';
export const COMPRASNET_ETP_REQUEST_MESSAGE = 'siages:comprasnet-etp-request';
export const COMPRASNET_ETP_RESULT_MESSAGE = 'siages:comprasnet-etp-result';
export const COMPRASNET_ETP_CLOSE_MESSAGE = 'siages:comprasnet-etp-close';

export type ComprasnetEtpThemeTokens = {
  fontFamily: string;
  fontSize: string;
  textColor: string;
  mutedColor: string;
  surfaceColor: string;
  backgroundColor: string;
  borderColor: string;
  primaryColor: string;
  primaryTextColor: string;
  secondaryColor: string;
  secondaryTextColor: string;
  focusColor: string;
  radius: string;
};

export type ComprasnetEtpFieldSnapshot = {
  id: string;
  title: string;
  existingHtml: string;
  existingText: string;
};

export type ComprasnetEtpPageContext = {
  pageUrl: string;
  artifactId?: string;
  pageTitle: string;
  processNumber?: string;
  currentSectionId?: string;
  fields: ComprasnetEtpFieldSnapshot[];
  theme: ComprasnetEtpThemeTokens;
  extensionSession?: { accessToken: string; refreshToken: string };
};

export type ComprasnetEtpRequest =
  | { action: 'snapshot'; mode: 'current' | 'whole' }
  | { action: 'apply'; fields: Array<{ id: string; html: string; replaceExisting: boolean }> };

export type ComprasnetEtpResult =
  | { action: 'snapshot'; ok: true; context: Omit<ComprasnetEtpPageContext, 'theme' | 'extensionSession'> }
  | { action: 'apply'; ok: true; appliedFieldIds: string[]; message: string }
  | { action: 'error'; ok: false; message: string; recoverable?: boolean };

export function postComprasnetMessage(message: unknown) {
  window.parent.postMessage(message, COMPRASNET_EXTENSION_ORIGIN);
}

export function isComprasnetEtpMessage(event: MessageEvent, type: string) {
  return event.origin === COMPRASNET_EXTENSION_ORIGIN &&
    event.source === window.parent &&
    event.data?.source === 'siages' &&
    event.data?.type === type &&
    event.data?.version === 1;
}

