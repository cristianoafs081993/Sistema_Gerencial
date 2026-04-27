import * as CFB from 'cfb';

import { APP_BRAND } from '@/lib/brand';

import { sanitizeReferenceTermQuestionnaireSchema } from '@/lib/referenceTermQuestionnaire';
import type {
  DocumentTemplateEditableBlock,
  DocumentTemplateEditableBlockKind,
  DocumentTemplateQuestion,
  DocumentTemplateQuestionnaireSchema,
} from '@/services/documentTemplates';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const COMMENTS_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const COMMENTS_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';

export type ParsedDocxTemplate = {
  templateText: string;
  editableBlocks: DocumentTemplateEditableBlock[];
  questionnaireSchema: DocumentTemplateQuestionnaireSchema;
  title?: string;
};

export type DocxParagraphReplacement = {
  blockId: string;
  blockIndex: number;
  paragraphs: string[];
  remove?: boolean;
  review?: DocxReviewMark;
};

export type DocxTableReplacement = {
  blockId: string;
  blockIndex: number;
  rows: string[][];
  review?: DocxReviewMark;
};

export type DocxTemplateExportPlan = {
  paragraphReplacements: DocxParagraphReplacement[];
  tableReplacements?: DocxTableReplacement[];
};

export type DocxReviewStatus = 'ai_generated' | 'added' | 'pending' | 'not_adopted';

export type DocxReviewMark = {
  status: DocxReviewStatus;
  comment?: string;
};

function findDocxEntry(cfb: CFB.CFB$Container, targetPath: string) {
  const directEntry = CFB.find(cfb, targetPath);
  if (directEntry?.content) {
    return directEntry;
  }

  const normalizedTarget = targetPath.replace(/^\/+/, '').toLowerCase();
  const matchedPath = cfb.FullPaths.find((fullPath) => fullPath.replace(/^\/+/, '').toLowerCase().endsWith(normalizedTarget));

  if (!matchedPath) {
    return null;
  }

  return CFB.find(cfb, matchedPath);
}

function toUint8Array(blob: number[] | Uint8Array): Uint8Array {
  return blob instanceof Uint8Array ? blob : Uint8Array.from(blob);
}

function decodeXmlBlob(blob: number[] | Uint8Array): string {
  return new TextDecoder('utf-8').decode(toUint8Array(blob));
}

function encodeXmlBlob(xml: string) {
  return new TextEncoder().encode(xml);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeQuestionText(value: string) {
  return collapseWhitespace(value).replace(/[.;:]$/, '').trim();
}

function truncateLabel(value: string, maxLength = 120) {
  const normalized = normalizeQuestionText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function uniquePlaceholders(text: string) {
  return [...new Set(Array.from(text.matchAll(/\[[^\]]+\]/g)).map((match) => match[0].trim()))];
}

export function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function paragraphStyleId(paragraph: Element): string | undefined {
  const pPr = paragraph.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
  if (!pPr) return undefined;

  const style = pPr.getElementsByTagNameNS(WORD_NS, 'pStyle')[0];
  if (!style) return undefined;

  return style.getAttributeNS(WORD_NS, 'val') || style.getAttribute('w:val') || style.getAttribute('val') || undefined;
}

function collectNodeText(node: Element): string {
  let text = '';

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const element = child as Element;

    if (element.localName === 't') {
      text += element.textContent || '';
      continue;
    }

    if (element.localName === 'tab') {
      text += '\t';
      continue;
    }

    if (element.localName === 'br' || element.localName === 'cr') {
      text += '\n';
      continue;
    }

    text += collectNodeText(element);
  }

  return text;
}

function nodeHasRedText(node: Element) {
  const runs = Array.from(node.getElementsByTagNameNS(WORD_NS, 'r'));

  return runs.some((run) => {
    const color = run.getElementsByTagNameNS(WORD_NS, 'color')[0];
    const value = color?.getAttributeNS(WORD_NS, 'val') || color?.getAttribute('w:val') || color?.getAttribute('val') || '';
    return value.toUpperCase() === 'FF0000';
  });
}

function looksInstructional(text: string, hasRedText: boolean) {
  const normalized = collapseWhitespace(text).toLowerCase();
  if (!normalized) return false;

  return (
    hasRedText ||
    /\[[^\]]+\]/.test(text) ||
    /\b(?:inserir|incluir|adequar|preencher|substituir|indicar|descrever|definir)\b/i.test(text) ||
    /(?:xxxxx|xxx\/xxxx|órgão ou entidade pública)/i.test(text)
  );
}

function looksEditableTable(text: string) {
  const normalized = collapseWhitespace(text).toLowerCase();
  if (!normalized) return false;

  const hasItemsHeader =
    normalized.includes('item') &&
    (normalized.includes('descricao') || normalized.includes('especificacao')) &&
    normalized.includes('quantidade');

  const hasPricingHeader = normalized.includes('valor unit') || normalized.includes('valor total');

  return hasItemsHeader || hasPricingHeader;
}

type TemplateBodyBlock = {
  id: string;
  kind: DocumentTemplateEditableBlockKind;
  blockIndex: number;
  text: string;
};

type TemplateAlternativeGroup = {
  blocks: TemplateBodyBlock[];
  text: string;
};

function isOuSeparator(text: string) {
  return /^ou$/i.test(collapseWhitespace(text));
}

function isPotentialOptionalClause(text: string) {
  const normalized = collapseWhitespace(text).toLowerCase();
  return /\b(?:se aplicavel|se aplicável|quando aplicavel|quando aplicável|caso aplicavel|caso aplicável)\b/.test(normalized);
}

function isMajorClauseStart(text: string) {
  const normalized = collapseWhitespace(text);
  return /^\d+(?:\.\d+)*\.?\s+\S/.test(normalized);
}

function isEnumerationItem(text: string) {
  const normalized = collapseWhitespace(text);
  return /^(?:[IVXLCDM]+|\d+|[A-Z])\)\s+\S/.test(normalized);
}

function isShortContinuationLine(text: string) {
  const normalized = collapseWhitespace(text);
  return normalized.length > 0 && normalized.length <= 80 && /[:;.]$/.test(normalized);
}

function findAlternativeAnchorStart(bodyBlocks: TemplateBodyBlock[], anchorIndex: number) {
  let startIndex = anchorIndex;

  while (startIndex > 0) {
    const current = bodyBlocks[startIndex];
    const previous = bodyBlocks[startIndex - 1];

    if (previous.kind !== 'paragraph' || isOuSeparator(previous.text)) break;
    if (current.kind !== 'paragraph') break;
    if (isMajorClauseStart(current.text)) break;

    if (isMajorClauseStart(previous.text) || isEnumerationItem(previous.text) || isShortContinuationLine(previous.text)) {
      startIndex -= 1;
      continue;
    }

    break;
  }

  return startIndex;
}

function collectAlternativeGroup(
  bodyBlocks: TemplateBodyBlock[],
  startIndex: number,
  direction: 'forward' | 'backward',
): TemplateAlternativeGroup | null {
  const anchor = bodyBlocks[startIndex];
  if (!anchor || anchor.kind !== 'paragraph' || isOuSeparator(anchor.text)) {
    return null;
  }

  const rangeStart = direction === 'backward' ? findAlternativeAnchorStart(bodyBlocks, startIndex) : startIndex;
  let rangeEnd = startIndex;

  if (direction === 'forward') {
    for (let index = startIndex + 1; index < bodyBlocks.length; index += 1) {
      const candidate = bodyBlocks[index];
      if (candidate.kind !== 'paragraph' || isOuSeparator(candidate.text)) break;
      if (isMajorClauseStart(candidate.text)) break;
      rangeEnd = index;
    }
  }

  const blocks = bodyBlocks
    .slice(rangeStart, rangeEnd + 1)
    .filter((block) => block.kind === 'paragraph' && !isOuSeparator(block.text) && block.text.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  return {
    blocks,
    text: blocks.map((block) => block.text).join('\n'),
  };
}

function buildQuestionnaireSchema(
  bodyBlocks: TemplateBodyBlock[],
  editableBlocks: DocumentTemplateEditableBlock[],
): DocumentTemplateQuestionnaireSchema {
  const questions: DocumentTemplateQuestion[] = [];
  const exclusiveBlockIndexes = new Set<number>();
  const usedQuestionIds = new Set<string>();

  const addQuestion = (question: DocumentTemplateQuestion) => {
    if (usedQuestionIds.has(question.id)) return;
    usedQuestionIds.add(question.id);
    questions.push(question);
  };

  bodyBlocks.forEach((block, index) => {
    if (block.kind !== 'paragraph' || !isOuSeparator(block.text)) return;

    const previous = bodyBlocks
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.kind === 'paragraph' && !isOuSeparator(candidate.text) && candidate.text.length > 20);
    const next = bodyBlocks
      .slice(index + 1)
      .find((candidate) => candidate.kind === 'paragraph' && !isOuSeparator(candidate.text) && candidate.text.length > 20);

    if (!previous || !next) return;

    const previousIndex = bodyBlocks.findIndex((candidate) => candidate.blockIndex === previous.blockIndex);
    const nextIndex = bodyBlocks.findIndex((candidate) => candidate.blockIndex === next.blockIndex);
    const previousGroup = collectAlternativeGroup(bodyBlocks, previousIndex, 'backward');
    const nextGroup = collectAlternativeGroup(bodyBlocks, nextIndex, 'forward');

    if (!previousGroup || !nextGroup) return;

    for (const groupedBlock of [...previousGroup.blocks, ...nextGroup.blocks]) {
      exclusiveBlockIndexes.add(groupedBlock.blockIndex);
    }

    addQuestion({
      id: `exclusive-${previousGroup.blocks[0].blockIndex}-${nextGroup.blocks[0].blockIndex}`,
      kind: 'exclusive',
      title: 'Escolha de clausula alternativa',
      prompt: 'Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.',
      guidance: 'Se pular, todas as alternativas permanecerao marcadas como pendentes para revisao juridica.',
      blockIndexes: [...previousGroup.blocks, ...nextGroup.blocks].map((groupedBlock) => groupedBlock.blockIndex),
      blockIds: [...previousGroup.blocks, ...nextGroup.blocks].map((groupedBlock) => groupedBlock.id),
      options: [previousGroup, nextGroup].map((option, optionIndex) => ({
        id: `${option.blocks[0].id}-option-${optionIndex + 1}`,
        label: truncateLabel(option.text),
        text: option.text,
        blockId: option.blocks[0].id,
        blockIndex: option.blocks[0].blockIndex,
        blockIds: option.blocks.map((groupedBlock) => groupedBlock.id),
        blockIndexes: option.blocks.map((groupedBlock) => groupedBlock.blockIndex),
        blockTexts: option.blocks.map((groupedBlock) => groupedBlock.text),
      })),
    });
  });

  for (const block of editableBlocks) {
    if (exclusiveBlockIndexes.has(block.blockIndex)) continue;

    const placeholders = uniquePlaceholders(block.text);
    for (const placeholder of placeholders) {
      const questionId = `field-${block.blockIndex}-${placeholder.replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
      addQuestion({
        id: questionId,
        kind: 'field',
        title: 'Campo previsto no modelo',
        prompt: `Preencha ${placeholder} ou pule para manter o campo pendente.`,
        guidance: 'Campos previstos no modelo podem ser preenchidos pelo usuario. Se a IA preencher depois, o DOCX marcara a origem.',
        blockId: block.id,
        blockIndex: block.blockIndex,
        placeholder,
      });
    }

    if (block.kind === 'paragraph' && placeholders.length === 0 && isPotentialOptionalClause(block.text)) {
      addQuestion({
        id: `optional-${block.blockIndex}`,
        kind: 'optional',
        title: 'Clausula opcional',
        prompt: 'Confirme se esta clausula deve permanecer ativa no Termo de Referencia.',
        guidance: 'Se nao for adotada, o trecho permanecera tachado e justificado no DOCX.',
        blockId: block.id,
        blockIndex: block.blockIndex,
        options: [
          {
            id: `${block.id}-keep`,
            label: 'Manter clausula',
            text: block.text,
            blockId: block.id,
            blockIndex: block.blockIndex,
          },
          {
            id: `${block.id}-strike`,
            label: 'Nao adotar clausula',
            text: block.text,
            blockId: block.id,
            blockIndex: block.blockIndex,
          },
        ],
      });
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    questions,
  };
}

function extractEditableBlocksFromDocumentXml(documentXml: string): ParsedDocxTemplate {
  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(documentXml, 'application/xml');
  const body = xmlDocument.getElementsByTagNameNS(WORD_NS, 'body')[0];

  if (!body) {
    return { templateText: '', editableBlocks: [] };
  }

  const editableBlocks: DocumentTemplateEditableBlock[] = [];
  const textBlocks: string[] = [];
  const bodyTextBlocks: TemplateBodyBlock[] = [];
  const bodyChildren = Array.from(body.childNodes).filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE);
  let title: string | undefined;

  bodyChildren.forEach((child, blockIndex) => {
    const kind = child.localName === 'tbl' ? 'table' : child.localName === 'p' ? 'paragraph' : null;
    if (!kind) return;

    const text = collapseWhitespace(collectNodeText(child));
    if (text) {
      textBlocks.push(text);
      bodyTextBlocks.push({
        id: `block-${blockIndex}`,
        kind,
        blockIndex,
        text,
      });
      if (!title) {
        title = text;
      }
    }

    const hasRedText = nodeHasRedText(child);
    const isInstructional = kind === 'table' ? looksEditableTable(text) || looksInstructional(text, hasRedText) : looksInstructional(text, hasRedText);
    const hasPlaceholder = /\[[^\]]+\]/.test(text) || /(?:xxxxx|xxx\/xxxx)/i.test(text);

    if (!text || !isInstructional) {
      return;
    }

    editableBlocks.push({
      id: `block-${blockIndex}`,
      kind,
      blockIndex,
      text,
      excerpt: text.length > 240 ? `${text.slice(0, 239).trimEnd()}...` : text,
      styleId: kind === 'paragraph' ? paragraphStyleId(child) : undefined,
      isInstructional,
      hasPlaceholder,
    });
  });

  return {
    templateText: textBlocks.join('\n\n'),
    editableBlocks,
    questionnaireSchema: sanitizeReferenceTermQuestionnaireSchema(
      buildQuestionnaireSchema(bodyTextBlocks, editableBlocks),
      editableBlocks,
    ) || {
      version: 1,
      generatedAt: new Date().toISOString(),
      questions: [],
    },
    title,
  };
}

export async function parseDocxTemplateArrayBuffer(arrayBuffer: ArrayBuffer): Promise<ParsedDocxTemplate> {
  const cfb = CFB.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const documentEntry = findDocxEntry(cfb, 'word/document.xml');

  if (!documentEntry?.content) {
    throw new Error('O modelo DOCX nao possui word/document.xml.');
  }

  return extractEditableBlocksFromDocumentXml(decodeXmlBlob(documentEntry.content));
}

export async function serializeDocxTemplateFile(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const parsed = await parseDocxTemplateArrayBuffer(arrayBuffer);

  return {
    templateBase64: arrayBufferToBase64(arrayBuffer),
    ...parsed,
  };
}

function clearChildren(node: Element) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createWordElement(documentXml: XMLDocument, localName: string) {
  return documentXml.createElementNS(WORD_NS, `w:${localName}`);
}

function setWordAttribute(element: Element, localName: string, value: string) {
  element.setAttributeNS(WORD_NS, `w:${localName}`, value);
}

function applyReviewRunProperties(documentXml: XMLDocument, run: Element, review?: DocxReviewMark) {
  if (!review) return;

  const rPr = createWordElement(documentXml, 'rPr');

  if (review.status === 'not_adopted') {
    rPr.appendChild(createWordElement(documentXml, 'strike'));
  }

  if (review.status === 'added') {
    rPr.appendChild(createWordElement(documentXml, 'b'));
    const color = createWordElement(documentXml, 'color');
    setWordAttribute(color, 'val', '0070C0');
    rPr.appendChild(color);
  }

  if (review.status === 'ai_generated') {
    const highlight = createWordElement(documentXml, 'highlight');
    setWordAttribute(highlight, 'val', 'yellow');
    rPr.appendChild(highlight);
  }

  if (review.status === 'pending') {
    const highlight = createWordElement(documentXml, 'highlight');
    setWordAttribute(highlight, 'val', 'yellow');
    rPr.appendChild(highlight);
    const color = createWordElement(documentXml, 'color');
    setWordAttribute(color, 'val', 'C00000');
    rPr.appendChild(color);
  }

  if (rPr.childNodes.length > 0) {
    run.insertBefore(rPr, run.firstChild);
  }
}

function createRun(documentXml: XMLDocument, text: string, review?: DocxReviewMark) {
  const run = documentXml.createElementNS(WORD_NS, 'w:r');
  applyReviewRunProperties(documentXml, run, review);
  const textNode = documentXml.createElementNS(WORD_NS, 'w:t');
  textNode.setAttribute('xml:space', 'preserve');
  textNode.textContent = text;
  run.appendChild(textNode);
  return run;
}

type DocxCommentManager = {
  addComment: (text: string) => string;
};

function buildParagraphFromTemplate(
  documentXml: XMLDocument,
  templateParagraph: Element,
  text: string,
  review?: DocxReviewMark,
  commentManager?: DocxCommentManager | null,
) {
  const paragraph = templateParagraph.cloneNode(false) as Element;
  clearChildren(paragraph);

  const pPr = templateParagraph.getElementsByTagNameNS(WORD_NS, 'pPr')[0];
  if (pPr) {
    paragraph.appendChild(pPr.cloneNode(true));
  }

  if (review?.comment && commentManager) {
    const commentId = commentManager.addComment(review.comment);
    const commentRangeStart = createWordElement(documentXml, 'commentRangeStart');
    setWordAttribute(commentRangeStart, 'id', commentId);
    const commentRangeEnd = createWordElement(documentXml, 'commentRangeEnd');
    setWordAttribute(commentRangeEnd, 'id', commentId);
    const commentReferenceRun = createWordElement(documentXml, 'r');
    const commentReference = createWordElement(documentXml, 'commentReference');
    setWordAttribute(commentReference, 'id', commentId);

    commentReferenceRun.appendChild(commentReference);
    paragraph.appendChild(commentRangeStart);
    paragraph.appendChild(createRun(documentXml, text, review));
    paragraph.appendChild(commentRangeEnd);
    paragraph.appendChild(commentReferenceRun);
    return paragraph;
  }

  paragraph.appendChild(createRun(documentXml, text, review));
  return paragraph;
}

function replaceParagraphBlock(
  documentXml: XMLDocument,
  originalParagraph: Element,
  replacement: DocxParagraphReplacement,
  commentManager?: DocxCommentManager | null,
) {
  const parent = originalParagraph.parentNode;
  if (!parent) return;

  if (!replacement.remove) {
    const values = replacement.paragraphs.length > 0 ? replacement.paragraphs : [''];
    for (const text of values) {
      parent.insertBefore(
        buildParagraphFromTemplate(documentXml, originalParagraph, text, replacement.review, commentManager),
        originalParagraph,
      );
    }
  }

  parent.removeChild(originalParagraph);
}

function setTableCellText(documentXml: XMLDocument, tableCell: Element, text: string, review?: DocxReviewMark) {
  const tcPr = tableCell.getElementsByTagNameNS(WORD_NS, 'tcPr')[0];
  const paragraphTemplate = tableCell.getElementsByTagNameNS(WORD_NS, 'p')[0];
  clearChildren(tableCell);

  if (tcPr) {
    tableCell.appendChild(tcPr.cloneNode(true));
  }

  if (paragraphTemplate) {
    tableCell.appendChild(buildParagraphFromTemplate(documentXml, paragraphTemplate, text, review));
    return;
  }

  const paragraph = documentXml.createElementNS(WORD_NS, 'w:p');
  paragraph.appendChild(createRun(documentXml, text, review));
  tableCell.appendChild(paragraph);
}

function replaceTableBlock(documentXml: XMLDocument, table: Element, replacement: DocxTableReplacement) {
  const tableRows = Array.from(table.childNodes).filter(
    (node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === 'tr',
  );

  if (tableRows.length === 0) return;

  const headerRow = tableRows[0];
  const sampleRow = tableRows[1] || tableRows[0];

  for (const row of tableRows.slice(1)) {
    table.removeChild(row);
  }

  for (const rowValues of replacement.rows) {
    const row = sampleRow.cloneNode(true) as Element;
    const cells = Array.from(row.getElementsByTagNameNS(WORD_NS, 'tc'));
    const totalCells = Math.max(cells.length, rowValues.length);

    while (cells.length < totalCells && cells.length > 0) {
      const clonedCell = cells[cells.length - 1].cloneNode(true) as Element;
      row.appendChild(clonedCell);
      cells.push(clonedCell);
    }

    cells.forEach((cell, index) => {
      setTableCellText(documentXml, cell, rowValues[index] || '', replacement.review);
    });

    if (!headerRow.nextSibling) {
      table.appendChild(row);
    } else {
      table.appendChild(row);
    }
  }
}

function getOrCreateXmlEntry(cfb: CFB.CFB$Container, path: string, defaultXml: string) {
  const existing = findDocxEntry(cfb, path);
  if (existing?.content) return existing;

  CFB.utils.cfb_add(cfb, path, encodeXmlBlob(defaultXml));
  const created = findDocxEntry(cfb, path);
  if (!created?.content) {
    throw new Error(`Nao foi possivel criar ${path} no DOCX.`);
  }
  return created;
}

function ensureCommentsRelationship(cfb: CFB.CFB$Container) {
  const relsEntry = getOrCreateXmlEntry(
    cfb,
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PACKAGE_REL_NS}"></Relationships>`,
  );
  const parser = new DOMParser();
  const relsXml = parser.parseFromString(decodeXmlBlob(relsEntry.content), 'application/xml');
  const relationships = relsXml.documentElement;
  const hasComments = Array.from(relationships.getElementsByTagNameNS(PACKAGE_REL_NS, 'Relationship')).some(
    (relationship) => relationship.getAttribute('Type') === COMMENTS_REL_TYPE,
  );

  if (!hasComments) {
    const existingIds = new Set(
      Array.from(relationships.getElementsByTagNameNS(PACKAGE_REL_NS, 'Relationship')).map((relationship) =>
        relationship.getAttribute('Id') || '',
      ),
    );
    let index = 1;
    while (existingIds.has(`rId${index}`)) index += 1;

    const relationship = relsXml.createElementNS(PACKAGE_REL_NS, 'Relationship');
    relationship.setAttribute('Id', `rId${index}`);
    relationship.setAttribute('Type', COMMENTS_REL_TYPE);
    relationship.setAttribute('Target', 'comments.xml');
    relationships.appendChild(relationship);
    relsEntry.content = encodeXmlBlob(new XMLSerializer().serializeToString(relsXml));
  }
}

function ensureCommentsContentType(cfb: CFB.CFB$Container) {
  const contentTypesEntry = findDocxEntry(cfb, '[Content_Types].xml');
  if (!contentTypesEntry?.content) return;

  const parser = new DOMParser();
  const contentTypesXml = parser.parseFromString(decodeXmlBlob(contentTypesEntry.content), 'application/xml');
  const types = contentTypesXml.documentElement;
  const hasOverride = Array.from(types.getElementsByTagNameNS(CONTENT_TYPES_NS, 'Override')).some(
    (override) => override.getAttribute('PartName') === '/word/comments.xml',
  );

  if (!hasOverride) {
    const override = contentTypesXml.createElementNS(CONTENT_TYPES_NS, 'Override');
    override.setAttribute('PartName', '/word/comments.xml');
    override.setAttribute('ContentType', COMMENTS_CONTENT_TYPE);
    types.appendChild(override);
    contentTypesEntry.content = encodeXmlBlob(new XMLSerializer().serializeToString(contentTypesXml));
  }
}

function createDocxCommentManager(cfb: CFB.CFB$Container): DocxCommentManager {
  ensureCommentsRelationship(cfb);
  ensureCommentsContentType(cfb);

  const commentsEntry = getOrCreateXmlEntry(
    cfb,
    'word/comments.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="${WORD_NS}"></w:comments>`,
  );
  const parser = new DOMParser();
  const commentsXml = parser.parseFromString(decodeXmlBlob(commentsEntry.content), 'application/xml');
  const commentsRoot = commentsXml.documentElement;
  const existingIds = Array.from(commentsRoot.getElementsByTagNameNS(WORD_NS, 'comment'))
    .map((comment) => Number(comment.getAttributeNS(WORD_NS, 'id') || comment.getAttribute('w:id') || comment.getAttribute('id') || -1))
    .filter((id) => Number.isFinite(id));
  let nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;

  return {
    addComment(text: string) {
      const id = String(nextId);
      nextId += 1;

      const comment = commentsXml.createElementNS(WORD_NS, 'w:comment');
      setWordAttribute(comment, 'id', id);
      setWordAttribute(comment, 'author', APP_BRAND.name);
      setWordAttribute(comment, 'date', new Date().toISOString());

      const paragraph = commentsXml.createElementNS(WORD_NS, 'w:p');
      paragraph.appendChild(createRun(commentsXml, text));
      comment.appendChild(paragraph);
      commentsRoot.appendChild(comment);
      commentsEntry.content = encodeXmlBlob(new XMLSerializer().serializeToString(commentsXml));

      return id;
    },
  };
}

function planNeedsComments(plan: DocxTemplateExportPlan) {
  return (
    plan.paragraphReplacements.some((replacement) => Boolean(replacement.review?.comment)) ||
    (plan.tableReplacements || []).some((replacement) => Boolean(replacement.review?.comment))
  );
}

export async function applyDocxTemplatePlan(templateBase64: string, plan: DocxTemplateExportPlan) {
  const bytes = base64ToUint8Array(templateBase64);
  const cfb = CFB.read(bytes, { type: 'array' });
  const documentEntry = findDocxEntry(cfb, 'word/document.xml');

  if (!documentEntry?.content) {
    throw new Error('O modelo DOCX nao possui word/document.xml.');
  }

  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(decodeXmlBlob(documentEntry.content), 'application/xml');
  const body = xmlDocument.getElementsByTagNameNS(WORD_NS, 'body')[0];
  const commentManager = planNeedsComments(plan) ? createDocxCommentManager(cfb) : null;

  if (!body) {
    throw new Error('O modelo DOCX nao possui body em word/document.xml.');
  }

  const bodyChildren = Array.from(body.childNodes).filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE);

  for (const replacement of plan.paragraphReplacements) {
    const original = bodyChildren[replacement.blockIndex];
    if (!original || original.localName !== 'p') continue;
    replaceParagraphBlock(xmlDocument, original, replacement, commentManager);
  }

  for (const replacement of plan.tableReplacements || []) {
    const original = bodyChildren[replacement.blockIndex];
    if (!original || original.localName !== 'tbl') continue;
    replaceTableBlock(xmlDocument, original, replacement);
  }

  const serialized = new XMLSerializer().serializeToString(xmlDocument);
  documentEntry.content = new TextEncoder().encode(serialized);

  return toUint8Array(CFB.write(cfb, { type: 'array', fileType: 'zip', compression: true }));
}
