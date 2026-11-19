import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Check, Plus, Save, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LcSavedList } from '@/lib/lcSavedLists';
import type { LCRegistro } from '@/services/lcImportService';
import {
  buildManualLcGridRow,
  cloneLcGridRowsForCopy,
  type LcGridRow,
} from '@/services/lcWorkListBuilder';
import { padLeft } from '@/services/siafiMacroService';
import { normalizeLcAccount, padLeftLcAccount } from '@/utils/lcAccount';

const onlyDigits = (value: string) => (value || '').replace(/\D/g, '');

const normalizeSearchValue = (value: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseCurrencyInput = (value: string): number | undefined => {
  const trimmed = (value || '').trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

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

export type LcWorkListEditorProps = {
  lcRows: LCRegistro[];
  gridRows: LcGridRow[];
  onGridRowsChange: React.Dispatch<React.SetStateAction<LcGridRow[]>>;
  workListName: string;
  onWorkListNameChange: (name: string) => void;
  savedWorkLists: LcSavedList<LcGridRow>[];
  isSavingWorkList: boolean;
  onSave: () => void;
  onClose: () => void;
  initialShowManualAdd?: boolean;
  contaPagadora?: string;
  renderHeader?: (copyControl: React.ReactNode) => React.ReactNode;
};

export function LcWorkListEditor({
  lcRows,
  gridRows,
  onGridRowsChange,
  workListName,
  onWorkListNameChange,
  savedWorkLists,
  isSavingWorkList,
  onSave,
  onClose,
  contaPagadora = '',
  renderHeader,
}: LcWorkListEditorProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualCpf, setManualCpf] = useState('');
  const [manualNome, setManualNome] = useState('');
  const [manualBanco, setManualBanco] = useState('');
  const [manualAgencia, setManualAgencia] = useState('');
  const [manualConta, setManualConta] = useState('');
  const [manualValor, setManualValor] = useState('300,00');
  const [copySourceListId, setCopySourceListId] = useState('');

  const manualSearchResults = useMemo(() => {
    const q = normalizeSearchValue(manualSearchQuery);
    if (!q) return [];
    const digitsQ = onlyDigits(manualSearchQuery);
    return lcRows
      .filter((row) =>
        normalizeSearchValue(row.favorecidoNome).includes(q) ||
        (digitsQ && onlyDigits(row.favorecidoDocumento).includes(digitsQ)),
      )
      .slice(0, 6);
  }, [lcRows, manualSearchQuery]);

  const handleImportFromSavedList = (sourceId: string) => {
    const source = savedWorkLists.find((item) => item.id === sourceId);
    if (!source || !source.rows.length) {
      toast.error('Selecione uma lista salva válida com alunos.');
      return;
    }

    const clonedRows = cloneLcGridRowsForCopy(source.rows);
    if (gridRows.length === 0) {
      onGridRowsChange(clonedRows);
      if (workListName === 'Lista manual' || !workListName.trim()) {
        onWorkListNameChange(`Cópia de ${source.name}`.slice(0, 160));
      }
      setChunkIndex(0);
      setExpandedRowId(null);
      setCopySourceListId('');
      toast.success(`${clonedRows.length} aluno(s) copiado(s) de "${source.name}".`);
      return;
    }

    const existingCpfs = new Set(gridRows.map((row) => onlyDigits(row.cpf)));
    const newRows = clonedRows.filter((row) => !existingCpfs.has(onlyDigits(row.cpf)));
    if (!newRows.length) {
      toast.warning(`Todos os alunos de "${source.name}" já estão na lista atual.`);
      return;
    }

    onGridRowsChange((current) => [...current, ...newRows]);
    setCopySourceListId('');
    toast.success(`${newRows.length} aluno(s) adicionado(s) de "${source.name}".`);
  };

  const handleAddManualRow = (custom?: {
    cpf: string;
    nome?: string;
    banco?: string;
    agencia?: string;
    conta?: string;
    valor?: number;
  }) => {
    const cpfDigits = onlyDigits(custom ? custom.cpf : manualCpf);
    if (cpfDigits.length !== 11) {
      toast.error('Informe um CPF válido com 11 dígitos.');
      return;
    }

    const valor = custom ? custom.valor : parseCurrencyInput(manualValor);
    const newRow = buildManualLcGridRow(
      {
        cpf: cpfDigits,
        nome: custom ? custom.nome : manualNome,
        banco: custom ? custom.banco : manualBanco,
        agencia: custom ? custom.agencia : manualAgencia,
        conta: custom ? custom.conta : manualConta,
        valor,
      },
      lcRows,
      contaPagadora,
    );

    onGridRowsChange((current) => {
      const next = [...current, newRow];
      const lastChunk = Math.max(0, Math.ceil(next.length / 7) - 1);
      setChunkIndex(lastChunk);
      return next;
    });
    setIsCopied(false);

    if (!custom) {
      setManualCpf('');
      setManualNome('');
      setManualBanco('');
      setManualAgencia('');
      setManualConta('');
    }
    toast.success(`${newRow.nome || cpfDigits} adicionado à lista.`);
  };

  const handleRemoveGridRow = (rowId: string) => {
    onGridRowsChange((current) => {
      const next = current.filter((row) => row.id !== rowId);
      const maxChunk = Math.max(0, Math.ceil(next.length / 7) - 1);
      setChunkIndex((prev) => Math.min(prev, maxChunk));
      return next;
    });
    if (expandedRowId === rowId) setExpandedRowId(null);
    setIsCopied(false);
  };

  const handleUpdateRowValor = (rowId: string, valueText: string) => {
    const parsed = parseCurrencyInput(valueText);
    onGridRowsChange((current) =>
      current.map((row) => (row.id === rowId ? { ...row, valor: parsed } : row)),
    );
    setIsCopied(false);
  };

  const totalStudents = gridRows.length;
  const totalChunks = Math.ceil(totalStudents / 7);
  const safeChunkIndex = Math.min(chunkIndex, Math.max(0, totalChunks - 1));
  const startIdx = safeChunkIndex * 7;
  const endIdx = Math.min(startIdx + 7, totalStudents);
  const currentChunk = gridRows.slice(startIdx, endIdx);

  const copyControl = savedWorkLists.length > 0 ? (
    <div className="flex items-center gap-1.5">
      <select
        aria-label="Copiar de lista anterior"
        value={copySourceListId}
        onChange={(e) => setCopySourceListId(e.target.value)}
        className="h-8 max-w-[220px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-200"
      >
        <option value="">Copiar de lista anterior...</option>
        {savedWorkLists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name} ({list.rows.length})
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!copySourceListId}
        onClick={() => handleImportFromSavedList(copySourceListId)}
        className="h-8 gap-1 px-2.5 text-xs"
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {renderHeader ? renderHeader(copyControl) : null}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {!renderHeader && copyControl ? (
          <div className="flex items-center justify-end">{copyControl}</div>
        ) : null}

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                Buscar credor já cadastrado na LC
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  aria-label="Buscar credor na LC para adicionar"
                  value={manualSearchQuery}
                  onChange={(e) => setManualSearchQuery(e.target.value)}
                  placeholder="Digite CPF ou nome do aluno na LC..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {manualSearchResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {manualSearchResults.map((item) => (
                    <div
                      key={`${item.obListaCredores}-${item.sequencial}-${item.contaBancaria}`}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {item.favorecidoNome || item.favorecidoDocumento}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.favorecidoDocumento} · B:{item.bancoCodigo || '-'} A:{item.agenciaCodigo || '-'} C:{item.contaBancaria || '-'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px] shrink-0"
                        onClick={() =>
                          handleAddManualRow({
                            cpf: item.favorecidoDocumento,
                            nome: item.favorecidoNome,
                            banco: item.bancoCodigo,
                            agencia: item.agenciaCodigo,
                            conta: item.contaBancaria,
                            valor: parseCurrencyInput(manualValor),
                          })
                        }
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-2">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                Ou informar dados manualmente
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Input
                  aria-label="CPF do aluno"
                  value={manualCpf}
                  onChange={(e) => setManualCpf(e.target.value)}
                  placeholder="CPF *"
                  className="h-8 text-xs font-mono"
                />
                <Input
                  aria-label="Nome do aluno"
                  value={manualNome}
                  onChange={(e) => setManualNome(e.target.value)}
                  placeholder="Nome"
                  className="h-8 text-xs sm:col-span-2"
                />
                <Input
                  aria-label="Banco do aluno"
                  value={manualBanco}
                  onChange={(e) => setManualBanco(e.target.value)}
                  placeholder="Banco (ex: 001)"
                  className="h-8 text-xs font-mono"
                />
                <Input
                  aria-label="Agência do aluno"
                  value={manualAgencia}
                  onChange={(e) => setManualAgencia(e.target.value)}
                  placeholder="Agência"
                  className="h-8 text-xs font-mono"
                />
                <Input
                  aria-label="Conta do aluno"
                  value={manualConta}
                  onChange={(e) => setManualConta(e.target.value)}
                  placeholder="Conta"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Valor (R$):
                  </label>
                  <Input
                    aria-label="Valor da bolsa em reais"
                    value={manualValor}
                    onChange={(e) => setManualValor(e.target.value)}
                    placeholder="300,00"
                    className="h-8 w-28 text-xs font-mono"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleAddManualRow()}
                  className="h-8 gap-1.5 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar à lista
                </Button>
              </div>
            </div>
          </div>

        {gridRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhum aluno na lista ainda. Busque na LC, informe os dados acima ou copie de uma lista anterior.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Bloco {safeChunkIndex + 1} de {totalChunks}
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
                            {row.ocr && (
                              <span
                                title="Dados lidos de página escaneada por OCR. Confira CPF, agência e conta no PDF."
                                className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300"
                              >
                                OCR · conferir
                              </span>
                            )}
                            {row.ia && (
                              <span
                                title="Dados extraídos por IA porque o script não leu o documento. Confira CPF, agência e conta no processo."
                                className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300"
                              >
                                IA · conferir
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
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[11px] text-slate-500 dark:text-slate-400">Valor (R$):</label>
                                      <Input
                                        aria-label={`Valor de ${row.nome || row.cpf}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.valor ?? ''}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleUpdateRowValor(row.id, e.target.value)}
                                        className="h-7 w-24 text-xs font-mono"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveGridRow(row.id);
                                      }}
                                      className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Remover
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
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
                                          onGridRowsChange((current) =>
                                            current.map((g) => {
                                              if (g.id === row.id) {
                                                return {
                                                  ...g,
                                                  selectedBanco: row.bancoPdf,
                                                  selectedAgencia: row.agenciaPdf,
                                                  selectedConta: row.contaPdf,
                                                  status: (row.lcAccounts.length > 0 ? 'conta_nao_encontrada' : 'aluno_nao_encontrado') as LcGridRow['status'],
                                                };
                                              }
                                              return g;
                                            }),
                                          );
                                          toast.success('Alterado para a conta do PDF (marcada para cadastro).');
                                        }}
                                      >
                                        Usar Conta do PDF
                                      </Button>
                                    )}
                                  </div>

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
                                                    onGridRowsChange((current) =>
                                                      current.map((g) => {
                                                        if (g.id === row.id) {
                                                          return {
                                                            ...g,
                                                            selectedBanco: acc.bancoCodigo,
                                                            selectedAgencia: acc.agenciaCodigo,
                                                            selectedConta: acc.contaBancaria,
                                                            status: 'ok' as const,
                                                          };
                                                        }
                                                        return g;
                                                      }),
                                                    );
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

            <div className="flex items-center justify-between pt-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeChunkIndex === 0}
                  onClick={() => {
                    setChunkIndex((prev) => Math.max(0, prev - 1));
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
                  disabled={safeChunkIndex >= totalChunks - 1}
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
                    const cpf = padLeft(row.cpf, 11);
                    const banco = padLeft(row.selectedBanco, 4);
                    const agencia = padLeft(row.selectedAgencia, 5);
                    const conta = padLeftLcAccount(row.selectedConta, 21);

                    const valorCents = row.valor !== undefined
                      ? Math.round(row.valor * 100)
                      : 0;
                    const valor = String(valorCents).padStart(25, '0');

                    const line1 = `${cpf}\t\t\t${banco}${agencia}${conta}${valor}`;
                    let line2 = `${cpf}\t\t\t${banco}${agencia}${conta}${valor}`;

                    const globalIdx = startIdx + idx;
                    const isSeventhRowOfBlock = idx === 6;
                    const isLastRowOverall = globalIdx === totalStudents - 1;

                    if (isSeventhRowOfBlock && !isLastRowOverall) {
                      const isFirstBlock = safeChunkIndex === 0;
                      line2 += isFirstBlock ? '\rs\r\r' : '\rs\r';
                    }

                    return [line1, line2];
                  }).join('\r');

                  navigator.clipboard.writeText(formattedChunk)
                    .then(() => {
                      setIsCopied(true);
                      toast.success(`Bloco ${safeChunkIndex + 1} copiado com sucesso!`);
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
                    Copiar Bloco {safeChunkIndex + 1}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input
            aria-label="Nome da lista de trabalho"
            value={workListName}
            onChange={(event) => onWorkListNameChange(event.target.value)}
            placeholder="Nome da lista"
            className="h-8 text-xs sm:max-w-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={isSavingWorkList}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {isSavingWorkList ? 'Salvando...' : 'Salvar lista'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 px-4 text-xs"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
