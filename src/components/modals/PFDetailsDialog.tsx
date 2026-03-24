import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RastreabilidadePF } from "@/types/pfs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { FileText, Calendar, Landmark, Info, CheckCircle2, XCircle, Clock, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PFDetailsDialogProps {
  pf: RastreabilidadePF | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PFDetailsDialog({ pf, open, onOpenChange }: PFDetailsDialogProps) {
  if (!pf) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return new Intl.DateTimeFormat("pt-BR").format(d);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusConfig = (status: string | undefined) => {
    const s = status?.toUpperCase() || '';
    if (s.includes('APROVADA')) return { 
      color: 'bg-emerald-500', 
      icon: <CheckCircle2 className="w-3 h-3" />,
      text: 'Aprovada e Liberada',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    };
    if (s.includes('CANCELADA')) return { 
      color: 'bg-red-500', 
      icon: <XCircle className="w-3 h-3" />,
      text: 'Cancelada',
      bg: 'bg-red-50 text-red-700 border-red-100'
    };
    return { 
      color: 'bg-amber-500', 
      icon: <Clock className="w-3 h-3" />,
      text: 'Pendente',
      bg: 'bg-amber-50 text-amber-700 border-amber-100'
    };
  };

  const status = getStatusConfig(pf.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900">
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100 space-y-1 relative">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/70">Detalhamento da Solicitação</span>
                <DialogTitle className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                  {pf.ppf_campus}
                  <Badge className={`text-[10px] font-black px-2 py-0 border-none flex items-center gap-1 ${status.color} text-white`}>
                    {status.icon}
                    {status.text}
                  </Badge>
                </DialogTitle>
              </div>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
        </DialogHeader>

        <ScrollArea className="flex-1 bg-slate-50/50">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border-none shadow-sm bg-white border-l-2 border-l-blue-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor Total</p>
                <p className="text-xl font-black text-slate-900">{formatCurrency(pf.valor)}</p>
              </Card>
              <Card className="p-4 border-none shadow-sm bg-white border-l-2 border-l-amber-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Mês Referência</p>
                <p className="text-lg font-bold text-slate-700">{pf.mes_referencia}</p>
              </Card>
              <Card className="p-4 border-none shadow-sm bg-white border-l-2 border-l-purple-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Fonte Recurso</p>
                <p className="text-lg font-mono font-bold text-slate-700">{pf.fonte_recurso}</p>
              </Card>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <Info className="w-3 h-3 text-blue-500" />
                Informações Básicas
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data da Solicitação</p>
                  <p className="text-sm font-bold text-slate-700">{formatDate(pf.data_solicitacao)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Solicitação</p>
                  <p className="text-sm font-bold text-slate-700">{pf.tipo}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Finalidade</p>
                  <div className="p-4 bg-slate-50 rounded-xl text-sm italic text-slate-600 border border-slate-100">
                    {pf.finalidade || "Não informada"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="bg-slate-900 p-4 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/70 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-blue-400" />
                    Processamento na Reitoria
                  </h3>
                  {pf.pfa_reitoria && (
                    <Badge className="bg-blue-500 text-[10px] font-black uppercase tracking-widest px-2 py-0">
                      {pf.pfa_reitoria}
                    </Badge>
                  )}
               </div>
               <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Aprovação</p>
                    <p className="text-sm font-bold text-slate-700">{formatDate(pf.data_aprovacao)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Número da Liberação</p>
                    <p className="text-sm font-mono font-bold text-slate-900">{pf.pf_liberacao || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Liberação</p>
                    <p className="text-sm font-bold text-slate-700">{formatDate(pf.data_liberacao)}</p>
                  </div>
               </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-slate-500 hover:text-slate-900 font-bold uppercase text-[10px] tracking-widest"
          >
            Fechar Detalhes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
