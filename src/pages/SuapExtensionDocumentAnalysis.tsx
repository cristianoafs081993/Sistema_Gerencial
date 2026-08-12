import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileSearch, History, Info, Loader2, Moon, Printer, ShieldCheck, Sun, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';

import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  getSuapExtensionDocumentAnalysisContext,
  isValidSuapExtensionDocumentPdfResult,
  SUAP_EXTENSION_DOCUMENT_ANALYSIS_CLOSE_MESSAGE,
  SUAP_EXTENSION_DOCUMENT_ANALYSIS_READY_MESSAGE,
  SUAP_EXTENSION_DOCUMENT_PDF_REQUEST_TYPE,
  SUAP_EXTENSION_DOCUMENT_PDF_RESULT_TYPE,
  SUAP_EXTENSION_ORIGIN,
  type SuapExtensionDocumentAnalysisContext,
} from '@/lib/suapExtensionDispatch';
import {
  SUAP_DOCUMENT_REVIEW_MAX_BYTES,
  SUAP_DOCUMENT_REVIEW_MAX_PAGES,
  analyzeSuapDocument,
  getLatestSuapDocumentReview,
} from '@/services/suapDocumentReview';
import type { SuapDocumentReviewFinding, SuapDocumentReviewResult } from '@/lib/suapDocumentReview';
import { downloadSuapDocumentReview, printSuapDocumentReview } from '@/lib/suapDocumentReviewExport';
import { supabase } from '@/lib/supabase';

const bundledWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
pdfjsLib.GlobalWorkerOptions.workerSrc = typeof bundledWorkerUrl === 'string'
  ? bundledWorkerUrl
  : new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;

const reviewThemeClasses = {
  dark: {
    page: 'bg-zinc-950 text-zinc-100', shell: 'border-zinc-800 bg-zinc-900', headerBorder: 'border-zinc-800',
    title: 'text-white', subtitle: 'text-zinc-400', close: 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
    disclaimer: 'border-amber-900/70 bg-amber-950/30 text-amber-100', panel: 'border-zinc-800 bg-zinc-950/40',
    summary: 'text-zinc-300', count: 'border-zinc-800 bg-zinc-900', heading: 'text-zinc-400',
    muted: 'text-zinc-500', action: 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white',
    finding: 'border-zinc-800 bg-zinc-950/40 data-[state=open]:bg-zinc-950/70', triggerTitle: 'text-white',
    triggerMeta: 'text-zinc-500', content: 'text-zinc-300', label: 'text-zinc-100', excerpt: 'border-zinc-700 text-zinc-400',
    suggested: 'border-teal-900/70 bg-teal-950/20', suggestedTitle: 'text-teal-300', suggestedText: 'text-teal-50',
    sourceBorder: 'border-zinc-800', sourceText: 'text-teal-300 hover:text-teal-200', limitations: 'text-zinc-400',
  },
  light: {
    page: 'bg-slate-100 text-slate-900', shell: 'border-slate-200 bg-white', headerBorder: 'border-slate-200',
    title: 'text-slate-900', subtitle: 'text-slate-600', close: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
    disclaimer: 'border-amber-200 bg-amber-50 text-amber-900', panel: 'border-slate-200 bg-slate-50/70',
    summary: 'text-slate-700', count: 'border-slate-200 bg-white', heading: 'text-slate-600',
    muted: 'text-slate-500', action: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900',
    finding: 'border-slate-200 bg-white data-[state=open]:bg-slate-50', triggerTitle: 'text-slate-900',
    triggerMeta: 'text-slate-500', content: 'text-slate-700', label: 'text-slate-900', excerpt: 'border-slate-300 text-slate-600',
    suggested: 'border-teal-200 bg-teal-50', suggestedTitle: 'text-teal-700', suggestedText: 'text-teal-900',
    sourceBorder: 'border-slate-200', sourceText: 'text-teal-700 hover:text-teal-800', limitations: 'text-slate-600',
  },
} as const;

type ReviewTheme = keyof typeof reviewThemeClasses;
const REVIEW_THEME_STORAGE_KEY = 'siages-suap-review-theme';

function getInitialReviewTheme(): ReviewTheme {
  try {
    const stored = window.localStorage.getItem(REVIEW_THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // O iframe pode estar em um contexto sem acesso ao armazenamento local.
  }
  return 'dark';
}
function postMessageToSuapParent(message: unknown) {
  window.parent.postMessage(message, SUAP_EXTENSION_ORIGIN);
}

function bytesToBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let result = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < view.length; index += chunkSize) {
    result += String.fromCharCode(...view.subarray(index, index + chunkSize));
  }
  return btoa(result);
}

async function getPageCount(bytes: ArrayBuffer) {
  try {
    // pdf.js may transfer/detach the buffer it receives when using its worker.
    // Analyze a copy so the original bytes remain available for base64 encoding.
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
    return pdf.numPages;
  } catch {
    return undefined;
  }
}

function requestDocumentPdf(context: SuapExtensionDocumentAnalysisContext, signal: AbortSignal) {
  postMessageToSuapParent({
    source: 'siages',
    type: SUAP_EXTENSION_DOCUMENT_PDF_REQUEST_TYPE,
    version: 1,
    payload: {
      suapId: context.suapId,
      documentId: context.documentId,
      documentOriginalPath: context.documentOriginalPath,
    },
  });

  return new Promise<ArrayBuffer>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Tempo esgotado ao baixar o PDF do SUAP.')), 120000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', receivePdf);
      signal.removeEventListener('abort', abort);
    };
    const finish = (error?: Error, bytes?: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else if (bytes) resolve(bytes);
      else reject(new Error('O SUAP não devolveu o PDF do documento.'));
    };
    const abort = () => finish(new Error('A análise foi encerrada.'));
    const receivePdf = (event: MessageEvent) => {
      if (!isValidSuapExtensionDocumentPdfResult(event, window.parent, context.suapId, context.documentId)) return;
      if (event.data.payload.error) finish(new Error(event.data.payload.error));
      else finish(undefined, event.data.payload.bytes);
    };
    window.addEventListener('message', receivePdf);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export default function SuapExtensionDocumentAnalysis() {
  const [context, setContext] = useState<SuapExtensionDocumentAnalysisContext | null>(null);
  const [result, setResult] = useState<SuapDocumentReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Aguardando o contexto do documento SUAP...');
  const [retryCount, setRetryCount] = useState(0);
  const [theme, setTheme] = useState<ReviewTheme>(getInitialReviewTheme);
  const [savedReviewMissing, setSavedReviewMissing] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(REVIEW_THEME_STORAGE_KEY, theme);
    } catch {
      // O armazenamento pode estar indisponível no iframe.
    }
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    let attempts = 0;
    const announceReady = () => {
      attempts += 1;
      postMessageToSuapParent(SUAP_EXTENSION_DOCUMENT_ANALYSIS_READY_MESSAGE);
    };
    const interval = window.setInterval(() => {
      if (attempts >= 20) window.clearInterval(interval);
      else announceReady();
    }, 500);
    const receiveContext = (event: MessageEvent) => {
      const nextContext = getSuapExtensionDocumentAnalysisContext(event, window.parent);
      if (!nextContext) return;
      window.clearInterval(interval);
      setContext(nextContext);
      setError(null);
      setSavedReviewMissing(false);
    };
    window.addEventListener('message', receiveContext);
    announceReady();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('message', receiveContext);
    };
  }, []);

  useEffect(() => {
    if (!context) return;
    const controller = new AbortController();
    let active = true;

    void (async () => {
      if (!context.extensionSession) {
        throw new Error('Entre no SIAGES pela aba Configurações para analisar este documento.');
      }
      setError(null);
      setResult(null);
      setSavedReviewMissing(false);
      setStatus('Autenticando a análise no SIAGES...');
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: context.extensionSession.accessToken,
        refresh_token: context.extensionSession.refreshToken,
      });
      if (sessionError || !data.session) throw sessionError ?? new Error('Não foi possível iniciar a sessão da análise.');
      supabase.auth.stopAutoRefresh();

      if (context.reviewMode === 'latest') {
        setStatus('Carregando a última análise salva...');
        const savedReview = await getLatestSuapDocumentReview({
          suapId: context.suapId,
          documentId: context.documentId,
          documentType: context.documentType,
        });
        if (!active) return;
        if (!savedReview) {
          setSavedReviewMissing(true);
          setStatus('Nenhuma análise salva para este documento.');
          return;
        }
        setResult(savedReview);
        setStatus('Análise salva carregada.');
        return;
      }
      setStatus('Baixando o PDF do documento pelo SUAP...');
      const bytes = await requestDocumentPdf(context, controller.signal);
      if (!active) return;
      if (bytes.byteLength > SUAP_DOCUMENT_REVIEW_MAX_BYTES) throw new Error('O PDF excede o limite de 20 MB para análise.');
      const pageCount = await getPageCount(bytes);
      if (pageCount && pageCount > SUAP_DOCUMENT_REVIEW_MAX_PAGES) throw new Error('O PDF excede o limite de 200 páginas para análise.');

      setStatus('Consultando legislação e cadernos oficiais...');
      const review = await analyzeSuapDocument({
        suapId: context.suapId,
        documentId: context.documentId,
        documentType: context.documentType,
        documentTitle: context.documentTitle,
        processNumber: context.processNumber,
        pdfBase64: bytesToBase64(bytes),
        pageCount,
      });
      if (active) {
        setResult(review);
        setStatus('Revisão concluída.');
      }
    })().catch((caught) => {
      if (!active || controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : 'Não foi possível analisar o documento.');
      setStatus('A análise não foi concluída.');
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [context, retryCount]);

  const documentLabel = context?.documentType === 'etp' ? 'Estudo Técnico Preliminar' : 'Termo de Referência';

  return (
    <main className={`min-h-screen p-4 font-ui sm:p-6 ${reviewThemeClasses[theme].page}`} data-review-theme={theme}>
      <div className={`mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${reviewThemeClasses[theme].shell}`}>
        <header className={`flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7 ${reviewThemeClasses[theme].headerBorder}`}>
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">
              <FileSearch className="h-4 w-4" /> Revisão assistida por IA
            </div>
            <h1 className={`truncate text-lg font-semibold ${reviewThemeClasses[theme].title}`}>{context?.documentTitle || documentLabel}</h1>
            <p className={`mt-1 text-sm ${reviewThemeClasses[theme].subtitle}`}>{context ? `${documentLabel} · ${context.processNumber || `processo SUAP ${context.suapId}`}` : status}</p>
          </div>
          <Button variant="ghost" size="icon" className={`shrink-0 ${reviewThemeClasses[theme].close}`} onClick={() => postMessageToSuapParent(SUAP_EXTENSION_DOCUMENT_ANALYSIS_CLOSE_MESSAGE)} aria-label="Fechar análise">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-5 sm:p-7">
          <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${reviewThemeClasses[theme].disclaimer}`}>
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p>Esta é uma revisão assistida, baseada em fontes oficiais consultadas no momento da análise. Ela não substitui a avaliação jurídica, técnica ou administrativa e não altera o documento do SUAP.</p>
          </div>

          {!result && !error && !savedReviewMissing && <LoadingState message={status} theme={theme} />}
          {savedReviewMissing && <SavedReviewEmptyState theme={theme} />}
          {error && <ErrorState message={error} theme={theme} onRetry={() => setRetryCount((current) => current + 1)} />}
          {result && <ReviewResult result={result} documentTitle={context?.documentTitle || documentLabel} theme={theme} onThemeChange={setTheme} />}
        </div>
      </div>
    </main>
  );
}

function LoadingState({ message, theme }: { message: string; theme: ReviewTheme }) {
  const styles = reviewThemeClasses[theme];
  return <div className={`flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border text-center ${styles.panel} ${styles.summary}`}><Loader2 className="h-8 w-8 animate-spin text-teal-500" /><p className="text-sm">{message}</p><p className={`max-w-md text-xs ${styles.muted}`}>A análise será salva para consulta futura após a conclusão.</p></div>;
}

function ErrorState({ message, theme, onRetry }: { message: string; theme: ReviewTheme; onRetry: () => void }) {
  const errorClasses = theme === 'dark' ? 'border-red-900/60 bg-red-950/20 text-red-100' : 'border-red-200 bg-red-50 text-red-800';
  return <div className={`flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border p-6 text-center ${errorClasses}`}><AlertTriangle className="h-8 w-8 text-red-500" /><p className="max-w-lg text-sm">{message}</p><Button onClick={onRetry} className="bg-teal-600 text-white hover:bg-teal-500">Tentar novamente</Button></div>;
}

function SavedReviewEmptyState({ theme }: { theme: ReviewTheme }) {
  const styles = reviewThemeClasses[theme];
  return <div className={`flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border p-6 text-center ${styles.panel} ${styles.summary}`}>
    <History className="h-8 w-8 text-teal-500" />
    <p className={`max-w-lg text-sm ${styles.label}`}>Nenhuma análise salva foi encontrada para este documento.</p>
    <p className={`max-w-md text-xs ${styles.muted}`}>Gere uma nova análise pelo ícone de estrelas para que ela fique disponível aqui.</p>
  </div>;
}

function ThemeToggle({ theme, onThemeChange }: { theme: ReviewTheme; onThemeChange: (theme: ReviewTheme) => void }) {
  const styles = reviewThemeClasses[theme];
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return <Button type="button" variant="outline" size="sm" className={styles.action} aria-label={`Ativar modo ${nextTheme === 'light' ? 'claro' : 'escuro'}`} title={`Ativar modo ${nextTheme === 'light' ? 'claro' : 'escuro'}`} onClick={() => onThemeChange(nextTheme)}>
    {nextTheme === 'light' ? <Sun /> : <Moon />} {nextTheme === 'light' ? 'Modo claro' : 'Modo escuro'}
  </Button>;
}

function ReviewResult({ result, documentTitle, theme, onThemeChange }: { result: SuapDocumentReviewResult; documentTitle: string; theme: ReviewTheme; onThemeChange: (theme: ReviewTheme) => void }) {
  const styles = reviewThemeClasses[theme];
  const statusLabel = {
    critical: 'Pontos críticos encontrados',
    attention: 'Revisão requer atenção',
    no_major_finding: 'Nenhum ponto grave identificado',
    insufficient_evidence: 'Evidência insuficiente',
  }[result.status];
  return <div className="space-y-5">
    <section className={`rounded-xl border p-5 ${styles.panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><StatusIcon status={result.status} /><h2 className={`font-semibold ${styles.triggerTitle}`}>{statusLabel}</h2></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`text-xs ${styles.muted}`}>Consultado em {new Date(result.checkedAt).toLocaleString('pt-BR')}</span>
          <Button type="button" variant="outline" size="sm" className={styles.action} onClick={() => downloadSuapDocumentReview(result, documentTitle)}><Download /> Baixar análise</Button>
          <Button type="button" variant="outline" size="sm" className={styles.action} onClick={() => printSuapDocumentReview(result, documentTitle)}><Printer /> Imprimir</Button>
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </div>
      </div>
      <p className={`mt-3 text-sm leading-6 ${styles.summary}`}>{result.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['critical', 'high', 'medium', 'low'] as const).map((severity) => <div key={severity} className={`rounded-lg border px-3 py-2 ${styles.count}`}><div className={`text-xs capitalize ${styles.muted}`}>{severity === 'critical' ? 'Críticos' : severity === 'high' ? 'Altos' : severity === 'medium' ? 'Médios' : 'Baixos'}</div><div className={`mt-1 text-xl font-semibold ${styles.triggerTitle}`}>{result.counts[severity]}</div></div>)}</div>
    </section>
    <section className="space-y-3">
      <h2 className={`text-sm font-semibold uppercase tracking-[0.12em] ${styles.heading}`}>Achados e sugestões</h2>
      {result.findings.length ? <Accordion type="multiple" className="space-y-3">
        {result.findings.map((finding, index) => <FindingCard key={finding.id || index} finding={finding} index={index} theme={theme} />)}
      </Accordion> : <div className={`rounded-xl border p-5 text-sm ${styles.panel} ${styles.muted}`}>Nenhum achado foi retornado. Consulte as limitações abaixo antes de concluir a revisão.</div>}
    </section>
    <SourcesSection result={result} theme={theme} />
  </div>;
}

function FindingCard({ finding, index, theme }: { finding: SuapDocumentReviewFinding; index: number; theme: ReviewTheme }) {
  const styles = reviewThemeClasses[theme];
  const value = `finding-${index}`;
  return <AccordionItem value={value} className={`rounded-xl border px-5 ${styles.finding}`}>
    <AccordionTrigger className="gap-3 py-4 text-left hover:no-underline">
      <span className="min-w-0 flex-1"><span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-teal-500">{finding.category}</span><span className={`block font-semibold ${styles.triggerTitle}`}>{finding.title}</span><span className={`mt-1 block text-xs font-normal ${styles.triggerMeta}`}>{finding.page ? `Página ${finding.page} · ` : ''}Confiança {finding.confidence}</span></span>
      <SeverityBadge severity={finding.severity} />
    </AccordionTrigger>
    <AccordionContent className={styles.content}>
      {finding.excerpt && <blockquote className={`border-l-2 pl-3 text-sm italic ${styles.excerpt}`}>“{finding.excerpt}”</blockquote>}
      <div className="mt-4 grid gap-4 text-sm md:grid-cols-2"><div><strong className={styles.label}>Problema</strong><p className="mt-1 leading-6">{finding.problem}</p></div><div><strong className={styles.label}>Recomendação</strong><p className="mt-1 leading-6">{finding.recommendation}</p></div></div>
      {finding.suggestedText && <div className={`mt-4 rounded-lg border p-3 ${styles.suggested}`}><div className={`text-xs font-semibold uppercase tracking-[0.1em] ${styles.suggestedTitle}`}>Texto sugerido</div><p className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${styles.suggestedText}`}>{finding.suggestedText}</p></div>}
      {finding.legalBases.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{finding.legalBases.map((source) => <SourceLink key={`${source.url}-${source.reference}`} source={source} theme={theme} />)}</div>}
    </AccordionContent>
  </AccordionItem>;
}

function SourcesSection({ result, theme }: { result: SuapDocumentReviewResult; theme: ReviewTheme }) {
  const styles = reviewThemeClasses[theme];
  return <section className="grid gap-4 md:grid-cols-2"><div className={`rounded-xl border p-5 ${styles.panel}`}><div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${styles.label}`}><ExternalLink className="h-4 w-4 text-teal-500" /> Fontes consultadas</div><div className="space-y-2">{result.sources.length ? result.sources.map((source) => <SourceLink key={`${source.url}-${source.reference}`} source={source} block theme={theme} />) : <p className={`text-sm ${styles.muted}`}>Nenhuma fonte foi retornada com a análise.</p>}</div></div><div className={`rounded-xl border p-5 ${styles.panel}`}><div className={`mb-3 flex items-center gap-2 text-sm font-semibold ${styles.label}`}><Info className="h-4 w-4 text-teal-500" /> Limitações</div>{result.limitations.length ? <ul className={`list-disc space-y-2 pl-5 text-sm leading-6 ${styles.limitations}`}>{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p className={`text-sm ${styles.muted}`}>A análise não registrou limitações adicionais.</p>}</div></section>;
}

function SourceLink({ source, block = false, theme }: { source: { title: string; reference: string; url: string }; block?: boolean; theme: ReviewTheme }) {
  const styles = reviewThemeClasses[theme];
  return <a href={source.url} target="_blank" rel="noreferrer" className={`group ${block ? `flex items-start justify-between gap-3 rounded-lg border px-3 py-2 ${styles.sourceBorder}` : 'inline-flex'} text-sm ${styles.sourceText}`}><span>{source.title}{source.reference ? ` · ${source.reference}` : ''}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" /></a>;
}
function SeverityBadge({ severity }: { severity: SuapDocumentReviewFinding['severity'] }) {
  const labels = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' };
  const classes = { critical: 'border-red-800 bg-red-950/40 text-red-200', high: 'border-orange-800 bg-orange-950/40 text-orange-200', medium: 'border-amber-800 bg-amber-950/40 text-amber-200', low: 'border-sky-800 bg-sky-950/40 text-sky-200' };
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[severity]}`}>{labels[severity]}</span>;
}
function StatusIcon({ status }: { status: SuapDocumentReviewResult['status'] }) {
  if (status === 'no_major_finding') return <CheckCircle2 className="h-5 w-5 text-emerald-300" />;
  if (status === 'insufficient_evidence') return <Info className="h-5 w-5 text-amber-300" />;
  return <AlertTriangle className="h-5 w-5 text-orange-300" />;
}
