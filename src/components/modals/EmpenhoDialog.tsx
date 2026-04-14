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
import { Pencil, History, DollarSign, Receipt, CheckCircle2, Landmark, Info, Loader2 } from 'lucide-react';
import { formatCurrency, formatDocumentoId } from '@/lib/utils';
import { transparenciaService } from '@/services/transparencia';
import { format } from 'date-fns';

interface EmpenhoDialogProps {
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
    planoInterno: empenho.planoInterno || '',
    processo: empenho.processo || '',
    origemRecurso: empenho.origemRecurso || '',
    componenteFuncional: empenho.componenteFuncional || '',
  };
};

export function EmpenhoDialog({ open, onOpenChange, empenho, atividades, onSave }: EmpenhoDialogProps) {
  const [formData, setFormData] = useState<Partial<Empenho>>(() => buildFormData(empenho));

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

  const { data: documentosEmpenho = [], isLoading: isLoadingDocumentos } = useQuery({
    queryKey: ['documentos-habeis-empenho', empenho?.numero],
    queryFn: () =>
      empenho?.numero
        ? transparenciaService.getDocumentosPorEmpenho(empenho.numero)
        : Promise.resolve([]),
    enabled: open && !!empenho?.numero,
  });

  const documentosQueDiminuemSaldo = useMemo(
    () =>
      documentosEmpenho.filter(
        (documento) =>
          Number(documento.valor_original || 0) > 0 &&
          documento.estado?.toUpperCase() !== 'CANCELADO',
      ),
    [documentosEmpenho],
  );

  if (!empenho) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(empenho.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl lg:max-w-5xl max-h-[calc(100dvh-2rem)] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 space-y-1 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600/70">Detalhes do Empenho</span>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900">
                {empenho.numero}
              </DialogTitle>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
        </DialogHeader>

        <ScrollArea className="flex-1 bg-white">
          <div className="p-6 space-y-6">
            {/* Resumo de Valores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-none shadow-sm bg-slate-50 overflow-hidden group">
                <div className="h-1 bg-blue-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Valor Empenhado</span>
                    <DollarSign className="w-3 h-3 text-blue-500" />
                  </div>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">
                    {formatCurrency(empenho.valor)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-slate-50 overflow-hidden group">
                <div className="h-1 bg-amber-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Valor Liquidado</span>
                    <Receipt className="w-3 h-3 text-amber-500" />
                  </div>
                  <p className="text-lg font-black text-slate-900 tracking-tighter">
                    {formatCurrency(empenho.valorLiquidado || empenho.valorLiquidadoAPagar || 0)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-emerald-50 overflow-hidden group">
                <div className="h-1 bg-emerald-500 w-full" />
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Valor Pago</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  </div>
                  <p className="text-lg font-black text-emerald-700 tracking-tighter">
                    {formatCurrency(empenho.valorPago || empenho.valorPagoOficial || 0)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Dados Básicos */}
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Data de Emissão</span>
                      <span className="text-xs font-bold text-slate-700">{format(new Date(empenho.dataEmpenho), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Status</span>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-2 py-0 border-slate-200">
                        {empenho.status}
                      </Badge>
                  </div>
               </div>
               <div className="h-[1px] bg-slate-200/50 w-full" />
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Favorecido</span>
                  <span className="text-xs font-black text-slate-800 break-words">{empenho.favorecidoNome}</span>
                  <span className="text-[10px] font-mono font-medium text-slate-500 break-all">{empenho.favorecidoDocumento}</span>
               </div>
               <div className="h-[1px] bg-slate-200/50 w-full" />
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Processo</span>
                      <span className="text-xs font-bold font-mono text-slate-700 break-all">{empenho.processo || 'N/I'}</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Natureza Despesa</span>
                      <span className="text-xs font-black text-blue-600 break-words">{empenho.naturezaDespesa || '-'}</span>
                  </div>
               </div>
               <div className="h-[1px] bg-slate-200/50 w-full" />
               <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Descrição</span>
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">{empenho.descricao}</p>
               </div>
            </div>

            {/* Histórico de Operações */}
            {empenho.historicoOperacoes && empenho.historicoOperacoes.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                        <History className="w-3 h-3" />
                        Histórico de Operações
                    </h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/30 text-[9px] uppercase font-bold text-slate-400">
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
                          <tr key={idx} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 font-mono text-slate-500">{op.data}</td>
                            <td className="px-5 py-3 text-center">
                              <Badge 
                                variant="outline"
                                className={`text-[8px] px-1.5 py-0 border-none font-black uppercase ${
                                  op.operacao === 'INCLUSAO' ? 'bg-blue-50 text-blue-600' :
                                  op.operacao === 'REFORCO' ? 'bg-emerald-50 text-emerald-600' :
                                  op.operacao === 'ANULACAO' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
                                }`}
                              >
                                {getOperacaoLabel(op.operacao)}
                              </Badge>
                            </td>
                            <td className={`px-5 py-3 text-right font-black ${op.operacao === 'ANULACAO' ? 'text-red-500' : 'text-emerald-600'}`}>
                              {op.operacao === 'ANULACAO' ? '-' : '+'}{formatCurrency(op.valorTotal)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Documentos hábeis vinculados */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <Receipt className="w-3 h-3" />
                  Documentos hábeis que diminuíram o saldo
                </h3>
                {isLoadingDocumentos && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/30 text-[9px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-5 py-2">Data</th>
                      <th className="px-5 py-2">Documento</th>
                      <th className="px-5 py-2">Estado</th>
                      <th className="px-5 py-2">Processo</th>
                      <th className="px-5 py-2 text-right">Impacto</th>
                      <th className="px-5 py-2 text-right">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingDocumentos ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-[10px] text-muted-foreground italic">
                          Carregando documentos hábeis vinculados...
                        </td>
                      </tr>
                    ) : documentosQueDiminuemSaldo.length > 0 ? (
                      documentosQueDiminuemSaldo.map((documento) => (
                        <tr key={documento.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-slate-500 whitespace-nowrap">
                            {formatDateCell(documento.data_emissao)}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-primary whitespace-nowrap">
                            {formatDocumentoId(documento.id)}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-none font-black uppercase bg-amber-50 text-amber-700">
                              {documento.estado || 'PENDENTE'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-500 max-w-[220px] break-all">
                            {documento.processo || 'N/I'}
                          </td>
                          <td className="px-5 py-3 text-right font-black text-red-500 whitespace-nowrap">
                            -{formatCurrency(documento.valor_original || 0)}
                          </td>
                          <td className="px-5 py-3 text-right font-black text-emerald-600 whitespace-nowrap">
                            {(documento.valor_pago || 0) > 0 ? formatCurrency(documento.valor_pago || 0) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-6 text-center text-[10px] text-muted-foreground italic">
                          Nenhum documento hábil vinculado a este empenho reduziu o saldo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex gap-2 text-[10px] text-muted-foreground leading-relaxed">
                <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                <span>São considerados documentos hábeis vinculados ao empenho com valor original positivo e estado diferente de cancelado.</span>
              </div>
            </div>

            {/* Formulário de Edição */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <Pencil className="w-3 h-3 text-blue-600" />
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-600">Edição de Dados Estratégicos</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Dimensão</Label>
                  <Select
                    value={formData.dimensao}
                    onValueChange={(v) => setFormData({ ...formData, dimensao: v, componenteFuncional: '', origemRecurso: '' })}
                  >
                    <SelectTrigger className="h-9 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20">
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
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Componente Funcional</Label>
                  <Select
                    value={formData.componenteFuncional}
                    onValueChange={(v) => setFormData({ ...formData, componenteFuncional: v })}
                    disabled={!formData.dimensao}
                  >
                    <SelectTrigger className="h-9 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20">
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
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Origem de Recurso (Datalist)</Label>
                  <Input
                    value={formData.origemRecurso}
                    onChange={(e) => setFormData({ ...formData, origemRecurso: e.target.value })}
                    placeholder="Ex: Fonte 100"
                    list="origens-list"
                    className="h-9 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 font-mono text-xs"
                  />
                  <datalist id="origens-list">
                    {origensDisponiveis.map((origem) => (
                      <option key={origem} value={origem} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Plano Interno (PI)</Label>
                  <Input
                    value={formData.planoInterno || ''}
                    onChange={(e) => setFormData({ ...formData, planoInterno: e.target.value })}
                    placeholder="Ex: L20RLP..."
                    className="h-9 border-slate-200 bg-slate-50/50 focus:ring-blue-500/20 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => onOpenChange(false)} 
              className="bg-white border-slate-200 text-slate-600 hover:bg-slate-100 font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase text-[10px] tracking-widest px-8 shadow-md shadow-purple-500/20 transition-all active:scale-95"
            >
              Salvar Alterações
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
