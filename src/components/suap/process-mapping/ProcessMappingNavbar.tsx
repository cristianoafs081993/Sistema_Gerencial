import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  GitBranch,
  Layers,
  ListOrdered,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ProcessMappingRecord } from '@/types/processMapping';

export type ProcessMappingViewMode = 'canvas' | 'table' | 'execution';

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
  onResetDefaults: () => void;
  suapId?: string;
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
  onOpenAiModal,
  onOpenExportModal,
  onResetDefaults,
  suapId,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-30 select-none">
      {/* Left: Branding & Process Selection */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-600 p-1.5 rounded-lg flex items-center justify-center text-white shadow-xs">
          <GitBranch className="w-4 h-4" />
        </div>
        <div className="flex items-center">
          <h1 className="font-bold text-sm sm:text-base tracking-tight text-slate-900 flex items-center">
            Mapeamento BPMN
          </h1>
        </div>

        {/* Quick process switcher dropdown */}
        <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-200">
          <select
            id="process-selector"
            value={activeProcess.id}
            onChange={(e) => onSelectProcess(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2.5 py-1.5 max-w-[240px] truncate cursor-pointer transition-colors focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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
            className="p-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: Search & View Modes */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:block w-48 xl:w-60">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-process"
            type="text"
            placeholder="Buscar etapa, sistema, lei..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

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
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
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
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Matriz</span>
          </button>
          <button
            type="button"
            id="view-execution"
            role="tab"
            aria-selected={viewMode === 'execution'}
            onClick={() => onChangeViewMode('execution')}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all ${
              viewMode === 'execution'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guia</span>
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
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

        <button
          type="button"
          id="btn-reset-defaults"
          onClick={onResetDefaults}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          title="Restaurar fluxos padrões da Lei 14.133/2021 & SUAP"
          aria-label="Restaurar fluxos padrões"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <Button asChild variant="ghost" size="sm" className="hidden xl:inline-flex text-xs text-slate-500 hover:text-slate-900">
          <Link to="/suap">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Painel SUAP
          </Link>
        </Button>
      </div>
    </header>
  );
};
