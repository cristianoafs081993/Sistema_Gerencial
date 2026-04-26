export type DocumentContextSourceType = 'processo' | 'anexo' | 'etp';

export type DocumentContextSnippet = {
  id: string;
  kind: string;
  label: string;
  pageNumber?: number;
  excerpt: string;
  sourceType?: DocumentContextSourceType;
  sourceName?: string;
  sourceLabel?: string;
};

export function contextSnippetSourceLabel(snippet: Pick<DocumentContextSnippet, 'label' | 'sourceName' | 'sourceLabel' | 'sourceType'>) {
  if (snippet.sourceLabel?.trim()) return snippet.sourceLabel.trim();
  if (snippet.sourceName?.trim()) return snippet.sourceName.trim();
  if (snippet.sourceType === 'etp') return 'ETP editado no editor';
  if (snippet.sourceType === 'anexo') return 'Anexo do ETP';
  return snippet.label || 'Trecho de apoio';
}
