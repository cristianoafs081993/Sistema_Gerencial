import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, Info, Loader2, ShieldCheck, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfWorkerAsset from 'pdfjs-dist/build/pdf.worker.min.js?url';

import { Button } from '@/components/ui/button';
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
} from '@/services/suapDocumentReview';
import type { SuapDocumentReviewFinding, SuapDocumentReviewResult } from '@/lib/suapDocumentReview';
import { supabase } from '@/lib/supabase';

const bundledWorkerUrl = (pdfWorkerAsset as { default?: unknown }).default;
pdfjsLib.GlobalWorkerOptions.workerSrc = typeof bundledWorkerUrl === 'string'
  ? bundledWorkerUrl
  : new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', import.meta.url).href;

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
      setStatus('Autenticando a análise no SIAGES...');
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: context.extensionSession.accessToken,
        refresh_token: context.extensionSession.refreshToken,
      });
      if (sessionError || !data.session) throw sessionError ?? new Error('Não foi possível iniciar a sessão da análise.');
      supabase.auth.stopAutoRefresh();

      setStatus('Baixando o PDF do documento pelo SUAP...');
      const bytes = await requestDocumentPdf(context, controller.signal);
      if (!active) return;
      if (bytes.byteLength > SUAP_DOCUMENT_REVIEW_MAX_BYTES) throw new Error('O PDF excede o limite de 20 MB para análise.');
      const pageCount = await getPageCount(bytes);
      if (pageCount && pageCount > SUAP_DOCUMENT_REVIEW_MAX_PAGES) throw new Error('O PDF excede o limite de 200 páginas para análise.');

      setStatus('Consultando legislação e cadernos oficiais...');
      const review = await analyzeSuapDocument({
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
    <main className="min-h-screen bg-zinc-950 p-4 font-ui text-zinc-100 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">
              <FileSearch className="h-4 w-4" /> Revisão assistida por IA
            </div>
            <h1 className="truncate text-lg font-semibold text-white">{context?.documentTitle || documentLabel}</h1>
            <p className="mt-1 text-sm text-zinc-400">{context ? `${documentLabel} · ${context.processNumber || `processo SUAP ${context.suapId}`}` : status}</p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-white" onClick={() => postMessageToSuapParent(SUAP_EXTENSION_DOCUMENT_ANALYSIS_CLOSE_MESSAGE)} aria-label="Fechar análise">
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-5 sm:p-7">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-900/70 bg-amber-950/30 p-4 text-sm text-amber-100">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <p>Esta é uma revisão assistida, baseada em fontes oficiais consultadas no momento da análise. Ela não substitui a avaliação jurídica, técnica ou administrativa e não altera o documento do SUAP.</p>
          </div>

          {!result && !error && <LoadingState message={status} />}
          {error && <ErrorState message={error} onRetry={() => setRetryCount((current) => current + 1)} />}
          {result && <ReviewResult result={result} />}
        </div>
      </div>
    </main>
  );
}

function LoadingState({ message }: { message: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-center"><Loader2 className="h-8 w-8 animate-spin text-teal-300" /><p className="text-sm text-zinc-300">{message}</p><p className="max-w-md text-xs text-zinc-500">O documento é enviado apenas para esta análise e o resultado não é persistido nesta primeira versão.</p></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-red-900/60 bg-red-950/20 p-6 text-center"><AlertTriangle className="h-8 w-8 text-red-300" /><p className="max-w-lg text-sm text-red-100">{message}</p><Button onClick={onRetry} className="bg-teal-600 text-white hover:bg-teal-500">Tentar novamente</Button></div>;
}

function ReviewResult({ result }: { result: SuapDocumentReviewResult }) {
  const statusLabel = {
    critical: 'Pontos críticos encontrados',
    attention: 'Revisão requer atenção',
    no_major_finding: 'Nenhum ponto grave identificado',
    insufficient_evidence: 'Evidência insuficiente',
  }[result.status];
  return <div className="space-y-5">
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><StatusIcon status={result.status} /><h2 className="font-semibold text-white">{statusLabel}</h2></div>
        <span className="text-xs text-zinc-500">Consultado em {new Date(result.checkedAt).toLocaleString('pt-BR')}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{result.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{(['critical', 'high', 'medium', 'low'] as const).map((severity) => <div key={severity} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"><div className="text-xs capitalize text-zinc-500">{severity === 'critical' ? 'Críticos' : severity === 'high' ? 'Altos' : severity === 'medium' ? 'Médios' : 'Baixos'}</div><div className="mt-1 text-xl font-semibold text-white">{result.counts[severity]}</div></div>)}</div>
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-400">Achados e sugestões</h2>
      {result.findings.length ? result.findings.map((finding, index) => <FindingCard key={finding.id || index} finding={finding} />) : <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-400">Nenhum achado foi retornado. Consulte as limitações abaixo antes de concluir a revisão.</div>}
    </section>
    <SourcesSection result={result} />
  </div>;
}

function FindingCard({ finding }: { finding: SuapDocumentReviewFinding }) {
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-teal-300">{finding.category}</div><h3 className="font-semibold text-white">{finding.title}</h3></div><SeverityBadge severity={finding.severity} /></div>
    {finding.page && <p className="mt-3 text-xs text-zinc-500">Página {finding.page} · Confiança {finding.confidence}</p>}
    {finding.excerpt && <blockquote className="mt-3 border-l-2 border-zinc-700 pl-3 text-sm italic text-zinc-400">“{finding.excerpt}”</blockquote>}
    <div className="mt-4 grid gap-4 text-sm text-zinc-300 md:grid-cols-2"><div><strong className="text-zinc-100">Problema</strong><p className="mt-1 leading-6">{finding.problem}</p></div><div><strong className="text-zinc-100">Recomendação</strong><p className="mt-1 leading-6">{finding.recommendation}</p></div></div>
    {finding.suggestedText && <div className="mt-4 rounded-lg border border-teal-900/70 bg-teal-950/20 p-3"><div className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-300">Texto sugerido</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-teal-50">{finding.suggestedText}</p></div>}
    {finding.legalBases.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{finding.legalBases.map((source) => <SourceLink key={`${source.url}-${source.reference}`} source={source} />)}</div>}
  </article>;
}

function SourcesSection({ result }: { result: SuapDocumentReviewResult }) {
  return <section className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4 text-teal-300" /> Fontes consultadas</div><div className="space-y-2">{result.sources.length ? result.sources.map((source) => <SourceLink key={`${source.url}-${source.reference}`} source={source} block />) : <p className="text-sm text-zinc-500">Nenhuma fonte foi retornada com a análise.</p>}</div></div><div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Info className="h-4 w-4 text-teal-300" /> Limitações</div>{result.limitations.length ? <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-400">{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-zinc-500">A análise não registrou limitações adicionais.</p>}</div></section>;
}

function SourceLink({ source, block = false }: { source: { title: string; reference: string; url: string }; block?: boolean }) {
  return <a href={source.url} target="_blank" rel="noreferrer" className={`group ${block ? 'flex items-start justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2' : 'inline-flex'} text-sm text-teal-300 hover:text-teal-200`}><span>{source.title}{source.reference ? ` · ${source.reference}` : ''}</span><ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70 group-hover:opacity-100" /></a>;
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
