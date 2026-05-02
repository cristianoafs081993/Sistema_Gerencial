export type DocumentContextSourceType = 'processo' | 'anexo' | 'etp' | 'mapa_riscos' | 'institucional';

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
  if (snippet.sourceType === 'institucional') return 'Contexto institucional';
  if (snippet.sourceType === 'etp') return 'ETP editado no editor';
  if (snippet.sourceType === 'mapa_riscos') return 'Mapa de Risco editado no editor';
  if (snippet.sourceType === 'anexo') return 'Anexo do ETP';
  return snippet.label || 'Trecho de apoio';
}
