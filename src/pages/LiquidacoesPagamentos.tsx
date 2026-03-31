import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transparenciaService } from '@/services/transparencia';
import { DocumentoDespesa, DocumentoSituacao } from '@/types';
import { calculateDocumentoValorPago, formatCurrency, formatarDocumento, formatDocumentoId, parseCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
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
    Search as SearchIcon, 
    ChevronLeft as ChevronLeftIcon, 
    ChevronRight as ChevronRightIcon, 
    ChevronsLeft as ChevronsLeftIcon, 
    ChevronsRight as ChevronsRightIcon, 
    X, 
    Eye, 
    FileSpreadsheet,
    FileSpreadsheet as FileSpreadsheetIcon,
    FileWarning as FileBadge,
    RefreshCcw as RefreshCcwIcon,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentoDetalhesDialog } from '@/components/DocumentoDetalhesDialog';
import { HeaderActions } from '@/components/HeaderParts';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

type CsvRow = Record<string, string>;

export default function LiquidacoesPagamentos() {
    const queryClient = useQueryClient();
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isImportDocsOpen, setIsImportDocsOpen] = useState(false);
    const [isImportFonteOpen, setIsImportFonteOpen] = useState(false);
    const [isImportOBOpen, setIsImportOBOpen] = useState(false);

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
    const [selectedDoc, setSelectedDoc] = useState<DocumentoDespesa | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
        placeholderData: (previousData) => previousData,
    });


    const documentos = queryData?.data || [];
    const totalRecords = queryData?.total || 0;
    const totalPages = Math.ceil(totalRecords / perPage);

    const clearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setPage(1);
    };

    const getSortIcon = (column: string) => {
        if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
        return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3 text-primary" /> : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
    };

    const handleViewDetails = (doc: DocumentoDespesa) => {
        setSelectedDoc(doc);
        setIsDetailsOpen(true);
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['transparencia'] });
        toast.success('Dados atualizados!');
    };

    const handleImportDocs = async (data: Record<string, string>[]) => {
        const toastId = toast.loading('Importando documentos...');
        try {
            await transparenciaService.importDocumentosHabeis(data);
            toast.success('Importação concluída!', { id: toastId });
            handleRefresh();
        } catch (error) {
            console.error(error);
            toast.error('Erro na importação', { id: toastId });
        }
    };

    const handleImportOB = async (data: CsvRow[]) => {
        const toastId = toast.loading('Processando Ordens Bancárias...');
        try {
            await transparenciaService.importOrdensBancarias(data);
            toast.success(`${data.length} ordens bancárias importadas com sucesso!`, { id: toastId });
            setIsImportOBOpen(false);
            handleRefresh();
        } catch (error: unknown) {
            console.error('Erro import OB:', error);
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            toast.error(`Falha na importação: ${message}`, { id: toastId });
        }
    };

    const handleImportFonte = async (data: Record<string, string>[]) => {
        const toastId = toast.loading('Atualizando fontes SOF...');
        try {
            await transparenciaService.importLiquidacoes(data);
            toast.success('Fontes atualizadas!', { id: toastId });
            handleRefresh();
            setIsImportFonteOpen(false);
        } catch (error) {
            console.error(error);
            toast.error('Erro na atualização', { id: toastId });
        }
    };

    const handleRetencoesImport = async (data: CsvRow[]) => {
        const toastId = toast.loading('Processando importação de situações...');
        
        try {
            // Mapeamos para o novo formato de Situações
            const mappedData: Partial<DocumentoSituacao>[] = data.map(row => {
                const situacaoCodigo = row['dhsituacao'] || '';
                return {
                    documento_habil_id: row['documentohabil'],
                    situacao_codigo: situacaoCodigo,
                    valor: parseCurrency(row['dhvalordocorigem']),
                    is_retencao: situacaoCodigo.startsWith('DDF') || 
                                situacaoCodigo.startsWith('DDU') || 
                                situacaoCodigo === 'DOB001' || 
                                situacaoCodigo === 'DOB035'
                };
            });

            await retencoesService.upsertSituacoesBatch(mappedData as DocumentoSituacao[]);
            
            toast.success(`${mappedData.length} situações processadas com sucesso!`, { id: toastId });
            setIsImportDialogOpen(false);
            
            // Invalida transparência para atualizar os documentos
            queryClient.invalidateQueries({ queryKey: ['transparencia'] });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            console.error('Erro ao importar situações:', error);
            toast.error(`Erro na importação: ${message}`, { id: toastId });
        }
    };

    const retencoesFields = [
        'Documento Hábil', 'DH - Situação', 'DH - Valor Doc.Origem'
    ];

    return (
        <div className="space-y-6 pb-10">
            <DocumentoDetalhesDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                documento={selectedDoc}
            />

            <HeaderActions>
                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 gap-2 font-bold uppercase text-[10px] tracking-widest px-4 border-slate-200/60 shadow-sm hover:bg-slate-50 bg-white"
                            >
                                <FileSpreadsheetIcon className="h-3.5 w-3.5 text-emerald-600" />
                                Importar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => setIsImportDocsOpen(true)} className="text-xs font-semibold py-2">
                                Documentos Hábeis (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsImportFonteOpen(true)} className="text-xs font-semibold py-2">
                                Fonte SOF / Liquidações (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsImportOBOpen(true)} className="text-xs font-semibold py-2">
                                Ordens Bancárias / Pagos (.csv)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)} className="text-xs font-semibold py-2 border-t mt-1">
                                Situações / Retenções (.csv)
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleRefresh}
                        className="h-9 gap-2 font-bold uppercase text-[10px] tracking-widest px-4 bg-white border-slate-200/60 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                    >
                        <RefreshCcwIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar Dados
                    </Button>
                </div>
            </HeaderActions>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total de Documentos"
                    value={totalRecords}
                    icon={FileBadge}
                    stitchColor="vibrant-blue"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Documentos Filtrados"
                    value={documentos.length}
                    icon={SearchIcon}
                    stitchColor="purple"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Valor Total (Filtrado)"
                    value={formatCurrency(documentos.reduce((sum, d) => sum + (d.valor_original || 0), 0))}
                    icon={Eye}
                    stitchColor="amber"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Total Pago (Filtrado)"
                    value={formatCurrency(documentos.reduce((sum, d) => sum + calculateDocumentoValorPago(d), 0))}
                    icon={Eye}
                    stitchColor="emerald-green"
                    isLoading={isLoading}
                />
            </div>

            <JsonImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleRetencoesImport}
                title="Importar Situações (Despesas/Retenções)"
                expectedFields={retencoesFields}
                acceptCsv={true}
                csvSeparator="\t"
            />

            {/* Standard Filter Card */}
            <Card className="card-system shadow-sm">
                <CardHeader className="pb-3 px-0 pt-0">
                    <CardTitle className="text-xl font-bold">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar documento ou favorecido..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="pl-9 h-10 text-sm input-system"
                            />
                        </div>
                        <div className="w-full sm:w-[150px]">
                            <Input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                className="h-10 text-sm input-system"
                            />
                        </div>
                        <div className="w-full sm:w-[150px]">
                            <Input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                className="h-10 text-sm input-system"
                            />
                        </div>
                        {(searchTerm || startDate || endDate) && (
                            <Button variant="ghost" onClick={clearFilters} className="h-10 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-destructive">
                                <X className="h-4 w-4 mr-2" />
                                Limpar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Main Table Card */}
            <Card className="card-system shadow-sm border-none shadow-none mt-6">
                <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-semibold">Documentos Hábeis</CardTitle>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
                            {totalRecords}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                                    <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wider py-4 px-6 text-muted-foreground whitespace-nowrap">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('data_emissao')}>
                                            Emissão {getSortIcon('data_emissao')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-4">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('id')}>
                                            Documento / Processo {getSortIcon('id')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-4">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('favorecido_nome')}>
                                            Favorecido {getSortIcon('favorecido_nome')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-4 text-center">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider mx-auto" onClick={() => handleSort('fonte_sof')}>
                                            Fonte {getSortIcon('fonte_sof')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-4 text-center">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider mx-auto" onClick={() => handleSort('estado')}>
                                            Estado {getSortIcon('estado')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-4 text-right">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider ml-auto" onClick={() => handleSort('valor_original')}>
                                            Bruto {getSortIcon('valor_original')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap px-4 border-l border-slate-100/50">Valor Pago</TableHead>
                                    <TableHead className="w-[80px] py-4 pr-6 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-l border-slate-100/50">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="px-6"><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                            <TableCell className="pr-6 text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : documentos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                                            Nenhum registro encontrado com os parâmetros selecionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    documentos.map((doc) => (
                                        <TableRow 
                                            key={doc.id} 
                                            className="group hover:bg-slate-50/80 transition-colors border-b last:border-0 cursor-pointer"
                                            onClick={() => handleViewDetails(doc)}
                                        >
                                            <TableCell className="whitespace-nowrap font-medium text-xs py-5 px-6">
                                                {(() => {
                                                    if (!doc.data_emissao) return '-';
                                                    try {
                                                        const dateStr = doc.data_emissao.includes('T') ? doc.data_emissao : `${doc.data_emissao}T12:00:00`;
                                                        return format(new Date(dateStr), 'dd/MM/yyyy');
                                                    } catch (e) {
                                                        return '-';
                                                    }
                                                })()}
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-[11px] font-black text-primary group-hover:underline underline-offset-4 decoration-primary/30 tracking-tighter">
                                                        {formatDocumentoId(doc.id)}
                                                    </span>
                                                    {doc.processo && (
                                                        <div className="flex items-center gap-1.5 opacity-60">
                                                            <span className="text-[9px] font-black tracking-tight whitespace-nowrap text-slate-500 bg-slate-100 px-1 rounded uppercase">Proc: {doc.processo}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <div className="flex flex-col max-w-[340px] gap-0.5">
                                                    <span className="truncate text-xs font-bold leading-tight group-hover:text-primary transition-colors" title={doc.favorecido_nome}>
                                                        {doc.favorecido_nome}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-muted-foreground/80 font-medium">
                                                        {formatarDocumento(doc.favorecido_documento || '')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 text-center font-black text-[10px] text-blue-600/80 bg-blue-50/10">
                                                {doc.fonte_sof || '-'}
                                            </TableCell>
                                            <TableCell className="py-5 text-center px-2">
                                                <Badge 
                                                    variant={doc.estado === 'REALIZADO' ? 'default' : 'outline'}
                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                        doc.estado === 'REALIZADO' 
                                                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20' 
                                                            : doc.estado === 'CANCELADO'
                                                                ? 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20'
                                                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                                                    }`}
                                                >
                                                    {doc.estado}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-black text-[11px] text-blue-600 dark:text-blue-400 py-5">
                                                {doc.valor_original ? formatCurrency(doc.valor_original) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-[11px] text-emerald-600 dark:text-emerald-400 py-5">
                                                 {(() => {
                                                     const vPago = calculateDocumentoValorPago(doc);
                                                     return vPago > 0 ? formatCurrency(vPago) : '-';
                                                 })()}
                                             </TableCell>
                                            <TableCell className="pr-6 text-right py-5">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:bg-slate-200 transition-all rounded-full"
                                                >
                                                    <ChevronRightIcon className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                {/* Paginação Premium */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/70 border-t gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Exibir</span>
                            <Select value={String(perPage)} onValueChange={(val) => { setPerPage(Number(val)); setPage(1); }}>
                                <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200/60">
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
                        <div className="h-4 w-[1px] bg-slate-200 hidden sm:block"></div>
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

            <JsonImportDialog 
                open={isImportDocsOpen} 
                onOpenChange={setIsImportDocsOpen} 
                onImport={handleImportDocs}
                title="Importar Documentos Hábeis"
                expectedFields={['Documento Hábil', 'DH - Valor Doc.Origem', 'DH - Processo', 'DH - Estado', 'DH - Credor']}
                acceptCsv
                csvSeparator="\t"
            />

            <JsonImportDialog 
                open={isImportFonteOpen} 
                onOpenChange={setIsImportFonteOpen} 
                onImport={handleImportFonte}
                title="Importar Fonte SOF (Liquidações)"
                expectedFields={['NE CCor', 'Documento Origem', 'Fonte SOF', 'Fonte']}
                acceptCsv
                csvSeparator="\t"
            />

            <DocumentoDetalhesDialog 
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                documento={selectedDoc}
            />
            <JsonImportDialog 
                open={isImportOBOpen} 
                onOpenChange={setIsImportOBOpen} 
                onImport={handleImportOB}
                title="Importar Ordens Bancárias"
                expectedFields={['Documento', 'Documento Origem', 'DESPESAS PAGAS', 'RESTOS A PAGAR PAGOS', 'Dia Lançamento']}
                acceptCsv={true}
                csvSeparator="\t"
            />
        </div>
    );
}
