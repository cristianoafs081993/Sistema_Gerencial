type ClipboardCopyResult = 'html' | 'plain';

type CopySuapDocumentOptions = {
  plainText?: string;
};

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ol',
  'p',
  'section',
  'table',
  'ul',
]);

const INLINE_TAGS = new Set(['a', 'b', 'br', 'em', 'i', 'span', 'strong', 'sub', 'sup', 'u']);

const DOCUMENT_FONT_FAMILY = "'Times New Roman', Times, serif";

function parseStyle(style: string | null | undefined) {
  const entries = new Map<string, string>();
  if (!style) return entries;

  style.split(';').forEach((item) => {
    const [rawName, ...rawValue] = item.split(':');
    const name = rawName?.trim().toLowerCase();
    const value = rawValue.join(':').trim();
    if (name && value) entries.set(name, value);
  });

  return entries;
}

function getStyleValue(element: Element | null, name: string) {
  let current: Element | null = element;
  while (current) {
    const value = parseStyle(current.getAttribute('style')).get(name);
    if (value) return value;
    current = current.parentElement;
  }
  return undefined;
}

function getBaseFontSize(container: HTMLElement) {
  const styled = Array.from(container.querySelectorAll<HTMLElement>('[style]'));
  const firstWithFontSize = styled.find((element) => parseStyle(element.getAttribute('style')).has('font-size'));
  return firstWithFontSize ? parseStyle(firstWithFontSize.getAttribute('style')).get('font-size') || '12pt' : '12pt';
}

function hasBlockChild(element: Element) {
  return Array.from(element.children).some((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()));
}

function normalizeMarginValue(value?: string) {
  if (!value) return undefined;
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return value;
  if (value.toLowerCase().includes('px')) return `${Math.round(numeric * 0.75)}pt`;
  return value;
}

function getParagraphStyle(element: Element | null, baseFontSize: string) {
  const styles = parseStyle(element?.getAttribute('style'));
  const textIndent = styles.get('text-indent');
  const textAlign = styles.get('text-align') || getStyleValue(element, 'text-align') || 'justify';
  const fontSize = styles.get('font-size') || getStyleValue(element, 'font-size') || baseFontSize;
  const lineHeight = styles.get('line-height') || getStyleValue(element, 'line-height') || '1.5';
  const fontWeight = styles.get('font-weight');
  const marginTop = normalizeMarginValue(styles.get('margin-top'));
  const marginBottom = normalizeMarginValue(styles.get('margin-bottom')) || '12pt';

  const output = [
    `font-family: ${DOCUMENT_FONT_FAMILY}`,
    `font-size: ${fontSize}`,
    `line-height: ${lineHeight}`,
    `color: #000`,
    `text-align: ${textAlign}`,
    `margin: ${marginTop || '0'} 0 ${marginBottom} 0`,
  ];

  if (textIndent) output.push(`text-indent: ${textIndent}`);
  if (fontWeight) output.push(`font-weight: ${fontWeight}`);

  return `${output.join('; ')};`;
}

function cloneInlineNode(node: Node, ownerDocument: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return ownerDocument.createTextNode(node.textContent || '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (!INLINE_TAGS.has(tag)) {
    const fragment = ownerDocument.createDocumentFragment();
    element.childNodes.forEach((child) => {
      const cloned = cloneInlineNode(child, ownerDocument);
      if (cloned) fragment.appendChild(cloned);
    });
    return fragment;
  }

  const clone = ownerDocument.createElement(tag);
  if (tag === 'a') {
    const href = element.getAttribute('href');
    if (href) clone.setAttribute('href', href);
  }

  if (tag === 'span' || tag === 'u') {
    const style = parseStyle(element.getAttribute('style'));
    const safeStyle = [
      style.get('color') ? `color: ${style.get('color')}` : '',
      style.get('font-weight') ? `font-weight: ${style.get('font-weight')}` : '',
      style.get('text-decoration') ? `text-decoration: ${style.get('text-decoration')}` : '',
      style.get('text-transform') ? `text-transform: ${style.get('text-transform')}` : '',
      style.get('background') ? `background: ${style.get('background')}` : '',
      style.get('background-color') ? `background-color: ${style.get('background-color')}` : '',
    ].filter(Boolean);
    if (safeStyle.length > 0) clone.setAttribute('style', `${safeStyle.join('; ')};`);
  }

  element.childNodes.forEach((child) => {
    const cloned = cloneInlineNode(child, ownerDocument);
    if (cloned) clone.appendChild(cloned);
  });

  return clone;
}

function appendParagraph(parent: HTMLElement, source: Element | null, nodes: Node[], baseFontSize: string) {
  const paragraph = parent.ownerDocument.createElement('p');
  paragraph.setAttribute('style', getParagraphStyle(source, baseFontSize));

  nodes.forEach((node) => {
    const cloned = cloneInlineNode(node, parent.ownerDocument);
    if (cloned) paragraph.appendChild(cloned);
  });

  if ((paragraph.textContent || '').trim() || paragraph.querySelector('br,img')) {
    parent.appendChild(paragraph);
  }
}

function cloneTable(table: HTMLElement, baseFontSize: string) {
  const clone = table.cloneNode(true) as HTMLElement;
  clone.setAttribute(
    'style',
    `width: 100%; border-collapse: collapse; margin: 10pt 0 12pt 0; border: 1px solid #000; font-family: ${DOCUMENT_FONT_FAMILY}; font-size: ${baseFontSize}; color: #000;`,
  );

  clone.querySelectorAll<HTMLElement>('th,td').forEach((cell) => {
    const sourceCell = table.querySelectorAll<HTMLElement>('th,td')[Array.from(clone.querySelectorAll('th,td')).indexOf(cell)];
    const sourceStyle = parseStyle(sourceCell?.getAttribute('style'));
    const textAlign = sourceStyle.get('text-align');
    const fontSize = sourceStyle.get('font-size');
    const background = sourceStyle.get('background-color') || sourceStyle.get('background');
    const style = [
      'padding: 7pt',
      'border: 1px solid #000',
      textAlign ? `text-align: ${textAlign}` : '',
      fontSize ? `font-size: ${fontSize}` : '',
      background ? `background-color: ${background}` : '',
    ].filter(Boolean);
    cell.setAttribute('style', `${style.join('; ')};`);
  });

  clone.querySelectorAll<HTMLElement>('tr').forEach((row, index) => {
    const sourceRow = table.querySelectorAll<HTMLElement>('tr')[index];
    const sourceStyle = parseStyle(sourceRow?.getAttribute('style'));
    const style = [
      sourceStyle.get('font-weight') ? `font-weight: ${sourceStyle.get('font-weight')}` : '',
      sourceStyle.get('background-color') || sourceStyle.get('background')
        ? `background-color: ${sourceStyle.get('background-color') || sourceStyle.get('background')}`
        : '',
    ].filter(Boolean);
    if (style.length > 0) row.setAttribute('style', `${style.join('; ')};`);
  });

  return clone;
}

function cloneList(list: HTMLElement, baseFontSize: string) {
  const clone = list.cloneNode(true) as HTMLElement;
  clone.setAttribute(
    'style',
    `font-family: ${DOCUMENT_FONT_FAMILY}; font-size: ${baseFontSize}; line-height: 1.5; color: #000; margin: 0 0 12pt 22pt; padding-left: 14pt;`,
  );
  clone.querySelectorAll<HTMLElement>('li').forEach((item) => {
    item.setAttribute('style', `margin: 0 0 4pt 0; font-family: ${DOCUMENT_FONT_FAMILY}; font-size: ${baseFontSize}; color: #000;`);
  });
  return clone;
}

function appendNode(parent: HTMLElement, node: Node, baseFontSize: string) {
  if (node.nodeType === Node.TEXT_NODE) {
    if ((node.textContent || '').trim()) appendParagraph(parent, null, [node], baseFontSize);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === 'table') {
    parent.appendChild(cloneTable(element, baseFontSize));
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    parent.appendChild(cloneList(element, baseFontSize));
    return;
  }

  if (tag === 'hr') {
    const hr = parent.ownerDocument.createElement('hr');
    hr.setAttribute('style', 'margin: 24pt 0; border: none; border-top: 2pt dotted #475569; page-break-after: always;');
    parent.appendChild(hr);
    return;
  }

  if (BLOCK_TAGS.has(tag) && hasBlockChild(element)) {
    element.childNodes.forEach((child) => appendNode(parent, child, baseFontSize));
    return;
  }

  if (BLOCK_TAGS.has(tag)) {
    appendParagraph(parent, element, Array.from(element.childNodes), baseFontSize);
    return;
  }

  appendParagraph(parent, element, [element], baseFontSize);
}

export function buildSuapClipboardHtml(html: string) {
  if (typeof document === 'undefined') return html;

  const source = document.createElement('div');
  source.innerHTML = html;
  const baseFontSize = getBaseFontSize(source);
  const root = document.createElement('div');
  root.setAttribute(
    'style',
    `font-family: ${DOCUMENT_FONT_FAMILY}; font-size: ${baseFontSize}; line-height: 1.5; color: #000;`,
  );

  const nodes = source.childElementCount === 1 && source.firstElementChild?.tagName.toLowerCase() === 'div'
    ? Array.from(source.firstElementChild.childNodes)
    : Array.from(source.childNodes);

  nodes.forEach((node) => appendNode(root, node, baseFontSize));

  return root.outerHTML;
}

export function htmlToPlainText(html: string) {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  container.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,tr,table,ul,ol,hr').forEach((element) => {
    element.appendChild(document.createTextNode('\n'));
  });

  return (container.textContent || '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function copySuapDocumentToClipboard(html: string, options: CopySuapDocumentOptions = {}): Promise<ClipboardCopyResult> {
  const clipboardHtml = buildSuapClipboardHtml(html);
  const plainText = options.plainText || htmlToPlainText(html);

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const clipboard = new ClipboardItem({
        'text/html': new Blob([clipboardHtml], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboard]);
      return 'html';
    }
  } catch {
    // Fall through to plain text; some browsers expose ClipboardItem but reject rich writes.
  }

  await navigator.clipboard.writeText(plainText);
  return 'plain';
}
