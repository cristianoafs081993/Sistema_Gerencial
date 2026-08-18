import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  Banknote,
  Building2,
  Calendar,
  Coins,
  FileSpreadsheet,
  FileStack,
  FileText,
  FolderSync,
  History,
  Info,
  Loader2,
  Receipt,
  RefreshCw,
  ShieldAlert,
  Upload,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderSubtitle } from '@/components/HeaderParts';
import { JsonImportDialog } from '@/components/JsonImportDialog';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { PFImportDialog } from '@/components/modals/PFImportDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useData } from '@/contexts/DataContext';
import { dataQueryKeys } from '@/contexts/dataQueryKeys';
import { parseSiafiCsv, syncSiafiDataToDb } from '@/lib/siafi-parser';
import { creditosDisponiveisDetalhesService, parseCreditoDisponivelFile } from '@/services/creditosDisponiveisDetalhes';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { descentralizacoesContaSaldosService } from '@/services/descentralizacoesContaSaldos';
import { parseEnergiaCampusWorkbook, saveEnergiaCampusImport } from '@/services/energiaCampusService';
import { parseFinanceiroCsv, saveFinanceiroRows } from '@/services/financeiroImportService';
import { parseLCCsv, saveLCRows } from '@/services/lcImportService';
import { parseRapHistoricoAnualFile, rapHistoricoAnualService } from '@/services/rapHistoricoAnual';
import { parseRetencoesEfdReinfCsv, saveRetencoesEfdReinfRows } from '@/services/retencoesEfdReinfImportService';
import { retencoesService } from '@/services/retencoes';
import { transparenciaService } from '@/services/transparencia';
import type { Descentralizacao } from '@/types';
import { normalizeContaDescentralizacaoImportRows } from '@/utils/descentralizacoesContaSaldos';
import {
  createDescentralizacaoImportIdentity,
  isAnulacaoDescentralizacao,
  normalizeDescentralizacaoImportValue,
  summarizeNotaCredito,
} from '@/utils/descentralizacoesImport';

const PI_DIMENSAO_MAP: Record<string, string> = {
  AD: 'AD - Administração',
  AE: 'AE - Atividades Estudantis',
  CI: 'CI - Comunicação Institucional',
  EN: 'EN - Ensino',
  EX: 'EX - Extensão',
  GE: 'GE - Gestão Estratégica e Desenvolvimento Institucional',
  GO: 'GO - Governança',
  GP: 'GP - Gestão de Pessoas',
  IE: 'IE - Infraestrutura',
  IN: 'IN - Internacionalização',
  IT: 'IT - Inovação Tecnológica',
  PE: 'PE - Pesquisa',
  TI: 'TI - Tecnologia da Informação',
};

const deriveDimensaoFromPI = (pi?: string): string => {
  if (!pi) return 'AD - Administração';
  const cleanPI = pi.trim().toUpperCase();
  const match = cleanPI.match(/([A-Z]{2})[A-Z0-9]?$/);
  if (match && PI_DIMENSAO_MAP[match[1]]) {
    return PI_DIMENSAO_MAP[match[1]];
  }
  for (const [sufixo, dimensao] of Object.entries(PI_DIMENSAO_MAP)) {
    if (cleanPI.includes(sufixo)) return dimensao;
  }
  return 'AD - Administração';
};

const parseValorBR = (valStr: string): number => {
  if (!valStr) return 0;
  let clean = String(valStr).trim().replace(/[R$\s]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const parseDateBR = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const clean = dateStr.trim();
  const ddmmyyyy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const iso = new Date(clean);
  return isNaN(iso.getTime()) ? undefined : iso;
};

export default function ImportacaoDados() {
  const queryClient = useQueryClient();
  const {
    descentralizacoes,
    addDescentralizacao,
    updateDescentralizacao,
    addAtividade,
    refreshData,
  } = useData();

  // Estados de Dialogs
  const [isDescPrincipalOpen, setIsDescPrincipalOpen] = useState(false);
  const [isDescDevolucoesOpen, setIsDescDevolucoesOpen] = useState(false);
  const [isDescContaOpen, setIsDescContaOpen] = useState(false);
  const [isAtividadesOpen, setIsAtividadesOpen] = useState(false);
  const [isPFOpen, setIsPFOpen] = useState(false);
  const [isContratosSyncOpen, setIsContratosSyncOpen] = useState(false);
  const [isDocHabeisOpen, setIsDocHabeisOpen] = useState(false);
  const [isLiquidacoesOpen, setIsLiquidacoesOpen] = useState(false);
  const [isOrdensBancariasOpen, setIsOrdensBancariasOpen] = useState(false);
  const [isSituacoesOpen, setIsSituacoesOpen] = useState(false);

  // File Inputs Refs
  const creditoInputRef = useRef<HTMLInputElement>(null);
  const empenhosInputRef = useRef<HTMLInputElement>(null);
  const rapSaldoInputRef = useRef<HTMLInputElement>(null);
  const rapHistoricoInputRef = useRef<HTMLInputElement>(null);
  const financeiroInputRef = useRef<HTMLInputElement>(null);
  const lcInputRef = useRef<HTMLInputElement>(null);
  const reinfInputRef = useRef<HTMLInputElement>(null);
  const energiaInputRef = useRef<HTMLInputElement>(null);

  // Loading States
  const [loadingPipeline, setLoadingPipeline] = useState<string | null>(null);

  // ----------------------------------------------------
  // Handlers de Importação: Descentralizações
  // ----------------------------------------------------
  const handleDescPrincipalImport = async (data: Record<string, string>[]) => {
    let importCount = 0;
    let updateCount = 0;
    let skipCount = 0;

    const findValue = (row: Record<string, string>, patterns: RegExp[], fallbacks: string[] = []) => {
      for (const key of fallbacks) {
        if (row[key] != null && String(row[key]).trim() !== '') return row[key];
      }
      const keys = Object.keys(row);
      for (const k of keys) {
        if (patterns.some((p) => p.test(k))) {
          const v = row[k];
          if (v != null && String(v).trim() !== '') return v;
        }
      }
      return '';
    };

    const existingImportKeys = new Set(
      descentralizacoes.map((d) => {
        const dateStr = d.dataEmissao ? d.dataEmissao.toISOString().split('T')[0] : '';
        const baseKey = `${dateStr}|${(d.planoInterno || '').trim().toUpperCase()}|${(d.origemRecurso || '').trim()}|${(d.naturezaDespesa || '').trim()}|${d.valor}`;
        return d.notaCredito ? `${baseKey}|${d.notaCredito.trim()}` : baseKey;
      }),
    );

    const legacyRowsByBaseKey = new Map<string, (typeof descentralizacoes)[number]>();
    for (const d of descentralizacoes) {
      if (d.notaCredito) continue;
      const dateStr = d.dataEmissao ? d.dataEmissao.toISOString().split('T')[0] : '';
      const baseKey = `${dateStr}|${(d.planoInterno || '').trim().toUpperCase()}|${(d.origemRecurso || '').trim()}|${(d.naturezaDespesa || '').trim()}|${d.valor}`;
      if (!legacyRowsByBaseKey.has(baseKey)) {
        legacyRowsByBaseKey.set(baseKey, d);
      }
    }

    const importedRowKeys = new Set<string>();

    const buildPairKey = (info: {
      notaCredito: string;
      dateKey: string;
      descricao: string;
      planoInterno: string;
      origemRecurso: string;
      valorBruto: number;
    }) =>
      [
        info.notaCredito,
        info.dateKey,
        info.descricao.trim().toUpperCase(),
        info.planoInterno,
        info.origemRecurso,
        Math.abs(info.valorBruto),
      ].join('|');

    const importRows = data.map((row) => {
      const notaCredito = summarizeNotaCredito(
        findValue(row, [/^nc$/i, /notacredito/i, /notadecredito/i], ['nc', 'notacredito', 'notadecredito']),
      );
      const operacaoTipo = findValue(
        row,
        [/operacaotip/i, /opera.*tip/i, /tipooperacao/i, /operacao/i],
        ['ncoperacaotipo', 'ncoperaotip', 'operacaotipo', 'operaotip', 'tipooperacao'],
      );
      const celulaTipo = findValue(row, [/celulatipo/i], ['nccelulatipo', 'celulatipo']);
      const planoInterno = findValue(row, [/planointern/i, /plano/i], ['nccelulaplanointerno', 'planointerno', 'plano_interno', 'plano']);
      const origemRecurso = findValue(row, [/ptres/i, /origemrecurso/i, /origem/i], ['nccelulaptres', 'origemrecurso', 'origem_recurso', 'ptres']);
      const naturezaDespesa = findValue(row, [/naturezadesp/i, /natureza/i], ['nccelulanaturezadespesa', 'naturezadespesa', 'natureza_despesa', 'natureza']);
      const valorStr = findValue(row, [/valor/i], ['nccelulavalor', 'valor']);
      const dataEmissaoStr = findValue(row, [/diaemiss/i, /dataemiss/i, /data/i], ['ncdiaemissao', 'dataemissao', 'data_emissao']);
      const descricao = findValue(row, [/descr/i], ['ncdescricao', 'descricao', 'ncdrescricao']);
      const dataEmissao = parseDateBR(dataEmissaoStr);
      const dateKey = dataEmissao ? dataEmissao.toISOString().split('T')[0] : '';

      const piNorm = planoInterno.trim().toUpperCase();
      const orNorm = origemRecurso.trim();
      const ndNorm = naturezaDespesa.trim();
      const valorBruto = parseValorBR(valorStr || '0');

      const info = {
        row,
        notaCredito,
        operacaoTipo,
        celulaTipo,
        planoInterno: piNorm,
        origemRecurso: orNorm,
        naturezaDespesa: ndNorm,
        valorBruto,
        dataEmissao,
        dateKey,
        descricao,
      };

      return {
        ...info,
        pairKey: buildPairKey(info),
        fullKey: `${buildPairKey(info)}|${ndNorm}`,
      };
    });

    const destinationPairKeys = new Set(
      importRows
        .filter(
          (row) =>
            !row.celulaTipo.trim() &&
            !isAnulacaoDescentralizacao(row.operacaoTipo) &&
            row.naturezaDespesa === '339000',
        )
        .map((row) => row.pairKey),
    );
    const inferredOrigemKeys = new Set(
      importRows
        .filter(
          (row) =>
            !row.celulaTipo.trim() &&
            !isAnulacaoDescentralizacao(row.operacaoTipo) &&
            row.naturezaDespesa !== '339000' &&
            destinationPairKeys.has(row.pairKey),
        )
        .map((row) => row.fullKey),
    );

    for (const row of importRows) {
      const {
        notaCredito,
        operacaoTipo,
        celulaTipo,
        planoInterno: piNorm,
        origemRecurso: orNorm,
        naturezaDespesa: ndNorm,
        valorBruto,
        dataEmissao,
        dateKey,
        descricao,
      } = row;

      const { shouldImport, valor } = normalizeDescentralizacaoImportValue({
        cellType: celulaTipo,
        operationType: operacaoTipo,
        description: descricao,
        rawValue: valorBruto,
        inferredOrigem: inferredOrigemKeys.has(row.fullKey),
      });

      if (!shouldImport) {
        skipCount++;
        continue;
      }

      const { baseKey, rowKey } = createDescentralizacaoImportIdentity({
        dateKey,
        planoInterno: piNorm,
        origemRecurso: orNorm,
        naturezaDespesa: ndNorm,
        valor,
        notaCredito,
      });
      if (existingImportKeys.has(rowKey) || importedRowKeys.has(rowKey)) {
        skipCount++;
        continue;
      }

      const dimensao = deriveDimensaoFromPI(piNorm);

      const descentralizacao: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'> = {
        dimensao,
        notaCredito: notaCredito || undefined,
        operacaoTipo: operacaoTipo.trim() || undefined,
        origemRecurso: orNorm,
        naturezaDespesa: ndNorm,
        planoInterno: piNorm,
        descricao: descricao.trim(),
        valor,
      };

      if (dataEmissao) {
        descentralizacao.dataEmissao = dataEmissao;
      }

      const legacyMatch = notaCredito ? legacyRowsByBaseKey.get(baseKey) : undefined;
      if (legacyMatch && valor !== 0) {
        await updateDescentralizacao(legacyMatch.id, descentralizacao);
        legacyRowsByBaseKey.delete(baseKey);
        existingImportKeys.add(rowKey);
        importedRowKeys.add(rowKey);
        updateCount++;
        continue;
      }

      if (existingImportKeys.has(baseKey)) {
        skipCount++;
        continue;
      }

      if (valor !== 0) {
        await addDescentralizacao(descentralizacao);
        existingImportKeys.add(baseKey);
        existingImportKeys.add(rowKey);
        importedRowKeys.add(rowKey);
        importCount++;
      }
    }

    await refreshData();
    const summaryParts = [
      importCount > 0 ? `${importCount} nova(s) importada(s)` : '',
      updateCount > 0 ? `${updateCount} legado(s) reconciliado(s)` : '',
      skipCount > 0 ? `${skipCount} já existente(s) ignorada(s)` : '',
    ].filter(Boolean);

    if (importCount > 0 || updateCount > 0) {
      toast.success(`${summaryParts.join(', ')}.`);
    } else {
      toast.info(`Nenhum registro novo encontrado. ${skipCount} já existente(s) ignorada(s).`);
    }
  };

  const handleDescDevolucoesImport = async (data: Record<string, string>[]) => {
    let importCount = 0;
    let skipCount = 0;

    const existingKeys = new Set(
      descentralizacoes.map((d) => {
        const dateStr = d.dataEmissao ? d.dataEmissao.toISOString().split('T')[0] : '';
        return `${dateStr}|${(d.origemRecurso || '').trim()}|${(d.naturezaDespesa || '').trim()}|${(d.planoInterno || '').trim().toUpperCase()}|${d.valor}`;
      }),
    );

    const findValue = (row: Record<string, string>, patterns: RegExp[], fallbacks: string[] = []) => {
      for (const key of fallbacks) {
        if (row[key] != null && String(row[key]).trim() !== '') return row[key];
      }
      const keys = Object.keys(row);
      for (const k of keys) {
        if (patterns.some((p) => p.test(k))) {
          const v = row[k];
          if (v != null && String(v).trim() !== '') return v;
        }
      }
      return '';
    };

    for (const row of data) {
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

  const handleDescContaImport = async (data: Record<string, string>[]) => {
    const rows = normalizeContaDescentralizacaoImportRows(data);
    await descentralizacoesContaSaldosService.upsertBatch(rows);
    await refreshData();
    toast.success(`${rows.length} saldo(s) de conta contábil atualizado(s) com sucesso.`);
  };

  // ----------------------------------------------------
  // Handlers de Importação: Crédito Disponível
  // ----------------------------------------------------
  const handleCreditoDisponivelUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('credito-disponivel');
    const toastId = toast.loading('Processando relatório de crédito disponível...');
    try {
      const rows = await parseCreditoDisponivelFile(file);
      await creditosDisponiveisDetalhesService.importReport(rows, file.name);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['creditos-disponiveis-detalhes'] }),
        queryClient.invalidateQueries({ queryKey: dataQueryKeys.creditosDisponiveis }),
      ]);
      toast.success(`${rows.length} linha(s) importada(s) de crédito disponível.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível importar o crédito disponível.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (creditoInputRef.current) creditoInputRef.current.value = '';
    }
  };

  // ----------------------------------------------------
  // Handlers de Importação: Empenhos & RAP SIAFI
  // ----------------------------------------------------
  const handleEmpenhosUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('empenhos-siafi');
    const toastId = toast.loading('Processando arquivo SIAFI de empenhos...');
    try {
      const text = await file.text();
      const parsedRows = parseSiafiCsv(text);
      if (!parsedRows.length) {
        toast.error('Nenhum dado válido encontrado no CSV.', { id: toastId });
        return;
      }
      const syncResult = await syncSiafiDataToDb(parsedRows);
      await refreshData();
      toast.success(
        `SIAFI processado: ${syncResult.updated} atualizado(s), ${syncResult.created} criado(s), ${syncResult.errors} erro(s).`,
        { id: toastId },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar empenhos SIAFI.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (empenhosInputRef.current) empenhosInputRef.current.value = '';
    }
  };

  const handleRapSaldoUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('rap-saldo');
    const toastId = toast.loading('Processando saldo de Restos a Pagar...');
    try {
      const text = await file.text();
      const parsedRows = parseSiafiCsv(text);
      if (!parsedRows.length) {
        toast.error('Nenhum dado válido encontrado no CSV de Saldo RAP.', { id: toastId });
        return;
      }
      const syncResult = await syncSiafiDataToDb(parsedRows);
      await refreshData();
      toast.success(
        `Saldo RAP processado: ${syncResult.updated} atualizado(s), ${syncResult.created} criado(s).`,
        { id: toastId },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar saldo RAP.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (rapSaldoInputRef.current) rapSaldoInputRef.current.value = '';
    }
  };

  // ----------------------------------------------------
  // Handler de Importação: Histórico Anual RAP
  // ----------------------------------------------------
  const handleRapHistoricoUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('rap-historico');
    const toastId = toast.loading('Processando histórico anual de RAP...');
    try {
      const rows = await parseRapHistoricoAnualFile(file);
      await rapHistoricoAnualService.importReport(rows, file.name);
      await queryClient.invalidateQueries({ queryKey: ['rap-historico-anual'] });
      toast.success(`${rows.length} registro(s) histórico(s) de RAP importado(s).`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar histórico RAP.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (rapHistoricoInputRef.current) rapHistoricoInputRef.current.value = '';
    }
  };

  // ----------------------------------------------------
  // Handler de Importação: Atividades do Planejamento
  // ----------------------------------------------------
  const handleAtividadesImport = async (data: Record<string, string>[]) => {
    let importCount = 0;
    for (const row of data) {
      try {
        await addAtividade({
          codigo: row.codigo || row.cod || `ATV-${Date.now()}-${importCount}`,
          descricao: row.descricao || row.nome || 'Atividade importada',
          dimensao: row.dimensao || 'AD - Administração',
          naturezaDespesa: row.naturezadespesa || row.natureza || '339039',
          planoInterno: row.planointerno || row.pi || '',
          origemRecurso: row.origemrecurso || row.origem || '',
          valorPlanejado: parseValorBR(row.valorplanejado || row.valor || '0'),
          valorEmpenhado: 0,
          situacao: 'planejada',
        });
        importCount++;
      } catch (e) {
        console.error('Erro ao importar atividade individual:', e);
      }
    }
    await refreshData();
    toast.success(`${importCount} atividade(s) importada(s) com sucesso.`);
  };

  // ----------------------------------------------------
  // Handlers de Importação: Financeiro & LC
  // ----------------------------------------------------
  const handleFinanceiroUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('financeiro');
    const toastId = toast.loading('Importando dados financeiros...');
    try {
      const parsed = await parseFinanceiroCsv(file);
      await saveFinanceiroRows(parsed, file.name);
      await refreshData();
      toast.success(`Financeiro importado: ${parsed.length} linha(s) processada(s).`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar financeiro.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (financeiroInputRef.current) financeiroInputRef.current.value = '';
    }
  };

  const handleLcUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('lc');
    const toastId = toast.loading('Importando Lista de Credores (LC)...');
    try {
      const parsed = await parseLCCsv(file);
      await saveLCRows(parsed, file.name);
      await refreshData();
      toast.success(`LC importada: ${parsed.length} credor(es) processado(s).`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar LC.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (lcInputRef.current) lcInputRef.current.value = '';
    }
  };

  const handleReinfUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('reinf');
    const toastId = toast.loading('Importando base FD-Reinf...');
    try {
      const parsed = await parseRetencoesEfdReinfCsv(file);
      await saveRetencoesEfdReinfRows(parsed, file.name);
      await refreshData();
      toast.success(`FD-Reinf importado: ${parsed.length} registro(s) processado(s).`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar FD-Reinf.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (reinfInputRef.current) reinfInputRef.current.value = '';
    }
  };

  // ----------------------------------------------------
  // Handlers de Importação: Liquidações e Pagamentos
  // ----------------------------------------------------
  const handleDocHabeisImport = async (data: Record<string, string>[]) => {
    try {
      const count = await transparenciaService.importDocumentosHabeis(data);
      await refreshData();
      toast.success(`${count} documento(s) hábil(eis) importado(s) com sucesso.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar documentos hábeis.');
    }
  };

  const handleLiquidacoesImport = async (data: Record<string, string>[]) => {
    try {
      const count = await transparenciaService.importLiquidacoes(data);
      await refreshData();
      toast.success(`${count} liquidação(ões) vinculada(s) à Fonte SOF.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar liquidações.');
    }
  };

  const handleOrdensBancariasImport = async (data: Record<string, string>[]) => {
    try {
      const count = await transparenciaService.importOrdensBancarias(data);
      await refreshData();
      toast.success(`${count} ordem(ns) bancária(s) processada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar ordens bancárias.');
    }
  };

  const handleSituacoesImport = async (data: Record<string, string>[]) => {
    try {
      const count = await retencoesService.upsertSituacoesBatch(data as any);
      await refreshData();
      toast.success(`${count} situação(ões) e regra(s) de retenção importada(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar situações.');
    }
  };

  // ----------------------------------------------------
  // Handlers de Importação: Energia Campus
  // ----------------------------------------------------
  const handleEnergiaUpload = async (file?: File) => {
    if (!file) return;
    setLoadingPipeline('energia');
    const toastId = toast.loading('Importando dados de energia...');
    try {
      const parsed = await parseEnergiaCampusWorkbook(file);
      await saveEnergiaCampusImport(parsed, file.name);
      await queryClient.invalidateQueries({ queryKey: ['energia-campus'] });
      toast.success(`Energia importada com sucesso: ${file.name}`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar dados de energia.', { id: toastId });
    } finally {
      setLoadingPipeline(null);
      if (energiaInputRef.current) energiaInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <HeaderSubtitle>
        <span>Administração / Central de Importação de Arquivos</span>
      </HeaderSubtitle>

      <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FolderSync className="h-5 w-5 text-primary" />
              <h2 className="font-ui text-lg font-semibold text-text-primary">Hub Central de Importações</h2>
              <Badge variant="outline" className="text-xs">Exclusivo Administrador</Badge>
            </div>
            <p className="font-ui text-sm text-text-secondary">
              Centralize o envio de bases oficiais em formatos CSV, XLSX e JSON para atualizar os módulos orçamentários, financeiros e de contratos.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void refreshData()}
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar Dados
          </Button>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input ref={creditoInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleCreditoDisponivelUpload(e.target.files?.[0])} />
      <input ref={empenhosInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleEmpenhosUpload(e.target.files?.[0])} />
      <input ref={rapSaldoInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleRapSaldoUpload(e.target.files?.[0])} />
      <input ref={rapHistoricoInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleRapHistoricoUpload(e.target.files?.[0])} />
      <input ref={financeiroInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void handleFinanceiroUpload(e.target.files?.[0])} />
      <input ref={lcInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void handleLcUpload(e.target.files?.[0])} />
      <input ref={reinfInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void handleReinfUpload(e.target.files?.[0])} />
      <input ref={energiaInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleEnergiaUpload(e.target.files?.[0])} />

      {/* ========================================================================= */}
      {/* SEÇÃO 1: ORÇAMENTÁRIO */}
      {/* ========================================================================= */}
      <SectionPanel
        title="Módulo Orçamentário"
        description="Bases de descentralizações de crédito, crédito disponível, empenhos SIAFI e planejamento orçamentário."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Card: Descentralizações */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Descentralizações de Crédito</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Importação principal de Notas de Crédito (NC), histórico e reconciliação automática por dimensão e PI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Colunas: NC, Tipo, Operação, Data, PTRES, PI, ND, Valor</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => setIsDescPrincipalOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Importar Descentralizações (CSV)
              </Button>
              <div className="grid w-full grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsDescDevolucoesOpen(true)}
                >
                  Devoluções
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsDescContaOpen(true)}
                >
                  Conta Contábil
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Card: Crédito Disponível */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Crédito Disponível</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Snapshot detalhado de saldos disponíveis por PTRES, Plano Interno e descrição.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Atualiza a visão detalhada e o agregado por PTRES</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                className="w-full gap-2"
                disabled={loadingPipeline === 'credito-disponivel'}
                onClick={() => creditoInputRef.current?.click()}
              >
                {loadingPipeline === 'credito-disponivel' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {loadingPipeline === 'credito-disponivel' ? 'Processando...' : 'Importar Crédito Disponível (CSV)'}
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Empenhos SIAFI */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-base">Empenhos SIAFI</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Relatórios SIAFI do exercício atual e saldos oficiais de Restos a Pagar (RAP).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Suporta codificação UTF-8, UTF-16 e Latin-1</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                className="w-full gap-2"
                disabled={loadingPipeline === 'empenhos-siafi'}
                onClick={() => empenhosInputRef.current?.click()}
              >
                {loadingPipeline === 'empenhos-siafi' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {loadingPipeline === 'empenhos-siafi' ? 'Processando...' : 'Importar Empenhos SIAFI (CSV)'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                disabled={loadingPipeline === 'rap-saldo'}
                onClick={() => rapSaldoInputRef.current?.click()}
              >
                <History className="h-3.5 w-3.5 text-amber-600" />
                Importar Saldo RAP (CSV)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Histórico Anual RAP */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-base">Histórico Anual de RAP</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Base histórica agregada anual de restos a pagar por UG Executora e item de informação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Alimenta a evolução anual da aba RAP do Dashboard</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loadingPipeline === 'rap-historico'}
                onClick={() => rapHistoricoInputRef.current?.click()}
              >
                {loadingPipeline === 'rap-historico' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar Histórico RAP (CSV)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Planejamento / Atividades */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-base">Atividades do Planejamento</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">JSON / CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Importação em lote de atividades orçamentárias planejadas, vinculando código, PI e valor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Valores planejados por dimensão e componente</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setIsAtividadesOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Importar Atividades (JSON/CSV)
              </Button>
            </CardFooter>
          </Card>
        </div>
      </SectionPanel>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: FINANCEIRO */}
      {/* ========================================================================= */}
      <SectionPanel
        title="Módulo Financeiro"
        description="Fontes e vinculações, lista de credores (LC), retenções EFD-Reinf, PFs e liquidações/pagamentos."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Card: Financeiro */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-base">Financeiro (Fontes)</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV / XLSX</Badge>
              </div>
              <CardDescription className="text-xs">
                Consolidação dos saldos por fonte de recursos e vinculação orçamentária.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Alimenta a visão de fontes e disponibilidades</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                className="w-full gap-2"
                disabled={loadingPipeline === 'financeiro'}
                onClick={() => financeiroInputRef.current?.click()}
              >
                {loadingPipeline === 'financeiro' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar Financeiro (CSV/XLSX)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: LC */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-base">Lista de Credores (LC)</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV / XLSX</Badge>
              </div>
              <CardDescription className="text-xs">
                Cronologia e cadastro de credores, ordens de pagamento e vinculações bancárias.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Atualiza a ordem cronológica de exigibilidades</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loadingPipeline === 'lc'}
                onClick={() => lcInputRef.current?.click()}
              >
                {loadingPipeline === 'lc' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar Lista de Credores
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Retenções EFD-Reinf */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <CardTitle className="text-base">Retenções EFD-Reinf</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Auditoria de notas fiscais, retenções tributárias federais e cruzamento com UG pagadora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Identifica pendências de prazo e alíquotas retidas</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loadingPipeline === 'reinf'}
                onClick={() => reinfInputRef.current?.click()}
              >
                {loadingPipeline === 'reinf' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar Base FD-Reinf (CSV)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Rastreabilidade de PFs */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <CardTitle className="text-base">Rastreabilidade de PFs</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">XLSX</Badge>
              </div>
              <CardDescription className="text-xs">
                Importação combinada de planilhas correlacionadas de Solicitação e Liberação de Recursos (PFs).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Cruza aprovações, fontes e saldos liberados</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setIsPFOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Importar Planilhas de PFs (XLSX)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Liquidações & Transparência */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-teal-600" />
                  <CardTitle className="text-base">Liquidações e Pagamentos</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">JSON / CSV</Badge>
              </div>
              <CardDescription className="text-xs">
                Documentos Hábeis (DH), vínculo com Fonte SOF, Ordens Bancárias e Situações/Retenções.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Submódulos individuais para atualização do Portal da Transparência</span>
              </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsDocHabeisOpen(true)}
              >
                Doc. Hábeis
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsLiquidacoesOpen(true)}
              >
                Fonte SOF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsOrdensBancariasOpen(true)}
              >
                Ordens Bancárias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsSituacoesOpen(true)}
              >
                Situações
              </Button>
            </CardFooter>
          </Card>
        </div>
      </SectionPanel>

      {/* ========================================================================= */}
      {/* SEÇÃO 3: CONTRATOS & GESTÃO */}
      {/* ========================================================================= */}
      <SectionPanel
        title="Contratos e Gestão Operacional"
        description="Sincronização de contratos locais Comprasnet e gestão do consumo de energia do campus."
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Card: Contratos */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Contratos (Comprasnet)</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">XLSX</Badge>
              </div>
              <CardDescription className="text-xs">
                Sincronização com planilhas `Relatorio.xlsx` e `Relatorio (1).xlsx` (ativos e vínculos com empenhos).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Identifica automaticamente a ordem dos relatórios por cabeçalho</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                className="w-full gap-2"
                onClick={() => setIsContratosSyncOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Sincronizar Contratos (XLSX)
              </Button>
            </CardFooter>
          </Card>

          {/* Card: Energia Campus */}
          <Card className="flex flex-col justify-between border-border-default shadow-sm transition-all hover:border-primary/40">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Energia Campus</CardTitle>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">XLSX</Badge>
              </div>
              <CardDescription className="text-xs">
                Importação da planilha oficial `Levantamento de Consumo - COSERN.xlsx` (COSERN, Mercatto, Solar).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-1.5 text-text-muted">
                <Info className="h-3.5 w-3.5" />
                <span>Consome abas de Consumo, Previsão, UFVs e Execução</span>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loadingPipeline === 'energia'}
                onClick={() => energiaInputRef.current?.click()}
              >
                {loadingPipeline === 'energia' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar Consumo de Energia (XLSX)
              </Button>
            </CardFooter>
          </Card>
        </div>
      </SectionPanel>

      {/* ========================================================================= */}
      {/* DIALOGS INTEGRADOS */}
      {/* ========================================================================= */}
      <JsonImportDialog
        open={isDescPrincipalOpen}
        onOpenChange={setIsDescPrincipalOpen}
        onImport={handleDescPrincipalImport}
        title="Importar Descentralizações (CSV Principal)"
        expectedFields={[
          'NC',
          'NC Célula - Tipo',
          'NC - Operacao (Tipo)',
          'NC - Dia Emissão',
          'NC - Descrição',
          'NC Célula - PTRES',
          'NC Célula - Natureza Despesa',
          'NC Célula - Plano Interno',
          'NC Célula - Valor',
        ]}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isDescDevolucoesOpen}
        onOpenChange={setIsDescDevolucoesOpen}
        onImport={handleDescDevolucoesImport}
        title="Importar Devoluções de Descentralização"
        expectedFields={[
          'NC - Dia Emissão',
          'NC - Descrição',
          'NC Célula - PTRES',
          'NC Célula - Natureza Despesa',
          'NC Célula - Plano Interno',
          'NC Célula - Valor',
        ]}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isDescContaOpen}
        onOpenChange={setIsDescContaOpen}
        onImport={handleDescContaImport}
        title="Importar Conta Contábil de Descentralizações"
        expectedFields={['PTRES', 'Métrica', 'Valor']}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isAtividadesOpen}
        onOpenChange={setIsAtividadesOpen}
        onImport={handleAtividadesImport}
        title="Importar Atividades do Planejamento"
        expectedFields={['codigo', 'descricao', 'dimensao', 'naturezaDespesa', 'planoInterno', 'valorPlanejado']}
        acceptCsv={true}
      />

      <PFImportDialog
        isOpen={isPFOpen}
        onClose={() => setIsPFOpen(false)}
        onImportSuccess={() => void refreshData()}
      />

      <ContratosSyncDialog
        isOpen={isContratosSyncOpen}
        onClose={() => setIsContratosSyncOpen(false)}
        onSuccess={() => void refreshData()}
      />

      <JsonImportDialog
        open={isDocHabeisOpen}
        onOpenChange={setIsDocHabeisOpen}
        onImport={handleDocHabeisImport}
        title="Importar Documentos Hábeis"
        expectedFields={['documento', 'ug', 'emissao', 'valor']}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isLiquidacoesOpen}
        onOpenChange={setIsLiquidacoesOpen}
        onImport={handleLiquidacoesImport}
        title="Importar Fonte SOF / Liquidações"
        expectedFields={['documento', 'fonte', 'vinculacao']}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isOrdensBancariasOpen}
        onOpenChange={setIsOrdensBancariasOpen}
        onImport={handleOrdensBancariasImport}
        title="Importar Ordens Bancárias / Pagos"
        expectedFields={['ob', 'documento', 'valor_pago']}
        acceptCsv={true}
      />

      <JsonImportDialog
        open={isSituacoesOpen}
        onOpenChange={setIsSituacoesOpen}
        onImport={handleSituacoesImport}
        title="Importar Situações (Despesas/Retenções)"
        expectedFields={['situacao', 'descricao', 'natureza']}
        acceptCsv={true}
        csvSeparator="\t"
      />
    </div>
  );
}
