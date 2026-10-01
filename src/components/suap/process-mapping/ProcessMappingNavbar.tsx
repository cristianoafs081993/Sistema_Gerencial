import React from 'react';
import {
  Download,
  Grid,
  Layers,
  ListOrdered,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';

import type { ProcessMappingRecord } from '@/types/processMapping';

export type ProcessMappingViewMode = 'canvas' | 'table';

interface ProcessMappingNavbarProps {
  processes: ProcessMappingRecord[];
  activeProcess: ProcessMappingRecord;
  viewMode: ProcessMappingViewMode;
  searchTerm: string;
  onSelectProcess: (id: string) => void;
  onChangeViewMode: (mode: ProcessMappingViewMode) => void;
  onSearchChange: (term: string) => void;
  onOpenNewProcessModal: () => void;
  onOpenAiModal: () => void;
  onOpenExportModal: () => void;
  onResetDefaults?: () => void;
  suapId?: string;
  // Canvas specific tools
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onResetZoom?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  onAddNode?: (type: 'task' | 'gateway' | 'end' | 'start') => void;
  hasSelectedEdge?: boolean;
  onDeleteSelectedEdge?: () => void;
}

export const ProcessMappingNavbar: React.FC<ProcessMappingNavbarProps> = ({
  processes,
  activeProcess,
  viewMode,
  searchTerm,
  onSelectProcess,
  onChangeViewMode,
  onSearchChange,
  onOpenNewProcessModal,
  onOpenExportModal,
  zoom,
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetZoom,
  showGrid,
  onToggleGrid,
  hasSelectedEdge,
  onDeleteSelectedEdge,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 shrink-0 sticky top-0 z-30 select-none">
      {/* Left: Process Selection & View Mode Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1.5">
          <select
            id="process-selector"
            value={activeProcess.id}
            onChange={(e) => onSelectProcess(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1.5 max-w-[180px] sm:max-w-[240px] truncate cursor-pointer transition-colors focus:ring-1 focus:ring-brand-500 focus:outline-none"
            aria-label="Selecionar processo"
          >
            {processes.map((proc) => (
              <option key={proc.id} value={proc.id}>
                {proc.code} — {proc.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            id="btn-new-process"
            onClick={onOpenNewProcessModal}
            title="Criar novo mapeamento"
            className="p-1.5 text-brand-700 hover:text-brand-800 hover:bg-brand-50 border border-brand-200 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="hidden sm:block h-4 w-px bg-slate-200" />

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200" role="tablist">
          <button
            type="button"
            id="view-canvas"
            role="tab"
            aria-selected={viewMode === 'canvas'}
            onClick={() => onChangeViewMode('canvas')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${
              viewMode === 'canvas'
                ? 'bg-white text-brand-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fluxograma</span>
          </button>
          <button
            type="button"
            id="view-table"
            role="tab"
            aria-selected={viewMode === 'table'}
            onClick={() => onChangeViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-white text-brand-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Matriz</span>
          </button>
        </div>
      </div>

      {/* Center: Canvas Workspace Controls (When in Canvas mode) */}
      {viewMode === 'canvas' ? (
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onZoomOut}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
              title="Reduzir zoom"
              aria-label="Reduzir zoom"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold text-slate-600 px-1 min-w-[36px] text-center select-none">
              {Math.round((zoom ?? 0.85) * 100)}%
            </span>
            <button
              type="button"
              onClick={onZoomIn}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={onFitView}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
              title="Ajustar visualização"
              aria-label="Ajustar visualização"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onResetZoom}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
              title="Restaurar zoom"
              aria-label="Restaurar zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleGrid}
              className={`p-1 rounded transition ${
                showGrid ? 'bg-white text-brand-700 shadow-2xs font-bold' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title="Alternar grade"
              aria-label="Alternar grade"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasSelectedEdge && onDeleteSelectedEdge && (
            <button
              type="button"
              onClick={onDeleteSelectedEdge}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
              title="Excluir conexão selecionada"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Excluir Conexão</span>
            </button>
          )}
        </div>
      ) : (
        <div className="hidden md:block" />
      )}

      {/* Right: Search & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative hidden lg:block w-44 xl:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-process"
            type="text"
            placeholder="Buscar etapa, sistema, lei..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
          />
        </div>

        <button
          type="button"
          id="btn-export-process"
          onClick={onOpenExportModal}
          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs transition-colors flex items-center gap-1.5"
          title="Exportar PDF, Imprimir ou Salvar JSON"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
      </div>
    </header>
  );
};
