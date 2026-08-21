import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  FileCheck2,
  FileText,
  GitBranch,
  Info,
  Layers3,
  Loader2,
  Map,
  Scale,
  UserRound,
  XCircle,
} from 'lucide-react';

import { ProcessMappingCanvas } from '@/components/suap/ProcessMappingCanvas';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { buildSuapProcessFlowSummary } from '@/lib/suapProcessFlow';
import { processMappingsService } from '@/services/processMappings';
import { suapProcessosService } from '@/services/suapProcessos';
import type { ProcessMappingNode, ProcessMappingRecord, SuapProcessFlowStep } from '@/types/processMapping';
import type { SuapProcesso } from '@/types';

function statusCopy(status: SuapProcessFlowStep['status']) {
  if (status === 'completed') return { label: 'Concluída', icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  if (status === 'current') return { label: 'Etapa atual', icon: Map, classes: 'border-blue-200 bg-blue-50 text-blue-800' };
  if (status === 'next') return { label: 'Próxima etapa', icon: ChevronRight, classes: 'border-amber-200 bg-amber-50 text-amber-800' };
  if (status === 'not_confirmed') return { label: 'Não confirmada', icon: Info, classes: 'border-violet-200 bg-violet-50 text-violet-800' };
  return { label: 'Pendente', icon: CircleDashed, classes: 'border-slate-200 bg-slate-50 text-slate-500' };
}

function NodeDetails({ node }: { node: ProcessMappingNode }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10px] font-black text-emerald-700">{node.code}</span><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Detalhes da etapa</span></div>
        <h3 className="text-lg font-black leading-tight text-slate-900">{node.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{node.description}</p>
      </div>
      <div className="grid gap-3 text-sm">
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Responsável</p><p className="mt-0.5 font-semibold text-slate-700">{node.responsible}</p></div></div>
        {node.slaDays && <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Prazo de referência</p><p className="mt-0.5 font-semibold text-slate-700">{node.slaDays} dias úteis</p></div></div>}
        {node.legalBasis && <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"><Scale className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Base normativa</p><p className="mt-0.5 font-semibold text-slate-700">{node.legalBasis}</p></div></div>}
      </div>
      {(node.inputDocuments?.length || node.outputDocuments?.length) ? <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Entradas</p><ul className="space-y-1.5 text-xs text-slate-600">{node.inputDocuments?.map((item) => <li key={item} className="flex gap-2"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{item}</li>)}</ul></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Saídas</p><ul className="space-y-1.5 text-xs text-slate-600">{node.outputDocuments?.map((item) => <li key={item} className="flex gap-2"><FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{item}</li>)}</ul></div></div> : null}
      {(node.systemUrl || node.templateUrl) && <div className="grid gap-2 sm:grid-cols-2"><a href={node.systemUrl || '#'} target="_blank" rel="noreferrer" className={cn('flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5', node.systemUrl ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'pointer-events-none border-slate-200 bg-slate-50 text-slate-400')}><span>{node.systemName || 'Sistema oficial'}</span><ArrowUpRight className="h-3.5 w-3.5" /></a><a href={node.templateUrl || '#'} target="_blank" rel="noreferrer" className={cn('flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5', node.templateUrl ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'pointer-events-none border-slate-200 bg-slate-50 text-slate-400')}><span>{node.templateName || 'Modelo vinculado'}</span><ArrowUpRight className="h-3.5 w-3.5" /></a></div>}
    </div>
  );
}

function ExecutionGuide({ mapping }: { mapping: ProcessMappingRecord }) {
  const tasks = mapping.nodes.filter((node) => ['task', 'subprocess', 'document'].includes(node.type)).sort((left, right) => left.position.x - right.position.x);
  return <div className="space-y-3">{tasks.map((node, index) => <div key={node.id} className="group flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200 hover:shadow-sm"><div className="flex w-8 shrink-0 flex-col items-center"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 font-mono text-xs font-black text-white">{node.code || index + 1}</span>{index < tasks.length - 1 && <span className="mt-2 h-full w-px bg-slate-200" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">{node.title}</h3><p className="mt-1 text-xs font-semibold text-slate-400">{node.responsible}{node.slaDays ? ` · ${node.slaDays} dias úteis` : ''}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Roteiro padrão</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{node.description}</p>{node.checklist?.length ? <div className="mt-3 grid gap-1.5 sm:grid-cols-2">{node.checklist.map((item) => <div key={item.id} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600"><CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{item.text}</div>)}</div> : null}</div></div>)}</div>;
}

export default function SuapProcessMappingPage() {
  const { mappingId } = useParams<{ mappingId: string }>();
  const [searchParams] = useSearchParams();
  const suapId = searchParams.get('suapId') || undefined;
  const [mapping, setMapping] = useState<ProcessMappingRecord | null>(null);
  const [process, setProcess] = useState<SuapProcesso | null>(null);
  const [selectedNode, setSelectedNode] = useState<ProcessMappingNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([processMappingsService.getById(mappingId), suapId ? suapProcessosService.getBySuapId(suapId) : Promise.resolve(null)])
      .then(([nextMapping, nextProcess]) => { if (!active) return; setMapping(nextMapping); setProcess(nextProcess); setError(nextMapping ? null : 'Mapeamento não encontrado.'); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o mapeamento.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mappingId, suapId]);

  const flow = useMemo(() => mapping ? buildSuapProcessFlowSummary(mapping, undefined, { suapId, processCompleted: Boolean(process?.dadosCompletos?.workflow?.concluido) }) : undefined, [mapping, process, suapId]);
  const selectedStatus = selectedNode && flow?.steps.find((step) => step.nodeId === selectedNode.id)?.status;

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] font-ui"><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" />Carregando mapeamento...</div></main>;
  if (error || !mapping) return <main className="flex min-h-screen items-center justify-center bg-[#f5f8fc] p-6 font-ui"><div className="max-w-md rounded-2xl border border-red-200 bg-white p-7 text-center shadow-sm"><XCircle className="mx-auto h-10 w-10 text-red-500" /><h1 className="mt-4 text-xl font-black text-slate-900">Mapa indisponível</h1><p className="mt-2 text-sm text-slate-500">{error || 'O mapeamento solicitado não está publicado.'}</p><Button asChild className="mt-5"><Link to="/suap"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao SUAP</Link></Button></div></main>;

  return <main className="min-h-screen bg-[#f5f8fc] font-ui text-slate-900">
    <header className="relative overflow-hidden bg-[#0b1f33] text-white"><div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.12)_1px,transparent_1px)] [background-size:32px_32px]" /><div className="relative mx-auto max-w-[1500px] px-5 py-8 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-5"><div><Link to="/suap" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-emerald-300 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar para o painel SUAP</Link><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/30"><GitBranch className="h-6 w-6 text-emerald-300" /></span><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">Mapeamento BPMN</span><span className="font-mono text-[10px] text-slate-400">{mapping.code} · v{mapping.version}</span></div><h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight sm:text-4xl">{mapping.title}</h1></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{mapping.description}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"><a href={process?.url || 'https://suap.ifrn.edu.br/'} target="_blank" rel="noreferrer"><ArrowUpRight className="mr-2 h-4 w-4" />Abrir no SUAP</a></Button><Button asChild className="bg-emerald-400 text-[#072033] hover:bg-emerald-300"><a href="#guia"><BookOpen className="mr-2 h-4 w-4" />Ver guia de execução</a></Button></div></div><div className="mt-7 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoria</p><p className="mt-1 text-sm font-bold text-white">{mapping.category}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsável</p><p className="mt-1 text-sm font-bold text-white">{mapping.owner || 'Não informado'}</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etapas</p><p className="mt-1 text-sm font-bold text-white">{mapping.nodes.filter((node) => node.type === 'task').length} atividades</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Atualização</p><p className="mt-1 text-sm font-bold text-white">{mapping.updatedAt ? new Date(mapping.updatedAt).toLocaleDateString('pt-BR') : 'Publicada'}</p></div></div></div></header>

    <div className="mx-auto max-w-[1500px] space-y-7 px-5 py-7 sm:px-8"><section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><div><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Visão completa do processo</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Mapa operacional</h2></div><div className="hidden items-center gap-3 text-[10px] font-bold text-slate-500 md:flex"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Etapa atual</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Pendente</span></div></div><ProcessMappingCanvas mapping={mapping} flow={flow} selectedNodeId={selectedNode?.id} onSelectNode={setSelectedNode} /></div><aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Painel de contexto</p><h2 className="mt-1 font-black text-slate-900">{selectedNode ? 'Etapa selecionada' : 'Como ler o mapa'}</h2></div>{selectedNode && <button type="button" onClick={() => setSelectedNode(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar detalhes"><XCircle className="h-4 w-4" /></button>}</div>{selectedNode ? <><NodeDetails node={selectedNode} />{selectedStatus && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Status de acompanhamento: {statusCopy(selectedStatus).label}</div>}</> : <div className="space-y-4 text-sm leading-6 text-slate-600"><p>As faixas horizontais representam as unidades envolvidas. Os cartões são atividades e o losango é uma decisão do fluxo.</p><div className="space-y-2.5"><div className="flex gap-3"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" /><span><strong className="text-slate-800">Faixa:</strong> unidade responsável pela etapa.</span></div><div className="flex gap-3"><span className="mt-1 h-3 w-3 shrink-0 rounded bg-emerald-500" /><span><strong className="text-slate-800">Cartão:</strong> tarefa com entradas, saídas, prazo e links.</span></div><div className="flex gap-3"><span className="mt-1 h-3 w-3 shrink-0 rotate-45 bg-violet-500" /><span><strong className="text-slate-800">Decisão:</strong> condição que pode mudar o caminho.</span></div></div><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><Info className="mb-1 h-4 w-4" />A extensão usa este mesmo mapa para comparar os trâmites identificados no processo aberto no SUAP.</div></div>}</aside></section>

      {process && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Processo associado</p><p className="mt-1 font-mono text-sm font-bold text-slate-800">{process.numProcesso || process.suapId}</p><p className="mt-1 text-xs text-slate-500">{process.beneficiario || process.assunto || 'Processo aberto pela extensão do SUAP'}</p></div><div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{process.dadosCompletos?.workflow?.concluido ? 'Processo concluído' : 'Acompanhamento ativo'}</div></div></section>}

      <section id="guia" className="scroll-mt-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Roteiro operacional</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Guia de execução</h2><p className="mt-1 text-sm text-slate-500">A mesma lógica do mapeador de processos, agora disponível como referência integrada ao processo.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"><Layers3 className="h-4 w-4 text-emerald-600" />{mapping.lanes.length} raias · {mapping.edges.length} conexões</div></div><ExecutionGuide mapping={mapping} /></section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-400"><span className="flex items-center gap-2"><GitBranch className="h-4 w-4" />Fonte publicada no SIAGES · versão {mapping.version}</span><span className="flex items-center gap-2"><Info className="h-4 w-4" />A indicação da etapa é uma leitura assistida, não substitui o registro oficial do SUAP.</span></footer>
    </div>
  </main>;
}
