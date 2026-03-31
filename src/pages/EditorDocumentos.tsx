import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  ChevronRight,
  CheckCircle2,
  Save,
  FileCheck,
  ShieldCheck,
  Plus,
  ArrowRight,
  FileText,
  ExternalLink,
  X,
  AlertTriangle,
  Scale,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import RichTextEditor from '@/components/Editor/RichTextEditor';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ── Types ──
type SectionStatus = 'pending' | 'writing' | 'done';

interface DocumentSection {
  id: number;
  name: string;
  description: string;
  content: string;
  status: SectionStatus;
}

interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  sections: DocumentSection[];
}

type FonteUsada = {
  titulo: string;
  referencia: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Erro desconhecido';
};

// ── Conformidade Layers ──
const CONFORMIDADE_LAYERS = [
  {
    id: 0,
    name: 'Alertas Operacionais',
    badgeType: 'warn' as const,
    badgeText: '2 alertas',
    findings: [
      { icon: '⚠️', ok: false, text: 'Regime de execução (equipe residente vs. demanda) não definido. Contratos sem isso geraram disputas em 3 dos últimos 5 casos.', ref: 'Histórico ContratoIFRN 2019–2024' },
      { icon: '⚠️', ok: false, text: 'Custo de materiais de reposição não contemplado na estimativa. Risco de pedido de reequilíbrio nos primeiros meses.', ref: 'Contratos nº 11/2021 e 03/2023' },
    ],
  },
  {
    id: 1,
    name: 'Lei 14.133/2021 e Decretos',
    badgeType: 'warn' as const,
    badgeText: '1 divergência',
    findings: [
      { icon: '✅', ok: true, text: 'ETP contém os elementos mínimos exigidos pelo art. 18 da Lei 14.133/2021.', ref: 'Lei 14.133/2021 · Art. 18' },
      { icon: '✅', ok: true, text: 'Referência ao SINAPI está em conformidade com o Decreto nº 7.983/2013.', ref: 'Decreto nº 7.983/2013 · Art. 3º' },
      { icon: '⚠️', ok: false, text: 'Seção de fiscalização não menciona distinção entre fiscal técnico e administrativo.', ref: 'Lei 14.133/2021 · Art. 117, §1º' },
    ],
  },
  {
    id: 2,
    name: 'Normativos AGU / CPIFES',
    badgeType: 'ok' as const,
    badgeText: 'Conforme',
    findings: [
      { icon: '✅', ok: true, text: 'Exigência de atestado técnico de profissional alinhada com a Súmula TCU 263/2011.', ref: 'PF/IFRN · Nota nº 04/2022' },
      { icon: '✅', ok: true, text: 'Estrutura do ETP compatível com modelo padronizado pela CPIFES para IFES.', ref: 'CPIFES · Modelo ETP Revisão 2023' },
    ],
  },
  {
    id: 3,
    name: 'Normativos Internos IFRN',
    badgeType: 'err' as const,
    badgeText: '1 pendência',
    findings: [
      { icon: '✅', ok: true, text: 'Documento identifica a unidade demandante com servidor nominalmente responsável.', ref: 'Resolução CONSUP nº 38/2022 · Art. 8º' },
      { icon: '🔴', ok: false, text: 'Ausência de referência à lista de verificação de fiscalização obrigatória para contratos de manutenção.', ref: 'IN PROEN/IFRN nº 02/2023 · Art. 5º' },
    ],
  },
];

// ── Templates ──
const TEMPLATES: DocumentTemplate[] = [
  {
    id: 'branco', type: '📝 Livre', name: 'Documento em Branco',
    description: 'Comece do zero, sem estrutura pré-definida. Ideal para minutas, rascunhos e documentos livres.',
    sections: [
      { id: 1, name: 'Conteúdo', description: 'Escreva livremente o conteúdo do documento.', content: '', status: 'writing' },
    ],
  },
  {
    id: 'etp', type: '📋 ETP', name: 'Estudo Técnico Preliminar',
    description: 'Essencial para o planejamento da contratação, levantando requisitos e justificando a solução escolhida.',
    sections: [
      { id: 1, name: 'Unidade Demandante', description: 'Identifique o setor responsável pela necessidade.', content: '<p>A demanda parte da Coordenação de Infraestrutura do Campus Currais Novos, vinculada à Diretoria de Administração e Planejamento.</p>', status: 'done' },
      { id: 2, name: 'Descrição do Objeto', description: 'Descreva detalhadamente o objeto da contratação e sua finalidade.', content: '', status: 'writing' },
      { id: 3, name: 'Justificativa', description: 'Apresente a necessidade administrativa com dados quantitativos.', content: '', status: 'pending' },
      { id: 4, name: 'Requisitos Técnicos', description: 'Especifique as qualificações mínimas exigidas da contratada.', content: '', status: 'pending' },
      { id: 5, name: 'Estimativa de Valor', description: 'Base no SINAPI, painel de preços ou cotações de mercado.', content: '', status: 'pending' },
    ],
  },
  {
    id: 'tr', type: '📄 TR', name: 'Termo de Referência',
    description: 'Norteia a licitação com prazos, obrigações, penalidades e modelo de gestão do contrato.',
    sections: [
      { id: 1, name: 'Objeto e Abrangência', description: 'Detalhamento técnico preciso do que será executado.', content: '', status: 'writing' },
      { id: 2, name: 'Vigência e Prazos', description: 'Início, duração e possibilidade de prorrogação.', content: '', status: 'pending' },
      { id: 3, name: 'Obrigações da Contratada', description: 'Deveres técnicos, administrativos e ambientais.', content: '', status: 'pending' },
      { id: 4, name: 'Modelo de Gestão', description: 'Fiscalização, indicadores e SLAs de atendimento.', content: '', status: 'pending' },
    ],
  },
  {
    id: 'despacho', type: '📝 Despacho', name: 'Autorização de Despesa',
    description: 'Ato administrativo que inicia oficialmente o processo de compra ou contratação pública.',
    sections: [
      { id: 1, name: 'Considerações Iniciais', description: 'Contextualização do processo e fundamentação legal.', content: '', status: 'writing' },
      { id: 2, name: 'Análise Orçamentária', description: 'Verificação de saldo no PTRES/GND disponível.', content: '', status: 'pending' },
      { id: 3, name: 'Decisão', description: 'Autorização formal do Ordenador de Despesas.', content: '', status: 'pending' },
    ],
  },
];

// ── Badge color helper ──
const badgeColors = {
  ok:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  err:  'bg-red-100 text-red-600 border-red-200',
};

// ── Conformidade Layer Item ──
function ConformLayer({ layer, defaultOpen }: { layer: typeof CONFORMIDADE_LAYERS[0]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? (layer.badgeType !== 'ok'));
  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-muted-foreground shrink-0">Camada {layer.id}</span>
          <span className="text-[13px] font-semibold truncate text-foreground">{layer.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border', badgeColors[layer.badgeType])}>
            {layer.badgeText}
          </span>
          <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/10">
          {layer.findings.map((f, i) => (
            <div key={i} className="flex items-start gap-3 pt-3">
              <span className="text-base leading-none mt-0.5 shrink-0">{f.icon}</span>
              <div className="space-y-0.5">
                <p className="text-[12px] leading-relaxed text-foreground">{f.text}</p>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{f.ref}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════
export default function EditorDocumentos() {
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number>(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [verifyDone, setVerifyDone] = useState(false);
  const [aiResult, setAiResult] = useState<{ analise: string, fontes_usadas: FonteUsada[] } | null>(null);

  const handleStartDocument = (tpl: DocumentTemplate) => {
    const firstWriting = tpl.sections.find(s => s.status === 'writing') ?? tpl.sections[0];
    setSelectedTemplate(tpl);
    setActiveSectionId(firstWriting.id);
    setShowAIPanel(false);
    setVerifyDone(false);
  };

  const handleUpdateContent = (content: string) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      sections: selectedTemplate.sections.map(s =>
        s.id === activeSectionId ? { ...s, content, status: 'writing' } : s
      ),
    });
  };

  const handleCompleteSection = () => {
    if (!selectedTemplate) return;
    const updated = selectedTemplate.sections.map(s =>
      s.id === activeSectionId ? { ...s, status: 'done' as SectionStatus } : s
    );
    const nextSection = updated.find(s => s.status !== 'done' && s.id !== activeSectionId);
    setSelectedTemplate({ ...selectedTemplate, sections: updated });
    if (nextSection) setActiveSectionId(nextSection.id);
    toast.success('Seção concluída!');
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setShowAIPanel(true);
    setVerifyDone(false);
    setAiResult(null);

    try {
      // Coleta todo o texto do documento combinando as seções (removendo HTML básico)
      const textoCompleto = selectedTemplate?.sections
        .map(s => s.name + '\n' + s.content.replace(/<[^>]*>?/gm, ''))
        .join('\n\n') || '';

      const { data, error } = await supabase.functions.invoke('verificar-conformidade', {
        body: { texto: textoCompleto }
      });

      if (error) throw error;
      setAiResult(data);

    } catch (err: unknown) {
      console.error(err);
      toast.error(`Erro na verificação pela IA: ${getErrorMessage(err)}`);
    } finally {
      setIsVerifying(false);
      setVerifyDone(true);
    }
  };

  const activeSection = selectedTemplate?.sections.find(s => s.id === activeSectionId);
  const completedCount = selectedTemplate?.sections.filter(s => s.status === 'done').length ?? 0;
  const totalSections = selectedTemplate?.sections.length ?? 0;
  const progress = totalSections > 0 ? (completedCount / totalSections) * 100 : 0;

  // ── Template Selection ──
  if (!selectedTemplate) {
    return (
      <div className="flex flex-col gap-8 max-w-[1000px] mx-auto py-8">
        <div className="space-y-2">
          <Badge className="w-fit bg-primary/10 text-primary border-none text-[10px] uppercase font-black tracking-widest px-3 py-1">
            Novo Documento
          </Badge>
          <h1 className="text-3xl font-black tracking-tight">O que vamos redigir hoje?</h1>
          <p className="text-text-muted max-w-lg">
            Escolha um modelo inteligente. A IA verificará a conformidade legal ao longo da redação.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((tpl) => (
            <Card
              key={tpl.id}
              className="group p-6 cursor-pointer hover:border-primary/40 hover:shadow-lifted transition-all duration-200 bg-surface-card relative overflow-hidden"
              onClick={() => handleStartDocument(tpl)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tpl.type}</span>
                  <div className="p-1.5 rounded-lg bg-muted/30 text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{tpl.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{tpl.description}</p>
                <div className="flex items-center gap-3 pt-2 border-t text-[10px] font-bold text-muted-foreground/50 uppercase">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {tpl.sections.length} seções</span>
                  <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> IA Ativa</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex items-center gap-4 p-5 rounded-xl bg-primary/5 border border-primary/10">
          <div className="p-2.5 bg-white rounded-lg shadow-sm text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Conformidade Garantida</h4>
            <p className="text-xs text-muted-foreground">Modelos atualizados conforme a <strong>Lei 14.133/2021</strong> e normativos internos IFRN.</p>
          </div>
          <Button variant="ghost" className="ml-auto gap-1 text-xs font-bold text-primary shrink-0">
            Ver Normativos <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Editor ──
  return (
    <div className="-m-4 lg:-m-8 -mx-4 lg:-mx-8 w-[calc(100%+2rem)] lg:w-[calc(100%+4rem)] flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-white">

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Sidebar de Seções (icon strip, 48px) — hidden for single-section templates ── */}
        {totalSections > 1 && (
          <aside className="w-12 border-r bg-slate-50 flex flex-col items-center py-3 gap-1 shrink-0 overflow-y-auto">
            {selectedTemplate.sections.map((section) => {
              const isActive = section.id === activeSectionId;
              const isDone = section.status === 'done';
              return (
                <Tooltip key={section.id} delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveSectionId(section.id)}
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all text-xs font-bold shrink-0',
                        isActive && 'bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-2 ring-primary/20',
                        !isActive && isDone && 'bg-emerald-500 text-white',
                        !isActive && !isDone && 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
                      )}
                    >
                      {isDone && !isActive ? <CheckCircle2 className="w-4 h-4" /> : section.id}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-semibold">{section.name}</TooltipContent>
                </Tooltip>
              );
            })}

            {/* Progress bar */}
            <div className="mt-auto flex flex-col items-center gap-1 w-full px-2 pb-1">
              <div className="w-1.5 h-16 bg-muted rounded-full overflow-hidden rotate-180">
                <div
                  className="w-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ height: `${progress}%` }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* ── Editor Area (full width, toolbar = unified bar) ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {/* Portal: inject action buttons into Layout header */}
          {typeof document !== 'undefined' && document.getElementById('header-actions') && createPortal(
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight text-emerald-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Autosave
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-bold bg-white">
                <Save className="w-3.5 h-3.5" /> Salvar
              </Button>
              <Button
                size="sm"
                disabled={isVerifying}
                onClick={handleVerify}
                className="gap-1.5 h-8 text-xs font-bold bg-primary hover:bg-primary/90 shadow-sm"
              >
                {isVerifying
                  ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  : <ShieldCheck className="w-3.5 h-3.5" />
                }
                Verificar Conformidade
              </Button>
            </>,
            document.getElementById('header-actions')!
          )}

          {/* Unified toolbar — sticky at top, full width */}
          <RichTextEditor
            content={activeSection.content}
            onChange={handleUpdateContent}
            placeholder={totalSections === 1 ? 'Comece a escrever seu documento...' : `Comece a escrever aqui sobre "${activeSection.name}"...`}
            toolbarLeft={
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10 text-muted-foreground" onClick={() => setSelectedTemplate(null)}>
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </Button>
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary px-2 py-0.5">
                  {selectedTemplate.type}
                </Badge>
                <span className="font-semibold text-xs truncate max-w-[160px]">{selectedTemplate.name}</span>
              </div>
            }
          />
        </main>

        {/* ── AI Compliance Drawer (slide-over) ── */}
        <AnimatePresence>
          {showAIPanel && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px]"
                onClick={() => setShowAIPanel(false)}
              />

              {/* Panel */}
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                className="absolute right-0 top-0 bottom-0 z-30 w-[540px] flex flex-col bg-white border-l shadow-2xl"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-900 text-white">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold uppercase tracking-wide">Verificação de Conformidade</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10" onClick={() => setShowAIPanel(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-5">
                    {/* Loading state */}
                    {isVerifying && (
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground">Analisando o documento em 4 camadas...</p>
                        {['Alertas Operacionais', 'Lei 14.133/2021', 'Normativos AGU/CPIFES', 'Normativos Internos'].map((label, i) => (
                          <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-5 h-5 rounded-full bg-muted" />
                            <div className="flex-1 h-2 bg-muted rounded-full" style={{ opacity: 1 - i * 0.2 }} />
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Results */}
                    {verifyDone && !isVerifying && aiResult && (
                      <div className="space-y-6">
                        {/* Resumo da Análise (Markdown) */}
                        <div className="prose prose-sm max-w-none text-foreground prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-p:leading-relaxed prose-li:marker:text-primary">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiResult.analise}
                          </ReactMarkdown>
                        </div>
                    
                        {/* Normativos Referenciados */}
                        {aiResult.fontes_usadas && aiResult.fontes_usadas.length > 0 && (
                          <div className="space-y-3 pt-4 border-t">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" /> Normativos Referenciados
                            </p>
                            {/* Grouping sources by document title to avoid duplicate cards */}
                            {Object.entries(
                              aiResult.fontes_usadas.reduce((acc: Record<string, FonteUsada[]>, f: FonteUsada) => {
                                if (!acc[f.titulo]) acc[f.titulo] = [];
                                // Evita duplicar a mesma referência no mesmo documento
                                if (!acc[f.titulo].find((item) => item.referencia === f.referencia)) {
                                  acc[f.titulo].push(f);
                                }
                                return acc;
                              }, {})
                            ).map(([titulo, refs]: [string, FonteUsada[]], i) => (
                              <div key={i} className="p-3 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl border border-border/80 shadow-sm relative overflow-hidden group">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                                <p className="text-xs font-semibold text-foreground leading-snug">{titulo}</p>
                                <div className="mt-2 space-y-1.5">
                                  {refs.map((ref, j) => (
                                    <p key={j} className="text-[11px] text-muted-foreground leading-relaxed break-words flex gap-1.5 items-start">
                                      <span className="text-primary/40 mt-[3px] text-[8px]">●</span>
                                      <span>Trecho: <strong className="font-semibold text-foreground/80">{ref.referencia}</strong></span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Panel Footer */}
                <div className="p-4 border-t">
                  <Button variant="outline" className="w-full text-xs font-bold gap-2" onClick={() => setShowAIPanel(false)}>
                    <FileCheck className="w-3.5 h-3.5" /> Fechar Análise
                  </Button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
