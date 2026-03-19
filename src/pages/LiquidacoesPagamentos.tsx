import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transparenciaService } from '@/services/transparencia';
import { DocumentoDespesa } from '@/types';
import { formatCurrency, formatarDocumento, formatDocumentoId, parseCurrency } from '@/lib/utils';
import { format, addDays, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { retencoesService } from '@/services/retencoes';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    RefreshCw, 
    Search, 
    Loader2, 
    ChevronLeft as ChevronLeftIcon, 
    ChevronRight as ChevronRightIcon, 
    ChevronsLeft as ChevronsLeftIcon, 
    ChevronsRight as ChevronsRightIcon, 
    ArrowUpDown, 
    Filter as FilterIcon, 
    X, 
    Eye, 
    FileSpreadsheet,
    Upload,
    FileWarning as FileBadge,
    Calendar as CalendarIcon 
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DocumentoDetalhesDialog } from '@/components/DocumentoDetalhesDialog';
import { HeaderActions } from '@/components/HeaderParts';

export default function LiquidacoesPagamentos() {
    const queryClient = useQueryClient();
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Paginação e Ordenação
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [sortColumn, setSortColumn] = useState('data_emissao');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Detalhes
    const [selectedDocumento, setSelectedDocumento] = useState<DocumentoDespesa | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    // Query do Supabase
    const { data: queryData, isLoading } = useQuery({
        queryKey: ['transparencia', startDate, endDate, searchTerm, page, perPage, sortColumn, sortDirection],
        queryFn: () => transparenciaService.getDocumentos({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            search: searchTerm,
            page,
            perPage,
            orderBy: sortColumn,
            orderDirection: sortDirection
        }),
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new
    });


    const documentos = queryData?.data || [];
    const totalRecords = queryData?.total || 0;
    const totalPages = Math.ceil(totalRecords / perPage);


    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleViewDetails = (doc: DocumentoDespesa) => {
        setSelectedDocumento(doc);
        setDetailsOpen(true);
    };

    const handleRetencoesImport = async (data: Record<string, string>[]) => {
        const toastId = toast.loading('Processando importação de retenções...');
        
        try {
            const parseDateBR = (str: string) => {
                if (!str) return undefined;
                try {
                    return parse(str, 'dd/MM/yyyy', new Date());
                } catch (e) {
                    return undefined;
                }
            };

            const mappedData = data.map(row => ({
                documento_habil: row['documentohabil'],
                dh_ug_pagadora: row['dhugpagadora'],
                dh_item_ug_pagadora: row['dhitemugpagadora'],
                dh_dia_emissao: parseDateBR(row['dhdiaemissao']),
                dh_data_emissao_doc_origem: parseDateBR(row['dhdataemissaodocorigem']),
                dh_item_dia_pagamento: parseDateBR(row['dhitemdiapagamento']),
                dh_item_dia_vencimento: parseDateBR(row['dhitemdiavencimento']),
                dh_dia_transacao: parseDateBR(row['dhdiatransacao']),
                dh_dia_pagamento: parseDateBR(row['dhdiapagamento']),
                dh_credor_numero: row['dhcredornumero'],
                dh_credor_nome: row['dhcredornome'],
                dh_processo: row['dhprocesso'],
                dh_situacao: row['dhsituacao'],
                dh_valor_doc_origem: parseCurrency(row['dhvalordocorigem']),
                metrica: row['metrica'],
                realizavel: row['realizavel']
            }));

            await retencoesService.upsertBatch(mappedData);
            toast.success(`${mappedData.length} retenções processadas com sucesso!`, { id: toastId });
            setIsImportDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['retencoes'] });
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const err = error as any;
            console.error('Erro ao importar retenções:', err);
            toast.error(`Erro na importação: ${err.message}`, { id: toastId });
        }
    };

    const retencoesFields = [
        'DH - UG Pagadora', 'DH Item - UG Pagadora', 'DH - Dia Emissão', 
        'DH - Data Emissão Doc.Origem', 'DH Item - Dia Pagamento', 'DH Item - Dia Vencimento', 
        'DH - Dia Transação', 'DH - Dia Pagamento', 'Documento Hábil', 'DH - Credor Número', 
        'DH - Credor Nome', 'DH - Processo', 'DH - Situação', 'DH - Valor Doc.Origem', 
        'Métrica', 'Realizável'
    ];

    return (
        <div className="min-h-screen bg-surface-subtle/30">
            <div className="p-space-4 md:p-space-8 space-y-space-8 max-w-[1600px] mx-auto">
                <DocumentoDetalhesDialog
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    documento={selectedDocumento}
                />



                <HeaderActions>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-space-2 font-font-bold shadow-shadow-sm bg-surface-card border-border-default transition-all"
                        onClick={() => setIsImportDialogOpen(true)}
                    >
                        <FileSpreadsheet className="h-4 w-4 text-status-success" />
                        Importar Retenções
                    </Button>
                </HeaderActions>

                <JsonImportDialog
                    open={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                    onImport={handleRetencoesImport}
                    title="Importar Retenções por NP"
                    description="Selecione o arquivo CSV de retenções para importar para o sistema (formato separado por vírgula)."
                    expectedFields={retencoesFields}
                    acceptCsv={true}
                    csvSeparator=","
                />

                
                <div className="space-y-space-6">
                    {/* Filtros em Grid */}
                    <Card className="card-system">
                        <CardHeader className="pb-space-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-text-xs font-font-bold uppercase tracking-widest text-text-muted flex items-center gap-space-2">
                                <FilterIcon className="h-3 w-3" /> Parâmetros de Busca
                            </CardTitle>
                            {(searchTerm || startDate || endDate) && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground hover:text-destructive transition-colors">
                                    <X className="h-3 w-3 mr-1" /> Limpar Filtros
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="pb-space-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-4">
                                <div className="space-y-space-1.5">
                                    <label className="text-text-xs font-font-bold uppercase tracking-wider text-text-secondary ml-space-1">Documento ou Favorecido</label>
                                    <div className="relative">
                                        <Search className="absolute left-space-3 top-1/2 -translate-y-1/2 h-space-3.5 w-space-3.5 text-text-muted" />
                                        <Input
                                            placeholder="Ex: 2026NP0000..."
                                            value={searchTerm}
                                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                            className="pl-space-9 h-space-10 text-text-sm input-system"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-space-1.5">
                                    <label className="text-text-xs font-font-bold uppercase tracking-wider text-text-secondary ml-space-1">Data Início</label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                        className="h-space-10 text-text-sm input-system"
                                    />
                                </div>
                                <div className="space-y-space-1.5">
                                    <label className="text-text-xs font-font-bold uppercase tracking-wider text-text-secondary ml-space-1">Data Fim</label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                        className="h-space-10 text-text-sm input-system"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <div className="w-full p-space-2.5 bg-surface-subtle/50 rounded-radius-lg flex items-center justify-center gap-space-3 border border-dashed border-border-default/50 text-text-muted">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-font-bold uppercase leading-none">Total Registros</span>
                                            <span className="text-text-sm font-font-extrabold text-text-primary mt-space-1">{totalRecords}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela de Documentos */}
                    <Card className="shadow-shadow-xl card-system overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-surface-subtle/50">
                                    <TableRow className="hover:bg-transparent border-b border-border-default/50">
                                        <TableHead className="w-[120px] font-font-bold text-[10px] uppercase tracking-widest text-text-muted py-space-4 px-space-6">Emissão</TableHead>
                                        <TableHead className="font-font-bold text-[10px] uppercase tracking-widest text-text-muted py-space-4">Documento Origem</TableHead>
                                        <TableHead className="font-font-bold text-[10px] uppercase tracking-widest text-text-muted py-space-4">Favorecido</TableHead>
                                        <TableHead className="text-right font-font-bold text-[10px] uppercase tracking-widest text-text-muted py-space-4">Liquidado (NS)</TableHead>
                                        <TableHead className="text-right font-font-bold text-[10px] uppercase tracking-widest text-text-muted py-space-4">Pago (OB)</TableHead>
                                        <TableHead className="w-[80px] py-space-4 pr-space-6"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 8 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="px-6"><Skeleton className="h-4 w-16" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                                <TableCell className="pr-6 text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : documentos.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-40 text-center text-muted-foreground italic">
                                                Nenhum registro encontrado com os parâmetros selecionados.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        documentos.map((doc) => (
                                            <TableRow 
                                                key={doc.id} 
                                                className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-all duration-200 border-b last:border-0"
                                                onClick={() => handleViewDetails(doc)}
                                            >
                                                <TableCell className="whitespace-nowrap font-medium text-xs py-5 px-6">
                                                    {format(doc.dataEmissao, 'dd/MM/yyyy')}
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-mono text-xs font-bold text-primary group-hover:underline underline-offset-4 decoration-primary/30">
                                                            {formatDocumentoId(doc.documento)}
                                                        </span>
                                                        {doc.empenhoDocumento && (
                                                            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                <FileBadge className="w-2.5 h-2.5 text-slate-500" />
                                                                <span className="text-[10px] font-medium tracking-tight whitespace-nowrap">Ref: {doc.empenhoDocumento}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-5">
                                                    <div className="flex flex-col max-w-[340px] gap-0.5">
                                                        <span className="truncate text-xs font-bold leading-tight group-hover:text-primary transition-colors" title={doc.favorecidoNome}>
                                                            {doc.favorecidoNome}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-muted-foreground/80 font-medium">
                                                            {formatarDocumento(doc.favorecidoDocumento)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-font-extrabold text-[11px] text-action-primary py-space-5">
                                                    {doc.valorLiquidado > 0 ? formatCurrency(doc.valorLiquidado) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-font-extrabold text-[11px] text-status-success py-space-5">
                                                    {doc.valorRestoPago > 0 ? formatCurrency(doc.valorRestoPago) : '-'}
                                                </TableCell>
                                                <TableCell className="pr-space-6 text-right py-space-5">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-space-8 w-space-8 text-text-muted hover:bg-action-primary/10 hover:text-action-primary transition-all rounded-radius-full"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Paginação Premium */}
                        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/70 dark:bg-slate-900/40 border-t gap-4">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exibir</span>
                                    <Select value={String(perPage)} onValueChange={(val) => { setPerPage(Number(val)); setPage(1); }}>
                                        <SelectTrigger className="h-8 w-[70px] bg-white dark:bg-slate-950 border-slate-200/60">
                                            <SelectValue placeholder={String(perPage)} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Página <span className="text-foreground">{page}</span> de {totalPages || 1}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-slate-200/60 shadow-sm"
                                    onClick={() => setPage(1)}
                                    disabled={page <= 1 || isLoading}
                                >
                                    <ChevronsLeftIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-slate-200/60 shadow-sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1 || isLoading}
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: Math.min(3, totalPages) }).map((_, i) => {
                                        const p = i + 1;
                                        return (
                                            <Button
                                                key={p}
                                                variant={page === p ? "default" : "ghost"}
                                                size="sm"
                                                className={`h-8 w-8 text-xs font-bold transition-all ${page === p ? 'shadow-md' : ''}`}
                                                onClick={() => setPage(p)}
                                            >
                                                {p}
                                            </Button>
                                        );
                                    })}
                                    {totalPages > 3 && <span className="text-muted-foreground text-xs mx-1">...</span>}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-slate-200/60 shadow-sm"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= totalPages || isLoading}
                                >
                                    <ChevronRightIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 border-slate-200/60 shadow-sm"
                                    onClick={() => setPage(totalPages)}
                                    disabled={page >= totalPages || isLoading}
                                >
                                    <ChevronsRightIcon className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
