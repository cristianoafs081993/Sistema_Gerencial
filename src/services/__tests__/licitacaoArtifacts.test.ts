import { describe, expect, it } from 'vitest';

import { mapRow, stripArtifactHtml } from '@/services/licitacaoArtifacts';

describe('licitacaoArtifactsService helpers', () => {
  it('remove HTML para gerar texto puro', () => {
    expect(stripArtifactHtml('<h1>ETP</h1><p>Objeto <strong>revisado</strong>.</p>')).toBe('ETP Objeto revisado.');
  });

  it('normaliza linha da tabela em registro de artefato', () => {
    const mapped = mapRow({
      id: 'artifact-1',
      artifact_type: 'mapa_riscos',
      process_id: 'proc-1',
      process_number: '23035.000123/2026-11',
      title: 'Mapa de Risco',
      html_content: '<h1>Mapa</h1>',
      metadata: { model: 'gemini' },
      source_artifact_ids: ['artifact-etp'],
      version: 2,
      created_at: '2026-05-01T10:00:00.000Z',
      updated_at: '2026-05-01T10:30:00.000Z',
    });

    expect(mapped).toEqual(
      expect.objectContaining({
        id: 'artifact-1',
        artifactType: 'mapa_riscos',
        processId: 'proc-1',
        processNumber: '23035.000123/2026-11',
        plainText: 'Mapa',
        sourceArtifactIds: ['artifact-etp'],
        version: 2,
      }),
    );
  });
});
