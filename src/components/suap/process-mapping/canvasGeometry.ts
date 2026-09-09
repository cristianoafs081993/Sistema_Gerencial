import type { ProcessMappingEdge, ProcessMappingNode } from '@/types/processMapping';

export interface Point {
  x: number;
  y: number;
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

export function calculateEdgePath(
  sourceNode: ProcessMappingNode,
  targetNode: ProcessMappingNode,
  edge: ProcessMappingEdge
): { path: string; labelPoint: Point } {
  const srcDim = getNodeDimensions(sourceNode);
  const tgtDim = getNodeDimensions(targetNode);

  const srcCenter = {
    x: sourceNode.position.x + srcDim.width / 2,
    y: sourceNode.position.y + srcDim.height / 2,
  };

  const tgtCenter = {
    x: targetNode.position.x + tgtDim.width / 2,
    y: targetNode.position.y + tgtDim.height / 2,
  };

  let start: Point;
  let end: Point;

  // Decide anchor positions based on relative layout
  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      // Source right -> Target left
      start = { x: sourceNode.position.x + srcDim.width, y: srcCenter.y };
      end = { x: targetNode.position.x, y: tgtCenter.y };
    } else {
      // Source left -> Target right
      start = { x: sourceNode.position.x, y: srcCenter.y };
      end = { x: targetNode.position.x + tgtDim.width, y: tgtCenter.y };
    }
  } else {
    // Vertical dominant
    if (dy > 0) {
      // Source bottom -> Target top
      start = { x: srcCenter.x, y: sourceNode.position.y + srcDim.height };
      end = { x: tgtCenter.x, y: targetNode.position.y };
    } else {
      // Source top -> Target bottom
      start = { x: srcCenter.x, y: sourceNode.position.y };
      end = { x: tgtCenter.x, y: targetNode.position.y + tgtDim.height };
    }
  }

  // Draw orthogonal stepped path or straight line
  let path = '';
  let labelPoint: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  if (Math.abs(start.y - end.y) < 10) {
    // Straight horizontal line
    path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    labelPoint = { x: (start.x + end.x) / 2, y: start.y - 12 };
  } else if (Math.abs(start.x - end.x) < 10) {
    // Straight vertical line
    path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    labelPoint = { x: start.x + 12, y: (start.y + end.y) / 2 };
  } else {
    // Orthogonal stepped connector
    if (Math.abs(dx) >= Math.abs(dy)) {
      const midX = start.x + (end.x - start.x) / 2;
      path = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      labelPoint = { x: midX, y: (start.y + end.y) / 2 };
    } else {
      const midY = start.y + (end.y - start.y) / 2;
      path = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
      labelPoint = { x: (start.x + end.x) / 2, y: midY };
    }
  }

  return { path, labelPoint };
}
