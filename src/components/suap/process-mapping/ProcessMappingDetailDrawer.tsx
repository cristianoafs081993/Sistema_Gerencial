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
  Pencil,
  Plus,
  Scale,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';

import { getNodeAutomations } from '@/lib/processMappingAutomations';
import { getNodeSystems } from '@/lib/processMappingSystems';
import {
  AUTOMATION_ACTIONS,
  ProcessMappingAutomationEditor,
} from './ProcessMappingAutomationEditor';
import type {
  ProcessMappingAutomation,
  ProcessMappingAutomationAction,
  ProcessMappingChecklistItem,
  ProcessMappingLane,
  ProcessMappingLink,
  ProcessMappingNode,
  ProcessMappingSystem,
} from '@/types/processMapping';

const AUTOMATION_ACTION_LABELS: Record<ProcessMappingAutomationAction, string> = {
  advance_step: 'Encaminhar para outro setor',
  suap_upload_document: 'Upload de documento externo no SUAP',
  open_url: 'Abrir sistema ou link externo',
  copy_text: 'Copiar texto / minuta para a área de transferência',
  suap_document: 'Gerar / clonar documento no SUAP',
  custom_webhook: 'Disparar requisição Webhook HTTP',
};

const ReadField: React.FC<{ label: string; children?: React.ReactNode; mono?: boolean }> = ({
  label,
  children,
  mono,
}) => (
  <div className="min-w-0">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
    {children ? (
      <div className={`text-xs text-slate-800 break-words ${mono ? 'font-mono text-[11px]' : 'font-medium'}`}>
        {children}
      </div>
    ) : (
      <span className="text-[11px] text-slate-400 italic">Não informado</span>
    )}
  </div>
);

const ExternalAnchor: React.FC<{ url: string }> = ({ url }) => (
  <a
    href={url}
    target="_blank"
    rel="noreferrer"
    className="text-[11px] text-brand-600 hover:underline font-mono break-all inline-flex items-center gap-1"
  >
    <ExternalLink className="w-3 h-3 shrink-0" />
    {url}
  </a>
);

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
  const [activeTab, setActiveTab] = useState<'links' | 'procedure' | 'automations'>('procedure');

  // Input states for adding new items
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newInputDoc, setNewInputDoc] = useState('');
  const [newOutputDoc, setNewOutputDoc] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkCategory, setNewLinkCategory] = useState<ProcessMappingLink['category']>('system');

  const [isEditing, setIsEditing] = useState(false);
  const [expandedAutomation, setExpandedAutomation] = useState<number | null>(null);

  useEffect(() => {
    if (node) {
      setFormData({ ...node });
    }
  }, [node]);

  // Cada etapa abre em modo de leitura
  const nodeId = node?.id;
  useEffect(() => {
    setIsEditing(false);
  }, [nodeId]);

  if (!isOpen || !formData) return null;

  const handleChange = <K extends keyof ProcessMappingNode>(field: K, value: ProcessMappingNode[K]) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNode(updated);
  };

  // Sistemas da etapa (vários). systemName/systemUrl espelham o primeiro, por compatibilidade.
  const systems = getNodeSystems(formData);

  const commitSystems = (next: ProcessMappingSystem[]) => {
    const updated: ProcessMappingNode = {
      ...formData,
      systems: next,
      systemName: next[0]?.name || undefined,
      systemUrl: next[0]?.url || undefined,
    };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const handleUpdateSystem = (index: number, patch: Partial<ProcessMappingSystem>) => {
    commitSystems(systems.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleAddSystem = (name = '', url = '') => {
    // Um sistema vazio no fim da lista é reaproveitado antes de criar outro
    const last = systems[systems.length - 1];
    if (last && !last.name && !last.url && (name || url)) {
      commitSystems(systems.map((item, i) => (i === systems.length - 1 ? { ...item, name, url } : item)));
      return;
    }
    commitSystems([...systems, { id: `sys-${Date.now()}`, name, url }]);
  };

  const handleDeleteSystem = (index: number) => {
    commitSystems(systems.filter((_, i) => i !== index));
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

  // Automações (várias por etapa). Ao salvar, o campo legado `automation` é migrado para `automations`.
  const automations = getNodeAutomations(formData);

  const commitAutomations = (next: ProcessMappingAutomation[]) => {
    const updated: ProcessMappingNode = { ...formData, automations: next, automation: undefined };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const handleUpdateAutomation = (index: number, next: ProcessMappingAutomation) => {
    commitAutomations(automations.map((item, i) => (i === index ? next : item)));
  };

  const handleAddAutomation = () => {
    const first = AUTOMATION_ACTIONS[0];
    commitAutomations([
      ...automations,
      { ...first.preset, id: `auto-${Date.now()}`, enabled: true, action: first.action },
    ]);
    setExpandedAutomation(automations.length);
  };

  const handleDeleteAutomation = (index: number) => {
    if (!window.confirm('Excluir esta automação?')) return;
    commitAutomations(automations.filter((_, i) => i !== index));
    setExpandedAutomation(null);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col font-ui text-slate-900 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-brand-200">
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
      <div className="flex border-b border-slate-200 bg-white px-4 text-xs font-semibold select-none overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab('procedure')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'procedure'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Procedimento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automations')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'automations'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Automações{automations.filter((a) => a.enabled).length > 0 ? ` (${automations.filter((a) => a.enabled).length})` : ''}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('links')}
          className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'links'
              ? 'border-brand-600 text-brand-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Links & Sistemas</span>
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
        {/* TAB 1: Links & Sistemas */}
        {activeTab === 'links' && !isEditing && (
          <div className="space-y-4" data-testid="drawer-view-links">
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <span className="block text-xs font-bold text-slate-800">
                {systems.length > 1 ? 'Sistemas informatizados da etapa' : 'Sistema informatizado da etapa'}
              </span>
              {systems.length > 0 ? (
                systems.map((system, index) => (
                  <div key={system.id || index} className="min-w-0 space-y-0.5" data-testid="drawer-view-system-item">
                    <p className="text-xs font-semibold text-slate-800">{system.name || 'Sistema'}</p>
                    {system.url && <ExternalAnchor url={system.url} />}
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">Nenhum sistema informado.</p>
              )}
            </div>

            <div className="space-y-1.5 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <span className="block text-xs font-bold text-slate-800">Modelo padronizado / minuta</span>
              {formData.templateName || formData.templateUrl ? (
                <>
                  <p className="text-xs font-semibold text-slate-800">{formData.templateName || 'Modelo'}</p>
                  {formData.templateUrl && <ExternalAnchor url={formData.templateUrl} />}
                </>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Nenhum modelo informado.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-800">Links adicionais & normativos</span>
              {formData.customLinks && formData.customLinks.length > 0 ? (
                formData.customLinks.map((link) => (
                  <div key={link.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{link.label}</p>
                    <ExternalAnchor url={link.url} />
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">Nenhum link adicional cadastrado.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'links' && isEditing && (
          <div className="space-y-5">
            {/* Sistemas */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800">
                Sistemas Informatizados da Etapa
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1">
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
                    onClick={() => handleAddSystem(preset.name, preset.url)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-brand-50 text-brand-700 border border-slate-200 text-[10px] font-semibold transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>

              {systems.map((system, index) => (
                <div
                  key={system.id || index}
                  className="flex items-start gap-1.5"
                  data-testid="drawer-edit-system-item"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      type="text"
                      aria-label={`Nome do sistema ${index + 1}`}
                      placeholder="Nome do sistema (ex: SUAP - Módulo PCA)"
                      value={system.name}
                      onChange={(e) => handleUpdateSystem(index, { name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <input
                      type="text"
                      aria-label={`URL do sistema ${index + 1}`}
                      placeholder="URL de acesso (ex: https://suap.ifrn.edu.br/...)"
                      value={system.url}
                      onChange={(e) => handleUpdateSystem(index, { url: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-[11px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSystem(index)}
                    aria-label={`Excluir sistema ${index + 1}`}
                    title="Excluir sistema"
                    className="mt-1 shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                data-testid="add-system-btn"
                onClick={() => handleAddSystem()}
                className="w-full py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs border border-dashed border-slate-300 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar sistema
              </button>
            </div>

            {/* Modelo / Minuta */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-800">
                Modelo Padronizado / Minuta AGU
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
                    className="px-2 py-0.5 rounded bg-white hover:bg-brand-50 text-brand-700 border border-slate-200 text-[10px] font-semibold transition-colors"
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
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="text"
                placeholder="URL de download ou modelo"
                value={formData.templateUrl || ''}
                onChange={(e) => handleChange('templateUrl', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-[11px]"
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
                          className="text-[10px] text-brand-600 truncate block hover:underline font-mono"
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
        {activeTab === 'procedure' && !isEditing && (
          <div className="space-y-4" data-testid="drawer-view-procedure">
            <ReadField label="Detalhamento operacional">
              {formData.description ? (
                <p className="whitespace-pre-wrap leading-relaxed font-normal">{formData.description}</p>
              ) : null}
            </ReadField>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <ReadField label="Entradas obrigatórias">
                {formData.inputDocuments && formData.inputDocuments.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {formData.inputDocuments.map((doc) => (
                      <span key={doc} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                        {doc}
                      </span>
                    ))}
                  </div>
                ) : null}
              </ReadField>
              <ReadField label="Saídas produzidas">
                {formData.outputDocuments && formData.outputDocuments.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {formData.outputDocuments.map((doc) => (
                      <span
                        key={doc}
                        className="px-2 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200 text-[10px] font-medium"
                      >
                        {doc}
                      </span>
                    ))}
                  </div>
                ) : null}
              </ReadField>
            </div>
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Checklist ({formData.checklist?.length || 0})
              </span>
  <div className="space-y-2" data-testid="drawer-view-checklist">
            {formData.checklist && formData.checklist.length > 0 ? (
              formData.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklist(item.id)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className={`text-xs ${item.done ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                    {item.text}
                  </span>
                </label>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 border border-dashed rounded-xl">
                Nenhum item na lista de checagem.
              </div>
            )}
          </div>
              <form onSubmit={handleAddChecklist} className="flex gap-1.5" data-testid="drawer-view-checklist-add">
                <input
                  type="text"
                  aria-label="Novo item do checklist"
                  placeholder="Adicionar item ao checklist..."
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={!newChecklistText.trim()}
                  aria-label="Adicionar item ao checklist"
                  title="Adicionar item"
                  className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'procedure' && isEditing && (
          <div className="space-y-4">
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

            {/* Responsible */}
            <div className="grid grid-cols-1 gap-3">
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
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200 text-[10px] mr-1 mb-1 font-medium"
                    >
                      {doc}
                      <button
                        type="button"
                        onClick={() => handleRemoveOutputDoc(i)}
                        className="text-brand-500 hover:text-rose-600"
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
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-600">
                Checklist operacional ({formData.checklist?.length || 0})
              </label>
<div className="space-y-4">

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
                        className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
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
                className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item ao Checklist
              </button>
            </form>
          </div>
            </div>
          </div>
        )}

        {/* TAB 4: Automações */}
        {activeTab === 'automations' && !isEditing && (
          <div className="space-y-3" data-testid="drawer-view-automations">
            {automations.length > 0 ? (
              automations.map((automation, index) => (
                <div
                  key={automation.id || index}
                  className="space-y-3 rounded-xl border border-slate-200 p-3"
                  data-testid="drawer-view-automation-item"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-slate-800 min-w-0">
                      {automation.title || 'Automação sem rótulo'}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        automation.enabled ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {automation.enabled ? 'Ativa' : 'Desativada'}
                    </span>
                  </div>
                  <ReadField label="Ação executada ao clicar">{AUTOMATION_ACTION_LABELS[automation.action]}</ReadField>
                  {automation.action === 'suap_upload_document' && (
                    <div className="grid grid-cols-3 gap-3">
                      <ReadField label="Tipo de conferência">{automation.tipoConferencia}</ReadField>
                      <ReadField label="Tipo do documento">{automation.tipoDocumento}</ReadField>
                      <ReadField label="Assunto">{automation.assunto}</ReadField>
                    </div>
                  )}
                  {(automation.action === 'open_url' || automation.action === 'custom_webhook') && (
                    <ReadField label="URL de destino" mono>
                      {automation.targetUrl}
                    </ReadField>
                  )}
                  {automation.action === 'suap_document' && (
                    <ReadField label="Tipo de documento no SUAP">{automation.documentType}</ReadField>
                  )}
                  {(automation.action === 'copy_text' || automation.action === 'suap_document') && (
                    <ReadField label="Texto / minuta" mono>
                      {automation.templateText ? <p className="whitespace-pre-wrap">{automation.templateText}</p> : null}
                    </ReadField>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <ReadField label="Avança a etapa">
                      {automation.action === 'advance_step' || (automation.autoAdvanceStep ?? true) ? 'Sim' : 'Não'}
                    </ReadField>
                    <ReadField label="Mensagem de feedback">{automation.feedbackMessage}</ReadField>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 border border-dashed rounded-xl">
                Nenhuma automação configurada nesta etapa.
              </div>
            )}
          </div>
        )}

        {activeTab === 'automations' && isEditing && (
          <div className="space-y-3" data-testid="drawer-edit-automations">
            {automations.map((automation, index) => {
              const expanded = expandedAutomation === index;
              const option = AUTOMATION_ACTIONS.find((o) => o.action === automation.action);
              return (
                <div
                  key={automation.id || index}
                  className="rounded-xl border border-slate-200 bg-white"
                  data-testid="drawer-automation-card"
                >
                  <div className="flex items-center gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedAutomation(expanded ? null : index)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="text-[10px] text-slate-400">{expanded ? '▾' : '▸'}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-800">
                          {option?.icon} {automation.title || 'Automação sem rótulo'}
                        </span>
                        <span className="block truncate text-[10px] text-slate-500">{option?.label}</span>
                      </span>
                    </button>
                    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={automation.enabled}
                        onChange={(e) => handleUpdateAutomation(index, { ...automation, enabled: e.target.checked })}
                        aria-label={`Ativar automação ${index + 1}`}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteAutomation(index)}
                      aria-label={`Excluir automação ${index + 1}`}
                      title="Excluir automação"
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {expanded && (
                    <div className="border-t border-slate-100 p-3">
                      <ProcessMappingAutomationEditor
                        automation={automation}
                        listId={`${formData.id}-${index}`}
                        onChange={(next) => handleUpdateAutomation(index, next)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {automations.length === 0 && (
              <p className="text-center text-[11px] text-slate-400 italic">Nenhuma automação configurada nesta etapa.</p>
            )}

            <button
              type="button"
              data-testid="add-automation-btn"
              onClick={handleAddAutomation}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar automação
            </button>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
        {isEditing ? (
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
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
          )}
          <button
            type="button"
            data-testid="drawer-toggle-edit"
            onClick={() => setIsEditing((current) => !current)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            {isEditing ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Salvar & Concluir
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
