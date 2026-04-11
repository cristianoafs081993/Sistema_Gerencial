import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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
import { LCRegistro, loadLatestLCRowsFromDb, parseLCCsv, saveLCRows } from '@/services/lcImportService';
import { extractBolsistasFromPdfFiles } from '@/services/bolsistasPdfService';
import { compararBolsistasComLC, type ComparacaoBolsista, type PendenciaStatus } from '@/services/lcComparisonService';
import {
  buildSiafiListaCredoresMacro,
  buildSiafiMacroRowsFromComparison,
  buildSiafiMacroRowsFromPendencias,
  downloadSiafiMacroFile,
} from '@/services/siafiMacroService';

const statusLabel: Record<PendenciaStatus, string> = {
  sem_cadastro_lc: 'Sem cadastro na LC',
  sem_conta_lc: 'Sem conta cadastrada na LC',
  conta_divergente: 'Conta divergente',
};

export default function LCPage() {
  const { isSuperAdmin } = useAuth();
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
  const [pageLC, setPageLC] = useState(1);
  const [pagePendencias, setPagePendencias] = useState(1);
  const [pageSizeLC, setPageSizeLC] = useState(100);
  const [pageSizePendencias, setPageSizePendencias] = useState(100);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleUpload = async (file?: File) => {
    if (!file) return;

    try {
      setIsUploading(true);
      const parsed = await parseLCCsv(file);
      await saveLCRows(parsed, file.name);
      setRows(parsed);
      setPageLC(1);
    } catch (error) {
      console.error('Erro ao importar LC:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
        const contaKey = onlyDigits(row.contaBancaria) || `sem-conta:${row.obListaCredores}-${row.sequencial}`;
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

  const handleConfirmarGeracaoMacro = () => {
    if (!macroContent || !macroFileName) {
      toast.error('Nao foi possivel gerar a macro desta comparacao.');
      return;
    }

    downloadSiafiMacroFile(macroContent, macroFileName);
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
        const macroRows = resultado.length === 0
          ? buildSiafiMacroRowsFromComparison(bolsistas, rows)
          : buildSiafiMacroRowsFromPendencias(resultado, bolsistas);

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
      <HeaderActions>
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => handleCompararPdf(e.target.files)}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              variant="outline"
              disabled={isUploading}
              className="gap-space-2 h-space-9 shadow-shadow-sm"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Carregando...' : 'Upload CSV LC'}
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
        ) : null}
      </HeaderActions>

      <SectionPanel title="Lista de Credores (LC)">
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
                      <TableCell className="px-4 py-3 text-xs font-mono font-semibold">{row.cpf}</TableCell>
                      <TableCell className="px-4 py-3 text-xs">{row.nome || '-'}</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-mono">{row.contaPdf || '-'}</TableCell>
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

      <ConfirmDialog
        open={macroDialogOpen}
        onOpenChange={setMacroDialogOpen}
        onConfirm={handleConfirmarGeracaoMacro}
        title="Gerar macro SIAFI?"
        description={
          macroContext === 'sem_pendencias'
            ? `Nao ha pendencias nesta lista. Deseja gerar agora o arquivo .mac com ${macroRowsCount} linha(s) para preenchimento da Lista de Credores no SIAFI?`
            : `Foram encontradas pendencias. Deseja gerar o arquivo .mac com ${macroRowsCount} linha(s) baseado nas pendencias para regularizacao no SIAFI?`
        }
        confirmText="Gerar .mac"
        cancelText="Agora nao"
        variant="info"
      />
    </div>
  );
}

