import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { transparenciaService } from '@/services/transparencia';
import { DocumentoDespesa } from '@/types';
import { formatCurrency } from '@/lib/utils';
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
import { RefreshCw, Search, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, Filter as FilterIcon, X, Eye } from 'lucide-react';
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

export default function LiquidacoesPagamentos() {
    const queryClient = useQueryClient();
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState('');

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterFase, setFilterFase] = useState('all');
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
        queryKey: ['transparencia', startDate, endDate, filterFase, searchTerm, page, perPage, sortColumn, sortDirection],
        queryFn: () => transparenciaService.getDocumentos({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            fase: filterFase,
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
        setFilterFase('all');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleViewDetails = (doc: DocumentoDespesa) => {
        setSelectedDocumento(doc);
        setDetailsOpen(true);
    };

    // Calcular valor total da página atual (ou total geral se a API retornasse aggregated sum, mas aqui fazemos client-side da pagina)
    // Para KPI "Valor Total (Filtro)" idealmente precisariamos de uma rota de agregação no backend/Supabase.
    // Por enquanto, vamos omitir ou mostrar "Valor na Página" para ser preciso, ou remover o card se for confuso.
    // Vamos mostrar "Valor nesta página"

    const pageTotalValue = documentos.reduce((acc, doc) => acc + doc.valor, 0);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <DocumentoDetalhesDialog
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                documento={selectedDocumento}
            />

            <HeaderSubtitle>Portal da Transparência (01/01/2026 em diante)</HeaderSubtitle>
            <HeaderActions>
                <div className="flex gap-2">
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="gap-2 h-8 text-xs sm:h-9 sm:text-sm"
                        variant="outline"
                    >
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                </div>
            </HeaderActions>

            {isSyncing && (
                <Card className="bg-muted/50 border-primary/20">
                    <CardContent className="pt-6 pb-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{syncStatus}</span>
                                <span>{Math.round(syncProgress)}%</span>
                            </div>
                            <Progress value={syncProgress} className="h-2" />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* KPI Resumo */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Registros (Filtro)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalRecords}</div>
                    </CardContent>
                </Card>
                <Card className="">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Valor (Página Atual)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-primary">{formatCurrency(pageTotalValue)}</div>
                    </CardContent>
                </Card>
                <Card className="">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Última Atualização</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">
                            {format(new Date(), 'dd/MM HH:mm')}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filtros em Grid */}
            <Card className="">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FilterIcon className="h-4 w-4" /> Filtros
                    </CardTitle>
                    {(searchTerm || filterFase !== 'all' || startDate || endDate) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3 mr-1" /> Limpar
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="pl-9"
                            />
                        </div>
                        <div>
                            <Select value={filterFase} onValueChange={(val) => { setFilterFase(val); setPage(1); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Fase" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Fases</SelectItem>
                                    <SelectItem value="Liquidação">Liquidação</SelectItem>
                                    <SelectItem value="Pagamento">Pagamento</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Input
                                type="date"
                                placeholder="Data Início"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                                className="w-full" // Ensure input takes full width of grid cell
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                placeholder="Data Fim"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                                className="w-full"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela */}
            <Card className="">
                <CardContent className="p-0">
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('data_emissao')}>
                                        <div className="flex items-center gap-1">
                                            Data {sortColumn === 'data_emissao' && <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('documento')}>
                                        <div className="flex items-center gap-1">
                                            Documento {sortColumn === 'documento' && <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('fase')}>
                                        <div className="flex items-center gap-1">
                                            Fase {sortColumn === 'fase' && <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('favorecido_nome')}>
                                        <div className="flex items-center gap-1">
                                            Favorecido {sortColumn === 'favorecido_nome' && <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </TableHead>
                                    <TableHead>Observação</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('valor')}>
                                        <div className="flex items-center justify-end gap-1">
                                            Valor {sortColumn === 'valor' && <ArrowUpDown className="h-3 w-3" />}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <span className="text-sm text-muted-foreground">Carregando dados...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : documentos.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                            Nenhum registro encontrado com os filtros atuais.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    documentos.map((doc) => (
                                        <TableRow key={doc.id} className="group hover:bg-muted/50">
                                            <TableCell className="whitespace-nowrap font-medium text-xs">
                                                {format(doc.dataEmissao, 'dd/MM/yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs font-medium">{doc.documentoResumido}</span>
                                                    {doc.empenhoDocumento && (
                                                        <span className="text-[10px] text-muted-foreground" title="Empenho Associado">
                                                            Ref: {doc.empenhoDocumento}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={doc.fase === 'Pagamento' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                                    {doc.fase}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col max-w-[180px]">
                                                    <span className="truncate text-xs font-medium" title={doc.favorecidoNome}>{doc.favorecidoNome}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate">{doc.favorecidoDocumento}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]" title={doc.observacao}>{doc.observacao}</span>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-xs">
                                                {(() => {
                                                    const valor = doc.valorLiquidado || doc.valorRestoPago || doc.valor;
                                                    return valor === 0 ? '-' : formatCurrency(valor);
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleViewDetails(doc)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Footer Paginação */}
                    <div className="flex items-center justify-between px-2 py-4 border-t">
                        <div className="text-xs text-muted-foreground">
                            Mostrando <strong>{((page - 1) * perPage) + 1}</strong> a <strong>{Math.min(page * perPage, totalRecords)}</strong> de <strong>{totalRecords}</strong> registros
                        </div>
                        <div className="flex items-center space-x-2">
                            <Select value={String(perPage)} onValueChange={(val) => { setPerPage(Number(val)); setPage(1); }}>
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={String(perPage)} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                                Página {page} de {totalPages || 1}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPage(page - 1)}
                                disabled={page <= 1 || isLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setPage(page + 1)}
                                disabled={page >= totalPages || isLoading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
