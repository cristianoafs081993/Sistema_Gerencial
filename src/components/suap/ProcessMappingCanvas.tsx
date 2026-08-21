import { useMemo, useState } from 'react';
import { Maximize2, Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import type {
  ProcessMappingDefinition,
  ProcessMappingEdge,
  ProcessMappingNode,
  SuapProcessFlowSummary,
} from '@/types/processMapping';

type Props = {
  mapping: ProcessMappingDefinition;
  flow?: SuapProcessFlowSummary;
  selectedNodeId?: string;
  onSelectNode?: (node: ProcessMappingNode) => void;
};

const CANVAS_WIDTH = 1900;
const CANVAS_HEIGHT = 800;

function nodeSize(node: ProcessMappingNode) {
  return { width: node.width || (node.type === 'gateway' ? 76 : 220), height: node.height || 112 };
}

function center(node: ProcessMappingNode) {
  const size = nodeSize(node);
  return { x: node.position.x + size.width / 2, y: node.position.y + size.height / 2 };
}

function edgePath(edge: ProcessMappingEdge, nodesById: Map<string, ProcessMappingNode>) {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return '';

  const from = center(source);
  const to = center(target);
  const forward = to.x >= from.x;
  const bend = Math.max(70, Math.abs(to.x - from.x) * 0.38);
  const controlX = forward ? bend : -bend;
  return `M ${from.x} ${from.y} C ${from.x + controlX} ${from.y}, ${to.x - controlX} ${to.y}, ${to.x} ${to.y}`;
}

function flowStatus(flow: SuapProcessFlowSummary | undefined, nodeId: string) {
  return flow?.steps.find((step) => step.nodeId === nodeId)?.status;
}

function statusLabel(status: ReturnType<typeof flowStatus>) {
  if (status === 'completed') return 'Concluída';
  if (status === 'current') return 'Etapa atual';
  if (status === 'next') return 'Próxima etapa';
  return undefined;
}

export function ProcessMappingCanvas({ mapping, flow, selectedNodeId, onSelectNode }: Props) {
  const [zoom, setZoom] = useState(0.78);
  const nodesById = useMemo(() => new Map(mapping.nodes.map((node) => [node.id, node])), [mapping.nodes]);
  const laneHeight = 180;

  const fit = () => setZoom(0.78);
  const zoomIn = () => setZoom((value) => Math.min(1.15, Number((value + 0.08).toFixed(2))));
  const zoomOut = () => setZoom((value) => Math.max(0.55, Number((value - 0.08).toFixed(2))));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fbfd] shadow-[0_18px_50px_-30px_rgba(15,23,42,0.38)]">
      <div className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        <button type="button" onClick={zoomOut} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Reduzir zoom"><Minus className="h-4 w-4" /></button>
        <span className="min-w-12 text-center font-mono text-[10px] font-bold text-slate-500">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Aumentar zoom"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={fit} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Ajustar mapa"><Maximize2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom(1)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Restaurar zoom"><RotateCcw className="h-4 w-4" /></button>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur md:flex">
        <MousePointer2 className="h-3.5 w-3.5 text-emerald-600" /> Clique em uma etapa para ver os detalhes
      </div>

      <div className="max-h-[760px] min-h-[580px] overflow-auto p-5 pt-20 [scrollbar-color:#cbd5e1_transparent]">
        <div className="relative origin-top-left transition-transform duration-200" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${zoom})` }}>
          <div className="absolute inset-0 rounded-2xl border border-slate-200/80 bg-[radial-gradient(#cbd5e1_0.8px,transparent_0.8px)] [background-size:18px_18px]" />

          {mapping.lanes.slice().sort((left, right) => left.order - right.order).map((lane) => (
            <div key={lane.id} className="absolute left-0 right-0 border-b border-slate-200/80" style={{ top: lane.order * laneHeight, height: lane.height || laneHeight, background: `linear-gradient(90deg, ${lane.color}0f, transparent 72%)` }}>
              <div className="absolute left-3 top-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane.color }} />{lane.name}
              </div>
            </div>
          ))}

          <svg className="absolute inset-0 z-10 h-full w-full overflow-visible" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
            <defs>
              <marker id="mapping-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {mapping.edges.map((edge) => {
              const path = edgePath(edge, nodesById);
              return path ? <path key={edge.id} d={path} fill="none" stroke={edge.style === 'dashed' ? '#a78bfa' : '#94a3b8'} strokeDasharray={edge.style === 'dashed' ? '8 7' : undefined} strokeWidth="2.5" markerEnd="url(#mapping-arrow)" /> : null;
            })}
          </svg>

          {mapping.edges.map((edge) => {
            if (!edge.label) return null;
            const source = nodesById.get(edge.source);
            const target = nodesById.get(edge.target);
            if (!source || !target) return null;
            const from = center(source); const to = center(target);
            return <span key={`${edge.id}-label`} className="absolute z-20 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm" style={{ left: `${(from.x + to.x) / 2 - 22}px`, top: `${(from.y + to.y) / 2 - 16}px` }}>{edge.label}</span>;
          })}

          {mapping.nodes.map((node) => {
            const size = nodeSize(node);
            const status = flowStatus(flow, node.id);
            const isSelected = selectedNodeId === node.id;
            const isGateway = node.type === 'gateway';
            const isTerminal = node.type === 'start' || node.type === 'end';
            const accent = node.color || '#0f766e';

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode?.(node)}
                className={cn(
                  'absolute z-30 text-left transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50',
                  isTerminal && 'flex items-center justify-center',
                  isGateway && 'flex items-center justify-center',
                  isSelected && 'z-40',
                )}
                style={{ left: node.position.x, top: node.position.y, width: size.width, height: size.height }}
                aria-label={`${node.code} ${node.title}`}
              >
                {isTerminal ? (
                  <span className={cn('flex h-full w-full items-center justify-center rounded-full border-[5px] bg-white text-center shadow-lg', isSelected && 'ring-4 ring-emerald-200')} style={{ borderColor: accent }}>
                    <span className="font-mono text-[9px] font-black tracking-widest" style={{ color: accent }}>{node.code}</span>
                  </span>
                ) : isGateway ? (
                  <span className={cn('flex h-[76px] w-[76px] rotate-45 items-center justify-center border-2 bg-white shadow-lg', isSelected && 'ring-4 ring-emerald-200')} style={{ borderColor: accent }}>
                    <span className="-rotate-45 px-1 text-center text-[10px] font-bold leading-tight text-slate-700">{node.title}</span>
                  </span>
                ) : (
                  <span className={cn('flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.55)]', isSelected && 'ring-4 ring-emerald-200', status === 'current' && 'border-emerald-500 shadow-[0_10px_25px_-12px_rgba(16,185,129,0.8)]', status === 'completed' && 'bg-emerald-50/80')} style={{ borderColor: isSelected || status === 'current' ? undefined : `${accent}55` }}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-black" style={{ backgroundColor: `${accent}18`, color: accent }}>{node.code}</span>
                      {statusLabel(status) && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{statusLabel(status)}</span>}
                    </span>
                    <span className="line-clamp-2 text-[13px] font-extrabold leading-tight text-slate-800">{node.title}</span>
                    <span className="line-clamp-1 text-[10px] font-semibold text-slate-400">{node.responsible}</span>
                    <span className="h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
