import { useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, Filter, Calendar, Upload, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Empenho, DIMENSOES, NATUREZAS_DESPESA, COMPONENTES_POR_DIMENSAO } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { transparenciaService } from '@/services/transparencia';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency } from '@/lib/utils';


const statusColors: Record<string, string> = {
  pendente: 'bg-warning/20 text-warning border-warning/30',
  liquidado: 'bg-info/20 text-info border-info/30',
  pago: 'bg-accent/20 text-accent border-accent/30',
  cancelado: 'bg-destructive/20 text-destructive border-destructive/30',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const initialFormState: {
  numero: string;
  descricao: string;
  valor: number;
  dimensao: string;
  componenteFuncional: string;
  origemRecurso: string;
  naturezaDespesa: string;
  dataEmpenho: Date;
  status: 'pendente' | 'liquidado' | 'pago' | 'cancelado';
  atividadeId: string;
  planoInterno: string;
  favorecidoNome: string;
  favorecidoDocumento: string;
  processo: string;
} = {
  numero: '',
  descricao: '',
  valor: 0,
  dimensao: '',
  componenteFuncional: '',
  origemRecurso: '',
  naturezaDespesa: '',
  dataEmpenho: new Date(),
  status: 'pendente',
  atividadeId: '',
  planoInterno: '',
  favorecidoNome: '',
  favorecidoDocumento: '',
  processo: '',
};

export default function Empenhos() {
  const { empenhos, atividades, addEmpenho, updateEmpenho, deleteEmpenho, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDimensao, setFilterDimensao] = useState('all');

  // Novos Filtros
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterPlanoInterno, setFilterPlanoInterno] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isUpdatingSaldos, setIsUpdatingSaldos] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const saldosInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmpenho, setSelectedEmpenho] = useState<Empenho | null>(null);
  const [formData, setFormData] = useState(initialFormState);

  // Extrair opções únicas para filtros
  const componentesUnicos = Array.from(new Set(empenhos.map(e => e.componenteFuncional).filter(Boolean))).sort();
  const origensUnicas = Array.from(new Set(empenhos.map(e => e.origemRecurso).filter(Boolean))).sort();
  const planosUnicos = Array.from(new Set(empenhos.map(e => e.planoInterno).filter(Boolean))).sort();

  const filteredEmpenhos = empenhos.filter((e) => {
    const matchesSearch =
      e.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.componenteFuncional?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesDimensao = filterDimensao === 'all' || e.dimensao.includes(filterDimensao);
    const matchesComponente = filterComponente === 'all' || e.componenteFuncional === filterComponente;
    const matchesOrigem = filterOrigem === 'all' || e.origemRecurso === filterOrigem;
    const matchesPlano = filterPlanoInterno === 'all' || e.planoInterno === filterPlanoInterno;

    // Filtro de Data
    let matchesData = true;
    if (dataInicio && dataFim) {
      const data = new Date(e.dataEmpenho);
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      matchesData = data >= inicio && data <= fim;
    }

    return matchesSearch && matchesStatus && matchesDimensao && matchesComponente && matchesOrigem && matchesPlano && matchesData;
  });

  const handleOpenDialog = (empenho?: Empenho) => {
    if (empenho) {
      setSelectedEmpenho(empenho);
      setFormData({
        numero: empenho.numero,
        descricao: empenho.descricao,
        valor: empenho.valor,
        dimensao: empenho.dimensao,
        componenteFuncional: empenho.componenteFuncional,
        origemRecurso: empenho.origemRecurso,
        naturezaDespesa: empenho.naturezaDespesa,
        planoInterno: empenho.planoInterno || '',
        favorecidoNome: empenho.favorecidoNome || '',
        favorecidoDocumento: empenho.favorecidoDocumento || '',
        dataEmpenho: empenho.dataEmpenho,
        status: empenho.status,
        atividadeId: empenho.atividadeId || '',
        processo: empenho.processo || '',
      });
    } else {
      setSelectedEmpenho(null);
      setFormData(initialFormState);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (selectedEmpenho) {
      updateEmpenho(selectedEmpenho.id, formData);
    } else {
      addEmpenho(formData);
    }
    setIsDialogOpen(false);
    setFormData(initialFormState);
  };

  const handleDelete = () => {
    if (selectedEmpenho) {
      deleteEmpenho(selectedEmpenho.id);
      setIsDeleteDialogOpen(false);
      setSelectedEmpenho(null);
    }
  };

  const openDeleteDialog = (empenho: Empenho) => {
    setSelectedEmpenho(empenho);
    setIsDeleteDialogOpen(true);
  };

  const handleJsonImport = (data: Record<string, string>[]) => {
    let importCount = 0;
    data.forEach((row) => {
      const parseDate = (dateStr: string): Date => {
        if (!dateStr) return new Date();
        const parts = dateStr.split(/[\/\-]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        return new Date(dateStr);
      };


      const empenho = {
        numero: row['numero'] || '',
        descricao: row['descricao'] || '',
        valor: parseCurrency(row['valor'] || '0'),
        dimensao: row['dimensao'] || '',
        componenteFuncional: row['componentefuncional'] || row['componente'] || '',
        origemRecurso: row['origemrecurso'] || row['origem'] || '',
        naturezaDespesa: row['naturezadespesa'] || row['natureza'] || '',
        planoInterno: row['planointerno'] || row['plano'] || '',
        favorecidoNome: row['favorecido'] || row['nomefavorecido'] || row['razaosocial'] || '',
        favorecidoDocumento: row['documentofavorecido'] || row['cpf'] || row['cnpj'] || row['cpfcnpj'] || '',
        dataEmpenho: parseDate(row['dataempenho'] || row['data'] || ''),
        status: (row['status'] || 'pendente') as 'pendente' | 'liquidado' | 'pago' | 'cancelado',
        atividadeId: row['atividadeid'] || '',
      };
      if (empenho.numero && empenho.dimensao) {
        addEmpenho(empenho);
        importCount++;
      }
    });
    toast.success(`${importCount} empenho(s) importado(s) com sucesso!`);
  };

  const empenhosJsonFields = [
    'numero', 'descricao', 'valor', 'dimensao', 'componentefuncional', 'origemrecurso', 'naturezadespesa', 'dataempenho', 'planointerno', 'favorecido', 'cpfcnpj'
  ];

  const handleImportSaldos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUpdatingSaldos(true);

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      let updatedCount = 0;
      let notFoundCount = 0;

      jsonData.forEach((row) => {
        const empenhoKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('empenho') || k.toLowerCase() === 'numero'
        );
        const movimentoKey = Object.keys(row).find(k =>
          k.toLowerCase().includes('movimento') || k.toLowerCase().includes('liquidado')
        );

        if (!empenhoKey || !movimentoKey) return;

        const numeroEmpenho = String(row[empenhoKey]).trim();
        const valorMovimento = typeof row[movimentoKey] === 'number'
          ? row[movimentoKey] as number
          : parseCurrency(String(row[movimentoKey]));

        const empenho = empenhos.find(e =>
          e.numero === numeroEmpenho ||
          e.numero.includes(numeroEmpenho) ||
          numeroEmpenho.includes(e.numero)
        );

        if (empenho) {
          const novoValorLiquidado = (empenho.valorLiquidado || 0) + valorMovimento;
          updateEmpenho(empenho.id, {
            valorLiquidado: novoValorLiquidado,
            status: novoValorLiquidado > 0 ? 'liquidado' : 'pendente',
          });
          updatedCount++;
        } else {
          notFoundCount++;
          console.warn(`Empenho não encontrado: ${numeroEmpenho}`);
        }
      });

      if (updatedCount > 0) {
        toast.success(`${updatedCount} saldo(s) atualizado(s) com sucesso!`);
      }
      if (notFoundCount > 0) {
        toast.warning(`${notFoundCount} empenho(s) da planilha não encontrado(s) no sistema`);
      }
      if (updatedCount === 0 && notFoundCount === 0) {
        toast.error('Nenhum dado válido encontrado na planilha. Verifique as colunas "Empenho" e "Movimento".');
      }
    } catch (error) {
      console.error('Erro ao importar planilha:', error);
      toast.error('Erro ao ler a planilha. Verifique o formato do arquivo.');
    } finally {
      setIsUpdatingSaldos(false);
      if (saldosInputRef.current) {
        saldosInputRef.current.value = '';
      }
    }
  };

  const handleSyncApi = async () => {
    setIsSyncing(true);
    let lastMessage = '';
    const toastId = toast.loading('Iniciando sincronização...');

    try {
      await transparenciaService.syncEmpenhosSequencial((msg) => {
        lastMessage = msg;
        toast.loading(msg, { id: toastId });
      });
      toast.success(lastMessage || 'Sincronização concluída!', { id: toastId });
      await refreshData();
    } catch (error) {
      console.error(error);
      toast.error('Erro na sincronização', { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const dimensoesDisponiveis = useMemo(() => {
    // Agora usando apenas as dimensões estáticas definidas
    return DIMENSOES.map(d => d.nome);
  }, []);

  const origensDisponiveis = useMemo(() => {
    return [...new Set(
      atividades
        .filter(a => !formData.dimensao || a.dimensao === formData.dimensao)
        .map(a => a.origemRecurso)
        .filter(Boolean)
    )];
  }, [atividades, formData.dimensao]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Empenhos</h2>
          <p className="text-muted-foreground">Gerencie a execução orçamentária</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={saldosInputRef}
            onChange={handleImportSaldos}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => saldosInputRef.current?.click()}
            className="gap-2"
            disabled={isUpdatingSaldos}
          >
            {isUpdatingSaldos ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Atualizar Saldos
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncApi}
            className="gap-2"
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: Busca e Filtros Básicos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empenhos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select value={filterDimensao} onValueChange={setFilterDimensao}>
                <SelectTrigger>
                  <SelectValue placeholder="Dimensão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas dimensões</SelectItem>
                  {DIMENSOES.map((d) => (
                    <SelectItem key={d.codigo} value={d.codigo}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[150px]">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="liquidado">Liquidado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={showAdvancedFilters ? "secondary" : "outline"}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>

          {/* Linha 2: Filtros Avançados (Colapsável) */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50 animate-in slide-in-from-top-2">
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Plano Interno</label>
                <Select value={filterPlanoInterno} onValueChange={setFilterPlanoInterno}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {planosUnicos.map(plano => (
                      <SelectItem key={plano} value={plano}>{plano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Período (Início)</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Período (Fim)</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Limpar Filtros"
                    onClick={() => {
                      setFilterDimensao('all');
                      setFilterStatus('all');
                      setFilterComponente('all');
                      setFilterOrigem('all');
                      setFilterPlanoInterno('all');
                      setDataInicio('');
                      setDataFim('');
                      setSearchTerm('');
                    }}
                  >
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="sr-only">Limpar</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>



      <Tabs defaultValue="execucao" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="execucao">Execução {new Date().getFullYear()}</TabsTrigger>
          <TabsTrigger value="restos">Restos a Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value="execucao">
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.numero.includes(String(new Date().getFullYear())))}
            type="execucao"
            handleOpenDialog={handleOpenDialog}
            openDeleteDialog={openDeleteDialog}
          />
        </TabsContent>

        <TabsContent value="restos">
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => !e.numero.includes(String(new Date().getFullYear())))}
            type="restos"
            handleOpenDialog={handleOpenDialog}
            openDeleteDialog={openDeleteDialog}
          />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmpenho ? `Editar Empenho ${selectedEmpenho.numero}` : 'Detalhes do Empenho'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Informações Read-Only */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-3 rounded-md">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Número</span>
                <span>{formData.numero}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Data</span>
                <span>{format(new Date(formData.dataEmpenho), 'dd/MM/yyyy')}</span>
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Descrição</span>
                <p className="text-sm">{formData.descricao}</p>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Processo</span>
                <span>{formData.processo || '-'}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Favorecido</span>
                <span>{formData.favorecidoNome}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">Valor</span>
                <span>{formatCurrency(formData.valor)}</span>
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Natureza de Despesa</span>
                <span>{formData.naturezaDespesa}</span>
              </div>
            </div>

            {/* Campos Editáveis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dimensao">Dimensão</Label>
                <Select
                  value={formData.dimensao}
                  onValueChange={(v) => setFormData({ ...formData, dimensao: v, origemRecurso: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a dimensão" />
                  </SelectTrigger>
                  <SelectContent>
                    {dimensoesDisponiveis.map((dimensao) => (
                      <SelectItem key={dimensao} value={dimensao}>
                        {dimensao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="componenteFuncional">Componente Funcional</Label>
                <Select
                  value={formData.componenteFuncional}
                  onValueChange={(v) => setFormData({ ...formData, componenteFuncional: v })}
                  disabled={!formData.dimensao}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.dimensao ? "Selecione o componente" : "Selecione a dimensão primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.dimensao && (() => {
                      // Extrair código da dimensão (ex: "AD - Administração" -> "AD")
                      const dimCodigo = formData.dimensao.split(' - ')[0];
                      const componentes = COMPONENTES_POR_DIMENSAO[dimCodigo] || [];
                      return componentes.map((comp) => (
                        <SelectItem key={comp} value={comp}>
                          {comp}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="origemRecurso">Origem de Recurso</Label>
                <Input
                  id="origemRecurso"
                  value={formData.origemRecurso}
                  onChange={(e) => setFormData({ ...formData, origemRecurso: e.target.value })}
                  placeholder="Ex: Fonte 100/111"
                  list="origens-list"
                />
                <datalist id="origens-list">
                  {origensDisponiveis.map((origem) => (
                    <option key={origem} value={origem} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planoInterno">Plano Interno</Label>
                <Input
                  id="planoInterno"
                  value={formData.planoInterno || ''}
                  onChange={(e) => setFormData({ ...formData, planoInterno: e.target.value })}
                  placeholder="Ex: L20RLP01ADN"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              Salvar
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
              Tem certeza que deseja excluir o empenho "{selectedEmpenho?.numero}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div >
  );
}

// Extracted Component for Table Reuse inside Tabs
function EmpenhosTable({ empenhos, type, handleOpenDialog, openDeleteDialog }: {
  empenhos: Empenho[],
  type: 'execucao' | 'restos',
  handleOpenDialog: (e: Empenho) => void,
  openDeleteDialog: (e: Empenho) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {empenhos.length} empenho{empenhos.length !== 1 ? 's' : ''} encontrado{empenhos.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Número</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground min-w-[150px]">Favorecido</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Componente / Dimensão</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Origem / Plano</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {type === 'execucao' ? 'Empenhado / Liquidado' : 'Inscrito / Pago'}
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Saldo</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empenhos.map((empenho) => (
                <tr key={empenho.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-medium whitespace-nowrap">{empenho.numero}</span>
                      {empenho.processo && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap" title="Processo">
                          Proc: {empenho.processo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[150px]" title={empenho.favorecidoNome}>{empenho.favorecidoNome || '-'}</span>
                      <span className="text-xs text-muted-foreground">{empenho.favorecidoDocumento}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{empenho.componenteFuncional}</span>
                      <Badge variant="secondary" className="w-fit whitespace-nowrap">
                        {empenho.dimensao.split(' - ')[0]}
                      </Badge>
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium whitespace-nowrap">{empenho.origemRecurso}</p>
                      {empenho.planoInterno && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{empenho.planoInterno}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right align-top whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-end">
                      <span className="font-medium" title={type === 'execucao' ? "Empenhado" : "Inscrito"}>
                        {formatCurrency(empenho.valor)}
                      </span>
                      {type === 'execucao' ? (
                        <>
                          <span className={`text-xs ${(empenho.valorLiquidado || 0) > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} title="Liquidado">
                            Liq: {formatCurrency(empenho.valorLiquidado || 0)}
                          </span>
                          {(empenho.valorPago || 0) > 0 && (
                            <span className="text-[10px] text-green-600" title="Pago">
                              Pg: {formatCurrency(empenho.valorPago || 0)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={`text-xs ${(empenho.valorPago || 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`} title="Pago">
                          Pg: {formatCurrency(empenho.valorPago || 0)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right align-top whitespace-nowrap">
                    {(() => {
                      // Saldo logic: 
                      // For Execução: Empenho - Liquidado
                      // For Restos (RP): Inscrito - Liquidado (User specific request)
                      const saldo = empenho.valor - (empenho.valorLiquidado || 0);
                      return (
                        <span className={`font-medium ${saldo > 0 ? 'text-green-600' : saldo < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {formatCurrency(saldo)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4 px-4 align-top whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(empenho)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(empenho)}
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
  );
}


