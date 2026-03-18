import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RastreabilidadePF } from "@/types/pfs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  const statusColorMap: Record<string, string> = {
    'APROVADA E LIBERADA': 'bg-green-500 hover:bg-green-600',
    'CANCELADA': 'bg-red-500 hover:bg-red-600',
    'PENDENTE': 'bg-yellow-500 hover:bg-yellow-600',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Detalhes da Solicitação Financeira</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">PPF Campus</p>
              <p className="text-lg font-mono font-bold tracking-tight">{pf.ppf_campus}</p>
            </div>
            <Badge className={`${statusColorMap[pf.status?.toUpperCase() || ''] || ''} text-white`}>
              {pf.status}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data da Solicitação</p>
              <p>{formatDate(pf.data_solicitacao)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mês de Referência</p>
              <p>{pf.mes_referencia}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tipo</p>
              <p>{pf.tipo}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fonte de Recurso</p>
              <Badge variant="outline" className="font-mono mt-1">{pf.fonte_recurso}</Badge>
            </div>
            <div className="col-span-2 mt-2">
              <p className="text-sm font-medium text-muted-foreground">Valor da Solicitação</p>
              <p className="text-2xl font-bold">{formatCurrency(pf.valor)}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Finalidade</p>
              <p className="mt-1 text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                {pf.finalidade || "Não informada"}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
            <div className="col-span-2">
              <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Processamento na Reitoria</h4>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">PFA Reitoria</p>
              <p className="font-mono text-sm">{pf.pfa_reitoria || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data Aprovação</p>
              <p>{formatDate(pf.data_aprovacao)}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-muted-foreground">PF Liberação</p>
              <p className="font-mono text-sm">{pf.pf_liberacao || "-"}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-muted-foreground">Data Liberação</p>
              <p>{formatDate(pf.data_liberacao)}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
