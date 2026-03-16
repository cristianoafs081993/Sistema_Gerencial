import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transparenciaService } from '@/services/transparencia';
import { DocumentoDespesa } from '@/types';
import { formatCurrency, formatarDocumento, formatDocumentoId } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    FileText, 
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
import { HeaderSubtitle, HeaderActions } from '@/components/HeaderParts';
import { Header, HeaderPortal } from '@/components/Header';

export default function LiquidacoesPagamentos() {
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState('');

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

    const { data: lastUpdateDate } = useQuery({
        queryKey: ['transparencia-last-update'],
        queryFn: () => transparenciaService.getLastDocumentoDate(),
    });

    const documentos = queryData?.data || [];
    const totalRecords = queryData?.total || 0;
    const totalPages = Math.ceil(totalRecords / perPage);

    const handleSync = async () => {
        try {
            setIsSyncing(true);
            setSyncProgress(0);
            setSyncStatus('Identificando ponto de partida...');

            // Buscamos a última data apenas para o cálculo da porcentagem na UI
            const lastDateFound = await transparenciaService.getLastDocumentoDate();
            const dataInicioBase = lastDateFound ? addDays(lastDateFound, 1) : new Date(2026, 0, 1);

            await transparenciaService.syncDados(undefined, (currentDate, total, fase) => {
                setSyncStatus(`Sincronizando ${format(currentDate, 'dd/MM/yyyy')} - ${fase}... (${total} processados)`);

                // Cálculo de progresso baseado na data de início identificada
                const totalDias = Math.max(1, (new Date().getTime() - dataInicioBase.getTime()) / (1000 * 3600 * 24));
                const diasProcessados = (currentDate.getTime() - dataInicioBase.getTime()) / (1000 * 3600 * 24);
                const porcentagem = Math.min(100, Math.max(0, (diasProcessados / totalDias) * 100));
                setSyncProgress(porcentagem);
            });

            setSyncStatus('Sincronização concluída!');
            setSyncProgress(100);
            toast.success('Dados sincronizados com sucesso!');

            // Invalidar query para atualizar a tabela
            queryClient.invalidateQueries({ queryKey: ['transparencia'] });

        } catch (error) {
            console.error(error);
            toast.error('Erro ao sincronizar dados. Verifique o console.');
            setSyncStatus('Erro na sincronização.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => {
                setSyncProgress(0);
                setSyncStatus('');
            }, 5000);
        }
    };

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

    return (
        <div className="min-h-screen bg-slate-50/30 dark:bg-slate-950/30">
            <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
                <DocumentoDetalhesDialog
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    documento={selectedDocumento}
                />

                <Header 
                    title="Documentos Hábeis" 
                    icon={FileText}
                    onRefresh={handleSync}
                    isRefreshing={isSyncing}
                />

                <HeaderPortal targetId="header-subtitle">
                    Documentos Hábeis {lastUpdateDate ? `(Atualizado até: ${format(lastUpdateDate, 'dd/MM/yyyy')})` : ''}
                </HeaderPortal>

                {isSyncing && (
                    <div className="fixed bottom-8 right-8 z-50 w-80 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-primary/10 p-2 rounded-lg">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sincronizando Banco</p>
                                <p className="text-[10px] text-muted-foreground truncate">{syncStatus}</p>
                            </div>
                        </div>
                        <Progress value={syncProgress} className="h-1.5" />
                    </div>
                )}
                
                <div className="space-y-6">
                    {/* Filtros em Grid */}
                    <Card className="shadow-sm border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <FilterIcon className="h-3 w-3" /> Parâmetros de Busca
                            </CardTitle>
                            {(searchTerm || startDate || endDate) && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground hover:text-destructive transition-colors">
                                    <X className="h-3 w-3 mr-1" /> Limpar Filtros
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="pb-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Documento ou Favorecido</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Ex: 2026NP0000..."
                                            value={searchTerm}
                                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                            className="pl-9 h-10 text-sm bg-white dark:bg-slate-900 focus-visible:ring-primary/20 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Data Início</label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                        className="h-10 text-sm bg-white dark:bg-slate-900 focus-visible:ring-primary/20 transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Data Fim</label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                        className="h-10 text-sm bg-white dark:bg-slate-900 focus-visible:ring-primary/20 transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <div className="w-full p-2.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg flex items-center justify-center gap-3 border border-dashed text-muted-foreground">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-bold uppercase">Total Registros</span>
                                            <span className="text-xs font-black text-foreground">{totalRecords}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela de Documentos */}
                    <Card className="shadow-xl border-slate-200/60 dark:border-slate-800/60 overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                    <TableRow className="hover:bg-transparent border-b">
                                        <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4 px-6">Emissão</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4">Documento Origem</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4">Favorecido</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4">Liquidado (NS)</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground py-4">Pago (OB)</TableHead>
                                        <TableHead className="w-[80px] py-4 pr-6"></TableHead>
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
                                                <TableCell className="text-right font-black text-[11px] text-blue-600 dark:text-blue-400 py-5">
                                                    {doc.valorLiquidado > 0 ? formatCurrency(doc.valorLiquidado) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-black text-[11px] text-emerald-600 dark:text-emerald-400 py-5">
                                                    {doc.valorRestoPago > 0 ? formatCurrency(doc.valorRestoPago) : '-'}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right py-5">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all rounded-full"
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
