import React, { useState } from 'react';

import type { ProcessMappingAutomation, ProcessMappingAutomationAction } from '@/types/processMapping';

export const AUTOMATION_VARIABLES = ['{processNumber}', '{suapId}', '{beneficiario}', '{cpfCnpj}', '{assunto}', '{valor}', '{etapa}', '{contrato}', '{empenho}'];

export const AUTOMATION_ACTIONS: {
  action: ProcessMappingAutomationAction;
  icon: string;
  label: string;
  hint: string;
  preset: Partial<ProcessMappingAutomation> & { title: string };
}[] = [
  {
    action: 'advance_step',
    icon: '⚡',
    label: 'Encaminhar para outro setor',
    hint: 'Conclui a etapa e avança o processo',
    preset: {
      title: 'Encaminhar para outro setor',
      autoAdvanceStep: true,
      feedbackMessage: 'Processo encaminhado com sucesso!',
    },
  },
  {
    action: 'copy_text',
    icon: '📋',
    label: 'Copiar texto',
    hint: 'Minuta para a área de transferência',
    preset: {
      title: 'Copiar minuta de despacho',
      templateText:
        'Certifico a conformidade da etapa {etapa} para o processo {processNumber}, referente ao credor {beneficiario}.',
      autoAdvanceStep: true,
      feedbackMessage: 'Minuta de despacho copiada!',
    },
  },
  {
    action: 'open_url',
    icon: '🔗',
    label: 'Abrir link',
    hint: 'Sistema externo (ex: SIAFI)',
    preset: {
      title: 'Abrir SIAFI Web',
      targetUrl: 'https://www.gov.br/tesouronacional/pt-br/siafi/',
      autoAdvanceStep: false,
      feedbackMessage: 'SIAFI aberto em nova aba.',
    },
  },
  {
    action: 'suap_document',
    icon: '📄',
    label: 'Documento no SUAP',
    hint: 'Gera ou clona um documento',
    preset: {
      title: 'Criar documento no SUAP',
      documentType: 'despacho',
      templateText: 'Processo: {processNumber}\nBeneficiário: {beneficiario}\nEtapa: {etapa}',
      autoAdvanceStep: true,
      feedbackMessage: 'Automação de documento SUAP acionada!',
    },
  },
  {
    action: 'suap_upload_document',
    icon: '📤',
    label: 'Upload no SUAP',
    hint: 'Preenche o formulário de upload',
    preset: {
      title: 'Upload de liquidação no SUAP',
      tipoConferencia: 'Cópia Simples',
      tipoDocumento: 'Liquidação',
      assunto: 'Liquidação',
      autoAdvanceStep: true,
      feedbackMessage: 'Página de upload aberta e campos preenchidos!',
    },
  },
];

const AutomationVariableInserter: React.FC<{ onPick: (tag: string) => void }> = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-[10px] font-semibold text-brand-700 hover:underline"
        aria-expanded={open}
      >
        + Inserir variável
      </button>
      {open && (
        <span className="absolute right-0 top-full z-10 mt-1 flex w-44 flex-col rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {AUTOMATION_VARIABLES.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                onPick(tag);
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-left font-mono text-[11px] text-slate-700 hover:bg-slate-100"
            >
              {tag}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

interface ProcessMappingAutomationEditorProps {
  automation: ProcessMappingAutomation;
  /** Identificador estável usado só para ligar labels/listas de sugestão no DOM. */
  listId: string;
  onChange: (next: ProcessMappingAutomation) => void;
}

export const ProcessMappingAutomationEditor: React.FC<ProcessMappingAutomationEditorProps> = ({
  automation,
  listId,
  onChange,
}) => {
  const onField = <K extends keyof ProcessMappingAutomation>(field: K, value: ProcessMappingAutomation[K]) => {
    onChange({ ...automation, [field]: value });
  };

  const selectAction = (action: ProcessMappingAutomationAction) => {
    const previousDefaults = AUTOMATION_ACTIONS.find((o) => o.action === automation.action)?.preset;
    const next = AUTOMATION_ACTIONS.find((o) => o.action === action)!.preset;
    // Só troca rótulo e mensagem se o usuário não os personalizou
    const keepTitle = automation.title && automation.title !== previousDefaults?.title;
    const keepFeedback = automation.feedbackMessage && automation.feedbackMessage !== previousDefaults?.feedbackMessage;
    onChange({
      ...automation,
      ...next,
      enabled: automation.enabled,
      action,
      title: keepTitle ? automation.title : next.title,
      feedbackMessage: keepFeedback ? automation.feedbackMessage : next.feedbackMessage,
      templateText: automation.templateText || next.templateText,
      targetUrl: automation.targetUrl || next.targetUrl,
    });
  };

  return (
    <div className="space-y-4">
        {/* Ação */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold text-slate-600">O que acontece ao clicar</span>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Ação da automação">
            {AUTOMATION_ACTIONS.map((option) => {
              const selected = (automation.action || 'advance_step') === option.action;
              return (
                <button
                  key={option.action}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectAction(option.action)}
                  className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                    selected
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[11px] font-bold leading-tight">
                    {option.icon} {option.label}
                  </span>
                  <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">{option.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Título */}
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-600">Rótulo do botão</label>
          <input
            type="text"
            placeholder="Ex: Concluir conferência e registrar liquidação"
            value={automation.title || ''}
            onChange={(e) => onField('title', e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
          />
        </div>

        {/* Campos da ação escolhida */}
        {automation.action === 'suap_upload_document' && (
          <div className="space-y-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Tipo de conferência</label>
                <select
                  value={automation.tipoConferencia || 'Cópia Simples'}
                  onChange={(e) => onField('tipoConferencia', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="Cópia Simples">Cópia Simples</option>
                  <option value="Cópia Autenticada Administrativamente">Cópia Autenticada Administrativamente</option>
                  <option value="Cópia Autenticada por Cartório">Cópia Autenticada por Cartório</option>
                  <option value="Documento Original">Documento Original</option>
                  <option value="Documento Original e Cópia">Documento Original e Cópia</option>
                  <option value="Documento Original e Cópia Autenticada Administrativamente">Documento Original e Cópia Autenticada Administrativamente</option>
                  <option value="Mídia">Mídia</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Tipo do documento</label>
                <input
                  type="text"
                  list={`automation-document-types-${listId}`}
                  placeholder="Ex: Liquidação"
                  value={automation.tipoDocumento || 'Liquidação'}
                  onChange={(e) => onField('tipoDocumento', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <datalist id={`automation-document-types-${listId}`}>
                  {['Liquidação', 'Nota Fiscal', 'Recibo', 'Relatório', 'Termo', 'Despacho'].map((sug) => (
                    <option key={sug} value={sug} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">Assunto do documento</label>
                <AutomationVariableInserter
                  onPick={(tag) => onField('assunto', (automation.assunto || '') + tag)}
                />
              </div>
              <input
                type="text"
                placeholder="Ex: Liquidação - {beneficiario}"
                value={automation.assunto || 'Liquidação'}
                onChange={(e) => onField('assunto', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        )}

        {(automation.action === 'open_url' || automation.action === 'custom_webhook') && (
          <div className="space-y-1 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700">
                {automation.action === 'open_url' ? 'URL de destino' : 'URL do webhook (POST)'}
              </label>
              <AutomationVariableInserter
                onPick={(tag) => onField('targetUrl', (automation.targetUrl || '') + tag)}
              />
            </div>
            <input
              type="text"
              placeholder="https://..."
              value={automation.targetUrl || ''}
              onChange={(e) => onField('targetUrl', e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
            />
          </div>
        )}

        {automation.action === 'copy_text' && (
          <div className="space-y-1 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700">Texto a copiar</label>
              <AutomationVariableInserter
                onPick={(tag) =>
                  onField('templateText', (automation.templateText || '') + ` ${tag}`)
                }
              />
            </div>
            <textarea
              rows={4}
              placeholder="Digite o texto padronizado..."
              value={automation.templateText || ''}
              onChange={(e) => onField('templateText', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
            />
          </div>
        )}

        {automation.action === 'suap_document' && (
          <div className="space-y-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Tipo de documento no SUAP</label>
              <input
                type="text"
                placeholder="Ex: despacho, termo, certidao, relatorio"
                value={automation.documentType || ''}
                onChange={(e) => onField('documentType', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">Conteúdo padrão</label>
                <AutomationVariableInserter
                  onPick={(tag) =>
                    onField('templateText', (automation.templateText || '') + ` ${tag}`)
                  }
                />
              </div>
              <textarea
                rows={3}
                placeholder="Conteúdo a ser inserido no documento..."
                value={automation.templateText || ''}
                onChange={(e) => onField('templateText', e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-[11px]"
              />
            </div>
          </div>
        )}

        {/* Opções avançadas */}
        <details className="group rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold text-slate-600 hover:text-slate-800">
            Opções avançadas
          </summary>
          <div className="space-y-3 px-3 pb-3 pt-1">
            {automation.action !== 'advance_step' && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={automation.autoAdvanceStep ?? true}
                  onChange={(e) => onField('autoAdvanceStep', e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-700 font-medium">Avançar para a próxima etapa após a ação</span>
              </label>
            )}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">Mensagem de confirmação</label>
              <input
                type="text"
                placeholder="Ex: Etapa concluída com sucesso!"
                value={automation.feedbackMessage || ''}
                onChange={(e) => onField('feedbackMessage', e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        </details>
    </div>
  );
};
