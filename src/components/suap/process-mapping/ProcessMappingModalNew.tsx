import React, { useState } from 'react';
import { BookTemplate, Check, Plus, X } from 'lucide-react';
import type { ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProcess: (newProcess: ProcessMappingRecord) => void;
}

export const ProcessMappingModalNew: React.FC<ProcessMappingModalNewProps> = ({
  isOpen,
  onClose,
  onCreateProcess,
}) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Licitações e Contratos');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'blank' | 'pregao' | 'dispensa'>('blank');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const processId = `proc-${Date.now()}`;
    const generatedCode = code.trim() || `PROC-${Math.floor(100 + Math.random() * 900)}`;

    const newProcess: ProcessMappingRecord = {
      id: processId,
      title: title.trim(),
      code: generatedCode,
      category,
      description: description.trim() || 'Mapeamento de processo operacional.',
      version: '1.0',
      publicationStatus: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lanes: [
        { id: 'lane-1', name: 'Setor Requisitante', color: '#0284c7', order: 0, height: 180 },
        { id: 'lane-2', name: 'Equipe de Planejamento (EPC)', color: '#0d9488', order: 1, height: 180 },
        { id: 'lane-3', name: 'Setor de Licitações / Compras', color: '#7c3aed', order: 2, height: 180 },
        { id: 'lane-4', name: 'Assessoria Jurídica / Ordenador', color: '#059669', order: 3, height: 180 },
      ],
      nodes: [
        {
          id: `node-${Date.now()}-start`,
          code: 'INÍCIO',
          title: 'Demanda Identificada',
          description: 'Início do fluxo de contratação.',
          type: 'start',
          position: { x: 80, y: 100 },
          width: 52,
          height: 52,
          responsible: 'Setor Requisitante',
          laneId: 'lane-1',
          status: 'completed',
        },
        {
          id: `node-${Date.now()}-1`,
          code: '1',
          title: 'Elaborar Documento de Oficialização da Demanda (DOD)',
          description: 'Preencher a necessidade pública e justificativa de contratação.',
          type: 'task',
          position: { x: 200, y: 80 },
          width: 190,
          height: 105,
          responsible: 'Setor Requisitante',
          laneId: 'lane-1',
          systemName: 'SUAP',
          systemUrl: 'https://suap.ifrn.edu.br/',
          templateName: 'Modelo de DOD AGU',
          templateUrl: 'https://www.gov.br/compras/pt-br/modelos',
          legalBasis: 'Art. 12, VII da Lei 14.133/2021',
          slaDays: 5,
          status: 'in_progress',
          checklist: [
            { id: 'chk-1', text: 'Indicar alinhamento com o PCA', done: true, required: true },
            { id: 'chk-2', text: 'Estimar quantidade preliminar', done: false, required: true },
          ],
        },
        {
          id: `node-${Date.now()}-end`,
          code: 'FIM',
          title: 'Processo Concluído',
          description: 'Finalização do processo.',
          type: 'end',
          position: { x: 480, y: 100 },
          width: 52,
          height: 52,
          responsible: 'Setor de Licitações',
          laneId: 'lane-3',
          status: 'pending',
        },
      ],
      edges: [
        {
          id: `edge-${Date.now()}-1`,
          source: `node-${Date.now()}-start`,
          target: `node-${Date.now()}-1`,
          style: 'solid',
        },
        {
          id: `edge-${Date.now()}-2`,
          source: `node-${Date.now()}-1`,
          target: `node-${Date.now()}-end`,
          style: 'solid',
        },
      ],
    };

    onCreateProcess(newProcess);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 font-ui">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Novo Mapeamento de Processo</h3>
              <p className="text-xs text-slate-500">Modelagem em BPMN alinhada à governança pública</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Nome do Processo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Contratação de Serviços de TI por Pregão Eletrônico"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Código do Processo</label>
              <input
                type="text"
                placeholder="Ex: PROC-TI-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Licitações e Contratos">Licitações e Contratos</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Logística e Patrimônio">Logística e Patrimônio</option>
                <option value="Gestão de Pessoas">Gestão de Pessoas</option>
                <option value="Ensino e Pesquisa">Ensino e Pesquisa</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Descrição do Mapeamento</label>
            <textarea
              rows={3}
              placeholder="Descreva a finalidade, escopo e público do fluxo operacional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
            />
          </div>

          {/* Template presets */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Estrutura Inicial</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'blank', label: 'Em Branco', desc: 'Raias padrão' },
                { id: 'pregao', label: 'Pregão / TR', desc: 'Fase preparatória' },
                { id: 'dispensa', label: 'Dispensa Valor', desc: 'Art. 75 simplificado' },
              ].map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id as any)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-colors text-center ${
                    selectedTemplate === tpl.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <BookTemplate className="w-4 h-4 mx-auto mb-1 text-slate-500" />
                  <p className="text-[11px] leading-tight">{tpl.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
            >
              Criar Mapeamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
