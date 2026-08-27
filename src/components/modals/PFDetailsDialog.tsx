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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl bg-card text-foreground">
        <DialogHeader className="p-6 bg-muted/40 border-b border-border space-y-1 relative">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/15 rounded-lg text-blue-600 dark:text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/70 dark:text-blue-400/80">Detalhamento da Solicitação</span>
                <DialogTitle className="text-xl font-black tracking-tight text-foreground flex items-center gap-3">
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

        <ScrollArea className="flex-1 bg-muted/20">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 border border-border shadow-sm bg-card border-l-2 border-l-blue-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Valor Total</p>
                <p className="text-xl font-black text-foreground">{formatCurrency(pf.valor)}</p>
              </Card>
              <Card className="p-4 border border-border shadow-sm bg-card border-l-2 border-l-amber-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Mês Referência</p>
                <p className="text-lg font-bold text-foreground">{pf.mes_referencia}</p>
              </Card>
              <Card className="p-4 border border-border shadow-sm bg-card border-l-2 border-l-purple-500 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fonte Recurso</p>
                <p className="text-lg font-mono font-bold text-foreground">{pf.fonte_recurso}</p>
              </Card>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Info className="w-3 h-3 text-primary" />
                Informações Básicas
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data da Solicitação</p>
                  <p className="text-sm font-bold text-foreground">{formatDate(pf.data_solicitacao)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Solicitação</p>
                  <p className="text-sm font-bold text-foreground">{pf.tipo}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Finalidade</p>
                  <div className="p-4 bg-muted/40 rounded-xl text-sm italic text-foreground border border-border">
                    {pf.finalidade || "Não informada"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
               <div className="bg-muted/80 p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-primary" />
                    Processamento na Reitoria
                  </h3>
                  {pf.pfa_reitoria && (
                    <Badge className="bg-blue-600 text-[10px] font-black uppercase tracking-widest px-2 py-0 text-white">
                      {pf.pfa_reitoria}
                    </Badge>
                  )}
               </div>
               <div className="p-6 grid grid-cols-2 gap-y-6 gap-x-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Aprovação</p>
                    <p className="text-sm font-bold text-foreground">{formatDate(pf.data_aprovacao)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número da Liberação</p>
                    <p className="text-sm font-mono font-bold text-foreground">{pf.pf_liberacao || "-"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data de Liberação</p>
                    <p className="text-sm font-bold text-foreground">{formatDate(pf.data_liberacao)}</p>
                  </div>
               </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 bg-muted/40 border-t border-border flex items-center justify-end">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground font-bold uppercase text-[10px] tracking-widest"
          >
            Fechar Detalhes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
