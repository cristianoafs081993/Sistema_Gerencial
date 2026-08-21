export type ProcessMappingNodeType = 'start' | 'task' | 'gateway' | 'end' | 'subprocess' | 'document';

export type ProcessMappingGatewayType = 'exclusive' | 'parallel' | 'inclusive';

export type ProcessMappingStepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export type ProcessMappingPublicationStatus = 'draft' | 'published' | 'archived';

export interface ProcessMappingChecklistItem {
  id: string;
  text: string;
  done: boolean;
  required?: boolean;
}

export interface ProcessMappingLink {
  id: string;
  label: string;
  url: string;
  category: 'system' | 'template' | 'legislation' | 'tutorial' | 'other';
}

export interface ProcessMappingNode {
  id: string;
  code: string;
  title: string;
  description: string;
  type: ProcessMappingNodeType;
  gatewayType?: ProcessMappingGatewayType;
  laneId?: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  systemName?: string;
  systemUrl?: string;
  templateName?: string;
  templateUrl?: string;
  responsible: string;
  legalBasis?: string;
  inputDocuments?: string[];
  outputDocuments?: string[];
  slaDays?: number;
  status?: ProcessMappingStepStatus;
  checklist?: ProcessMappingChecklistItem[];
  customLinks?: ProcessMappingLink[];
  notes?: string;
  color?: string;
  iconName?: string;
}

export interface ProcessMappingEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
  style?: 'solid' | 'dashed';
  sourceAnchor?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  targetAnchor?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface ProcessMappingLane {
  id: string;
  name: string;
  color: string;
  order: number;
  height?: number;
}

export interface ProcessMappingDefinition {
  id: string;
  title: string;
  code: string;
  description: string;
  category: string;
  version: string;
  updatedAt?: string;
  createdAt?: string;
  owner?: string;
  lanes: ProcessMappingLane[];
  nodes: ProcessMappingNode[];
  edges: ProcessMappingEdge[];
  tags?: string[];
}

export interface ProcessMappingRecord extends ProcessMappingDefinition {
  publicationStatus: ProcessMappingPublicationStatus;
  orgId?: string;
  publishedAt?: string;
}

export interface SuapProcessRouteEvent {
  id: string;
  label: string;
  unit?: string;
  rawText: string;
  order: number;
  timestamp?: string;
}

export interface SuapProcessRouteSnapshot {
  events: SuapProcessRouteEvent[];
  selectedMappingId?: string;
}

export type SuapProcessFlowStepStatus = 'completed' | 'current' | 'next' | 'pending' | 'not_confirmed';

export interface SuapProcessFlowStep {
  nodeId: string;
  code: string;
  title: string;
  responsible: string;
  status: SuapProcessFlowStepStatus;
  evidence?: string;
  laneName?: string;
  description?: string;
}

export interface SuapProcessFlowSummary {
  mappingId: string;
  mappingTitle: string;
  mappingVersion: string;
  fullPagePath: string;
  observedEvents: SuapProcessRouteEvent[];
  currentNodeId?: string;
  nextNodeId?: string;
  steps: SuapProcessFlowStep[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  note?: string;
}
