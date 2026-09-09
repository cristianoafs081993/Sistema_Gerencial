import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  FileUp,
  Scale,
  User,
} from 'lucide-react';

import type { ProcessMappingNode, ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingExecutionGuideProps {
  process: ProcessMappingRecord;
  onUpdateProcess: (updated: ProcessMappingRecord) => void;
  onSelectNode: (node: ProcessMappingNode) => void;
}

export const ProcessMappingExecutionGuide: React.FC<ProcessMappingExecutionGuideProps> = ({
  process,
  onUpdateProcess,
  onSelectNode,
}) => {
  const tasks = process.nodes.filter((n) => n.type === 'task');
  const completedTasks = tasks.filter((n) => n.status === 'completed');
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const handleToggleTaskStatus = (task: ProcessMappingNode) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updatedNodes = process.nodes.map((n) =>
      n.id === task.id ? { ...n, status: nextStatus } : n
    );
    onUpdateProcess({ ...process, nodes: updatedNodes });
  };

  const handleToggleChecklistItem = (task: ProcessMappingNode, itemId: string) => {
    const updatedChecklist = (task.checklist || []).map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c
    );
    const updatedNodes = process.nodes.map((n) =>
      n.id === task.id ? { ...n, checklist: updatedChecklist } : n
    );
    onUpdateProcess({ ...process, nodes: updatedNodes });
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Progress Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Guia Operacional
              </span>
              <span className="font-mono text-xs font-semibold text-slate-400">
                {process.code}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              {process.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Siga a sequência lógica das etapas, acesse os sistemas informatizados e utilize os modelos de documentos padronizados.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500">Progresso Geral</div>
              <div className="text-xl font-black text-slate-900 font-mono">
                {completedTasks.length} de {tasks.length} ({progressPercent}%)
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-emerald-500 flex items-center justify-center font-bold text-xs text-emerald-700 bg-emerald-50 shadow-2xs font-mono">
              {progressPercent}%
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/80">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step Cards Sequence */}
      <div className="space-y-4">
        {tasks.map((task, index) => {
          const isCompleted = task.status === 'completed';
          const isInProgress = task.status === 'in_progress';
          const checklistTotal = task.checklist?.length || 0;
          const checklistDone = task.checklist?.filter((c) => c.done).length || 0;

          return (
            <div
              key={task.id}
              className={`bg-white rounded-2xl border transition-all shadow-xs p-5 space-y-4 ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : isInProgress
                  ? 'border-blue-300 ring-2 ring-blue-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Top Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleTaskStatus(task)}
                    className="mt-0.5 shrink-0 transition-transform active:scale-90"
                    title={isCompleted ? 'Marcar como pendente' : 'Marcar etapa como concluída'}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-50" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 hover:text-slate-400" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {task.code || index + 1}
                      </span>
                      <h3
                        className={`text-base font-bold transition-colors ${
                          isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <strong>Responsável:</strong> {task.responsible || 'Equipe'}
                      </span>
                      {task.slaDays && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <strong>Prazo:</strong> {task.slaDays} dias úteis
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectNode(task)}
                  className="text-xs text-slate-400 hover:text-emerald-700 font-semibold px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                >
                  Ver Detalhes
                </button>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-slate-600 leading-relaxed pl-9">
                  {task.description}
                </p>
              )}

              {/* Action Buttons: Links to System & Model */}
              {(task.systemUrl || task.templateUrl) && (
                <div className="flex flex-wrap items-center gap-2 pl-9 pt-1">
                  {task.systemUrl && (
                    <a
                      href={task.systemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 text-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{task.systemName || 'Acessar Sistema Oficial'}</span>
                    </a>
                  )}
                  {task.templateUrl && (
                    <a
                      href={task.templateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 text-xs transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{task.templateName || 'Baixar Modelo Padronizado'}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Interactive Checklist */}
              {checklistTotal > 0 && (
                <div className="pl-9 pt-1">
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Lista de Checagem Obrigatória</span>
                      <span className="font-mono text-slate-500">
                        {checklistDone} de {checklistTotal}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {task.checklist?.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer hover:text-slate-900 select-none group"
                        >
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => handleToggleChecklistItem(task, item.id)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className={item.done ? 'line-through text-slate-400' : ''}>
                            {item.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Documents & Legal Basis */}
              {(task.inputDocuments?.length || task.outputDocuments?.length || task.legalBasis) && (
                <div className="flex flex-wrap items-center gap-4 pl-9 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                  {task.legalBasis && (
                    <div className="flex items-center gap-1 text-slate-600">
                      <Scale className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{task.legalBasis}</span>
                    </div>
                  )}
                  {task.inputDocuments && task.inputDocuments.length > 0 && (
                    <div className="flex items-center gap-1">
                      <FileUp className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Entrada: {task.inputDocuments.join(', ')}</span>
                    </div>
                  )}
                  {task.outputDocuments && task.outputDocuments.length > 0 && (
                    <div className="flex items-center gap-1 text-emerald-700 font-medium">
                      <FileCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>Saída: {task.outputDocuments.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
