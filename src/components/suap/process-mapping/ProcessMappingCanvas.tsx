import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ArrowRight,
  CircleDot,
  Diamond,
  MousePointer2,
  Plus,
  Trash2,
} from 'lucide-react';

import type {
  ProcessMappingDefinition,
  ProcessMappingEdge,
  ProcessMappingLane,
  ProcessMappingNode,
  SuapProcessFlowSummary,
} from '@/types/processMapping';
import { getNodeSystems } from '@/lib/processMappingSystems';
import { getNodeDimensions } from './canvasGeometry';
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

    // Floating Add Node Type Chooser Menu State
    const [addNodeMenu, setAddNodeMenu] = useState<{
      sourceNode: ProcessMappingNode;
    } | null>(null);

    // Lane editor state
    const [editingLaneId, setEditingLaneId] = useState<string | null>(null);

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

    // Rascunho do rótulo da conexão selecionada (null = editor fechado). Não usa window.prompt,
    // que não existe em navegadores embutidos (ex.: app desktop).
    const [labelDraft, setLabelDraft] = useState<string | null>(null);

    const handleSelectEdge = (edgeId: string | null) => {
      setSelectedEdgeId(edgeId);
      setLabelDraft(null);
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
    const totalLanesHeight = mapping.lanes.reduce((acc, l) => acc + (l.height || LANE_HEIGHT), 0);
    const canvasWidth = Math.max(
      DEFAULT_CANVAS_WIDTH,
      ...mapping.nodes.map((n) => n.position.x + (n.width || 200) + 120)
    );
    const canvasHeight = Math.max(
      DEFAULT_CANVAS_HEIGHT,
      totalLanesHeight,
      ...mapping.nodes.map((n) => n.position.y + (n.height || 120) + 120)
    );

    const clampPan = useCallback(
      (p: { x: number; y: number }, currentZoom: number = zoom): { x: number; y: number } => {
        const container = containerRef.current;
        const containerWidth = container?.clientWidth || 1200;
        const containerHeight = container?.clientHeight || 800;

        const totalWidth = canvasWidth * currentZoom;
        const totalHeight = canvasHeight * currentZoom;

        // Limite superior/esquerdo fixado em 0 para impedir espaço em branco
        // entre a primeira raia e o cabeçalho/barra superior ao dar scroll para cima.
        const maxX = 0;
        const maxY = 0;

        const minX = Math.min(0, containerWidth - totalWidth - 80);
        const minY = Math.min(0, containerHeight - totalHeight - 80);

        return {
          x: Math.min(maxX, Math.max(minX, p.x)),
          y: Math.min(maxY, Math.max(minY, p.y)),
        };
      },
      [canvasWidth, canvasHeight, zoom]
    );

    // Garante que pan permaneça dentro dos limites caso o mapeamento ou zoom altere
    useEffect(() => {
      setPan((currentPan) => {
        const clamped = clampPan(currentPan, zoom);
        if (clamped.x === currentPan.x && clamped.y === currentPan.y) {
          return currentPan;
        }
        return clamped;
      });
    }, [mapping, clampPan, zoom]);

    const nodesById = new Map(mapping.nodes.map((node) => [node.id, node]));
    const selectedEdge = mapping.edges.find((e) => e.id === selectedEdgeId);

    // Background Pan Handlers
    const handleMouseDownBackground = (e: React.MouseEvent) => {
      setAddNodeMenu(null);
      setEditingLaneId(null);
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

    // Fechar menu de inserção e modo de conexão ao pressionar Escape
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setAddNodeMenu(null);
          setEditingLaneId(null);
          setIsConnecting(false);
          setConnectSourceNode(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if ((isPanning || draggingNodeId || draggingEdgeWaypoint) && e.buttons === 0 && e.type === 'mousemove') {
        // Botão já foi solto (mouseup perdido): encerra o arraste em vez de seguir o cursor
        setIsPanning(false);
        setDraggingNodeId(null);
        setDraggingEdgeWaypoint(null);
        return;
      }
      if (isPanning) {
        const rawX = e.clientX - panStart.x;
        const rawY = e.clientY - panStart.y;
        const clamped = clampPan({ x: rawX, y: rawY });

        // Ajusta panStart para evitar dead-zone ao atingir os limites (ex: y > 0)
        if (rawY > clamped.y) {
          setPanStart((prev) => ({ ...prev, y: e.clientY - clamped.y }));
        }
        if (rawX > clamped.x) {
          setPanStart((prev) => ({ ...prev, x: e.clientX - clamped.x }));
        }

        setPan(clamped);
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
    [isPanning, panStart, draggingNodeId, draggingEdgeWaypoint, pan, dragOffset, zoom, mapping, onUpdateMapping, clampPan]
  );

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setDraggingEdgeWaypoint(null);
  };

  // Soltar o botão fora do canvas (ex.: sobre o painel de detalhes que abre ao selecionar a etapa)
  // não dispara mouseup no container; sem isso o arraste ficaria preso ao cursor.
  const isDragActive = isPanning || Boolean(draggingNodeId) || Boolean(draggingEdgeWaypoint);
  useEffect(() => {
    if (!isDragActive) return;
    const endDrag = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
      setDraggingEdgeWaypoint(null);
    };
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, [isDragActive]);

  // Wheel Zoom / Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prev) => {
        const next = Math.min(Math.max(Number((prev * factor).toFixed(2)), 0.35), 2.2);
        onZoomChange?.(next);
        setPan((currentPan) => clampPan(currentPan, next));
        return next;
      });
    } else {
      setPan((prev) =>
        clampPan({
          x: prev.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * 0.7,
          y: prev.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * 0.7,
        })
      );
    }
  };

  // Cria a conexão e já abre o campo de rótulo (opcional) na barra da conexão
  const createConnection = (sourceId: string, targetId: string) => {
    const newEdge: ProcessMappingEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId,
      style: 'solid',
    };
    onUpdateMapping({
      ...mapping,
      edges: [...mapping.edges, newEdge],
    });
    setIsConnecting(false);
    setConnectSourceNode(null);
    onSelectNode(null);
    handleSelectEdge(newEdge.id);
    setLabelDraft('');
  };

  // Node Drag Start
  const handleNodeMouseDown = (node: ProcessMappingNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddNodeMenu(null);
    if (isConnecting) {
      if (connectSourceNode && connectSourceNode.id !== node.id) {
        createConnection(connectSourceNode.id, node.id);
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

  // Connect / Insert Node Handler (triggered by the '+' next to items)
  const handleStartConnectOrOpenMenu = (node: ProcessMappingNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      if (connectSourceNode && connectSourceNode.id !== node.id) {
        createConnection(connectSourceNode.id, node.id);
      }
      return;
    }
    // Abre/fecha menu flutuante para escolher o tipo de etapa a inserir
    setAddNodeMenu((current) => (current?.sourceNode.id === node.id ? null : { sourceNode: node }));
  };

  // Create new node of chosen type and automatically connect from sourceNode
  const handleCreateAndConnectNode = (
    sourceNode: ProcessMappingNode,
    type: 'task' | 'gateway' | 'end'
  ) => {
    setAddNodeMenu(null);

    const sourceDim = getNodeDimensions(sourceNode);
    const newX = sourceNode.position.x + sourceDim.width + 90;

    let newWidth = 190;
    let newHeight = 105;
    let newNode: ProcessMappingNode;

    if (type === 'gateway') {
      newWidth = 68;
      newHeight = 68;
      const newY = Math.round(sourceNode.position.y + (sourceDim.height - newHeight) / 2);
      const nextGw = mapping.nodes.filter((n) => n.type === 'gateway').length + 1;
      newNode = {
        id: `node-${Date.now()}`,
        code: `GW${nextGw}`,
        title: 'Critério de Decisão?',
        description: 'Ponto de ramificação ou verificação de conformidade.',
        type: 'gateway',
        gatewayType: 'exclusive',
        position: { x: newX, y: Math.max(20, newY) },
        width: newWidth,
        height: newHeight,
        responsible: sourceNode.responsible || 'Responsável',
        laneId: sourceNode.laneId,
        status: 'pending',
      };
    } else if (type === 'end') {
      newWidth = 52;
      newHeight = 52;
      const newY = Math.round(sourceNode.position.y + (sourceDim.height - newHeight) / 2);
      newNode = {
        id: `node-${Date.now()}`,
        code: 'FIM',
        title: 'Processo Concluído',
        description: 'Finalização do processo.',
        type: 'end',
        position: { x: newX, y: Math.max(20, newY) },
        width: newWidth,
        height: newHeight,
        responsible: sourceNode.responsible || 'Responsável',
        laneId: sourceNode.laneId,
        status: 'pending',
      };
    } else {
      newWidth = 190;
      newHeight = 105;
      const newY = Math.round(sourceNode.position.y + (sourceDim.height - newHeight) / 2);
      const nextNum = mapping.nodes.filter((n) => n.type === 'task').length + 1;
      newNode = {
        id: `node-${Date.now()}`,
        code: String(nextNum),
        title: 'Nova Atividade',
        description: 'Descreva os procedimentos e instruções operacionais da etapa.',
        type: 'task',
        position: { x: newX, y: Math.max(20, newY) },
        width: newWidth,
        height: newHeight,
        responsible: sourceNode.responsible || 'Responsável',
        laneId: sourceNode.laneId,
        status: 'pending',
        checklist: [],
        inputDocuments: [],
        outputDocuments: [],
        slaDays: 3,
      };
    }

    const newEdge: ProcessMappingEdge = {
      id: `edge-${Date.now()}`,
      source: sourceNode.id,
      target: newNode.id,
      style: 'solid',
    };

    onUpdateMapping({
      ...mapping,
      nodes: [...mapping.nodes, newNode],
      edges: [...mapping.edges, newEdge],
    });

    onSelectNode(newNode);
  };

  // Delete Selected Edge
  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    const updatedEdges = mapping.edges.filter((edge) => edge.id !== selectedEdgeId);
    onUpdateMapping({ ...mapping, edges: updatedEdges });
    handleSelectEdge(null);
  };

  // Edit Edge Label (editor inline na barra da conexão)
  const handleEditEdgeLabel = (edge: ProcessMappingEdge) => {
    handleSelectEdge(edge.id);
    onSelectNode(null);
    setLabelDraft(edge.label || '');
  };

  const handleCommitEdgeLabel = () => {
    if (!selectedEdgeId || labelDraft === null) return;
    const nextLabel = labelDraft.trim();
    const updatedEdges = mapping.edges.map((e) =>
      e.id === selectedEdgeId ? { ...e, label: nextLabel || undefined } : e
    );
    onUpdateMapping({ ...mapping, edges: updatedEdges });
    setLabelDraft(null);
  };

  // Lane editing
  const getSortedLanes = () => mapping.lanes.slice().sort((a, b) => a.order - b.order);

  const commitLanes = (lanes: ProcessMappingLane[], nodes: ProcessMappingNode[] = mapping.nodes) => {
    onUpdateMapping({ ...mapping, lanes: lanes.map((lane, index) => ({ ...lane, order: index })), nodes });
  };

  const handleUpdateLane = (laneId: string, patch: Partial<ProcessMappingLane>) => {
    const lanes = getSortedLanes().map((l) => (l.id === laneId ? { ...l, ...patch } : l));
    // Mantém o responsável das etapas da raia sincronizado quando ela é renomeada
    const previousName = patch.name !== undefined ? mapping.lanes.find((l) => l.id === laneId)?.name : undefined;
    const nodes =
      previousName !== undefined && patch.name
        ? mapping.nodes.map((n) =>
            n.laneId === laneId && n.responsible === previousName ? { ...n, responsible: patch.name as string } : n
          )
        : mapping.nodes;
    commitLanes(lanes, nodes);
  };

  const handleMoveLane = (laneId: string, direction: -1 | 1) => {
    const lanes = getSortedLanes();
    const index = lanes.findIndex((l) => l.id === laneId);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= lanes.length) return;
    [lanes[index], lanes[swapIndex]] = [lanes[swapIndex], lanes[index]];
    commitLanes(lanes);
  };

  const handleAddLane = () => {
    const lanes = getSortedLanes();
    const palette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
    const newLane: ProcessMappingLane = {
      id: `lane-${Date.now()}`,
      name: `Nova raia ${lanes.length + 1}`,
      color: palette[lanes.length % palette.length],
      order: lanes.length,
      height: LANE_HEIGHT,
    };
    commitLanes([...lanes, newLane]);
    setEditingLaneId(newLane.id);
  };

  const handleDeleteLane = (laneId: string) => {
    const lanes = getSortedLanes();
    if (lanes.length <= 1) return;
    const fallback = lanes.find((l) => l.id !== laneId)!;
    const used = mapping.nodes.filter((n) => n.laneId === laneId).length;
    const message =
      used > 0
        ? `Excluir a raia? As ${used} etapa(s) dela serão movidas para "${fallback.name}".`
        : 'Excluir esta raia?';
    if (!window.confirm(message)) return;
    const nodes = mapping.nodes.map((n) => (n.laneId === laneId ? { ...n, laneId: fallback.id } : n));
    commitLanes(
      lanes.filter((l) => l.id !== laneId),
      nodes
    );
    setEditingLaneId(null);
  };

  // Reconnect Edge (change source or target node)
  const handleReconnectEdge = (edgeId: string, end: 'source' | 'target', nodeId: string) => {
    const updatedEdges = mapping.edges.map((e) => {
      if (e.id !== edgeId || e[end] === nodeId) return e;
      // O traçado manual deixa de fazer sentido com a nova ligação
      return {
        ...e,
        [end]: nodeId,
        waypoints: undefined,
        ...(end === 'source' ? { sourceAnchor: undefined } : { targetAnchor: undefined }),
      };
    });
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
      setPan((currentPan) => clampPan(currentPan, next));
      return next;
    });
  };
  const zoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(0.4, Number((prev - 0.1).toFixed(2)));
      onZoomChange?.(next);
      setPan((currentPan) => clampPan(currentPan, next));
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
      getNodeSystems(node).some((system) => system.name.toLowerCase().includes(searchLower)) ||
      Boolean(node.templateName?.toLowerCase().includes(searchLower))
    );
  };

  return (
    <div
      ref={containerRef}
      data-testid="process-mapping-canvas-container"
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
            <MousePointer2 className="h-3.5 w-3.5 text-brand-600" />
            Clique em uma etapa para ver detalhes ou no &apos;+&apos; ao lado para inserir próxima etapa
          </span>
        )}
      </div>

      {/* Floating Edge Settings Bar when an edge is selected */}
      {selectedEdge && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-xs text-slate-700 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
            <span className="font-bold text-[11px] text-brand-600 uppercase tracking-wider">Conexão</span>
            {selectedEdge.label ? (
              <span className="bg-brand-50 text-brand-800 font-semibold px-2 py-0.5 rounded text-[11px] max-w-[130px] truncate border border-brand-200/60">
                {selectedEdge.label}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Sem rótulo</span>
            )}
          </div>

          {/* Source / Target Node */}
          {(['source', 'target'] as const).map((end) => (
            <div key={end} className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 font-medium">{end === 'source' ? 'De:' : 'Para:'}</span>
              <select
                value={selectedEdge[end]}
                onChange={(e) => handleReconnectEdge(selectedEdge.id, end, e.target.value)}
                aria-label={end === 'source' ? 'Etapa de origem da conexão' : 'Etapa de destino da conexão'}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer max-w-[150px] focus:ring-1 focus:ring-brand-500"
                title={end === 'source' ? 'Alterar etapa de origem' : 'Alterar etapa de destino'}
              >
                {mapping.nodes
                  .filter((n) => n.id === selectedEdge[end] || n.id !== selectedEdge[end === 'source' ? 'target' : 'source'])
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.code} - {n.title}
                    </option>
                  ))}
              </select>
            </div>
          ))}

          <div className="h-3.5 w-px bg-slate-200" />

          {/* Source Anchor */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Saída:</span>
            <select
              value={selectedEdge.sourceAnchor || 'auto'}
              onChange={(e) => handleChangeEdgeSourceAnchor(selectedEdge.id, e.target.value as any)}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
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
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
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
          {labelDraft !== null ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                handleCommitEdgeLabel();
              }}
            >
              <input
                autoFocus
                type="text"
                aria-label="Rótulo da conexão"
                placeholder='Ex: "Sim", "Não" (opcional)'
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setLabelDraft(null);
                  }
                }}
                className="w-44 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-medium cursor-pointer"
              >
                OK
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => handleEditEdgeLabel(selectedEdge)}
              className="px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium transition cursor-pointer"
              title="Editar condição ou texto da ramificação"
            >
              Rótulo
            </button>
          )}

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
        data-testid="process-mapping-workspace"
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
        {(() => {
          const sortedLanes = mapping.lanes.slice().sort((left, right) => left.order - right.order);
          let cumulativeTop = 0;
          return sortedLanes.map((lane) => {
            const laneH = lane.height || LANE_HEIGHT;
            const top = cumulativeTop;
            cumulativeTop += laneH;
            return (
              <div
                key={lane.id}
                data-testid={`process-mapping-lane-${lane.id}`}
                className="canvas-background absolute left-0 right-0 border-b border-slate-200/90 bg-white flex items-start"
                style={{
                  top,
                  height: laneH,
                  background: `linear-gradient(90deg, ${lane.color}15 0%, ${lane.color}05 280px, #ffffff 650px)`,
                  borderLeft: `5px solid ${lane.color}`,
                }}
              >
                <button
                  type="button"
                  data-testid={`lane-edit-btn-${lane.id}`}
                  title="Editar raia"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddNodeMenu(null);
                    setEditingLaneId((current) => (current === lane.id ? null : lane.id));
                  }}
                  className="sticky left-2 top-2 z-10 flex items-center gap-2 rounded-md bg-white/95 px-2.5 py-1 shadow-2xs border border-slate-200/80 backdrop-blur text-[11px] font-bold uppercase tracking-wider text-slate-700 hover:border-brand-400 cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: lane.color }} />
                  <span>{lane.name}</span>
                </button>
              </div>
            );
          });
        })()}

        {/* Lane editor + add lane */}
        {(() => {
          const sortedLanes = getSortedLanes();
          let cumulativeTop = 0;
          const tops = sortedLanes.map((lane) => {
            const top = cumulativeTop;
            cumulativeTop += lane.height || LANE_HEIGHT;
            return top;
          });
          const editingIndex = sortedLanes.findIndex((l) => l.id === editingLaneId);
          const editingLane = editingIndex >= 0 ? sortedLanes[editingIndex] : null;
          return (
            <>
              <button
                type="button"
                data-testid="add-lane-btn"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddLane();
                }}
                className="absolute z-20 left-3 flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-brand-700 hover:border-brand-400 cursor-pointer"
                style={{ top: cumulativeTop + 10 }}
              >
                <Plus className="w-3.5 h-3.5" /> Nova raia
              </button>

              {editingLane && (
                <div
                  data-testid="lane-editor"
                  className="absolute z-40 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs text-slate-700 flex flex-col gap-2.5"
                  style={{ left: 24, top: tops[editingIndex] + 40 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Editar raia</span>
                    <button
                      type="button"
                      onClick={() => setEditingLaneId(null)}
                      className="text-slate-400 hover:text-slate-600 text-xs font-bold leading-none cursor-pointer"
                      aria-label="Fechar editor de raia"
                    >
                      ✕
                    </button>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500">Nome</span>
                    <input
                      aria-label="Nome da raia"
                      value={editingLane.name}
                      onChange={(e) => handleUpdateLane(editingLane.id, { name: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs focus:ring-1 focus:ring-brand-500"
                    />
                  </label>
                  <div className="flex items-end gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-500">Cor</span>
                      <input
                        type="color"
                        aria-label="Cor da raia"
                        value={editingLane.color}
                        onChange={(e) => handleUpdateLane(editingLane.id, { color: e.target.value })}
                        className="h-7 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                      />
                    </label>
                    <label className="flex flex-col gap-1 flex-1">
                      <span className="text-[11px] text-slate-500">Altura (px)</span>
                      <input
                        type="number"
                        min={100}
                        max={600}
                        step={20}
                        aria-label="Altura da raia"
                        value={editingLane.height || LANE_HEIGHT}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isFinite(value) && value > 0) {
                            handleUpdateLane(editingLane.id, { height: Math.min(600, Math.max(100, value)) });
                          }
                        }}
                        className="rounded border border-slate-200 px-2 py-1 text-xs focus:ring-1 focus:ring-brand-500"
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Mover raia para cima"
                      disabled={editingIndex === 0}
                      onClick={() => handleMoveLane(editingLane.id, -1)}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      ↑ Subir
                    </button>
                    <button
                      type="button"
                      aria-label="Mover raia para baixo"
                      disabled={editingIndex === sortedLanes.length - 1}
                      onClick={() => handleMoveLane(editingLane.id, 1)}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      ↓ Descer
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir raia"
                      disabled={sortedLanes.length <= 1}
                      onClick={() => handleDeleteLane(editingLane.id)}
                      className="ml-auto p-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}

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
              onSelect={(n) => {
                setAddNodeMenu(null);
                onSelectNode(n);
              }}
              onStartConnect={handleStartConnectOrOpenMenu}
              onMouseDown={handleNodeMouseDown}
            />
          );
        })}

        {/* Quick Add Node Menu (Floating next to the selected source node) */}
        {addNodeMenu && (
          <div
            data-testid="add-node-menu"
            className="absolute z-40 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 p-1.5 flex flex-col gap-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: addNodeMenu.sourceNode.position.x + getNodeDimensions(addNodeMenu.sourceNode).width + 16,
              top: Math.max(10, addNodeMenu.sourceNode.position.y - 10),
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Inserir próxima etapa
              </span>
              <button
                type="button"
                onClick={() => setAddNodeMenu(null)}
                className="text-slate-400 hover:text-slate-600 rounded p-0.5 text-xs font-bold leading-none cursor-pointer"
                aria-label="Fechar menu de inserção"
              >
                ✕
              </button>
            </div>

            {/* Opção Tarefa */}
            <button
              type="button"
              data-testid="add-node-task-btn"
              onClick={() => handleCreateAndConnectNode(addNodeMenu.sourceNode, 'task')}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-brand-700 hover:bg-brand-50/80 rounded-lg transition-colors group cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-brand-700 leading-tight">Tarefa</div>
                <div className="text-[10px] font-normal text-slate-500 leading-tight">Atividade operacional</div>
              </div>
            </button>

            {/* Opção Decisão */}
            <button
              type="button"
              data-testid="add-node-gateway-btn"
              onClick={() => handleCreateAndConnectNode(addNodeMenu.sourceNode, 'gateway')}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-amber-700 hover:bg-amber-50/80 rounded-lg transition-colors group cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Diamond className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-amber-700 leading-tight">Decisão</div>
                <div className="text-[10px] font-normal text-slate-500 leading-tight">Desvio condicional</div>
              </div>
            </button>

            {/* Opção Fim */}
            <button
              type="button"
              data-testid="add-node-end-btn"
              onClick={() => handleCreateAndConnectNode(addNodeMenu.sourceNode, 'end')}
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50/80 rounded-lg transition-colors group cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <CircleDot className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800 group-hover:text-rose-700 leading-tight">Fim</div>
                <div className="text-[10px] font-normal text-slate-500 leading-tight">Conclusão do processo</div>
              </div>
            </button>

            <div className="my-0.5 border-t border-slate-100" />

            {/* Opção Conectar */}
            <button
              type="button"
              data-testid="add-node-connect-btn"
              onClick={() => {
                const src = addNodeMenu.sourceNode;
                setAddNodeMenu(null);
                setIsConnecting(true);
                setConnectSourceNode(src);
              }}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-brand-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer text-left"
            >
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Conectar a etapa existente...</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
