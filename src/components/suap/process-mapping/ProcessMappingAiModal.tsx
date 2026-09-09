import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Sparkles, Wand2, X } from 'lucide-react';
import type { ProcessMappingRecord } from '@/types/processMapping';

interface ProcessMappingAiModalProps {
  isOpen: boolean;
  activeProcess: ProcessMappingRecord;
  onClose: () => void;
  onApplyGeneratedProcess: (newProcess: ProcessMappingRecord) => void;
}

export const ProcessMappingAiModal: React.FC<ProcessMappingAiModalProps> = ({
  isOpen,
  activeProcess,
  onClose,
  onApplyGeneratedProcess,
}) => {
  const [promptText, setPromptText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedProcessPreview, setGeneratedProcessPreview] = useState<ProcessMappingRecord | null>(null);

  if (!isOpen) return null;

  const handleGenerateProcess = (promptOverride?: string) => {
    const textToUse = promptOverride || promptText;
    if (!textToUse.trim()) return;

    setIsLoading(true);

    setTimeout(() => {
      const generatedId = `proc-ai-${Date.now()}`;
      const titleLower = textToUse.toLowerCase();

      let title = textToUse.slice(0, 65);
      if (!title.toLowerCase().startsWith('processo')) {
        title = `Processo de ${title}`;
      }

      const generated: ProcessMappingRecord = {
        id: generatedId,
        title,
        code: `MAP-IA-${Math.floor(10 + Math.random() * 90)}`,
        description: `Mapeamento modelado com base nas diretrizes da Lei nº 14.133/2021, integrando procedimentos ao SUAP e sistemas federais. Demanda: ${textToUse}`,
        category: 'Licitações e Contratos',
        version: '1.0',
        publicationStatus: 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lanes: [
          { id: 'lane-1', name: 'Unidade Demandante', color: '#0284c7', order: 0, height: 180 },
          { id: 'lane-2', name: 'Equipe de Planejamento (EPC)', color: '#0d9488', order: 1, height: 180 },
          { id: 'lane-3', name: 'Setor de Contratações / DIAD', color: '#7c3aed', order: 2, height: 180 },
          { id: 'lane-4', name: 'Assessoria Jurídica / Ordenador', color: '#059669', order: 3, height: 180 },
        ],
        nodes: [
          {
            id: `${generatedId}-start`,
            code: 'INÍCIO',
            title: 'Necessidade Formalizada',
            description: 'Identificação e registro da necessidade pública no sistema institucional.',
            type: 'start',
            laneId: 'lane-1',
            position: { x: 50, y: 120 },
            width: 52,
            height: 52,
            responsible: 'Unidade Demandante',
            status: 'completed',
          },
          {
            id: `${generatedId}-step-1`,
            code: '1',
            title: 'Elaborar Documento de Formalização da Demanda (DFD/DOD)',
            description: 'Definir objeto, justificativa de interesse público e alinhamento com o PCA.',
            type: 'task',
            laneId: 'lane-1',
            position: { x: 160, y: 90 },
            width: 190,
            height: 105,
            responsible: 'Unidade Demandante',
            systemName: 'SUAP - Módulo Compras',
            systemUrl: 'https://suap.ifrn.edu.br/',
            templateName: 'Modelo de DFD / DOD AGU',
            templateUrl: 'https://www.gov.br/compras/pt-br/',
            legalBasis: 'Art. 12, VII da Lei 14.133/2021',
            slaDays: 4,
            status: 'in_progress',
            checklist: [
              { id: 'c1', text: 'Conferir código do item no PCA', done: true, required: true },
              { id: 'c2', text: 'Estimar quantitativo preliminar e justificativa', done: false, required: true },
            ],
          },
          {
            id: `${generatedId}-step-2`,
            code: '2',
            title: 'Conduzir Estudo Técnico e Termo de Referência',
            description: 'Elaborar levantamento de mercado, estimativa de custos e critérios de aceitação.',
            type: 'task',
            laneId: 'lane-2',
            position: { x: 420, y: 90 },
            width: 190,
            height: 105,
            responsible: 'Equipe de Planejamento da Contratação',
            systemName: 'Compras.gov.br - ETP/TR Digital',
            systemUrl: 'https://comprasnet.gov.br/',
            templateName: 'Minutas Padronizadas AGU',
            templateUrl: 'https://www.gov.br/agu/pt-br/composicao/cgu/cgu/modelos',
            legalBasis: 'Art. 18 e Art. 40 da Lei 14.133/2021',
            slaDays: 10,
            status: 'pending',
            checklist: [
              { id: 'c3', text: 'Pesquisa de preços conforme IN SEGES nº 65/2021', done: false, required: true },
              { id: 'c4', text: 'Matriz de Alocação de Riscos', done: false, required: true },
            ],
          },
          {
            id: `${generatedId}-step-3`,
            code: '3',
            title: 'Análise de Conformidade e Aprovação Jurídica',
            description: 'Controle de legalidade formal das minutas e parecer conclusivo.',
            type: 'task',
            laneId: 'lane-4',
            position: { x: 680, y: 90 },
            width: 190,
            height: 105,
            responsible: 'Procuradoria Federal / Ordenador',
            systemName: 'Sapiens / SUAP',
            systemUrl: 'https://suap.ifrn.edu.br/',
            legalBasis: 'Art. 53 da Lei 14.133/2021',
            slaDays: 7,
            status: 'pending',
            checklist: [
              { id: 'c5', text: 'Instrução do checklist AGU', done: false, required: true },
              { id: 'c6', text: 'Aprovação da autoridade competente', done: false, required: true },
            ],
          },
          {
            id: `${generatedId}-end`,
            code: 'FIM',
            title: 'Publicação e Execução Autorizada',
            description: 'Divulgação oficial no PNCP e início da fase executiva.',
            type: 'end',
            laneId: 'lane-3',
            position: { x: 930, y: 120 },
            width: 52,
            height: 52,
            responsible: 'Setor de Contratações',
            status: 'pending',
          },
        ],
        edges: [
          { id: 'e1', source: `${generatedId}-start`, target: `${generatedId}-step-1`, style: 'solid' },
          { id: 'e2', source: `${generatedId}-step-1`, target: `${generatedId}-step-2`, style: 'solid' },
          { id: 'e3', source: `${generatedId}-step-2`, target: `${generatedId}-step-3`, style: 'solid' },
          { id: 'e4', source: `${generatedId}-step-3`, target: `${generatedId}-end`, style: 'solid' },
        ],
      };

      setGeneratedProcessPreview(generated);
      setIsLoading(false);
    }, 600);
  };

  const handleApply = () => {
    if (generatedProcessPreview) {
      onApplyGeneratedProcess(generatedProcessPreview);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 font-ui">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Assistente IA Especialista em Processos</h3>
              <p className="text-xs text-slate-500">Mapeamento automatizado conforme a Lei 14.133/2021 e SUAP</p>
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              Qual processo de compras ou gestão pública você deseja mapear?
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Mapear fluxo de contratação de serviços de manutenção predial continuada com dedicação exclusiva de mão de obra..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 leading-relaxed"
            />
          </div>

          {/* Quick Prompts */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Sugestões Rápidas:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Dispensa Eletrônica por Valor (Art. 75, II)',
                'Pregão Eletrônico para Serviços de Limpeza e Vigilância',
                'Inexigibilidade de Licitação para Capacitação de Servidores',
                'Aplicação de Sanções e Penalidades Contratuais',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setPromptText(suggestion);
                    handleGenerateProcess(suggestion);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 text-slate-600 text-[11px] transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={() => handleGenerateProcess()}
            disabled={isLoading || !promptText.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Estruturando raias e etapas com IA...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Gerar Estrutura do Processo</span>
              </>
            )}
          </button>

          {/* Preview of Generated Process */}
          {generatedProcessPreview && (
            <div className="mt-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Fluxo Mapeado com Sucesso</span>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {generatedProcessPreview.code}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm">{generatedProcessPreview.title}</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">{generatedProcessPreview.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/80">
                <div>
                  <span className="font-semibold text-slate-500">Raias (Unidades):</span>{' '}
                  <span className="text-slate-800">{generatedProcessPreview.lanes.length}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Etapas Mapeadas:</span>{' '}
                  <span className="text-slate-800 font-mono font-bold">
                    {generatedProcessPreview.nodes.length} nós
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Aplicar e Abrir no Mapeador</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
