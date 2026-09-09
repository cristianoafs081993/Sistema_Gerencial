import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BOLSA_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
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
      DEFAULT_PROCESS_MAPPING.id,
    ]);
    expect(new Set(mappings.map((mapping) => mapping.id)).size).toBe(mappings.length);
  });
});
