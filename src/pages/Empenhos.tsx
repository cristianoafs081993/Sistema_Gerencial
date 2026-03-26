import { Fragment, useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Search, Filter, Calendar, Upload, FileSpreadsheet, Loader2, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Layers, X } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Empenho, DIMENSOES, COMPONENTES_POR_DIMENSAO } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { HeaderActions } from '@/components/HeaderParts';
import { toast } from 'sonner';
import { formatCurrency, parseCurrency, formatarDocumento } from '@/lib/utils';
import { parseSiafiCsv, syncSiafiDataToDb } from '@/lib/siafi-parser';
import { transparenciaService } from '@/services/transparencia';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { splitCsvLine } from '@/utils/csvParser';


const statusColors: Record<string, string> = {
  pendente: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  liquidado: 'bg-action-primary/20 text-action-primary border-action-primary/30',
  pago: 'bg-status-success/20 text-status-success border-status-success/30',
  cancelado: 'bg-status-error/20 text-status-error border-status-error/30',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};



export default function Empenhos() {
  const { empenhos, atividades, creditosDisponiveis, isLoading, addEmpenho, updateEmpenho, deleteEmpenho, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('pendente');
  const [filterDimensao, setFilterDimensao] = useState('all');

  // Novos Filtros
  const [filterComponente, setFilterComponente] = useState('all');
  const [filterOrigem, setFilterOrigem] = useState('all');
  const [filterPlanoInterno, setFilterPlanoInterno] = useState('all');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('execucao');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isUpdatingSaldos, setIsUpdatingSaldos] = useState(false);

  const saldosInputRef = useRef<HTMLInputElement>(null);
  const creditosInputRef = useRef<HTMLInputElement>(null);
  const [selectedEmpenho, setSelectedEmpenho] = useState<Empenho | null>(null);

  // Extrair opções únicas para filtros
  const componentesUnicos = Array.from(new Set(empenhos.map(e => e.componenteFuncional?.trim()).filter(Boolean))).sort();
  const origensUnicas = Array.from(new Set(empenhos.map(e => e.origemRecurso?.trim()).filter(Boolean))).sort();
  const planosUnicos = Array.from(new Set(empenhos.map(e => e.planoInterno?.trim()).filter(Boolean))).sort();
  const normalizeString = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredEmpenhos = empenhos.filter((e) => {
    const searchNormalized = normalizeString(searchTerm);
    const searchDigits = searchTerm.replace(/\D/g, '');

    const matchesSearch =
      normalizeString(e.numero).includes(searchNormalized) ||
      normalizeString(e.descricao).includes(searchNormalized) ||
      normalizeString(e.componenteFuncional || '').includes(searchNormalized) ||
      normalizeString(e.favorecidoNome || '').includes(searchNormalized) ||
      (searchDigits !== '' && (e.favorecidoDocumento || '').replace(/\D/g, '').includes(searchDigits));

    const matchesStatus = filterStatus === 'all' || (() => {
      // Regra específica para Restos a Pagar
      if (e.tipo === 'rap') {
        const isCompletamentePago = (e.rapALiquidar || 0) <= 0 && (e.saldoRapOficial || 0) <= 0 && (e.rapPago || 0) > 0;

        if (filterStatus === 'pago') return isCompletamentePago;
        if (filterStatus === 'liquidado') return (e.rapLiquidado || 0) > 0 && !isCompletamentePago;
        if (filterStatus === 'pendente') return !isCompletamentePago;
      }

      return e.status === filterStatus;
    })();
    const matchesDimensao = filterDimensao === 'all' || e.dimensao.includes(filterDimensao);
    const matchesComponente = filterComponente === 'all' || e.componenteFuncional?.trim() === filterComponente;
    const matchesOrigem = filterOrigem === 'all' || e.origemRecurso?.trim() === filterOrigem;
    const matchesPlano = filterPlanoInterno === 'all' || e.planoInterno?.trim() === filterPlanoInterno;

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
    setSelectedEmpenho(empenho || null);
    setIsDialogOpen(true);
  };

  const handleSaveEmpenho = (id: string, data: any) => {
    updateEmpenho(id, data);
    setIsDialogOpen(false);
  };



  const handleJsonImport = (data: Record<string, string>[]) => {
    // Build deduplication set from existing empenhos (in memory)
    const existingNumeros = new Set(
      empenhos.map(e => e.numero.trim().toUpperCase())
    );

    let importCount = 0;
    let skipCount = 0;

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

      const numero = (row['numero'] || '').trim().toUpperCase();

      // Check for duplicate by numero
      if (numero && existingNumeros.has(numero)) {
        skipCount++;
        return;
      }

      const empenho = {
        numero,
        descricao: row['descricao'] || '',
        valor: parseCurrency(row['valor'] || '0'),
        dimensao: row['dimensao'] || '',
        componenteFuncional: row['componentefuncional'] || row['componente'] || '',
        origemRecurso: row['origemrecurso'] || row['origem'] || row['ptres'] || '',
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
        existingNumeros.add(numero); // prevent duplicates within same import
        importCount++;
      }
    });

    if (importCount > 0 && skipCount > 0) {
      toast.success(`${importCount} novo(s) importado(s), ${skipCount} já existente(s) ignorado(s).`);
    } else if (importCount > 0) {
      toast.success(`${importCount} empenho(s) importado(s) com sucesso!`);
    } else {
      toast.info(`Nenhum registro novo encontrado. ${skipCount} já existente(s) ignorado(s).`);
    }
  };

  const empenhosJsonFields = [
    'numero', 'descricao', 'valor', 'dimensao', 'componentefuncional', 'origemrecurso', 'naturezadespesa', 'dataempenho', 'planointerno', 'favorecido', 'cpfcnpj', 'ptres'
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

  const handleImportCreditos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUpdatingSaldos(true);
    const toastId = toast.loading('Processando arquivo de Crédito Disponível...');

    try {
      // FileReader para ler como UTF-16LE
      const reader = new FileReader();
      
      const fileContent = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        // Tentar UTF-16LE primeiro, se falhar ou parecer estranho, UTF-8
        reader.readAsText(file, 'UTF-16LE');
      });

      const lines = fileContent.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) throw new Error('Arquivo vazio ou inválido');

      // Detect separator
      const headerLine = lines[0];
      const sep = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : ',');
      
      const data: Record<string, string>[] = lines.slice(1).map(line => {
        const cols = splitCsvLine(line, sep);
        if (cols.length < 2) return null;
        return {
          ptres: (cols[0] || '').trim(),
          metrica: (cols[1] || '').trim(),
          valor: (cols[2] || '').trim()
        } as Record<string, string>;
      }).filter((item): item is Record<string, string> => item !== null);

      await transparenciaService.importCreditosDisponiveis(data);
      await refreshData();
      toast.success('Créditos disponíveis atualizados com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Erro ao importar créditos:', error);
      toast.error('Erro ao importar créditos: ' + error.message, { id: toastId });
    } finally {
      setIsUpdatingSaldos(false);
      if (creditosInputRef.current) creditosInputRef.current.value = '';
    }
  };





  const lastUpdate = empenhos.reduce((max, e) => {
    if (!e.ultimaAtualizacaoSiafi) return max;
    const date = new Date(e.ultimaAtualizacaoSiafi);
    return date > max ? date : max;
  }, new Date(0));
  const hasLastUpdate = lastUpdate.getTime() > 0;
  return (
    <div className="space-y-space-6 pb-space-10">
      <HeaderActions>
        <div className="flex gap-space-2">
          <input
            type="file"
            ref={saldosInputRef}
            onChange={handleImportSaldos}
            accept=".csv"
            className="hidden"
          />
          <input
            type="file"
            ref={creditosInputRef}
            onChange={handleImportCreditos}
            accept=".csv"
            className="hidden"
          />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => saldosInputRef.current?.click()}
                  className="gap-space-2 h-space-8 text-text-xs sm:h-space-9 sm:text-text-sm bg-surface-card border-border-default shadow-shadow-sm transition-all"
                  disabled={isUpdatingSaldos}
                >
                  {isUpdatingSaldos ? (
                    <>
                      <Loader2 className="h-space-4 w-space-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-space-4 w-space-4 text-status-success" />
                      Importar CSV
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Importar CSV SIAFI (Exec_NE_Exercicio_RAP_UG_Executora.csv)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => creditosInputRef.current?.click()}
                  className="gap-space-2 h-space-8 text-text-xs sm:h-space-9 sm:text-text-sm bg-surface-card border-border-default shadow-shadow-sm transition-all"
                  disabled={isUpdatingSaldos}
                >
                  <Upload className="h-space-4 w-space-4 text-action-primary" />
                  Importar Crédito
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Importar CSV de Crédito Disponível (UTF-16LE)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </HeaderActions>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {creditosDisponiveis.length > 0 ? (
          creditosDisponiveis.slice(0, 4).map((credito, idx) => (
            <StatCard
              key={credito.id}
              title={
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/60 font-bold tracking-widest uppercase">PTRES</span>
                  <span className="text-sm font-black text-foreground bg-slate-100 rounded leading-none px-1.5 py-1 border border-border/50 shadow-sm">
                    {credito.ptres}
                  </span>
                </div>
              }
              value={formatCurrency(credito.valor)}
              subtitle="Crédito Disponível"
              icon={Layers}
              stitchColor={idx === 0 ? "vibrant-blue" : idx === 1 ? "purple" : idx === 2 ? "emerald-green" : "amber"}
              isLoading={isLoading}
            />
          ))
        ) : (
          <StatCard
            title="Crédito Disponível"
            value="Importe os dados"
            icon={Layers}
            stitchColor="vibrant-blue"
            isLoading={isLoading}
          />
        )}
      </div>
      <Card className="card-system shadow-sm">
        <CardHeader className="pb-3 px-0 pt-0">
          <CardTitle className="text-xl font-bold">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Linha 1: Busca e Filtros Básicos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empenhos..."
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
                <SelectTrigger className="input-system h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  {activeTab !== 'restos' && <SelectItem value="liquidado">Liquidado</SelectItem>}
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
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

          {/* Linha 2: Filtros Avançados (Colapsável) */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 mt-4 bg-slate-50/50 rounded-lg border border-border-default/50">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Componente Funcional</label>
                <Select value={filterComponente} onValueChange={setFilterComponente}>
                  <SelectTrigger className="input-system">
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

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Origem de Recurso</label>
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

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plano Interno</label>
                <Select value={filterPlanoInterno} onValueChange={setFilterPlanoInterno}>
                  <SelectTrigger className="input-system">
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
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período (Início)</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="input-system h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período (Fim)</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="input-system h-10"
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
                    className="h-10 w-10 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Limpar</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6 mt-6">
        <TabsList className="bg-slate-100 p-1 rounded-lg h-auto">
          <TabsTrigger value="execucao" className="px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md text-sm font-semibold">Execução {new Date().getFullYear()}</TabsTrigger>
          <TabsTrigger value="restos" className="px-6 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md text-sm font-semibold">Restos a Pagar</TabsTrigger>
        </TabsList>

        <TabsContent value="execucao">
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'exercicio' || (!e.tipo && e.numero.includes(String(new Date().getFullYear()))))}
            type="execucao"
            handleOpenDialog={handleOpenDialog}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="restos">
          <EmpenhosTable
            empenhos={filteredEmpenhos.filter(e => e.tipo === 'rap' || (!e.tipo && !e.numero.includes(String(new Date().getFullYear()))))}
            type="restos"
            handleOpenDialog={handleOpenDialog}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      <EmpenhoDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        empenho={selectedEmpenho}
        atividades={atividades}
        onSave={handleSaveEmpenho}
      />
    </div>
  );
}

function EmpenhoRow({
  empenho,
  type,
  handleOpenDialog,
  isChild = false
}: {
  empenho: Empenho;
  type: 'execucao' | 'restos';
  handleOpenDialog: (e: Empenho) => void;
  isChild?: boolean;
}) {
  return (
    <TableRow className={`hover:bg-slate-50/80 transition-colors border-b border-border-default/50 ${isChild ? 'bg-slate-50/30' : ''}`}>
      <TableCell className={`py-4 px-6 align-top ${isChild ? 'pl-10' : ''}`}>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm font-semibold whitespace-nowrap">{empenho.numero}</span>
          {empenho.processo && (
            <span className="text-xs text-muted-foreground whitespace-nowrap" title="Processo">
              Proc: {empenho.processo}
            </span>
          )}
          {empenho.historicoOperacoes && empenho.historicoOperacoes.length > 1 && (
            <span className="text-[10px] text-action-primary flex items-center gap-0.5" title="Empenho com histórico de alterações">
              <History className="h-3 w-3" />
              {empenho.historicoOperacoes.length} ops
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-4 px-4 align-top">
        <div className="flex flex-col">
          <span className="text-sm font-medium truncate max-w-[150px]" title={empenho.favorecidoNome}>{empenho.favorecidoNome || '-'}</span>
          <span className="text-xs text-muted-foreground">
            {formatarDocumento(empenho.favorecidoDocumento || '')}
          </span>
        </div>
      </TableCell>
      {type === 'execucao' ? (
        <TableCell className="py-4 px-4 align-top">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium whitespace-nowrap">{empenho.origemRecurso || '-'}</p>
            {empenho.planoInterno && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">{empenho.planoInterno}</span>
            )}
          </div>
        </TableCell>
      ) : (
        <TableCell className="py-4 px-4 align-top">
          <span className="text-sm line-clamp-2" title={empenho.descricao}>{empenho.descricao || '-'}</span>
        </TableCell>
      )}
      <TableCell className="py-4 px-4 text-right align-top whitespace-nowrap">
        <div className="flex flex-col gap-1 items-end">
          {type === 'restos' && empenho.rapInscrito != null ? (
            <>
              <span className="font-semibold text-sm" title="Inscrito (original)">
                {formatCurrency(empenho.rapInscrito || 0)}
              </span>
              <span className={`text-xs ${(empenho.rapALiquidar || 0) > 0 ? 'text-status-warning' : 'text-muted-foreground'}`} title="A Liquidar">
                A Liq: {formatCurrency(empenho.rapALiquidar || 0)}
              </span>
              <span className={`text-xs ${(empenho.rapLiquidado || 0) > 0 ? 'text-status-info' : 'text-muted-foreground'}`} title="Liquidado">
                Liq: {formatCurrency(empenho.rapLiquidado || 0)}
              </span>
              <span className={`text-xs ${(empenho.rapPago || 0) > 0 ? 'text-status-success' : 'text-muted-foreground'}`} title="Pago">
                Pg: {formatCurrency(empenho.rapPago || 0)}
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-sm" title={type === 'execucao' ? 'Empenhado' : 'Inscrito'}>
                {formatCurrency(empenho.valor)}
              </span>
              {type === 'execucao' ? (
                <>
                  <span className={`text-xs ${(empenho.valorLiquidado || 0) > 0 ? 'text-status-info' : 'text-muted-foreground'}`} title="Liquidado">
                    Liq: {formatCurrency(empenho.valorLiquidado || 0)}
                  </span>
                  {(empenho.valorPago || 0) > 0 && (
                    <span className="text-[10px] text-status-success" title="Pago">
                      Pg: {formatCurrency(empenho.valorPago || 0)}
                    </span>
                  )}
                </>
              ) : (
                <span className={`text-xs ${(empenho.valorPago || 0) > 0 ? 'text-status-success' : 'text-muted-foreground'}`} title="Pago">
                  Pg: {formatCurrency(empenho.valorPago || 0)}
                </span>
              )}
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="py-4 px-4 text-right align-top whitespace-nowrap">
        {(() => {
          if (type === 'restos') {
            const aLiquidar = empenho.rapALiquidar || 0;
            return (
              <span className={`font-semibold text-sm ${aLiquidar > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}>
                {formatCurrency(aLiquidar)}
              </span>
            );
          }
          const saldo = empenho.valor - (empenho.valorLiquidado || 0);
          return (
            <span className={`font-semibold text-sm ${saldo > 0 ? 'text-status-success' : saldo < 0 ? 'text-status-error' : 'text-muted-foreground'}`}>
              {formatCurrency(saldo)}
            </span>
          );
        })()}
      </TableCell>

      <TableCell className="py-4 px-6 align-top whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-action-primary hover:bg-action-primary/10"
            onClick={() => handleOpenDialog(empenho)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Extracted Component for Table Reuse inside Tabs
function EmpenhosTable({ empenhos, type, handleOpenDialog, isLoading }: {
  empenhos: Empenho[],
  type: 'execucao' | 'restos',
  handleOpenDialog: (e: Empenho) => void,
  isLoading?: boolean
}) {
  const [sortKey, setSortKey] = useState<string>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const [groupBy, setGroupBy] = useState<'none' | 'favorecido'>('none');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const processData = useMemo(() => {
    if (groupBy === 'none') {
      return empenhos.map(e => ({ isGroup: false as const, item: e }));
    }

    const groups = new Map<string, Empenho[]>();
    empenhos.forEach(e => {
      const key = e.favorecidoNome || 'Não informado';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });

    return Array.from(groups.entries()).map(([name, items]) => ({
      isGroup: true as const,
      name,
      items,
      valorTotal: items.reduce((acc, e) => acc + (type === 'restos' ? (e.rapInscrito || e.valor) : e.valor), 0),
      saldoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? (e.rapALiquidar || 0) : (e.valor - (e.valorLiquidado || 0))), 0),
      pagoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? (e.rapPago || 0) : (e.valorPago || 0)), 0),
      liquidadoTotal: items.reduce((acc, e) => acc + (type === 'restos' ? (e.rapLiquidado || 0) : (e.valorLiquidado || 0)), 0),
    }));
  }, [empenhos, groupBy, type]);

  const sortedData = useMemo(() => {
    const sorted = [...processData].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (a.isGroup && b.isGroup) {
        switch (sortKey) {
          case 'favorecido': valA = a.name; valB = b.name; break;
          case 'valor': valA = a.valorTotal; valB = b.valorTotal; break;
          case 'saldo': valA = a.saldoTotal; valB = b.saldoTotal; break;
          case 'pago': valA = a.pagoTotal; valB = b.pagoTotal; break;
          default: valA = a.name; valB = b.name; break;
        }
      } else {
        const itemA = (a as { isGroup: false; item: Empenho }).item;
        const itemB = (b as { isGroup: false; item: Empenho }).item;
        switch (sortKey) {
          case 'numero': valA = itemA.numero; valB = itemB.numero; break;
          case 'favorecido': valA = itemA.favorecidoNome || ''; valB = itemB.favorecidoNome || ''; break;
          case 'valor':
            valA = type === 'restos' ? (itemA.rapInscrito || itemA.valor) : itemA.valor;
            valB = type === 'restos' ? (itemB.rapInscrito || itemB.valor) : itemB.valor;
            break;
          case 'saldo':
            valA = type === 'restos' ? (itemA.rapALiquidar || 0) : (itemA.valor - (itemA.valorLiquidado || 0));
            valB = type === 'restos' ? (itemB.rapALiquidar || 0) : (itemB.valor - (itemB.valorLiquidado || 0));
            break;
          case 'pago':
            valA = type === 'restos' ? (itemA.rapPago || 0) : (itemA.valorPago || 0);
            valB = type === 'restos' ? (itemB.rapPago || 0) : (itemB.valorPago || 0);
            break;
          default: valA = itemA.numero; valB = itemB.numero;
        }
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [processData, sortKey, sortDir, type]);

  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / perPage);
  const paginatedData = sortedData.slice((page - 1) * perPage, page * perPage);

  const SortHeader = ({ label, colKey, align = 'left' }: { label: string; colKey: string; align?: 'left' | 'right' | 'center' }) => (
    <TableHead
      className={`h-11 px-4 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}
      onClick={() => handleSort(colKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortKey === colKey && (
          <span className="text-action-primary text-xs transition-transform duration-200">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </TableHead>
  );

  return (
    <Card className="card-system overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">
          {empenhos.length} empenho{empenhos.length !== 1 ? 's' : ''} encontrado{empenhos.length !== 1 ? 's' : ''}
        </CardTitle>
        <Button
          variant={groupBy === 'favorecido' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setGroupBy(g => g === 'none' ? 'favorecido' : 'none')}
          className="h-8 gap-2 btn-secondary"
        >
          <Layers className="h-4 w-4" />
          {groupBy === 'favorecido' ? 'Desagrupar' : 'Agrupar por Favorecido'}
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-b border-border-default/50">
                {groupBy === 'none' && <SortHeader label="Número" colKey="numero" />}
                <SortHeader label="Favorecido" colKey="favorecido" />
                {type === 'execucao' ? (
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">Origem / Plano</TableHead>
                ) : (
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
                )}
                <SortHeader label={type === 'execucao' ? 'Empenhado / Liquidado' : 'Inscrito / A Liq / Liq / Pago'} colKey="valor" align="right" />
                <SortHeader label={type === 'execucao' ? 'Saldo' : 'A Liquidar'} colKey="saldo" align="right" />
                <TableHead className="h-11 px-6 text-center text-xs font-semibold uppercase tracking-wider">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-4"><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell className="px-4"><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell className="px-4"><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell className="px-4"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    <TableCell className="px-4"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                    <TableCell className="px-6"><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">Nenhum empenho encontrado.</TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, idx) => {
                  if (row.isGroup) {
                    const isExpanded = expandedGroups[row.name];
                    return (
                      <Fragment key={`group-${idx}`}>
                        <TableRow
                          className="bg-slate-50/50 hover:bg-slate-100/80 transition-colors cursor-pointer border-b border-border-default/50"
                          onClick={() => toggleGroup(row.name)}
                        >
                          <TableCell className="py-4 px-6 font-medium" colSpan={2}>
                            <div className="flex items-center gap-2">
                              <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <span>{row.name}</span>
                              <Badge variant="secondary" className="ml-2 bg-white text-xs">{row.items.length}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4 text-sm text-muted-foreground">
                            -
                          </TableCell>
                          <TableCell className="py-4 px-4 text-right">
                            <div className="flex flex-col gap-1 items-end">
                              <span className="font-bold text-sm">{formatCurrency(row.valorTotal)}</span>
                              {type === 'execucao' ? (
                                <>
                                  <span className={`text-[11px] ${(row.liquidadoTotal || 0) > 0 ? 'text-status-info' : 'text-muted-foreground'}`} title="Liquidado">
                                    Liq: {formatCurrency(row.liquidadoTotal)}
                                  </span>
                                  {(row.pagoTotal || 0) > 0 && (
                                    <span className="text-[11px] text-status-success" title="Pago">
                                      Pg: {formatCurrency(row.pagoTotal)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className={`text-[11px] ${(row.saldoTotal || 0) > 0 ? 'text-status-warning' : 'text-muted-foreground'}`} title="A Liquidar">
                                    A Liq: {formatCurrency(row.saldoTotal)}
                                  </span>
                                  <span className={`text-[11px] ${(row.liquidadoTotal || 0) > 0 ? 'text-status-info' : 'text-muted-foreground'}`} title="Liquidado">
                                    Liq: {formatCurrency(row.liquidadoTotal)}
                                  </span>
                                  <span className={`text-[11px] ${(row.pagoTotal || 0) > 0 ? 'text-status-success' : 'text-muted-foreground'}`} title="Pago">
                                    Pg: {formatCurrency(row.pagoTotal)}
                                  </span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4 text-right">
                            {(() => {
                              if (type === 'restos') {
                                return (
                                  <span className={`font-bold text-sm ${row.saldoTotal > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}>
                                    {formatCurrency(row.saldoTotal)}
                                  </span>
                                );
                              }
                              return (
                                <span className={`font-bold text-sm ${row.saldoTotal > 0 ? 'text-status-success' : row.saldoTotal < 0 ? 'text-status-error' : 'text-muted-foreground'}`}>
                                  {formatCurrency(row.saldoTotal)}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="py-4 px-6 text-center"></TableCell>
                        </TableRow>
                        {isExpanded && row.items.map(empenho => (
                          <EmpenhoRow key={empenho.id} empenho={empenho} type={type} handleOpenDialog={handleOpenDialog} isChild />
                        ))}
                      </Fragment>
                    );
                  } else {
                    const singleRow = row as { isGroup: false; item: Empenho };
                    return <EmpenhoRow key={singleRow.item.id} empenho={singleRow.item} type={type} handleOpenDialog={handleOpenDialog} />;
                  }
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Paginação */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 border-t border-border-default/50 mt-4 gap-4">
          <div className="text-xs text-muted-foreground">
            Mostrando <strong>{totalRecords === 0 ? 0 : ((page - 1) * perPage) + 1}</strong> a <strong>{Math.min(page * perPage, totalRecords)}</strong> de <strong>{totalRecords}</strong> registros
          </div>
          <div className="flex items-center space-x-2">
            <Select value={String(perPage)} onValueChange={(val) => { setPerPage(Number(val)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] input-system">
                <SelectValue placeholder={String(perPage)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200"
                onClick={() => setPage(1)}
                disabled={page <= 1 || isLoading}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 px-2">
                <span className="text-xs font-bold text-slate-600">
                  {page} <span className="text-muted-foreground font-normal">/ {totalPages || 1}</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-slate-200"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || isLoading}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


