import { useState } from 'react';
import { Trash2, Search, Filter, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Descentralizacao, DIMENSOES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

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
import { HeaderActions } from '@/components/HeaderParts';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// Mapeamento de sufixo de PI para código de dimensão
const PI_DIMENSAO_MAP: Record<string, string> = {
    'AD': 'AD - Administração',
    'AE': 'AE - Atividades Estudantis',
    'CI': 'CI - Comunicação Institucional',
    'EN': 'EN - Ensino',
    'EX': 'EX - Extensão',
    'GE': 'GE - Gestão Estratégica e Desenvolvimento Institucional',
    'GO': 'GO - Governança',
    'GP': 'GP - Gestão de Pessoas',
    'IE': 'IE - Infraestrutura',
    'IN': 'IN - Internacionalização',
    'PI': 'PI - Pesquisa, Pós-Graduação e Inovação',
    'TI': 'TI - Tecnologia da Informação e Comunicação',
};

function deriveDimensaoFromPI(planoInterno: string): string {
    const pi = planoInterno.trim().toUpperCase();
    if (pi.length >= 3) {
        const suffix = pi.substring(pi.length - 3, pi.length - 1); // ex: "ADN" → "AD"
        return PI_DIMENSAO_MAP[suffix] || '';
    }
    return '';
}

function formatDateBR(date: Date | undefined): string {
    if (!date) return '-';
    return date.toLocaleDateString('pt-BR');
}

function parseDateBR(dateStr: string): Date | undefined {
    // Aceita dd/mm/yyyy
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts;
        const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
        if (!isNaN(d.getTime())) return d;
    }
    // Aceita yyyy-mm-dd
    const d2 = new Date(dateStr);
    if (!isNaN(d2.getTime())) return d2;
    return undefined;
}

function parseValorBR(valorStr: string): number {
    // Handle Brazilian number format: 1.000,50 → 1000.50
    const cleaned = valorStr
        .trim()
        .replace(/\./g, '')   // remove thousands separator
        .replace(',', '.');    // decimal separator
    return parseFloat(cleaned) || 0;
}

export default function Descentralizacoes() {
    const { descentralizacoes, isLoading, addDescentralizacao, deleteDescentralizacao } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDimensao, setFilterDimensao] = useState('all');
    const [filterOrigem, setFilterOrigem] = useState('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Descentralizacao; direction: 'asc' | 'desc' } | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Extrair opções únicas para os filtros
    const origensUnicas = Array.from(new Set(descentralizacoes.map(d => d.origemRecurso?.trim()).filter(Boolean))).sort();

    const filteredDescentralizacoes = descentralizacoes.filter((d) => {
        const matchesSearch =
            d.dimensao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.origemRecurso.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.planoInterno || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (d.descricao || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDimensao = filterDimensao === 'all' || d.dimensao.includes(filterDimensao);
        const matchesOrigem = filterOrigem === 'all' || d.origemRecurso?.trim() === filterOrigem;

        return matchesSearch && matchesDimensao && matchesOrigem;
    });

    const sortedDescentralizacoes = [...filteredDescentralizacoes].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        let aValue = a[key] ?? '';
        let bValue = b[key] ?? '';
        if (aValue instanceof Date) aValue = aValue.getTime();
        if (bValue instanceof Date) bValue = bValue.getTime();
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

    const handleCsvImport = (data: Record<string, string>[]) => {
        // Build deduplication set from existing records (in memory)
        const existingKeys = new Set(
            descentralizacoes.map(d => {
                const dateStr = d.dataEmissao ? d.dataEmissao.toISOString().split('T')[0] : '';
                return `${dateStr}|${(d.planoInterno || '').trim().toUpperCase()}|${(d.origemRecurso || '').trim()}|${(d.naturezaDespesa || '').trim()}|${d.valor}`;
            })
        );

        let importCount = 0;
        let skipCount = 0;

        data.forEach((row) => {
            const planoInterno = row['nccelula-planointerno'] || row['planointerno'] || row['plano_interno'] || '';
            const origemRecurso = row['nccelula-ptres'] || row['origemrecurso'] || row['origem_recurso'] || '';
            const naturezaDespesa = row['nccelula-naturezadespesa'] || row['naturezadespesa'] || row['natureza_despesa'] || '';
            const valorStr = row['nccelula-valor'] || row['valor'] || '0';
            const dataEmissaoStr = row['nc-diaemissao'] || row['dataemissao'] || row['data_emissao'] || '';
            const descricao = row['nc-descricao'] || row['descricao'] || '';

            const piNorm = planoInterno.trim().toUpperCase();
            const orNorm = origemRecurso.trim();
            const ndNorm = naturezaDespesa.trim();
            const valor = parseValorBR(valorStr);

            // Check for duplicate (date + PI + PTRES + ND + valor)
            const dataEmissao = parseDateBR(dataEmissaoStr);
            const dateKey = dataEmissao ? dataEmissao.toISOString().split('T')[0] : '';
            const key = `${dateKey}|${piNorm}|${orNorm}|${ndNorm}|${valor}`;
            if (existingKeys.has(key)) {
                skipCount++;
                return;
            }

            const dimensao = deriveDimensaoFromPI(planoInterno);

            const descentralizacao: any = {
                dimensao,
                origemRecurso: orNorm,
                naturezaDespesa: ndNorm,
                planoInterno: piNorm,
                descricao: descricao.trim(),
                valor,
            };

            if (dataEmissao) {
                descentralizacao.dataEmissao = dataEmissao;
            }

            if (valor > 0) {
                addDescentralizacao(descentralizacao);
                existingKeys.add(key); // prevent duplicates within the same CSV
                importCount++;
            }
        });

        if (importCount > 0 && skipCount > 0) {
            toast.success(`${importCount} nova(s) importada(s), ${skipCount} já existente(s) ignorada(s).`);
        } else if (importCount > 0) {
            toast.success(`${importCount} descentralização(ões) importada(s) com sucesso!`);
        } else {
            toast.info(`Nenhum registro novo encontrado. ${skipCount} já existente(s) ignorada(s).`);
        }
    };

    const descentralizacoesCsvFields = [
        'NC - Dia Emissão',
        'NC - Descrição',
        'NC Célula - PTRES',
        'NC Célula - Natureza Despesa',
        'NC Célula - Plano Interno',
        'NC Célula - Valor',
    ];
    return (
        <div className="space-y-space-6 pb-space-10">
            <HeaderActions>
                {selectedIds.size > 0 && (
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="gap-space-2 h-space-8 text-text-xs sm:h-space-9 sm:text-text-sm shadow-shadow-sm transition-all">
                        <Trash2 className="h-4 w-4" />
                        Excluir ({selectedIds.size})
                    </Button>
                )}
                <Button 
                    variant="outline" 
                    onClick={() => setIsImportDialogOpen(true)} 
                    className="gap-space-2 h-space-8 text-text-xs sm:h-space-9 sm:text-text-sm bg-surface-card border-border-default shadow-shadow-sm transition-all"
                >
                    <Upload className="h-4 w-4 text-action-primary" />
                    Importar CSV
                </Button>
            </HeaderActions>

            {/* Filters */}
            <Card className="card-system">
                <CardHeader className="pb-space-3">
                    <CardTitle className="text-text-lg font-font-bold">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="space-y-space-4">
                    <div className="flex flex-col sm:flex-row gap-space-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-space-3 top-1/2 -translate-y-1/2 h-space-4 w-space-4 text-text-muted" />
                            <Input
                                placeholder="Buscar por dimensão, origem, plano ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-space-10 input-system"
                            />
                        </div>
                        <div className="w-full sm:w-[200px]">
                            <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                                <SelectTrigger className="input-system">
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
                            className="gap-space-2"
                        >
                            <Filter className="w-4 h-4" />
                            Filtros Avançados
                        </Button>
                    </div>

                    {showAdvancedFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-4 p-space-4 bg-surface-subtle/30 rounded-radius-lg border border-border-default/50">
                            <div className="space-y-space-2">
                                <label className="text-text-sm font-font-medium">Origem de Recurso</label>
                                <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                                    <SelectTrigger className="input-system">
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
            <Card className="card-system">
                <CardHeader className="pb-space-2">
                    <CardTitle className="text-text-lg font-font-bold flex items-center justify-between">
                        <span>
                            {sortedDescentralizacoes.length} {sortedDescentralizacoes.length !== 1 ? 'descentralizações' : 'descentralização'} encontrada{sortedDescentralizacoes.length !== 1 ? 's' : ''}
                        </span>
                        <Badge variant="secondary" className="text-text-sm px-space-3 py-space-1 bg-surface-subtle border-border-default">
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
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('dataEmissao')}>
                                            Data {getSortIcon('dataEmissao')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('dimensao')}>
                                            Dimensão {getSortIcon('dimensao')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('origemRecurso')}>
                                            PTRES {getSortIcon('origemRecurso')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('naturezaDespesa')}>
                                            ND {getSortIcon('naturezaDespesa')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('planoInterno')}>
                                            PI {getSortIcon('planoInterno')}
                                        </Button>
                                    </th>
                                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground max-w-[200px]">
                                        Descrição
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-medium justify-end w-full" onClick={() => requestSort('valor')}>
                                            Valor {getSortIcon('valor')}
                                        </Button>
                                    </th>

                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border/50">
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-4 rounded" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-5 w-16" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-16" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-28" /></td>
                                            <td className="py-4 px-2"><Skeleton className="h-4 w-32" /></td>
                                            <td className="py-4 px-4"><Skeleton className="h-4 w-24 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : sortedDescentralizacoes.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-6 text-muted-foreground italic">Nenhuma descentralização encontrada.</td>
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
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDateBR(descentralizacao.dataEmissao)}</span>
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
                                                <span className="text-sm text-muted-foreground">{descentralizacao.naturezaDespesa || '-'}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground">{descentralizacao.planoInterno || '-'}</span>
                                            </td>
                                            <td className="py-4 px-2 max-w-[200px]">
                                                <span className="text-xs text-muted-foreground line-clamp-2" title={descentralizacao.descricao || ''}>
                                                    {descentralizacao.descricao || '-'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <span className="font-medium">{formatCurrency(descentralizacao.valor)}</span>
                                            </td>

                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>


            {/* Delete Confirmation */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            {`Tem certeza que deseja excluir as ${selectedIds.size} descentralizações selecionadas? Esta ação não pode ser desfeita.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* CSV/JSON Import Dialog */}
            <JsonImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleCsvImport}
                title="Importar Descentralizações"
                expectedFields={descentralizacoesCsvFields}
                acceptCsv={true}
                csvSeparator=";"
            />
        </div>
    );
}
