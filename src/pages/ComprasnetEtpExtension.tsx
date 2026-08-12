import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const autoLookupDoneRef = useRef(false);

  useEffect(() => {
    let active = true;
    const handleMessage = (event: MessageEvent) => {
      if (!isComprasnetEtpMessage(event, COMPRASNET_ETP_CONTEXT_MESSAGE) &&
        !isComprasnetEtpMessage(event, COMPRASNET_ETP_RESULT_MESSAGE)) return;

      if (event.data.type === COMPRASNET_ETP_CONTEXT_MESSAGE) {
        const nextContext = event.data.payload as ComprasnetEtpPageContext;
        if (!nextContext || !Array.isArray(nextContext.fields)) return;
        setContext(nextContext);
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
  const selectedFields = useMemo(() => currentFields.filter((field) => selections[field.id]?.selected), [currentFields, selections]);

  function requestWholeSnapshot() {
    setError(null);
    setStage('loading');
    setStatus('Lendo as seções textuais do ETP...');
    postRequest({ action: 'snapshot', mode: 'whole' });
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
      });
      const scopedResult = mode === 'current' && context.fields[0]
        ? { ...result, sections: result.sections?.filter((section) => section.id === context.fields[0].id) }
        : result;
      setDraft(scopedResult);
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
    if (!draft || selectedFields.length === 0) {
      setError('Selecione ao menos uma seção para aplicar.');
      return;
    }
    const fields = selectedFields
      .map((field) => {
        const generated = draft.sections?.find((section) => section.id === field.id);
        if (!generated) return null;
        const selection = selections[field.id];
        return { id: field.id, html: generated.html, replaceExisting: selection.replaceExisting };
      })
      .filter((value): value is { id: string; html: string; replaceExisting: boolean } => Boolean(value));

    setError(null);
    setStage('applying');
    setStatus('Aplicando as seções selecionadas e aguardando o salvamento automático...');
    postRequest({ action: 'apply', fields });
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
            <strong>Revisão obrigatória.</strong> O Comprasnet continuará com o conteúdo existente até você selecionar as seções na prévia.
          </div>

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
    return (
      <section className="comprasnet-etp-card br-card">
        <div className="comprasnet-etp-card-header">
          <div><span className="comprasnet-etp-eyebrow">Prévia com seleção</span><h1>Revise antes de aplicar</h1><p>{draft?.subtitle || 'Confira cada seção gerada e decida o que será enviado ao Comprasnet.'}</p></div>
          <button className="br-button circle secondary" type="button" aria-label="Fechar" onClick={() => postComprasnetMessage({ source: 'siages', type: COMPRASNET_ETP_CLOSE_MESSAGE, version: 1 })}><X size={18} aria-hidden="true" /></button>
        </div>
        {draft?.warnings?.length ? <div className="comprasnet-etp-alert warning" role="alert"><strong>Atenção:</strong><ul>{draft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
        {draft?.missingRequiredFields?.length ? <div className="comprasnet-etp-alert warning" role="alert"><strong>Pendências:</strong> {draft.missingRequiredFields.join('; ')}.</div> : null}
        <div className="comprasnet-etp-preview-list">
          {sections.map((section) => {
            const field = context?.fields.find((item) => item.id === section.id);
            const selection = selections[section.id] || { selected: false, replaceExisting: false };
            return <article className="comprasnet-etp-preview-item" key={section.id}>
              <div className="comprasnet-etp-preview-heading">
                <label><input type="checkbox" checked={selection.selected} onChange={() => toggleSelection(section.id, 'selected')} /><strong>{section.title}</strong></label>
                <span className={isFieldEmpty(field) ? 'comprasnet-etp-tag empty' : 'comprasnet-etp-tag'}>{isFieldEmpty(field) ? 'Campo vazio' : 'Já preenchido'}</span>
              </div>
              {!isFieldEmpty(field) ? <label className="comprasnet-etp-replace"><input type="checkbox" checked={selection.replaceExisting} onChange={() => toggleSelection(section.id, 'replaceExisting')} /> Substituir o conteúdo atual nesta seção</label> : null}
              <div className="comprasnet-etp-preview-content" dangerouslySetInnerHTML={{ __html: section.html }} />
            </article>;
          })}
        </div>
        <div className="comprasnet-etp-actions">
          <button className="br-button secondary" type="button" onClick={() => { setStage('setup'); setDraft(null); }}>Voltar</button>
          <button className="br-button primary" type="button" onClick={handleApply} disabled={stage === 'applying' || selectedFields.length === 0}>
            {stage === 'applying' ? <><Loader2 className="spin" size={16} aria-hidden="true" /> Salvando...</> : `Aplicar ${selectedFields.length || ''} seção(ões)`}
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
