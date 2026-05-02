export const PENDING_FIELD_HIGHLIGHT_CLASS = 'pending-field-marker';

export const PENDING_FIELD_HIGHLIGHT_STYLE = [
  'background-color: rgba(240, 58, 46, 0.14)',
  'border-radius: 3px',
  'box-shadow: 0 0 0 1px rgba(240, 58, 46, 0.18)',
  'color: #b91c1c',
  'font-weight: 700',
  'padding: 0 2px',
].join('; ');

export type PendingFieldMarker = {
  start: number;
  end: number;
  text: string;
};

const pendingFieldMarkerPattern = /\[\s*campo\s+pendente\b[^\]]*\]|\bcampo\s+pendente\b/gi;

export const findPendingFieldMarkers = (text: string): PendingFieldMarker[] => {
  const markers: PendingFieldMarker[] = [];
  const pattern = new RegExp(pendingFieldMarkerPattern);
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    markers.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }

  return markers;
};

export const hasPendingFieldMarker = (text: string) => findPendingFieldMarkers(text).length > 0;

const shouldSkipTextNode = (node: Text) => {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest(`.${PENDING_FIELD_HIGHLIGHT_CLASS}`)) return true;

  const tagName = parent.tagName.toLowerCase();
  return tagName === 'script' || tagName === 'style';
};

const highlightTextNode = (textNode: Text) => {
  const value = textNode.nodeValue || '';
  const markers = findPendingFieldMarkers(value);
  if (markers.length === 0) return;

  const fragment = document.createDocumentFragment();
  let cursor = 0;

  markers.forEach((marker) => {
    if (marker.start > cursor) {
      fragment.append(document.createTextNode(value.slice(cursor, marker.start)));
    }

    const span = document.createElement('span');
    span.className = PENDING_FIELD_HIGHLIGHT_CLASS;
    span.setAttribute('style', PENDING_FIELD_HIGHLIGHT_STYLE);
    span.textContent = marker.text;
    fragment.append(span);

    cursor = marker.end;
  });

  if (cursor < value.length) {
    fragment.append(document.createTextNode(value.slice(cursor)));
  }

  textNode.replaceWith(fragment);
};

export const highlightPendingFieldsInElement = (element: Node | null) => {
  if (!element || typeof document === 'undefined') return;

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    const textNode = current as Text;
    if (!shouldSkipTextNode(textNode) && hasPendingFieldMarker(textNode.nodeValue || '')) {
      textNodes.push(textNode);
    }
    current = walker.nextNode();
  }

  textNodes.forEach(highlightTextNode);
};

export const highlightPendingFieldsInHtml = (html: string) => {
  if (!html || typeof document === 'undefined') return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  highlightPendingFieldsInElement(template.content);
  return template.innerHTML;
};
