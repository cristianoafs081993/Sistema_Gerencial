import type { ProcessMappingAutomation } from '@/types/processMapping';

interface WithAutomations {
  automation?: ProcessMappingAutomation;
  automations?: ProcessMappingAutomation[];
}

/**
 * Lista de automações de uma etapa. Mapeamentos antigos guardam uma única
 * automação em `automation`; ela é tratada como lista de um item.
 */
export function getNodeAutomations(node: WithAutomations | null | undefined): ProcessMappingAutomation[] {
  if (!node) return [];
  if (Array.isArray(node.automations)) return node.automations;
  return node.automation ? [node.automation] : [];
}
