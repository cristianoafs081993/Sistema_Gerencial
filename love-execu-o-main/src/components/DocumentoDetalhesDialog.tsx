import { DocumentoDespesa } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentoDetalhesDialogProps {
    documento: DocumentoDespesa | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DocumentoDetalhesDialog({
    documento,
    open,
    onOpenChange,
}: DocumentoDetalhesDialogProps) {
    if (!documento) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Detalhes do Documento
                        <Badge variant="outline" className="ml-2">
                            {documento.fase}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        {documento.documentoResumido}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Data Emissão</h4>
                                <p>{format(documento.dataEmissao, 'dd/MM/yyyy')}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Valor</h4>
                                <p className="text-lg font-bold text-primary">{formatCurrency(documento.valor)}</p>
                            </div>
                        </div>

                        {documento.empenhoDocumento && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Empenho Associado (Restos a Pagar / Execução)</h4>
                                <p className="font-mono text-lg font-bold text-blue-800 dark:text-blue-200">{documento.empenhoDocumento}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Documento Completo</h4>
                                <p className="font-mono text-sm break-all">{documento.documento}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Natureza da Despesa</h4>
                                <p className="text-sm">{documento.naturezaDespesa}</p>
                            </div>
                        </div>

                        {/* Favorecido Section */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="text-sm font-semibold mb-3">Dados do Favorecido</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Nome</h4>
                                    <p className="text-sm font-medium">{documento.favorecidoNome}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Documento (CPF/CNPJ/Outro)</h4>
                                    <p className="text-sm font-mono">{documento.favorecidoDocumento}</p>
                                </div>
                            </div>
                        </div>

                        {/* Classificação Section */}
                        <div className="bg-muted/30 p-4 rounded-lg border">
                            <h3 className="text-sm font-semibold mb-3">Classificação Orçamentária</h3>
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Elemento de Despesa</h4>
                                    <p className="text-sm">{documento.elementoDespesa}</p>
                                </div>
                                {documento.fonteRecurso && (
                                    <div>
                                        <h4 className="text-xs font-medium text-muted-foreground mb-1">Fonte de Recurso</h4>
                                        <p className="text-sm">{documento.fonteRecurso}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Observações Section */}
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Observações / Histórico</h4>
                            <div className="bg-muted p-4 rounded-lg text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed max-h-[300px] overflow-y-auto">
                                {documento.observacao || 'Sem observações registradas.'}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
