import { useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Search, Filter, Calendar, Upload, FileSpreadsheet, Loader2, History } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Empenho, DIMENSOES, COMPONENTES_POR_DIMENSAO } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { HeaderSubtitle, HeaderActions } from '@/components/HeaderParts';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency, formatarDocumento } from '@/lib/utils';
import { parseSiafiCsv, syncSiafiDataToDb } from '@/lib/siafi-parser';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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
  tipo: 'exercicio' | 'rap';
  valorLiquidadoAPagar?: number;
  valorPagoOficial?: number;
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
  tipo: 'exercicio',
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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isUpdatingSaldos, setIsUpdatingSaldos] = useState(false);

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
        tipo: empenho.tipo,
        valorLiquidadoAPagar: empenho.valorLiquidadoAPagar,
        valorPagoOficial: empenho.valorPagoOficial,
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
        tipo: 'exercicio' as const,
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
    const toastId = toast.loading('Processando arquivo do SIAFI...');

    try {
      // 1. Parsear o CSV do SIAFI
      const parsedData = await parseSiafiCsv(file);

      if (parsedData.length === 0) {
        toast.error('Nenhum dado válido encontrado no arquivo CSV.', { id: toastId });
        return;
      }

      toast.loading(`Atualizando saldos de ${parsedData.length} empenhos no banco...`, { id: toastId });

      // 2. Sincronizar com o Supabase
      const result = await syncSiafiDataToDb(parsedData, (processed, total) => {
        if (processed % 50 === 0) {
          toast.loading(`Atualizando... ${processed}/${total}`, { id: toastId });
        }
      });

      // 3. Atualizar UI
      await refreshData();

      if (result.atualizados > 0 || result.criados > 0) {
        let msg = '';
        if (result.atualizados > 0) msg += `${result.atualizados} atualizado(s)`;
        if (result.criados > 0) msg += `${msg ? ', ' : ''}${result.criados} RAP criado(s)`;
        toast.success(`SIAFI: ${msg}!`, { id: toastId });
      } else {
        toast.info('Nenhum empenho do arquivo foi encontrado no sistema.', { id: toastId });
      }

      if (result.erros > 0) {
        toast.error(`Houve erro ao salvar ${result.erros} registros.`, { duration: 5000 });
      }

    } catch (error: any) {
      console.error('Erro ao processar SIAFI CSV:', error);
      toast.error(error.message || 'Erro ao ler a planilha. Verifique o formato do arquivo.', { id: toastId });
    } finally {
      setIsUpdatingSaldos(false);
      if (saldosInputRef.current) {
        saldosInputRef.current.value = '';
      }
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

  const lastUpdate = empenhos.reduce((max, e) => {
    if (!e.ultimaAtualizacaoSiafi) return max;
    const date = new Date(e.ultimaAtualizacaoSiafi);
    return date > max ? date : max;
  }, new Date(0));
  const hasLastUpdate = lastUpdate.getTime() > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <HeaderSubtitle>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <span>Gerencie a execução orçamentária</span>
          {hasLastUpdate && (
            <Badge variant="outline" className="text-[10px] sm:text-xs font-normal py-0 sm:py-0.5">
              Última importação CSV: {format(lastUpdate, "dd/MM/yyyy 'às' HH:mm")}
            </Badge>
          )}
        </div>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex gap-2">
          <input
            type="file"
            ref={saldosInputRef}
            onChange={handleImportSaldos}
            accept=".csv"
            className="hidden"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => saldosInputRef.current?.click()}
                  className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-white"
                  disabled={isUpdatingSaldos}
                >
                  {isUpdatingSaldos ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Lendo SIAFI...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Importar SIAFI
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Importar CSV SIAFI (Exec_NE_Exercicio_RAP_UG_Executora.csv)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </HeaderActions>

      {/* Filters */}
      <Card className="">
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
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'exercicio' || (!e.tipo && e.numero.includes(String(new Date().getFullYear()))))}
            type="execucao"
            handleOpenDialog={handleOpenDialog}
          />
        </TabsContent>

        <TabsContent value="restos">
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'rap' || (!e.tipo && !e.numero.includes(String(new Date().getFullYear()))))}
            type="restos"
            handleOpenDialog={handleOpenDialog}
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
              {formData.tipo === 'exercicio' && (
                <>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">A Pagar (Liquidado)</span>
                    <span>{formatCurrency(formData.valorLiquidadoAPagar || 0)}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-muted-foreground">Pago Oficial</span>
                    <span>{formatCurrency(formData.valorPagoOficial || 0)}</span>
                  </div>
                </>
              )}
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-muted-foreground">Natureza de Despesa</span>
                <span>{formData.naturezaDespesa}</span>
              </div>
            </div>

            {/* Histórico de Operações */}
            {selectedEmpenho?.historicoOperacoes && selectedEmpenho.historicoOperacoes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Histórico de Operações ({selectedEmpenho.historicoOperacoes.length})</span>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Data</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Operação</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedEmpenho.historicoOperacoes]
                        .sort((a, b) => {
                          // Sort by date ascending
                          const parseDate = (d: string) => {
                            const parts = d.split('/');
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                          };
                          return parseDate(a.data).getTime() - parseDate(b.data).getTime();
                        })
                        .map((op, idx) => (
                          <tr key={idx} className="border-t border-border/50">
                            <td className="py-2 px-3 text-muted-foreground">{op.data}</td>
                            <td className="py-2 px-3">
                              <Badge
                                variant={
                                  op.operacao === 'INCLUSAO' ? 'info' :
                                    op.operacao === 'REFORCO' ? 'success' :
                                      op.operacao === 'ANULACAO' ? 'danger' : 'default'
                                }
                                className="text-xs"
                              >
                                {op.operacao === 'INCLUSAO' ? 'Inclusão' :
                                  op.operacao === 'REFORCO' ? 'Reforço' :
                                    op.operacao === 'ANULACAO' ? 'Anulação' :
                                      op.operacao}
                              </Badge>
                            </td>
                            <td className={`py-2 px-3 text-right font-medium ${op.operacao === 'ANULACAO' ? 'text-red-600' : 'text-green-600'
                              }`}>
                              {op.operacao === 'ANULACAO' ? '-' : '+'}{formatCurrency(op.valorTotal)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={2} className="py-2 px-3 font-semibold">Valor Consolidado</td>
                        <td className="py-2 px-3 text-right font-bold">{formatCurrency(formData.valor)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

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
    </div>
  );
}

// Extracted Component for Table Reuse inside Tabs
function EmpenhosTable({ empenhos, type, handleOpenDialog }: {
  empenhos: Empenho[],
  type: 'execucao' | 'restos',
  handleOpenDialog: (e: Empenho) => void
}) {
  const [sortKey, setSortKey] = useState<string>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedEmpenhos = useMemo(() => {
    const sorted = [...empenhos].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortKey) {
        case 'numero':
          valA = a.numero;
          valB = b.numero;
          break;
        case 'favorecido':
          valA = a.favorecidoNome || '';
          valB = b.favorecidoNome || '';
          break;
        case 'valor':
          valA = type === 'restos' ? (a.rapInscrito || a.valor) : a.valor;
          valB = type === 'restos' ? (b.rapInscrito || b.valor) : b.valor;
          break;
        case 'saldo':
          if (type === 'restos') {
            valA = a.rapALiquidar || 0;
            valB = b.rapALiquidar || 0;
          } else {
            valA = a.valor - (a.valorLiquidado || 0);
            valB = b.valor - (b.valorLiquidado || 0);
          }
          break;
        case 'pago':
          valA = type === 'restos' ? (a.rapPago || 0) : (a.valorPago || 0);
          valB = type === 'restos' ? (b.rapPago || 0) : (b.valorPago || 0);
          break;
        default:
          valA = a.numero;
          valB = b.numero;
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [empenhos, sortKey, sortDir, type]);

  const SortHeader = ({ label, colKey, align = 'left' }: { label: string; colKey: string; align?: 'left' | 'right' | 'center' }) => (
    <th
      className={`text-${align} py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none transition-colors`}
      onClick={() => handleSort(colKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortKey === colKey && (
          <span className="text-primary text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );

  return (
    <Card className="">
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
                <SortHeader label="Número" colKey="numero" />
                <SortHeader label="Favorecido" colKey="favorecido" />
                {type === 'execucao' ? (
                  <>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Componente / Dimensão</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Origem / Plano</th>
                  </>
                ) : (
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                )}
                <SortHeader label={type === 'execucao' ? 'Empenhado / Liquidado' : 'Inscrito / A Liq / Liq / Pago'} colKey="valor" align="right" />
                <SortHeader label={type === 'execucao' ? 'Saldo' : 'A Liquidar'} colKey="saldo" align="right" />

                <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedEmpenhos.map((empenho) => (
                <tr key={empenho.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-medium whitespace-nowrap">{empenho.numero}</span>
                      {empenho.processo && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap" title="Processo">
                          Proc: {empenho.processo}
                        </span>
                      )}
                      {empenho.historicoOperacoes && empenho.historicoOperacoes.length > 1 && (
                        <span className="text-[10px] text-blue-500 flex items-center gap-0.5" title="Empenho com histórico de alterações">
                          <History className="h-3 w-3" />
                          {empenho.historicoOperacoes.length} ops
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[150px]" title={empenho.favorecidoNome}>{empenho.favorecidoNome || '-'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatarDocumento(empenho.favorecidoDocumento || '')}
                      </span>
                    </div>
                  </td>
                  {type === 'execucao' ? (
                    <>
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{empenho.componenteFuncional}</span>
                          <Badge variant="secondary" className="w-fit whitespace-nowrap">
                            {empenho.dimensao ? empenho.dimensao.split(' - ')[0] : '-'}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium whitespace-nowrap">{empenho.origemRecurso || '-'}</p>
                          {empenho.planoInterno && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{empenho.planoInterno}</span>
                          )}
                        </div>
                      </td>
                    </>
                  ) : (
                    <td className="py-4 px-4 align-top">
                      <span className="text-sm line-clamp-2" title={empenho.descricao}>{empenho.descricao || '-'}</span>
                    </td>
                  )}
                  <td className="py-4 px-4 text-right align-top whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-end">
                      {type === 'restos' && empenho.rapInscrito != null ? (
                        <>
                          <span className="font-medium" title="Inscrito (original)">
                            {formatCurrency(empenho.rapInscrito || 0)}
                          </span>
                          <span className={`text-xs ${(empenho.rapALiquidar || 0) > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} title="A Liquidar">
                            A Liq: {formatCurrency(empenho.rapALiquidar || 0)}
                          </span>
                          <span className={`text-xs ${(empenho.rapLiquidado || 0) > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} title="Liquidado">
                            Liq: {formatCurrency(empenho.rapLiquidado || 0)}
                          </span>
                          <span className={`text-xs ${(empenho.rapPago || 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`} title="Pago">
                            Pg: {formatCurrency(empenho.rapPago || 0)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium" title={type === 'execucao' ? 'Empenhado' : 'Inscrito'}>
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
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right align-top whitespace-nowrap">
                    {(() => {
                      if (type === 'restos') {
                        const aLiquidar = empenho.rapALiquidar || 0;
                        return (
                          <span className={`font-medium ${aLiquidar > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                            {formatCurrency(aLiquidar)}
                          </span>
                        );
                      }
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


