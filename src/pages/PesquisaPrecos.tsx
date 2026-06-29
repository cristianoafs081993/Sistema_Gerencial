import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  buildPriceResearchReportHtml,
  createPriceResearchTemplate,
  exportPriceResearchWorkbook,
  getEstimatedUnitPrice,
  getSelectedStatistics,
  parsePriceResearchFile,
  validatePriceResearchReport,
  type PriceResearchCandidate,
  type PriceResearchItem,
  type PriceResearchMethod,
  type PriceResearchReportData,
} from '@/lib/priceResearch';
import { findCatalogSuggestions } from '@/lib/priceCatalogClient';
import { priceResearchService } from '@/services/priceResearch';

const METHOD_OPTIONS: Array<{ value: PriceResearchMethod; label: string }> = [
  { value: 'median', label: 'Mediana' },
  { value: 'mean', label: 'Média' },
  { value: 'minimum', label: 'Menor preço' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function candidateStatus(candidate: PriceResearchCandidate) {
  if (!candidate.unitCompatible) return { label: 'Revisar unidade', className: 'border-amber-300 bg-amber-50 text-amber-800' };
  if (candidate.aiScore >= 80) return { label: 'Alta aderência', className: 'border-primary/20 bg-primary/[0.08] text-primary' };
  if (candidate.aiScore >= 60) return { label: 'Aderente', className: 'border-sebrae-blue/25 bg-sebrae-blue/[0.08] text-sebrae-blue' };
  return { label: 'Revisar descrição', className: 'border-slate-300 bg-slate-50 text-slate-700' };
}

export default function PesquisaPrecos() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [researchId, setResearchId] = useState<string>();
  const [activeStep, setActiveStep] = useState(1);
  const [title, setTitle] = useState('Relatório de Pesquisa de Preços');
  const [processNumber, setProcessNumber] = useState('');
  const [objectDescription, setObjectDescription] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [researchDate, setResearchDate] = useState(today);
  const [method, setMethod] = useState<PriceResearchMethod>('median');
  const [methodologyJustification, setMethodologyJustification] = useState(
    'A mediana foi adotada por reduzir o efeito de valores extremos, após análise crítica da comparabilidade das especificações, unidades e quantidades.',
  );
  const [notes, setNotes] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [items, setItems] = useState<PriceResearchItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingResearchId, setLoadingResearchId] = useState<string>();

  const { data: recentResearches = [], isFetching: isFetchingRecent } = useQuery({
    queryKey: ['price-researches'],
    queryFn: () => priceResearchService.listRecent(),
    staleTime: 15000,
  });

  const selectedItem = items.find((item) => item.localId === selectedItemId) ?? items[0];
  const selectedStatistics = selectedItem ? getSelectedStatistics(selectedItem) : null;
  const selectedEstimatedPrice = selectedItem ? getEstimatedUnitPrice(selectedItem, method) : 0;
  const completedItems = items.filter((item) => item.candidates.length > 0).length;
  const selectedQuotesCount = items.reduce(
    (total, item) => total + item.candidates.filter((candidate) => candidate.selected).length,
    0,
  );
  const estimatedTotal = items.reduce(
    (total, item) => total + (getEstimatedUnitPrice(item, method) * item.quantity),
    0,
  );

  const reportData = useMemo<PriceResearchReportData>(() => ({
    title,
    processNumber,
    objectDescription,
    responsibleName,
    researchDate,
    method,
    methodologyJustification,
    notes,
    sourceFile,
    items,
  }), [
    items,
    method,
    methodologyJustification,
    notes,
    objectDescription,
    processNumber,
    researchDate,
    responsibleName,
    sourceFile,
    title,
  ]);

  const updateItem = (localId: string, patch: Partial<PriceResearchItem>) => {
    setItems((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
  };

  const updateCandidate = (localId: string, candidateId: string, patch: Partial<PriceResearchCandidate>) => {
    setItems((current) => current.map((item) => {
      if (item.localId !== localId) return item;
      return {
        ...item,
        candidates: item.candidates.map((candidate) => (
          candidate.id === candidateId ? { ...candidate, ...patch } : candidate
        )),
      };
    }));
  };

  const suggestCatalogForItem = async (item: PriceResearchItem) => {
    updateItem(item.localId, {
      catalogMatchStatus: 'searching',
      catalogMatchError: undefined,
      catalogSuggestions: [],
    });
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const suggestions = await findCatalogSuggestions(item.description, item.catalogType);
      updateItem(item.localId, {
        catalogMatchStatus: 'success',
        catalogSuggestions: suggestions,
        catalogMatchError: suggestions.length === 0
          ? 'Nenhum código semelhante foi localizado. Revise a descrição ou troque o catálogo.'
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível consultar o catálogo.';
      updateItem(item.localId, {
        catalogMatchStatus: 'error',
        catalogMatchError: message,
      });
      toast.error(message);
    }
  };

  const suggestMissingCatalogCodes = async (targetItems: PriceResearchItem[]) => {
    const missing = targetItems.filter((item) => !item.catalogCode);
    for (const item of missing) {
      await suggestCatalogForItem(item);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsParsing(true);
    try {
      const parsed = await parsePriceResearchFile(file);
      setItems(parsed);
      setSelectedItemId(parsed[0]?.localId);
      setSourceFile(file.name);
      setResearchId(undefined);
      toast.success(`${parsed.length} item(ns) importado(s).`);
      const missingCodes = parsed.filter((item) => !item.catalogCode).length;
      if (missingCodes > 0) {
        toast.info(`Buscando códigos semelhantes para ${missingCodes} item(ns) sem CATMAT/CATSER.`);
        void suggestMissingCatalogCodes(parsed);
      }
      // Avança automaticamente para o Passo 2 após importar
      setActiveStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const searchPrices = async () => {
    const invalid = items.filter((item) => !/^\d{4,9}$/.test(item.catalogCode));
    if (invalid.length > 0) {
      const missing = invalid.filter((item) => !item.catalogCode);
      if (missing.length > 0) {
        toast.info(`Confirme uma sugestão de CATMAT/CATSER para ${missing.length} item(ns).`);
        void suggestMissingCatalogCodes(missing);
      } else {
        toast.error(`Informe um CATMAT/CATSER válido para ${invalid.length} item(ns).`);
      }
      return;
    }

    setIsSearching(true);
    setItems((current) => current.map((item) => ({ ...item, searchStatus: 'searching', searchError: undefined })));
    try {
      const results = await priceResearchService.search(items);
      const resultMap = new Map(results.map((result) => [result.localId, result]));
      setItems((current) => current.map((item) => {
        const result = resultMap.get(item.localId);
        return {
          ...item,
          candidates: result?.candidates ?? [],
          searchStatus: result?.error ? 'error' : 'success',
          searchError: result?.error,
        };
      }));
      const found = results.reduce((total, result) => total + result.candidates.length, 0);
      toast.success(`${found} referência(s) oficial(is) encontrada(s).`);
      // Avança para a curadoria automaticamente ao buscar preços com sucesso (Passo 4)
      setActiveStep(4);
    } catch (error) {
      setItems((current) => current.map((item) => ({
        ...item,
        searchStatus: 'error',
        searchError: error instanceof Error ? error.message : 'Falha na pesquisa.',
      })));
      toast.error(error instanceof Error ? error.message : 'Não foi possível pesquisar os preços.');
    } finally {
      setIsSearching(false);
    }
  };

  const saveResearch = async (status: 'review' | 'completed' = 'review', silent = false) => {
    if (items.length === 0) {
      if (!silent) toast.error('Importe uma planilha antes de salvar.');
      return false;
    }
    setIsSaving(true);
    try {
      const id = await priceResearchService.save(reportData, { id: researchId, status });
      setResearchId(id);
      await queryClient.invalidateQueries({ queryKey: ['price-researches'] });
      if (!silent) {
        toast.success(status === 'completed' ? 'Pesquisa concluída e salva.' : 'Pesquisa salva para revisão.');
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a pesquisa.');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const autoSaveResearch = async () => {
    if (items.length === 0) return;
    try {
      const id = await priceResearchService.save(reportData, { id: researchId, status: 'review' });
      setResearchId(id);
      await queryClient.invalidateQueries({ queryKey: ['price-researches'] });
      toast.success('Rascunho salvo automaticamente.', { id: 'auto-save', duration: 2000 });
    } catch (error) {
      console.warn('Auto-salvamento silencioso falhou:', error);
    }
  };

  const goToStep = (step: number) => {
    if (step === activeStep) return;
    if (step > 1 && items.length === 0) {
      toast.error('Importe um arquivo de itens antes de prosseguir.');
      return;
    }

    // Regra 1: Bloquear Passo 3 ou superior se houver itens sem código CATMAT/CATSER
    if (step >= 3) {
      const itemsWithoutCode = items.filter((item) => !item.catalogCode);
      if (itemsWithoutCode.length > 0) {
        toast.error(`Mapeamento pendente: associe um código CATMAT/CATSER para todos os ${itemsWithoutCode.length} item(ns) antes de prosseguir.`);
        return;
      }
    }

    // Regra 2: Bloquear Passo 4 ou superior se a busca de preços ainda estiver pendente (idle)
    if (step >= 4) {
      const itemsNotSearched = items.filter((item) => item.searchStatus === 'idle');
      if (itemsNotSearched.length > 0) {
        toast.error(`Busca de preços pendente: realize a busca de preços oficiais (Passo 3) antes de prosseguir.`);
        return;
      }
    }

    setActiveStep(step);
    void autoSaveResearch();
  };

  const printReport = async () => {
    const errors = validatePriceResearchReport(reportData);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    const saved = await saveResearch('completed');
    if (!saved) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura do relatório.');
      return;
    }
    printWindow.document.write(buildPriceResearchReportHtml(reportData));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 100);
  };

  const loadResearch = async (id: string) => {
    setLoadingResearchId(id);
    try {
      const record = await priceResearchService.getById(id);
      if (!record) throw new Error('Pesquisa não encontrada.');
      setResearchId(record.id);
      setTitle(record.title);
      setProcessNumber(record.processNumber);
      setObjectDescription(record.objectDescription);
      setResponsibleName(record.responsibleName);
      setResearchDate(record.researchDate);
      setMethod(record.method);
      setMethodologyJustification(record.methodologyJustification);
      setNotes(record.notes);
      setSourceFile(record.sourceFile);
      setItems(record.items);
      setSelectedItemId(record.items[0]?.localId);
      
      // Define a etapa adequada
      const hasSearch = record.items.every(item => item.searchStatus !== 'idle');
      const hasCodes = record.items.every(item => item.catalogCode);
      if (hasSearch) {
        setActiveStep(4); // Vai para a curadoria se a busca já foi executada
      } else if (hasCodes) {
        setActiveStep(3); // Vai para o console de busca se já tem códigos
      } else {
        setActiveStep(2); // Vai para catalogação se faltam códigos
      }
      
      toast.success('Pesquisa carregada com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a pesquisa.');
    } finally {
      setLoadingResearchId(undefined);
    }
  };

  // Compila erros de validação da IN 65/2021
  const validationErrors = useMemo(() => {
    const errors: Array<{ type: string; message: string; itemId?: string }> = [];
    if (!title.trim()) errors.push({ type: 'meta', message: 'Título do relatório não preenchido.' });
    if (!processNumber.trim()) errors.push({ type: 'meta', message: 'Número do processo não informado.' });
    if (!responsibleName.trim()) errors.push({ type: 'meta', message: 'Agente responsável não informado.' });
    if (!objectDescription.trim()) errors.push({ type: 'meta', message: 'Descrição do objeto não informada.' });
    if (!methodologyJustification.trim()) errors.push({ type: 'meta', message: 'Justificativa da metodologia não preenchida.' });

    for (const item of items) {
      if (!item.catalogCode) {
        errors.push({ type: 'catalog', message: `Item ${item.itemNumber}: código CATMAT/CATSER ausente.`, itemId: item.localId });
      }
      if (item.searchStatus === 'idle') {
        errors.push({ type: 'search', message: `Item ${item.itemNumber}: busca de preços não executada.`, itemId: item.localId });
      }
      const selected = item.candidates.filter((candidate) => candidate.selected);
      if (item.candidates.length > 0 && selected.length < 3) {
        errors.push({ type: 'quotes', message: `Item ${item.itemNumber}: menos de 3 cotações selecionadas (Mínimo recomendado pela IN 65/2021).`, itemId: item.localId });
      }
      const exclusionsWithoutReason = item.candidates.filter(
        (candidate) => !candidate.selected && !candidate.exclusionReason.trim(),
      );
      if (exclusionsWithoutReason.length > 0) {
        errors.push({ type: 'justification', message: `Item ${item.itemNumber}: possui ${exclusionsWithoutReason.length} cotação(ões) desconsiderada(s) sem justificativa.`, itemId: item.localId });
      }
    }
    return errors;
  }, [items, title, processNumber, responsibleName, objectDescription, methodologyJustification]);

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Pesquisa de preços com fontes oficiais e revisão humana</HeaderSubtitle>
      
      {/* Visual Stepper Wizard (5 Etapas) */}
      <div className="border border-border-default bg-surface-card rounded-radius-lg p-4 shadow-soft">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full">
            {[
              { number: 1, label: '1. Identificação', desc: 'Metadados e Carga' },
              { number: 2, label: '2. Catálogo', desc: 'Mapeamento CATMAT/SER' },
              { number: 3, label: '3. Busca', desc: 'Consulta de Preços' },
              { number: 4, label: '4. Curadoria', desc: 'Seleção de Referências' },
              { number: 5, label: '5. Relatório', desc: 'Validação e Fechamento' },
            ].map((step) => {
              const isCompleted = step.number < activeStep;
              const isActive = step.number === activeStep;
              
              // Determina se pode clicar diretamente no botão
              let isSelectable = step.number === 1;
              if (step.number === 2) {
                isSelectable = items.length > 0;
              } else if (step.number === 3) {
                isSelectable = items.length > 0 && items.every(i => i.catalogCode);
              } else if (step.number >= 4) {
                isSelectable = items.length > 0 && items.every(i => i.catalogCode) && items.every(i => i.searchStatus !== 'idle');
              }
              
              return (
                <button
                  key={step.number}
                  type="button"
                  disabled={!isSelectable}
                  onClick={() => goToStep(step.number)}
                  className={`flex items-start gap-2.5 text-left p-3 rounded-radius-md border transition-all ${
                    isActive
                      ? 'border-primary bg-primary/[0.04] text-primary shadow-sm'
                      : isCompleted
                      ? 'border-primary/20 bg-surface-subtle/40 text-text-primary'
                      : 'border-border-default bg-surface-subtle/10 text-text-muted opacity-60'
                  } ${isSelectable ? 'hover:opacity-100 cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/25 text-primary'
                      : 'bg-surface-subtle border border-border-default text-text-muted'
                  }`}>
                    {isCompleted ? '✓' : step.number}
                  </span>
                  <div className="min-w-0">
                    <p className={`font-ui text-xs font-bold leading-none truncate ${isActive ? 'text-primary' : 'text-text-primary'}`}>{step.label}</p>
                    <p className="font-ui text-[10px] text-text-secondary mt-1 truncate">{step.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Actions Header */}
      <HeaderActions>
        <Button type="button" variant="outline" className="gap-2" onClick={createPriceResearchTemplate}>
          <FileDown className="h-4 w-4" />
          Baixar modelo
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
          {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar arquivo
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void saveResearch('review')} disabled={isSaving || items.length === 0}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar rascunho
        </Button>
        <Button type="button" className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground" onClick={() => void printReport()} disabled={items.length === 0 || isSaving}>
          <Printer className="h-4 w-4" />
          Gerar relatório
        </Button>
      </HeaderActions>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,application/pdf"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {/* STEP 1: IDENTIFICAÇÃO & PLANILHA */}
      {activeStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <SectionPanel
            title="Identificação da pesquisa"
            description="Campos obrigatórios para formalização do relatório conforme a IN SEGES/ME nº 65/2021."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="research-title">Título do Relatório</Label>
                <Input id="research-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-process">Número do Processo</Label>
                <Input id="research-process" value={processNumber} onChange={(event) => setProcessNumber(event.target.value)} placeholder="23035.000000/2026-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-date">Data da Pesquisa</Label>
                <Input id="research-date" type="date" value={researchDate} onChange={(event) => setResearchDate(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="research-object">Objeto da Contratação</Label>
                <Textarea id="research-object" value={objectDescription} onChange={(event) => setObjectDescription(event.target.value)} rows={3} placeholder="Descrição sucinta do objeto..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="research-responsible">Agente Responsável</Label>
                <Input id="research-responsible" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Método Estatístico</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as PriceResearchMethod)}>
                  <SelectTrigger aria-label="Método de cálculo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4">
                <Label htmlFor="methodology">Justificativa da Metodologia Adotada</Label>
                <Textarea id="methodology" value={methodologyJustification} onChange={(event) => setMethodologyJustification(event.target.value)} rows={2} />
              </div>
            </div>
          </SectionPanel>

          {items.length === 0 ? (
            <SectionPanel
              title="Arquivo de custos"
              description="Forneça a lista de itens a serem orçados em formato Excel ou PDF legível."
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-radius-xl border-2 border-dashed border-primary/25 bg-primary/[0.02] px-6 py-16 text-center transition-colors hover:bg-primary/[0.05]"
              >
                <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
                <span className="mt-4 font-ui text-base font-semibold text-text-primary">Clique para importar planilha ou PDF de custos</span>
                <span className="mt-1 max-w-xl font-ui text-sm text-text-secondary">
                  Formatos XLSX, XLS, CSV ou PDF pesquisável. O arquivo deve conter colunas de descrição, quantidade, unidade e idealmente código CATMAT ou CATSER.
                </span>
              </button>
            </SectionPanel>
          ) : (
            <div className="rounded-radius-lg border border-primary/20 bg-primary/[0.02] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-ui text-sm font-semibold text-text-primary">Planilha de Itens Carregada</h4>
                  <p className="font-ui text-xs text-text-secondary mt-0.5">
                    Arquivo: <span className="font-semibold">{sourceFile}</span> | Total: <span className="font-semibold">{items.length} itens</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Substituir planilha
                </Button>
                <Button type="button" className="gap-2 bg-primary text-primary-foreground" onClick={() => goToStep(2)}>
                  Avançar para Catálogo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {recentResearches.length > 0 && (
            <SectionPanel
              title="Pesquisas recentes"
              description="Carregue rascunhos salvos anteriormente para continuar a trabalhar."
              actions={isFetchingRecent ? <RefreshCw className="h-4 w-4 animate-spin text-text-muted" /> : null}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recentResearches.map((research) => (
                  <button
                    key={research.id}
                    type="button"
                    onClick={() => void loadResearch(research.id)}
                    className="rounded-radius-lg border border-border-default bg-surface-card p-4 text-left transition-colors hover:bg-surface-subtle flex flex-col justify-between"
                  >
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 font-ui text-sm font-bold text-text-primary">{research.title}</p>
                        {loadingResearchId === research.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 font-ui text-xs text-text-secondary leading-normal">{research.objectDescription || 'Sem objeto descrito'}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between w-full border-t border-border-default/50 pt-3">
                      <Badge variant="outline" className={research.status === 'completed' ? 'border-primary/20 bg-primary/5 text-primary' : 'border-amber-300 bg-amber-50 text-amber-800'}>
                        {research.status === 'completed' ? 'Concluída' : 'Em revisão'}
                      </Badge>
                      <span className="font-ui text-[10px] text-text-muted">{formatDate(research.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionPanel>
          )}
        </div>
      )}

      {/* STEP 2: CÓDIGOS DE CATÁLOGO */}
      {activeStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Sidebar de Itens */}
            <div className="lg:col-span-1 space-y-2 border-r border-border-default pr-4 max-h-[600px] overflow-y-auto">
              <p className="font-ui text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Itens Importados ({items.length})</p>
              {items.map((item) => {
                const hasCode = !!item.catalogCode;
                const isSelected = selectedItemId === item.localId;
                return (
                  <button
                    key={item.localId}
                    type="button"
                    onClick={() => setSelectedItemId(item.localId)}
                    className={`w-full rounded-radius-lg border p-3 text-left transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-primary bg-primary/[0.04] shadow-sm'
                        : 'border-border-default bg-surface-card hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-ui text-xs font-bold text-text-primary">Item {item.itemNumber}</span>
                      {hasCode ? (
                        <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary text-[10px] py-0 px-1.5">Mapeado</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] py-0 px-1.5">Falta código</Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 font-ui text-xs text-text-secondary leading-normal">{item.description}</p>
                    <p className="font-mono text-[10px] text-text-muted mt-1 leading-none">
                      {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'}: <span className="font-bold">{item.catalogCode || 'Pendente'}</span>
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Painel Central do Item */}
            <div className="lg:col-span-3 space-y-4">
              {selectedItem ? (
                <SectionPanel
                  title={`Configuração do Item ${selectedItem.itemNumber}`}
                  description="Preencha o código CATMAT/CATSER e as especificações para refinar a pesquisa."
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label>Descrição Técnico-Comercial do Item</Label>
                      <Textarea
                        value={selectedItem.description}
                        onChange={(event) => updateItem(selectedItem.localId, {
                          description: event.target.value,
                          catalogMatchStatus: 'idle',
                          catalogSuggestions: [],
                          catalogMatchError: undefined,
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Catálogo</Label>
                      <Select value={selectedItem.catalogType} onValueChange={(value) => updateItem(selectedItem.localId, {
                        catalogType: value as PriceResearchItem['catalogType'],
                        catalogCode: '',
                        catalogMatchStatus: 'idle',
                        catalogSuggestions: [],
                        catalogMatchError: undefined,
                        candidates: [],
                        searchStatus: 'idle',
                      })}>
                        <SelectTrigger aria-label="Tipo de catálogo"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="material">CATMAT (Materiais)</SelectItem>
                          <SelectItem value="service">CATSER (Serviços)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Código do Item</Label>
                      <div className="flex gap-2">
                        <Input
                          value={selectedItem.catalogCode}
                          onChange={(event) => updateItem(selectedItem.localId, {
                            catalogCode: event.target.value.replace(/\D/g, ''),
                            candidates: [],
                            searchStatus: 'idle',
                          })}
                          placeholder="Ex: 606523"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Sugerir código"
                          title="Sugerir códigos similares"
                          onClick={() => void suggestCatalogForItem(selectedItem)}
                          disabled={selectedItem.catalogMatchStatus === 'searching'}
                        >
                          {selectedItem.catalogMatchStatus === 'searching'
                            ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            : <Sparkles className="h-4 w-4 text-primary" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade do Termo</Label>
                      <Input type="number" min="0" step="any" value={selectedItem.quantity} onChange={(event) => updateItem(selectedItem.localId, { quantity: Number(event.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade de Fornecimento</Label>
                      <Input value={selectedItem.unit} onChange={(event) => updateItem(selectedItem.localId, { unit: event.target.value.toUpperCase() })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Capacidade Comparável</Label>
                      <Input type="number" min="0" step="any" value={selectedItem.targetCapacity ?? ''} onChange={(event) => updateItem(selectedItem.localId, { targetCapacity: event.target.value ? Number(event.target.value) : null })} placeholder="Ex: 500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Medida Comparável</Label>
                      <Input value={selectedItem.targetMeasureUnit ?? ''} onChange={(event) => updateItem(selectedItem.localId, { targetMeasureUnit: event.target.value.toUpperCase() || null })} placeholder="G, KG, ML, L, UN..." />
                    </div>
                  </div>

                  {selectedItem.catalogMatchStatus === 'searching' && (
                    <div className="mt-4 flex items-center gap-2 rounded-radius-md border border-sebrae-blue/20 bg-sebrae-blue/5 p-4 font-ui text-sm text-sebrae-navy">
                      <Loader2 className="h-4 w-4 animate-spin text-sebrae-blue" />
                      Pesquisando correspondências no catálogo de referência de IA...
                    </div>
                  )}

                  {selectedItem.catalogSuggestions && selectedItem.catalogSuggestions.length > 0 && (
                    <div className="mt-4 space-y-3 rounded-radius-lg border border-sebrae-blue/20 bg-sebrae-blue/[0.04] p-4">
                      <div>
                        <h4 className="font-ui text-sm font-semibold text-sebrae-navy">Códigos Semelhantes Identificados no Catálogo</h4>
                        <p className="font-ui text-xs text-sebrae-blue">Selecione uma das opções para usá-la como filtro da consulta.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedItem.catalogSuggestions.map((suggestion) => {
                          const isActive = selectedItem.catalogCode === suggestion.code;
                          return (
                            <div key={suggestion.code} className="rounded-radius-md border border-border-default bg-surface-card p-3 flex flex-col justify-between gap-3 shadow-sm hover:border-primary/45 transition-colors">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs">{suggestion.code}</Badge>
                                  <Badge variant="secondary" className="text-[10px]">{suggestion.score}% aderente</Badge>
                                </div>
                                <p className="mt-2 font-ui text-xs font-bold text-text-primary leading-relaxed">{suggestion.description}</p>
                                <p className="mt-1 font-ui text-[10px] text-text-muted leading-relaxed">{suggestion.reason}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isActive ? 'secondary' : 'outline'}
                                onClick={() => updateItem(selectedItem.localId, {
                                  catalogType: suggestion.catalogType,
                                  catalogCode: suggestion.code,
                                  candidates: [],
                                  searchStatus: 'idle',
                                  searchError: undefined,
                                })}
                              >
                                {isActive ? 'Código Ativo' : 'Usar este código'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedItem.catalogMatchError && (
                    <div className="mt-4 rounded-radius-md border border-amber-200 bg-amber-50 p-3.5 font-ui text-xs text-amber-900 leading-normal">
                      {selectedItem.catalogMatchError}
                    </div>
                  )}

                  {selectedItem.searchError && (
                    <div className="mt-4 rounded-radius-md border border-destructive/20 bg-destructive/5 p-3.5 font-ui text-xs text-destructive">
                      {selectedItem.searchError}
                    </div>
                  )}
                </SectionPanel>
              ) : (
                <div className="text-center py-12 border border-dashed border-border-default rounded-radius-lg text-text-muted bg-surface-card">
                  Selecione um item no menu à esquerda para configurar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: BUSCA DE PREÇOS */}
      {activeStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <SectionPanel
            title="Consulta de Preços Homologados"
            description="Dispare a consulta à API de Compras do Governo Federal (últimos 12 meses) com base nos códigos CATMAT/CATSER mapeados."
          >
            <div className="space-y-3">
              <p className="font-ui text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Progresso da Busca por Item</p>
              {items.map((item) => (
                <div key={item.localId} className="flex items-center justify-between p-3.5 rounded-radius-lg border border-border-default bg-surface-card shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-ui text-xs font-bold text-text-primary">Item {item.itemNumber}</span>
                    <p className="font-ui text-xs text-text-secondary truncate max-w-[320px]" title={item.description}>{item.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs">
                      {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'} {item.catalogCode}
                    </Badge>
                    {item.searchStatus === 'searching' && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Consultando API...
                      </div>
                    )}
                    {item.searchStatus === 'success' && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                        <span className="text-primary font-bold">✓</span>
                        {item.candidates.length} cotações encontradas
                      </div>
                    )}
                    {item.searchStatus === 'error' && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold" title={item.searchError}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Falhou
                      </div>
                    )}
                    {item.searchStatus === 'idle' && (
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="h-2 w-2 rounded-full bg-border-default"></span>
                        Aguardando disparo
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Painel de Disparo */}
            <div className="mt-6 border border-border-default bg-surface-card rounded-radius-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-soft">
              <div className="text-center md:text-left">
                <h4 className="font-ui text-sm font-semibold text-text-primary">Buscar Cotações no Compras.gov</h4>
                <p className="font-ui text-xs text-text-secondary mt-0.5">Duração aproximada: 5 a 15 segundos. A pesquisa consultará os códigos listados acima.</p>
              </div>
              <Button
                type="button"
                className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold"
                onClick={() => void searchPrices()}
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearching ? 'Pesquisando base oficial...' : 'Disparar Busca Geral'}
              </Button>
            </div>

            {/* Banner de Sucesso pós Busca */}
            {items.length > 0 && items.every((i) => i.searchStatus === 'success') && (
              <div className="mt-4 rounded-radius-lg border border-primary/20 bg-primary/[0.02] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-2.5 text-primary text-xs leading-normal">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                  <div>
                    <span className="font-bold">Pesquisa Finalizada com Sucesso!</span> Todas as cotações oficiais foram baixadas e analisadas.
                  </div>
                </div>
                <Button type="button" className="gap-1.5 text-xs bg-primary text-primary-foreground" onClick={() => goToStep(4)}>
                  Avançar para Curadoria
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </SectionPanel>
        </div>
      )}

      {/* STEP 4: CURADORIA DE COTAÇÕES */}
      {activeStep === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-6 lg:grid-cols-4">
            {/* Sidebar de Seleção de Item */}
            <div className="lg:col-span-1 space-y-2 border-r border-border-default pr-4 max-h-[600px] overflow-y-auto">
              <p className="font-ui text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Selecione o Item</p>
              {items.map((item) => {
                const selectedCount = item.candidates.filter((c) => c.selected).length;
                const isSufficient = selectedCount >= 3;
                const isSelected = selectedItemId === item.localId;
                return (
                  <button
                    key={item.localId}
                    type="button"
                    onClick={() => setSelectedItemId(item.localId)}
                    className={`w-full rounded-radius-lg border p-3 text-left transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-primary bg-primary/[0.04] shadow-sm'
                        : 'border-border-default bg-surface-card hover:bg-surface-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-ui text-xs font-bold text-text-primary">Item {item.itemNumber}</span>
                      {isSufficient ? (
                        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] py-0 px-1.5">
                          {selectedCount} selecionados
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] py-0 px-1.5">
                          {selectedCount}/3 preços
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-2 font-ui text-xs text-text-secondary leading-normal">{item.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Detalhes de Cotações do Item */}
            <div className="lg:col-span-3 space-y-6">
              {selectedItem && selectedItem.candidates.length > 0 ? (
                <>
                  {/* Estatísticas Individuais do Item */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      ['Amostra', selectedStatistics?.count ?? 0],
                      ['Média', formatCurrency(selectedStatistics?.mean ?? 0)],
                      ['Mediana', formatCurrency(selectedStatistics?.median ?? 0)],
                      ['CV', `${(selectedStatistics?.coefficientOfVariation ?? 0).toFixed(2)}%`],
                      ['Preço Estimado', formatCurrency(selectedEstimatedPrice)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-radius-lg border border-border-default bg-surface-card p-3 shadow-soft hover:shadow-md transition-shadow">
                        <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted leading-none">{label}</p>
                        <p className="mt-1.5 font-mono text-base font-bold text-text-primary truncate">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alerta de Cotações Insuficientes */}
                  {selectedItem.candidates.filter(c => c.selected).length < 3 && (
                    <div className="flex gap-2.5 rounded-radius-lg border border-amber-200 bg-amber-50/50 p-4 text-amber-900 shadow-sm">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <div className="font-ui text-xs leading-normal">
                        <span className="font-bold">Aviso legal da IN 65/2021:</span> Selecione no mínimo 3 preços homologados para compor a estimativa do item. Casos excepcionais exigem justificativa formal anexa ao processo.
                      </div>
                    </div>
                  )}

                  {/* Cesta de Cotações */}
                  <DataTablePanel
                    title={`Cesta de Preços - Item ${selectedItem.itemNumber}`}
                    description="Selecione as referências mais compatíveis tecnicamente. Exclusões precisam de justificativa descritiva."
                    actions={(
                      <Button type="button" variant="outline" className="gap-2 h-9 text-xs" onClick={() => void exportPriceResearchWorkbook(reportData)}>
                        <Download className="h-3.5 w-3.5" />
                        Exportar XLSX
                      </Button>
                    )}
                  >
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Usar</TableHead>
                          <TableHead>Fonte / Aderência</TableHead>
                          <TableHead>Órgão e Fornecedor</TableHead>
                          <TableHead>Unidade</TableHead>
                          <TableHead className="text-right">Preço Original</TableHead>
                          <TableHead className="text-right">Preço Comparável</TableHead>
                          <TableHead className="min-w-[200px]">Exclusão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedItem.candidates.map((candidate) => {
                          const status = candidateStatus(candidate);
                          const isExcludedWithoutReason = !candidate.selected && !candidate.exclusionReason.trim();
                          return (
                            <TableRow key={candidate.id} className={candidate.selected ? 'bg-primary/[0.01]' : 'opacity-85'}>
                              <TableCell>
                                <Checkbox
                                  aria-label={`Usar preço ${candidate.purchaseItemId}`}
                                  checked={candidate.selected}
                                  onCheckedChange={(checked) => updateCandidate(selectedItem.localId, candidate.id, {
                                    selected: checked === true,
                                    exclusionReason: checked === true ? '' : candidate.exclusionReason,
                                  })}
                                />
                              </TableCell>
                              <TableCell className="min-w-[220px]">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
                                  <Badge variant="secondary" className="gap-0.5 text-[10px] font-mono">
                                    <Bot className="h-2.5 w-2.5" />
                                    {candidate.aiScore}
                                  </Badge>
                                </div>
                                <p className="mt-1.5 font-ui text-[10px] text-text-secondary leading-normal">{candidate.aiReason}</p>
                                <p className="mt-1 line-clamp-1 font-ui text-[10px] text-text-muted">{candidate.description}</p>
                                <div className="mt-1.5 flex gap-2">
                                  <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline">
                                    Fonte Oficial <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                  {candidate.pncpSearchUrl && (
                                    <a href={candidate.pncpSearchUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sebrae-blue hover:underline">
                                      PNCP <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[180px]">
                                <p className="font-mono text-[10px] font-bold text-text-primary">{candidate.agencyCode || '-'}</p>
                                <p className="font-ui text-[10px] text-text-secondary truncate max-w-[160px]" title={candidate.agencyName || ''}>{candidate.agencyName || '-'}</p>
                                <p className="mt-1.5 font-ui text-[10px] font-bold text-text-primary truncate max-w-[160px]" title={candidate.supplierName || ''}>{candidate.supplierName || '-'}</p>
                                <p className="font-mono text-[9px] text-text-muted leading-none mt-0.5">{candidate.supplierDocument || '-'}</p>
                                <p className="font-ui text-[9px] text-text-muted mt-1 leading-none">{formatDate(candidate.resultDate || candidate.purchaseDate)}</p>
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">{candidate.originalUnitLabel}</TableCell>
                              <TableCell className="text-right font-mono text-[11px]">{formatCurrency(candidate.originalUnitPrice)}</TableCell>
                              <TableCell className="text-right font-mono text-[11px] font-bold">{formatCurrency(candidate.comparableUnitPrice)}</TableCell>
                              <TableCell>
                                {candidate.selected ? (
                                  <span className="font-ui text-[10px] text-primary font-medium">Incluído</span>
                                ) : (
                                  <div className="relative flex items-center">
                                    <Input
                                      aria-label={`Justificativa para desconsiderar ${candidate.purchaseItemId}`}
                                      value={candidate.exclusionReason}
                                      onChange={(event) => updateCandidate(selectedItem.localId, candidate.id, { exclusionReason: event.target.value })}
                                      placeholder="Justifique a exclusão..."
                                      className={`h-8 text-xs pr-8 ${isExcludedWithoutReason ? 'border-amber-300 focus:border-amber-500 bg-amber-50/20' : ''}`}
                                    />
                                    {isExcludedWithoutReason && (
                                      <AlertTriangle className="absolute right-2.5 h-3.5 w-3.5 text-amber-500" title="Justificativa obrigatória" />
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </DataTablePanel>
                </>
              ) : (
                <div className="text-center py-16 border border-dashed border-border-default rounded-radius-lg bg-surface-card text-text-muted">
                  Selecione um item na lista de navegação lateral para revisar as cotações.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: VALIDAÇÃO & RELATÓRIO FINAL */}
      {activeStep === 5 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Resumo Consolidado */}
            <SectionPanel
              title="Resumo Consolidado"
              description="Acompanhamento geral da estimativa orçamentária calculada."
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Total de Itens', items.length.toString()],
                  ['Cotações Ativas', selectedQuotesCount.toString()],
                  ['Método Estatístico', METHOD_LABELS[method]],
                  ['Estimativa Geral', formatCurrency(estimatedTotal)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-radius-lg border border-border-default bg-surface-subtle/40 p-4">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted leading-none">{label}</p>
                    <p className="mt-2 font-ui text-lg font-bold text-text-primary leading-none truncate">{value}</p>
                  </div>
                ))}
              </div>
            </SectionPanel>

            {/* Checklist de Conformidade */}
            <SectionPanel
              title="Validação (Instrução Normativa ME nº 65/2021)"
              description="Análise preventiva de possíveis inconsistências jurídicas na cesta de preços."
            >
              <div className="space-y-3.5">
                {/* 1. Identificação Geral */}
                <div className="flex items-start gap-3">
                  {validationErrors.filter(e => e.type === 'meta').length === 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">!</span>
                  )}
                  <div>
                    <h5 className="font-ui text-xs font-bold text-text-primary">Metadados da Contratação</h5>
                    <p className="font-ui text-[11px] text-text-secondary mt-0.5">Título, processo, responsável e justificativa estatística preenchidos.</p>
                  </div>
                </div>

                {/* 2. Código do Catálogo */}
                <div className="flex items-start gap-3">
                  {validationErrors.filter(e => e.type === 'catalog').length === 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">!</span>
                  )}
                  <div>
                    <h5 className="font-ui text-xs font-bold text-text-primary">Mapeamento CATMAT/CATSER</h5>
                    <p className="font-ui text-[11px] text-text-secondary mt-0.5">Todos os itens da planilha possuem código de catálogo válido.</p>
                  </div>
                </div>

                {/* 3. Mapeamento de preços executado */}
                <div className="flex items-start gap-3">
                  {validationErrors.filter(e => e.type === 'search').length === 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">!</span>
                  )}
                  <div>
                    <h5 className="font-ui text-xs font-bold text-text-primary">Busca Executada</h5>
                    <p className="font-ui text-[11px] text-text-secondary mt-0.5">A consulta de preços oficiais foi executada na etapa de busca.</p>
                  </div>
                </div>

                {/* 4. Mínimo 3 Cotações */}
                <div className="flex items-start gap-3">
                  {validationErrors.filter(e => e.type === 'quotes').length === 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">!</span>
                  )}
                  <div>
                    <h5 className="font-ui text-xs font-bold text-text-primary">Número Mínimo de Amostras</h5>
                    <p className="font-ui text-[11px] text-text-secondary mt-0.5">Cada item possui ao menos 3 preços selecionados na cesta.</p>
                  </div>
                </div>

                {/* 5. Justificativa de Exclusão */}
                <div className="flex items-start gap-3">
                  {validationErrors.filter(e => e.type === 'justification').length === 0 ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">✓</span>
                  ) : (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">!</span>
                  )}
                  <div>
                    <h5 className="font-ui text-xs font-bold text-text-primary">Justificativa de Desconsideração</h5>
                    <p className="font-ui text-[11px] text-text-secondary mt-0.5">Preços desmarcados justificados adequadamente na planilha.</p>
                  </div>
                </div>
              </div>

              {validationErrors.length === 0 ? (
                <div className="mt-5 flex gap-2.5 rounded-radius-lg border border-primary/20 bg-primary/[0.03] p-4 text-primary">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <p className="font-ui text-xs leading-normal">
                    <span className="font-bold">Análise OK:</span> A pesquisa atende integralmente a estrutura burocrática recomendada pela IN SEGES/ME 65/2021. Pronto para exportação definitiva.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-2 max-h-[140px] overflow-y-auto border border-amber-200 bg-amber-50/30 rounded-radius-md p-3">
                  <p className="font-ui text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Pendências de Conformidade ({validationErrors.length})
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((err, idx) => (
                      <li key={idx} className="font-ui text-[10px] text-amber-900 leading-normal">
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionPanel>
          </div>

          <SectionPanel
            title="Observações Finais"
            description="Informações complementares sobre prazos de entrega, frete, garantias, marcas e condições da pesquisa."
          >
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Descreva prazos e locais de entrega, regras de frete, garantias técnicas exigidas, negociação por marcas ou outros fatores de mercado..."
            />
          </SectionPanel>
        </div>
      )}

      {/* WIZARD NAVIGATION FOOTER */}
      <div className="flex justify-between items-center border-t border-border-default pt-6 mt-6">
        <Button
          type="button"
          variant="outline"
          className="gap-2 font-semibold text-xs h-10"
          onClick={() => goToStep(activeStep - 1)}
          disabled={activeStep === 1}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          {activeStep < 5 ? (
            <Button
              type="button"
              className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs h-10"
              onClick={() => goToStep(activeStep + 1)}
              disabled={items.length === 0}
            >
              Avançar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold text-xs h-10"
              onClick={() => void printReport()}
              disabled={items.length === 0 || isSaving}
            >
              <Printer className="h-4 w-4" />
              Finalizar e Imprimir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
