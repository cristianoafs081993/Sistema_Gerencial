import { DocumentoDespesa } from "@/types";
import { formatCurrency, formatarDocumento, formatDocumentoId, calculateDocumentoValorPago } from "@/lib/utils";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { transparenciaService } from "@/services/transparencia";
import { Loader2, Info, Receipt, Landmark, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
function isValid(date: unknown) {
    return date instanceof Date && !isNaN(date.getTime());
}
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
    documento: initialDocumento,
    open,
    onOpenChange,
}: DocumentoDetalhesDialogProps) {
    const { data: documento, isLoading } = useQuery({
        queryKey: ['documento-completo', initialDocumento?.id],
        queryFn: () => initialDocumento ? transparenciaService.getDocumentoCompleto(initialDocumento.id) : null,
        enabled: open && !!initialDocumento?.id,
    });

    const displayDoc = documento || initialDocumento;

    if (!displayDoc) return null;

    // Lógica de Negócio centralizada em utils.ts
    const situational = displayDoc.situacoes || [];
    const totalRetencoes = situational.filter(s => 
        s.is_retencao || 
        s.situacao_codigo === 'DOB001' || 
        s.situacao_codigo === 'DOB035'
    ).reduce((acc, s) => acc + (s.valor || 0), 0) || 0;
    const items = displayDoc.itens || [];
    const temOB = items.some(i => i.doc_tipo === 'OB');
    
    const valorPagoCalculado = calculateDocumentoValorPago(displayDoc);
    const valorLiquido = Math.max(0, (displayDoc.valor_original || 0) - totalRetencoes);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-border shadow-2xl bg-card text-foreground">
                <DialogHeader className="p-6 bg-muted/40 border-b border-border space-y-1 relative">
                    <div className="flex items-center justify-between pr-8">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Landmark className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Detalhamento Financeiro</span>
                            </div>
                            <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                                {formatDocumentoId(displayDoc.id)}
                                <Badge className={`text-[10px] font-black px-2 py-0 border-none ${
                                    displayDoc.estado === 'REALIZADO' 
                                        ? 'bg-emerald-500 text-white' 
                                        : displayDoc.estado === 'CANCELADO'
                                            ? 'bg-red-500 text-white'
                                            : 'bg-amber-500 text-white'
                                }`}>
                                    {displayDoc.estado}
                                </Badge>
                            </DialogTitle>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 bg-muted/20">
                    <div className="p-6 space-y-6">
                        {/* Resumo de Valores */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border border-border shadow-sm bg-card overflow-hidden group">
                                <div className="h-1 bg-blue-500 w-full" />
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Valor Bruto</span>
                                        <Receipt className="w-3.5 h-3.5 text-blue-500" />
                                    </div>
                                    <p className="text-xl font-black text-foreground tracking-tighter">
                                        {formatCurrency(displayDoc.valor_original)}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border border-border shadow-sm bg-card overflow-hidden group">
                                <div className="h-1 bg-amber-500 w-full" />
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Retenções</span>
                                        <Info className="w-3.5 h-3.5 text-amber-500" />
                                    </div>
                                    <p className="text-xl font-black text-foreground tracking-tighter">
                                        {formatCurrency(totalRetencoes)}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm bg-emerald-600 overflow-hidden group">
                                <CardContent className="p-4 text-white">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">Valor Pago</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                    </div>
                                    <p className="text-xl font-black tracking-tighter">
                                        {formatCurrency(valorPagoCalculado)}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Dados Contextuais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col gap-3">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Favorecido</span>
                                    <span className="text-xs font-black text-foreground line-clamp-1">{displayDoc.favorecido_nome}</span>
                                    <span className="text-[10px] font-mono font-medium text-muted-foreground">{formatarDocumento(displayDoc.favorecido_documento || '')}</span>
                                </div>
                                <div className="h-[1px] bg-border/60 w-full" />
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Processo</span>
                                        <span className="text-xs font-bold font-mono text-foreground">{displayDoc.processo || 'N/I'}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Fonte Recurso</span>
                                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">{displayDoc.fonte_sof || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex flex-col justify-center gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Valor Líquido Estimado</span>
                                    <span className="text-sm font-black text-foreground">{formatCurrency(valorLiquido)}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground italic leading-tight">
                                    {displayDoc.estado === 'REALIZADO' 
                                        ? "Documento realizado: o valor pago corresponde ao total original." 
                                        : temOB 
                                            ? "Possui Ordem Bancária: o principal (líquido) é considerado pago."
                                            : "Aguardando pagamento ou registro de Ordens Bancárias."}
                                </div>
                            </div>
                        </div>

                        {/* Composição do Documento (Situações) */}
                        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                            <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                                <h3 className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                    <Receipt className="w-3 h-3 text-primary" />
                                    Composição do Documento
                                </h3>
                                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            </div>
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="hover:bg-transparent h-8">
                                        <TableHead className="text-[9px] uppercase font-bold text-muted-foreground px-5">Código</TableHead>
                                        <TableHead className="text-[9px] uppercase font-bold text-muted-foreground text-center">Tipo</TableHead>
                                        <TableHead className="text-[9px] uppercase font-bold text-muted-foreground text-right px-5">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayDoc.situacoes && displayDoc.situacoes.length > 0 ? (
                                        displayDoc.situacoes.map((sit, idx) => (
                                            <TableRow key={idx} className="h-10 hover:bg-muted/30">
                                                <TableCell className="px-5 font-mono text-[10px] font-bold text-foreground">{sit.situacao_codigo}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={`text-[8px] h-4 min-w-[60px] justify-center px-1 font-black uppercase ${
                                                        (sit.is_retencao || sit.situacao_codigo === 'DOB001' || sit.situacao_codigo === 'DOB035')
                                                            ? 'border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/15' 
                                                            : 'border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-500/15'
                                                    }`}>
                                                        {(sit.is_retencao || sit.situacao_codigo === 'DOB001' || sit.situacao_codigo === 'DOB035') ? 'Retenção' : 'Despesa'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right px-5 font-black text-xs ${sit.is_retencao ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                                                    {formatCurrency(sit.valor)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-20 text-center text-[10px] text-muted-foreground italic">
                                                Nenhuma situação detalhada encontrada.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                         {/* Itens Relacionados (OBs / NSs) */}
                         {displayDoc.itens && displayDoc.itens.length > 0 && (
                            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                                <div className="px-5 py-3 border-b border-border/60 bg-muted/40 flex justify-between items-center">
                                    <h3 className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                        <Landmark className="w-3 h-3 text-primary" />
                                        Documentos Gerados (NS / OB)
                                    </h3>
                                </div>
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="hover:bg-transparent h-8">
                                            <TableHead className="text-[9px] uppercase font-bold text-muted-foreground px-5 text-center">Data</TableHead>
                                            <TableHead className="text-[9px] uppercase font-bold text-muted-foreground">Documento</TableHead>
                                            <TableHead className="text-[9px] uppercase font-bold text-muted-foreground text-right px-5">Valor</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayDoc.itens.map((item) => (
                                            <TableRow key={item.id} className="h-10 hover:bg-muted/30">
                                                <TableCell className="px-5 text-center font-mono text-[9px] text-muted-foreground">
                                                    {(() => {
                                                        if (!item.data_emissao) return '-';
                                                        try {
                                                            const d = item.data_emissao.includes('T') ? item.data_emissao : `${item.data_emissao}T12:00:00`;
                                                            return format(new Date(d), 'dd/MM/yy');
                                                        } catch (e) {
                                                            return '-';
                                                        }
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-[10px] font-bold text-primary">{formatDocumentoId(item.id)}</span>
                                                        <Badge variant="outline" className="w-fit text-[8px] h-3 px-1 font-black border-border text-muted-foreground uppercase">{item.doc_tipo}</Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right px-5 font-black text-xs text-foreground">
                                                    {formatCurrency(item.valor)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                         )}

                        {/* Footer Info */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-3">
                            <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-blue-900 dark:text-blue-200 uppercase">Sobre o Cálculo de Pagamento</p>
                                <p className="text-[10px] text-blue-800 dark:text-blue-300 leading-tight">
                                    O **Valor Pago** no dashboard reflete o principal liquidado e enviado para pagamento. Retenções são contabilizadas separadamente no sistema de obrigações tributárias.
                                </p>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                
                <div className="p-4 bg-muted/40 flex justify-end gap-2 border-t border-border">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-border bg-card text-foreground hover:bg-muted font-bold uppercase text-[10px] tracking-widest px-6 shadow-sm"
                        onClick={() => onOpenChange(false)}
                    >
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
