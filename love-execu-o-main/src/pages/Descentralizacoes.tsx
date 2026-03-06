import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Filter, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Descentralizacao, DIMENSOES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { HeaderSubtitle, HeaderActions } from '@/components/HeaderParts';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const initialFormState = {
    dimensao: '',
    origemRecurso: '',
    planoInterno: '',
    valor: 0,
};

export default function Descentralizacoes() {
    const { descentralizacoes, isLoading, addDescentralizacao, updateDescentralizacao, deleteDescentralizacao } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDimensao, setFilterDimensao] = useState('all');
    const [filterOrigem, setFilterOrigem] = useState('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Descentralizacao; direction: 'asc' | 'desc' } | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedDescentralizacao, setSelectedDescentralizacao] = useState<Descentralizacao | null>(null);
    const [formData, setFormData] = useState(initialFormState);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Extrair opções únicas para os filtros
    const origensUnicas = Array.from(new Set(descentralizacoes.map(d => d.origemRecurso?.trim()).filter(Boolean))).sort();

    const filteredDescentralizacoes = descentralizacoes.filter((d) => {
        const matchesSearch =
            d.dimensao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.origemRecurso.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.planoInterno || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDimensao = filterDimensao === 'all' || d.dimensao.includes(filterDimensao);
        const matchesOrigem = filterOrigem === 'all' || d.origemRecurso?.trim() === filterOrigem;

        return matchesSearch && matchesDimensao && matchesOrigem;
    });

    const sortedDescentralizacoes = [...filteredDescentralizacoes].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key] ?? '';
        let bValue = b[key] ?? '';
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const requestSort = (key: keyof Descentralizacao) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (columnName: keyof Descentralizacao) => {
        if (!sortConfig || sortConfig.key !== columnName) {
            return <ArrowUpDown className="ml-2 h-4 w-4" />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="ml-2 h-4 w-4" />
            : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    // Total descentralizado filtrado
    const totalFiltrado = sortedDescentralizacoes.reduce((sum, d) => sum + d.valor, 0);

    const handleOpenDialog = (descentralizacao?: Descentralizacao) => {
        if (descentralizacao) {
            setSelectedDescentralizacao(descentralizacao);
            setFormData({
                dimensao: descentralizacao.dimensao,
                origemRecurso: descentralizacao.origemRecurso,
                planoInterno: descentralizacao.planoInterno || '',
                valor: descentralizacao.valor,
            });
        } else {
            setSelectedDescentralizacao(null);
            setFormData(initialFormState);
        }
        setIsDialogOpen(true);
    };

    const handleSubmit = () => {
        if (selectedDescentralizacao) {
            updateDescentralizacao(selectedDescentralizacao.id, formData);
        } else {
            addDescentralizacao(formData);
        }
        setIsDialogOpen(false);
        setFormData(initialFormState);
    };

    const handleDelete = () => {
        if (selectedDescentralizacao) {
            deleteDescentralizacao(selectedDescentralizacao.id);
            setIsDeleteDialogOpen(false);
            setSelectedDescentralizacao(null);
        }
    };

    const openDeleteDialog = (descentralizacao: Descentralizacao) => {
        setSelectedDescentralizacao(descentralizacao);
        setIsDeleteDialogOpen(true);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(sortedDescentralizacoes.map((d) => d.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = () => {
        selectedIds.forEach((id) => deleteDescentralizacao(id));
        setSelectedIds(new Set());
        setIsDeleteDialogOpen(false);
        toast.success(`${selectedIds.size} descentralizações excluídas com sucesso!`);
    };

    const handleJsonImport = (data: Record<string, string>[]) => {
        let importCount = 0;
        data.forEach((row) => {
            // Formata a origem recurso para extrair o PTRES
            let origemRecurso = row['origemrecurso'] || row['origem_recurso'] || '';
            const ptresMatch = origemRecurso.match(/\b(\d{6})\b/);
            if (ptresMatch) origemRecurso = ptresMatch[1];

            const descentralizacao = {
                dimensao: row['dimensao'] || '',
                origemRecurso,
                planoInterno: row['planointerno'] || row['plano_interno'] || '',
                valor: parseCurrency(row['valor'] || '0'),
            };
            if (descentralizacao.dimensao && descentralizacao.valor > 0) {
                addDescentralizacao(descentralizacao);
                importCount++;
            }
        });
        toast.success(`${importCount} descentralização(ões) importada(s) com sucesso!`);
    };

    const descentralizacoesJsonFields = ['dimensao', 'origemrecurso', 'planointerno', 'valor'];

    return (
        <div className="space-y-6 animate-fade-in">
            <HeaderSubtitle>Gerencie os recursos descentralizados pela reitoria</HeaderSubtitle>
            <HeaderActions>
                {selectedIds.size > 0 && (
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="gap-2 h-8 text-xs sm:h-9 sm:text-sm">
                        <Trash2 className="h-4 w-4" />
                        Excluir ({selectedIds.size})
                    </Button>
                )}
                <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="gap-2 h-8 text-xs sm:h-9 sm:text-sm">
                    <Upload className="h-4 w-4" />
                    Importar JSON
                </Button>
                <Button onClick={() => handleOpenDialog()} className="gap-2 h-8 text-xs sm:h-9 sm:text-sm">
                    <Plus className="h-4 w-4" />
                    Nova Descentralização
                </Button>
            </HeaderActions>

            {/* Filters */}
            <Card className="">
                <CardHeader className="pb-3">
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por dimensão, origem ou plano..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Dimensão" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as dimensões</SelectItem>
                                    {DIMENSOES.map((d) => (
                                        <SelectItem key={d.codigo} value={d.codigo}>
                                            {d.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant={showAdvancedFilters ? "secondary" : "outline"}
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Filtros Avançados
                        </Button>
                    </div>

                    {showAdvancedFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50 animate-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Origem de Recurso</label>
                                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {origensUnicas.map(origem => (
                                            <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    className="w-full text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setFilterDimensao('all');
                                        setFilterOrigem('all');
                                        setSearchTerm('');
                                    }}
                                >
                                    Limpar Filtros
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>
                            {sortedDescentralizacoes.length} {sortedDescentralizacoes.length !== 1 ? 'descentralizações' : 'descentralização'} encontrada{sortedDescentralizacoes.length !== 1 ? 's' : ''}
                        </span>
                        <Badge variant="secondary" className="text-base px-3 py-1">
                            Total: {formatCurrency(totalFiltrado)}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="py-3 px-4 w-[40px]">
                                        <Checkbox
                                            checked={
                                                sortedDescentralizacoes.length > 0 &&
                                                sortedDescentralizacoes.every((d) => selectedIds.has(d.id))
                                            }
                                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        />
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('dimensao')}>
                                            Dimensão {getSortIcon('dimensao')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('origemRecurso')}>
                                            Origem de Recurso {getSortIcon('origemRecurso')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('planoInterno')}>
                                            Plano Interno {getSortIcon('planoInterno')}
                                        </Button>
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium justify-end w-full" onClick={() => requestSort('valor')}>
                                            Valor {getSortIcon('valor')}
                                        </Button>
                                    </th>
                                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border/50">
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-4 rounded" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-5 w-16" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-24 ml-auto" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-8 w-16 mx-auto" /></td>
                                        </tr>
                                    ))
                                ) : sortedDescentralizacoes.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-6 text-muted-foreground italic">Nenhuma descentralização encontrada.</td>
                                    </tr>
                                ) : (
                                    sortedDescentralizacoes.map((descentralizacao) => (
                                        <tr key={descentralizacao.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                            <td className="py-4 px-4">
                                                <Checkbox
                                                    checked={selectedIds.has(descentralizacao.id)}
                                                    onCheckedChange={(checked) => handleSelectOne(descentralizacao.id, checked as boolean)}
                                                />
                                            </td>
                                            <td className="py-4 px-4">
                                                <Badge variant="secondary" className="whitespace-nowrap">
                                                    {descentralizacao.dimensao.split(' - ')[0]}
                                                </Badge>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm font-medium">{descentralizacao.origemRecurso}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground">{descentralizacao.planoInterno || '-'}</span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className="font-medium">{formatCurrency(descentralizacao.valor)}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenDialog(descentralizacao)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openDeleteDialog(descentralizacao)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Form Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDescentralizacao ? 'Editar Descentralização' : 'Nova Descentralização'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="dimensao">Dimensão</Label>
                            <Select
                                value={formData.dimensao}
                                onValueChange={(v) => setFormData({ ...formData, dimensao: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a dimensão" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DIMENSOES.map((d) => (
                                        <SelectItem key={d.codigo} value={d.nome}>
                                            {d.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="origemRecurso">Origem de Recurso (PTRES)</Label>
                            <Input
                                id="origemRecurso"
                                value={formData.origemRecurso}
                                onChange={(e) => setFormData({ ...formData, origemRecurso: e.target.value })}
                                placeholder="Ex: 231796"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="planoInterno">Plano Interno</Label>
                            <Input
                                id="planoInterno"
                                value={formData.planoInterno}
                                onChange={(e) => setFormData({ ...formData, planoInterno: e.target.value })}
                                placeholder="Ex: L20RLP99GON"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="valor">Valor (R$)</Label>
                            <Input
                                id="valor"
                                type="number"
                                value={formData.valor}
                                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit}>
                            {selectedDescentralizacao ? 'Salvar' : 'Criar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            {selectedIds.size > 0 && !selectedDescentralizacao
                                ? `Tem certeza que deseja excluir as ${selectedIds.size} descentralizações selecionadas? Esta ação não pode ser desfeita.`
                                : `Tem certeza que deseja excluir esta descentralização? Esta ação não pode ser desfeita.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={selectedDescentralizacao ? handleDelete : handleBulkDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* JSON Import Dialog */}
            <JsonImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleJsonImport}
                title="Importar Descentralizações"
                expectedFields={descentralizacoesJsonFields}
            />
        </div>
    );
}
