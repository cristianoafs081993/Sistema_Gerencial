import React from 'react';
import { Layers, Plus } from 'lucide-react';
import type { ProcessMappingNode, ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingSidebarProps {
  processes: ProcessMappingRecord[];
  activeProcess: ProcessMappingRecord;
  onSelectProcess: (id: string) => void;
  onOpenNewProcessModal: () => void;
  onAddNode: (type: 'task' | 'gateway' | 'end' | 'start') => void;
  onActivateConnectMode?: () => void;
}

export const ProcessMappingSidebar: React.FC<ProcessMappingSidebarProps> = ({
  processes,
  activeProcess,
  onSelectProcess,
  onOpenNewProcessModal,
  onAddNode,
  onActivateConnectMode,
}) => {
  const totalTasks = activeProcess.nodes.filter((n) => n.type === 'task').length;
  const systemsCount = activeProcess.nodes.filter((n) => n.systemUrl).length;
  const templatesCount = activeProcess.nodes.filter((n) => n.templateUrl).length;

  return (
    <aside className="w-60 border-r border-slate-200 bg-white flex flex-col shrink-0 hidden md:flex select-none">
      <div className="p-4 flex-1 overflow-y-auto">
        {/* Section 1: Active Processes */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
            Mapeamentos Ativos
          </p>
          <button
            type="button"
            onClick={onOpenNewProcessModal}
            className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold transition-colors"
            title="Criar novo fluxo"
          >
            + NOVO
          </button>
        </div>

        <nav className="space-y-1">
          {processes.map((proc) => {
            const isActive = proc.id === activeProcess.id;
            return (
              <div
                key={proc.id}
                onClick={() => onSelectProcess(proc.id)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                />
                <div className="truncate">
                  <p className="truncate font-medium text-slate-800">{proc.title}</p>
                  <span className="text-[10px] text-slate-400 block">{proc.code}</span>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Section 2: Flow Elements Palette */}
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-6 mb-2">
          Elementos de Fluxo
        </p>
        <div className="grid grid-cols-2 gap-2 text-slate-700">
          {/* Tarefa */}
          <div
            onClick={() => onAddNode('task')}
            className="border border-dashed border-slate-300 p-2.5 rounded-lg flex flex-col items-center gap-1 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-colors"
            title="Clique para adicionar uma Tarefa"
          >
            <div className="w-5 h-4 border-2 border-slate-400 rounded-xs bg-white" />
            <span className="text-[10px] font-medium">Tarefa</span>
          </div>

          {/* Início/Fim */}
          <div
            onClick={() => onAddNode('end')}
            className="border border-dashed border-slate-300 p-2.5 rounded-lg flex flex-col items-center gap-1 hover:border-emerald-500 hover:bg-emerald-50/40 cursor-pointer transition-colors"
            title="Clique para adicionar Início ou Fim"
          >
            <div className="w-4 h-4 border-2 border-slate-400 rounded-full bg-white" />
            <span className="text-[10px] font-medium">Marco / Fim</span>
          </div>

          {/* Decisão / Gateway */}
          <div
            onClick={() => onAddNode('gateway')}
            className="border border-dashed border-slate-300 p-2.5 rounded-lg flex flex-col items-center gap-1 hover:border-amber-400 hover:bg-amber-50/30 cursor-pointer transition-colors"
            title="Clique para adicionar um Ponto de Decisão"
          >
            <div className="w-3.5 h-3.5 border-2 border-slate-400 rotate-45 bg-white" />
            <span className="text-[10px] font-medium">Decisão</span>
          </div>

          {/* Conectar */}
          <div
            onClick={onActivateConnectMode}
            className="border border-dashed border-slate-300 p-2.5 rounded-lg flex flex-col items-center gap-1 hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition-colors"
            title="Passe o mouse sobre uma etapa no fluxo e clique no '+' para conectar"
          >
            <div className="w-4 h-0.5 bg-slate-400 my-1.5" />
            <span className="text-[10px] font-medium">Conectar</span>
          </div>
        </div>
      </div>

      {/* Section 3: Bottom Process Overview Stats */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-slate-700">Categoria:</span>
          <span className="truncate max-w-[120px] font-medium">{activeProcess.category}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-slate-700">Atividades:</span>
          <span className="font-mono font-medium">{totalTasks} etapas</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-slate-700">Sistemas:</span>
          <span className="text-blue-600 font-semibold font-mono">{systemsCount} links</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold text-slate-700">Modelos:</span>
          <span className="text-emerald-600 font-semibold font-mono">{templatesCount} docs</span>
        </div>
      </div>
    </aside>
  );
};
