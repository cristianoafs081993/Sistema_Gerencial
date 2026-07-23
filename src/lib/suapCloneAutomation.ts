import { buildSuapClipboardHtml, htmlToPlainText } from '@/lib/suapClipboard';

export type SuapCloneDocumentType = 'despacho' | 'cdo';

export type SuapCloneAutomationMode = 'review' | 'save-after-confirmation';

export interface SuapCloneAutomationPayload {
  source: 'siages';
  version: 1;
  documentType: SuapCloneDocumentType;
  subject: string;
  mode: SuapCloneAutomationMode;
  contentHtml?: string;
  plainText?: string;
}

interface BuildSuapCloneUrlOptions {
  documentType: SuapCloneDocumentType;
  html?: string;
  mode?: SuapCloneAutomationMode;
}

export const SUAP_CLONE_FRAGMENT_PARAM = 'siagesClone';

const SUAP_CLONE_TEMPLATE_IDS: Record<SuapCloneDocumentType, string> = {
  despacho: '1026154',
  cdo: '1016427',
};

export function getSuapCloneBaseUrl(documentType: SuapCloneDocumentType): string {
  return `https://suap.ifrn.edu.br/documento_eletronico/clonar_documento/${SUAP_CLONE_TEMPLATE_IDS[documentType]}/`;
}

export function extractSuapSubjectFromHtml(html: string): string | null {
  if (!html.trim()) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const blockElements = Array.from(doc.body.querySelectorAll('p, div, li'))
    .filter((element) => !element.querySelector('p, div, li'));

  for (const element of blockElements) {
    const text = normalizeText(element.textContent || '');
    const match = text.match(/^Assunto:\s*(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }

  const fallbackMatch = normalizeText(doc.body.textContent || '').match(/\bAssunto:\s*([^.;]+(?:Despesa|Despesas|CDO)?)/i);
  return fallbackMatch?.[1]?.trim() || null;
}

export function createSuapCloneAutomationPayload(
  documentType: SuapCloneDocumentType,
  subject: string,
  mode: SuapCloneAutomationMode = 'review',
  html = '',
): SuapCloneAutomationPayload {
  const payload: SuapCloneAutomationPayload = {
    source: 'siages',
    version: 1,
    documentType,
    subject: normalizeText(subject),
    mode,
  };

  if (html.trim()) {
    payload.contentHtml = buildSuapClipboardHtml(html);
    payload.plainText = htmlToPlainText(html);
  }

  return payload;
}

export function encodeSuapClonePayload(payload: SuapCloneAutomationPayload): string {
  const params = new URLSearchParams();
  params.set(SUAP_CLONE_FRAGMENT_PARAM, JSON.stringify(payload));
  return params.toString();
}

export function parseSuapClonePayloadFromFragment(fragment: string): SuapCloneAutomationPayload | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const raw = params.get(SUAP_CLONE_FRAGMENT_PARAM);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as Partial<SuapCloneAutomationPayload>;
    if (
      payload.source !== 'siages' ||
      payload.version !== 1 ||
      (payload.documentType !== 'despacho' && payload.documentType !== 'cdo') ||
      (payload.mode !== 'review' && payload.mode !== 'save-after-confirmation') ||
      typeof payload.subject !== 'string' ||
      !payload.subject.trim() ||
      (payload.contentHtml !== undefined && typeof payload.contentHtml !== 'string') ||
      (payload.plainText !== undefined && typeof payload.plainText !== 'string')
    ) {
      return null;
    }

    const parsed: SuapCloneAutomationPayload = {
      source: 'siages',
      version: 1,
      documentType: payload.documentType,
      subject: normalizeText(payload.subject),
      mode: payload.mode,
    };

    if (payload.contentHtml?.trim()) parsed.contentHtml = payload.contentHtml;
    if (payload.plainText?.trim()) parsed.plainText = payload.plainText;

    return parsed;
  } catch {
    return null;
  }
}

export function buildSuapCloneUrl({
  documentType,
  html = '',
  mode = 'review',
}: BuildSuapCloneUrlOptions): string {
  const baseUrl = getSuapCloneBaseUrl(documentType);
  const subject = documentType === 'despacho' ? extractSuapSubjectFromHtml(html) : null;

  if (!subject) return baseUrl;

  const payload = createSuapCloneAutomationPayload(documentType, subject, mode, html);
  return `${baseUrl}#${encodeSuapClonePayload(payload)}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}