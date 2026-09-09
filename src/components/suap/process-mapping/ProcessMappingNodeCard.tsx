import React from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Play,
  Square,
  User,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ProcessMappingNode, SuapProcessFlowStepStatus } from '@/types/processMapping';
import { getNodeDimensions } from './canvasGeometry';

interface ProcessMappingNodeCardProps {
  node: ProcessMappingNode;
  isSelected: boolean;
  isConnectingSource: boolean;
  isSearchMatch?: boolean;
  isSearchActive?: boolean;
  suapStatus?: SuapProcessFlowStepStatus;
  onSelect: (node: ProcessMappingNode) => void;
  onStartConnect: (node: ProcessMappingNode, e: React.MouseEvent) => void;
  onMouseDown: (node: ProcessMappingNode, e: React.MouseEvent) => void;
}

export const ProcessMappingNodeCard: React.FC<ProcessMappingNodeCardProps> = ({
  node,
  isSelected,
  isConnectingSource,
  isSearchMatch = true,
  isSearchActive = false,
  suapStatus,
  onSelect,
  onStartConnect,
  onMouseDown,
}) => {
  const { width, height } = getNodeDimensions(node);

  const checklistTotal = node.checklist?.length || 0;
  const checklistDone = node.checklist?.filter((c) => c.done).length || 0;
  const isCompleted = node.status === 'completed' || suapStatus === 'completed';
  const isCurrentSuap = suapStatus === 'current';

  // Dynamic border & elevation styling
  const getStatusBorder = () => {
    if (isSelected) return 'border-2 border-blue-600 ring-4 ring-blue-100/80 shadow-md bg-white';
    if (isConnectingSource) return 'border-2 border-amber-500 ring-4 ring-amber-100 shadow-md bg-white animate-pulse';
    if (isCurrentSuap) return 'border-2 border-emerald-500 ring-4 ring-emerald-100 shadow-md bg-white animate-pulse';

    switch (node.status) {
      case 'completed':
        return 'border border-slate-300 bg-white hover:border-blue-400 shadow-xs';
      case 'in_progress':
        return 'border-2 border-blue-500 bg-white hover:border-blue-600 shadow-xs';
      case 'blocked':
        return 'border-2 border-rose-400 bg-rose-50/40 hover:border-rose-500 shadow-xs';
      default:
        return 'border border-slate-300 bg-white hover:border-blue-400 shadow-xs';
    }
  };

  const dimOpacityClass = isSearchActive && !isSearchMatch ? 'opacity-30' : 'opacity-100';

  // Render Start Event (Green Circle)
  if (node.type === 'start') {
    return (
      <div
        id={`node-${node.id}`}
        style={{
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onMouseDown={(e) => onMouseDown(node, e)}
        className={cn(
          'absolute cursor-pointer rounded-full flex flex-col items-center justify-center bg-emerald-50 border-2 border-emerald-600 shadow-xs transition-all hover:scale-105 select-none group z-10',
          isSelected && 'ring-4 ring-emerald-100',
          dimOpacityClass
        )}
        title={`Início: ${node.title}`}
      >
        <Play className="w-5 h-5 text-emerald-600 fill-emerald-600 ml-0.5" />
        <span className="absolute -bottom-6 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-200 whitespace-nowrap pointer-events-none">
          {node.code || 'Início'}
        </span>

        {/* Quick Connect Trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartConnect(node, e);
          }}
          title="Conectar a outra etapa"
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs text-xs z-20 font-bold"
        >
          +
        </button>
      </div>
    );
  }

  // Render End Event (Red Circle)
  if (node.type === 'end') {
    return (
      <div
        id={`node-${node.id}`}
        style={{
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onMouseDown={(e) => onMouseDown(node, e)}
        className={cn(
          'absolute cursor-pointer rounded-full flex flex-col items-center justify-center bg-rose-50 border-4 border-rose-600 shadow-xs transition-all hover:scale-105 select-none group z-10',
          isSelected && 'ring-4 ring-rose-100',
          dimOpacityClass
        )}
        title={`Fim: ${node.title}`}
      >
        <Square className="w-4 h-4 text-rose-600 fill-rose-600" />
        <span className="absolute -bottom-6 text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-white px-1.5 py-0.5 rounded shadow-xs border border-slate-200 whitespace-nowrap pointer-events-none">
          {node.code || 'Fim'}
        </span>
      </div>
    );
  }

  // Render Gateway / Decision (BPMN Diamond)
  if (node.type === 'gateway') {
    return (
      <div
        id={`node-${node.id}`}
        style={{
          transform: `translate(${node.position.x}px, ${node.position.y}px)`,
          width: `${width}px`,
          height: `${height}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node);
        }}
        onMouseDown={(e) => onMouseDown(node, e)}
        className={cn(
          'absolute cursor-pointer flex items-center justify-center transition-all hover:scale-105 select-none group z-10',
          dimOpacityClass
        )}
        title={`Decisão: ${node.title}`}
      >
        <div
          className={cn(
            'w-12 h-12 rotate-45 rounded-sm bg-white border-2 border-amber-500 shadow-xs flex items-center justify-center transition-all',
            isSelected && 'ring-4 ring-amber-100 border-amber-600'
          )}
        >
          <span className="-rotate-45 font-black text-amber-800 text-sm">✕</span>
        </div>

        {/* Title Below */}
        <span className="absolute -bottom-7 text-[10px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded shadow-xs border border-slate-200 whitespace-nowrap max-w-[200px] truncate text-center pointer-events-none">
          {node.title}
        </span>

        {/* Quick Connect Trigger */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartConnect(node, e);
          }}
          title="Conectar a outra etapa"
          className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs text-xs z-20 font-bold"
        >
          +
        </button>
      </div>
    );
  }

  // Format step code as PASSO 01 or clean code
  const stepLabel = node.code
    ? node.code.toUpperCase().startsWith('PASSO') || node.code.toUpperCase().startsWith('GW') || node.code.toUpperCase() === 'INÍCIO' || node.code.toUpperCase() === 'FIM'
      ? node.code.toUpperCase()
      : `PASSO ${node.code.padStart(2, '0')}`
    : 'PASSO';

  return (
    <div
      id={`node-${node.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${node.code} ${node.title}`}
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: `${width}px`,
        minHeight: `${height}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node);
        }
      }}
      onMouseDown={(e) => onMouseDown(node, e)}
      className={cn(
        'absolute cursor-pointer rounded-lg p-3 flex flex-col justify-between transition-all select-none group z-10 text-left',
        getStatusBorder(),
        dimOpacityClass,
        isSearchActive && isSearchMatch && 'ring-2 ring-emerald-500'
      )}
    >
      {/* Step Header */}
      <div className="flex justify-between items-start mb-1">
        <span
          className={cn(
            'text-[10px] font-bold tracking-tight',
            isSelected || node.status === 'in_progress' ? 'text-blue-600' : 'text-slate-500'
          )}
        >
          {stepLabel}
        </span>

        <div className="flex items-center gap-1">
          {isCurrentSuap && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
              Etapa SUAP
            </span>
          )}
          {isCompleted ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-50" />
          ) : node.status === 'in_progress' ? (
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-slate-300" />
          )}
        </div>
      </div>

      {/* Title */}
      <p className="text-xs font-bold leading-tight text-slate-900 line-clamp-2 my-0.5">
        {node.title}
      </p>

      {/* Responsible */}
      <p className="text-[10px] text-slate-500 line-clamp-1 flex items-center gap-1">
        <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
        <span className="truncate">{node.responsible}</span>
      </p>

      {/* Step Indicator Bars & Quick Links */}
      <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        {/* Indicators: blue/green bar */}
        <div className="flex items-center gap-1">
          <div
            className={cn(
              'w-4 h-1 rounded-full',
              isCompleted
                ? 'bg-emerald-500'
                : node.status === 'in_progress' || isSelected
                ? 'bg-blue-600'
                : 'bg-slate-200'
            )}
          />
          <div
            className={cn(
              'w-4 h-1 rounded-full',
              isCompleted
                ? 'bg-emerald-500'
                : checklistDone > 0
                ? 'bg-blue-600'
                : 'bg-slate-200'
            )}
          />
        </div>

        {/* Quick Link icons */}
        <div className="flex items-center gap-1 text-[10px]">
          {node.systemUrl && (
            <a
              href={node.systemUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
              title={`Sistema: ${node.systemName || node.systemUrl}`}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {node.templateUrl && (
            <a
              href={node.templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded hover:bg-emerald-50"
              title={`Modelo: ${node.templateName || node.templateUrl}`}
            >
              <FileText className="w-3 h-3" />
            </a>
          )}
          {checklistTotal > 0 && (
            <span className="text-[10px] font-medium text-slate-500">
              {checklistDone}/{checklistTotal}
            </span>
          )}
        </div>
      </div>

      {/* Quick Connect Trigger Handle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStartConnect(node, e);
        }}
        title="Conectar com a próxima etapa"
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xs text-[10px] font-bold z-20"
      >
        +
      </button>
    </div>
  );
};
