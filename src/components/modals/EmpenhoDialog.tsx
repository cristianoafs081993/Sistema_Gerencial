import { RecordDetailsPage } from '@/components/records/RecordDetailsPage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Empenho, Atividade, DIMENSOES, COMPONENTES_POR_DIMENSAO } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, History, DollarSign, Receipt, CheckCircle2, Landmark, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { contratosApiService, type ContratoApiPublicLiquidacaoRow } from '@/services/contratosApi';
import { transparenciaService, type PortalTransparenciaItemEmpenho } from '@/services/transparencia';
import { format } from 'date-fns';
import {
  getRapBaseVigente,
  getRapLiquidadoNoAno,
  getRapReferenceYear,
  getRapSaldoAtual,
  isRapReinscrito,
} from '@/utils/rapMetrics';

interface EmpenhoDialogProps {
  presentation?: 'dialog' | 'page';
  readOnly?: boolean;
  backLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empenho: Empenho | null;
  atividades: Atividade[];
  onSave: (id: string, data: Partial<Empenho>) => void;
}

const getOperacaoLabel = (operacao: string) =>
  operacao
    .replace('INCLUSAO', 'Inclusão')
    .replace('REFORCO', 'Reforço')
    .replace('ANULACAO', 'Anulação');

const formatDateCell = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'dd/MM/yyyy');
};

const buildFormData = (empenho: Empenho | null): Partial<Empenho> => {
  if (!empenho) return {};

  return {
    ...empenho,
    dimensao: empenho.dimensao || '',
    planoInterno: empenho.planoInterno || '',
    processo: empenho.processo || '',
    origemRecurso: empenho.origemRecurso || '',
    componenteFuncional: empenho.componenteFuncional || '',
  };
};

export function EmpenhoDialog({ open, onOpenChange, empenho, atividades, onSave, presentation = 'dialog', readOnly = false, backLabel = 'Voltar aos empenhos' }: EmpenhoDialogProps) {
  const [detailTab, setDetailTab] = useState('resumo');
  const [isEditing, setIsEditing] = useState(false);
  const pageMode = presentation === 'page';
  const Title = pageMode ? 'h1' : DialogTitle;
  const Header = pageMode ? 'div' : DialogHeader;
  const Footer = pageMode ? 'div' : DialogFooter;
  const Body = pageMode ? 'div' : ScrollArea;
  useEffect(() => { if (open) { setDetailTab('resumo'); setIsEditing(false); } }, [open, empenho?.id]);
  const [formData, setFormData] = useState<Partial<Empenho>>(() => buildFormData(empenho));
  const showLegacyLiquidacoesApiSection = Boolean(import.meta.env.VITE_SHOW_LEGACY_LIQUIDACOES_API_SECTION);

  useEffect(() => {
    if (open && empenho) {
      setFormData(buildFormData(empenho));
    }
  }, [open, empenho]);

  const dimensoesDisponiveis = useMemo(() => DIMENSOES.map(d => d.nome), []);

  const origensDisponiveis = useMemo(() => {
    return [...new Set(
      atividades
        .filter(a => !formData.dimensao || a.dimensao === formData.dimensao)
        .map(a => a.origemRecurso)
        .filter(Boolean)
    )];
  }, [atividades, formData.dimensao]);

  const { data: liquidacoesApi = [], isLoading: isLoadingLiquidacoesApi } = useQuery({
    queryKey: ['liquidacoes-api-contratos-empenho', empenho?.numero],
    queryFn: () =>
      empenho?.numero
        ? contratosApiService.getLiquidacoesPublicasPorEmpenho(empenho.numero)
        : Promise.resolve([] as ContratoApiPublicLiquidacaoRow[]),
    enabled: open && !!empenho?.numero,
    retry: false,
    staleTime: 60 * 1000,
  });

  const {
    data: itensPortal = [],
    isError: isItensPortalError,
    isLoading: isLoadingItensPortal,
  } = useQuery({
    queryKey: ['portal-transparencia-itens-empenho', empenho?.numero],
    queryFn: () =>
      empenho?.numero
        ? transparenciaService.getItensEmpenhoPortal(empenho.numero)
        : Promise.resolve([] as PortalTransparenciaItemEmpenho[]),
    enabled: open && !!empenho?.numero,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (!empenho) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(empenho.id, formData);
    onOpenChange(false);
  };

  const isRap = empenho.tipo === 'rap';
  const rapReferenceYear = getRapReferenceYear([empenho]);
  const rapBaseLabel = isRapReinscrito(empenho, rapReferenceYear) ? 'Valor Reinscrito' : 'Valor Inscrito';
  const valorEmpenhadoResumo = isRap ? getRapBaseVigente(empenho, rapReferenceYear) : empenho.valor;
  const valorLiquidadoResumo = isRap
    ? getRapLiquidadoNoAno(empenho)
    : empenho.valorLiquidadoOficial ?? empenho.valorLiquidado ?? 0;
  const valorPagoResumo = isRap
    ? getRapSaldoAtual(empenho, rapReferenceYear)
    : empenho.valorPagoOficial ?? empenho.valorPago ?? 0;
  const valorEmpenhadoLabel = isRap ? rapBaseLabel : 'Valor Empenhado';
  const valorLiquidadoLabel = isRap ? 'Liquidado no Ano' : 'Valor Liquidado';
  const valorPagoLabel = isRap ? 'Saldo Atual' : 'Valor Pago';

  const content = (<>
        <Header className="shrink-0 p-6 bg-muted/40 border-b border-border space-y-1 relative">
          <div className="flex items-center gap-3">
            <div className={pageMode ? "p-2 bg-primary/10 rounded-lg text-primary" : "p-2 bg-purple-500/15 rounded-lg text-purple-600 dark:text-purple-400"}>
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className={pageMode ? "text-xs font-bold uppercase tracking-[0.2em] text-primary" : "text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600/70 dark:text-purple-400/80"}>Detalhes do Empenho</span>
              <Title className={pageMode ? "text-xl font-semibold tracking-tight text-foreground" : "text-xl font-black tracking-tight text-foreground"}>
                {empenho.numero}
              </Title>
            </div>
          </div>
          <div className={pageMode ? "absolute top-0 left-0 w-full h-1 bg-primary/10" : "absolute top-0 left-0 w-full h-1 bg-purple-500"} />
        </Header>

        <Body className="min-h-0 flex-1 bg-card">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="p-6 space-y-6">
            {pageMode && <>
              <TabsList aria-label="Detalhes do empenho" className="h-auto flex-wrap">
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="movimentos">Itens e histórico</TabsTrigger>
              </TabsList>
            </>}
            <TabsContent value="resumo" forceMount hidden={pageMode && detailTab !== 'resumo'} className="space-y-6">
            {/* Resumo de Valores */}
            <div className={`grid grid-cols-1 gap-3 ${pageMode && !isRap ? 'sm:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
              <Card className="border border-border/60 shadow-sm bg-muted/30 overflow-hidden group">
                <div className="h-1 bg-blue-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wider" : "text-[9px] font-bold text-muted-foreground uppercase tracking-wider"}>{valorEmpenhadoLabel}</span>
                    <DollarSign className={pageMode ? "w-3 h-3 text-primary" : "w-3 h-3 text-blue-500"} />
                  </div>
                  <p className={pageMode ? "text-lg font-semibold text-foreground tracking-tight" : "text-lg font-black text-foreground tracking-tighter"}>
                    {formatCurrency(valorEmpenhadoResumo)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-border/60 shadow-sm bg-muted/30 overflow-hidden group">
                <div className="h-1 bg-amber-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wider" : "text-[9px] font-bold text-muted-foreground uppercase tracking-wider"}>{valorLiquidadoLabel}</span>
                    <Receipt className="w-3 h-3 text-amber-500" />
                  </div>
                  <p className={pageMode ? "text-lg font-semibold text-foreground tracking-tight" : "text-lg font-black text-foreground tracking-tighter"}>
                    {formatCurrency(valorLiquidadoResumo)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-emerald-500/30 shadow-sm bg-emerald-500/10 overflow-hidden group">
                <div className="h-1 bg-emerald-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className={pageMode ? "text-xs font-bold text-primary uppercase tracking-wider" : "text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"}>{valorPagoLabel}</span>
                    <CheckCircle2 className={pageMode ? "w-3 h-3 text-primary" : "w-3 h-3 text-emerald-500"} />
                  </div>
                  <p className={pageMode ? "text-lg font-semibold text-primary tracking-tight" : "text-lg font-black text-emerald-700 dark:text-emerald-300 tracking-tighter"}>
                    {formatCurrency(valorPagoResumo)}
                  </p>
                </CardContent>
              </Card>
              {pageMode && !isRap && <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-muted-foreground">Saldo a liquidar</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">{formatCurrency(valorEmpenhadoResumo - valorLiquidadoResumo)}</p>
                </CardContent>
              </Card>}
            </div>

            {/* Dados Básicos */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col gap-3">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                      <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1" : "text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1"}>Data de Emissão</span>
                      <span className="text-xs font-bold text-foreground">{format(new Date(empenho.dataEmpenho), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                      <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1" : "text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1"}>Status</span>
                      <Badge variant="outline" className={pageMode ? "text-xs font-semibold uppercase px-2 py-0 border-border" : "text-[8px] font-black uppercase px-2 py-0 border-border"}>
                        {empenho.status}
                      </Badge>
                  </div>
               </div>
               <div className="h-[1px] bg-border/60 w-full" />
               <div className="flex flex-col">
                  <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1" : "text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1"}>Favorecido</span>
                  <span className={pageMode ? "text-xs font-semibold text-foreground break-words" : "text-xs font-black text-foreground break-words"}>{empenho.favorecidoNome}</span>
                  <span className={pageMode ? "text-xs font-mono font-medium text-muted-foreground break-all" : "text-[10px] font-mono font-medium text-muted-foreground break-all"}>{empenho.favorecidoDocumento}</span>
               </div>
               <div className="h-[1px] bg-border/60 w-full" />
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                      <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase mb-0.5" : "text-[9px] font-bold text-muted-foreground uppercase mb-0.5"}>Processo</span>
                      <span className="text-xs font-bold font-mono text-foreground break-all">{empenho.processo || 'N/I'}</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                      <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase mb-0.5" : "text-[9px] font-bold text-muted-foreground uppercase mb-0.5"}>Natureza Despesa</span>
                      <span className={pageMode ? "text-xs font-semibold text-primary break-words" : "text-xs font-black text-blue-600 dark:text-blue-400 break-words"}>{empenho.naturezaDespesa || '-'}</span>
                  </div>
               </div>
               <div className="h-[1px] bg-border/60 w-full" />
               <div className="flex flex-col">
                  <span className={pageMode ? "text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1" : "text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1"}>Descrição</span>
                  <p className={pageMode ? "text-xs text-muted-foreground leading-relaxed italic" : "text-[11px] text-muted-foreground leading-relaxed italic"}>{empenho.descricao}</p>
               </div>
            </div>

            {pageMode && <SectionPanel title="Classificação e planejamento">
              <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Dimensão', empenho.dimensao], ['Componente funcional', empenho.componenteFuncional],
                  ['Origem do recurso', empenho.origemRecurso], ['Plano interno', empenho.planoInterno],
                  ['Atividade vinculada', atividades.find(a => a.id === empenho.atividadeId)?.descricao],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value || 'Não informado'}</dd></div>)}
              </dl>
            </SectionPanel>}
            </TabsContent>
            <TabsContent value="movimentos" forceMount hidden={pageMode && detailTab !== 'movimentos'} className="space-y-6">
            {/* Subitens do Portal da Transparencia */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                <h3 className={pageMode ? "text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2" : "text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2"}>
                  <Receipt className="w-3 h-3 text-primary" />
                  Subitens do Empenho
                </h3>
                {isLoadingItensPortal && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              <div className="divide-y divide-border/40">
                {isLoadingItensPortal ? (
                  <div className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                    Carregando subitens do Portal da Transparência...
                  </div>
                ) : isItensPortalError ? (
                  <div className={pageMode ? "px-5 py-6 text-center text-xs text-status-warning italic" : "px-5 py-6 text-center text-[10px] text-status-warning italic"}>
                    Não foi possível consultar os subitens no Portal da Transparência agora.
                  </div>
                ) : itensPortal.length > 0 ? (
                  itensPortal.map((item) => (
                    <div key={`${item.codigoItemEmpenho}-${item.sequencial}`} className="px-5 py-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={pageMode ? "text-xs px-1.5 py-0 border-border font-semibold uppercase bg-muted/60 text-foreground" : "text-[8px] px-1.5 py-0 border-border font-black uppercase bg-muted/60 text-foreground"}>
                          Subitem {item.codigoSubelemento || item.sequencial || '-'}
                        </Badge>
                        {item.descricaoSubelemento ? (
                          <span className={pageMode ? "text-xs font-bold uppercase tracking-wide text-muted-foreground" : "text-[10px] font-bold uppercase tracking-wide text-muted-foreground"}>
                            {item.descricaoSubelemento}
                          </span>
                        ) : null}
                      </div>
                      <p className={pageMode ? "text-xs leading-relaxed text-foreground" : "text-[11px] leading-relaxed text-foreground"}>
                        {item.descricao || 'Descrição não informada no Portal da Transparência.'}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                    Nenhum subitem encontrado no Portal da Transparência para este empenho.
                  </div>
                )}
              </div>
            </div>

            {/* Histórico de Operações */}
            {empenho.historicoOperacoes && empenho.historicoOperacoes.length > 0 && (
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                    <h3 className={pageMode ? "text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2" : "text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2"}>
                        <History className="w-3 h-3 text-primary" />
                        Histórico de Operações
                    </h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={pageMode ? "bg-muted/30 text-xs uppercase font-bold text-muted-foreground" : "bg-muted/30 text-[9px] uppercase font-bold text-muted-foreground"}>
                      <tr>
                        <th className="px-5 py-2">Data</th>
                        <th className="px-5 py-2 text-center">Operação</th>
                        <th className="px-5 py-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...empenho.historicoOperacoes]
                        .sort((a, b) => {
                          const parseDate = (d: string) => {
                            const parts = d.split('/');
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
                          };
                          return parseDate(a.data) - parseDate(b.data);
                        })
                        .map((op, idx) => (
                          <tr key={idx} className="border-t border-border/40 hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 font-mono text-muted-foreground">{op.data}</td>
                            <td className="px-5 py-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[8px] px-1.5 py-0 border-none font-black uppercase ${
                                  op.operacao === 'INCLUSAO' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                                  op.operacao === 'REFORCO' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                                  op.operacao === 'ANULACAO' ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-muted text-foreground'
                                }`}
                              >
                                {getOperacaoLabel(op.operacao)}
                              </Badge>
                            </td>
                            <td className={`px-5 py-3 text-right font-black ${op.operacao === 'ANULACAO' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {op.operacao === 'ANULACAO' ? '-' : '+'}{formatCurrency(op.valorTotal)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Formulário de Edição */}
            {showLegacyLiquidacoesApiSection && (
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                <h3 className={pageMode ? "text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2" : "text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2"}>
                  <Receipt className="w-3 h-3 text-primary" />
                  Liquidações
                </h3>
                {isLoadingLiquidacoesApi && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={pageMode ? "bg-muted/30 text-xs uppercase font-bold text-muted-foreground" : "bg-muted/30 text-[9px] uppercase font-bold text-muted-foreground"}>
                    <tr>
                      <th className="px-5 py-2">Emissão</th>
                      <th className="px-5 py-2">Fatura</th>
                      <th className="px-5 py-2">Contrato</th>
                      <th className="px-5 py-2">Situação</th>
                      <th className="px-5 py-2">Processo</th>
                      <th className="px-5 py-2">Vencimento</th>
                      <th className="px-5 py-2">Liquidação</th>
                      <th className="px-5 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLiquidacoesApi ? (
                      <tr>
                        <td colSpan={8} className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                          Carregando liquidações da API de contratos...
                        </td>
                      </tr>
                    ) : liquidacoesApi.length > 0 ? (
                      liquidacoesApi.map((liquidacao) => (
                        <tr
                          key={`${liquidacao.contrato_api_id}-${liquidacao.fatura_id}-${liquidacao.empenho_numero}`}
                          className="border-t border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_emissao ?? undefined)}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-primary whitespace-nowrap">
                            {liquidacao.numero_instrumento_cobranca || '-'}
                          </td>
                          <td className="px-5 py-3 font-mono text-foreground whitespace-nowrap">
                            {liquidacao.contrato_numero || '-'}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className={pageMode ? "text-xs px-1.5 py-0 border-none font-semibold uppercase bg-blue-500/15 text-primary" : "text-[8px] px-1.5 py-0 border-none font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300"}>
                              {liquidacao.situacao || 'N/I'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground max-w-[220px] break-all">
                            {liquidacao.processo || 'N/I'}
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_vencimento ?? undefined)}
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_liquidacao ?? undefined)}
                          </td>
                          <td className={pageMode ? "px-5 py-3 text-right font-semibold text-foreground whitespace-nowrap" : "px-5 py-3 text-right font-black text-foreground whitespace-nowrap"}>
                            {formatCurrency(liquidacao.valor_bruto || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                          O empenho não foi localizado nos contratos públicos do Comprasnet para a UG 158366.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                <h3 className={pageMode ? "text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2" : "text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2"}>
                  <Receipt className="w-3 h-3 text-primary" />
                  Liquidações
                </h3>
                {isLoadingLiquidacoesApi && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={pageMode ? "bg-muted/30 text-xs uppercase font-bold text-muted-foreground" : "bg-muted/30 text-[9px] uppercase font-bold text-muted-foreground"}>
                    <tr>
                      <th className="px-5 py-2">Emissão</th>
                      <th className="px-5 py-2">Fatura</th>
                      <th className="px-5 py-2">Contrato</th>
                      <th className="px-5 py-2">Situação</th>
                      <th className="px-5 py-2">Processo</th>
                      <th className="px-5 py-2">Vencimento</th>
                      <th className="px-5 py-2">Liquidação</th>
                      <th className="px-5 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingLiquidacoesApi ? (
                      <tr>
                        <td colSpan={8} className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                          Carregando liquidações...
                        </td>
                      </tr>
                    ) : liquidacoesApi.length > 0 ? (
                      liquidacoesApi.map((liquidacao) => (
                        <tr
                          key={`${liquidacao.contrato_api_id}-${liquidacao.fatura_id}-${liquidacao.empenho_numero}`}
                          className="border-t border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_emissao ?? undefined)}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-primary whitespace-nowrap">
                            {liquidacao.numero_instrumento_cobranca || '-'}
                          </td>
                          <td className="px-5 py-3 font-mono text-foreground whitespace-nowrap">
                            {liquidacao.contrato_numero || '-'}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className={pageMode ? "text-xs px-1.5 py-0 border-none font-semibold uppercase bg-blue-500/15 text-primary" : "text-[8px] px-1.5 py-0 border-none font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300"}>
                              {liquidacao.situacao || 'N/I'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground max-w-[220px] break-all">
                            {liquidacao.processo || 'N/I'}
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_vencimento ?? undefined)}
                          </td>
                          <td className="px-5 py-3 font-mono text-muted-foreground whitespace-nowrap">
                            {formatDateCell(liquidacao.data_liquidacao ?? undefined)}
                          </td>
                          <td className={pageMode ? "px-5 py-3 text-right font-semibold text-foreground whitespace-nowrap" : "px-5 py-3 text-right font-black text-foreground whitespace-nowrap"}>
                            {formatCurrency(liquidacao.valor_bruto || 0)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className={pageMode ? "px-5 py-6 text-center text-xs text-muted-foreground italic" : "px-5 py-6 text-center text-[10px] text-muted-foreground italic"}>
                          {'O empenho não foi localizado nos contratos públicos do Comprasnet para as UGs 158366 e 158155.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            </TabsContent>
            {pageMode && !isEditing && !readOnly && <Button variant="outline" onClick={() => setIsEditing(true)}><Pencil className="mr-2 h-4 w-4" />Editar dados estratégicos</Button>}
            <div hidden={pageMode && (!isEditing || readOnly)} className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <Pencil className="w-3 h-3 text-primary" />
                <h3 className={pageMode ? "text-xs font-semibold uppercase tracking-wider text-foreground" : "text-[11px] font-black uppercase tracking-wider text-foreground"}>Edição de Dados Estratégicos</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className={pageMode ? "text-xs font-bold uppercase text-muted-foreground" : "text-[10px] font-bold uppercase text-muted-foreground"}>Dimensão</Label>
                  <Select
                    value={formData.dimensao ?? ''}
                    onValueChange={(v) => setFormData({ ...formData, dimensao: v, componenteFuncional: '', origemRecurso: '' })}
                  >
                    <SelectTrigger className="h-9 border-border bg-card text-foreground focus:ring-primary/20">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dimensoesDisponiveis.map((dimensao) => (
                        <SelectItem key={dimensao} value={dimensao}>{dimensao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className={pageMode ? "text-xs font-bold uppercase text-muted-foreground" : "text-[10px] font-bold uppercase text-muted-foreground"}>Componente Funcional</Label>
                  <Select
                    value={formData.componenteFuncional ?? ''}
                    onValueChange={(v) => setFormData({ ...formData, componenteFuncional: v })}
                    disabled={!formData.dimensao}
                  >
                    <SelectTrigger className="h-9 border-border bg-card text-foreground focus:ring-primary/20">
                      <SelectValue placeholder={formData.dimensao ? "Selecione..." : "Aguardando dimensão..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.dimensao && (() => {
                        const dimCodigo = formData.dimensao.split(' - ')[0];
                        const componentes = COMPONENTES_POR_DIMENSAO[dimCodigo] || [];
                        return componentes.map((comp) => (
                          <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className={pageMode ? "text-xs font-bold uppercase text-muted-foreground" : "text-[10px] font-bold uppercase text-muted-foreground"}>Origem de Recurso (Datalist)</Label>
                  <Input
                    value={formData.origemRecurso ?? ''}
                    onChange={(e) => setFormData({ ...formData, origemRecurso: e.target.value })}
                    placeholder="Ex: Fonte 100"
                    list="origens-list"
                    className="h-9 border-border bg-card text-foreground focus:ring-primary/20 font-mono text-xs"
                  />
                  <datalist id="origens-list">
                    {origensDisponiveis.map((origem) => (
                      <option key={origem} value={origem} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="empenho-plano-interno" className={pageMode ? "text-xs font-bold uppercase text-muted-foreground" : "text-[10px] font-bold uppercase text-muted-foreground"}>Plano Interno (PI)</Label>
                  <Input
                    id="empenho-plano-interno"
                    value={formData.planoInterno || ''}
                    onChange={(e) => setFormData({ ...formData, planoInterno: e.target.value })}
                    placeholder="Ex: L20RLP..."
                    className="h-9 border-border bg-card text-foreground focus:ring-primary/20 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </Tabs>
        </Body>

        <div hidden={pageMode && (!isEditing || readOnly)}><Footer className="shrink-0 p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => pageMode ? (setIsEditing(false), setFormData(buildFormData(empenho))) : onOpenChange(false)}
              className={pageMode ? "border-border bg-card text-foreground hover:bg-muted font-bold uppercase text-xs tracking-wide px-6 shadow-sm" : "border-border bg-card text-foreground hover:bg-muted font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm"}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className={pageMode ? "bg-primary text-primary-foreground hover:bg-primary/90 px-6" : "bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md shadow-purple-500/20 transition-all active:scale-95"}
            >
              Salvar Alterações
            </Button>
        </Footer></div>
    </>);
  if (pageMode) return open ? <RecordDetailsPage backLabel={backLabel} onBack={() => onOpenChange(false)}>{content}</RecordDetailsPage> : null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl lg:max-w-5xl h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden border border-border shadow-2xl bg-card text-foreground">{content}</DialogContent>
  </Dialog>;
}
