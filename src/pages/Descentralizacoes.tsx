import { useState } from 'react';
import { Trash2, Search, Filter, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Descentralizacao, DIMENSOES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
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

import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { HeaderActions } from '@/components/HeaderParts';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { descentralizacoesService } from '@/services/descentralizacoes';

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

const normalizeKey = (key) => key.normalize('NFD').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export default function Descentralizacoes() {
    const { descentralizacoes, isLoading, addDescentralizacao, deleteDescentralizacao, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDimensao, setFilterDimensao] = useState('all');
    const [filterOrigem, setFilterOrigem] = useState('all');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Descentralizacao; direction: 'asc' | 'desc' } | null>(null);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [isDevolucoesDialogOpen, setIsDevolucoesDialogOpen] = useState(false);

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

        const findValue = (row: Record<string, string>, patterns: RegExp[], fallbacks: string[] = []) => {
            for (const key of fallbacks) {
                if (row[key] != null && String(row[key]).trim() !== '') return row[key];
            }
            const keys = Object.keys(row);
            for (const k of keys) {
                if (patterns.some(p => p.test(k))) {
                    const v = row[k];
                    if (v != null && String(v).trim() !== '') return v;
                }
            }
            return '';
        };

        data.forEach((row) => {
            // O JsonImportDialog normaliza headers removendo acentos e tudo que não é [a-z0-9].
            // Para os seus arquivos, as chaves mais comuns ficam como: ncdiaemissao, ncdescricao,
            // nccelulaptres, nccelulanaturezadespesa, nccelulaplanointerno, nccelulavalor.
            const planoInterno = findValue(row, [/planointern/i, /plano/i], ['nccelulaplanointerno', 'planointerno', 'plano_interno', 'plano']);
            const origemRecurso = findValue(row, [/ptres/i, /origemrecurso/i, /origem/i], ['nccelulaptres', 'origemrecurso', 'origem_recurso', 'ptres']);
            const naturezaDespesa = findValue(row, [/naturezadesp/i, /natureza/i], ['nccelulanaturezadespesa', 'naturezadespesa', 'natureza_despesa', 'natureza']);
            const valorStr = findValue(row, [/valor/i], ['nccelulavalor', 'valor']);
            const dataEmissaoStr = findValue(row, [/diaemiss/i, /dataemiss/i, /data/i], ['ncdiaemissao', 'dataemissao', 'data_emissao']);
            const descricao = findValue(row, [/descr/i], ['ncdescricao', 'descricao', 'ncdrescricao']);

            const piNorm = planoInterno.trim().toUpperCase();
            const orNorm = origemRecurso.trim();
            const ndNorm = naturezaDespesa.trim();
            let valor = parseValorBR(valorStr || '0');

            // Se for devolução, o valor deve ser negativo
            const isDevolucao = descricao.toUpperCase().includes('DEVOLUCAO');
            if (isDevolucao) {
                valor = -Math.abs(valor);
            }

            // Check for duplicate (date + PI + PTRES + ND + valor)
            const dataEmissao = parseDateBR(dataEmissaoStr);
            const dateKey = dataEmissao ? dataEmissao.toISOString().split('T')[0] : '';
            const key = `${dateKey}|${piNorm}|${orNorm}|${ndNorm}|${valor}`;
            if (existingKeys.has(key)) {
                skipCount++;
                return;
            }

            const dimensao = deriveDimensaoFromPI(planoInterno);

            const descentralizacao: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'> = {
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

            if (valor !== 0) {
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

    const handleDevolucoesImport = async (data: Record<string, string>[]) => {
        let importCount = 0;
        let skipCount = 0;

        const existingKeys = new Set(
            descentralizacoes.map(d => {
                const dateStr = d.dataEmissao ? d.dataEmissao.toISOString().split('T')[0] : '';
                return `${dateStr}|${(d.origemRecurso || '').trim()}|${(d.naturezaDespesa || '').trim()}|${(d.planoInterno || '').trim().toUpperCase()}|${d.valor}`;
            })
        );

        const findValue = (row: Record<string, string>, patterns: RegExp[], fallbacks: string[] = []) => {
            for (const key of fallbacks) {
                if (row[key] != null && String(row[key]).trim() !== '') return row[key];
            }
            const keys = Object.keys(row);
            for (const k of keys) {
                if (patterns.some(p => p.test(k))) {
                    const v = row[k];
                    if (v != null && String(v).trim() !== '') return v;
                }
            }
            return '';
        };

        for (const row of data) {
            // Obs: o JsonImportDialog já normaliza as chaves (lowercase + remove acentos + remove não-alfanuméricos),
            // mas quando o CSV vem com encoding ruim, algumas letras podem "sumir". Por isso, buscamos por padrões.
            const diaEmissaoStr = findValue(row, [/diaemiss/i, /ncdiaemiss/i], ['ncdiaemissao', 'ncdiaemisso', 'dataemissao', 'data']);
            const descricao = findValue(row, [/descr/i, /ncdescr/i], ['ncdescricao', 'descricao']);
            const ptres = findValue(row, [/ptres/i], ['nccelulaptres', 'ptres', 'origemrecurso']);
            const naturezaDespesa = findValue(row, [/naturezadesp/i, /natureza/i], ['nccelulanaturezadespesa', 'naturezadespesa', 'natureza']);
            const planoInterno = findValue(row, [/planointern/i, /plano/i], ['nccelulaplanointerno', 'planointerno', 'plano']);
            const valorStr = findValue(row, [/valor/i], ['nccelulavalor', 'valor']);

            if (!diaEmissaoStr || !ptres || !naturezaDespesa || !planoInterno || valorStr === undefined || valorStr === null) {
                skipCount++;
                continue;
            }

            const dataEmissao = parseDateBR(diaEmissaoStr);
            if (!dataEmissao) {
                skipCount++;
                continue;
            }

            const parsedValor = parseValorBR(String(valorStr));
            if (!parsedValor || isNaN(parsedValor)) {
                skipCount++;
                continue;
            }

            const piNorm = String(planoInterno).trim().toUpperCase();
            const ptresNorm = String(ptres).trim();
            const ndNorm = String(naturezaDespesa).trim();
            const descricaoNorm = String(descricao || '').trim() || 'DEVOLUCAO';
            const dateKey = dataEmissao.toISOString().split('T')[0];
            const valorNeg = -Math.abs(parsedValor);

            const key = `${dateKey}|${ptresNorm}|${ndNorm}|${piNorm}|${valorNeg}`;
            if (existingKeys.has(key)) {
                skipCount++;
                continue;
            }

            const dimensao = deriveDimensaoFromPI(piNorm);

            const result = await descentralizacoesService.processDevolucao({
                dataEmissao: dateKey,
                descricao: descricaoNorm,
                ptres: ptresNorm,
                naturezaDespesa: ndNorm,
                planoInterno: piNorm,
                valor: parsedValor,
                dimensao,
            });

            if (result) {
                importCount++;
                existingKeys.add(key);
            } else {
                skipCount++;
            }
        }

        await refreshData();
        toast.success(`${importCount} devolução(ões) processada(s), ${skipCount} linha(s) ignorada(s).`);
    };

    const processDevolucao = (devolucao: Record<string, unknown>) => {
        // Implementar lógica para ajustar os saldos com base nas devoluções
        console.log("Processando devolução:", devolucao);
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
        <div className="space-y-6 pb-10">
            <HeaderActions>
                {selectedIds.size > 0 && (
                    <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="gap-2 h-8 text-xs sm:h-9 sm:text-sm shadow-sm transition-all">
                        <Trash2 className="h-4 w-4" />
                        Excluir ({selectedIds.size})
                    </Button>
                )}
                <Button 
                    variant="outline" 
                    onClick={() => setIsImportDialogOpen(true)} 
                    className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm transition-all"
                >
                    <Upload className="h-4 w-4 text-action-primary" />
                    Importar CSV
                </Button>
                <Button 
                    variant="outline" 
                    onClick={() => setIsDevolucoesDialogOpen(true)} 
                    className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm transition-all"
                >
                    <Upload className="h-4 w-4 text-action-primary" />
                    Importar Devoluções
                </Button>
            </HeaderActions>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Descentralizado"
                    value={formatCurrency(totalFiltrado)}
                    icon={Upload}
                    stitchColor="vibrant-blue"
                />
                <StatCard
                    title="Quantidade de NCs"
                    value={sortedDescentralizacoes.length}
                    icon={Filter}
                    stitchColor="purple"
                />
                <StatCard
                    title="Maior Valor"
                    value={formatCurrency(Math.max(0, ...sortedDescentralizacoes.map(d => d.valor)))}
                    icon={Search}
                    stitchColor="amber"
                />
                <StatCard
                    title="Origens Únicas"
                    value={origensUnicas.length}
                    icon={Filter}
                    stitchColor="emerald-green"
                />
            </div>

            {/* Filters */}
            <Card className="card-system">
                <CardHeader className="pb-3 px-0 pt-0">
                    <CardTitle className="text-xl font-bold">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por dimensão, origem, plano ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 text-sm input-system"
                            />
                        </div>
                        <div className="w-full sm:w-[150px]">
                            <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                                <SelectTrigger className="input-system h-10">
                                    <SelectValue placeholder="Dimensão" />
                                </SelectTrigger>
                                <SelectContent className="rounded-sm">
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
                            className="gap-2 h-10 font-bold"
                        >
                            <Filter className="w-4 h-4" />
                            Opções
                        </Button>
                    </div>

                    {showAdvancedFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/50 rounded-lg border border-border-default/50">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-600">Origem de Recurso</label>
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
            <Card className="card-system overflow-hidden border-none shadow-none mt-6">
                <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                        <span>{sortedDescentralizacoes.length} {sortedDescentralizacoes.length !== 1 ? 'descentralizações' : 'descentralização'} encontrada{sortedDescentralizacoes.length !== 1 ? 's' : ''}</span>
                    </CardTitle>
                    <Badge variant="secondary" className="text-sm px-3 py-1 bg-slate-100 text-slate-700 border-none">
                        Total: {formatCurrency(totalFiltrado)}
                    </Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                                    <TableHead className="h-11 px-6 w-10">
                                        <Checkbox
                                            checked={
                                                sortedDescentralizacoes.length > 0 &&
                                                sortedDescentralizacoes.every((d) => selectedIds.has(d.id))
                                            }
                                            onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                        />
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider" onClick={() => requestSort('dataEmissao')}>
                                            Data {getSortIcon('dataEmissao')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider" onClick={() => requestSort('dimensao')}>
                                            Dimensão {getSortIcon('dimensao')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider" onClick={() => requestSort('origemRecurso')}>
                                            PTRES {getSortIcon('origemRecurso')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider" onClick={() => requestSort('naturezaDespesa')}>
                                            ND {getSortIcon('naturezaDespesa')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider" onClick={() => requestSort('planoInterno')}>
                                            PI {getSortIcon('planoInterno')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider max-w-[200px]">
                                        Descrição
                                    </TableHead>
                                    <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">
                                        <Button variant="ghost" className="hover:bg-transparent px-0 font-semibold text-xs uppercase tracking-wider justify-end w-full" onClick={() => requestSort('valor')}>
                                            Valor {getSortIcon('valor')}
                                        </Button>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="px-6"><Skeleton className="h-4 w-4 rounded" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-5 w-16" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell className="px-4"><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell className="px-6"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : sortedDescentralizacoes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">Nenhuma descentralização encontrada.</TableCell>
                                    </TableRow>
                                ) : (
                                    sortedDescentralizacoes.map((descentralizacao) => (
                                        <TableRow key={descentralizacao.id} className="hover:bg-slate-50/80 transition-colors border-b last:border-0">
                                            <TableCell className="py-4 px-6">
                                                <Checkbox
                                                    checked={selectedIds.has(descentralizacao.id)}
                                                    onCheckedChange={(checked) => handleSelectOne(descentralizacao.id, checked as boolean)}
                                                />
                                            </TableCell>
                                            <TableCell className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDateBR(descentralizacao.dataEmissao)}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-4">
                                                <Badge variant="secondary" className="whitespace-nowrap font-medium bg-slate-100 text-slate-700">
                                                    {descentralizacao.dimensao.split(' - ')[0]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4 px-4">
                                                <span className="text-sm font-medium">{descentralizacao.origemRecurso}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground">{descentralizacao.naturezaDespesa || '-'}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-4">
                                                <span className="text-sm text-muted-foreground">{descentralizacao.planoInterno || '-'}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-4 max-w-[200px]">
                                                <span className="text-xs text-muted-foreground line-clamp-2" title={descentralizacao.descricao || ''}>
                                                    {descentralizacao.descricao || '-'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-4 px-6 text-right">
                                                <span className={`font-bold text-sm ${descentralizacao.valor < 0 ? 'text-red-600' : 'text-action-primary'}`}>
                                                    {formatCurrency(descentralizacao.valor)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>


            <ConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={handleBulkDelete}
                title="Confirmar exclusão"
                description={`Tem certeza que deseja excluir as ${selectedIds.size} descentralizações selecionadas? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
            />

            {/* CSV/JSON Import Dialog */}
            <JsonImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onImport={handleCsvImport}
                title="Importar Descentralizações"
                expectedFields={descentralizacoesCsvFields}
                acceptCsv={true}
                csvSeparator="\t"
            />
            <JsonImportDialog
                open={isDevolucoesDialogOpen}
                onOpenChange={setIsDevolucoesDialogOpen}
                onImport={handleDevolucoesImport}
                title="Importar Devoluções"
                expectedFields={["NC - Dia Emissão", "NC - Descrição", "NC Célula - PTRES", "NC Célula - Natureza Despesa", "NC Célula - Plano Interno", "NC Célula - Valor"]}
                acceptCsv={true}
                csvSeparator="\t"
            />
        </div>
    );
}
