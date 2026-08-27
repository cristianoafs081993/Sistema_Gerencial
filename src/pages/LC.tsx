import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Search, ChevronLeft, ChevronRight, Copy, Check, Download, AlertCircle, Save, FolderOpen, Trash2, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { TableSkeletonRows } from '@/components/design-system/TableSkeletonRows';
import { TablePagination } from '@/components/design-system/TablePagination';
import { HeaderActions } from '@/components/HeaderParts';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { LCRegistro, loadLatestLCRowsFromDb, parseLCCsv, saveLCRows } from '@/services/lcImportService';
import { extractBolsistasFromPdfFiles } from '@/services/bolsistasPdfService';
import { compararBolsistasComLC, type ComparacaoBolsista, type PendenciaStatus } from '@/services/lcComparisonService';
import {
  deleteSharedLcSavedList,
  loadSharedLcSavedLists,
  saveSharedLcSavedList,
} from '@/services/lcSavedListsService';
import {
  buildSiafiListaCredoresMacro,
  downloadSiafiMacroFile,
  padLeft,
  type SiafiMacroInputRow,
} from '@/services/siafiMacroService';
import { env } from '@/lib/env';
import { deleteLcSavedList, loadLcSavedLists, saveLcSavedList, type LcSavedList } from '@/lib/lcSavedLists';
import { normalizeLcAccount, padLeftLcAccount } from '@/utils/lcAccount';

const statusLabel: Record<PendenciaStatus, string> = {
  sem_cadastro_lc: 'Sem cadastro na LC',
  sem_conta_lc: 'Sem conta cadastrada na LC',
  conta_divergente: 'Conta divergente',
};

type LcAccountOption = {
  bancoCodigo: string;
  agenciaCodigo: string;
  contaBancaria: string;
};

type LcGridRow = {
  id: string;
  cpf: string;
  nome: string;
  bancoPdf: string;
  agenciaPdf: string;
  contaPdf: string;
  valor?: number;
  selectedBanco: string;
  selectedAgencia: string;
  selectedConta: string;
  contaPagadora: string;
  status: 'ok' | 'aluno_nao_encontrado' | 'conta_nao_encontrada';
  lcAccounts: LcAccountOption[];
  originalLcAccounts: LcAccountOption[];
};

const isUuid = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || !value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`Copiado: ${value}`, { duration: 1500 });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      disabled={disabled}
      type="button"
      className={`p-1 rounded transition-colors inline-flex items-center justify-center shrink-0 ${
        disabled
          ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed pointer-events-none'
          : 'text-slate-455 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
      title={disabled ? 'Selecione a linha para copiar' : 'Copiar'}
    >
      {copied ? (
        <Check className="h-3 w-3 text-ifrn-green" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

export default function LCPage() {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth();
  const [rows, setRows] = useState<LCRegistro[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isComparingPdf, setIsComparingPdf] = useState(false);
  const [queryLC, setQueryLC] = useState('');
  const [queryPendencias, setQueryPendencias] = useState('');
  const [pendencias, setPendencias] = useState<ComparacaoBolsista[]>([]);
  const [pdfFileNames, setPdfFileNames] = useState<string[]>([]);
  const [totalBolsistasProcessados, setTotalBolsistasProcessados] = useState(0);
  const [macroDialogOpen, setMacroDialogOpen] = useState(false);
  const [macroContent, setMacroContent] = useState('');
  const [macroFileName, setMacroFileName] = useState('');
  const [macroRowsCount, setMacroRowsCount] = useState(0);
  const [macroContext, setMacroContext] = useState<'sem_pendencias' | 'com_pendencias'>('sem_pendencias');
  const [dialogMacroRows, setDialogMacroRows] = useState<SiafiMacroInputRow[]>([]);
  const [gridRows, setGridRows] = useState<LcGridRow[]>([]);
  const [savedWorkLists, setSavedWorkLists] = useState<LcSavedList<LcGridRow>[]>(() => loadLcSavedLists<LcGridRow>());
  const [savedListsDialogOpen, setSavedListsDialogOpen] = useState(false);
  const [workListName, setWorkListName] = useState('Lista de trabalho');
  const [activeSavedListId, setActiveSavedListId] = useState<string | null>(null);
  const [isSavingWorkList, setIsSavingWorkList] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [dialogTab, setDialogTab] = useState<'macro' | 'grid'>('grid');
  const [isCopied, setIsCopied] = useState(false);
  const [pageLC, setPageLC] = useState(1);
  const [pagePendencias, setPagePendencias] = useState(1);
  const [pageSizeLC, setPageSizeLC] = useState(100);
  const [pageSizePendencias, setPageSizePendencias] = useState(100);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const queryLCDeferred = useDeferredValue(queryLC);
  const queryPendenciasDeferred = useDeferredValue(queryPendencias);

  const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');
  const normalizeSearchValue = (value: string) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const loadLatest = async () => {
    try {
      setIsLoadingInitial(true);
      const latest = await loadLatestLCRowsFromDb();
      setRows(latest.rows);
    } catch (error) {
      console.error('Erro ao carregar LC do banco:', error);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;

    let mounted = true;
    void loadSharedLcSavedLists<LcGridRow>()
      .then((sharedLists) => {
        if (mounted) setSavedWorkLists(sharedLists);
      })
      .catch((error) => {
        // Mantem as listas locais como fallback temporario para indisponibilidade
        // do backend, sem usar dados locais para preencher a lista compartilhada.
        console.warn('Nao foi possivel carregar listas compartilhadas da LC:', error);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthLoading, isAuthenticated]);

  const consolidatedRows = useMemo(() => {
    const byCpf = new Map<string, LCRegistro[]>();

    const pickPreferredRow = (current: LCRegistro, candidate: LCRegistro) => {
      const shouldReplace =
        (!current.contaBancaria && !!candidate.contaBancaria) ||
        (!current.favorecidoNome && !!candidate.favorecidoNome) ||
        (!current.bancoCodigo && !!candidate.bancoCodigo) ||
        (!current.agenciaCodigo && !!candidate.agenciaCodigo);

      return shouldReplace ? candidate : current;
    };

    for (const row of rows) {
      const key = onlyDigits(row.favorecidoDocumento) || row.favorecidoDocumento.trim();
      if (!key) continue;

      const group = byCpf.get(key) || [];
      group.push(row);
      byCpf.set(key, group);
    }

    return Array.from(byCpf.values()).flatMap((group) => {
      const byConta = new Map<string, LCRegistro>();

      for (const row of group) {
        const contaKey = normalizeLcAccount(row.contaBancaria) || `sem-conta:${row.obListaCredores}-${row.sequencial}`;
        const existing = byConta.get(contaKey);
        byConta.set(contaKey, existing ? pickPreferredRow(existing, row) : row);
      }

      const rowsByConta = Array.from(byConta.values());
      return rowsByConta.length > 1 ? rowsByConta : [rowsByConta[0]];
    });
  }, [rows]);

  const rowsForDisplay = consolidatedRows;

  const filteredRows = useMemo(() => {
    const q = normalizeSearchValue(queryLCDeferred);
    if (!q) return rowsForDisplay;
    return rowsForDisplay.filter((row) =>
      normalizeSearchValue(row.obListaCredores).includes(q) ||
      normalizeSearchValue(row.favorecidoDocumento).includes(q) ||
      normalizeSearchValue(row.favorecidoNome).includes(q) ||
      normalizeSearchValue(row.bancoCodigo).includes(q) ||
      normalizeSearchValue(row.bancoNome).includes(q) ||
      normalizeSearchValue(row.contaBancaria).includes(q),
    );
  }, [rowsForDisplay, queryLCDeferred]);

  const pendenciasFiltradas = useMemo(() => {
    const q = normalizeSearchValue(queryPendenciasDeferred);
    if (!q) return pendencias;
    return pendencias.filter((row) =>
      normalizeSearchValue(row.cpf).includes(q) ||
      normalizeSearchValue(row.nome).includes(q) ||
      normalizeSearchValue(row.nomeLc).includes(q) ||
      normalizeSearchValue(row.contaPdf).includes(q) ||
      normalizeSearchValue(row.contaLc).includes(q),
    );
  }, [pendencias, queryPendenciasDeferred]);

  useEffect(() => {
    setPageLC(1);
  }, [queryLCDeferred, rowsForDisplay.length, pageSizeLC]);

  useEffect(() => {
    setPagePendencias(1);
  }, [queryPendenciasDeferred, pendencias.length, pageSizePendencias]);

  const totalPagesLC = Math.max(1, Math.ceil(filteredRows.length / pageSizeLC));
  const totalPagesPendencias = Math.max(1, Math.ceil(pendenciasFiltradas.length / pageSizePendencias));
  const safePageLC = Math.min(pageLC, totalPagesLC);
  const safePagePendencias = Math.min(pagePendencias, totalPagesPendencias);

  const rowsPage = useMemo(() => {
    const start = (safePageLC - 1) * pageSizeLC;
    return filteredRows.slice(start, start + pageSizeLC);
  }, [filteredRows, safePageLC, pageSizeLC]);

  const pendenciasPage = useMemo(() => {
    const start = (safePagePendencias - 1) * pageSizePendencias;
    return pendenciasFiltradas.slice(start, start + pageSizePendencias);
  }, [pendenciasFiltradas, safePagePendencias, pageSizePendencias]);
  const shouldShowPendenciasSection = isComparingPdf || pendencias.length > 0;

  const buildMacroFileName = (sourcePdfNames: string[]) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const baseRaw = sourcePdfNames.length === 1
      ? sourcePdfNames[0].replace(/\.[^.]+$/, '')
      : 'lista-credores';
    const base = baseRaw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lista-credores';
    return `${base}-siafi-${stamp}.mac`;
  };

  const buildMacroRows = (workRows: LcGridRow[]): SiafiMacroInputRow[] =>
    workRows
      .filter((row) => row.status !== 'aluno_nao_encontrado')
      .map((row) => ({
        cpf: row.cpf,
        bancoCodigo: row.selectedBanco,
        agenciaCodigo: row.selectedAgencia,
        contaPagadora: row.contaPagadora,
        contaFavorecido: row.selectedConta,
        valor: row.valor,
      }));

  const getDefaultWorkListName = (sourcePdfNames: string[]) => {
    if (sourcePdfNames.length !== 1) return 'Lista de trabalho';
    return sourcePdfNames[0].replace(/\.[^.]+$/, '') || 'Lista de trabalho';
  };

  const handleSaveWorkList = async () => {
    if (!gridRows.length) {
      toast.error('Nao ha dados na grade para salvar.');
      return;
    }

    setIsSavingWorkList(true);
    try {
      const savedList = await saveSharedLcSavedList<LcGridRow>({
        id: isUuid(activeSavedListId) ? activeSavedListId : null,
        name: workListName,
        sourcePdfNames: pdfFileNames,
        rows: gridRows,
      });

      // Mantem um espelho local para que a lista continue recuperavel durante
      // uma indisponibilidade temporaria, mas o registro canonico e o do orgao.
      saveLcSavedList({
        id: savedList.id,
        name: savedList.name,
        sourcePdfNames: savedList.sourcePdfNames,
        rows: savedList.rows,
      });
      setSavedWorkLists((current) => [savedList, ...current.filter((list) => list.id !== savedList.id)]);
      setWorkListName(savedList.name);
      setActiveSavedListId(savedList.id);
      toast.success(`Lista "${savedList.name}" compartilhada com seu órgão.`);
    } catch (error) {
      console.error('Erro ao salvar lista compartilhada da LC:', error);
      try {
        const localList = saveLcSavedList({
          id: activeSavedListId,
          name: workListName,
          sourcePdfNames: pdfFileNames,
          rows: gridRows,
        });
        setSavedWorkLists(loadLcSavedLists<LcGridRow>());
        setWorkListName(localList.name);
        setActiveSavedListId(localList.id);
        toast.warning('Servidor indisponível; lista salva somente neste navegador.');
      } catch (fallbackError) {
        console.error('Erro ao salvar fallback local da lista de trabalho da LC:', fallbackError);
        toast.error('Nao foi possivel salvar a lista de trabalho.');
      }
    } finally {
      setIsSavingWorkList(false);
    }
  };

  const handleOpenSavedWorkList = (savedList: LcSavedList<LcGridRow>) => {
    const macroRows = buildMacroRows(savedList.rows);
    if (!macroRows.length) {
      toast.error('A lista salva nao possui linhas aptas para preenchimento.');
      return;
    }

    const hasPendencias = savedList.rows.some((row) => row.status !== 'ok');
    const macro = buildSiafiListaCredoresMacro(macroRows, {
      scriptName: hasPendencias ? 'Lista de Credores - Pendencias' : 'Lista de Credores',
      author: 'sistema-gerencial',
      includeFirstConfirmationEnter: true,
    });

    setGridRows(savedList.rows);
    setPdfFileNames(savedList.sourcePdfNames);
    setTotalBolsistasProcessados(savedList.rows.length);
    setMacroContent(macro);
    setMacroFileName(buildMacroFileName(savedList.sourcePdfNames));
    setMacroRowsCount(macroRows.length);
    setMacroContext(hasPendencias ? 'com_pendencias' : 'sem_pendencias');
    setDialogMacroRows(macroRows);
    setExpandedRowId(null);
    setChunkIndex(0);
    setDialogTab('grid');
    setIsCopied(false);
    setWorkListName(savedList.name);
    setActiveSavedListId(savedList.id);
    setSavedListsDialogOpen(false);
    setMacroDialogOpen(true);
  };

  const handleDeleteSavedWorkList = async (id: string) => {
    try {
      if (isUuid(id)) await deleteSharedLcSavedList(id);
      deleteLcSavedList(id);
      setSavedWorkLists((current) => current.filter((list) => list.id !== id));
      if (activeSavedListId === id) setActiveSavedListId(null);
      toast.success('Lista de trabalho excluída.');
    } catch (error) {
      console.error('Erro ao excluir lista compartilhada da LC:', error);
      toast.error('Nao foi possivel excluir a lista de trabalho.');
    }
  };

  const handleConfirmarGeracaoMacro = () => {
    if (!dialogMacroRows.length || !macroFileName) {
      toast.error('Nao foi possivel gerar a macro desta comparacao.');
      return;
    }

    // Regenerar a macro com base nos dados e seleções atuais da grade!
    const updatedMacroRows = dialogMacroRows.map((mRow) => {
      const match = gridRows.find((gRow) => gRow.cpf === mRow.cpf);
      if (match) {
        return {
          ...mRow,
          bancoCodigo: match.selectedBanco,
          agenciaCodigo: match.selectedAgencia,
          contaFavorecido: match.selectedConta,
        };
      }
      return mRow;
    });

    const finalMacroContent = buildSiafiListaCredoresMacro(updatedMacroRows, {
      scriptName: macroContext === 'sem_pendencias' ? 'Lista de Credores' : 'Lista de Credores - Pendencias',
      author: 'sistema-gerencial',
      includeFirstConfirmationEnter: true,
    });

    downloadSiafiMacroFile(finalMacroContent, macroFileName);
    toast.success(`Macro gerada com sucesso: ${macroFileName}`);
  };

  const handleCompararPdf = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setIsComparingPdf(true);
      const list = Array.from(files);
      const bolsistas = await extractBolsistasFromPdfFiles(list);
      setTotalBolsistasProcessados(bolsistas.length);
      if (!bolsistas.length) {
        toast.warning('Nenhum CPF de bolsista foi encontrado nos PDFs enviados.');
      }

      const resultado = compararBolsistasComLC(bolsistas, rows);
      setPendencias(resultado);
      const sourcePdfNames = list.map((f) => f.name);
      setPdfFileNames(sourcePdfNames);

      if (bolsistas.length > 0) {
        // 1. Gerar linhas para a Grade do Excel (Sempre todos os bolsistas na sequencia do PDF!)
        const fullGridRows = bolsistas.map((b) => {
          const doc = onlyDigits(b.cpf);
          const lcList = rows.filter((r) => onlyDigits(r.favorecidoDocumento) === doc);
          
          const lcAccounts = lcList.map((r) => ({
            bancoCodigo: onlyDigits(r.bancoCodigo) || '001',
            agenciaCodigo: onlyDigits(r.agenciaCodigo) || '0001',
            contaBancaria: normalizeLcAccount(r.contaBancaria) || '',
          })).filter(acc => acc.contaBancaria);

          const hasCpfInLc = lcList.length > 0;
          const pdfContaNormalized = normalizeLcAccount(b.conta);
          const matchedLcAcc = lcAccounts.find(acc => acc.contaBancaria === pdfContaNormalized);
          
          let status: 'ok' | 'aluno_nao_encontrado' | 'conta_nao_encontrada' = 'ok';
          let selectedBanco = b.banco || '001';
          let selectedAgencia = b.agencia || '0001';
          let selectedConta = pdfContaNormalized;

          if (!hasCpfInLc) {
            status = 'aluno_nao_encontrado';
          } else if (!matchedLcAcc) {
            status = 'conta_nao_encontrada';
            // Mantém a conta do PDF como selecionada por padrão,
            // mas a LC tem outras contas disponíveis.
          } else {
            // Encontrou correspondência exata de conta!
            selectedBanco = matchedLcAcc.bancoCodigo;
            selectedAgencia = matchedLcAcc.agenciaCodigo;
            selectedConta = matchedLcAcc.contaBancaria;
          }

          const contaPagadora = env.siafiContaPagadora || '';

          return {
            id: `${doc}-${b.sourceFile}`,
            cpf: doc,
            nome: b.nome,
            bancoPdf: onlyDigits(b.banco) || '001',
            agenciaPdf: onlyDigits(b.agencia) || '0001',
            contaPdf: pdfContaNormalized,
            valor: b.valor,
            selectedBanco: onlyDigits(selectedBanco) || '001',
            selectedAgencia: onlyDigits(selectedAgencia) || '0001',
            selectedConta: normalizeLcAccount(selectedConta),
            contaPagadora,
            status,
            lcAccounts,
            originalLcAccounts: lcAccounts,
          };
        });

        // 2. Gerar linhas da macro a partir de fullGridRows, filtrando 'aluno_nao_encontrado'
        const macroRows = buildMacroRows(fullGridRows);

        if (macroRows.length > 0) {
          const generatedFileName = buildMacroFileName(sourcePdfNames);
          const macro = buildSiafiListaCredoresMacro(macroRows, {
            scriptName: resultado.length === 0 ? 'Lista de Credores' : 'Lista de Credores - Pendencias',
            author: 'sistema-gerencial',
            includeFirstConfirmationEnter: true,
          });

          setMacroContent(macro);
          setMacroFileName(generatedFileName);
          setMacroRowsCount(macroRows.length);
          setMacroContext(resultado.length === 0 ? 'sem_pendencias' : 'com_pendencias');
          setDialogMacroRows(macroRows);
          setGridRows(fullGridRows);
          setExpandedRowId(null);
          setChunkIndex(0);
          setDialogTab('grid');
          setIsCopied(false);
          setWorkListName(getDefaultWorkListName(sourcePdfNames));
          setActiveSavedListId(null);
          setMacroDialogOpen(true);
        } else {
          setMacroContent('');
          setMacroFileName('');
          setMacroRowsCount(0);
          setMacroDialogOpen(false);
          toast.warning('Nao ha linhas aptas para gerar macro nesta comparacao.');
        }
      } else {
        setMacroContent('');
        setMacroFileName('');
        setMacroRowsCount(0);
        setMacroDialogOpen(false);
      }

      toast.success(`Comparacao concluida. ${bolsistas.length} bolsista(s) processado(s) e ${resultado.length} pendencia(s).`);
    } catch (error) {
      console.error('Erro ao comparar PDFs com LC:', error);
      toast.error(`Erro ao comparar PDFs: ${(error as Error).message}`);
    } finally {
      setIsComparingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => handleCompararPdf(e.target.files)}
      />

      <SectionPanel 
        title="Lista de Credores (LC)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setSavedListsDialogOpen(true)}
              size="sm"
              variant="outline"
              className="gap-space-2 h-space-9 shadow-shadow-sm"
            >
              <FolderOpen className="h-4 w-4" />
              Listas salvas{savedWorkLists.length ? ` (${savedWorkLists.length})` : ''}
            </Button>
            <Button
              onClick={() => pdfInputRef.current?.click()}
              size="sm"
              variant="outline"
              disabled={isComparingPdf}
              className="gap-space-2 h-space-9 shadow-shadow-sm"
            >
              <Upload className="h-4 w-4" />
              {isComparingPdf ? 'Comparando...' : 'Comparar PDFs de Pagamento'}
            </Button>
          </div>
        }
      >
        <div className="mb-3">
          <span className="text-xs text-muted-foreground">
            {rowsForDisplay.length} registro(s) unico(s)
          </span>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={queryLC}
            onChange={(e) => setQueryLC(e.target.value)}
            placeholder="Buscar por lista, documento, favorecido ou banco..."
            className="pl-9 h-10 input-system"
          />
        </div>
      </SectionPanel>

      {shouldShowPendenciasSection ? (
        <SectionPanel title="Pendencias de Bolsistas x LC" className="overflow-hidden">
          <div className="space-y-1 pb-3">
            <p className="text-xs text-muted-foreground">
              PDFs: <span className="font-semibold text-foreground">{pdfFileNames.length ? pdfFileNames.join(', ') : 'nenhum arquivo enviado'}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Processados: <span className="font-semibold text-foreground">{totalBolsistasProcessados}</span> | Pendencias: <span className="font-semibold text-foreground">{pendencias.length}</span>
            </p>
            <div className="relative max-w-md mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={queryPendencias}
                onChange={(e) => setQueryPendencias(e.target.value)}
                placeholder="Buscar pendencias por CPF ou nome..."
                className="pl-9 h-10 input-system"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">CPF</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Nome (PDF)</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Conta PDF</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Nome/Conta LC</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Arquivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isComparingPdf ? (
                  <TableSkeletonRows rows={6} columns={6} widths={['w-24', 'w-64', 'w-28', 'w-48', 'w-24', 'w-24']} />
                ) : (
                  pendenciasPage.map((row, idx) => (
                    <TableRow key={`${row.cpf}-${row.status}-${idx}`} className="border-b border-border-default/30 last:border-0">
                      <TableCell className="px-4 py-3 text-xs font-mono font-semibold">
                        <div className="flex items-center gap-1">
                          <span>{row.cpf}</span>
                          <CopyButton value={onlyDigits(row.cpf)} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">{row.nome || '-'}</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono">
                        <div className="flex items-center gap-1">
                          <span>{row.contaPdf || '-'}</span>
                          {row.contaPdf && row.contaPdf !== '-' && (
                            <CopyButton value={normalizeLcAccount(row.contaPdf)} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        <div>{row.nomeLc || '-'}</div>
                        <div className="font-mono text-muted-foreground">{row.contaLc || '-'}</div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs font-semibold text-status-warning">{statusLabel[row.status]}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">{row.arquivoPdf}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
                    <TablePagination
            page={safePagePendencias}
            totalPages={totalPagesPendencias}
            onPageChange={setPagePendencias}
            totalItems={pendenciasFiltradas.length}
            pageSize={pageSizePendencias}
            onPageSizeChange={(value) => {
              setPageSizePendencias(value);
              setPagePendencias(1);
            }}
          />
        </SectionPanel>
      ) : null}

      <DataTablePanel>
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">OB Lista Credores</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Seq</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Favorecido</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Banco</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Agencia</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Conta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingInitial || isUploading ? (
              <TableSkeletonRows rows={8} columns={6} widths={['w-56', 'w-10', 'w-64', 'w-40', 'w-24', 'w-32']} />
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rowsPage.map((row) => (
                <TableRow key={`${row.obListaCredores}-${row.sequencial}`} className="border-b border-border-default/30 last:border-0">
                  <TableCell className="px-4 py-3 font-mono text-xs font-semibold">{row.obListaCredores}</TableCell>
                  <TableCell className="px-4 py-3 text-xs">{row.sequencial}</TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-xs font-semibold">{row.favorecidoDocumento}</div>
                    <div className="text-xs text-muted-foreground">{row.favorecidoNome || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-xs font-semibold">{row.bancoCodigo || '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.bancoNome || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="text-xs font-semibold">{row.agenciaCodigo || '-'}</div>
                    <div className="text-xs text-muted-foreground">{row.agenciaNome || '-'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">{row.contaBancaria || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
                <TablePagination
          page={safePageLC}
          totalPages={totalPagesLC}
          onPageChange={setPageLC}
          totalItems={filteredRows.length}
          pageSize={pageSizeLC}
          onPageSizeChange={(value) => {
            setPageSizeLC(value);
            setPageLC(1);
          }}
        />
      </DataTablePanel>

      <Dialog open={macroDialogOpen} onOpenChange={setMacroDialogOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl">
          <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-indigo-500" />
              Preenchimento SIAFI & Lista de Credores
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Gerencie a inserção de credores no SIAFI via macro ou copiando os dados formatados para colar na planilha.
            </DialogDescription>
          </DialogHeader>

          {/* Custom Tabs Segmented Control */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md my-4">
            <button
              onClick={() => {
                setDialogTab('grid');
                setIsCopied(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                dialogTab === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              Copiar Dados (Excel / LC)
            </button>
            <button
              onClick={() => {
                setDialogTab('macro');
                setIsCopied(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                dialogTab === 'macro'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Download className="h-4 w-4" />
              Gerar Macro SIAFI (.mac)
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {dialogTab === 'grid' ? (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-md border border-slate-150 dark:border-slate-800/80 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Instruções de Cópia
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Selecione a primeira célula (CPF) da linha correspondente na aba <strong>LC</strong> da planilha no Excel e cole. Cada bloco contém no máximo 7 alunos. O 7º aluno de cada bloco está destacado em amarelo para demarcar os limites de tela do SIAFI.
                    </p>
                  </div>
                </div>

                {/* Pagination Info */}
                {(() => {
                  const totalStudents = gridRows.length;
                  const totalChunks = Math.ceil(totalStudents / 7);
                  const startIdx = chunkIndex * 7;
                  const endIdx = Math.min(startIdx + 7, totalStudents);
                  const currentChunk = gridRows.slice(startIdx, endIdx);

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Bloco {chunkIndex + 1} de {totalChunks}
                        </span>
                        <span>
                          Exibindo alunos {startIdx + 1}-{endIdx} de {totalStudents}
                        </span>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                        <Table>
                          <TableHeader className="bg-slate-50/80 dark:bg-slate-850">
                            <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-slate-850">
                              <TableHead className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350">CPF</TableHead>
                              <TableHead className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350">Banco</TableHead>
                              <TableHead className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350">Ag.</TableHead>
                              <TableHead className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350">Conta</TableHead>
                              <TableHead className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-350">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentChunk.map((row, idx) => {
                              const isSeventhRow = idx === 6 || (startIdx + idx + 1) % 7 === 0;
                              const isExpanded = expandedRowId === row.id;
                              
                              let rowClass = 'hover:bg-slate-50/50 dark:hover:bg-slate-850/30';
                              if (row.status === 'aluno_nao_encontrado') {
                                rowClass = 'bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20 border-l-4 border-l-red-500';
                              } else if (row.status === 'conta_nao_encontrada') {
                                rowClass = 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 border-l-4 border-l-amber-500';
                              } else if (isSeventhRow) {
                                rowClass = 'bg-yellow-50/70 hover:bg-yellow-150/80 dark:bg-yellow-950/20 dark:hover:bg-yellow-900/30 text-yellow-900 dark:text-yellow-100 font-semibold border-y border-yellow-250 dark:border-yellow-900/60';
                              }

                              return (
                                <React.Fragment key={row.id}>
                                  <TableRow
                                    onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                                    className={`border-b border-slate-100 dark:border-slate-850/50 last:border-0 transition-colors cursor-pointer ${rowClass}`}
                                  >
                                    <TableCell className="px-4 py-2.5 text-xs font-mono flex items-center gap-1.5">
                                      <span>{padLeft(row.cpf, 11)}</span>
                                      <CopyButton value={row.cpf} disabled={!isExpanded} />
                                      {row.status === 'aluno_nao_encontrado' && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300">
                                          Credor não localizado
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="px-4 py-2.5 text-xs font-mono">
                                      <div className="flex items-center gap-1">
                                        <span>{padLeft(row.selectedBanco, 3)}</span>
                                        {row.selectedBanco && (
                                          <CopyButton value={onlyDigits(row.selectedBanco)} disabled={!isExpanded} />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-2.5 text-xs font-mono">
                                      <div className="flex items-center gap-1">
                                        <span>{padLeft(row.selectedAgencia, 4)}</span>
                                        {row.selectedAgencia && (
                                          <CopyButton value={onlyDigits(row.selectedAgencia)} disabled={!isExpanded} />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-4 py-2.5 text-xs font-mono flex items-center gap-1.5">
                                      <span>{normalizeLcAccount(row.selectedConta) || <span className="text-red-500 italic">Vazia</span>}</span>
                                      {normalizeLcAccount(row.selectedConta) && (
                                        <CopyButton value={normalizeLcAccount(row.selectedConta)} disabled={!isExpanded} />
                                      )}
                                      {row.status === 'conta_nao_encontrada' && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                                          Conta Divergente
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="px-4 py-2.5 text-xs font-mono">
                                      {row.valor !== undefined ? Math.round(row.valor * 100) : 30000}
                                    </TableCell>
                                  </TableRow>

                                  {isExpanded && (
                                    <TableRow className="bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-900/60">
                                      <TableCell colSpan={5} className="px-6 py-4">
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                                            <p className="text-xs font-bold text-slate-850 dark:text-slate-100">
                                              Resolução de Conta: <span className="font-semibold text-slate-600 dark:text-slate-400">{row.nome}</span>
                                            </p>
                                            <span className="text-[10px] text-slate-450 italic">Clique na linha do aluno para recolher</span>
                                          </div>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                            {/* Conta do PDF */}
                                            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md space-y-2">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Conta no PDF</span>
                                                {row.selectedConta === row.contaPdf && (
                                                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded">Selecionada</span>
                                                )}
                                              </div>
                                              <div className="text-xs font-mono space-y-1 text-slate-600 dark:text-slate-300">
                                                <div>Banco: {row.bancoPdf}</div>
                                                <div>Agência: {row.agenciaPdf}</div>
                                                <div>Conta: {row.contaPdf}</div>
                                              </div>
                                              {row.selectedConta !== row.contaPdf && (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="text-[10px] h-7 px-2.5 w-full mt-2"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const updated = gridRows.map((g) => {
                                                      if (g.id === row.id) {
                                                        return {
                                                          ...g,
                                                          selectedBanco: row.bancoPdf,
                                                          selectedAgencia: row.agenciaPdf,
                                                          selectedConta: row.contaPdf,
                                                          status: row.lcAccounts.length > 0 ? 'conta_nao_encontrada' : 'aluno_nao_encontrado'
                                                        };
                                                      }
                                                      return g;
                                                    });
                                                    setGridRows(updated);
                                                    toast.success('Alterado para a conta do PDF (marcada para cadastro).');
                                                  }}
                                                >
                                                  Usar Conta do PDF
                                                </Button>
                                              )}
                                            </div>

                                            {/* Contas da LC */}
                                            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md space-y-2">
                                              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Contas Cadastradas na LC</span>
                                              {row.lcAccounts.length === 0 ? (
                                                <p className="text-[11px] text-red-500 dark:text-red-400 italic">Nenhuma conta cadastrada para este bolsista na LC.</p>
                                              ) : (
                                                <div className="space-y-2 max-h-[120px] overflow-y-auto">
                                                  {row.lcAccounts.map((acc, aIdx) => {
                                                    const isSelected = row.selectedConta === acc.contaBancaria;
                                                    return (
                                                      <div key={aIdx} className="flex items-center justify-between p-2 border border-slate-100 dark:border-slate-700/60 rounded bg-slate-50/50 dark:bg-slate-800/50">
                                                        <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                                                          B:{acc.bancoCodigo} A:{acc.agenciaCodigo} C:{acc.contaBancaria}
                                                        </div>
                                                        {isSelected ? (
                                                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">Selecionada</span>
                                                        ) : (
                                                          <Button
                                                            size="sm"
                                                            className="text-[10px] h-7 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              const updated = gridRows.map((g) => {
                                                                if (g.id === row.id) {
                                                                  return {
                                                                    ...g,
                                                                    selectedBanco: acc.bancoCodigo,
                                                                    selectedAgencia: acc.agenciaCodigo,
                                                                    selectedConta: acc.contaBancaria,
                                                                    status: 'ok'
                                                                  };
                                                                }
                                                                return g;
                                                              });
                                                              setGridRows(updated);
                                                              toast.success('Conta resolvida para o cadastro oficial da LC!');
                                                            }}
                                                          >
                                                            Selecionar
                                                          </Button>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Controls Area */}
                      <div className="flex items-center justify-between pt-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={chunkIndex === 0}
                            onClick={() => {
                              setChunkIndex((prev) => prev - 1);
                              setIsCopied(false);
                            }}
                            className="h-8 px-3 text-xs"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={chunkIndex === totalChunks - 1}
                            onClick={() => {
                              setChunkIndex((prev) => prev + 1);
                              setIsCopied(false);
                            }}
                            className="h-8 px-3 text-xs"
                          >
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            const formattedChunk = currentChunk.flatMap((row, idx) => {
                              // Formato SIAFI para colagem direta com buffers de separador:
                              //
                              // O SIAFI consome 1 caractere como separador visual entre cada
                              // campo. Sem buffer, esse caractere é o 1º dígito real do campo
                              // seguinte, causando deslocamento em cascata.
                              //
                              // Solução: adicionar 1 zero extra antes de cada campo (exceto
                              // CPF) para que o separador "engula" o zero, não o dígito real.
                                     // Campo  | Tamanho real | Buffer | Total enviado
                              // -------|--------------|--------|---------------
                               // CPF    |     11       |   0    |     11  → seguido de Tab (\t) para avançar
                              // Banco  |      3       |   1    |      4  → sep consome o 1º zero
                              // Agência|      4       |   1    |      5  → sep consome o 1º zero
                              // Conta  |     20       |   1    |     21  → sep consome o 1º zero
                              // Valor  |     17       |   8    |     25  → sep consome os primeiros 7 zeros do gap

                              const cpf     = padLeft(row.cpf, 11);           // 11 chars
                              const banco   = padLeft(row.selectedBanco, 4);   // 3 + 1 buffer
                              const agencia = padLeft(row.selectedAgencia, 5); // 4 + 1 buffer
                              const conta   = padLeftLcAccount(row.selectedConta, 21);  // 20 + 1 buffer

                              const valorCents = row.valor !== undefined
                                ? Math.round(row.valor * 100)
                                : 0;
                              const valor = String(valorCents).padStart(25, '0'); // 17 + 8 buffer

                              const line1 = `${cpf}\t\t\t${banco}${agencia}${conta}${valor}`;
                              let line2 = `${cpf}\t\t\t${banco}${agencia}${conta}${valor}`;
                              
                              // A 7ª linha do bloco recebe o comando de quebra de tela do SIAFI se não for o último registro geral
                              const globalIdx = startIdx + idx;
                              const isSeventhRowOfBlock = idx === 6;
                              const isLastRowOverall = globalIdx === totalStudents - 1;
                              
                              if (isSeventhRowOfBlock && !isLastRowOverall) {
                                const isFirstBlock = chunkIndex === 0;
                                line2 += isFirstBlock ? '\rs\r\r' : '\rs\r';
                              }
                              
                              return [line1, line2];
                            }).join('\r');

                            navigator.clipboard.writeText(formattedChunk)
                              .then(() => {
                                setIsCopied(true);
                                toast.success(`Bloco ${chunkIndex + 1} copiado com sucesso!`);
                                setTimeout(() => {
                                  setIsCopied(false);
                                }, 1500);
                              })
                              .catch((err) => {
                                toast.error('Erro ao copiar: ' + err.message);
                              });
                          }}
                          className={`h-8 px-4 text-xs font-semibold gap-1.5 transition-all ${
                            isCopied
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-4 w-4" />
                              Bloco Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copiar Bloco {chunkIndex + 1}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-md border border-slate-150 dark:border-slate-800/80 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Sobre a Macro SIAFI
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      A macro automatiza o preenchimento de todas as contas no SIAFI de forma rápida, rodando pelo emulador de terminal. Recomenda-se o download para processos maiores com muitos alunos para evitar digitação ou cópia manual repetitiva.
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-md space-y-3 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-450 block mb-0.5">Nome do Arquivo</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-100 font-mono break-all">{macroFileName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-450 block mb-0.5">Registros a Preencher</span>
                      <span className="font-semibold text-slate-850 dark:text-slate-100">{macroRowsCount} bolsista(s)</span>
                    </div>
                  </div>
                  <div className="pt-2 text-xs text-slate-600 dark:text-slate-400">
                    {macroContext === 'sem_pendencias'
                      ? 'Nenhuma inconsistência de dados foi encontrada. O arquivo .mac gerado preencherá a totalidade da Lista de Credores.'
                      : 'Foram detectadas inconsistências no cruzamento. O arquivo .mac gerado preencherá apenas os dados necessários para regularização.'}
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <Button
                    onClick={handleConfirmarGeracaoMacro}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Baixar arquivo .mac
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                aria-label="Nome da lista de trabalho"
                value={workListName}
                onChange={(event) => setWorkListName(event.target.value)}
                placeholder="Nome da lista"
                className="h-8 text-xs sm:max-w-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveWorkList}
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar lista
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMacroDialogOpen(false)}
                  className="h-8 px-4 text-xs"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savedListsDialogOpen} onOpenChange={setSavedListsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-indigo-500" />
              Listas de trabalho salvas
            </DialogTitle>
            <DialogDescription>
              As listas ficam salvas somente neste navegador e mantêm as contas selecionadas durante o trabalho.
            </DialogDescription>
          </DialogHeader>

          {savedWorkLists.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma lista de trabalho foi salva ainda.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {savedWorkLists.map((savedList) => (
                <div
                  key={savedList.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-default/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{savedList.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {savedList.rows.length} aluno(s) • salvo em {new Date(savedList.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenSavedWorkList(savedList)}
                      className="h-8 px-3 text-xs"
                    >
                      Abrir
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteSavedWorkList(savedList.id)}
                      aria-label={`Excluir lista ${savedList.name}`}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

