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
    .filter((node) => !['start', 'end'].includes(node.type))
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

  return candidates.some((candidate) => candidate.length >= 4 && eventText.includes(candidate));
}

export function buildSuapProcessFlowSummary(
  mapping: ProcessMappingDefinition,
  route: SuapProcessRouteSnapshot | undefined,
  options: { suapId?: string; processCompleted?: boolean } = {},
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
  const currentIndex = options.processCompleted ? -1 : lastMatchedIndex;
  const nextIndex = options.processCompleted ? -1 : (currentIndex >= 0 ? currentIndex + 1 : 0);

  const steps: SuapProcessFlowStep[] = nodes.map((node, index) => {
    const evidence = matches.get(node.id);
    let status: SuapProcessFlowStep['status'] = 'pending';
    if (options.processCompleted || (evidence && index < currentIndex)) status = 'completed';
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
    };
  });

  const matchedCount = matches.size;
  const confidence: SuapProcessFlowSummary['confidence'] = !events.length
    ? 'none'
    : matchedCount >= Math.max(2, Math.ceil(nodes.length * 0.6))
      ? 'high'
      : matchedCount > 0
        ? 'medium'
        : 'low';

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
    note: !events.length
      ? 'O histórico de trâmites ainda não foi identificado nesta página do SUAP.'
      : confidence === 'low'
        ? 'Os trâmites encontrados não foram suficientes para confirmar a etapa atual.'
        : undefined,
  };
}
