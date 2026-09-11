import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  FileUp,
  Link2,
  Plus,
  Scale,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';

import type {
  ProcessMappingAutomation,
  ProcessMappingAutomationAction,
  ProcessMappingChecklistItem,
  ProcessMappingLane,
  ProcessMappingLink,
  ProcessMappingNode,
  ProcessMappingStepStatus,
} from '@/types/processMapping';

interface ProcessMappingDetailDrawerProps {
  node: ProcessMappingNode | null;
  lanes: ProcessMappingLane[];
  isOpen: boolean;
  processTitle: string;
  onClose: () => void;
  onUpdateNode: (updatedNode: ProcessMappingNode) => void;
  onDeleteNode: (nodeId: string) => void;
}

export const ProcessMappingDetailDrawer: React.FC<ProcessMappingDetailDrawerProps> = ({
  node,
  lanes,
  isOpen,
  processTitle,
  onClose,
  onUpdateNode,
  onDeleteNode,
}) => {
  const [formData, setFormData] = useState<ProcessMappingNode | null>(null);
  const [activeTab, setActiveTab] = useState<'links' | 'procedure' | 'checklist' | 'automations'>('links');

  // Input states for adding new items
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newInputDoc, setNewInputDoc] = useState('');
  const [newOutputDoc, setNewOutputDoc] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState<ProcessMappingLink['category']>('system');

  useEffect(() => {
    if (node) {
      setFormData({ ...node });
    }
  }, [node]);

  if (!isOpen || !formData) return null;

  const handleChange = <K extends keyof ProcessMappingNode>(field: K, value: ProcessMappingNode[K]) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNode(updated);
  };

  // Quick system presets
  const handleQuickSystem = (name: string, defaultUrl: string) => {
    const updated = {
      ...formData,
      systemName: name,
      systemUrl: formData.systemUrl || defaultUrl,
    };
    setFormData(updated);
    onUpdateNode(updated);
  };

  // Quick template presets
  const handleQuickTemplate = (name: string, defaultUrl: string) => {
    const updated = {
      ...formData,
      templateName: name,
      templateUrl: formData.templateUrl || defaultUrl,
    };
    setFormData(updated);
    onUpdateNode(updated);
  };

  // Add Checklist item
  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const newItem: ProcessMappingChecklistItem = {
      id: `chk-${Date.now()}`,
      text: newChecklistText.trim(),
      done: false,
      required: true,
    };
    const nextChecklist = [...(formData.checklist || []), newItem];
    handleChange('checklist', nextChecklist);
    setNewChecklistText('');
  };

  const handleToggleChecklist = (id: string) => {
    const nextChecklist = (formData.checklist || []).map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    handleChange('checklist', nextChecklist);
  };

  const handleDeleteChecklist = (id: string) => {
    const nextChecklist = (formData.checklist || []).filter((item) => item.id !== id);
    handleChange('checklist', nextChecklist);
  };

  // Add Input Doc
  const handleAddInputDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInputDoc.trim()) return;
    const next = [...(formData.inputDocuments || []), newInputDoc.trim()];
    handleChange('inputDocuments', next);
    setNewInputDoc('');
  };

  const handleRemoveInputDoc = (index: number) => {
    const next = (formData.inputDocuments || []).filter((_, i) => i !== index);
    handleChange('inputDocuments', next);
  };

  // Add Output Doc
  const handleAddOutputDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOutputDoc.trim()) return;
    const next = [...(formData.outputDocuments || []), newOutputDoc.trim()];
    handleChange('outputDocuments', next);
    setNewOutputDoc('');
  };

  const handleRemoveOutputDoc = (index: number) => {
    const next = (formData.outputDocuments || []).filter((_, i) => i !== index);
    handleChange('outputDocuments', next);
  };

  // Add Custom Link
  const handleAddCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    const newLink: ProcessMappingLink = {
      id: `link-${Date.now()}`,
      label: newLinkTitle.trim(),
      url: newLinkUrl.trim(),
      category: newLinkCategory,
    };
    const next = [...(formData.customLinks || []), newLink];
    handleChange('customLinks', next);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleDeleteCustomLink = (id: string) => {
    const next = (formData.customLinks || []).filter((item) => item.id !== id);
    handleChange('customLinks', next);
  };

  const handleAutomationChange = <K extends keyof ProcessMappingAutomation>(
    field: K,
    value: ProcessMappingAutomation[K]
  ) => {
    const current: ProcessMappingAutomation = formData.automation || {
      enabled: true,
      title: 'Concluir e avançar etapa',
      action: 'advance_step',
      autoAdvanceStep: true,
    };
    const updatedAutomation: ProcessMappingAutomation = { ...current, [field]: value };
    handleChange('automation', updatedAutomation);
  };

  const handleApplyAutomationPreset = (preset: Partial<ProcessMappingAutomation>) => {
    const current: ProcessMappingAutomation = formData.automation || {
      enabled: true,
      title: 'Concluir e avançar etapa',
      action: 'advance_step',
      autoAdvanceStep: true,
    };
    const updatedAutomation: ProcessMappingAutomation = { ...current, ...preset, enabled: true };
    handleChange('automation', updatedAutomation);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col font-ui text-slate-900 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
            {formData.code || 'ETAPA'}
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[320px]">
              {formData.title}
            </h2>
            <p className="text-[10px] text-slate-400 truncate max-w-[320px]">
              {processTitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          aria-label="Fechar detalhes"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Metadata Strip */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 grid gap-2 sm:grid-cols-2 text-xs">
        <div className="flex items-center gap-2 text-slate-700 min-w-0">
          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <div className="truncate">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Responsável</span>
            <span className="font-semibold text-slate-800">{formData.responsible || 'Não informado'}</span>
          </div>
        </div>
        {formData.legalBasis ? (
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Scale className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Base normativa</span>
              <span className="font-semibold text-slate-800 truncate block" title={formData.legalBasis}>
                {formData.legalBasis}
              </span>
            </div>
          </div>
        ) : formData.slaDays ? (
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Prazo de referência</span>
              <span className="font-semibold text-slate-800">{formData.slaDays} dias úteis</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-semibold select-none">
        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'links'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Links & Sistemas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('procedure')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'procedure'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Procedimento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Checklist ({formData.checklist?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automations')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'automations'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Automações{formData.automation?.enabled ? ' (1)' : ''}</span>
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* TAB 1: Links & Sistemas */}
        {activeTab === 'links' && (
          <div className="space-y-5">
            {/* Sistema Oficial */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800">
                🔗 Sistema Informatizado da Etapa
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold mr-1 self-center">Presets:</span>
                {[
                  { name: 'SUAP', url: 'https://suap.ifrn.edu.br/' },
                  { name: 'Compras.gov.br', url: 'https://comprasnet.gov.br/' },
                  { name: 'SIAFI', url: 'https://www.gov.br/tesouronacional/pt-br/siafi/' },
                  { name: 'PNCP', url: 'https://pncp.gov.br/' },
                  { name: 'SEI', url: 'https://sei.ifrn.edu.br/' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleQuickSystem(preset.name, preset.url)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 text-[10px] font-semibold transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Nome do sistema (ex: SUAP - Módulo PCA)"
                value={formData.systemName || ''}
                onChange={(e) => handleChange('systemName', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="URL de acesso (ex: https://suap.ifrn.edu.br/...)"
                value={formData.systemUrl || ''}
                onChange={(e) => handleChange('systemUrl', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
            </div>

            {/* Modelo / Minuta */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800">
                📄 Modelo Padronizado / Minuta AGU
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold mr-1 self-center">Presets:</span>
                {[
                  { name: 'Minuta TR AGU', url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos' },
                  { name: 'DOD Lei 14.133', url: 'https://www.gov.br/compras/pt-br/' },
                  { name: 'Minuta Edital Pregão', url: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos' },
                  { name: 'ETP Digital', url: 'https://etp.comprasnet.gov.br/' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleQuickTemplate(preset.name, preset.url)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 text-[10px] font-semibold transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Nome do documento (ex: Minuta de Termo de Referência AGU)"
                value={formData.templateName || ''}
                onChange={(e) => handleChange('templateName', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="URL de download ou modelo"
                value={formData.templateUrl || ''}
                onChange={(e) => handleChange('templateUrl', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-[11px]"
              />
            </div>

            {/* Custom Links */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                Links Adicionais & Normativos
              </label>

              {formData.customLinks && formData.customLinks.length > 0 ? (
                <div className="space-y-1.5">
                  {formData.customLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">{link.label}</p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-600 truncate block hover:underline font-mono"
                        >
                          {link.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomLink(link.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Excluir link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Nenhum link adicional cadastrado.</p>
              )}

              <form onSubmit={handleAddCustomLink} className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  placeholder="Título do link (ex: Manual de Instrução)"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  placeholder="URL (https://...)"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
                />
                <button
                  type="submit"
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Link
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: Procedimento */}
        {activeTab === 'procedure' && (
          <div className="space-y-4">
            {/* Title, Code & Status */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Código</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="col-span-5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Status da Etapa</label>
                <select
                  value={formData.status || 'pending'}
                  onChange={(e) => handleChange('status', e.target.value as ProcessMappingStepStatus)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                >
                  <option value="pending">⚪ Pendente</option>
                  <option value="in_progress">🔵 Em Andamento</option>
                  <option value="completed">🟢 Concluída</option>
                  <option value="blocked">🔴 Bloqueada</option>
                </select>
              </div>
              <div className="col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Fluxo</label>
                <select
                  value={formData.flowRole || 'primary'}
                  onChange={(e) => handleChange('flowRole', e.target.value as 'primary' | 'exception')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="primary">Principal</option>
                  <option value="exception">Exceção</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Título da Atividade</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Detalhamento Operacional
              </label>
              <textarea
                rows={4}
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descreva o passo a passo que o servidor deve executar nesta etapa..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed"
              />
            </div>

            {/* Responsible & SLA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Raia / Unidade Responsável
                </label>
                <select
                  value={formData.laneId || ''}
                  onChange={(e) => {
                    const selectedLane = lanes.find((l) => l.id === e.target.value);
                    const updated = {
                      ...formData,
                      laneId: e.target.value,
                      responsible: selectedLane?.name || formData.responsible,
                    };
                    setFormData(updated);
                    onUpdateNode(updated);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="">Selecione a raia...</option>
                  {lanes.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Prazo de Referência (SLA)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={formData.slaDays || 3}
                    onChange={(e) => handleChange('slaDays', Number(e.target.value))}
                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <span className="text-slate-500 text-xs">dias úteis</span>
                </div>
              </div>
            </div>

            {/* Legal Basis */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Base Normativa / Lei
              </label>
              <input
                type="text"
                placeholder="Ex: Art. 18, I da Lei 14.133/2021; IN SEGES nº 58/2022"
                value={formData.legalBasis || ''}
                onChange={(e) => handleChange('legalBasis', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            {/* Input & Output Documents */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              {/* Inputs */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Entradas Obrigatórias
                </label>
                <div className="space-y-1 mb-2">
                  {formData.inputDocuments?.map((doc, i) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] mr-1 mb-1 font-medium"
                    >
                      {doc}
                      <button
                        type="button"
                        onClick={() => handleRemoveInputDoc(i)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddInputDoc} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="+ Documento de entrada"
                    value={newInputDoc}
                    onChange={(e) => setNewInputDoc(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                  />
                </form>
              </div>

              {/* Outputs */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Saídas Produzidas
                </label>
                <div className="space-y-1 mb-2">
                  {formData.outputDocuments?.map((doc, i) => (
                    <span
                      key={doc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] mr-1 mb-1 font-medium"
                    >
                      {doc}
                      <button
                        type="button"
                        onClick={() => handleRemoveOutputDoc(i)}
                        className="text-emerald-500 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form onSubmit={handleAddOutputDoc} className="flex gap-1">
                  <input
                    type="text"
                    placeholder="+ Documento de saída"
                    value={newOutputDoc}
                    onChange={(e) => setNewOutputDoc(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                  />
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Checklist */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Checklist operacional exigido para certificar a conformidade e conclusão desta etapa do processo.
            </p>

            <div className="space-y-2">
              {formData.checklist && formData.checklist.length > 0 ? (
                formData.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklist(item.id)}
                        className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className={`text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteChecklist(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Excluir item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 border border-dashed rounded-xl">
                  Nenhum item na lista de checagem.
                </div>
              )}
            </div>

            <form onSubmit={handleAddChecklist} className="space-y-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                placeholder="Descreva uma verificação obrigatória..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item ao Checklist
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: Automações */}
        {activeTab === 'automations' && (
          <div className="space-y-4">
            {/* Header explicativo */}
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                <span>Automação do Botão de Check</span>
              </div>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Configure a ação disparada pelo botão de check discreto exibido na etapa atual do painel do SUAP.
              </p>
            </div>

            {/* Switch Habilitar Automação */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60">
              <div>
                <span className="block text-xs font-bold text-slate-800">Ativar automação nesta etapa</span>
                <span className="block text-[11px] text-slate-500">
                  Exibe o botão de check na etapa atual quando este processo estiver em andamento
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.automation?.enabled ?? false}
                  onChange={(e) => handleAutomationChange('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Presets Rápidos */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600">
                Presets Rápidos de Automação
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  {
                    label: '⚡ Concluir e Avançar',
                    preset: {
                      title: 'Concluir conferência e avançar etapa',
                      action: 'advance_step' as ProcessMappingAutomationAction,
                      autoAdvanceStep: true,
                      feedbackMessage: 'Etapa concluída e avançada com sucesso!',
                    },
                  },
                  {
                    label: '📋 Copiar Despacho',
                    preset: {
                      title: 'Copiar minuta de despacho',
                      action: 'copy_text' as ProcessMappingAutomationAction,
                      templateText: 'Certifico a conformidade da etapa {etapa} para o processo {processNumber}, referente ao credor {beneficiario}.',
                      autoAdvanceStep: true,
                      feedbackMessage: 'Minuta de despacho copiada!',
                    },
                  },
                  {
                    label: '🔗 Abrir SIAFI',
                    preset: {
                      title: 'Abrir SIAFI Web',
                      action: 'open_url' as ProcessMappingAutomationAction,
                      targetUrl: 'https://www.gov.br/tesouronacional/pt-br/siafi/',
                      autoAdvanceStep: false,
                      feedbackMessage: 'SIAFI aberto em nova aba.',
                    },
                  },
                  {
                    label: '📄 Minuta no SUAP',
                    preset: {
                      title: 'Criar documento no SUAP',
                      action: 'suap_document' as ProcessMappingAutomationAction,
                      documentType: 'despacho',
                      templateText: 'Processo: {processNumber}\nBeneficiário: {beneficiario}\nEtapa: {etapa}',
                      autoAdvanceStep: true,
                      feedbackMessage: 'Automação de documento SUAP acionada!',
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleApplyAutomationPreset(item.preset)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold transition-colors shadow-2xs"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Título da Automação */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">
                Título / Rótulo da Automação
              </label>
              <input
                type="text"
                placeholder="Ex: Concluir conferência e registrar liquidação"
                value={formData.automation?.title || ''}
                onChange={(e) => handleAutomationChange('title', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
              <span className="text-[10px] text-slate-400">
                Exibido no tooltip do botão de check discreto no SUAP.
              </span>
            </div>

            {/* Tipo de Ação */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">
                Ação Executada ao Clicar
              </label>
              <select
                value={formData.automation?.action || 'advance_step'}
                onChange={(e) =>
                  handleAutomationChange('action', e.target.value as ProcessMappingAutomationAction)
                }
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
              >
                <option value="advance_step">⚡ Concluir etapa e avançar para a próxima</option>
                <option value="open_url">🔗 Abrir sistema ou link externo com dados do processo</option>
                <option value="copy_text">📋 Copiar texto / minuta parametrizada para a área de transferência</option>
                <option value="suap_document">📄 Gerar / clonar documento no SUAP</option>
                <option value="custom_webhook">🌐 Disparar requisição Webhook HTTP</option>
              </select>
            </div>

            {/* Campos condicionais por ação */}
            {(formData.automation?.action === 'open_url' || formData.automation?.action === 'custom_webhook') && (
              <div className="space-y-1 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <label className="block text-[11px] font-bold text-slate-700">
                  {formData.automation?.action === 'open_url' ? 'URL do Sistema / Destino' : 'URL do Webhook (POST)'}
                </label>
                <input
                  type="text"
                  placeholder="https://... (ex: https://suap.ifrn.edu.br/ ou SIAFI)"
                  value={formData.automation?.targetUrl || ''}
                  onChange={(e) => handleAutomationChange('targetUrl', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
                />
                <span className="text-[10px] text-slate-500">
                  Suporta placeholders dinâmicos (veja abaixo).
                </span>
              </div>
            )}

            {formData.automation?.action === 'copy_text' && (
              <div className="space-y-1 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <label className="block text-[11px] font-bold text-slate-700">
                  Texto / Minuta a ser Copiado
                </label>
                <textarea
                  rows={4}
                  placeholder="Digite o texto padronizado. As tags como {processNumber} serão preenchidas automaticamente..."
                  value={formData.automation?.templateText || ''}
                  onChange={(e) => handleAutomationChange('templateText', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
                />
              </div>
            )}

            {formData.automation?.action === 'suap_document' && (
              <div className="space-y-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tipo de Documento no SUAP
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: despacho, termo, certidao, relatorio"
                    value={formData.automation?.documentType || ''}
                    onChange={(e) => handleAutomationChange('documentType', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Minuta / Conteúdo Padrão
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Conteúdo a ser inserido no documento..."
                    value={formData.automation?.templateText || ''}
                    onChange={(e) => handleAutomationChange('templateText', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Opção de Avançar Etapa */}
            {formData.automation?.action !== 'advance_step' && (
              <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.automation?.autoAdvanceStep ?? true}
                  onChange={(e) => handleAutomationChange('autoAdvanceStep', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Avançar automaticamente para a próxima etapa após disparar esta ação
                </span>
              </label>
            )}

            {/* Mensagem de Feedback */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">
                Mensagem de Feedback (Toast)
              </label>
              <input
                type="text"
                placeholder="Ex: Etapa concluída com sucesso!"
                value={formData.automation?.feedbackMessage || ''}
                onChange={(e) => handleAutomationChange('feedbackMessage', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>

            {/* Variáveis Dinâmicas Disponíveis */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Variáveis Dinâmicas Disponíveis
              </label>
              <div className="flex flex-wrap gap-1">
                {[
                  '{processNumber}',
                  '{suapId}',
                  '{beneficiario}',
                  '{cpfCnpj}',
                  '{assunto}',
                  '{valor}',
                  '{etapa}',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    title={`Clique para inserir ${tag}`}
                    onClick={() => {
                      if (formData.automation?.action === 'copy_text' || formData.automation?.action === 'suap_document') {
                        handleAutomationChange('templateText', (formData.automation?.templateText || '') + ` ${tag}`);
                      } else if (formData.automation?.action === 'open_url' || formData.automation?.action === 'custom_webhook') {
                        handleAutomationChange('targetUrl', (formData.automation?.targetUrl || '') + tag);
                      }
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[10px] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Deseja realmente remover a etapa "${formData.title}"?`)) {
              onDeleteNode(formData.id);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Excluir Etapa</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          Salvar & Concluir
        </button>
      </div>
    </div>
  );
};
