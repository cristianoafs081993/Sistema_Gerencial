import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Search, Copy, Check, FolderOpen, Trash2, Table as TableIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
import { isValidCPF } from '@/services/supplierCompliance';
import { compararBolsistasComLC, type ComparacaoBolsista, type PendenciaStatus } from '@/services/lcComparisonService';
import {
  deleteSharedLcSavedList,
  loadSharedLcSavedLists,
  saveSharedLcSavedList,
} from '@/services/lcSavedListsService';
import { LcWorkListEditor } from '@/components/lc/LcWorkListEditor';
import { env } from '@/lib/env';
import { buildLcGridRows, cloneLcGridRowsForCopy, type LcGridRow } from '@/services/lcWorkListBuilder';
import { deleteLcSavedList, loadLcSavedLists, saveLcSavedList, type LcSavedList } from '@/lib/lcSavedLists';
import { normalizeLcAccount } from '@/utils/lcAccount';

const statusLabel: Record<PendenciaStatus, string> = {
  sem_cadastro_lc: 'Sem cadastro na LC',
  sem_conta_lc: 'Sem conta cadastrada na LC',
  conta_divergente: 'Conta divergente',
};

const OCR_TOAST_ID = 'lc-pdf-ocr';

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
  const [gridRows, setGridRows] = useState<LcGridRow[]>([]);
  const [savedWorkLists, setSavedWorkLists] = useState<LcSavedList<LcGridRow>[]>(() => loadLcSavedLists<LcGridRow>());
  const [savedListsDialogOpen, setSavedListsDialogOpen] = useState(false);
  const [workListName, setWorkListName] = useState('Lista de trabalho');
  const [activeSavedListId, setActiveSavedListId] = useState<string | null>(null);
  const [isSavingWorkList, setIsSavingWorkList] = useState(false);
  const [showManualAddPanel, setShowManualAddPanel] = useState(false);
  const [editorSessionKey, setEditorSessionKey] = useState(0);
  const [pageLC, setPageLC] = useState(1);
  const [pagePendencias, setPagePendencias] = useState(1);
  const [pageSizeLC, setPageSizeLC] = useState(100);
  const [pageSizePendencias, setPageSizePendencias] = useState(100);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [sharedListsLoaded, setSharedListsLoaded] = useState(false);
  const requestedListIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lista') : null,
  );
  const requestedManualRef = useRef<{ active: boolean; nome: string | null }>(
    typeof window !== 'undefined'
      ? {
          active: new URLSearchParams(window.location.search).get('manual') === '1',
          nome: new URLSearchParams(window.location.search).get('nome'),
        }
      : { active: false, nome: null },
  );
  const queryLCDeferred = useDeferredValue(queryLC);
  const queryPendenciasDeferred = useDeferredValue(queryPendencias);

  const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');
  const parseCurrencyInput = (value: string): number | undefined => {
    const trimmed = (value || '').trim();
    if (!trimmed) return undefined;
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
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
      })
      .finally(() => {
        if (mounted) setSharedListsLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthLoading, isAuthenticated]);

  // `/lc?lista=<id>`: link "Abrir no SIAGES" da extensao no SUAP abre direto a lista montada.
  useEffect(() => {
    const requestedId = requestedListIdRef.current;
    if (!requestedId) return;
    const requested = savedWorkLists.find((list) => list.id === requestedId);
    if (!requested && !sharedListsLoaded) return;

    requestedListIdRef.current = null;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('lista');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Sem acesso ao historico, o parametro apenas permanece na URL.
    }
    if (requested) handleOpenSavedWorkList(requested);
    else toast.error('A lista de trabalho indicada não foi encontrada (pode ter sido excluída).');
    // handleOpenSavedWorkList so usa setters de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedWorkLists, sharedListsLoaded]);

  // `/lc?manual=1&nome=...`: link "Montar manualmente" da extensao no SUAP abre direto a grade manual.
  useEffect(() => {
    if (!requestedManualRef.current.active) return;
    const customName = requestedManualRef.current.nome?.trim();
    requestedManualRef.current = { active: false, nome: null };
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('manual');
      url.searchParams.delete('nome');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Sem acesso ao historico, o parametro apenas permanece na URL.
    }
    handleOpenManualWorkList();
    if (customName) setWorkListName(customName.slice(0, 160));
    // handleOpenManualWorkList so usa setters de estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleOpenManualWorkList = () => {
    setGridRows([]);
    setPdfFileNames([]);
    setTotalBolsistasProcessados(0);
    setWorkListName('Lista manual');
    setActiveSavedListId(null);
    setShowManualAddPanel(true);
    setEditorSessionKey((k) => k + 1);
    setMacroDialogOpen(true);
  };

  const handleOpenSavedWorkList = (savedList: LcSavedList<LcGridRow>) => {
    if (!savedList.rows.length) {
      toast.error('A lista salva nao possui linhas.');
      return;
    }

    setGridRows(savedList.rows);
    setPdfFileNames(savedList.sourcePdfNames);
    setTotalBolsistasProcessados(savedList.rows.length);
    setWorkListName(savedList.name);
    setActiveSavedListId(savedList.id);
    setShowManualAddPanel(false);
    setEditorSessionKey((k) => k + 1);
    setSavedListsDialogOpen(false);
    setMacroDialogOpen(true);
  };

  const handleCopySavedWorkList = (savedList: LcSavedList<LcGridRow>) => {
    if (!savedList.rows.length) {
      toast.error('A lista selecionada nao possui linhas para copiar.');
      return;
    }

    const clonedRows = cloneLcGridRowsForCopy(savedList.rows);
    const copyName = `Cópia de ${savedList.name}`.slice(0, 160);

    setGridRows(clonedRows);
    setPdfFileNames([]);
    setTotalBolsistasProcessados(clonedRows.length);
    setWorkListName(copyName);
    setActiveSavedListId(null);
    setShowManualAddPanel(false);
    setEditorSessionKey((k) => k + 1);
    setSavedListsDialogOpen(false);
    setMacroDialogOpen(true);
    toast.success(`Lista "${savedList.name}" copiada. Edite e salve como uma nova lista.`);
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

  const handleCompararPdf = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      setIsComparingPdf(true);
      const list = Array.from(files);
      const bolsistas = await extractBolsistasFromPdfFiles(list, {
        onOcrProgress: ({ sourceFile, page, done, total }) => {
          toast.loading(`Lendo página escaneada ${done + 1} de ${total} (pág. ${page} de ${sourceFile}) por OCR…`, { id: OCR_TOAST_ID });
        },
        onWarning: ({ sourceFile, reason, imageOnlyPages = [], expected, found }) => {
          const message = reason === 'count_mismatch'
            ? `${sourceFile}: o documento declara ${expected} bolsa(s), mas só ${found} bolsista(s) foram identificados. Algum aluno ficou de fora — confira o PDF.`
            : `${sourceFile}: não foi possível ler por OCR a(s) página(s) ${imageOnlyPages.join(', ')} (imagem escaneada). Bolsistas nelas não foram identificados — confira o total ou gere o PDF novamente a partir do SUAP.`;
          toast.warning(message, { duration: 15000 });
        },
      });
      toast.dismiss(OCR_TOAST_ID);
      setTotalBolsistasProcessados(bolsistas.length);

      const bolsistasOcr = bolsistas.filter((b) => b.ocr);
      if (bolsistasOcr.length > 0) {
        const cpfsInvalidos = bolsistasOcr.filter((b) => !isValidCPF(b.cpf));
        toast.warning(
          `${bolsistasOcr.length} bolsista(s) foram lidos de página escaneada (OCR): confira CPF, agência e conta na grade antes de gerar a macro.${
            cpfsInvalidos.length
              ? ` ATENÇÃO: CPF com dígito verificador inválido (provável erro de leitura): ${cpfsInvalidos.map((b) => b.nome || b.cpf).join(', ')}.`
              : ''
          }`,
          { duration: 20000 },
        );
      }
      if (!bolsistas.length) {
        toast.warning('Nenhum CPF de bolsista foi encontrado nos PDFs enviados.');
      }

      const resultado = compararBolsistasComLC(bolsistas, rows);
      setPendencias(resultado);
      const sourcePdfNames = list.map((f) => f.name);
      setPdfFileNames(sourcePdfNames);

      if (bolsistas.length > 0) {
        const fullGridRows = buildLcGridRows(bolsistas, rows, env.siafiContaPagadora || '');
        setGridRows(fullGridRows);
        setShowManualAddPanel(false);
        setEditorSessionKey((k) => k + 1);
        setWorkListName(getDefaultWorkListName(sourcePdfNames));
        setActiveSavedListId(null);
        setMacroDialogOpen(true);
      } else {
        setMacroDialogOpen(false);
      }

      toast.success(`Comparacao concluida. ${bolsistas.length} bolsista(s) processado(s) e ${resultado.length} pendencia(s).`);
    } catch (error) {
      console.error('Erro ao comparar PDFs com LC:', error);
      toast.error(`Erro ao comparar PDFs: ${(error as Error).message}`);
    } finally {
      toast.dismiss(OCR_TOAST_ID);
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleOpenManualWorkList}
              size="sm"
              variant="outline"
              className="gap-space-2 h-space-9 shadow-shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Montar lista manualmente
            </Button>
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
          <LcWorkListEditor
            key={editorSessionKey}
            lcRows={rows}
            gridRows={gridRows}
            onGridRowsChange={setGridRows}
            workListName={workListName}
            onWorkListNameChange={setWorkListName}
            savedWorkLists={savedWorkLists}
            isSavingWorkList={isSavingWorkList}
            onSave={handleSaveWorkList}
            onClose={() => setMacroDialogOpen(false)}
            initialShowManualAdd={showManualAddPanel}
            contaPagadora={env.siafiContaPagadora || ''}
            renderHeader={(copyControl) => (
              <DialogHeader className="pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
                  <div>
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                      <TableIcon className="h-5 w-5 text-indigo-500" />
                      Preenchimento SIAFI & Lista de Credores
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                      Monte, edite e copie os blocos da Lista de Credores para preenchimento no SIAFI.
                    </DialogDescription>
                  </div>
                  {copyControl}
                </div>
              </DialogHeader>
            )}
          />
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
              As listas são compartilhadas com os usuários do mesmo órgão e mantêm as contas selecionadas durante o trabalho.
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
                    {savedList.origin === 'extensao' && (
                      <p className="text-xs text-muted-foreground">
                        Montada pela extensão · processo {savedList.processNumber || savedList.suapId}
                        {savedList.extraction?.method === 'ia' ? ' · via IA, conferir' : ''}
                      </p>
                    )}
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
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopySavedWorkList(savedList)}
                      aria-label={`Copiar lista ${savedList.name}`}
                      className="h-8 gap-1 px-2.5 text-xs"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
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

