export type AssistenteGerencialRole = 'user' | 'assistant';

export type AssistenteGerencialArtifact = {
  type: 'image';
  status: 'planned' | 'generated';
  title?: string;
  imageUrl?: string;
  prompt?: string;
};

export type AssistenteGerencialSource = {
  label: string;
  totalAmostra?: number;
  totalDisponivel?: number | null;
  warning?: string;
};

export type AssistenteGerencialPriceResearchCandidate = {
  id: string;
  sourceType?: string;
  supplierName: string;
  supplierDocument: string;
  agencyName: string;
  agencyCode?: string;
  purchaseId: string;
  purchaseItemId?: string;
  purchaseDate: string | null;
  resultDate?: string | null;
  unitPrice: number;
  comparableUnitPrice: number;
  originalUnitLabel?: string;
  unitCompatible: boolean;
  selected: boolean;
  exclusionReason?: string;
  pncpUrl?: string;
  editalAudited: boolean;
  editalExcerpt?: string;
  editalPage?: string;
  editalScore?: number;
  compatibility?: 'COMPATIVEL' | 'COMPATIVEL_COM_RESSALVA' | 'INCOMPATIVEL' | 'NAO_IDENTIFICADO';
  technicalJustification?: string;
  documentTitle?: string;
  documentType?: string;
  documentUrl?: string;
  itemDescription?: string;
  brand?: string;
};

export type AssistenteGerencialPriceResearchItem = {
  itemNumber: string;
  description: string;
  detailedSpecification?: string;
  catalogType: 'material' | 'service';
  catalogCode: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotal: number;
  method: 'median' | 'mean' | 'minimum';
  coefficientOfVariation: number;
  standardDeviation: number;
  minimumPrice: number;
  maximumPrice: number;
  meanPrice: number;
  medianPrice: number;
  candidatesCount: number;
  selectedCount: number;
  candidates: AssistenteGerencialPriceResearchCandidate[];
};

export type AssistenteGerencialPriceResearchData = {
  title: string;
  demandSummary: string;
  responsibleName?: string;
  processNumber?: string;
  researchDate: string;
  calculationMethod: 'median' | 'mean' | 'minimum';
  methodologyJustification?: string;
  overallEstimatedTotal: number;
  items: AssistenteGerencialPriceResearchItem[];
  complianceValid: boolean;
  complianceNotes: string[];
};

export type AssistenteGerencialMessage = {
  id: string;
  role: AssistenteGerencialRole;
  content: string;
  suggestions?: string[];
  artifacts?: AssistenteGerencialArtifact[];
  warnings?: string[];
  sources?: AssistenteGerencialSource[];
  priceResearchData?: AssistenteGerencialPriceResearchData;
};

export type AssistenteGerencialSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistenteGerencialMessage[];
};

const STORAGE_PREFIX = 'assistente-gerencial-sessions:v1';

export const ASSISTENTE_GERENCIAL_WELCOME =
  'Ola! Sou o Assistente Gerencial do GovFlow. Posso responder perguntas sobre orcamento, empenhos, contratos, liquidacoes, PFs e saldos importados no sistema.';

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTextPreview(value: string, fallback: string, maxLength = 72) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function getAssistenteGerencialStorageKey(userId?: string | null, email?: string | null) {
  const identity = userId?.trim() || email?.trim().toLowerCase() || '';
  return identity ? `${STORAGE_PREFIX}:${identity}` : '';
}

export function createAssistenteGerencialWelcomeMessage(
  content = ASSISTENTE_GERENCIAL_WELCOME,
): AssistenteGerencialMessage {
  return {
    id: createId('welcome'),
    role: 'assistant',
    content,
    suggestions: [
      'Qual o resumo da execucao orcamentaria?',
      'Quais empenhos tem maior saldo?',
      'Como esta o credito disponivel?',
    ],
  };
}

export function createAssistenteGerencialSession(
  seed?: Partial<AssistenteGerencialSession>,
): AssistenteGerencialSession {
  const timestamp = nowIso();
  const messages = seed?.messages?.length ? seed.messages : [createAssistenteGerencialWelcomeMessage()];

  return {
    id: seed?.id || createId('assistant-session'),
    title: seed?.title?.trim() || deriveAssistenteGerencialSessionTitle(messages),
    createdAt: seed?.createdAt || timestamp,
    updatedAt: seed?.updatedAt || timestamp,
    messages,
  };
}

export function deriveAssistenteGerencialSessionTitle(messages: AssistenteGerencialMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  return normalizeTextPreview(firstUserMessage?.content || '', 'Assistente Gerencial', 56);
}

export function replaceAssistenteGerencialMessages(
  session: AssistenteGerencialSession,
  messages: AssistenteGerencialMessage[],
) {
  return {
    ...session,
    messages,
    title: deriveAssistenteGerencialSessionTitle(messages),
    updatedAt: nowIso(),
  };
}

function isMessage(value: unknown): value is AssistenteGerencialMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AssistenteGerencialMessage>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
}

function isSession(value: unknown): value is AssistenteGerencialSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AssistenteGerencialSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    Array.isArray(session.messages) &&
    session.messages.every(isMessage)
  );
}

export function loadAssistenteGerencialSession(storageKey: string) {
  if (typeof window === 'undefined' || !storageKey) return createAssistenteGerencialSession();

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return createAssistenteGerencialSession();

    const parsed = JSON.parse(raw);
    if (!isSession(parsed)) return createAssistenteGerencialSession();

    return parsed;
  } catch (error) {
    console.warn('Erro ao ler sessao do Assistente Gerencial', error);
    return createAssistenteGerencialSession();
  }
}

export function saveAssistenteGerencialSession(
  storageKey: string,
  session: AssistenteGerencialSession,
) {
  if (typeof window === 'undefined' || !storageKey) return;

  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearAssistenteGerencialSession(storageKey: string) {
  if (typeof window === 'undefined' || !storageKey) return createAssistenteGerencialSession();

  window.localStorage.removeItem(storageKey);
  return createAssistenteGerencialSession();
}
