import type {
  ProcessMappingDefinition,
  ProcessMappingLane,
  ProcessMappingNode,
  SuapProcessFlowStep,
  SuapProcessFlowSummary,
  SuapProcessRouteEvent,
  SuapProcessRouteSnapshot,
} from '@/types/processMapping';

const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ')
  .trim()
  .toLowerCase();

const tokens = (value: unknown) => normalize(value).split(/\s+/).filter((token) => token.length > 2);

export function getOrderedMappingNodes(mapping: ProcessMappingDefinition): ProcessMappingNode[] {
  return mapping.nodes
    .filter((node) => ['task', 'subprocess', 'document'].includes(node.type) && node.flowRole !== 'exception')
    .slice()
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);
}

function laneForNode(mapping: ProcessMappingDefinition, node: ProcessMappingNode): ProcessMappingLane | undefined {
  return mapping.lanes.find((lane) => lane.id === node.laneId);
}

function eventMatchesNode(event: SuapProcessRouteEvent, node: ProcessMappingNode, lane?: ProcessMappingLane) {
  const eventText = normalize(`${event.unit || ''} ${event.label} ${event.rawText}`);
  const candidates = [node.responsible, lane?.name]
    .flatMap((value) => [normalize(value), ...tokens(value).filter((token) => token.length >= 4)])
    .filter(Boolean);

  if (candidates.some((candidate) => candidate.length >= 4 && eventText.includes(candidate))) return true;

  return (node.routingAliases || []).some((alias) => {
    const normalizedAlias = normalize(alias);
    if (normalizedAlias.length < 2) return false;
    return new RegExp(`(?:^| )${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(eventText);
  });
}

export function selectSuapProcessMapping<T extends Pick<ProcessMappingDefinition, 'id' | 'tags'>>(
  mappings: T[],
  options: { selectedMappingId?: string; assunto?: string } = {},
): T | undefined {
  const manuallySelected = mappings.find((mapping) => mapping.id === options.selectedMappingId);
  if (manuallySelected) return manuallySelected;

  const subject = normalize(options.assunto);
  if (/\bbolsas?\b|\bbolsistas?\b/.test(subject)) {
    return mappings.find((mapping) => mapping.id === 'liquidacao-pagamento-bolsas'
      || mapping.tags?.some((tag) => normalize(tag) === 'bolsas')) || mappings[0];
  }

  return mappings.find((mapping) => mapping.id === 'liquidacao-pagamento-nota-fiscal') || mappings[0];
}

export function buildSuapProcessFlowSummary(
  mapping: ProcessMappingDefinition,
  route: SuapProcessRouteSnapshot | undefined,
  options: { suapId?: string; processCompleted?: boolean; manualCurrentStepNodeId?: string } = {},
): SuapProcessFlowSummary {
  const events = route?.events || [];
  const nodes = getOrderedMappingNodes(mapping);
  const matches = new Map<string, SuapProcessRouteEvent>();

  let lastAssignedIndex = -1;
  for (const event of events) {
    const candidateIndex = nodes.findIndex((node, index) => index > lastAssignedIndex && eventMatchesNode(event, node, laneForNode(mapping, node)));
    if (candidateIndex < 0) continue;
    matches.set(nodes[candidateIndex].id, event);
    lastAssignedIndex = candidateIndex;
  }

  const matchedIndexes = nodes
    .map((node, index) => (matches.has(node.id) ? index : -1))
    .filter((index) => index >= 0);
  const lastMatchedIndex = matchedIndexes.length ? Math.max(...matchedIndexes) : -1;
  const autoCurrentIndex = options.processCompleted ? -1 : lastMatchedIndex;

  const manualNodeId = options.manualCurrentStepNodeId || route?.manualCurrentStepNodeId;
  const manualIndex = manualNodeId ? nodes.findIndex((node) => node.id === manualNodeId) : -1;
  const isManual = manualIndex >= 0;

  const currentIndex = isManual ? manualIndex : autoCurrentIndex;
  const nextIndex = options.processCompleted ? -1 : (currentIndex >= 0 ? currentIndex + 1 : 0);

  const steps: SuapProcessFlowStep[] = nodes.map((node, index) => {
    const evidence = matches.get(node.id);
    let status: SuapProcessFlowStep['status'] = 'pending';
    if (options.processCompleted || (isManual ? index < currentIndex : (evidence && index < currentIndex))) status = 'completed';
    else if (index === currentIndex) status = 'current';
    else if (index === nextIndex) status = 'next';
    else if (evidence) status = 'not_confirmed';

    return {
      nodeId: node.id,
      code: node.code,
      title: node.title,
      responsible: node.responsible,
      status,
      evidence: evidence?.label || evidence?.rawText,
      laneName: laneForNode(mapping, node)?.name,
      description: node.description,
      automation: node.automation,
    };
  });

  const matchedCount = matches.size;
  const confidence: SuapProcessFlowSummary['confidence'] = isManual
    ? 'high'
    : (!events.length
      ? 'none'
      : matchedCount >= Math.max(2, Math.ceil(nodes.length * 0.6))
        ? 'high'
        : matchedCount > 0
          ? 'medium'
          : 'low');

  return {
    mappingId: mapping.id,
    mappingTitle: mapping.title,
    mappingVersion: mapping.version,
    fullPagePath: `/mapeamentos/${encodeURIComponent(mapping.id)}${options.suapId ? `?suapId=${encodeURIComponent(options.suapId)}` : ''}`,
    observedEvents: events,
    currentNodeId: currentIndex >= 0 ? nodes[currentIndex]?.id : undefined,
    nextNodeId: nextIndex >= 0 ? nodes[nextIndex]?.id : undefined,
    steps,
    confidence,
    isManualCurrentStep: isManual,
    note: isManual
      ? undefined
      : (!events.length
        ? 'O histórico de trâmites ainda não foi identificado nesta página do SUAP.'
        : confidence === 'low'
          ? 'Os trâmites encontrados não foram suficientes para confirmar a etapa atual.'
          : undefined),
  };
}
