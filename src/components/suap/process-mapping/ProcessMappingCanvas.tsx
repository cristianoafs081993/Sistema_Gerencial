import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  MousePointer2,
  Trash2,
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

    // Dragging Edge Waypoint State
    const [draggingEdgeWaypoint, setDraggingEdgeWaypoint] = useState<{
      edgeId: string;
      controlPointIndex: number;
      axis: 'x' | 'y' | 'both';
    } | null>(null);

    // Grid toggle
    const [showGrid, setShowGrid] = useState(true);

    const handleSelectEdge = (edgeId: string | null) => {
      setSelectedEdgeId(edgeId);
      onSelectedEdgeChange?.(Boolean(edgeId));
    };

    const handleStartDragControlPoint = (
      edge: ProcessMappingEdge,
      controlPointIndex: number,
      axis: 'x' | 'y' | 'both',
      e: React.MouseEvent
    ) => {
      e.stopPropagation();
      handleSelectEdge(edge.id);
      onSelectNode(null);
      setDraggingEdgeWaypoint({
        edgeId: edge.id,
        controlPointIndex,
        axis,
      });
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
    const selectedEdge = mapping.edges.find((e) => e.id === selectedEdgeId);

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
      } else if (draggingEdgeWaypoint) {
        const mouseCanvasX = Math.round((e.clientX - pan.x) / zoom / 10) * 10;
        const mouseCanvasY = Math.round((e.clientY - pan.y) / zoom / 10) * 10;

        const updatedEdges = mapping.edges.map((edge) => {
          if (edge.id !== draggingEdgeWaypoint.edgeId) return edge;
          const waypoints = edge.waypoints && edge.waypoints.length > 0 ? [...edge.waypoints] : [{ x: mouseCanvasX, y: mouseCanvasY }];
          const prevW = waypoints[draggingEdgeWaypoint.controlPointIndex] || { x: mouseCanvasX, y: mouseCanvasY };
          const newW = {
            x: draggingEdgeWaypoint.axis === 'y' ? prevW.x : mouseCanvasX,
            y: draggingEdgeWaypoint.axis === 'x' ? prevW.y : mouseCanvasY,
          };
          waypoints[draggingEdgeWaypoint.controlPointIndex] = newW;
          return { ...edge, waypoints };
        });
        onUpdateMapping({ ...mapping, edges: updatedEdges });
      }
    },
    [isPanning, panStart, draggingNodeId, draggingEdgeWaypoint, pan, dragOffset, zoom, mapping, onUpdateMapping]
  );

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggingEdgeWaypoint(null);
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

  // Change Edge Anchors
  const handleChangeEdgeSourceAnchor = (edgeId: string, anchor: 'auto' | 'top' | 'bottom' | 'left' | 'right') => {
    const updatedEdges = mapping.edges.map((e) =>
      e.id === edgeId ? { ...e, sourceAnchor: anchor } : e
    );
    onUpdateMapping({ ...mapping, edges: updatedEdges });
  };

  const handleChangeEdgeTargetAnchor = (edgeId: string, anchor: 'auto' | 'top' | 'bottom' | 'left' | 'right') => {
    const updatedEdges = mapping.edges.map((e) =>
      e.id === edgeId ? { ...e, targetAnchor: anchor } : e
    );
    onUpdateMapping({ ...mapping, edges: updatedEdges });
  };

  // Toggle Edge Style (solid vs dashed)
  const handleToggleEdgeStyle = (edgeId: string) => {
    const updatedEdges = mapping.edges.map((e) =>
      e.id === edgeId ? { ...e, style: (e.style === 'dashed' ? 'solid' : 'dashed') as 'solid' | 'dashed' } : e
    );
    onUpdateMapping({ ...mapping, edges: updatedEdges });
  };

  // Reset Edge Waypoints & Custom Anchors
  const handleResetEdgeWaypoints = (edgeId: string) => {
    const updatedEdges = mapping.edges.map((e) =>
      e.id === edgeId ? { ...e, waypoints: undefined, sourceAnchor: undefined, targetAnchor: undefined } : e
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

      {/* Floating Edge Settings Bar when an edge is selected */}
      {selectedEdge && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
            <span className="font-bold text-[11px] text-blue-600 uppercase tracking-wider">Conexão</span>
            {selectedEdge.label ? (
              <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded text-[11px] max-w-[130px] truncate border border-blue-200/60">
                {selectedEdge.label}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sem rótulo</span>
            )}
          </div>

          {/* Source Anchor */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Saída:</span>
            <select
              value={selectedEdge.sourceAnchor || 'auto'}
              onChange={(e) => handleChangeEdgeSourceAnchor(selectedEdge.id, e.target.value as any)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer focus:ring-1 focus:ring-blue-500"
              title="Porta de saída do nó de origem"
            >
              <option value="auto">Auto</option>
              <option value="right">Direita</option>
              <option value="bottom">Baixo</option>
              <option value="top">Cima</option>
              <option value="left">Esquerda</option>
            </select>
          </div>

          {/* Target Anchor */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Entrada:</span>
            <select
              value={selectedEdge.targetAnchor || 'auto'}
              onChange={(e) => handleChangeEdgeTargetAnchor(selectedEdge.id, e.target.value as any)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer focus:ring-1 focus:ring-blue-500"
              title="Porta de entrada do nó de destino"
            >
              <option value="auto">Auto</option>
              <option value="left">Esquerda</option>
              <option value="top">Cima</option>
              <option value="bottom">Baixo</option>
              <option value="right">Direita</option>
            </select>
          </div>

          <div className="h-3.5 w-px bg-slate-200" />

          {/* Style Toggle */}
          <button
            type="button"
            onClick={() => handleToggleEdgeStyle(selectedEdge.id)}
            className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium transition cursor-pointer"
            title="Alternar estilo da linha"
          >
            {selectedEdge.style === 'dashed' ? 'Tracejada' : 'Contínua'}
          </button>

          {/* Edit Label */}
          <button
            type="button"
            onClick={() => handleEditEdgeLabel(selectedEdge)}
            className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium transition cursor-pointer"
            title="Editar condição ou texto da ramificação"
          >
            Rótulo
          </button>

          {/* Reset Custom Path */}
          {(selectedEdge.waypoints?.length || selectedEdge.sourceAnchor || selectedEdge.targetAnchor) && (
            <button
              type="button"
              onClick={() => handleResetEdgeWaypoints(selectedEdge.id)}
              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-medium transition cursor-pointer"
              title="Restaurar traçado automático original"
            >
              Restaurar Traçado
            </button>
          )}

          {/* Delete Edge */}
          <button
            type="button"
            onClick={handleDeleteSelectedEdge}
            className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer ml-0.5"
            title="Excluir linha selecionada"
            aria-label="Excluir conexão"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                  allEdges={mapping.edges}
                  isSelected={selectedEdgeId === edge.id}
                  onSelect={(e) => {
                    handleSelectEdge(e.id);
                    onSelectNode(null);
                  }}
                  onEditLabel={handleEditEdgeLabel}
                  onStartDragControlPoint={handleStartDragControlPoint}
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
