import type {
  DocumentTemplateEditableBlock,
  DocumentTemplateQuestion,
  DocumentTemplateQuestionOption,
  DocumentTemplateQuestionnaireSchema,
} from '@/services/documentTemplates';

export type ReferenceTermFieldInstruction = {
  label: string;
  instruction: string;
  inputPlaceholder: string;
  example?: string;
  modelField: string;
};

export type ReferenceTermDisplayPreview = {
  summary: string;
  originalText: string;
};

export type ReferenceTermOptionInputField = {
  kind: 'input';
  key: string;
  placeholder: string;
  instruction: ReferenceTermFieldInstruction;
};

export type ReferenceTermOptionChoiceField = {
  kind: 'choice';
  key: string;
  label: string;
  instruction: string;
  choices: Array<{
    key: string;
    placeholder: string;
    label: string;
    value: string;
    inputPlaceholder?: string;
    inputValuePrefix?: string;
    requiresInput?: boolean;
  }>;
};

export type ReferenceTermOptionField = ReferenceTermOptionInputField | ReferenceTermOptionChoiceField;

const GENERIC_FIELD_TITLE = 'CAMPO PREVISTO NO MODELO';
const PLACEHOLDER_REGEX = /\[[^\]]+\]/g;
const PARCEL_DELIVERY_SCHEDULE_FIELD_ID = 'prazos-condicoes-parcelas';

const contextDependentTokens = new Set([
  'ANO',
  'DIA',
  'MES',
  'MÊS',
  'LOCAL',
  'TOTAL',
  'NORMAL',
  'ADICIONAL',
]);

const contextualRules: Array<{
  match: (normalizedSourceText: string, normalizedModelField: string) => boolean;
  label: string;
  instruction: string;
  inputPlaceholder: string;
}> = [
  {
    match: (sourceText, modelField) => sourceText.includes('PLANO DE CONTRATACOES ANUAL') && modelField === 'ANO',
    label: 'Ano do Plano de Contratacoes Anual',
    instruction: 'Informe o ano do Plano de Contratacoes Anual que ampara esta contratacao.',
    inputPlaceholder: 'Ex.: 2026.',
  },
  {
    match: (sourceText) => sourceText.includes('ID PCA NO PNCP'),
    label: 'ID PCA no PNCP',
    instruction: 'Informe o identificador do PCA publicado no PNCP para esta contratacao.',
    inputPlaceholder: 'Ex.: 123456.',
  },
  {
    match: (sourceText) => sourceText.includes('DATA DE PUBLICACAO NO PNCP'),
    label: 'Data de publicacao no PNCP',
    instruction: 'Informe a data de publicacao do item correspondente no PNCP.',
    inputPlaceholder: 'Ex.: 22/04/2026.',
  },
  {
    match: (sourceText) => sourceText.includes('ID DO ITEM NO PCA'),
    label: 'ID do item no PCA',
    instruction: 'Informe o identificador do item no Plano de Contratacoes Anual.',
    inputPlaceholder: 'Ex.: 7890.',
  },
  {
    match: (sourceText) => sourceText.includes('CLASSE/GRUPO'),
    label: 'Classe ou grupo do PCA',
    instruction: 'Informe a classe ou grupo cadastrado no PCA para o objeto desta contratacao.',
    inputPlaceholder: 'Ex.: mobiliario e equipamentos de escritorio.',
  },
  {
    match: (sourceText) => sourceText.includes('IDENTIFICADOR DA FUTURA CONTRATACAO'),
    label: 'Identificador da futura contratacao',
    instruction: 'Informe o identificador da futura contratacao vinculado a este processo.',
    inputPlaceholder: 'Ex.: FC-2026-001.',
  },
  {
    match: (_, modelField) => modelField.includes('NUMERO') && modelField.includes('NOTA TECNICA'),
    label: 'Numero da nota tecnica',
    instruction: 'Informe o numero da nota tecnica citada neste ponto do modelo.',
    inputPlaceholder: 'Ex.: 12/2026.',
  },
  {
    match: (_, modelField) =>
      modelField.includes('TERMO INICIAL') || modelField.includes('VIGENCIA'),
    label: 'Termo inicial da vigencia',
    instruction: 'Informe o marco inicial usado para contar a vigencia contratual.',
    inputPlaceholder: 'Ex.: data da assinatura do contrato.',
  },
  {
    match: (sourceText) => sourceText.includes('ID DO ITEM'),
    label: 'Identificador do item',
    instruction: 'Informe o identificador do item referido neste ponto do modelo.',
    inputPlaceholder: 'Ex.: item 3 do PCA.',
  },
];

const placeholderRules: Array<{
  keywords: string[];
  label: string;
  instruction: string;
  inputPlaceholder: string;
  example?: string;
}> = [
  {
    keywords: ['OBJETO'],
    label: 'Objeto da contratacao',
    instruction:
      'Descreva o bem ou servico que sera contratado, incluindo finalidade, escopo e caracteristicas essenciais. Evite copiar apenas o titulo do processo.',
    inputPlaceholder: 'Ex.: aquisicao de mesas para computador para os laboratorios administrativos do campus.',
    example: 'Inclua informacoes que mudam a natureza do item, como uso, aplicacao, material, instalacao ou compatibilidade.',
  },
  {
    keywords: ['PRAZO', 'VIGENCIA'],
    label: 'Prazo e vigencia',
    instruction:
      'Informe a duracao da contratacao, o marco inicial de contagem e, quando couber, a regra de prorrogacao prevista para o objeto.',
    inputPlaceholder: 'Ex.: 12 meses, contados da assinatura do contrato.',
  },
  {
    keywords: ['LOCAL', 'ENTREGA', 'RECEBIMENTO', 'ENDERECO'],
    label: 'Local e condicoes de entrega',
    instruction:
      'Informe onde o objeto sera entregue ou executado, prazo de entrega, unidade responsavel pelo recebimento e condicoes especiais.',
    inputPlaceholder: 'Ex.: Almoxarifado do Campus Natal-Central, em ate 30 dias corridos apos a nota de empenho.',
  },
  {
    keywords: ['INSTALACAO', 'MONTAGEM', 'ATIVIDADES'],
    label: 'Instalacao, montagem ou atividades incluidas',
    instruction:
      'Liste as atividades acessorias exigidas do fornecedor, como instalacao, montagem, configuracao, treinamento, retirada de embalagem ou descarte.',
    inputPlaceholder: 'Ex.: montagem no local de entrega, regulagem inicial e retirada das embalagens.',
  },
  {
    keywords: ['GARANTIA', 'ASSISTENCIA'],
    label: 'Garantia e assistencia tecnica',
    instruction:
      'Informe prazo de garantia, forma de acionamento, prazo de atendimento e cobertura minima exigida do fornecedor.',
    inputPlaceholder: 'Ex.: garantia minima de 12 meses, com atendimento em ate 5 dias uteis apos chamado.',
  },
  {
    keywords: ['PAGAMENTO'],
    label: 'Condicoes de pagamento',
    instruction:
      'Informe quando e como o pagamento sera feito, vinculando-o ao recebimento definitivo, nota fiscal e demais documentos exigidos.',
    inputPlaceholder: 'Ex.: pagamento em ate 10 dias uteis apos recebimento definitivo e atesto da nota fiscal.',
  },
  {
    keywords: ['SUSTENTABILIDADE', 'AMBIENTAL'],
    label: 'Criterios de sustentabilidade',
    instruction:
      'Informe exigencias ambientais ou de sustentabilidade aplicaveis ao objeto, somente quando houver fundamento no processo ou no modelo.',
    inputPlaceholder: 'Ex.: embalagem reciclavel e atendimento as normas ambientais aplicaveis ao produto.',
  },
  {
    keywords: ['JUSTIFICATIVA', 'NECESSIDADE'],
    label: 'Justificativa da contratacao',
    instruction:
      'Explique a necessidade administrativa que o objeto atende, preferencialmente com base no DFD, ETP ou justificativa do processo.',
    inputPlaceholder: 'Ex.: substituir mobiliario danificado nas salas de atendimento para garantir condicoes adequadas de trabalho.',
  },
  {
    keywords: ['QUANTIDADE', 'QUANTITATIVO', 'ITEM'],
    label: 'Itens e quantitativos',
    instruction:
      'Informe os itens, quantidades, unidades de medida e parametros usados para estimar a demanda.',
    inputPlaceholder: 'Ex.: 20 unidades, conforme levantamento de demanda das unidades requisitantes.',
  },
  {
    keywords: ['VALOR', 'ESTIMATIVA', 'PRECO'],
    label: 'Estimativa de valor',
    instruction:
      'Informe o valor estimado e, quando couber, a base da pesquisa de precos usada no processo.',
    inputPlaceholder: 'Ex.: valor estimado de R$ 25.000,00, conforme mapa de pesquisa de precos.',
  },
];

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractReferenceTermPlaceholders(value?: string) {
  if (!value) return [];
  return [...new Set(Array.from(value.matchAll(PLACEHOLDER_REGEX)).map((match) => match[0].trim()).filter(Boolean))];
}

export function normalizeReferenceTermText(value: string) {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function cleanReferenceTermModelField(value?: string) {
  const withoutBrackets = collapseWhitespace((value || ''))
    .replace(/^\s*\[/, '')
    .replace(/\]\s*$/, '');
  const cleaned = withoutBrackets
    .replace(/[.;:,]+$/, '')
    .trim();

  if (cleaned) {
    return cleaned;
  }

  if (withoutBrackets.trim()) {
    return withoutBrackets.trim();
  }

  return 'campo previsto no modelo';
}

function isLiteralChoicePlaceholder(value: string) {
  const cleaned = cleanReferenceTermModelField(value);
  if (!cleaned) return false;

  const normalized = normalizeReferenceTermText(cleaned);
  if (normalized.length < 10) return false;
  return /(?:ESTUDO TECNICO PRELIMINAR|NOTA TECNICA|TERMO DE REFERENCIA|PARECER|JUSTIFICATIVA|MEMORIAL|RELATORIO)/.test(normalized);
}

function buildTechnicalNoteInputPrefix(value: string) {
  const cleaned = cleanReferenceTermModelField(value);
  const normalized = normalizeReferenceTermText(cleaned);
  if (!normalized.includes('NOTA TECNICA')) return '';

  const prefix = cleaned
    .replace(/\s*\.\.\.\/?\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return prefix ? `${prefix} ` : '';
}

function isGenericInlineChoicePlaceholder(value: string) {
  return normalizeReferenceTermText(cleanReferenceTermModelField(value)) === '...';
}

function isInlineChoiceSeparator(value: string) {
  const normalized = normalizeReferenceTermText(value).replace(/^[,.;:]+|[,.;:]+$/g, '').trim();
  return normalized === 'OU';
}

function buildInlineChoiceLabel(choices: string[]) {
  const normalizedChoices = choices.map((choice) => normalizeReferenceTermText(choice));
  if (
    normalizedChoices.some((choice) => choice.includes('ESTUDO TECNICO PRELIMINAR')) &&
    normalizedChoices.some((choice) => choice.includes('NOTA TECNICA'))
  ) {
    return {
      label: 'Documento de referencia',
      instruction: 'Escolha qual documento deve permanecer citado nesta clausula.',
    };
  }

  return {
    label: 'Alternativa da clausula',
    instruction: 'Escolha qual texto deve permanecer ativo neste ponto da clausula.',
  };
}

function extractQuestionPlaceholder(question: Pick<DocumentTemplateQuestion, 'placeholder' | 'prompt' | 'title'>) {
  if (question.placeholder?.trim()) {
    return question.placeholder.trim();
  }

  return question.prompt.match(PLACEHOLDER_REGEX)?.[0]?.trim() || question.title.match(PLACEHOLDER_REGEX)?.[0]?.trim() || '';
}

function normalizePunctuationOnly(value: string) {
  return value.replace(/[\s.[\]()/\\\-_:;,]+/g, '');
}

function isTrivialModelField(modelField: string) {
  return normalizePunctuationOnly(modelField).length === 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripQuestionNumbering(value: string) {
  return value.replace(/^\d+(?:\.\d+)*\s*/g, '').trim();
}

function cleanupDerivedLabel(value: string) {
  const cleaned = stripQuestionNumbering(value)
    .replace(/\s+/g, ' ')
    .replace(/\s*[:;,.]+$/, '')
    .trim();

  if (!cleaned) return '';

  const normalized = normalizeReferenceTermText(cleaned);
  if (normalized === 'CLASSE/GRUPO') return 'Classe ou grupo';
  if (normalized === 'ID PCA NO PNCP') return 'ID PCA no PNCP';
  if (normalized === 'ID DO ITEM NO PCA') return 'ID do item no PCA';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function splitReferenceTermContextSegments(value: string) {
  return value
    .split(/(?:;|\n|\r|•|\u2022)/g)
    .map((segment) => collapseWhitespace(segment))
    .filter(Boolean);
}

function findPlaceholderOccurrenceIndex(sourceText: string, placeholder: string, occurrenceIndex: number) {
  if (!placeholder) return -1;

  let startAt = 0;
  for (let currentOccurrence = 0; currentOccurrence <= occurrenceIndex; currentOccurrence += 1) {
    const foundIndex = sourceText.indexOf(placeholder, startAt);
    if (foundIndex < 0) return -1;
    if (currentOccurrence === occurrenceIndex) return foundIndex;
    startAt = foundIndex + placeholder.length;
  }

  return -1;
}

function extractPlaceholderContext(sourceText: string, placeholder: string, occurrenceIndex: number) {
  const collapsedSourceText = collapseWhitespace(sourceText);
  const placeholderIndex = findPlaceholderOccurrenceIndex(collapsedSourceText, placeholder, occurrenceIndex);
  if (placeholderIndex < 0) {
    return {
      beforeText: collapsedSourceText,
      afterText: '',
      excerpt: truncateReferenceTermDisplayText(collapsedSourceText, 160),
    };
  }

  const beforeText = collapsedSourceText.slice(0, placeholderIndex).trim();
  const afterText = collapsedSourceText.slice(placeholderIndex + placeholder.length).trim();
  const excerptStart = Math.max(0, placeholderIndex - 95);
  const excerptEnd = Math.min(collapsedSourceText.length, placeholderIndex + placeholder.length + 95);
  const rawExcerpt = collapsedSourceText.slice(excerptStart, excerptEnd);
  const excerptPrefix = excerptStart > 0 ? '...' : '';
  const excerptSuffix = excerptEnd < collapsedSourceText.length ? '...' : '';

  return {
    beforeText,
    afterText,
    excerpt: truncateReferenceTermDisplayText(`${excerptPrefix}${rawExcerpt}${excerptSuffix}`, 170),
  };
}

function buildContextualFallbackInstruction(sourceText: string, placeholder: string, occurrenceIndex: number) {
  const { beforeText, excerpt } = extractPlaceholderContext(sourceText, placeholder, occurrenceIndex);
  const normalizedExcerpt = normalizeReferenceTermText(excerpt);

  if (
    !normalizedExcerpt ||
    normalizedExcerpt === normalizeReferenceTermText(placeholder) ||
    normalizePunctuationOnly(excerpt.replace(placeholder, '')).length === 0
  ) {
    return null;
  }

  const lastSegment = splitReferenceTermContextSegments(beforeText).pop() || beforeText;
  const labelSource = cleanupDerivedLabel(
    lastSegment
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\b(?:conforme|nos termos|na forma)\b.*$/i, '')
      .trim(),
  );
  const summary = summarizeReferenceTermDisplayText(excerpt.replace(placeholder, '[...]'), 95);
  const label = labelSource && normalizeReferenceTermText(labelSource) !== 'OU'
    ? labelSource
    : `Lacuna no trecho: ${summary}`;

  if (!label || normalizeReferenceTermText(label) === normalizeReferenceTermText(cleanReferenceTermModelField(placeholder))) {
    return null;
  }

  return {
    label,
    instruction: `Preencha a lacuna marcada neste trecho do modelo: "${summary}".`,
    inputPlaceholder: 'Preencha esta lacuna com base no processo.',
  };
}

function deriveLabelFromSourceText(sourceText: string, placeholder: string, normalizedSourceText: string, occurrenceIndex = 0) {
  const normalizedPlaceholder = normalizeReferenceTermText(cleanReferenceTermModelField(placeholder));
  const { beforeText } = extractPlaceholderContext(sourceText, placeholder, occurrenceIndex);
  const localBeforeText = (splitReferenceTermContextSegments(beforeText).pop() || beforeText).slice(-180);
  const normalizedLocalBeforeText = normalizeReferenceTermText(localBeforeText);

  if (
    normalizedPlaceholder === '...' &&
    normalizedSourceText.includes('FORNECIMENTO DE BENS') &&
    normalizedSourceText.includes('ENQUADRADO COMO CONTINUADO') &&
    normalizedLocalBeforeText.endsWith('TENDO EM VISTA QUE')
  ) {
    return {
      label: 'Justificativa do fornecimento continuado',
      instruction: 'Informe a razao objetiva para enquadrar o fornecimento como continuado neste processo.',
      inputPlaceholder: 'Ex.: necessidade permanente de reposicao do estoque institucional.',
    };
  }

  if (
    normalizedPlaceholder === '...' &&
    normalizedSourceText.includes('VIGENCIA PLURIANUAL') &&
    normalizedLocalBeforeText.endsWith('CONSIDERANDO')
  ) {
    return {
      label: 'Justificativa da vigencia plurianual',
      instruction: 'Informe por que a vigencia plurianual e mais vantajosa para esta contratacao.',
      inputPlaceholder: 'Ex.: previsao de consumo continuo e ganho operacional com fornecimento regular.',
    };
  }

  if (
    normalizedPlaceholder === '...' &&
    normalizedLocalBeforeText.includes('NOTA TECNICA') &&
    !normalizedLocalBeforeText.includes(' OU ')
  ) {
    return {
      label: 'Numero da nota tecnica',
      instruction: 'Informe o numero da nota tecnica citada neste ponto do modelo.',
      inputPlaceholder: 'Ex.: 12/2026.',
    };
  }

  const contextualScope = normalizedPlaceholder === '...' ? normalizedLocalBeforeText : normalizedSourceText;
  const contextualRule = contextualRules.find((rule) => rule.match(contextualScope, normalizedPlaceholder));
  if (contextualRule) {
    return contextualRule;
  }

  if (!placeholder) return null;

  const colonMatch = beforeText.match(/([^:.;]{3,120}):\s*$/);
  if (colonMatch) {
    const label = cleanupDerivedLabel(colonMatch[1]);
    if (!label) return null;

    return {
      label,
      instruction: `Informe ${label.toLowerCase()} conforme consta no processo ou no cadastro correspondente.`,
      inputPlaceholder: `Ex.: ${label}.`,
    };
  }

  return null;
}

function formatReferenceTermFallbackLabel(modelField: string) {
  const normalized = modelField
    .replace(/\b(inserir|indicar|informar|incluir|preencher)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Campo a preencher';
  }

  return normalized
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function truncateReferenceTermDisplayText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength).trimEnd();
  const safeBreak = truncated.lastIndexOf(' ');
  const candidate = safeBreak >= Math.floor(maxLength * 0.6) ? truncated.slice(0, safeBreak) : truncated;
  return `${candidate.trimEnd()}...`;
}

function stripReferenceTermNormativeTail(value: string) {
  const normalized = collapseWhitespace(stripQuestionNumbering(value));
  if (!normalized) return '';

  const cleaned = normalized
    .replace(/\s*,\s*(?:na forma|nos termos)\s+d[oa]s?\s+artigos?.*$/i, '')
    .replace(/\s*,\s*conforme\s+(?:a\s+)?(?:Lei|Decreto|Instrucao Normativa|Instrução Normativa|artigo|artigos).*$/i, '')
    .replace(/\s*,\s*observad[oa]s?\s+as?\s+disposicoes?.*$/i, '')
    .replace(/\s*,\s*nos termos\s+da\s+lei.*$/i, '')
    .replace(/\s*,\s*de acordo com\s+(?:a\s+)?(?:Lei|Decreto|Instrucao Normativa|Instrução Normativa).*$/i, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/[;,:\s]+$/g, '')
    .trim();

  if (!cleaned) {
    return normalized;
  }

  if (/[.!?]$/.test(normalized) && !/[.!?]$/.test(cleaned)) {
    return `${cleaned}.`;
  }

  return cleaned;
}

export function summarizeReferenceTermDisplayText(value: string, maxLength = 140) {
  const originalText = collapseWhitespace(value);
  if (!originalText) return '';

  const shortened = stripReferenceTermNormativeTail(originalText);
  return truncateReferenceTermDisplayText(shortened || originalText, maxLength);
}

export function buildReferenceTermOptionPreview(
  option: Pick<DocumentTemplateQuestionOption, 'label' | 'text'>,
): ReferenceTermDisplayPreview {
  const originalText = collapseWhitespace(option.text || option.label || '');
  const summaryBase = originalText || collapseWhitespace(option.label || '');
  const summary = summarizeReferenceTermDisplayText(summaryBase, 150) || collapseWhitespace(option.label || '');

  return {
    summary,
    originalText,
  };
}

export function buildReferenceTermOptionValueKey(blockId: string | undefined, placeholder: string, occurrenceIndex: number) {
  const normalizedBlockId = (blockId || 'option').trim() || 'option';
  return `${normalizedBlockId}::${occurrenceIndex}::${placeholder.trim()}`;
}

export function buildReferenceTermSupplementalOptionValueKey(blockId: string | undefined, fieldId: string) {
  const normalizedBlockId = (blockId || 'option').trim() || 'option';
  return `${normalizedBlockId}::supplemental::${fieldId}`;
}

function buildSupplementalOptionFields(sourceText: string, blockId: string | undefined): ReferenceTermOptionInputField[] {
  const normalizedSourceText = normalizeReferenceTermText(sourceText);

  if (
    normalizedSourceText.includes('PARCELAS') &&
    normalizedSourceText.includes('PRAZOS') &&
    normalizedSourceText.includes('CONDICOES')
  ) {
    return [{
      kind: 'input',
      key: buildReferenceTermSupplementalOptionValueKey(blockId, PARCEL_DELIVERY_SCHEDULE_FIELD_ID),
      placeholder: PARCEL_DELIVERY_SCHEDULE_FIELD_ID,
      instruction: {
        label: 'Prazos e condicoes das parcelas',
        instruction:
          'Informe os prazos de entrega de cada parcela, a forma de contagem e as condicoes especiais aplicaveis.',
        inputPlaceholder:
          'Ex.: primeira parcela em ate 30 dias corridos apos a nota de empenho e demais parcelas conforme cronograma aprovado pela fiscalizacao.',
        modelField: 'prazos e condicoes das parcelas',
      },
    }];
  }

  return [];
}

export function buildReferenceTermOptionFields(
  option: Pick<DocumentTemplateQuestionOption, 'text' | 'blockId' | 'blockIds' | 'blockTexts'>,
): ReferenceTermOptionField[] {
  const fields: ReferenceTermOptionField[] = [];
  const blockTexts = Array.isArray(option.blockTexts) && option.blockTexts.length > 0
    ? option.blockTexts
    : [option.text || ''];
  const blockIds = Array.isArray(option.blockIds) && option.blockIds.length > 0
    ? option.blockIds
    : blockTexts.map((_, index) => (index === 0 && option.blockId ? option.blockId : `option-block-${index + 1}`));

  blockTexts.forEach((rawBlockText, blockIndex) => {
    const sourceText = collapseWhitespace(rawBlockText || '');
    if (!sourceText) return;

    const placeholderMatches = Array.from(sourceText.matchAll(PLACEHOLDER_REGEX));
    if (placeholderMatches.length === 0) {
      fields.push(...buildSupplementalOptionFields(sourceText, blockIds[blockIndex]));
      return;
    }

    const consumedIndexes = new Set<number>();
    const occurrenceByPlaceholder = new Map<string, number>();
    const blockId = blockIds[blockIndex];

    for (let index = 0; index < placeholderMatches.length; index += 1) {
      if (consumedIndexes.has(index)) continue;

      const currentMatch = placeholderMatches[index];
      const currentPlaceholder = currentMatch?.[0]?.trim() || '';
      if (!currentPlaceholder) continue;

      const occurrenceIndex = occurrenceByPlaceholder.get(currentPlaceholder) || 0;
      occurrenceByPlaceholder.set(currentPlaceholder, occurrenceIndex + 1);
      const currentKey = buildReferenceTermOptionValueKey(blockId, currentPlaceholder, occurrenceIndex);

      if (isLiteralChoicePlaceholder(currentPlaceholder) || isGenericInlineChoicePlaceholder(currentPlaceholder)) {
        const choiceIndexes = [index];

        for (let nextIndex = index + 1; nextIndex < placeholderMatches.length; nextIndex += 1) {
          const previousMatch = placeholderMatches[nextIndex - 1];
          const nextMatch = placeholderMatches[nextIndex];
          const betweenText = collapseWhitespace(sourceText.slice(
            (previousMatch.index || 0) + previousMatch[0].length,
            nextMatch.index || 0,
          ));
          const nextPlaceholder = nextMatch?.[0]?.trim() || '';

          if (
            !isInlineChoiceSeparator(betweenText) ||
            (!isLiteralChoicePlaceholder(nextPlaceholder) && !isGenericInlineChoicePlaceholder(nextPlaceholder))
          ) {
            break;
          }

          choiceIndexes.push(nextIndex);
        }

        if (choiceIndexes.length > 1 && choiceIndexes.some((choiceIndex) => isLiteralChoicePlaceholder(placeholderMatches[choiceIndex][0].trim()))) {
          const choices = choiceIndexes.map((choiceIndex) => {
            consumedIndexes.add(choiceIndex);
            const placeholder = placeholderMatches[choiceIndex][0].trim();
            const placeholderOccurrenceIndex = choiceIndex === index
              ? occurrenceIndex
              : occurrenceByPlaceholder.get(placeholder) || 0;
            if (choiceIndex !== index) {
              occurrenceByPlaceholder.set(placeholder, placeholderOccurrenceIndex + 1);
            }
            if (isGenericInlineChoicePlaceholder(placeholder)) {
              const instruction = buildReferenceTermFieldInstruction(
                {
                  title: placeholder,
                  prompt: `Preencha ${placeholder}.`,
                  placeholder,
                },
                sourceText,
                placeholderOccurrenceIndex,
              );

              return {
                key: buildReferenceTermOptionValueKey(blockId, placeholder, placeholderOccurrenceIndex),
                placeholder,
                label: instruction?.label || 'Texto proprio da clausula',
                value: '',
                inputPlaceholder: instruction?.inputPlaceholder || 'Preencha este trecho com base no processo.',
                requiresInput: true,
              };
            }

            const value = cleanReferenceTermModelField(placeholder);
            const technicalNotePrefix = buildTechnicalNoteInputPrefix(value);
            return {
              key: buildReferenceTermOptionValueKey(blockId, placeholder, placeholderOccurrenceIndex),
              placeholder,
              label: value,
              value: technicalNotePrefix ? '' : value,
              inputPlaceholder: technicalNotePrefix ? 'Ex.: 12/2026.' : undefined,
              inputValuePrefix: technicalNotePrefix || undefined,
              requiresInput: Boolean(technicalNotePrefix),
            };
          });
          const choiceCopy = buildInlineChoiceLabel(choices.map((choice) => choice.value || choice.label));

          fields.push({
            kind: 'choice',
            key: currentKey,
            label: choiceCopy.label,
            instruction: choiceCopy.instruction,
            choices,
          });
          continue;
        }
      }

      const instruction = buildReferenceTermFieldInstruction(
        {
          title: currentPlaceholder,
          prompt: `Preencha ${currentPlaceholder}.`,
          placeholder: currentPlaceholder,
        },
        sourceText,
        occurrenceIndex,
      );

      fields.push({
        kind: 'input',
        key: currentKey,
        placeholder: currentPlaceholder,
        instruction: instruction || {
          label: 'Trecho complementar da clausula',
          instruction: 'Informe o texto complementar exigido por esta clausula ou deixe pendente se nao houver base segura no processo.',
          inputPlaceholder: 'Preencha este trecho com base no processo.',
          modelField: cleanReferenceTermModelField(currentPlaceholder),
        },
      });
    }
  });

  if (fields.length === 0) {
    return [];
  }

  return fields;
}

export function getReferenceTermQuestionSourceText(
  question: Pick<DocumentTemplateQuestion, 'blockId' | 'blockIndex'>,
  editableBlocks?: DocumentTemplateEditableBlock[],
) {
  if (!editableBlocks?.length) return '';

  const matchedBlock = editableBlocks.find((block) =>
    (question.blockId && block.id === question.blockId) ||
    (typeof question.blockIndex === 'number' && block.blockIndex === question.blockIndex),
  );

  return collapseWhitespace(matchedBlock?.text || '');
}

function isUsableQuestionTitle(title: string) {
  const normalizedTitle = normalizeReferenceTermText(title);
  return Boolean(
    normalizedTitle &&
    normalizedTitle !== GENERIC_FIELD_TITLE &&
    !isTrivialModelField(title) &&
    !contextDependentTokens.has(normalizedTitle),
  );
}

export function buildReferenceTermFieldInstruction(
  question: Pick<DocumentTemplateQuestion, 'placeholder' | 'prompt' | 'title'>,
  sourceText?: string,
  placeholderOccurrenceIndex = 0,
): ReferenceTermFieldInstruction | null {
  const rawPlaceholder = extractQuestionPlaceholder(question);
  const modelField = cleanReferenceTermModelField(rawPlaceholder || question.title || question.prompt);
  const normalizedModelField = normalizeReferenceTermText(modelField);
  const normalizedSourceText = normalizeReferenceTermText(sourceText || '');
  const contextualRule = deriveLabelFromSourceText(sourceText || '', rawPlaceholder, normalizedSourceText, placeholderOccurrenceIndex);

  if (contextualRule) {
    return {
      ...contextualRule,
      modelField:
        isTrivialModelField(modelField) || contextDependentTokens.has(normalizedModelField)
          ? contextualRule.label
          : modelField,
    };
  }

  const placeholderRule = placeholderRules.find((candidate) =>
    candidate.keywords.some((keyword) => normalizedModelField.includes(keyword)),
  );

  if (placeholderRule) {
    return {
      label: placeholderRule.label,
      instruction: placeholderRule.instruction,
      inputPlaceholder: placeholderRule.inputPlaceholder,
      example: placeholderRule.example,
      modelField,
    };
  }

  if (contextDependentTokens.has(normalizedModelField)) {
    return null;
  }

  if (isTrivialModelField(modelField)) {
    const fallbackInstruction = buildContextualFallbackInstruction(sourceText || '', rawPlaceholder, placeholderOccurrenceIndex);
    if (fallbackInstruction) {
      return {
        ...fallbackInstruction,
        modelField,
      };
    }
    return null;
  }

  const fallbackLabel = isUsableQuestionTitle(question.title) ? question.title : formatReferenceTermFallbackLabel(modelField);
  if (!fallbackLabel || isTrivialModelField(fallbackLabel)) {
    return null;
  }

  return {
    label: fallbackLabel,
    instruction:
      'Informe o dado solicitado pelo modelo neste ponto do Termo de Referencia. Use as informacoes do processo, especialmente DFD e ETP, e deixe pendente se nao houver fonte segura.',
    inputPlaceholder: `Preencha ${modelField} com base no processo, ou pule para manter pendente.`,
    modelField,
  };
}

function isGenericQuestionPrompt(question: DocumentTemplateQuestion) {
  const normalizedPrompt = normalizeReferenceTermText(question.prompt || '');
  return normalizedPrompt.startsWith('PREENCHA ') && normalizedPrompt.includes('OU PULE PARA MANTER O CAMPO PENDENTE');
}

function isGenericQuestionGuidance(question: DocumentTemplateQuestion) {
  if (!question.guidance?.trim()) {
    return true;
  }

  const normalizedGuidance = normalizeReferenceTermText(question.guidance || '');
  return normalizedGuidance.startsWith('CAMPOS PREVISTOS NO MODELO');
}

export function sanitizeReferenceTermQuestionnaireSchema(
  schema?: DocumentTemplateQuestionnaireSchema,
  editableBlocks?: DocumentTemplateEditableBlock[],
): DocumentTemplateQuestionnaireSchema | undefined {
  if (!schema) return undefined;

  const nextQuestions = schema.questions
    .map((question) => {
      if (question.kind !== 'field') {
        return question;
      }

      const sourceText = getReferenceTermQuestionSourceText(question, editableBlocks);
      const instruction = buildReferenceTermFieldInstruction(question, sourceText);

      if (!instruction) {
        return null;
      }

      return {
        ...question,
        title: instruction.label,
        prompt: isGenericQuestionPrompt(question) ? instruction.instruction : question.prompt,
        guidance: isGenericQuestionGuidance(question) ? `Campo do modelo: ${instruction.modelField}.` : question.guidance,
      };
    })
    .filter((question): question is DocumentTemplateQuestion => Boolean(question));

  return {
    ...schema,
    questions: nextQuestions,
  };
}
