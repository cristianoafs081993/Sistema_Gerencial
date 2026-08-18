import { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { retencoesService } from '@/services/retencoes';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { ActiveFilterChips, type ActiveFilterItem } from '@/components/design-system/ActiveFilterChips';

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
import { TablePagination } from '@/components/design-system/TablePagination';
import { FilterPanel } from '@/components/design-system/FilterPanel';

export default function LiquidacoesPagamentos() {
    const { isSuperAdmin } = useAuth();
    const queryClient = useQueryClient();

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

    useEffect(() => {
        setPage(1);
    }, [searchTerm, startDate, endDate, perPage, sortColumn, sortDirection]);

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

    const activeFilterList = useMemo<ActiveFilterItem[]>(() => {
        const list: ActiveFilterItem[] = [];

        if (searchTerm.trim()) {
            list.push({
                id: 'search',
                label: 'Busca',
                value: `"${searchTerm.trim()}"`,
                onRemove: () => {
                    setSearchTerm('');
                    setPage(1);
                },
            });
        }

        if (startDate || endDate) {
            list.push({
                id: 'periodo',
                label: 'Período',
                value: `${startDate || 'Início'} até ${endDate || 'Fim'}`,
                onRemove: () => {
                    setStartDate('');
                    setEndDate('');
                    setPage(1);
                },
            });
        }

        return list;
    }, [searchTerm, startDate, endDate]);

    return (
        <div className="space-y-6 pb-10">
            <DocumentoDetalhesDialog
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                documento={selectedDoc}
            />

            <HeaderActions>
                <div className="flex items-center gap-3">
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

            {isSuperAdmin ? (
            <JsonImportDialog 
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleRetencoesImport}
                title="Importar Situações (Despesas/Retenções)"
                expectedFields={retencoesFields}
                acceptCsv={true}
                csvSeparator="\t"
            />
            ) : null}

            {/* Standard Filter Card */}
            <FilterPanel className="shadow-sm">
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
                    </div>

                    {/* Chips de Filtros Ativos (Eixo 04) */}
                    <ActiveFilterChips
                        filters={activeFilterList}
                        onClearAll={activeFilterList.length > 0 ? clearFilters : undefined}
                        filteredCount={documentos.length}
                        totalCount={totalRecords}
                    />
                </CardContent>
            </FilterPanel>


            {/* Main Table Card */}
            <Card className="card-system shadow-sm border-none shadow-none mt-6">
                <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <CardTitle className="table-title">Documentos Hábeis</CardTitle>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
                            {totalRecords}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-hidden">
                        <Table className="table-fixed w-full">
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                                    <TableHead className="w-[92px] font-semibold text-xs uppercase tracking-wider py-4 px-3 text-muted-foreground whitespace-nowrap">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('data_emissao')}>
                                            Emissão {getSortIcon('data_emissao')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="w-[160px] font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-3">
                                        <Button variant="ghost" className="h-auto max-w-full truncate p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('id')}>
                                            Documento {getSortIcon('id')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-3">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider" onClick={() => handleSort('favorecido_nome')}>
                                            Favorecido {getSortIcon('favorecido_nome')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="w-[132px] font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-3 text-center">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider mx-auto" onClick={() => handleSort('estado')}>
                                            Situação {getSortIcon('estado')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="w-[112px] font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap border-l border-slate-100/50 px-3 text-right">
                                        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-semibold text-xs uppercase tracking-wider ml-auto" onClick={() => handleSort('valor_original')}>
                                            Bruto {getSortIcon('valor_original')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="w-[112px] text-right font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap px-3 border-l border-slate-100/50">Pago</TableHead>
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
                                        </TableRow>
                                    ))
                                ) : documentos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
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
                                            <TableCell className="whitespace-nowrap font-medium text-xs py-4 px-3 align-top">
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
                                            <TableCell className="py-4 px-3 align-top">
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <span className="font-mono text-[11px] font-black text-primary group-hover:underline underline-offset-4 decoration-primary/30 tracking-tighter truncate">
                                                        {formatDocumentoId(doc.id)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 px-3 align-top">
                                                <div className="flex flex-col min-w-0 gap-0.5">
                                                    <span className="truncate text-xs font-bold leading-tight group-hover:text-primary transition-colors" title={doc.favorecido_nome}>
                                                        {doc.favorecido_nome}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-muted-foreground/80 font-medium">
                                                        {formatarDocumento(doc.favorecido_documento || '')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 px-3 text-center align-top">
                                                <Badge 
                                                    variant={doc.estado === 'REALIZADO' ? 'default' : 'outline'}
                                                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full max-w-full truncate ${
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
                                            <TableCell className="text-right font-black text-[11px] text-primary py-4 px-3 align-top">
                                                {doc.valor_original ? formatCurrency(doc.valor_original) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-[11px] text-emerald-600 dark:text-emerald-400 py-4 px-3 align-top">
                                                 {(() => {
                                                     const vPago = calculateDocumentoValorPago(doc);
                                                     return vPago > 0 ? formatCurrency(vPago) : '-';
                                                 })()}
                                             </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            <TablePagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalRecords}
                pageSize={perPage}
                onPageSizeChange={(value) => {
                    setPerPage(value);
                    setPage(1);
                }}
            />
        </Card>

            <DocumentoDetalhesDialog 
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                documento={selectedDoc}
            />
        </div>
    );
}




