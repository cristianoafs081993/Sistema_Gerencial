export type ConsultorSourceRef = {
  titulo: string;
  referencia: string;
};

export type ConsultorAttachedFile = {
  name: string;
  text: string;
  base64?: string;
};

export type ConsultorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachedFile?: ConsultorAttachedFile;
  sources?: ConsultorSourceRef[];
};

export type ConsultorSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  messages: ConsultorMessage[];
};

const STORAGE_PREFIX = 'consultor-chat-sessions:v2';

const DEFAULT_WELCOME_MESSAGE =
  'Ola! Sou o seu Consultor Juridico especializado nos normativos do IFRN. \n\nVoce pode me fazer perguntas diretas ou **anexar um PDF (ex: Minuta de TR)** para que eu analise se ele fere as regras de contratacao vigentes. Como posso ajudar hoje?';

const DEFAULT_RESET_MESSAGE = 'Chat reiniciado. Como posso te ajudar agora?';

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getConsultorStorageKey(userId?: string | null, email?: string | null) {
  const identity = userId?.trim() || email?.trim().toLowerCase() || '';
  return identity ? `${STORAGE_PREFIX}:${identity}` : '';
}

export function createWelcomeMessage(content = DEFAULT_WELCOME_MESSAGE): ConsultorMessage {
  return {
    id: createId('welcome'),
    role: 'assistant',
    content,
  };
}

export function createConsultorSession(seed?: Partial<ConsultorSession>): ConsultorSession {
  const timestamp = nowIso();
  const messages = seed?.messages?.length ? seed.messages : [createWelcomeMessage()];
  const title = seed?.title?.trim() || 'Nova conversa';
  const lastMessagePreview = seed?.lastMessagePreview?.trim() || 'Sem mensagens recentes';

  return {
    id: seed?.id || createId('session'),
    title,
    createdAt: seed?.createdAt || timestamp,
    updatedAt: seed?.updatedAt || timestamp,
    lastMessagePreview,
    messages,
  };
}

function normalizeTextPreview(value: string, fallback: string, maxLength = 88) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function deriveSessionTitle(messages: ConsultorMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  if (!firstUserMessage) return 'Nova conversa';

  if (firstUserMessage.content.trim()) {
    return normalizeTextPreview(firstUserMessage.content, 'Nova conversa', 56);
  }

  if (firstUserMessage.attachedFile?.name) {
    return normalizeTextPreview(`Documento: ${firstUserMessage.attachedFile.name}`, 'Nova conversa', 56);
  }

  return 'Nova conversa';
}

export function deriveSessionPreview(messages: ConsultorMessage[]) {
  const latestMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' || message.role === 'assistant');

  if (!latestMessage) {
    return 'Sem mensagens recentes';
  }

  if (latestMessage.content.trim()) {
    return normalizeTextPreview(latestMessage.content, 'Sem mensagens recentes');
  }

  if (latestMessage.attachedFile?.name) {
    return normalizeTextPreview(`PDF anexado: ${latestMessage.attachedFile.name}`, 'Sem mensagens recentes');
  }

  return 'Sem mensagens recentes';
}

export function replaceSessionMessages(session: ConsultorSession, messages: ConsultorMessage[]) {
  return {
    ...session,
    messages,
    title: deriveSessionTitle(messages),
    lastMessagePreview: deriveSessionPreview(messages),
    updatedAt: nowIso(),
  };
}

function isMessage(value: unknown): value is ConsultorMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ConsultorMessage>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
}

function isSession(value: unknown): value is ConsultorSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<ConsultorSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    typeof session.createdAt === 'string' &&
    typeof session.updatedAt === 'string' &&
    typeof session.lastMessagePreview === 'string' &&
    Array.isArray(session.messages) &&
    session.messages.every(isMessage)
  );
}

export function loadConsultorSessions(storageKey: string) {
  if (typeof window === 'undefined' || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isSession).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) {
    console.warn('Erro ao ler sessoes do Consultor', error);
    return [];
  }
}

export function saveConsultorSessions(storageKey: string, sessions: ConsultorSession[]) {
  if (typeof window === 'undefined' || !storageKey) return;

  const sanitized = sessions.map((session) => ({
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      attachedFile: message.attachedFile
        ? {
            name: message.attachedFile.name,
            text: message.attachedFile.text,
          }
        : undefined,
    })),
  }));

  window.localStorage.setItem(storageKey, JSON.stringify(sanitized));
}

export function clearConsultorSessions(storageKey: string) {
  if (typeof window === 'undefined' || !storageKey) return;
  window.localStorage.removeItem(storageKey);
}

export function getResetConsultorSessions() {
  return [
    createConsultorSession({
      title: 'Nova conversa',
      lastMessagePreview: DEFAULT_RESET_MESSAGE,
      messages: [createWelcomeMessage(DEFAULT_RESET_MESSAGE)],
    }),
  ];
}
