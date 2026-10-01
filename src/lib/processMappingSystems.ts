import type { ProcessMappingSystem } from '@/types/processMapping';

interface WithSystems {
  systems?: ProcessMappingSystem[];
  systemName?: string;
  systemUrl?: string;
}

/**
 * Sistemas de uma etapa. Mapeamentos antigos guardam um único sistema em
 * `systemName`/`systemUrl`; ele é tratado como lista de um item.
 */
export function getNodeSystems(node: WithSystems | null | undefined): ProcessMappingSystem[] {
  if (!node) return [];
  if (Array.isArray(node.systems)) return node.systems;
  if (node.systemName || node.systemUrl) {
    return [{ id: 'primary', name: node.systemName || '', url: node.systemUrl || '' }];
  }
  return [];
}
