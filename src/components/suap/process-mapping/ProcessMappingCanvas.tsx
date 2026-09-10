import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  MousePointer2,
} from 'lucide-react';

import type {
  ProcessMappingDefinition,
  ProcessMappingEdge,
  ProcessMappingNode,
  SuapProcessFlowSummary,
} from '@/types/processMapping';
import { ProcessMappingEdgeLine } from './ProcessMappingEdgeLine';
import { ProcessMappingNodeCard } from './ProcessMappingNodeCard';

export interface ProcessMappingCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  resetZoom: () => void;
  toggleGrid: () => void;
  deleteSelectedEdge: () => void;
}

interface ProcessMappingCanvasProps {
  mapping: ProcessMappingDefinition;
  flow?: SuapProcessFlowSummary;
  selectedNode: ProcessMappingNode | null;
  searchTerm?: string;
  onSelectNode: (node: ProcessMappingNode | null) => void;
  onUpdateMapping: (updated: ProcessMappingDefinition) => void;
  onAddNode?: (type: 'task' | 'gateway' | 'end' | 'start') => void;
  onZoomChange?: (zoom: number) => void;
  onGridChange?: (showGrid: boolean) => void;
  onSelectedEdgeChange?: (hasSelectedEdge: boolean) => void;
}

const DEFAULT_CANVAS_WIDTH = 2800;
const DEFAULT_CANVAS_HEIGHT = 1000;
const LANE_HEIGHT = 180;

export const ProcessMappingCanvas = React.forwardRef<ProcessMappingCanvasHandle, ProcessMappingCanvasProps>(
  function ProcessMappingCanvas(
    {
      mapping,
      flow,
      selectedNode,
      searchTerm = '',
      onSelectNode,
      onUpdateMapping,
      onAddNode,
      onZoomChange,
      onGridChange,
      onSelectedEdgeChange,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Pan and Zoom State
    const [zoom, setZoom] = useState<number>(0.85);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Dragging Node State
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Connection Mode State
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectSourceNode, setConnectSourceNode] = useState<ProcessMappingNode | null>(null);

    // Selected Edge State
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    // Grid toggle
    const [showGrid, setShowGrid] = useState(true);

    const handleSelectEdge = (edgeId: string | null) => {
      setSelectedEdgeId(edgeId);
      onSelectedEdgeChange?.(Boolean(edgeId));
    };

    // Calculate dynamic canvas bounds
    const canvasWidth = Math.max(
      DEFAULT_CANVAS_WIDTH,
      ...mapping.nodes.map((n) => n.position.x + (n.width || 200) + 120)
    );
    const canvasHeight = Math.max(
      DEFAULT_CANVAS_HEIGHT,
      mapping.lanes.length * LANE_HEIGHT,
      ...mapping.nodes.map((n) => n.position.y + (n.height || 120) + 120)
    );

    const nodesById = new Map(mapping.nodes.map((node) => [node.id, node]));

    // Background Pan Handlers
    const handleMouseDownBackground = (e: React.MouseEvent) => {
      if (
        e.target === containerRef.current ||
        (e.target as HTMLElement).tagName === 'svg' ||
        (e.target as HTMLElement).classList.contains('canvas-background')
      ) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        onSelectNode(null);
        handleSelectEdge(null);
        if (isConnecting) {
          setIsConnecting(false);
          setConnectSourceNode(null);
        }
      }
    };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else if (draggingNodeId) {
        const newX = Math.max(20, Math.round((e.clientX - pan.x - dragOffset.x) / zoom / 10) * 10);
        const newY = Math.max(20, Math.round((e.clientY - pan.y - dragOffset.y) / zoom / 10) * 10);

        const updatedNodes = mapping.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n
        );
        onUpdateMapping({ ...mapping, nodes: updatedNodes });
      }
    },
    [isPanning, panStart, draggingNodeId, pan, dragOffset, zoom, mapping, onUpdateMapping]
  );

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Wheel Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prev) => {
        const next = Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.35), 2.2);
        onZoomChange?.(next);
        return next;
      });
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.7,
        y: prev.y - e.deltaY * 0.7,
      }));
    }
  };

  // Node Drag Start
  const handleNodeMouseDown = (node: ProcessMappingNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      if (connectSourceNode && connectSourceNode.id !== node.id) {
        const label = window.prompt(
          'Rótulo da ramificação (ex: "Sim", "Não", "Contratação planejada no PCA") ou deixe em branco:'
        );
        const newEdge: ProcessMappingEdge = {
          id: `edge-${Date.now()}`,
          source: connectSourceNode.id,
          target: node.id,
          label: label?.trim() || undefined,
          style: 'solid',
        };
        onUpdateMapping({
          ...mapping,
          edges: [...mapping.edges, newEdge],
        });
        setIsConnecting(false);
        setConnectSourceNode(null);
      }
      return;
    }

    setDraggingNodeId(node.id);
    setDragOffset({
      x: e.clientX - pan.x - node.position.x * zoom,
      y: e.clientY - pan.y - node.position.y * zoom,
    });
    onSelectNode(node);
  };

  // Connect Mode Trigger
  const handleStartConnect = (node: ProcessMappingNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectSourceNode(node);
  };

  // Delete Selected Edge
  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const updatedEdges = mapping.edges.filter((edge) => edge.id !== selectedEdgeId);
    onUpdateMapping({ ...mapping, edges: updatedEdges });
    handleSelectEdge(null);
  };

  // Edit Edge Label
  const handleEditEdgeLabel = (edge: ProcessMappingEdge) => {
    const nextLabel = window.prompt('Editar condição da ramificação:', edge.label || '');
    if (nextLabel === null) return;
    const updatedEdges = mapping.edges.map((e) =>
      e.id === edge.id ? { ...e, label: nextLabel.trim() || undefined } : e
    );
    onUpdateMapping({ ...mapping, edges: updatedEdges });
  };

  // Zoom controls
  const zoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(2.0, Number((prev + 0.1).toFixed(2)));
      onZoomChange?.(next);
      return next;
    });
  };
  const zoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.4, Number((prev - 0.1).toFixed(2)));
      onZoomChange?.(next);
      return next;
    });
  };
  const resetZoom = () => {
    setZoom(0.85);
    setPan({ x: 0, y: 0 });
    onZoomChange?.(0.85);
  };
  const fitView = () => {
    setZoom(0.75);
    setPan({ x: 0, y: 0 });
    onZoomChange?.(0.75);
  };
  const toggleGrid = () => {
    setShowGrid((prev) => {
      const next = !prev;
      onGridChange?.(next);
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut,
    fitView,
    resetZoom,
    toggleGrid,
    deleteSelectedEdge: handleDeleteSelectedEdge,
  }));

  // Search matching logic
  const isSearchActive = Boolean(searchTerm.trim());
  const searchLower = searchTerm.toLowerCase();

  const isNodeMatch = (node: ProcessMappingNode) => {
    if (!isSearchActive) return true;
    return (
      node.title.toLowerCase().includes(searchLower) ||
      node.code.toLowerCase().includes(searchLower) ||
      node.description.toLowerCase().includes(searchLower) ||
      node.responsible.toLowerCase().includes(searchLower) ||
      Boolean(node.legalBasis?.toLowerCase().includes(searchLower)) ||
      Boolean(node.systemName?.toLowerCase().includes(searchLower)) ||
      Boolean(node.templateName?.toLowerCase().includes(searchLower))
    );
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownBackground}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-white select-none cursor-grab active:cursor-grabbing"
    >
      {/* Floating Instructions / Mode Indicator (Bottom Right) */}
      <div className="absolute right-4 bottom-4 z-20 hidden md:flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
        {isConnecting ? (
          <span className="flex items-center gap-1.5 text-amber-600 font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Clique no nó de destino para conectar
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <MousePointer2 className="h-3.5 w-3.5 text-emerald-600" />
            Clique em uma etapa para ver detalhes ou use &apos;+&apos; para conectar
          </span>
        )}
      </div>

      {/* Transformable Canvas Workspace */}
      <div
        className="relative origin-top-left transition-transform duration-75"
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Background Grid */}
        {showGrid && (
          <div className="canvas-background absolute inset-0 pointer-events-none bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]" />
        )}

        {/* Swimlanes (Raias Horizontais) */}
        {mapping.lanes
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((lane, idx) => (
            <div
              key={lane.id}
              className="absolute left-0 right-0 border-b border-slate-200/90 bg-white flex items-start"
              style={{
                top: idx * (lane.height || LANE_HEIGHT),
                height: lane.height || LANE_HEIGHT,
                background: `linear-gradient(90deg, ${lane.color}15 0%, ${lane.color}05 280px, #ffffff 650px)`,
                borderLeft: `5px solid ${lane.color}`,
              }}
            >
              <div className="sticky left-2 top-2 z-10 flex items-center gap-2 rounded-md bg-white/95 px-2.5 py-1 shadow-2xs border border-slate-200/80 backdrop-blur text-[11px] font-bold uppercase tracking-wider text-slate-700">
                <span className="h-2 w-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: lane.color }} />
                <span>{lane.name}</span>
              </div>
            </div>
          ))}

        {/* SVG Connectors Layer */}
        <svg
          className="absolute inset-0 z-10 h-full w-full pointer-events-none"
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        >
          <defs>
            <marker
              id="mapping-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker
              id="mapping-arrow-selected"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
            </marker>
          </defs>

          <g className="pointer-events-auto">
            {mapping.edges.map((edge) => {
              const source = nodesById.get(edge.source);
              const target = nodesById.get(edge.target);
              if (!source || !target) return null;

              return (
                <ProcessMappingEdgeLine
                  key={edge.id}
                  edge={edge}
                  sourceNode={source}
                  targetNode={target}
                  isSelected={selectedEdgeId === edge.id}
                  onSelectEdge={(e) => {
                    handleSelectEdge(e.id);
                    onSelectNode(null);
                  }}
                  onEditLabel={handleEditEdgeLabel}
                />
              );
            })}
          </g>
        </svg>

        {/* Nodes Layer */}
        {mapping.nodes.map((node) => {
          const isSelected = selectedNode?.id === node.id;
          const isConnectingSource = connectSourceNode?.id === node.id;
          const suapStatus = flow?.steps.find((step) => step.nodeId === node.id)?.status;

          return (
            <ProcessMappingNodeCard
              key={node.id}
              node={node}
              isSelected={isSelected}
              isConnectingSource={isConnectingSource}
              isSearchMatch={isNodeMatch(node)}
              isSearchActive={isSearchActive}
              suapStatus={suapStatus}
              onSelect={onSelectNode}
              onStartConnect={handleStartConnect}
              onMouseDown={handleNodeMouseDown}
            />
          );
        })}
      </div>
    </div>
  );
});
