import { normalizeSuapDocumentText } from './suapProcessDocuments';

export type SuapDocumentReviewType = 'tr' | 'etp';

export type SuapDocumentReviewSource = {
  title: string;
  reference: string;
  url: string;
  checkedAt?: string;
};

export type SuapDocumentReviewFinding = {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  page?: number;
  excerpt: string;
  problem: string;
  recommendation: string;
  suggestedText?: string;
  confidence: 'high' | 'medium' | 'low';
  legalBases: SuapDocumentReviewSource[];
};

export type SuapDocumentReviewResult = {
  documentType: SuapDocumentReviewType;
  checkedAt: string;
  status: 'critical' | 'attention' | 'no_major_finding' | 'insufficient_evidence';
  summary: string;
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: SuapDocumentReviewFinding[];
  sources: SuapDocumentReviewSource[];
  limitations: string[];
};

export function classifySuapDocumentForReview(
  title: string,
  documentType?: string | null,
): SuapDocumentReviewType | null {
  const normalizedTitle = normalizeSuapDocumentText(title);
  const normalizedType = normalizeSuapDocumentText(documentType);
  const searchableText = `${normalizedType} ${normalizedTitle}`.trim();

  if (!searchableText) return null;
  if (/(?:termo de )?aprovacao\b|aprovacao do termo|aprovacao de termo/.test(searchableText)) return null;
  if (/\banexo\b|\bminuta\b/.test(searchableText) && !/termo de referencia|estudo tecnico preliminar/.test(searchableText)) {
    return null;
  }

  if (searchableText.includes('estudo tecnico preliminar') || /\betp\b/.test(searchableText)) return 'etp';
  if (searchableText.includes('termo de referencia') || /\btr\s*(?:n[ºo]?\s*)?\d/.test(searchableText)) return 'tr';

  return null;
}

export function normalizeSuapDocumentReviewResult(
  value: unknown,
  fallbackType: SuapDocumentReviewType,
): SuapDocumentReviewResult {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const findings = Array.isArray(source.findings)
    ? source.findings.map((finding, index) => normalizeFinding(finding, index)).filter(Boolean) as SuapDocumentReviewFinding[]
    : [];
  const rawCounts = source.counts && typeof source.counts === 'object' && !Array.isArray(source.counts)
    ? source.counts as Record<string, unknown>
    : {};
  const counts = {
    critical: countSeverity(findings, 'critical', rawCounts.critical),
    high: countSeverity(findings, 'high', rawCounts.high),
    medium: countSeverity(findings, 'medium', rawCounts.medium),
    low: countSeverity(findings, 'low', rawCounts.low),
  };
  const status = ['critical', 'attention', 'no_major_finding', 'insufficient_evidence'].includes(String(source.status))
    ? source.status as SuapDocumentReviewResult['status']
    : findings.length ? 'attention' : 'insufficient_evidence';

  return {
    documentType: source.documentType === 'etp' || source.documentType === 'tr' ? source.documentType : fallbackType,
    checkedAt: typeof source.checkedAt === 'string' && source.checkedAt ? source.checkedAt : new Date().toISOString(),
    status,
    summary: cleanText(source.summary) || 'A análise foi concluída sem resumo fornecido pelo modelo.',
    counts,
    findings,
    sources: normalizeSources(source.sources),
    limitations: normalizeStringList(source.limitations),
  };
}

function normalizeFinding(value: unknown, index: number): SuapDocumentReviewFinding | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const severity = ['critical', 'high', 'medium', 'low'].includes(String(source.severity))
    ? source.severity as SuapDocumentReviewFinding['severity']
    : 'medium';
  const confidence = ['high', 'medium', 'low'].includes(String(source.confidence))
    ? source.confidence as SuapDocumentReviewFinding['confidence']
    : 'medium';
  const title = cleanText(source.title);
  const problem = cleanText(source.problem);
  const recommendation = cleanText(source.recommendation);
  if (!title || !problem || !recommendation) return null;

  return {
    id: cleanText(source.id) || `finding-${index + 1}`,
    severity,
    category: cleanText(source.category) || 'Conformidade documental',
    title,
    ...(Number.isInteger(source.page) && Number(source.page) > 0 ? { page: Number(source.page) } : {}),
    excerpt: cleanText(source.excerpt),
    problem,
    recommendation,
    ...(cleanText(source.suggestedText) ? { suggestedText: cleanText(source.suggestedText) } : {}),
    confidence,
    legalBases: normalizeSources(source.legalBases),
  };
}

function normalizeSources(value: unknown): SuapDocumentReviewSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item) => ({
      title: cleanText(item.title) || 'Fonte oficial',
      reference: cleanText(item.reference),
      url: cleanText(item.url),
      ...(cleanText(item.checkedAt) ? { checkedAt: cleanText(item.checkedAt) } : {}),
    }))
    .filter((item) => /^https:\/\/(?:www\.)?(?:planalto\.gov\.br|gov\.br|in\.gov\.br)\//i.test(item.url));
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 20)
    : [];
}

function countSeverity(
  findings: SuapDocumentReviewFinding[],
  severity: SuapDocumentReviewFinding['severity'],
  rawValue: unknown,
) {
  const count = findings.filter((finding) => finding.severity === severity).length;
  return count || (Number.isFinite(Number(rawValue)) ? Math.max(0, Number(rawValue)) : 0);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}
