import { DocumentoDespesa } from "@/types";
import { formatCurrency, formatarDocumento, formatDocumentoId } from "@/lib/utils";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

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
                <DialogHeader className="space-y-1 pb-4 border-b">
                    <div className="flex items-center justify-between pr-8">
                        <div>
                            <DialogTitle className="text-xl font-bold tracking-tight">
                                Detalhes do Documento
                            </DialogTitle>
                            <DialogDescription className="font-mono text-xs font-semibold text-muted-foreground mt-0.5">
                                {formatDocumentoId(documento.documento)}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 -mr-4 pr-4 overflow-y-auto">
                    <div className="space-y-6 py-6">
                        {/* Status & Values Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                             <div className="p-3 bg-muted/30 rounded-lg border flex flex-col justify-center min-h-[80px]">
                                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Informações Básicas</h4>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Emissão:</span>
                                        <span className="font-medium">{format(documento.dataEmissao, 'dd/MM/yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Fonte SOF:</span>
                                        <span className="font-bold text-primary">{documento.fonte_sof || '-'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100/50 dark:border-blue-900/20 flex flex-col justify-center min-h-[80px]">
                                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 mb-1">Total Liquidado</h4>
                                <p className="text-xl font-black text-blue-700 dark:text-blue-300">{formatCurrency(documento.valorLiquidado || 0)}</p>
                            </div>

                            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100/50 dark:border-emerald-900/20 flex flex-col justify-center min-h-[80px]">
                                <h4 className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Total Pago</h4>
                                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(documento.valorRestoPago || 0)}</p>
                            </div>
                        </div>

                        {documento.empenhoDocumento && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-between">
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300 mb-0.5">Empenho Associado</h4>
                                    <p className="font-mono text-sm font-bold text-blue-900 dark:text-blue-100">{documento.empenhoDocumento}</p>
                                </div>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border-none">Execução</Badge>
                            </div>
                        )}

                        {/* Favorecido Card */}
                        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-muted/50 border-b">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dados do Favorecido</h3>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Razão Social / Nome</h4>
                                    <p className="text-sm font-semibold leading-tight">{documento.favorecidoNome}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">ID Fiscal</h4>
                                    <p className="text-sm font-mono font-medium">{formatarDocumento(documento.favorecidoDocumento)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Itens Relacionados */}
                        {documento.itens && documento.itens.length > 0 && (
                            <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
                                <div className="px-4 py-3 bg-muted/50 border-b flex justify-between items-center">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Documentos Relacionados ({documento.itens.length})
                                    </h3>
                                    <div className="text-xs font-medium">
                                        Subtotal: <span className="font-bold text-primary">{formatCurrency(documento.itens.reduce((acc, i) => acc + (i.valor || 0), 0))}</span>
                                    </div>
                                </div>
                                <div className="max-h-[300px] overflow-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                            <TableRow className="hover:bg-transparent border-b">
                                                <TableHead className="h-9 text-[10px] uppercase font-bold">Data</TableHead>
                                                <TableHead className="h-9 text-[10px] uppercase font-bold">Tipo</TableHead>
                                                <TableHead className="h-9 text-[10px] uppercase font-bold">Documento</TableHead>
                                                <TableHead className="h-9 text-[10px] uppercase font-bold text-right">Valor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {documento.itens.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-muted/20 border-b last:border-0">
                                                    <TableCell className="py-2.5 font-medium whitespace-nowrap text-[11px]">
                                                        {item.data_emissao ? format(item.data_emissao, 'dd/MM/yyyy') : '-'}
                                                    </TableCell>
                                                    <TableCell className="py-2.5">
                                                        <Badge variant="outline" className="text-[9px] px-1.5 h-4 font-bold border-muted-foreground/30">{item.doc_tipo}</Badge>
                                                    </TableCell>
                                                    <TableCell className="py-2.5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-mono text-[10px] font-bold text-primary">{formatDocumentoId(item.id)}</span>
                                                            {item.observacao && (
                                                                <span className="text-[9px] text-muted-foreground italic truncate max-w-[240px]" title={item.observacao}>
                                                                    {item.observacao}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2.5 text-right font-bold text-[11px] text-foreground">
                                                        {formatCurrency(item.valor)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Observações */}
                        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                            <div className="px-4 py-2 bg-muted/50 border-b">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico / Observações</h3>
                            </div>
                            <div className="p-4 bg-muted/10 text-xs text-foreground whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto font-medium italic">
                                {documento.observacao || 'Sem observações registradas.'}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
