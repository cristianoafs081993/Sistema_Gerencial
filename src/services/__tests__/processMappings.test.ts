import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BOLSA_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPINGS } from '@/data/defaultProcessMapping';
import { processMappingsService } from '@/services/processMappings';

describe('processMappingsService', () => {
  it('mescla os mapas locais publicados aos remotos sem repetir identificadores', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: DEFAULT_BOLSA_PROCESS_MAPPING.id,
          code: DEFAULT_BOLSA_PROCESS_MAPPING.code,
          title: DEFAULT_BOLSA_PROCESS_MAPPING.title,
          description: DEFAULT_BOLSA_PROCESS_MAPPING.description,
          category: DEFAULT_BOLSA_PROCESS_MAPPING.category,
          version: DEFAULT_BOLSA_PROCESS_MAPPING.version,
          status: 'published',
          definition: DEFAULT_BOLSA_PROCESS_MAPPING,
        }],
        error: null,
      }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    const mappings = await processMappingsService.listPublished(client as never);

    expect(mappings.map((mapping) => mapping.id)).toEqual([
      DEFAULT_BOLSA_PROCESS_MAPPING.id,
      ...DEFAULT_PROCESS_MAPPINGS
        .filter((mapping) => mapping.id !== DEFAULT_BOLSA_PROCESS_MAPPING.id)
        .map((mapping) => mapping.id),
    ]);
    expect(new Set(mappings.map((mapping) => mapping.id)).size).toBe(mappings.length);
  });

  it('prioriza alterações locais do usuário salvas no localStorage sobre os valores padrão', async () => {
    const editedBolsa = {
      ...DEFAULT_BOLSA_PROCESS_MAPPING,
      title: 'Liquidação de bolsas customizada pelo usuário',
      nodes: DEFAULT_BOLSA_PROCESS_MAPPING.nodes.map((node) =>
        node.id === 'bolsa-step-1'
          ? { ...node, title: 'Etapa 1 customizada pelo usuário' }
          : node
      ),
      updatedAt: new Date(Date.now() + 10000).toISOString(),
    };

    localStorage.setItem('siages_process_mappings_v2', JSON.stringify([editedBolsa]));

    try {
      const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
      const mappings = await processMappingsService.listPublished(client as never);
      const found = mappings.find((m) => m.id === DEFAULT_BOLSA_PROCESS_MAPPING.id);

      expect(found).toBeDefined();
      expect(found?.title).toBe('Liquidação de bolsas customizada pelo usuário');
      expect(found?.nodes.find((n) => n.id === 'bolsa-step-1')?.title).toBe('Etapa 1 customizada pelo usuário');
    } finally {
      localStorage.removeItem('siages_process_mappings_v2');
    }
  });

  it('saveMapping atualiza localStorage e tenta sincronizar no Supabase', async () => {
    const customMapping = {
      ...DEFAULT_BOLSA_PROCESS_MAPPING,
      id: 'custom-flow-test',
      title: 'Fluxo customizado',
      updatedAt: new Date().toISOString(),
    };

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = { from: vi.fn().mockReturnValue(query) };

    try {
      await processMappingsService.saveMapping(customMapping, client as never);

      const raw = localStorage.getItem('siages_process_mappings_v2');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.some((p: { id: string }) => p.id === 'custom-flow-test')).toBe(true);
      expect(client.from).toHaveBeenCalledWith('process_mappings');
    } finally {
      localStorage.removeItem('siages_process_mappings_v2');
    }
  });
});
