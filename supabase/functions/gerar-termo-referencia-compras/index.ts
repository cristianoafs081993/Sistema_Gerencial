const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EditableBlock = {
  id?: string;
  kind?: 'paragraph' | 'table';
  blockIndex?: number;
  text?: string;
  excerpt?: string;
  styleId?: string;
  isInstructional?: boolean;
  hasPlaceholder?: boolean;
};

type QuestionnaireOption = {
  id?: string;
  label?: string;
  text?: string;
  blockId?: string;
  blockIndex?: number;
  blockIds?: string[];
  blockIndexes?: number[];
  blockTexts?: string[];
};

type QuestionnaireQuestion = {
  id?: string;
  kind?: 'exclusive' | 'optional' | 'field';
  title?: string;
  prompt?: string;
  guidance?: string;
  blockId?: string;
  blockIndex?: number;
  blockIds?: string[];
  blockIndexes?: number[];
  placeholder?: string;
  options?: QuestionnaireOption[];
};

type QuestionnaireSchema = {
  version?: number;
  questions?: QuestionnaireQuestion[];
};

type QuestionnaireAnswer = {
  questionId?: string;
  kind?: 'exclusive' | 'optional' | 'field';
  skipped?: boolean;
  selectedOptionId?: string;
  value?: string;
  optionValues?: Record<string, string>;
  origin?: 'user' | 'ai';
  approved?: boolean;
  confidence?: 'high' | 'medium';
  sourcePage?: number;
  sourceType?: 'processo' | 'anexo' | 'etp';
  sourceLabel?: string;
  sourceExcerpt?: string;
  justification?: string;
};

type ReferenceTermRequest = {
  processo?: Record<string, unknown>;
  template?: {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    versionLabel?: string;
    fileName?: string;
    templateText?: string;
    editableBlocks?: EditableBlock[];
    questionnaireSchema?: QuestionnaireSchema;
  };
  questionnaireAnswers?: QuestionnaireAnswer[];
  contextSnippets?: Array<{
    label?: string;
    kind?: string;
    pageNumber?: number;
    excerpt?: string;
    sourceType?: 'processo' | 'anexo' | 'etp';
    sourceName?: string;
    sourceLabel?: string;
  }>;
  analysisWarnings?: string[];
};

type DraftFieldStatus = 'confirmed' | 'inferred' | 'missing';

type DraftField = {
  key: string;
  label: string;
  value?: string;
  status: DraftFieldStatus;
  source: string;
};

type ParagraphReplacement = {
  blockId: string;
  blockIndex: number;
  paragraphs: string[];
  remove?: boolean;
  review?: ReviewMark;
};

type TableReplacement = {
  blockId: string;
  blockIndex: number;
  rows: string[][];
  review?: ReviewMark;
};

type TemplatePlan = {
  paragraphReplacements: ParagraphReplacement[];
  tableReplacements: TableReplacement[];
};

type ReviewMark = {
  status: 'ai_generated' | 'added' | 'pending' | 'not_adopted';
  comment?: string;
};

type SectionDraftResult = {
  warnings: string[];
  missingRequiredFields: string[];
  fields: DraftField[];
  templatePlan: TemplatePlan;
  model?: string;
};

type QuestionnairePrePlan = SectionDraftResult & {
  lockedBlockIndexes: Set<number>;
};

type ValidEditableBlock = EditableBlock & {
  id: string;
  kind: 'paragraph' | 'table';
  blockIndex: number;
  text: string;
};

const MAX_BLOCKS_PER_SECTION = 6;
const MAX_SECTION_TEXT_CHARS = 9000;
const MAX_SNIPPET_CHARS = 5200;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const stripJsonFence = (value: string) =>
  value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

function parseGeminiJson(content: string): Record<string, unknown> {
  const stripped = stripJsonFence(content);

  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(stripped.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        // Fall through to the operational error below.
      }
    }
  }

  throw new Error('A IA retornou JSON invalido. Tente gerar novamente; se persistir, reduza o tamanho do modelo ou do processo.');
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function getGeminiApiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY')
  );
}

function getModelCandidates() {
  const configuredModel = Deno.env.get('GEMINI_REFERENCE_TERM_MODEL') || 'gemini-2.5-flash-lite';

  return uniqueStrings([
    configuredModel,
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ]);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeFieldStatus(value: unknown): DraftFieldStatus {
  if (value === 'confirmed' || value === 'missing') return value;
  return 'inferred';
}

function normalizeFields(value: unknown): DraftField[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const source = typeof record.source === 'string' ? record.source.trim() : '';
      const rawValue = typeof record.value === 'string' ? record.value.trim() : undefined;

      if (!key || !label || !source) return null;

      return {
        key,
        label,
        value: rawValue || undefined,
        status: normalizeFieldStatus(record.status),
        source,
      } satisfies DraftField;
    })
    .filter((item): item is DraftField => Boolean(item));
}

function normalizeReviewMark(value: unknown): ReviewMark | undefined {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!record) return undefined;

  const status = record.status;
  if (status !== 'ai_generated' && status !== 'added' && status !== 'pending' && status !== 'not_adopted') {
    return undefined;
  }

  return {
    status,
    comment: typeof record.comment === 'string' && record.comment.trim() ? record.comment.trim() : undefined,
  };
}

function normalizeParagraphReplacements(value: unknown): ParagraphReplacement[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const blockId = typeof record.blockId === 'string' ? record.blockId.trim() : '';
      const blockIndex = typeof record.blockIndex === 'number' ? record.blockIndex : -1;
      const paragraphs = Array.isArray(record.paragraphs)
        ? record.paragraphs.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
        : [];

      if (!blockId || blockIndex < 0) return null;

      return {
        blockId,
        blockIndex,
        paragraphs,
        remove: false,
        review: normalizeReviewMark(record.review),
      } satisfies ParagraphReplacement;
    })
    .filter((item): item is ParagraphReplacement => Boolean(item));
}

function normalizeTableReplacements(value: unknown): TableReplacement[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const blockId = typeof record.blockId === 'string' ? record.blockId.trim() : '';
      const blockIndex = typeof record.blockIndex === 'number' ? record.blockIndex : -1;
      const rows = Array.isArray(record.rows)
        ? record.rows
            .map((row) =>
              Array.isArray(row)
                ? row.map((cell) => (typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim()))
                : [],
            )
            .filter((row) => row.length > 0)
        : [];

      if (!blockId || blockIndex < 0) return null;

      return {
        blockId,
        blockIndex,
        rows,
        review: normalizeReviewMark(record.review),
      } satisfies TableReplacement;
    })
    .filter((item): item is TableReplacement => Boolean(item));
}

function normalizeTemplatePlan(value: unknown): TemplatePlan {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    paragraphReplacements: normalizeParagraphReplacements(record.paragraphReplacements),
    tableReplacements: normalizeTableReplacements(record.tableReplacements),
  };
}

function extractGeminiText(responseBody: Record<string, unknown>): string {
  const candidates = Array.isArray(responseBody.candidates) ? responseBody.candidates : [];
  const firstCandidate = candidates[0] && typeof candidates[0] === 'object'
    ? (candidates[0] as Record<string, unknown>)
    : null;
  const content = firstCandidate?.content && typeof firstCandidate.content === 'object'
    ? (firstCandidate.content as Record<string, unknown>)
    : null;
  const parts = Array.isArray(content?.parts) ? content?.parts : [];
  const firstPart = parts[0] && typeof parts[0] === 'object'
    ? (parts[0] as Record<string, unknown>)
    : null;

  return typeof firstPart?.text === 'string' ? firstPart.text : '';
}

function buildSources(request: ReferenceTermRequest) {
  const sources: Array<{ label: string; pageStart?: number; pageEnd?: number }> = [];

  for (const snippet of request.contextSnippets || []) {
    const label = typeof snippet.sourceLabel === 'string' && snippet.sourceLabel.trim()
      ? snippet.sourceLabel.trim()
      : typeof snippet.sourceName === 'string' && snippet.sourceName.trim()
        ? snippet.sourceName.trim()
        : typeof snippet.label === 'string' && snippet.label.trim()
          ? snippet.label.trim()
          : snippet.sourceType === 'etp'
            ? 'ETP editado no editor'
            : 'Trecho de apoio';
    const alreadyAdded = sources.some(
      (source) => source.label === label && source.pageStart === snippet.pageNumber && source.pageEnd === snippet.pageNumber,
    );

    if (!alreadyAdded) {
      sources.push(typeof snippet?.pageNumber === 'number'
        ? {
            label,
            pageStart: snippet.pageNumber,
            pageEnd: snippet.pageNumber,
          }
        : { label });
    }
  }

  return sources;
}

function normalizeEditableBlocks(blocks: EditableBlock[]): ValidEditableBlock[] {
  return blocks
    .map((block) => {
      const id = typeof block.id === 'string' ? block.id.trim() : '';
      const kind = block.kind === 'table' ? 'table' : block.kind === 'paragraph' ? 'paragraph' : null;
      const blockIndex = typeof block.blockIndex === 'number' ? block.blockIndex : -1;
      const text = typeof block.text === 'string' && block.text.trim()
        ? block.text.trim()
        : typeof block.excerpt === 'string'
          ? block.excerpt.trim()
          : '';

      if (!id || !kind || blockIndex < 0 || !text) return null;

      return {
        ...block,
        id,
        kind,
        blockIndex,
        text,
      } satisfies ValidEditableBlock;
    })
    .filter((block): block is ValidEditableBlock => Boolean(block))
    .sort((left, right) => left.blockIndex - right.blockIndex);
}

function normalizeQuestionnaireQuestions(schema?: QuestionnaireSchema): QuestionnaireQuestion[] {
  if (!schema || !Array.isArray(schema.questions)) return [];

  return schema.questions
    .map((question) => (question && typeof question === 'object' ? question : null))
    .filter((question): question is QuestionnaireQuestion => Boolean(question?.id && question.kind));
}

function buildAnswerMap(answers?: QuestionnaireAnswer[]) {
  const answerMap = new Map<string, QuestionnaireAnswer>();

  for (const answer of answers || []) {
    const questionId = typeof answer.questionId === 'string' ? answer.questionId.trim() : '';
    if (!questionId) continue;
    answerMap.set(questionId, answer);
  }

  return answerMap;
}

function replaceQuestionPlaceholder(text: string, placeholder: string | undefined, value: string) {
  if (placeholder && text.includes(placeholder)) {
    return text.split(placeholder).join(value);
  }

  return text.replace(/\[[^\]]+\]/g, value);
}

function buildOptionValueKey(blockId: string | undefined, placeholder: string, occurrenceIndex: number) {
  const normalizedBlockId = (blockId || 'option').trim() || 'option';
  return `${normalizedBlockId}::${occurrenceIndex}::${placeholder.trim()}`;
}

const PARCEL_DELIVERY_SCHEDULE_FIELD_ID = 'prazos-condicoes-parcelas';

function buildSupplementalOptionValueKey(blockId: string | undefined, fieldId: string) {
  const normalizedBlockId = (blockId || 'option').trim() || 'option';
  return `${normalizedBlockId}::supplemental::${fieldId}`;
}

function normalizeAnswerOptionValues(answer?: QuestionnaireAnswer) {
  const raw = answer?.optionValues;
  if (!raw || typeof raw !== 'object') return {};

  return Object.entries(raw).reduce<Record<string, string>>((current, [key, value]) => {
    const normalizedKey = key.trim();
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedKey) return current;
    current[normalizedKey] = normalizedValue;
    return current;
  }, {});
}

function normalizeReferenceText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function cleanModelField(value?: string) {
  return (value || '')
    .replace(/^\s*\[/, '')
    .replace(/\]\s*$/, '')
    .replace(/[.;:,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLiteralInlineChoicePlaceholder(value: string) {
  const cleaned = cleanModelField(value);
  if (!cleaned) return false;

  const normalized = normalizeReferenceText(cleaned);
  if (normalized.length < 10) return false;

  return /(?:ESTUDO TECNICO PRELIMINAR|NOTA TECNICA|TERMO DE REFERENCIA|PARECER|JUSTIFICATIVA|MEMORIAL|RELATORIO)/.test(normalized);
}

function isGenericInlineChoicePlaceholder(value: string) {
  return normalizeReferenceText(cleanModelField(value)) === '...';
}

function isInlineChoiceSeparatorText(value: string) {
  const normalized = normalizeReferenceText(value).replace(/^[,.;:]+|[,.;:]+$/g, '').trim();
  return normalized === 'OU';
}

function getSupplementalParcelDeliveryField(optionText: string, blockId: string | undefined) {
  const normalizedText = normalizeReferenceText(optionText);
  if (
    !normalizedText.includes('PARCELAS') ||
    !normalizedText.includes('PRAZOS') ||
    !normalizedText.includes('CONDICOES')
  ) {
    return null;
  }

  return {
    key: buildSupplementalOptionValueKey(blockId, PARCEL_DELIVERY_SCHEDULE_FIELD_ID),
    fallbackKey: PARCEL_DELIVERY_SCHEDULE_FIELD_ID,
    label: 'Prazos e condicoes das parcelas',
  };
}

function appendClauseComplement(optionText: string, value: string) {
  const cleanText = optionText.trim();
  const cleanValue = value.trim();
  if (!cleanText || !cleanValue) return cleanText || cleanValue;

  const textWithoutTrailingPunctuation = cleanText.replace(/[\s.;:]+$/g, '');
  const valueWithPunctuation = /[.!?]$/.test(cleanValue) ? cleanValue : `${cleanValue}.`;
  return `${textWithoutTrailingPunctuation}: ${valueWithPunctuation}`;
}

function cleanupInlineOptionText(value: string) {
  return value
    .replace(/\s+OU\s+OU\s+/gi, ' OU ')
    .replace(/\s{2,}OU\s+/gi, ' ')
    .replace(/\s+OU\s{2,}/gi, ' ')
    .replace(/\s+OU\s*(?=[,.;:]|$)/gi, '')
    .replace(/^\s*OU\s+/gi, '')
    .replace(/([([])\s*OU\s+/gi, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function questionPrompt(question: QuestionnaireQuestion) {
  return typeof question.prompt === 'string' && question.prompt.trim()
    ? question.prompt.trim()
    : typeof question.title === 'string' && question.title.trim()
      ? question.title.trim()
      : 'Pergunta do modelo';
}

function optionBlockIndexes(option: QuestionnaireOption) {
  if (Array.isArray(option.blockIndexes) && option.blockIndexes.length > 0) {
    return option.blockIndexes.filter((value): value is number => typeof value === 'number' && value >= 0);
  }

  return typeof option.blockIndex === 'number' && option.blockIndex >= 0 ? [option.blockIndex] : [];
}

function optionBlockIds(option: QuestionnaireOption, fallbackIndexes: number[]) {
  if (Array.isArray(option.blockIds) && option.blockIds.length > 0) {
    return option.blockIds.map((value, index) => {
      const fallbackIndex = fallbackIndexes[index] ?? fallbackIndexes[0] ?? index;
      return typeof value === 'string' && value.trim() ? value.trim() : `block-${fallbackIndex}`;
    });
  }

  return fallbackIndexes.map((fallbackIndex, index) => {
    if (index === 0 && typeof option.blockId === 'string' && option.blockId.trim()) {
      return option.blockId.trim();
    }

    return `block-${fallbackIndex}`;
  });
}

function optionBlockTexts(option: QuestionnaireOption, fallbackIndexes: number[]) {
  if (Array.isArray(option.blockTexts) && option.blockTexts.length > 0) {
    return option.blockTexts.map((value) => (typeof value === 'string' ? value.trim() : ''));
  }

  const text = typeof option.text === 'string' && option.text.trim() ? option.text.trim() : '';
  return fallbackIndexes.map((_, index) => (index === 0 ? text : ''));
}

function makePendingComment(question: QuestionnaireQuestion) {
  return `Pergunta pulada pelo usuario: ${questionPrompt(question)}. A IA nao decidiu este ponto.`;
}

function answerSourceLabel(answer?: QuestionnaireAnswer) {
  if (answer?.origin === 'ai') {
    if (answer.sourceType === 'etp' && answer.sourceLabel?.trim()) {
      return `sugestao da IA aprovada pelo usuario, fonte ${answer.sourceLabel.trim()}`;
    }
    return answer.sourcePage ? `sugestao da IA aprovada pelo usuario, pagina ${answer.sourcePage}` : 'sugestao da IA aprovada pelo usuario';
  }

  return 'preenchido pelo usuario';
}

function notAdoptedComment(question: QuestionnaireQuestion, answer?: QuestionnaireAnswer) {
  if (answer?.origin === 'ai') {
    return answer.justification?.trim() ||
      `Trecho nao adotado: alternativa nao selecionada em sugestao da IA aprovada para "${questionPrompt(question)}".`;
  }

  return answer?.justification?.trim() ||
    `Trecho nao adotado: alternativa nao selecionada pelo usuario em "${questionPrompt(question)}".`;
}

function applyOptionValuesToText(
  optionText: string,
  question: QuestionnaireQuestion,
  option: QuestionnaireOption,
  answer: QuestionnaireAnswer | undefined,
  fields: DraftField[],
  warnings: string[],
  missingRequiredFields: string[],
  recordedPlaceholders?: Set<string>,
  blockId?: string,
) {
  const optionValues = normalizeAnswerOptionValues(answer);
  const resolvedBlockId = blockId || option.blockId;
  const occurrenceCounts = new Map<string, number>();
  const occurrences = Array.from(optionText.matchAll(/\[[^\]]+\]/g)).map((match, index) => {
    const placeholder = match[0]?.trim() || '';
    const occurrenceIndex = occurrenceCounts.get(placeholder) || 0;
    occurrenceCounts.set(placeholder, occurrenceIndex + 1);

    return {
      index,
      placeholder,
      occurrenceIndex,
      optionValueKey: buildOptionValueKey(resolvedBlockId, placeholder, occurrenceIndex),
      startIndex: match.index || 0,
      raw: match[0],
    };
  });

  if (occurrences.length === 0) {
    const supplementalField = getSupplementalParcelDeliveryField(optionText, resolvedBlockId);
    if (!supplementalField) {
      return optionText;
    }

    const value = optionValues[supplementalField.key] || optionValues[supplementalField.fallbackKey] || '';
    if (value.trim()) {
      if (!recordedPlaceholders?.has(supplementalField.key)) {
        fields.push({
          key: `${question.id || option.id || option.blockId || 'option'}:${supplementalField.key}`,
          label: supplementalField.label,
          value: value.trim(),
          status: 'confirmed',
          source: answerSourceLabel(answer),
        });
        recordedPlaceholders?.add(supplementalField.key);
      }
      return appendClauseComplement(optionText, value.trim());
    }

    if (!recordedPlaceholders?.has(supplementalField.key)) {
      warnings.push(`Campo pendente na clausula escolhida: ${supplementalField.label}`);
      missingRequiredFields.push(supplementalField.label);
      fields.push({
        key: `${question.id || option.id || option.blockId || 'option'}:${supplementalField.key}`,
        label: supplementalField.label,
        status: 'missing',
        source: 'questionario do modelo',
      });
      recordedPlaceholders?.add(supplementalField.key);
    }

    return appendClauseComplement(optionText, '[CAMPO PENDENTE]');
  }

  const inlineChoiceReplacements = new Map<string, string>();

  for (let index = 0; index < occurrences.length; index += 1) {
    const occurrence = occurrences[index];
    if (
      !occurrence?.placeholder ||
      (!isLiteralInlineChoicePlaceholder(occurrence.placeholder) && !isGenericInlineChoicePlaceholder(occurrence.placeholder))
    ) {
      continue;
    }

    const choiceIndexes = [index];
    for (let nextIndex = index + 1; nextIndex < occurrences.length; nextIndex += 1) {
      const previousOccurrence = occurrences[nextIndex - 1];
      const nextOccurrence = occurrences[nextIndex];
      const betweenText = optionText.slice(
        previousOccurrence.startIndex + previousOccurrence.raw.length,
        nextOccurrence.startIndex,
      );

      if (
        !isInlineChoiceSeparatorText(betweenText) ||
        (!isLiteralInlineChoicePlaceholder(nextOccurrence.placeholder) && !isGenericInlineChoicePlaceholder(nextOccurrence.placeholder))
      ) {
        break;
      }

      choiceIndexes.push(nextIndex);
    }

    if (
      choiceIndexes.length <= 1 ||
      !choiceIndexes.some((choiceIndex) => isLiteralInlineChoicePlaceholder(occurrences[choiceIndex].placeholder))
    ) {
      continue;
    }

    const selectedChoice = choiceIndexes
      .map((choiceIndex) => occurrences[choiceIndex])
      .find((choice) => {
        const value = optionValues[choice.optionValueKey] || optionValues[choice.placeholder] || '';
        return Boolean(value.trim());
      });

    if (selectedChoice) {
      for (const choiceIndex of choiceIndexes) {
        const choice = occurrences[choiceIndex];
        const value = optionValues[choice.optionValueKey] || optionValues[choice.placeholder] || '';
        inlineChoiceReplacements.set(choice.optionValueKey, choice.optionValueKey === selectedChoice.optionValueKey ? value.trim() : '');
      }
    }

    index = choiceIndexes[choiceIndexes.length - 1];
  }

  let replacementIndex = 0;
  const nextText = optionText.replace(/\[[^\]]+\]/g, (rawMatch) => {
    const occurrence = occurrences[replacementIndex];
    replacementIndex += 1;

    if (!occurrence?.placeholder) return rawMatch;

    const inlineReplacement = inlineChoiceReplacements.get(occurrence.optionValueKey);
    if (inlineReplacement !== undefined) {
      if (inlineReplacement && !recordedPlaceholders?.has(occurrence.optionValueKey)) {
        fields.push({
          key: `${question.id || option.id || option.blockId || 'option'}:${occurrence.optionValueKey}`,
          label: occurrence.placeholder,
          value: inlineReplacement,
          status: 'confirmed',
          source: answerSourceLabel(answer),
        });
        recordedPlaceholders?.add(occurrence.optionValueKey);
      }
      return inlineReplacement;
    }

    const value = optionValues[occurrence.optionValueKey] || optionValues[occurrence.placeholder] || '';
    if (value) {
      if (!recordedPlaceholders?.has(occurrence.optionValueKey)) {
        fields.push({
          key: `${question.id || option.id || option.blockId || 'option'}:${occurrence.optionValueKey}`,
          label: occurrence.placeholder,
          value,
          status: 'confirmed',
          source: answerSourceLabel(answer),
        });
        recordedPlaceholders?.add(occurrence.optionValueKey);
      }
      return value;
    }

    if (!recordedPlaceholders?.has(occurrence.optionValueKey)) {
      warnings.push(`Campo pendente na clausula escolhida: ${occurrence.placeholder}`);
      missingRequiredFields.push(occurrence.placeholder);
      fields.push({
        key: `${question.id || option.id || option.blockId || 'option'}:${occurrence.optionValueKey}`,
        label: occurrence.placeholder,
        status: 'missing',
        source: 'questionario do modelo',
      });
      recordedPlaceholders?.add(occurrence.optionValueKey);
    }

    return '[CAMPO PENDENTE]';
  });

  return cleanupInlineOptionText(nextText);
}

function buildQuestionnairePrePlan(request: ReferenceTermRequest, editableBlocks: ValidEditableBlock[]): QuestionnairePrePlan {
  const questions = normalizeQuestionnaireQuestions(request.template?.questionnaireSchema);
  const answers = buildAnswerMap(request.questionnaireAnswers);
  const blockByIndex = new Map(editableBlocks.map((block) => [block.blockIndex, block]));
  const paragraphReplacements: ParagraphReplacement[] = [];
  const tableReplacements: TableReplacement[] = [];
  const warnings: string[] = [];
  const missingRequiredFields: string[] = [];
  const fields: DraftField[] = [];
  const lockedBlockIndexes = new Set<number>();
  const fieldTextByBlock = new Map<number, { block: ValidEditableBlock; text: string; review?: ReviewMark }>();

  for (const question of questions) {
    const questionId = typeof question.id === 'string' ? question.id : '';
    const answer = answers.get(questionId);
    const skipped = !answer || answer.skipped === true;

    if (question.kind === 'exclusive') {
      const options = Array.isArray(question.options) ? question.options : [];
      const selectedOptionId = typeof answer?.selectedOptionId === 'string' ? answer.selectedOptionId : '';

      if (skipped || !selectedOptionId) {
        warnings.push(`Escolha pendente: ${questionPrompt(question)}`);
        missingRequiredFields.push(questionPrompt(question));

        for (const option of options) {
          const blockIndexes = optionBlockIndexes(option);
          const blockIds = optionBlockIds(option, blockIndexes);
          const blockTexts = optionBlockTexts(option, blockIndexes);

          blockIndexes.forEach((blockIndex, groupedIndex) => {
            const text = blockTexts[groupedIndex] || '';
            if (!text) return;

            lockedBlockIndexes.add(blockIndex);
            paragraphReplacements.push({
              blockId: blockIds[groupedIndex] || `block-${blockIndex}`,
              blockIndex,
              paragraphs: [text],
              remove: false,
              review: {
                status: 'pending',
                comment: makePendingComment(question),
              },
            });
          });
        }
        continue;
      }

      const recordedPlaceholders = new Set<string>();

      for (const option of options) {
        const isSelected = option.id === selectedOptionId;
        const blockIndexes = optionBlockIndexes(option);
        const blockIds = optionBlockIds(option, blockIndexes);
        const blockTexts = optionBlockTexts(option, blockIndexes);

        blockIndexes.forEach((blockIndex, groupedIndex) => {
          const text = blockTexts[groupedIndex] || '';
          if (!text) return;

          lockedBlockIndexes.add(blockIndex);

          if (isSelected) {
            paragraphReplacements.push({
              blockId: blockIds[groupedIndex] || `block-${blockIndex}`,
              blockIndex,
              paragraphs: [
                applyOptionValuesToText(
                  text,
                  question,
                  option,
                  answer,
                  fields,
                  warnings,
                  missingRequiredFields,
                  recordedPlaceholders,
                  blockIds[groupedIndex] || `block-${blockIndex}`,
                ),
              ],
              remove: false,
              review: answer?.origin === 'ai'
                ? {
                    status: 'ai_generated',
                    comment: 'Clausula escolhida no questionario da IA e aprovada pelo usuario.',
                  }
                : undefined,
            });
            return;
          }

          paragraphReplacements.push({
            blockId: blockIds[groupedIndex] || `block-${blockIndex}`,
            blockIndex,
            paragraphs: [text],
            remove: false,
            review: {
              status: 'not_adopted',
              comment: notAdoptedComment(question, answer),
            },
          });
        });
      }
      continue;
    }

    if (question.kind === 'optional') {
      const blockIndex = typeof question.blockIndex === 'number' ? question.blockIndex : -1;
      const block = blockByIndex.get(blockIndex);
      if (!block || block.kind !== 'paragraph') continue;

      lockedBlockIndexes.add(block.blockIndex);
      const selectedOptionId = typeof answer?.selectedOptionId === 'string' ? answer.selectedOptionId : '';

      if (skipped || !selectedOptionId) {
        warnings.push(`Clausula opcional pendente: ${questionPrompt(question)}`);
        missingRequiredFields.push(questionPrompt(question));
        paragraphReplacements.push({
          blockId: block.id,
          blockIndex: block.blockIndex,
          paragraphs: [block.text],
          remove: false,
          review: {
            status: 'pending',
            comment: makePendingComment(question),
          },
        });
        continue;
      }

      if (selectedOptionId.includes('strike')) {
        paragraphReplacements.push({
          blockId: block.id,
          blockIndex: block.blockIndex,
          paragraphs: [block.text],
          remove: false,
          review: {
            status: 'not_adopted',
            comment: answer?.justification?.trim() || `Trecho nao adotado: ${questionPrompt(question)}.`,
          },
        });
        continue;
      }

      const options = Array.isArray(question.options) ? question.options : [];
      const selectedOption = options.find((option) => option.id === selectedOptionId);
      const replacementText = selectedOption
        ? applyOptionValuesToText(
            selectedOption.text?.trim() || block.text,
            question,
            selectedOption,
            answer,
            fields,
            warnings,
            missingRequiredFields,
            undefined,
            block.id,
          )
        : block.text;
      paragraphReplacements.push({
        blockId: block.id,
        blockIndex: block.blockIndex,
        paragraphs: [replacementText],
        remove: false,
        review: answer?.origin === 'ai'
          ? {
              status: 'ai_generated',
              comment: 'Clausula opcional mantida a partir de sugestao da IA aprovada pelo usuario.',
            }
          : undefined,
      });
      continue;
    }

    if (question.kind === 'field') {
      const blockIndex = typeof question.blockIndex === 'number' ? question.blockIndex : -1;
      const block = blockByIndex.get(blockIndex);
      if (!block || block.kind !== 'paragraph') continue;

      lockedBlockIndexes.add(block.blockIndex);
      const current = fieldTextByBlock.get(block.blockIndex) || { block, text: block.text };
      const value = typeof answer?.value === 'string' ? answer.value.trim() : '';

      if (skipped || !value) {
        current.text = replaceQuestionPlaceholder(current.text, question.placeholder, '[CAMPO PENDENTE]');
        current.review = {
          status: 'pending',
          comment: makePendingComment(question),
        };
        warnings.push(`Campo pendente: ${questionPrompt(question)}`);
        missingRequiredFields.push(question.placeholder || questionPrompt(question));
        fields.push({
          key: questionId,
          label: questionPrompt(question),
          status: 'missing',
          source: 'questionario do modelo',
        });
      } else {
        current.text = replaceQuestionPlaceholder(current.text, question.placeholder, value);
        fields.push({
          key: questionId,
          label: questionPrompt(question),
          value,
          status: 'confirmed',
          source: answerSourceLabel(answer),
        });
      }

      fieldTextByBlock.set(block.blockIndex, current);
    }
  }

  for (const entry of fieldTextByBlock.values()) {
    paragraphReplacements.push({
      blockId: entry.block.id,
      blockIndex: entry.block.blockIndex,
      paragraphs: [entry.text],
      remove: false,
      review: entry.review,
    });
  }

  return {
    warnings,
    missingRequiredFields,
    fields,
    templatePlan: {
      paragraphReplacements,
      tableReplacements,
    },
    model: questions.length > 0 ? 'questionario-local' : undefined,
    lockedBlockIndexes,
  };
}

function splitBlocksIntoSections(blocks: ValidEditableBlock[]): ValidEditableBlock[][] {
  const sections: ValidEditableBlock[][] = [];
  let current: ValidEditableBlock[] = [];
  let currentSize = 0;

  for (const block of blocks) {
    const blockSize = block.text.length;
    const shouldStartNewSection =
      current.length > 0 &&
      (current.length >= MAX_BLOCKS_PER_SECTION || currentSize + blockSize > MAX_SECTION_TEXT_CHARS);

    if (shouldStartNewSection) {
      sections.push(current);
      current = [];
      currentSize = 0;
    }

    current.push(block);
    currentSize += blockSize;
  }

  if (current.length > 0) {
    sections.push(current);
  }

  return sections;
}

function buildSnippetContext(request: ReferenceTermRequest) {
  const snippets = request.contextSnippets || [];
  const compact = snippets.map((snippet) => ({
    label: snippet.label,
    kind: snippet.kind,
    pageNumber: snippet.pageNumber,
    sourceType: snippet.sourceType,
    sourceName: snippet.sourceName,
    sourceLabel: snippet.sourceLabel,
    excerpt: truncate(String(snippet.excerpt || ''), 600),
  }));

  return truncate(JSON.stringify(compact, null, 2), MAX_SNIPPET_CHARS);
}

function buildSectionPrompt(
  request: ReferenceTermRequest,
  blocks: ValidEditableBlock[],
  sectionIndex: number,
  totalSections: number,
) {
  return [
    'Voce e um assistente especializado em contratacoes publicas e elabora Termos de Referencia de compras sob a Lei 14.133/2021.',
    'Gere somente os preenchimentos dos blocos editaveis informados nesta parte. Nao gere o documento inteiro.',
    'Use o modelo DOCX como base juridica e estrutural, mas responda apenas com os blocos desta parte.',
    'Use os trechos de apoio como contexto factual. Eles podem vir do processo, de anexos opcionais ou do ETP editado no editor.',
    'Quando houver fonte ETP, trate-a como contexto de planejamento revisado pelo usuario, mas mantenha pendencias para dados concretos ausentes.',
    'Nao invente dados. Quando faltar informacao obrigatoria, use [CAMPO PENDENTE] no texto final e registre o campo em missingRequiredFields.',
    'Responda somente JSON valido. Nao use markdown. Nao inclua HTML.',
    'O JSON deve seguir exatamente este formato:',
    '{"status":"generated","warnings":["..."],"missingRequiredFields":["..."],"fields":[{"key":"objeto","label":"Objeto","value":"...","status":"confirmed|inferred|missing","source":"pagina X"}],"templatePlan":{"paragraphReplacements":[{"blockId":"block-10","blockIndex":10,"paragraphs":["texto final sem HTML"],"remove":false}],"tableReplacements":[{"blockId":"block-12","blockIndex":12,"rows":[["1","Descricao","UN","10","100,00","1.000,00"]]}]}}',
    '',
    'Regras obrigatorias:',
    '- use blockId e blockIndex exatamente como recebidos;',
    '- para blocos paragraph, retorne paragraphReplacements com textos finais em portugues, sem tags HTML;',
    '- para blocos table, retorne tableReplacements com linhas de dados, sem cabecalho;',
    '- nunca apague silenciosamente texto do modelo AGU; nao use remove=true;',
    '- se nao houver fonte para preencher, mantenha [CAMPO PENDENTE] e registre a pendencia;',
    '- nao escolha clausulas alternativas marcadas como pendentes no questionario do usuario;',
    '- textos preenchidos por voce serao marcados no DOCX como preenchimento por IA;',
    '- preserve a natureza juridica do Termo de Referencia para compras sob a Lei 14.133/2021.',
    '',
    `Parte ${sectionIndex + 1} de ${totalSections}`,
    '',
    `Processo: ${JSON.stringify(request.processo || {}, null, 2)}`,
    '',
    `Modelo: ${JSON.stringify({
      id: request.template?.id,
      code: request.template?.code,
      name: request.template?.name,
      description: request.template?.description,
      versionLabel: request.template?.versionLabel,
      fileName: request.template?.fileName,
    }, null, 2)}`,
    '',
    `Blocos desta parte:\n${JSON.stringify(blocks, null, 2)}`,
    '',
    `Trechos de apoio:\n${buildSnippetContext(request)}`,
    '',
    `Alertas da analise local:\n${JSON.stringify(request.analysisWarnings || [], null, 2)}`,
  ].join('\n');
}

function normalizeSectionDraftResult(raw: Record<string, unknown>): SectionDraftResult {
  const warnings = toStringArray(raw.warnings);
  const missingRequiredFields = toStringArray(raw.missingRequiredFields);
  const fields = normalizeFields(raw.fields);

  return {
    warnings,
    missingRequiredFields,
    fields,
    templatePlan: normalizeTemplatePlan(raw.templatePlan),
  };
}

function buildFallbackSection(blocks: ValidEditableBlock[], reason: string): SectionDraftResult {
  const paragraphReplacements: ParagraphReplacement[] = [];
  const tableReplacements: TableReplacement[] = [];

  for (const block of blocks) {
    if (block.kind === 'table') {
      tableReplacements.push({
        blockId: block.id,
        blockIndex: block.blockIndex,
        rows: [['[CAMPO PENDENTE]', truncate(block.excerpt || block.text, 120)]],
        review: {
          status: 'pending',
          comment: reason,
        },
      });
      continue;
    }

    paragraphReplacements.push({
      blockId: block.id,
      blockIndex: block.blockIndex,
      paragraphs: [`[CAMPO PENDENTE] ${truncate(block.excerpt || block.text, 180)}`],
      remove: false,
      review: {
        status: 'pending',
        comment: reason,
      },
    });
  }

  return {
    warnings: [reason],
    missingRequiredFields: blocks.map((block) => block.excerpt || block.text),
    fields: [],
    templatePlan: {
      paragraphReplacements,
      tableReplacements,
    },
    model: 'fallback-local',
  };
}

function ensureSectionCoverage(section: SectionDraftResult, blocks: ValidEditableBlock[]): SectionDraftResult {
  const paragraphReplacements = [...section.templatePlan.paragraphReplacements];
  const tableReplacements = [...section.templatePlan.tableReplacements];
  const warnings = [...section.warnings];
  const missingRequiredFields = [...section.missingRequiredFields];

  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      const covered = paragraphReplacements.some(
        (replacement) => replacement.blockId === block.id || replacement.blockIndex === block.blockIndex,
      );

      if (!covered) {
        paragraphReplacements.push({
          blockId: block.id,
          blockIndex: block.blockIndex,
          paragraphs: [`[CAMPO PENDENTE] ${truncate(block.excerpt || block.text, 180)}`],
          remove: false,
          review: {
            status: 'pending',
            comment: 'A IA nao devolveu preenchimento para este bloco; ficou pendente para revisao.',
          },
        });
        missingRequiredFields.push(block.excerpt || block.text);
      }
      continue;
    }

    const covered = tableReplacements.some(
      (replacement) => replacement.blockId === block.id || replacement.blockIndex === block.blockIndex,
    );

    if (!covered) {
      tableReplacements.push({
        blockId: block.id,
        blockIndex: block.blockIndex,
        rows: [['[CAMPO PENDENTE]', truncate(block.excerpt || block.text, 120)]],
        review: {
          status: 'pending',
          comment: 'A IA nao devolveu preenchimento para esta tabela; ficou pendente para revisao.',
        },
      });
      missingRequiredFields.push(block.excerpt || block.text);
    }
  }

  if (missingRequiredFields.length > section.missingRequiredFields.length) {
    warnings.push('Alguns blocos do modelo nao foram preenchidos pela IA e ficaram marcados como pendentes.');
  }

  return {
    ...section,
    warnings,
    missingRequiredFields,
    templatePlan: {
      paragraphReplacements,
      tableReplacements,
    },
  };
}

function aiReviewForParagraph(replacement: ParagraphReplacement): ReviewMark {
  const text = replacement.paragraphs.join(' ');
  if (text.includes('[CAMPO PENDENTE]')) {
    return {
      status: 'pending',
      comment: 'Campo mantido pendente pela IA por falta de informacao segura no processo.',
    };
  }

  return {
    status: 'ai_generated',
    comment: 'Preenchido pela IA a partir dos dados do processo. Revisar antes da assinatura.',
  };
}

function aiReviewForTable(replacement: TableReplacement): ReviewMark {
  const text = replacement.rows.flat().join(' ');
  if (text.includes('[CAMPO PENDENTE]')) {
    return {
      status: 'pending',
      comment: 'Tabela mantida pendente pela IA por falta de informacao segura no processo.',
    };
  }

  return {
    status: 'ai_generated',
    comment: 'Tabela preenchida pela IA a partir dos dados do processo. Revisar antes da assinatura.',
  };
}

function markAiGeneratedReview(section: SectionDraftResult): SectionDraftResult {
  return {
    ...section,
    templatePlan: {
      paragraphReplacements: section.templatePlan.paragraphReplacements.map((replacement) => ({
        ...replacement,
        review: replacement.review || aiReviewForParagraph(replacement),
      })),
      tableReplacements: section.templatePlan.tableReplacements.map((replacement) => ({
        ...replacement,
        review: replacement.review || aiReviewForTable(replacement),
      })),
    },
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function wrapReviewHtml(value: string, review?: ReviewMark) {
  const escaped = escapeHtml(value);
  if (!review) return escaped;

  const title = review.comment ? ` title="${escapeHtml(review.comment)}"` : '';

  if (review.status === 'not_adopted') {
    return `<s${title} style="color:#6b7280;">${escaped}</s>`;
  }

  if (review.status === 'added') {
    return `<strong${title} style="color:#0070c0;">${escaped}</strong>`;
  }

  if (review.status === 'ai_generated') {
    return `<span${title} style="background:#fef3c7;">${escaped}</span>`;
  }

  return `<mark${title} style="background:#fde68a;color:#991b1b;">${escaped}</mark>`;
}

function buildHtmlFromPlan(plan: TemplatePlan) {
  const entries = [
    ...plan.paragraphReplacements.map((replacement) => ({ kind: 'paragraph' as const, blockIndex: replacement.blockIndex, replacement })),
    ...plan.tableReplacements.map((replacement) => ({ kind: 'table' as const, blockIndex: replacement.blockIndex, replacement })),
  ].sort((left, right) => left.blockIndex - right.blockIndex);

  const fragments: string[] = [];

  for (const entry of entries) {
    if (entry.kind === 'paragraph') {
      if (entry.replacement.remove === true) continue;
      for (const paragraph of entry.replacement.paragraphs) {
        fragments.push(`<p>${wrapReviewHtml(paragraph, entry.replacement.review)}</p>`);
      }
      continue;
    }

    if (entry.replacement.rows.length === 0) continue;

    const rows = entry.replacement.rows
      .map((row) => `<tr>${row.map((cell) => `<td>${wrapReviewHtml(cell, entry.replacement.review)}</td>`).join('')}</tr>`)
      .join('');
    fragments.push(`<table><tbody>${rows}</tbody></table>`);
  }

  return fragments.length > 0 ? `<div>${fragments.join('\n')}</div>` : '<p>[CAMPO PENDENTE]</p>';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueFields(fields: DraftField[]) {
  const seen = new Set<string>();
  const unique: DraftField[] = [];

  for (const field of fields) {
    const key = `${field.key}:${field.label}:${field.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(field);
  }

  return unique;
}

async function callGemini(prompt: string, geminiApiKey: string, model: string) {
  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const responseBody = await geminiResponse.json();

  if (!geminiResponse.ok) {
    const errorMessage =
      (responseBody?.error && typeof responseBody.error === 'object' && 'message' in responseBody.error
        ? String(responseBody.error.message)
        : '') || 'O Gemini recusou a geracao do Termo de Referencia.';

    throw new Error(errorMessage);
  }

  const content = extractGeminiText(responseBody as Record<string, unknown>);
  if (!content) {
    throw new Error('A resposta do Gemini veio vazia.');
  }

  return content;
}

async function callGeminiWithFallback(prompt: string, geminiApiKey: string, modelCandidates: string[]) {
  const errors: string[] = [];

  for (const model of modelCandidates) {
    try {
      return {
        content: await callGemini(prompt, geminiApiKey, model),
        model,
      };
    } catch (error) {
      errors.push(`${model}: ${error instanceof Error ? error.message : 'falha desconhecida'}`);
    }
  }

  throw new Error(`Nao foi possivel gerar esta parte com os modelos Gemini configurados. ${errors.join(' | ')}`);
}

async function generateSection(
  request: ReferenceTermRequest,
  blocks: ValidEditableBlock[],
  sectionIndex: number,
  totalSections: number,
  geminiApiKey: string,
  modelCandidates: string[],
) {
  const prompt = buildSectionPrompt(request, blocks, sectionIndex, totalSections);
  const { content, model } = await callGeminiWithFallback(prompt, geminiApiKey, modelCandidates);

  try {
    return {
      ...ensureSectionCoverage(markAiGeneratedReview(normalizeSectionDraftResult(parseGeminiJson(content))), blocks),
      model,
    };
  } catch (error) {
    const reason = error instanceof Error
      ? `A IA retornou JSON invalido na parte ${sectionIndex + 1}. A parte ficou pendente para revisao.`
      : `A parte ${sectionIndex + 1} ficou pendente para revisao.`;
    return buildFallbackSection(blocks, reason);
  }
}

function buildCombinedResult(
  request: ReferenceTermRequest,
  sections: SectionDraftResult[],
  sectionCount: number,
) {
  const paragraphReplacements = sections.flatMap((section) => section.templatePlan.paragraphReplacements);
  const tableReplacements = sections.flatMap((section) => section.templatePlan.tableReplacements);
  const warnings = uniqueStrings([
    ...(request.analysisWarnings || []),
    ...sections.flatMap((section) => section.warnings),
    sectionCount > 1 ? `Documento gerado em ${sectionCount} partes para evitar truncamento da resposta da IA.` : '',
  ]);
  const missingRequiredFields = uniqueStrings(sections.flatMap((section) => section.missingRequiredFields));
  const fields = uniqueFields(sections.flatMap((section) => section.fields));
  const processo = request.processo || {};
  const processNumber = typeof processo.numProcesso === 'string' && processo.numProcesso.trim()
    ? processo.numProcesso.trim()
    : undefined;

  const templatePlan = {
    paragraphReplacements,
    tableReplacements,
  };
  const modelsUsed = uniqueStrings(sections.map((section) => section.model || 'gemini'));

  return {
    status: 'generated',
    title: request.template?.name || 'Termo de Referencia - Compras',
    subtitle: processNumber ? `Processo ${processNumber}` : request.template?.fileName,
    html: buildHtmlFromPlan(templatePlan),
    warnings,
    missingRequiredFields,
    fields,
    sources: buildSources(request),
    model: modelsUsed.join(', '),
    templatePlan,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as ReferenceTermRequest;
    if (!body.template?.templateText || !Array.isArray(body.template?.editableBlocks) || body.template.editableBlocks.length === 0) {
      return jsonResponse(
        { error: 'Envie o modelo ativo do Termo de Referencia com os blocos editaveis extraidos do DOCX.' },
        400,
      );
    }

    const editableBlocks = normalizeEditableBlocks(body.template.editableBlocks);
    if (editableBlocks.length === 0) {
      return jsonResponse(
        { error: 'O modelo ativo nao possui blocos editaveis validos para gerar o Termo de Referencia.' },
        400,
      );
    }

    const questionnairePrePlan = buildQuestionnairePrePlan(body, editableBlocks);
    const aiEditableBlocks = editableBlocks.filter((block) => !questionnairePrePlan.lockedBlockIndexes.has(block.blockIndex));
    const sectionResults: SectionDraftResult[] = [];

    if (
      questionnairePrePlan.templatePlan.paragraphReplacements.length > 0 ||
      questionnairePrePlan.templatePlan.tableReplacements.length > 0 ||
      questionnairePrePlan.fields.length > 0 ||
      questionnairePrePlan.warnings.length > 0
    ) {
      sectionResults.push(questionnairePrePlan);
    }

    const sections = splitBlocksIntoSections(aiEditableBlocks);

    if (sections.length > 0) {
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        return jsonResponse(
          {
            error:
              'A funcao de geracao de Termo de Referencia precisa de GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY ou GOOGLE_API_KEY no ambiente do Supabase para preencher campos restantes pela IA.',
          },
          500,
        );
      }

      const modelCandidates = getModelCandidates();

      for (let index = 0; index < sections.length; index += 1) {
        sectionResults.push(
          await generateSection(body, sections[index], index, sections.length, geminiApiKey, modelCandidates),
        );
      }
    }

    return jsonResponse(buildCombinedResult(body, sectionResults, Math.max(sections.length, 1)));
  } catch (error) {
    console.error('gerar-termo-referencia-compras', error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Falha inesperada ao gerar o Termo de Referencia.',
      },
      500,
    );
  }
});
