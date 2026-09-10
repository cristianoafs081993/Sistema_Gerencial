import type { ProcessMappingEdge, ProcessMappingNode } from '@/types/processMapping';

export interface Point {
  x: number;
  y: number;
}

export type AnchorType = 'top' | 'bottom' | 'left' | 'right';

export interface EdgeControlPoint {
  x: number;
  y: number;
  axis: 'x' | 'y' | 'both';
  index: number;
  label?: string;
}

export interface CalculatedEdgeResult {
  path: string;
  labelPoint: Point;
  points: Point[];
  controlPoints: EdgeControlPoint[];
  sourceAnchor: AnchorType;
  targetAnchor: AnchorType;
}

export function getNodeDimensions(node: ProcessMappingNode): { width: number; height: number } {
  if (node.type === 'start' || node.type === 'end') {
    return { width: node.width || 52, height: node.height || 52 };
  }
  if (node.type === 'gateway') {
    return { width: node.width || 68, height: node.height || 68 };
  }
  return { width: node.width || 190, height: node.height || 105 };
}

export function getNodeCenter(node: ProcessMappingNode): Point {
  const { width, height } = getNodeDimensions(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

export function getAnchorPoint(
  node: ProcessMappingNode,
  anchor: AnchorType,
  offset: number = 0
): Point {
  const dim = getNodeDimensions(node);
  const cx = node.position.x + dim.width / 2;
  const cy = node.position.y + dim.height / 2;

  switch (anchor) {
    case 'top':
      return { x: cx + offset, y: node.position.y };
    case 'bottom':
      return { x: cx + offset, y: node.position.y + dim.height };
    case 'left':
      return { x: node.position.x, y: cy + offset };
    case 'right':
      return { x: node.position.x + dim.width, y: cy + offset };
  }
}

/**
 * Generates an SVG path with smoothly rounded corners between stepped orthogonal points.
 */
export function generateRoundedSteppedPath(points: Point[], radius: number = 8): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Remove consecutive duplicates or micro-steps
  const cleanPoints: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = cleanPoints[cleanPoints.length - 1];
    const curr = points[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 0.5) {
      cleanPoints.push(curr);
    }
  }

  if (cleanPoints.length < 2) return '';
  if (cleanPoints.length === 2) {
    return `M ${cleanPoints[0].x} ${cleanPoints[0].y} L ${cleanPoints[1].x} ${cleanPoints[1].y}`;
  }

  let d = `M ${cleanPoints[0].x} ${cleanPoints[0].y}`;

  for (let i = 1; i < cleanPoints.length - 1; i++) {
    const pPrev = cleanPoints[i - 1];
    const pCurr = cleanPoints[i];
    const pNext = cleanPoints[i + 1];

    const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);

    if (len1 < 1 || len2 < 1) {
      d += ` L ${pCurr.x} ${pCurr.y}`;
      continue;
    }

    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    // Collinear check (straight line through this vertex)
    const cross = u1.x * u2.y - u1.y * u2.x;
    const dot = u1.x * u2.x + u1.y * u2.y;
    if (Math.abs(cross) < 0.05 && dot > 0.95) {
      d += ` L ${pCurr.x} ${pCurr.y}`;
      continue;
    }

    const actualRadius = Math.min(radius, len1 / 2, len2 / 2);
    const startCurve = {
      x: pCurr.x - u1.x * actualRadius,
      y: pCurr.y - u1.y * actualRadius,
    };
    const endCurve = {
      x: pCurr.x + u2.x * actualRadius,
      y: pCurr.y + u2.y * actualRadius,
    };

    d += ` L ${startCurve.x} ${startCurve.y}`;
    d += ` Q ${pCurr.x} ${pCurr.y} ${endCurve.x} ${endCurve.y}`;
  }

  const last = cleanPoints[cleanPoints.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Determines automatic anchor ports based on relative node positioning and BPMN semantics.
 */
export function determineAutoAnchors(
  sourceNode: ProcessMappingNode,
  targetNode: ProcessMappingNode,
  edge: ProcessMappingEdge,
  allEdges?: ProcessMappingEdge[]
): { sourceAnchor: AnchorType; targetAnchor: AnchorType; offset: number } {
  const srcDim = getNodeDimensions(sourceNode);
  const tgtDim = getNodeDimensions(targetNode);
  const srcCenter = getNodeCenter(sourceNode);
  const tgtCenter = getNodeCenter(targetNode);

  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  let sourceAnchor: AnchorType = 'right';
  let targetAnchor: AnchorType = 'left';

  // 1. Gateway Smart Ports: distribute branches across diamond vertices
  if (sourceNode.type === 'gateway') {
    if (dy > 45) {
      sourceAnchor = 'bottom';
      targetAnchor = dx > 80 ? 'left' : 'top';
    } else if (dy < -45) {
      sourceAnchor = 'top';
      targetAnchor = dx > 80 ? 'left' : 'bottom';
    } else if (dx >= 0) {
      sourceAnchor = 'right';
      targetAnchor = 'left';
    } else {
      sourceAnchor = dy >= 0 ? 'bottom' : 'top';
      targetAnchor = 'right';
    }
  }
  // 2. Loopback / Return flow (target is behind source)
  else if (tgtCenter.x + 30 < srcCenter.x) {
    if (dy <= 60) {
      // Loopback above
      sourceAnchor = 'top';
      targetAnchor = 'top';
    } else {
      // Loopback below
      sourceAnchor = 'bottom';
      targetAnchor = 'left';
    }
  }
  // 3. Dominant Vertical alignment (nodes stacked directly above/below)
  else if (Math.abs(dx) < Math.max(srcDim.width, tgtDim.width) * 0.5) {
    if (dy > 0) {
      sourceAnchor = 'bottom';
      targetAnchor = 'top';
    } else {
      sourceAnchor = 'top';
      targetAnchor = 'bottom';
    }
  }
  // 4. Default Horizontal Forward Flow
  else {
    sourceAnchor = 'right';
    targetAnchor = 'left';
  }

  // Respect user override if provided
  if (edge.sourceAnchor && edge.sourceAnchor !== 'auto') {
    sourceAnchor = edge.sourceAnchor;
  }
  if (edge.targetAnchor && edge.targetAnchor !== 'auto') {
    targetAnchor = edge.targetAnchor;
  }

  // Calculate subtle offset if multiple edges share the same source face
  let offset = 0;
  if (allEdges && allEdges.length > 0) {
    const siblings = allEdges.filter(
      (e) => e.source === sourceNode.id && e.id !== edge.id
    );
    if (siblings.length > 0) {
      const mySiblingIndex = siblings.filter((e) => e.id < edge.id).length;
      if (mySiblingIndex > 0) {
        offset = (mySiblingIndex % 2 === 1 ? 1 : -1) * (Math.floor((mySiblingIndex + 1) / 2) * 14);
      }
    }
  }

  return { sourceAnchor, targetAnchor, offset };
}

/**
 * Computes the full stepped path, labels, and draggable control points for an edge.
 */
export function calculateEdgePath(
  sourceNode: ProcessMappingNode,
  targetNode: ProcessMappingNode,
  edge: ProcessMappingEdge,
  allEdges?: ProcessMappingEdge[]
): CalculatedEdgeResult {
  const { sourceAnchor, targetAnchor, offset } = determineAutoAnchors(
    sourceNode,
    targetNode,
    edge,
    allEdges
  );

  const start = getAnchorPoint(sourceNode, sourceAnchor, offset);
  const end = getAnchorPoint(targetNode, targetAnchor);

  let points: Point[] = [];
  const controlPoints: EdgeControlPoint[] = [];

  // Check if custom waypoint exists
  const customW = edge.waypoints && edge.waypoints.length > 0 ? edge.waypoints[0] : null;

  // ROUTING CASES:
  // Case A: Loopback top bypass (top -> top)
  if (sourceAnchor === 'top' && targetAnchor === 'top') {
    const bypassY = customW ? customW.y : Math.min(start.y, end.y) - 36;
    points = [
      start,
      { x: start.x, y: bypassY },
      { x: end.x, y: bypassY },
      end,
    ];
    controlPoints.push({
      x: (start.x + end.x) / 2,
      y: bypassY,
      axis: 'y',
      index: 0,
      label: 'Ajustar altura da linha',
    });
  }
  // Case B: Loopback bottom bypass (bottom -> bottom)
  else if (sourceAnchor === 'bottom' && targetAnchor === 'bottom') {
    const bypassY = customW ? customW.y : Math.max(start.y, end.y) + 36;
    points = [
      start,
      { x: start.x, y: bypassY },
      { x: end.x, y: bypassY },
      end,
    ];
    controlPoints.push({
      x: (start.x + end.x) / 2,
      y: bypassY,
      axis: 'y',
      index: 0,
      label: 'Ajustar altura da linha',
    });
  }
  // Case C: Standard Horizontal Stepped (right -> left)
  else if (
    (sourceAnchor === 'right' && targetAnchor === 'left') ||
    (sourceAnchor === 'left' && targetAnchor === 'right')
  ) {
    if (Math.abs(start.y - end.y) < 6 && !customW) {
      // Straight horizontal
      points = [start, end];
      controlPoints.push({
        x: (start.x + end.x) / 2,
        y: start.y,
        axis: 'x',
        index: 0,
        label: 'Ajustar recuo da linha',
      });
    } else {
      const midX = customW ? customW.x : start.x + (end.x - start.x) / 2;
      points = [
        start,
        { x: midX, y: start.y },
        { x: midX, y: end.y },
        end,
      ];
      controlPoints.push({
        x: midX,
        y: (start.y + end.y) / 2,
        axis: 'x',
        index: 0,
        label: 'Ajustar dobra da linha',
      });
    }
  }
  // Case D: Vertical Stepped (bottom -> top) or (top -> bottom)
  else if (
    (sourceAnchor === 'bottom' && targetAnchor === 'top') ||
    (sourceAnchor === 'top' && targetAnchor === 'bottom')
  ) {
    if (Math.abs(start.x - end.x) < 6 && !customW) {
      points = [start, end];
      controlPoints.push({
        x: start.x,
        y: (start.y + end.y) / 2,
        axis: 'y',
        index: 0,
        label: 'Ajustar posição da linha',
      });
    } else {
      const midY = customW ? customW.y : start.y + (end.y - start.y) / 2;
      points = [
        start,
        { x: start.x, y: midY },
        { x: end.x, y: midY },
        end,
      ];
      controlPoints.push({
        x: (start.x + end.x) / 2,
        y: midY,
        axis: 'y',
        index: 0,
        label: 'Ajustar dobra da linha',
      });
    }
  }
  // Case E: Perpendicular: bottom -> left (common for downward branches)
  else if (sourceAnchor === 'bottom' && targetAnchor === 'left') {
    if (customW) {
      points = [
        start,
        { x: start.x, y: customW.y },
        { x: customW.x, y: customW.y },
        { x: customW.x, y: end.y },
        end,
      ];
      controlPoints.push({
        x: customW.x,
        y: customW.y,
        axis: 'both',
        index: 0,
        label: 'Mover junção',
      });
    } else {
      points = [start, { x: start.x, y: end.y }, end];
      controlPoints.push({
        x: start.x,
        y: end.y,
        axis: 'both',
        index: 0,
        label: 'Ajustar curva',
      });
    }
  }
  // Case F: Perpendicular: top -> left (common for upward branches)
  else if (sourceAnchor === 'top' && targetAnchor === 'left') {
    if (customW) {
      points = [
        start,
        { x: start.x, y: customW.y },
        { x: customW.x, y: customW.y },
        { x: customW.x, y: end.y },
        end,
      ];
      controlPoints.push({
        x: customW.x,
        y: customW.y,
        axis: 'both',
        index: 0,
        label: 'Mover junção',
      });
    } else {
      points = [start, { x: start.x, y: end.y }, end];
      controlPoints.push({
        x: start.x,
        y: end.y,
        axis: 'both',
        index: 0,
        label: 'Ajustar curva',
      });
    }
  }
  // Case G: Perpendicular: right -> top or right -> bottom
  else if (sourceAnchor === 'right' && (targetAnchor === 'top' || targetAnchor === 'bottom')) {
    points = [start, { x: end.x, y: start.y }, end];
    controlPoints.push({
      x: end.x,
      y: start.y,
      axis: 'both',
      index: 0,
      label: 'Ajustar curva',
    });
  }
  // Fallback: General stepped orthogonal router
  else {
    const midX = customW ? customW.x : start.x + (end.x - start.x) / 2;
    points = [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
    controlPoints.push({
      x: midX,
      y: (start.y + end.y) / 2,
      axis: 'x',
      index: 0,
      label: 'Ajustar dobra da linha',
    });
  }

  // Calculate optimal label position
  let labelPoint: Point = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // Find the longest segment to host the label cleanly
  let maxSegLen = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len > maxSegLen) {
      maxSegLen = len;
      const isHorizontal = Math.abs(p1.y - p2.y) < 1;
      labelPoint = {
        x: (p1.x + p2.x) / 2,
        y: isHorizontal ? p1.y - 12 : (p1.y + p2.y) / 2,
      };
    }
  }

  // Generate SVG path string with rounded corners
  const path = generateRoundedSteppedPath(points, 8);

  return {
    path,
    labelPoint,
    points,
    controlPoints,
    sourceAnchor,
    targetAnchor,
  };
}
