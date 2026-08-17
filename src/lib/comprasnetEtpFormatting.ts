import type { ComprasnetEtpFormat, ComprasnetEtpGenerationPreferences } from '@/lib/comprasnetEtpPreferences';

function stripMarkup(value: string) {
  const document = new DOMParser().parseFromString(value, 'text/html');
  return (document.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function splitSentences(value: string) {
  return value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) || [];
}

function splitWords(value: string, count: number) {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length || count <= 1) return [value.trim()];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * words.length / count);
    const end = Math.floor((index + 1) * words.length / count);
    return words.slice(start, Math.max(start + 1, end)).join(' ');
  }).filter(Boolean);
}

function partitionText(value: string, count: number) {
  if (count <= 1) return [value.trim()];
  const sentences = splitSentences(value);
  if (sentences.length >= count) {
    return Array.from({ length: count }, (_, index) => sentences.slice(
      Math.floor(index * sentences.length / count),
      Math.floor((index + 1) * sentences.length / count),
    ).join(' ')).filter(Boolean);
  }
  return splitWords(value, count);
}

function extractBlocks(html: string, tag: 'p' | 'li') {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return Array.from(html.matchAll(pattern)).map((match) => stripMarkup(match[1])).filter(Boolean);
}

function fitTextBlocks(blocks: string[], count: number) {
  const text = blocks.join(' ').replace(/\s+/g, ' ').trim();
  return text ? partitionText(text, count) : [];
}

function formatParagraphs(html: string, paragraphCount: number) {
  const blocks = extractBlocks(html, 'p');
  const source = blocks.length ? blocks : [stripMarkup(html)];
  const fitted = source.length === paragraphCount
    ? source
    : fitTextBlocks(source, paragraphCount);
  return fitted.map((block) => `<p>${escapeHtml(block)}</p>`).join('');
}

function formatItems(html: string, itemCount: number) {
  const blocks = extractBlocks(html, 'li');
  const source = blocks.length ? blocks : extractBlocks(html, 'p');
  const fitted = source.length === itemCount ? source : fitTextBlocks(source, itemCount);
  return fitted.length ? `<ul>${fitted.map((block) => `<li>${escapeHtml(block)}</li>`).join('')}</ul>` : html;
}

export function enforceComprasnetEtpFormat(html: string, preferences: Pick<ComprasnetEtpGenerationPreferences, 'format' | 'paragraphCount' | 'itemCount'>) {
  const format: ComprasnetEtpFormat = preferences.format;
  if (format === 'topicos') return formatItems(html, preferences.itemCount);
  return formatParagraphs(html, preferences.paragraphCount);
}
