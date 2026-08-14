import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CircleAlert, Loader2, Paperclip, X } from 'lucide-react';

import {
  COMPRASNET_ETP_CLOSE_MESSAGE,
  COMPRASNET_ETP_CONTEXT_MESSAGE,
  COMPRASNET_ETP_READY_MESSAGE,
  COMPRASNET_ETP_REQUEST_MESSAGE,
  COMPRASNET_ETP_RESULT_MESSAGE,
  isComprasnetEtpMessage,
  postComprasnetMessage,
  type ComprasnetEtpFieldSnapshot,
  type ComprasnetEtpPageContext,
  type ComprasnetEtpResult,
} from '@/lib/comprasnetEtpExtension';
import {
  comprasnetEtpQuestions,
  normalizeComprasnetEtpText,
  type ComprasnetEtpAnswer,
} from '@/lib/comprasnetEtpQuestionnaire';
import {
  comprasnetEtpEmphasisOptions,
  comprasnetEtpExistingTextOptions,
  comprasnetEtpFormatOptions,
  comprasnetEtpLengthOptions,
  comprasnetEtpSectionChecklists,
  comprasnetEtpSourceOptions,
  defaultComprasnetEtpGenerationPreferences,
  normalizeComprasnetEtpGenerationPreferences,
  type ComprasnetEtpGenerationPreferences,
} from '@/lib/comprasnetEtpPreferences';
import {
  analyzePreliminaryStudySupplementalAttachmentFile,
  PRELIMINARY_STUDY_SUPPLEMENTAL_ACCEPT,
  PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES,
  type PreliminaryStudySupplementalAttachmentAnalysis,
} from '@/lib/preliminaryStudySupplementalAttachments';
import type { PreliminaryStudyPdfAnalysis } from '@/lib/preliminaryStudyProcessPdf';
import { preliminaryStudiesService } from '@/services/preliminaryStudies';
import { comprasnetEtpService, type ComprasnetEtpDraftResult } from '@/services/comprasnetEtp';
import { suapProcessosService } from '@/services/suapProcessos';
import { supabase } from '@/lib/supabase';
import type { SuapProcesso } from '@/types';
import './comprasnet-etp-extension.css';

type Mode = 'current' | 'whole';
type Stage = 'setup' | 'loading' | 'preview' | 'applying' | 'done';

type FieldSelection = {
  selected: boolean;
  replaceExisting: boolean;
};

const preferenceLabels: Record<string, string> = {
  curto: 'Curto', padrao: 'Padrão', detalhado: 'Detalhado',
  corrido: 'Texto corrido', corrido_topicos: 'Texto com tópicos', topicos: 'Tópicos',
  tecnica: 'Técnica', economica: 'Econômica', operacional: 'Operacional', sustentabilidade: 'Sustentabilidade', competitividade: 'Competitividade',
  processo: 'Processo', anexos: 'Anexos', conteudo_atual: 'Conteúdo atual',
  complementar: 'Complementar', melhorar: 'Melhorar', reescrever: 'Reescrever mediante confirmação',
  impacto_sem_contratar: 'Impacto de não contratar', publico_afetado: 'Público afetado', evidencias_problema: 'Evidências do problema',
  criterios_tecnicos: 'Critérios técnicos', criterios_operacionais: 'Critérios operacionais', requisitos_legais: 'Requisitos legais', criterios_aceitacao: 'Critérios de aceitação',
  alternativas: 'Alternativas consideradas', comparacao_tecnico_economica: 'Comparação técnico-econômica', justificativa_escolha: 'Justificativa da escolha',
  escopo_integrado: 'Escopo integrado', execucao_vigencia: 'Execução e vigência', resultados_esperados: 'Resultados esperados',
  memoria_calculo: 'Memória de cálculo', metodologia_estimativa: 'Metodologia de estimativa', restricao_sem_numeros_inventados: 'Não inventar números',
  metodologia_pesquisa: 'Metodologia da pesquisa', fontes_consultadas: 'Fontes consultadas', restricao_sem_valores_inventados: 'Não inventar valores',
  viabilidade_tecnica: 'Viabilidade técnica', viabilidade_economica: 'Viabilidade econômica',
  contratacoes_relacionadas: 'Contratações relacionadas', dependencias: 'Dependências', inexistencia_confirmada: 'Inexistência confirmada',
  pca: 'PCA', planejamento_institucional: 'Planejamento institucional', alinhamento_estrategico: 'Alinhamento estratégico',
  beneficios_publicos: 'Benefícios públicos', eficiencia: 'Eficiência', indicadores_resultado: 'Indicadores de resultado',
  equipe_fiscalizacao: 'Equipe e fiscalização', capacitacao: 'Capacitação', adequacoes_previas: 'Adequações prévias',
  ciclo_vida: 'Ciclo de vida', residuos_consumo: 'Resíduos e consumo', criterios_sustentabilidade: 'Critérios de sustentabilidade',
  viabilidade: 'Viabilidade', condicionantes: 'Condicionantes', pendencias_remanescentes: 'Pendências remanescentes',
};

function postRequest(payload: Parameters<typeof postComprasnetMessage>[0]) {
  postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_REQUEST_MESSAGE, version: 1, payload });
}

function isFieldEmpty(field?: ComprasnetEtpFieldSnapshot) {
  return !normalizeComprasnetEtpText(field?.existingText);
}

function normalizeProcessNumber(value: string) {
  return value.replace(/\D/g, '');
}

function htmlToText(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');
  return normalizeComprasnetEtpText(doc.body.textContent || '');
}

function buildAnswers(fields: ComprasnetEtpFieldSnapshot[]): ComprasnetEtpAnswer[] {
  return fields.map((field) => ({
    questionId: field.id,
    value: htmlToText(field.existingHtml) || field.existingText,
    origin: 'system',
  }));
}

export default function ComprasnetEtpExtension() {
  const [context, setContext] = useState<ComprasnetEtpPageContext | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [mode, setMode] = useState<Mode>('current');
  const [stage, setStage] = useState<Stage>('setup');
  const [status, setStatus] = useState('Aguardando a tela do Comprasnet.');
  const [error, setError] = useState<string | null>(null);
  const [processNumber, setProcessNumber] = useState('');
  const [manualObject, setManualObject] = useState('');
  const [processo, setProcesso] = useState<SuapProcesso | null>(null);
  const [analysis, setAnalysis] = useState<PreliminaryStudyPdfAnalysis | null>(null);
  const [attachments, setAttachments] = useState<PreliminaryStudySupplementalAttachmentAnalysis[]>([]);
  const [draft, setDraft] = useState<ComprasnetEtpDraftResult | null>(null);
  const [selections, setSelections] = useState<Record<string, FieldSelection>>({});
  const [preferences, setPreferences] = useState<ComprasnetEtpGenerationPreferences>(defaultComprasnetEtpGenerationPreferences);
  const [showReviewNotices, setShowReviewNotices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoLookupDoneRef = useRef(false);
  const preferencesSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const handleMessage = (event: MessageEvent) => {
      if (!isComprasnetEtpMessage(event, COMPRASNET_ETP_CONTEXT_MESSAGE) &&
        !isComprasnetEtpMessage(event, COMPRASNET_ETP_RESULT_MESSAGE)) return;

      if (event.data.type === COMPRASNET_ETP_CONTEXT_MESSAGE) {
        const nextContext = event.data.payload as ComprasnetEtpPageContext;
        if (!nextContext || !Array.isArray(nextContext.fields)) return;
        setContext(nextContext);
        setPreferences(normalizeComprasnetEtpGenerationPreferences(nextContext.generationPreferences));
        setProcessNumber(nextContext.processNumber || '');
        setStatus('Contexto da página carregado.');
        return;
      }

      const result = event.data.payload as ComprasnetEtpResult;
      if (!result) return;
      if (!result.ok) {
        setStage('setup');
        setError(result.message);
        setStatus('A operação foi interrompida com segurança.');
        return;
      }
      if (result.action === 'snapshot') {
        setContext((current) => current ? { ...current, ...result.context } : current);
        setError(null);
        setStage('setup');
        setStatus('Todas as seções textuais foram lidas. Revise as opções e gere a prévia.');
        return;
      }
      if (result.action === 'apply') {
        setStage('done');
        setStatus(result.message);
        setError(null);
        window.setTimeout(() => {
          postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_CLOSE_MESSAGE, version: 1 });
        }, 0);
        return;
      }
      if (result.action === 'preferences') {
        setPreferences(normalizeComprasnetEtpGenerationPreferences(result.preferences));
      }
    };

    window.addEventListener('message', handleMessage);
    postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_READY_MESSAGE, version: 1 });
    const interval = window.setInterval(() => {
      if (active) postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_READY_MESSAGE, version: 1 });
    }, 500);

    const stop = window.setTimeout(() => window.clearInterval(interval), 10000);
    return () => {
      active = false;
      window.clearTimeout(stop);
      window.clearInterval(interval);
      window.removeEventListener('message', handleMessage);
      if (preferencesSaveTimerRef.current) window.clearTimeout(preferencesSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!context?.extensionSession) return;
    let active = true;
    void supabase.auth.setSession({
      access_token: context.extensionSession.accessToken,
      refresh_token: context.extensionSession.refreshToken,
    }).then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError('A sessão do SIAGES não pôde ser iniciada. Entre novamente pela extensão.');
        return;
      }
      supabase.auth.stopAutoRefresh();
      setSessionReady(true);
      setStatus('Sessão do SIAGES pronta para consultar o processo.');
    });
    return () => { active = false; };
  }, [context?.extensionSession]);

  const lookupProcess = useCallback(async () => {
    const normalized = normalizeProcessNumber(processNumber);
    if (!normalized) {
      setProcesso(null);
      setAnalysis(null);
      setStatus('Nenhum número de processo informado; a geração usará apenas os dados da página e os anexos.');
      return;
    }

    try {
      setError(null);
      setStatus('Consultando o processo no SIAGES...');
      const processos = await suapProcessosService.getAll();
      const found = processos.find((item) => normalizeProcessNumber(item.numProcesso || '') === normalized) || null;
      setProcesso(found);
      if (!found) {
        setAnalysis(null);
        setStatus('Processo não encontrado no SIAGES. O número será usado apenas como contexto.');
        return;
      }

      if (!found.pdfUrl) {
        setAnalysis(null);
        setStatus('Processo encontrado. Ele ainda não possui PDF sincronizado; usando os dados disponíveis.');
        return;
      }

      setStatus('Processo encontrado. Analisando o PDF sincronizado...');
      const nextAnalysis = await preliminaryStudiesService.analyzeProcessPdf(found);
      setAnalysis(nextAnalysis);
      setStatus('Processo e PDF carregados como contexto.');
    } catch {
      setAnalysis(null);
      setStatus('Não foi possível consultar o processo. A geração continuará com os dados disponíveis.');
    }
  }, [processNumber]);

  useEffect(() => {
    if (!sessionReady || !context?.processNumber || autoLookupDoneRef.current) return;
    autoLookupDoneRef.current = true;
    void lookupProcess().catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Não foi possível consultar o processo automaticamente.');
      setStatus('A consulta automática falhou; você pode tentar novamente pelo botão Buscar processo.');
    });
  }, [context?.processNumber, lookupProcess, sessionReady]);

  const currentFields = useMemo(() => context?.fields || [], [context?.fields]);
  const activeSectionId = context?.currentSectionId || currentFields[0]?.id;
  const activeField = currentFields.find((field) => field.id === activeSectionId);
  const activeSelection = activeSectionId ? selections[activeSectionId] || { selected: false, replaceExisting: false } : { selected: false, replaceExisting: false };

  function updatePreferences(update: (current: ComprasnetEtpGenerationPreferences) => ComprasnetEtpGenerationPreferences) {
    const next = normalizeComprasnetEtpGenerationPreferences(update(preferences));
    setPreferences(next);
    if (preferencesSaveTimerRef.current) window.clearTimeout(preferencesSaveTimerRef.current);
    preferencesSaveTimerRef.current = window.setTimeout(() => postRequest({ action: 'save-preferences', preferences: next }), 350);
  }

  function toggleListPreference(key: 'emphases' | 'sources', value: string) {
    updatePreferences((current) => {
      const values = current[key] as string[];
      const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
      return { ...current, [key]: nextValues.length ? nextValues : values };
    });
  }

  function toggleSectionChecklist(item: string) {
    if (!activeSectionId) return;
    updatePreferences((current) => {
      const checklist = current.sectionOverrides[activeSectionId]?.checklist || [];
      const nextChecklist = checklist.includes(item) ? checklist.filter((value) => value !== item) : [...checklist, item];
      return {
        ...current,
        sectionOverrides: {
          ...current.sectionOverrides,
          [activeSectionId]: { checklist: nextChecklist },
        },
      };
    });
  }

  function requestWholeSnapshot() {
    setError(null);
    setStage('loading');
    setStatus('Lendo as seções textuais do ETP...');
    postRequest({ action: 'snapshot', mode: 'whole' });
  }

  function requestCurrentSnapshot() {
    setError(null);
    setStage('loading');
    setStatus('Atualizando a seção aberta no Comprasnet...');
    postRequest({ action: 'snapshot', mode: 'current' });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const remaining = PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES - attachments.length;
    const candidates = Array.from(files).slice(0, remaining);
    if (candidates.length < files.length) setError(`O limite é de ${PRELIMINARY_STUDY_SUPPLEMENTAL_MAX_FILES} anexos auxiliares.`);

    for (const file of candidates) {
      try {
        setStatus(`Lendo ${file.name}...`);
        const result = await analyzePreliminaryStudySupplementalAttachmentFile(file);
        setAttachments((current) => [...current, result]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : `Não foi possível ler ${file.name}.`);
      }
    }
    setStatus('Anexos auxiliares processados temporariamente.');
  }

  async function handleGenerate() {
    if (!context) {
      setError('A tela do Comprasnet ainda não enviou o contexto do ETP.');
      return;
    }
    if (mode === 'current' && context.fields.length === 0) {
      setError('A seção atual não é um campo textual compatível. Escolha ETP completo para continuar.');
      return;
    }
    if (mode === 'current' && (context.fields.length !== 1 || context.fields[0]?.id !== context.currentSectionId)) {
      requestCurrentSnapshot();
      return;
    }
    if (mode === 'whole' && !context.fields.some((field) => field.id === 'necessidade')) {
      requestWholeSnapshot();
      return;
    }

    setError(null);
    setStage('loading');
    setStatus('Preparando o rascunho do ETP...');
    try {
      const result = await comprasnetEtpService.generateDraft({
        processo,
        manualObject,
        analysis,
        questionnaireAnswers: buildAnswers(context.fields),
        supplementalSnippets: attachments.flatMap((attachment) => attachment.snippets),
        generationPreferences: preferences,
      });
      const scopedResult = mode === 'current' && context.fields[0]
        ? { ...result, sections: result.sections?.filter((section) => section.id === context.fields[0].id) }
        : result;
      setDraft(scopedResult);
      setShowReviewNotices(false);
      const nextSelections = Object.fromEntries((scopedResult.sections || []).map((section) => {
        const existing = context.fields.find((field) => field.id === section.id);
        return [section.id, {
          selected: isFieldEmpty(existing),
          replaceExisting: false,
        }];
      }));
      setSelections(nextSelections);
      setStage('preview');
      setStatus('Prévia pronta para revisão.');
    } catch (caught) {
      setStage('setup');
      setError(caught instanceof Error ? caught.message : 'Não foi possível gerar o ETP.');
    }
  }

  function handleApply() {
    const generated = draft?.sections?.find((section) => section.id === activeSectionId);
    if (!activeSectionId || !generated || !activeSelection.selected) {
      setError('Selecione a seção atualmente aberta no Comprasnet para aplicá-la.');
      return;
    }
    if (!isFieldEmpty(activeField) && preferences.existingTextMode === 'reescrever' && !activeSelection.replaceExisting) {
      setError('Para reescrever o conteúdo atual, confirme a substituição desta seção.');
      return;
    }

    setError(null);
    setStage('applying');
    setStatus('Aplicando a seção aberta e aguardando o salvamento automático...');
    postRequest({ action: 'apply', fields: [{ id: generated.id, html: generated.html, replaceExisting: activeSelection.replaceExisting }] });
  }

  function toggleSelection(id: string, key: keyof FieldSelection) {
    setSelections((current) => ({
      ...current,
      [id]: { ...current[id], [key]: !current[id]?.[key] },
    }));
  }

  function renderSetup() {
    return (
      <>
        <section className="comprasnet-etp-card br-card">
          <div className="comprasnet-etp-card-header">
            <div>
              <span className="comprasnet-etp-eyebrow">Assistente de redação</span>
              <h1>Escrever ETP com inteligência artificial</h1>
              <p>O texto será preparado para revisão. A extensão não conclui nem envia o ETP.</p>
            </div>
            <button className="br-button circle secondary" type="button" aria-label="Fechar" onClick={() => postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_CLOSE_MESSAGE, version: 1 })}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="comprasnet-etp-alert" role="note">
            <strong>Revisão obrigatória.</strong> A prévia geral é apenas referência. A extensão grava somente a seção que estiver aberta no Comprasnet e nunca conclui o ETP.
          </div>

          <details className="comprasnet-etp-preferences br-card">
            <summary><strong>Configurar minuta</strong><small>Preferências não sensíveis, lembradas neste navegador.</small></summary>
            <div className="comprasnet-etp-preferences-content">
              <div className="comprasnet-etp-grid comprasnet-etp-preferences-grid">
                <label className="br-input"><span className="label">Extensão</span><select value={preferences.length} onChange={(event) => updatePreferences((current) => ({ ...current, length: event.target.value as ComprasnetEtpGenerationPreferences['length'] }))}>{comprasnetEtpLengthOptions.map((option) => <option key={option} value={option}>{preferenceLabels[option]}</option>)}</select></label>
                <label className="br-input"><span className="label">Parágrafos alvo</span><input type="number" min="1" max="8" value={preferences.paragraphCount} onChange={(event) => updatePreferences((current) => ({ ...current, paragraphCount: Number(event.target.value) }))} /></label>
                <label className="br-input"><span className="label">Itens alvo</span><input type="number" min="3" max="12" value={preferences.itemCount} onChange={(event) => updatePreferences((current) => ({ ...current, itemCount: Number(event.target.value) }))} /></label>
                <label className="br-input"><span className="label">Formato</span><select value={preferences.format} onChange={(event) => updatePreferences((current) => ({ ...current, format: event.target.value as ComprasnetEtpGenerationPreferences['format'] }))}>{comprasnetEtpFormatOptions.map((option) => <option key={option} value={option}>{preferenceLabels[option]}</option>)}</select></label>
                <label className="br-input"><span className="label">Texto existente</span><select value={preferences.existingTextMode} onChange={(event) => updatePreferences((current) => ({ ...current, existingTextMode: event.target.value as ComprasnetEtpGenerationPreferences['existingTextMode'] }))}>{comprasnetEtpExistingTextOptions.map((option) => <option key={option} value={option}>{preferenceLabels[option]}</option>)}</select></label>
              </div>
              <fieldset className="comprasnet-etp-fieldset"><legend>Ênfases</legend><div className="comprasnet-etp-check-grid">{comprasnetEtpEmphasisOptions.map((option) => <label key={option}><input type="checkbox" checked={preferences.emphases.includes(option)} onChange={() => toggleListPreference('emphases', option)} /> {preferenceLabels[option]}</label>)}</div></fieldset>
              <fieldset className="comprasnet-etp-fieldset"><legend>Fontes permitidas</legend><div className="comprasnet-etp-check-grid">{comprasnetEtpSourceOptions.map((option) => <label key={option}><input type="checkbox" checked={preferences.sources.includes(option)} onChange={() => toggleListPreference('sources', option)} /> {preferenceLabels[option]}</label>)}</div></fieldset>
              {activeSectionId ? <fieldset className="comprasnet-etp-fieldset"><legend>Ajustes da seção aberta: {activeField?.title || activeSectionId}</legend><div className="comprasnet-etp-check-grid">{(comprasnetEtpSectionChecklists[activeSectionId] || []).map((item) => <label key={item}><input type="checkbox" checked={(preferences.sectionOverrides[activeSectionId]?.checklist || []).includes(item)} onChange={() => toggleSectionChecklist(item)} /> {preferenceLabels[item] || item}</label>)}</div></fieldset> : null}
            </div>
          </details>

          <fieldset className="comprasnet-etp-fieldset">
            <legend>Escopo da geração</legend>
            <label className="comprasnet-etp-radio">
              <input type="radio" name="comprasnet-etp-mode" checked={mode === 'current'} onChange={() => setMode('current')} />
              <span><strong>Seção atual</strong><small>Gera somente “{context?.fields[0]?.title || 'a seção aberta'}”.</small></span>
            </label>
            <label className="comprasnet-etp-radio">
              <input type="radio" name="comprasnet-etp-mode" checked={mode === 'whole'} onChange={() => setMode('whole')} />
              <span><strong>ETP completo</strong><small>Lê e prepara todas as seções textuais compatíveis.</small></span>
            </label>
          </fieldset>

          <div className="comprasnet-etp-grid">
            <label className="br-input">
              <span className="label">Número do processo</span>
              <input value={processNumber} onChange={(event) => setProcessNumber(event.target.value)} placeholder="Ex.: 23035.000001/2026-11" inputMode="numeric" />
              <small>Usado para buscar dados no SIAGES, sem preencher campos estruturados do Comprasnet.</small>
            </label>
            <button className="br-button secondary comprasnet-etp-search" type="button" onClick={() => void lookupProcess()}>
              Buscar processo
            </button>
          </div>

          <label className="br-input">
            <span className="label">Objeto ou contexto adicional</span>
            <textarea value={manualObject} onChange={(event) => setManualObject(event.target.value)} placeholder="Descreva o objeto, problema ou informação que deve orientar a redação." rows={4} />
          </label>

          <div className="comprasnet-etp-upload br-card">
            <div className="comprasnet-etp-upload-heading">
              <div><strong>Documentos de apoio</strong><small>PDFs, planilhas, DOCX, CSV e textos. Processamento temporário.</small></div>
              <button className="br-button secondary small" type="button" onClick={() => fileInputRef.current?.click()}><Paperclip size={16} aria-hidden="true" /> Adicionar</button>
            </div>
            <input ref={fileInputRef} hidden type="file" multiple accept={PRELIMINARY_STUDY_SUPPLEMENTAL_ACCEPT} onChange={(event) => void handleFiles(event.target.files)} />
            {attachments.length > 0 ? <ul className="comprasnet-etp-file-list">{attachments.map((attachment) => <li key={attachment.fileName}><span>{attachment.fileName}</span><small>{attachment.snippets.length} trecho(s)</small></li>)}</ul> : <small>Nenhum arquivo anexado.</small>}
          </div>

          <div className="comprasnet-etp-actions">
            <button className="br-button secondary" type="button" onClick={() => postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_CLOSE_MESSAGE, version: 1 })}>Cancelar</button>
            <button className="br-button primary" type="button" onClick={() => void handleGenerate()} disabled={stage === 'loading'}>
              {stage === 'loading' ? <><Loader2 className="spin" size={16} aria-hidden="true" /> Preparando...</> : 'Gerar prévia'}
            </button>
          </div>
        </section>
      </>
    );
  }

  function renderPreview() {
    const sections = draft?.sections || [];
    const reviewWarnings = draft?.warnings || [];
    const reviewPendencies = draft?.missingRequiredFields || [];
    const reviewNoticeCount = reviewWarnings.length + reviewPendencies.length;
    const hasReviewNotices = reviewNoticeCount > 0;
    return (
      <section className="comprasnet-etp-card br-card">
        <div className="comprasnet-etp-card-header">
          <div><span className="comprasnet-etp-eyebrow">Prévia com seleção</span><h1>Revise antes de aplicar</h1><p>{draft?.subtitle || 'Confira cada seção gerada e decida o que será enviado ao Comprasnet.'}</p></div>
          <div className="comprasnet-etp-card-header-actions">
            {hasReviewNotices ? <div className="comprasnet-etp-notice-control">
              <button
                className="br-button circle secondary comprasnet-etp-notice-trigger"
                type="button"
                aria-label={`Ver ${reviewNoticeCount} aviso(s) e pendência(s)`}
                aria-expanded={showReviewNotices}
                aria-controls="comprasnet-etp-review-notices"
                title="Ver avisos e pendências"
                onClick={() => setShowReviewNotices((current) => !current)}
              >
                <CircleAlert size={18} aria-hidden="true" />
                <span className="comprasnet-etp-notice-count" aria-hidden="true">{reviewNoticeCount}</span>
              </button>
              {showReviewNotices ? <div id="comprasnet-etp-review-notices" className="comprasnet-etp-notice-panel" role="region" aria-label="Avisos e pendências">
                {reviewWarnings.length ? <div><strong>Atenção</strong><ul>{reviewWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
                {reviewPendencies.length ? <div><strong>Pendências</strong><p>{reviewPendencies.join('; ')}.</p></div> : null}
              </div> : null}
            </div> : null}
            <button className="br-button circle secondary" type="button" aria-label="Fechar" onClick={() => postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_CLOSE_MESSAGE, version: 1 })}><X size={18} aria-hidden="true" /></button>
          </div>
        </div>
        <div className="comprasnet-etp-preview-list">
          {sections.map((section) => {
            const field = context?.fields.find((item) => item.id === section.id);
            const selection = selections[section.id] || { selected: false, replaceExisting: false };
            const isActiveSection = section.id === activeSectionId;
            return <article className={`comprasnet-etp-preview-item ${isActiveSection ? 'is-active' : 'is-reference'}`} key={section.id}>
              <div className="comprasnet-etp-preview-heading">
                {isActiveSection
                  ? <label><input type="checkbox" checked={selection.selected} onChange={() => toggleSelection(section.id, 'selected')} /><strong>{section.title}</strong></label>
                  : <strong>{section.title}</strong>}
                <span className={isActiveSection ? 'comprasnet-etp-tag active' : 'comprasnet-etp-tag'}>{isActiveSection ? 'Seção aberta' : 'Somente referência'}</span>
              </div>
              {!isActiveSection ? <p className="comprasnet-etp-reference-note">Avance manualmente no Comprasnet até esta seção para aplicá-la.</p> : null}
              {isActiveSection && !isFieldEmpty(field) ? <label className="comprasnet-etp-replace"><input type="checkbox" checked={selection.replaceExisting} onChange={() => toggleSelection(section.id, 'replaceExisting')} /> {preferences.existingTextMode === 'reescrever' ? 'Confirmo que desejo reescrever o conteúdo atual nesta seção' : 'Substituir o conteúdo atual nesta seção'}</label> : null}
              <div className="comprasnet-etp-preview-content" dangerouslySetInnerHTML={{ __html: section.html }} />
            </article>;
          })}
        </div>
        <div className="comprasnet-etp-actions">
          <button className="br-button secondary" type="button" onClick={() => { setMode('current'); setDraft(null); requestCurrentSnapshot(); }}>Ajustar e regenerar seção aberta</button>
          <button className="br-button secondary" type="button" onClick={() => { setStage('setup'); setDraft(null); }}>Voltar</button>
          <button className="br-button primary" type="button" onClick={handleApply} disabled={stage === 'applying' || !activeSelection.selected}>
            {stage === 'applying' ? <><Loader2 className="spin" size={16} aria-hidden="true" /> Salvando...</> : 'Aplicar esta seção'}
          </button>
        </div>
      </section>
    );
  }

  if (!context) return <main className="comprasnet-etp-app"><div className="comprasnet-etp-status"><Loader2 className="spin" size={20} aria-hidden="true" />{status}</div></main>;

  return (
    <main className="comprasnet-etp-app" style={{
      '--comprasnet-font-family': context.theme.fontFamily,
      '--comprasnet-font-size': context.theme.fontSize,
      '--comprasnet-text': context.theme.textColor,
      '--comprasnet-muted': context.theme.mutedColor,
      '--comprasnet-surface': context.theme.surfaceColor,
      '--comprasnet-background': context.theme.backgroundColor,
      '--comprasnet-border': context.theme.borderColor,
      '--comprasnet-primary': context.theme.primaryColor,
      '--comprasnet-primary-text': context.theme.primaryTextColor,
      '--comprasnet-secondary': context.theme.secondaryColor,
      '--comprasnet-secondary-text': context.theme.secondaryTextColor,
      '--comprasnet-focus': context.theme.focusColor,
      '--comprasnet-radius': context.theme.radius,
    } as CSSProperties}>
      <div className="comprasnet-etp-live-status" aria-live="polite">{status}</div>
      {error ? <div className="comprasnet-etp-alert error" role="alert">{error}</div> : null}
      {stage === 'preview' || stage === 'applying' || stage === 'done' ? renderPreview() : renderSetup()}
      {stage === 'done' ? <div className="comprasnet-etp-alert success" role="status">Aplicação concluída. O botão “Concluir ETP” não foi acionado; faça a conferência final diretamente no Comprasnet.</div> : null}
    </main>
  );
}
