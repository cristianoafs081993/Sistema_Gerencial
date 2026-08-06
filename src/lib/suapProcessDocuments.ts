export type SuapProcessDocumentClassification = 'included' | 'excluded';

export type SuapProcessDocumentCandidate = {
  suapDocumentId: string;
  order: number;
  title: string;
  documentType: string | null;
  originalPath: string;
  originalUrl: string;
  classification: SuapProcessDocumentClassification;
  classificationReason: string | null;
};

export type ConcurrentTaskResult<T> = {
  fulfilled: T[];
  rejected: Array<{ index: number; reason: unknown }>;
};

const SUAP_ORIGIN = 'https://suap.ifrn.edu.br';
const DOCUMENT_VIEWER_PATH = /^\/documento_eletronico\/visualizar_documento(?:_digitalizado)?\/(\d+)\/?$/;

export function normalizeSuapDocumentText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function classifySuapProcessDocument(title: string, documentType?: string | null) {
  const normalized = normalizeSuapDocumentText(`${documentType || ''} ${title}`);

  if (/\bimr\b/.test(normalized)) {
    return { classification: 'excluded' as const, reason: 'imr' };
  }
  if (normalized.includes('certidao') || normalized.includes('documentacao complementar')) {
    return { classification: 'excluded' as const, reason: 'certidoes_ou_documentacao_complementar' };
  }
  if (normalized.includes('conta vinculada')) {
    return { classification: 'excluded' as const, reason: 'conta_vinculada' };
  }
  if (normalized.includes('relatorio de recebimento provis')) {
    return { classification: 'excluded' as const, reason: 'relatorio_recebimento_provisorio' };
  }
  if (/\bfolhas? de pagamento\b/.test(normalized)) {
    return { classification: 'excluded' as const, reason: 'folha_pagamento' };
  }

  return { classification: 'included' as const, reason: null };
}

export function toSuapDocumentOriginalPath(href: string): { suapDocumentId: string; originalPath: string } | null {
  try {
    const url = new URL(href, SUAP_ORIGIN);
    if (url.origin !== SUAP_ORIGIN) return null;
    const match = url.pathname.match(DOCUMENT_VIEWER_PATH);
    if (!match) return null;
    return {
      suapDocumentId: match[1],
      originalPath: `${url.pathname}?original=sim`,
    };
  } catch {
    return null;
  }
}

export function parseSuapProcessDocumentManifest(html: string): SuapProcessDocumentCandidate[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates: SuapProcessDocumentCandidate[] = [];
  const seenDocumentIds = new Set<string>();

  const viewerLinks = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="/documento_eletronico/visualizar_documento"]'));
  for (const link of viewerLinks) {
    const source = toSuapDocumentOriginalPath(link.getAttribute('href') || '');
    if (!source || seenDocumentIds.has(source.suapDocumentId)) continue;

    const title = String(link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!title) continue;
    const strongType = String(link.querySelector('strong')?.textContent || '').replace(/\s+/g, ' ').trim();
    const documentType = strongType.replace(/:\s*$/, '') || title.split(':', 1)[0]?.trim() || null;
    const classification = classifySuapProcessDocument(title, documentType);

    candidates.push({
      suapDocumentId: source.suapDocumentId,
      order: candidates.length,
      title,
      documentType,
      originalPath: source.originalPath,
      originalUrl: `${SUAP_ORIGIN}${source.originalPath}`,
      classification: classification.classification,
      classificationReason: classification.reason,
    });
    seenDocumentIds.add(source.suapDocumentId);
  }

  return candidates;
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<ConcurrentTaskResult<T>> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit) || 1, tasks.length || 1));
  const fulfilled: T[] = [];
  const rejected: Array<{ index: number; reason: unknown }> = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        fulfilled.push(await tasks[index]());
      } catch (reason) {
        rejected.push({ index, reason });
      }
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return { fulfilled, rejected };
}
