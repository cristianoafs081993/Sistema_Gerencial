import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Plus,
  Search,
  User,
} from 'lucide-react';

import type { ProcessMappingNode, ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingListViewProps {
  process: ProcessMappingRecord;
  onSelectNode: (node: ProcessMappingNode) => void;
  onAddNewNode: () => void;
}

export const ProcessMappingListView: React.FC<ProcessMappingListViewProps> = ({
  process,
  onSelectNode,
  onAddNewNode,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'system' | 'template' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tasks = process.nodes.filter((n) => n.type === 'task');

  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        task.title.toLowerCase().includes(q) ||
        task.code.toLowerCase().includes(q) ||
        task.responsible.toLowerCase().includes(q) ||
        Boolean(task.systemName?.toLowerCase().includes(q)) ||
        Boolean(task.templateName?.toLowerCase().includes(q)) ||
        Boolean(task.legalBasis?.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Type filter
    if (filterType === 'system') return Boolean(task.systemUrl);
    if (filterType === 'template') return Boolean(task.templateUrl);
    if (filterType === 'pending') return task.status === 'pending' || task.status === 'in_progress';
    if (filterType === 'completed') return task.status === 'completed';

    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header & Stats Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              {process.code}
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Matriz de Processo & Gestão de Procedimentos
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Visão tabular completa de todas as atividades, links diretos para os sistemas governamentais, modelos padronizados, prazos e bases legais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddNewNode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Atividade</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filtrar:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Todas ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('system')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                filterType === 'system'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Com Link de Sistema ({tasks.filter((t) => t.systemUrl).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('template')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                filterType === 'template'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Com Link de Modelo ({tasks.filter((t) => t.templateUrl).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('pending')}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                filterType === 'pending'
                  ? 'bg-white text-amber-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Pendentes ({tasks.filter((t) => t.status !== 'completed').length})
            </button>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, lei, sistema..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">Nº</th>
                <th className="py-3.5 px-4 min-w-[220px]">Etapa / Atividade</th>
                <th className="py-3.5 px-4 min-w-[150px]">Responsável</th>
                <th className="py-3.5 px-4 min-w-[180px]">🔗 Link do Sistema</th>
                <th className="py-3.5 px-4 min-w-[180px]">📄 Link do Modelo</th>
                <th className="py-3.5 px-4 min-w-[140px]">Base Legal</th>
                <th className="py-3.5 px-4 min-w-[100px] text-center">Checklist</th>
                <th className="py-3.5 px-4 min-w-[100px] text-center">Status</th>
                <th className="py-3.5 px-4 w-16 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-slate-800 font-normal">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const checklistTotal = task.checklist?.length || 0;
                  const checklistDone = task.checklist?.filter((c) => c.done).length || 0;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onSelectNode(task)}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Code Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 font-bold text-slate-800 border border-slate-200 text-xs">
                          {task.code}
                        </span>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 leading-snug group-hover:text-emerald-700 transition-colors">
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {task.description}
                          </div>
                        )}
                      </td>

                      {/* Responsible */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{task.responsible || '-'}</span>
                        </div>
                        {task.slaDays ? (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Prazo: {task.slaDays} dias úteis</span>
                          </div>
                        ) : null}
                      </td>

                      {/* Link do Sistema */}
                      <td className="py-3.5 px-4">
                        {task.systemUrl ? (
                          <a
                            href={task.systemUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 text-[11px] transition-colors max-w-[180px] truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0 text-blue-600" />
                            <span className="truncate">{task.systemName || 'Acessar Sistema'}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Não vinculado</span>
                        )}
                      </td>

                      {/* Link do Modelo */}
                      <td className="py-3.5 px-4">
                        {task.templateUrl ? (
                          <a
                            href={task.templateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 text-[11px] transition-colors max-w-[180px] truncate"
                          >
                            <FileText className="w-3 h-3 shrink-0 text-emerald-600" />
                            <span className="truncate">{task.templateName || 'Baixar Modelo'}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sem modelo</span>
                        )}
                      </td>

                      {/* Base Legal */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] text-slate-600 line-clamp-2" title={task.legalBasis}>
                          {task.legalBasis || '-'}
                        </span>
                      </td>

                      {/* Checklist */}
                      <td className="py-3.5 px-4 text-center">
                        {checklistTotal > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              checklistDone === checklistTotal
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {checklistDone === checklistTotal && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {checklistDone}/{checklistTotal}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            task.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : task.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : task.status === 'blocked'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {task.status === 'completed'
                            ? 'Concluída'
                            : task.status === 'in_progress'
                            ? 'Em Andamento'
                            : task.status === 'blocked'
                            ? 'Bloqueada'
                            : 'Pendente'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(task);
                          }}
                          className="px-2 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-md font-semibold text-[11px] transition-colors"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhuma atividade encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
