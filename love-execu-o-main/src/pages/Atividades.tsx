import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Filter, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useData } from '@/contexts/DataContext';
import { Atividade, DIMENSOES, COMPONENTES_POR_DIMENSAO } from '@/types';
import { dominioService } from '@/services/dominio';
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
import { Textarea } from '@/components/ui/textarea';
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
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


const initialFormState = {
  dimensao: '',
  dimensaoId: '',
  componenteFuncional: '',
  componenteFuncionalId: '',
  atividade: '',
  descricao: '',
  valorTotal: 0,
  origemRecurso: '',
  origemRecursoId: '',
  naturezaDespesa: '',
  naturezaDespesaId: '',
  planoInterno: '',
};

export default function Atividades() {
  const { atividades, addAtividade, updateAtividade, deleteAtividade } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDimensao, setFilterDimensao] = useState('all');

  // Novos Filtros
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: keyof Atividade; direction: 'asc' | 'desc' } | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState<Atividade | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Buscar naturezas de despesa do banco
  const { data: naturezasDespesa = [] } = useQuery({
    queryKey: ['naturezas_despesa'],
    queryFn: dominioService.getNaturezasDespesa,
  });

  // Buscar dimensões do banco
  const { data: dimensoesDB = [] } = useQuery({
    queryKey: ['dimensoes'],
    queryFn: dominioService.getDimensoes,
  });

  // Resolver dimensaoId baseada no nome selecionado no formData
  const selectedDimId = useMemo(() => {
    if (!formData.dimensao) return undefined;
    const codigo = formData.dimensao.split(' - ')[0];
    return dimensoesDB.find(d => d.codigo === codigo)?.id;
  }, [formData.dimensao, dimensoesDB]);

  // Buscar componentes funcionais do banco baseados na dimensão selecionada
  const { data: componentesDB = [] } = useQuery({
    queryKey: ['componentes_funcionais', selectedDimId],
    queryFn: () => dominioService.getComponentesFuncionais(selectedDimId),
    enabled: !!selectedDimId,
  });

  // Extrair opções únicas para os filtros
  const componentesUnicos = Array.from(new Set(atividades.map(a => a.componenteFuncional).filter(Boolean))).sort();
  const origensUnicas = Array.from(new Set(atividades.map(a => a.origemRecurso).filter(Boolean))).sort();

  const filteredAtividades = atividades.filter((a) => {
    const matchesSearch =
      (a.atividade || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.origemRecurso || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.componenteFuncional || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDimensao = filterDimensao === 'all' || (a.dimensao || '').includes(filterDimensao);
    const matchesComponente = filterComponente === 'all' || a.componenteFuncional === filterComponente;
    const matchesOrigem = filterOrigem === 'all' || a.origemRecurso === filterOrigem;

    return matchesSearch && matchesDimensao && matchesComponente && matchesOrigem;
  });

  const sortedAtividades = [...filteredAtividades].sort((a, b) => {
    if (!sortConfig) return 0;

    const { key, direction } = sortConfig;
    let aValue = a[key] ?? '';
    let bValue = b[key] ?? '';

    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();

    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const requestSort = (key: keyof Atividade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnName: keyof Atividade) => {
    if (!sortConfig || sortConfig.key !== columnName) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleOpenDialog = (atividade?: Atividade) => {
    if (atividade) {
      setSelectedAtividade(atividade);
      setFormData({
        dimensao: atividade.dimensao,
        dimensaoId: atividade.dimensaoId || '',
        componenteFuncional: atividade.componenteFuncional,
        componenteFuncionalId: atividade.componenteFuncionalId || '',
        atividade: atividade.atividade,
        descricao: atividade.descricao,
        valorTotal: atividade.valorTotal,
        origemRecurso: atividade.origemRecurso,
        origemRecursoId: atividade.origemRecursoId || '',
        naturezaDespesa: atividade.naturezaDespesa,
        naturezaDespesaId: atividade.naturezaDespesaId || '',
        planoInterno: atividade.planoInterno,
      });
    } else {
      setSelectedAtividade(null);
      setFormData(initialFormState);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      let origemFormatada = formData.origemRecurso;
      const ptresMatch = origemFormatada.match(/\b(\d{6})\b/);
      if (ptresMatch) {
        origemFormatada = ptresMatch[1];
      }

      const dataToSubmit = { 
      ...formData, 
      origemRecurso: origemFormatada,
      dimensaoId: formData.dimensaoId || null,
      componenteFuncionalId: formData.componenteFuncionalId || null,
      naturezaDespesaId: formData.naturezaDespesaId || null,
      origemRecursoId: formData.origemRecursoId || null,
    };

      // 1. Resolver ID de Dimensão (Opcional)
      try {
        if (!dataToSubmit.dimensaoId && dataToSubmit.dimensao) {
          const dimCodigo = dataToSubmit.dimensao.split(' - ')[0];
          const dims = await dominioService.getDimensoes();
          const match = dims?.find(d => d.codigo === dimCodigo);
          if (match) dataToSubmit.dimensaoId = match.id;
        }
      } catch (e) {
        console.warn('Falha ao resolver ID de Dimensão:', e);
      }

      // 2. Resolver ID de Componente Funcional (Opcional)
      try {
        if (!dataToSubmit.componenteFuncionalId && dataToSubmit.componenteFuncional && dataToSubmit.dimensaoId) {
          const comps = await dominioService.getComponentesFuncionais(dataToSubmit.dimensaoId);
          const match = comps?.find(c => c.nome === dataToSubmit.componenteFuncional);
          if (match) dataToSubmit.componenteFuncionalId = match.id;
        }
      } catch (e) {
        console.warn('Falha ao resolver ID de Componente Funcional:', e);
      }

      // 3. Resolver/Upsert ID de Origem de Recurso (Opcional)
      try {
        if (origemFormatada && !dataToSubmit.origemRecursoId) {
          const oid = await dominioService.upsertOrigemRecurso(origemFormatada);
          if (oid) dataToSubmit.origemRecursoId = oid;
        }
      } catch (e) {
        console.warn('Falha ao resolver ID de Origem:', e);
      }

      if (selectedAtividade) {
        await updateAtividade(selectedAtividade.id, dataToSubmit);
      } else {
        await addAtividade(dataToSubmit);
      }
      setIsDialogOpen(false);
      setFormData(initialFormState);
    } catch (error: any) {
      console.error('Erro ao salvar atividade:', error);
      const detail = error.message || error.details || 'Verifique os dados e tente novamente.';
      toast.error(`Erro ao salvar: ${detail}`);
    }
  };

  const handleDelete = () => {
    if (selectedAtividade) {
      deleteAtividade(selectedAtividade.id);
      setIsDeleteDialogOpen(false);
      setSelectedAtividade(null);
    }
  };

  const openDeleteDialog = (atividade: Atividade) => {
    setSelectedAtividade(atividade);
    setIsDeleteDialogOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedAtividades.map((a) => a.id)));
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
    selectedIds.forEach((id) => deleteAtividade(id));
    setSelectedIds(new Set());
    setIsDeleteDialogOpen(false);
    toast.success(`${selectedIds.size} atividades excluídas com sucesso!`);
  };


  const handleJsonImport = async (data: Record<string, string>[]) => {
    let importCount = 0;
    const toastId = toast.loading(`Importando ${data.length} atividades...`);

    try {
      const dims = await dominioService.getDimensoes();

      for (const row of data) {
        // Formata a origem recurso para extrair o PTRES se vier no formato AA.BBBB.CCCCCC.D
        let origemRecurso = row['origemrecurso'] || '';
        const ptresMatch = origemRecurso.match(/\b(\d{6})\b/);
        if (ptresMatch) {
          origemRecurso = ptresMatch[1];
        }

        const nomeDimensao = row['dimensao'] || '';
        const dimCodigo = nomeDimensao.split(' - ')[0];
        const dimensaoId = dims.find(d => d.codigo === dimCodigo)?.id;

        let componenteFuncionalId = '';
        const nomeComponente = row['componentefuncional'] || row['componente'] || '';
        if (dimensaoId && nomeComponente) {
          const comps = await dominioService.getComponentesFuncionais(dimensaoId);
          componenteFuncionalId = comps.find(c => c.nome === nomeComponente)?.id || '';
        }

        let naturezaDespesaId = '';
        const naturezaStr = row['naturezadespesa'] || '';
        if (naturezaStr) {
          const nParts = naturezaStr.split(' - ');
          const nCodigo = nParts[0].trim();
          const nNome = nParts.length > 1 ? nParts.slice(1).join(' - ').trim() : '';
          naturezaDespesaId = await dominioService.upsertNaturezaDespesa(nCodigo, nNome) || '';
        }

        const atividade = {
          dimensao: nomeDimensao,
          dimensaoId,
          componenteFuncional: nomeComponente,
          componenteFuncionalId,
          atividade: row['atividade'] || '',
          descricao: row['descricao'] || '',
          valorTotal: parseCurrency(row['valortotal'] || row['valor'] || '0'),
          origemRecurso: origemRecurso,
          naturezaDespesa: naturezaStr,
          naturezaDespesaId,
          planoInterno: row['planointerno'] || '',
        };

        if (atividade.atividade && atividade.dimensao) {
          addAtividade(atividade);
          importCount++;
        }
      }
      toast.success(`${importCount} atividade(s) importada(s) com sucesso!`, { id: toastId });
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao importar atividades.', { id: toastId });
    }
  };

  const atividadesJsonFields = [
    'dimensao', 'componentefuncional', 'atividade', 'descricao', 'valortotal', 'origemrecurso', 'naturezadespesa', 'planointerno'
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Atividades</h2>
          <p className="text-muted-foreground">Gerencie o planejamento orçamentário</p>
        </div>
      </div>
      <div className="flex gap-2">
        {selectedIds.size > 0 && (
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Excluir ({selectedIds.size})
          </Button>
        )}
        <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar JSON
        </Button>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Atividade
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por atividade, processo ou dimensão..."
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
                <label className="text-sm font-medium">Componente Funcional</label>
                <Select value={filterComponente} onValueChange={setFilterComponente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {componentesUnicos.map(comp => (
                      <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    setFilterComponente('all');
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredAtividades.length} atividade{filteredAtividades.length !== 1 ? 's' : ''} encontrada{filteredAtividades.length !== 1 ? 's' : ''}
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
                        sortedAtividades.length > 0 &&
                        sortedAtividades.every((a) => selectedIds.has(a.id))
                      }
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('atividade')}>
                      Atividade {getSortIcon('atividade')}
                    </Button>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('dimensao')}>
                      Dimensão {getSortIcon('dimensao')}
                    </Button>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('componenteFuncional')}>
                      Componente Funcional {getSortIcon('componenteFuncional')}
                    </Button>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" className="hover:bg-transparent px-0 font-medium" onClick={() => requestSort('origemRecurso')}>
                      Origem de Recurso {getSortIcon('origemRecurso')}
                    </Button>
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                    <Button variant="ghost" className="hover:bg-transparent px-0 font-medium justify-end w-full" onClick={() => requestSort('valorTotal')}>
                      Valor {getSortIcon('valorTotal')}
                    </Button>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedAtividades.map((atividade) => (
                  <tr key={atividade.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <Checkbox
                        checked={selectedIds.has(atividade.id)}
                        onCheckedChange={(checked) => handleSelectOne(atividade.id, checked as boolean)}
                      />
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-sm">{atividade.atividade}</p>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {(atividade.dimensao || 'N/D').split(' - ')[0]}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm">{atividade.componenteFuncional}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-muted-foreground">{atividade.origemRecurso}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-medium">{formatCurrency(atividade.valorTotal)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(atividade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(atividade)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedAtividade ? 'Editar Atividade' : 'Nova Atividade'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="dimensao">Dimensão</Label>
              <Select
                value={formData.dimensao}
                onValueChange={(v) => {
                  setFormData({ 
                    ...formData, 
                    dimensao: v, 
                    dimensaoId: '', 
                    componenteFuncional: '', 
                    componenteFuncionalId: '' 
                  });
                }}
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
              <Label htmlFor="componenteFuncional">Componente Funcional</Label>
              <Select
                value={formData.componenteFuncionalId || ''}
                onValueChange={(v) => {
                  const selected = componentesDB.find(c => c.id === v);
                  if (selected) {
                    setFormData({ ...formData, componenteFuncional: selected.nome, componenteFuncionalId: v });
                  }
                }}
                disabled={!formData.dimensao}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.dimensao ? "Selecione o componente" : "Selecione a dimensão primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {componentesDB.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="atividade">Atividade</Label>
              <Input
                id="atividade"
                value={formData.atividade}
                onChange={(e) => setFormData({ ...formData, atividade: e.target.value })}
                placeholder="Nome da atividade"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição detalhada da atividade"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valorTotal">Valor Total (R$)</Label>
                <Input
                  id="valorTotal"
                  type="number"
                  value={formData.valorTotal}
                  onChange={(e) => setFormData({ ...formData, valorTotal: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="origemRecurso">Origem de Recurso</Label>
                <Input
                  id="origemRecurso"
                  value={formData.origemRecurso}
                  onChange={(e) => setFormData({ ...formData, origemRecurso: e.target.value })}
                  placeholder="Ex: GO.20RL.231796.3"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="naturezaDespesa">Natureza de Despesa</Label>
              <Select
                value={formData.naturezaDespesaId}
                onValueChange={(v) => {
                  const selected = naturezasDespesa.find(n => n.id === v);
                  if (selected) {
                    setFormData({
                      ...formData,
                      naturezaDespesaId: v,
                      naturezaDespesa: `${selected.codigo} - ${selected.nome}`
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a natureza de despesa" />
                </SelectTrigger>
                <SelectContent>
                  {naturezasDespesa.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.codigo} - {n.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {selectedAtividade ? 'Salvar' : 'Criar'}
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
              {selectedIds.size > 0 && !selectedAtividade
                ? `Tem certeza que deseja excluir as ${selectedIds.size} atividades selecionadas? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a atividade "${selectedAtividade?.atividade}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (!selectedAtividade) setSelectedIds(new Set()); // Clear selection if cancelling bulk delete? Maybe not.
              // Actually, user might just want to back out of deletion but keep selection.
              // Logic check: if I have selection but clicked specific trash icon -> selectedAtividade is set.
              // If I clicked bulk delete -> selectedAtividade is NULL.
            }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={selectedAtividade ? handleDelete : handleBulkDelete}
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
        title="Importar Atividades"
        expectedFields={atividadesJsonFields}
      />
    </div >
  );
}
