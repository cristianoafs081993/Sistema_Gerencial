import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export type EnergiaFonte = 'cosern' | 'mercatto' | 'solar';
export type EnergiaSolarGranularidade = 'anual' | 'mensal';

export interface EnergiaImportRun {
  id: string;
  sourceFile: string;
  importedByEmail?: string;
  importedAt: string;
  totals?: Record<string, unknown>;
}

export interface EnergiaConsumoFatura {
  id?: string;
  importRunId?: string;
  fonte: Exclude<EnergiaFonte, 'solar'>;
  ambiente?: string;
  subestacao?: string;
  contrato?: string;
  competencia?: string | null;
  ano?: number | null;
  leituraInicio?: string | null;
  leituraFim?: string | null;
  consumoAtivoFpKwh?: number | null;
  consumoAtivoNpKwh?: number | null;
  consumoTotalKwh?: number | null;
  valorFaturado?: number | null;
  faturaNumero?: string;
  parcela?: string;
  processo?: string;
  fornecedor?: string;
  rawData?: Record<string, unknown>;
}

export interface EnergiaSolarGeracao {
  id?: string;
  importRunId?: string;
  ufvNome: string;
  dataReferencia?: string | null;
  ano?: number | null;
  mes?: number | null;
  granularidade: EnergiaSolarGranularidade;
  energiaGeradaKwh?: number | null;
  observacao?: string;
  rawData?: Record<string, unknown>;
}

export interface EnergiaContrato {
  id?: string;
  importRunId?: string;
  fonte: EnergiaFonte;
  modalidade?: string;
  fornecedor?: string;
  contratoNumero?: string;
  inicio?: string | null;
  termino?: string | null;
  volumeContratadoKwh?: number | null;
  valorContratado?: number | null;
  situacao?: string;
  rawData?: Record<string, unknown>;
}

export interface EnergiaContratoExecucao {
  id?: string;
  importRunId?: string;
  fonte: EnergiaFonte;
  contratoNumero?: string;
  parcela?: string;
  competencia?: string | null;
  valorExecutado?: number | null;
  valorPrevisto?: number | null;
  percentualExecucao?: number | null;
  rawData?: Record<string, unknown>;
}

export interface EnergiaMercattoContratoApi {
  id: string;
  apiContratoId: number;
  numero?: string | null;
  fornecedorNome?: string | null;
  fornecedorDocumento?: string | null;
  objeto?: string | null;
  processo?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  valorGlobal?: number | null;
  valorAcumulado?: number | null;
  situacaoDerivada?: boolean | null;
}

export interface EnergiaMercattoFaturaApi {
  id: string;
  contratoApiId: string;
  apiFaturaId: number;
  numeroInstrumentoCobranca?: string | null;
  situacao?: string | null;
  valorBruto?: number | null;
  valorLiquido?: number | null;
  dataEmissao?: string | null;
  dataPagamento?: string | null;
}

export interface EnergiaMercattoLiquidacaoApi {
  id: string;
  contratoApiId?: number | null;
  contratoNumero?: string | null;
  faturaId?: number | null;
  numeroInstrumentoCobranca?: string | null;
  situacao?: string | null;
  valorBruto?: number | null;
  valorLiquido?: number | null;
  dataEmissao?: string | null;
  dataPagamento?: string | null;
  dataLiquidacao?: string | null;
  processo?: string | null;
  empenhoNumero?: string | null;
}

export interface EnergiaMercattoContratoApiData {
  contratos: EnergiaMercattoContratoApi[];
  faturas: EnergiaMercattoFaturaApi[];
  liquidacoes: EnergiaMercattoLiquidacaoApi[];
}

export interface EnergiaCampusParsedData {
  consumoFaturas: EnergiaConsumoFatura[];
  solarGeracao: EnergiaSolarGeracao[];
  contratos: EnergiaContrato[];
  contratoExecucoes: EnergiaContratoExecucao[];
  warnings: string[];
}

export interface EnergiaCampusData extends EnergiaCampusParsedData {
  latestRun: EnergiaImportRun | null;
  mercattoContratosApi: EnergiaMercattoContratoApiData;
}

export interface EnergiaCampusFilters {
  startDate?: string;
  endDate?: string;
  fontes?: EnergiaFonte[];
}

type EnergiaImportRunDbRow = {
  id: string;
  source_file: string;
  imported_by_email: string | null;
  totals: Record<string, unknown> | null;
  imported_at: string;
};

type EnergiaConsumoDbRow = {
  id: string;
  import_run_id: string | null;
  fonte: Exclude<EnergiaFonte, 'solar'>;
  ambiente: string | null;
  subestacao: string | null;
  contrato: string | null;
  competencia: string | null;
  ano: number | null;
  leitura_inicio: string | null;
  leitura_fim: string | null;
  consumo_ativo_fp_kwh: number | null;
  consumo_ativo_np_kwh: number | null;
  consumo_total_kwh: number | null;
  valor_faturado: number | null;
  fatura_numero: string | null;
  parcela: string | null;
  processo: string | null;
  fornecedor: string | null;
  raw_data: Record<string, unknown> | null;
};

type EnergiaSolarDbRow = {
  id: string;
  import_run_id: string | null;
  ufv_nome: string;
  data_referencia: string | null;
  ano: number | null;
  mes: number | null;
  granularidade: EnergiaSolarGranularidade;
  energia_gerada_kwh: number | null;
  observacao: string | null;
  raw_data: Record<string, unknown> | null;
};

type EnergiaContratoDbRow = {
  id: string;
  import_run_id: string | null;
  fonte: EnergiaFonte;
  modalidade: string | null;
  fornecedor: string | null;
  contrato_numero: string | null;
  inicio: string | null;
  termino: string | null;
  volume_contratado_kwh: number | null;
  valor_contratado: number | null;
  situacao: string | null;
  raw_data: Record<string, unknown> | null;
};

type EnergiaContratoExecucaoDbRow = {
  id: string;
  import_run_id: string | null;
  fonte: EnergiaFonte;
  contrato_numero: string | null;
  parcela: string | null;
  competencia: string | null;
  valor_executado: number | null;
  valor_previsto: number | null;
  percentual_execucao: number | null;
  raw_data: Record<string, unknown> | null;
};

const emptyMercattoContratosApiData: EnergiaMercattoContratoApiData = {
  contratos: [],
  faturas: [],
  liquidacoes: [],
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  março: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeText(value: unknown): string {
  return toText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function parseEnergiaNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = String(value)
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!cleaned || cleaned === '-' || cleaned === '–') return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (hasComma) {
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: unknown): number | null {
  const parsed = parseEnergiaNumber(value);
  if (parsed === null) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function toIsoDate(year: number, month: number, day = 1): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function normalizeYear(year: number): number {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

export function parseEnergiaDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return toIsoDate(parsed.y, parsed.m, parsed.d);
  }

  const text = toText(value);
  if (!text || text === '-') return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const year = normalizeYear(Number(parts[3]));

  const month = first > 12 ? second : first;
  const day = first > 12 ? first : second;
  return toIsoDate(year, month, day);
}

function parseCompetencia(value: unknown): string | null {
  const text = toText(value);
  if (!text || text === '-') return null;

  const numeric = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (numeric) return toIsoDate(Number(numeric[2]), Number(numeric[1]), 1);

  const monthYear = normalizeText(text).match(/^([a-z]+)-?\/?(\d{2,4})$/);
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1]];
    if (!month) return null;
    return toIsoDate(normalizeYear(Number(monthYear[2])), month, 1);
  }

  const parsedDate = parseEnergiaDate(text);
  return parsedDate ? parsedDate.slice(0, 8) + '01' : null;
}

function getYearFromDate(value?: string | null): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function workbookRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', range: 0 }) as unknown[][];
}

function parseConsumoRows(rows: unknown[][]): EnergiaConsumoFatura[] {
  const headerIndex = rows.findIndex((row) => normalizeText(row.join('|')).includes('periodo de leitura'));
  const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 2 : 2);

  return dataRows
    .flatMap((row): EnergiaConsumoFatura[] => {
      const subestacao = toText(row[5]);
      const faturaNumero = toText(row[6]);
      const parcela = toText(row[7]);
      const consumoTotalKwh = parseEnergiaNumber(row[4]);
      const valorAmbienteLivre = parseEnergiaNumber(row[11]);

      if (!subestacao && !faturaNumero && consumoTotalKwh === null && !valorAmbienteLivre) return [];
      if (!faturaNumero && (!consumoTotalKwh || consumoTotalKwh === 0) && !valorAmbienteLivre) return [];

      const leituraInicio = parseEnergiaDate(row[0]);
      const leituraFim = parseEnergiaDate(row[1]);
      const competencia = parseCompetencia(row[9]) || (leituraFim ? leituraFim.slice(0, 8) + '01' : null);
      const ano = Number(toText(row[10])) || getYearFromDate(competencia) || getYearFromDate(leituraFim);
      const isMercattoConsumo =
        valorAmbienteLivre !== null &&
        (competencia || leituraFim || '') >= '2025-12-01';

      const fonte: Exclude<EnergiaFonte, 'solar'> = isMercattoConsumo ? 'mercatto' : 'cosern';
      const fornecedor = isMercattoConsumo ? 'MERCATTO ENERGIA LTDA' : 'COSERN';

      return [{
        fonte,
        ambiente: isMercattoConsumo ? 'Mercado Livre' : 'Mercado Cativo',
        subestacao,
        contrato: isMercattoConsumo ? 'ML-001' : '82/2021',
        competencia,
        ano,
        leituraInicio,
        leituraFim,
        consumoAtivoFpKwh: parseEnergiaNumber(row[2]),
        consumoAtivoNpKwh: parseEnergiaNumber(row[3]),
        consumoTotalKwh,
        valorFaturado: valorAmbienteLivre,
        faturaNumero,
        parcela,
        processo: toText(row[8]),
        fornecedor,
        rawData: { sheet: 'Consumo', row, ambienteLivreValorColuna: 'L' },
      }];
    })
}

function parseMercattoRows(rows: unknown[][]): EnergiaConsumoFatura[] {
  const headerIndex = rows.findIndex((row) => {
    const joined = normalizeText(row.join('|'));
    return joined.includes('processo') && joined.includes('competencia') && joined.includes('orcamento');
  });

  if (headerIndex === -1) return [];

  const parsed: EnergiaConsumoFatura[] = [];
  const blocks = [
    { offset: 0, subestacao: 'SUB I - CTq' },
    { offset: 9, subestacao: 'SUB II - Campo' },
  ];

  for (const row of rows.slice(headerIndex + 1)) {
    for (const block of blocks) {
      const base = block.offset;
      const competencia = parseCompetencia(row[base + 2]);
      const valorFaturado = parseEnergiaNumber(row[base + 3]);
      const parcela = toText(row[base + 1]);

      if (!competencia && valorFaturado === null && !parcela) continue;
      if (normalizeText(row[base + 2]) === 'total') continue;
      if (!competencia && valorFaturado === null) continue;

      parsed.push({
        fonte: 'mercatto',
        ambiente: 'Mercado Livre',
        subestacao: block.subestacao,
        contrato: 'ML-001',
        competencia,
        ano: getYearFromDate(competencia) || Number(toText(row[base + 7])) || null,
        leituraInicio: parseEnergiaDate(row[base + 4]),
        leituraFim: parseEnergiaDate(row[base + 5]),
        consumoAtivoFpKwh: null,
        consumoAtivoNpKwh: null,
        consumoTotalKwh: null,
        valorFaturado,
        parcela,
        processo: toText(row[base]),
        fornecedor: 'MERCATTO ENERGIA LTDA',
        rawData: { sheet: 'Previsão - Mercatto', row },
      });
    }
  }

  return parsed;
}

function parseUfvAnnualRows(rows: unknown[][]): EnergiaSolarGeracao[] {
  const blocks = [
    { offset: 0, ufvNome: 'UFV 01' },
    { offset: 4, ufvNome: 'UFV 02' },
    { offset: 8, ufvNome: 'UFV 03' },
  ];
  const parsed: EnergiaSolarGeracao[] = [];

  for (const row of rows.slice(2)) {
    for (const block of blocks) {
      const ano = Number(toText(row[block.offset]));
      const energiaGeradaKwh = parseEnergiaNumber(row[block.offset + 1]);

      if (!Number.isFinite(ano) || energiaGeradaKwh === null) continue;

      parsed.push({
        ufvNome: block.ufvNome,
        ano,
        mes: null,
        dataReferencia: toIsoDate(ano, 1, 1),
        granularidade: 'anual',
        energiaGeradaKwh,
        observacao: toText(row[block.offset + 2]),
        rawData: { sheet: "UFV's", row },
      });
    }
  }

  return parsed;
}

function parseSolarMonthlyRows(rows: unknown[][], sheetName: string): EnergiaSolarGeracao[] {
  const parsed: EnergiaSolarGeracao[] = [];
  const year = Number(sheetName);
  if (!Number.isFinite(year)) return parsed;

  const headerIndex = rows.findIndex((row) => {
    const joined = normalizeText(row.join('|'));
    return joined.includes('mes') && joined.includes('geracao');
  });
  if (headerIndex === -1) return parsed;

  const header = rows[headerIndex];
  const monthColumn = header.findIndex((cell) => normalizeText(cell) === 'mes');
  const generationColumn = header.findIndex((cell) => normalizeText(cell).includes('geracao'));
  if (monthColumn === -1 || generationColumn === -1) return parsed;

  for (const row of rows.slice(headerIndex + 1)) {
    const monthLabel = normalizeText(row[monthColumn]);
    const month = MONTH_NAMES[monthLabel];
    const energiaGeradaKwh = parseEnergiaNumber(row[generationColumn]);

    if (!month || energiaGeradaKwh === null) continue;

    parsed.push({
      ufvNome: 'UFVs Campus',
      ano: year,
      mes: month,
      dataReferencia: toIsoDate(year, month, 1),
      granularidade: 'mensal',
      energiaGeradaKwh,
      observacao: '',
      rawData: { sheet: sheetName, row },
    });
  }

  return parsed;
}

function parseConsumoSolarMonthlyRows(rows: unknown[][]): EnergiaSolarGeracao[] {
  const parsed: EnergiaSolarGeracao[] = [];

  rows.forEach((header, headerIndex) => {
    const normalizedHeader = header.map(normalizeText);
    const generationColumn = normalizedHeader.findIndex((cell) => cell.includes('geracao') && cell.includes('kwh') && !cell.includes('consumo +'));
    const periodColumn = normalizedHeader.findIndex((cell) => cell.includes('periodo -'));
    const yearMatch = periodColumn >= 0 ? normalizedHeader[periodColumn].match(/(\d{4})/) : null;

    if (generationColumn === -1 || periodColumn === -1 || !yearMatch) return;

    const year = Number(yearMatch[1]);
    if (!Number.isFinite(year)) return;

    for (const row of rows.slice(headerIndex + 1)) {
      const rowText = normalizeText(row.join('|'));
      if (rowText.includes('periodo -') && rowText.includes('geracao')) break;

      const month = MONTH_NAMES[normalizeText(row[periodColumn])];
      const energiaGeradaKwh = parseEnergiaNumber(row[generationColumn]);
      if (!month || energiaGeradaKwh === null) continue;

      parsed.push({
        ufvNome: 'UFVs Campus',
        ano: year,
        mes: month,
        dataReferencia: toIsoDate(year, month, 1),
        granularidade: 'mensal',
        energiaGeradaKwh,
        observacao: '',
        rawData: { sheet: 'Consumo', row, embeddedSolarTable: true },
      });
    }
  });

  return parsed;
}

function dedupeSolarGeracao(rows: EnergiaSolarGeracao[]): EnergiaSolarGeracao[] {
  const map = new Map<string, EnergiaSolarGeracao>();
  rows.forEach((row) => {
    const key = `${row.ufvNome}|${row.granularidade}|${row.dataReferencia || row.ano || ''}`;
    if (!map.has(key)) map.set(key, row);
  });
  return Array.from(map.values());
}

function parseValorExecutadoRows(rows: unknown[][]): EnergiaContratoExecucao[] {
  const headerIndex = rows.findIndex((row) => normalizeText(row.join('|')).includes('valor executado'));
  if (headerIndex === -1) return [];

  return rows
    .slice(headerIndex + 1)
    .map((row): EnergiaContratoExecucao | null => {
      const parcela = toText(row[0]);
      const valorExecutado = parseEnergiaNumber(row[1]);
      const valorPrevisto = parseEnergiaNumber(row[2]);
      const percentualExecucao = parsePercent(row[3]);

      if (!parcela || (valorExecutado === null && valorPrevisto === null)) return null;

      return {
        fonte: 'cosern',
        contratoNumero: '82/2021',
        parcela,
        competencia: null,
        valorExecutado,
        valorPrevisto,
        percentualExecucao,
        rawData: { sheet: 'Valor Executado', row },
      };
    })
    .filter((item): item is EnergiaContratoExecucao => item !== null);
}

function parseContratos(
  consumoFaturas: EnergiaConsumoFatura[],
  mercattoRows: unknown[][],
  solarGeracao: EnergiaSolarGeracao[],
): EnergiaContrato[] {
  const cosernTotal = consumoFaturas
    .filter((item) => item.fonte === 'cosern')
    .reduce((total, item) => total + (item.valorFaturado || 0), 0);
  const mercattoTotal = consumoFaturas
    .filter((item) => item.fonte === 'mercatto')
    .reduce((total, item) => total + (item.valorFaturado || 0), 0);
  const solarTotal = solarGeracao.reduce((total, item) => total + (item.energiaGeradaKwh || 0), 0);
  const mercattoFornecedor = mercattoRows.flat().find((cell) => normalizeText(cell).includes('mercatto energia'));

  return [
    {
      fonte: 'cosern',
      modalidade: 'Mercado Cativo',
      fornecedor: 'COSERN',
      contratoNumero: '82/2021',
      valorContratado: cosernTotal || null,
      situacao: 'Ativo',
      rawData: { derivedFrom: 'Consumo' },
    },
    {
      fonte: 'mercatto',
      modalidade: 'Mercado Livre',
      fornecedor: toText(mercattoFornecedor) || 'MERCATTO ENERGIA LTDA',
      contratoNumero: 'ML-001',
      valorContratado: mercattoTotal || null,
      situacao: 'Ativo',
      rawData: { derivedFrom: 'Previsão - Mercatto' },
    },
    {
      fonte: 'solar',
      modalidade: 'Geração Distribuída',
      fornecedor: 'UFVs Campus',
      contratoNumero: 'UFV-CAMPUS',
      volumeContratadoKwh: null,
      valorContratado: null,
      situacao: solarTotal > 0 ? 'Ativo' : 'N/D',
      rawData: { derivedFrom: "UFV's" },
    },
  ];
}

async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const arrayBuffer = await file.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
}

export async function parseEnergiaCampusWorkbook(file: File): Promise<EnergiaCampusParsedData> {
  const workbook = await readWorkbook(file);
  const warnings: string[] = [];

  const missingSheets = ['Consumo', 'Previsão - Mercatto', "UFV's", 'Valor Executado'].filter(
    (sheetName) => !workbook.Sheets[sheetName],
  );
  missingSheets.forEach((sheetName) => warnings.push(`Aba ausente: ${sheetName}.`));

  const consumoRows = workbookRows(workbook, 'Consumo');
  const mercattoRows = workbookRows(workbook, 'Previsão - Mercatto');
  const ufvRows = workbookRows(workbook, "UFV's");
  const valorExecutadoRows = workbookRows(workbook, 'Valor Executado');

  const consumoFaturas = [
    ...parseConsumoRows(consumoRows),
    ...parseMercattoRows(mercattoRows),
  ];
  const solarGeracao = dedupeSolarGeracao([
    ...parseUfvAnnualRows(ufvRows),
    ...parseConsumoSolarMonthlyRows(consumoRows),
    ...workbook.SheetNames
      .filter((sheetName) => /^\d{4}$/.test(sheetName))
      .flatMap((sheetName) => parseSolarMonthlyRows(workbookRows(workbook, sheetName), sheetName)),
  ]);
  const contratoExecucoes = parseValorExecutadoRows(valorExecutadoRows);
  const contratos = parseContratos(consumoFaturas, mercattoRows, solarGeracao);

  if (consumoFaturas.every((item) => item.fonte !== 'mercatto' || item.consumoTotalKwh === null)) {
    warnings.push('A base Mercatto importada não trouxe kWh real; consumo direto do Mercado Livre ficará como N/D.');
  }

  return {
    consumoFaturas,
    solarGeracao,
    contratos,
    contratoExecucoes,
    warnings,
  };
}

function toImportRun(row: EnergiaImportRunDbRow): EnergiaImportRun {
  return {
    id: row.id,
    sourceFile: row.source_file,
    importedByEmail: row.imported_by_email || undefined,
    importedAt: row.imported_at,
    totals: row.totals || {},
  };
}

function toConsumo(row: EnergiaConsumoDbRow): EnergiaConsumoFatura {
  return {
    id: row.id,
    importRunId: row.import_run_id || undefined,
    fonte: row.fonte,
    ambiente: row.ambiente || undefined,
    subestacao: row.subestacao || undefined,
    contrato: row.contrato || undefined,
    competencia: row.competencia,
    ano: row.ano,
    leituraInicio: row.leitura_inicio,
    leituraFim: row.leitura_fim,
    consumoAtivoFpKwh: row.consumo_ativo_fp_kwh,
    consumoAtivoNpKwh: row.consumo_ativo_np_kwh,
    consumoTotalKwh: row.consumo_total_kwh,
    valorFaturado: row.valor_faturado,
    faturaNumero: row.fatura_numero || undefined,
    parcela: row.parcela || undefined,
    processo: row.processo || undefined,
    fornecedor: row.fornecedor || undefined,
    rawData: row.raw_data || {},
  };
}

function toSolar(row: EnergiaSolarDbRow): EnergiaSolarGeracao {
  return {
    id: row.id,
    importRunId: row.import_run_id || undefined,
    ufvNome: row.ufv_nome,
    dataReferencia: row.data_referencia,
    ano: row.ano,
    mes: row.mes,
    granularidade: row.granularidade,
    energiaGeradaKwh: row.energia_gerada_kwh,
    observacao: row.observacao || undefined,
    rawData: row.raw_data || {},
  };
}

function toContrato(row: EnergiaContratoDbRow): EnergiaContrato {
  return {
    id: row.id,
    importRunId: row.import_run_id || undefined,
    fonte: row.fonte,
    modalidade: row.modalidade || undefined,
    fornecedor: row.fornecedor || undefined,
    contratoNumero: row.contrato_numero || undefined,
    inicio: row.inicio,
    termino: row.termino,
    volumeContratadoKwh: row.volume_contratado_kwh,
    valorContratado: row.valor_contratado,
    situacao: row.situacao || undefined,
    rawData: row.raw_data || {},
  };
}

function toContratoExecucao(row: EnergiaContratoExecucaoDbRow): EnergiaContratoExecucao {
  return {
    id: row.id,
    importRunId: row.import_run_id || undefined,
    fonte: row.fonte,
    contratoNumero: row.contrato_numero || undefined,
    parcela: row.parcela || undefined,
    competencia: row.competencia,
    valorExecutado: row.valor_executado,
    valorPrevisto: row.valor_previsto,
    percentualExecucao: row.percentual_execucao,
    rawData: row.raw_data || {},
  };
}

async function insertRows<T>(table: string, rows: T[]) {
  const chunkSize = 500;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

export async function saveEnergiaCampusImport(parsed: EnergiaCampusParsedData, sourceFile: string): Promise<EnergiaImportRun> {
  const totals = {
    consumoFaturas: parsed.consumoFaturas.length,
    solarGeracao: parsed.solarGeracao.length,
    contratos: parsed.contratos.length,
    contratoExecucoes: parsed.contratoExecucoes.length,
    warnings: parsed.warnings,
  };

  const { data: run, error: runError } = await supabase
    .from('energia_import_runs')
    .insert({ source_file: sourceFile, totals })
    .select('id, source_file, imported_by_email, totals, imported_at')
    .single();

  if (runError) throw runError;
  const importRun = toImportRun(run as EnergiaImportRunDbRow);

  await insertRows(
    'energia_consumo_faturas',
    parsed.consumoFaturas.map((row) => ({
      import_run_id: importRun.id,
      fonte: row.fonte,
      ambiente: row.ambiente || null,
      subestacao: row.subestacao || null,
      contrato: row.contrato || null,
      competencia: row.competencia || null,
      ano: row.ano || null,
      leitura_inicio: row.leituraInicio || null,
      leitura_fim: row.leituraFim || null,
      consumo_ativo_fp_kwh: row.consumoAtivoFpKwh,
      consumo_ativo_np_kwh: row.consumoAtivoNpKwh,
      consumo_total_kwh: row.consumoTotalKwh,
      valor_faturado: row.valorFaturado,
      fatura_numero: row.faturaNumero || null,
      parcela: row.parcela || null,
      processo: row.processo || null,
      fornecedor: row.fornecedor || null,
      raw_data: row.rawData || {},
    })),
  );

  await insertRows(
    'energia_solar_geracao',
    parsed.solarGeracao.map((row) => ({
      import_run_id: importRun.id,
      ufv_nome: row.ufvNome,
      data_referencia: row.dataReferencia || null,
      ano: row.ano || null,
      mes: row.mes || null,
      granularidade: row.granularidade,
      energia_gerada_kwh: row.energiaGeradaKwh,
      observacao: row.observacao || null,
      raw_data: row.rawData || {},
    })),
  );

  await insertRows(
    'energia_contratos',
    parsed.contratos.map((row) => ({
      import_run_id: importRun.id,
      fonte: row.fonte,
      modalidade: row.modalidade || null,
      fornecedor: row.fornecedor || null,
      contrato_numero: row.contratoNumero || null,
      inicio: row.inicio || null,
      termino: row.termino || null,
      volume_contratado_kwh: row.volumeContratadoKwh,
      valor_contratado: row.valorContratado,
      situacao: row.situacao || null,
      raw_data: row.rawData || {},
    })),
  );

  await insertRows(
    'energia_contrato_execucoes',
    parsed.contratoExecucoes.map((row) => ({
      import_run_id: importRun.id,
      fonte: row.fonte,
      contrato_numero: row.contratoNumero || null,
      parcela: row.parcela || null,
      competencia: row.competencia || null,
      valor_executado: row.valorExecutado,
      valor_previsto: row.valorPrevisto,
      percentual_execucao: row.percentualExecucao,
      raw_data: row.rawData || {},
    })),
  );

  return importRun;
}

async function loadMercattoContratosApiData(): Promise<EnergiaMercattoContratoApiData> {
  const { data: contratos, error: contratosError } = await supabase
    .from('contratos_api')
    .select('id, api_contrato_id, numero, fornecedor_nome, fornecedor_documento, objeto, processo, vigencia_inicio_derivada, vigencia_fim_derivada, vigencia_inicio, vigencia_fim, valor_global, valor_acumulado, situacao_derivada')
    .or('fornecedor_nome.ilike.%MERCATTO%,fornecedor_documento.ilike.%37028928%,objeto.ilike.%MERCATTO%')
    .order('vigencia_fim_derivada', { ascending: false, nullsFirst: false });

  if (contratosError) {
    console.warn('loadMercattoContratosApiData: contratos_api indisponivel', contratosError);
    return emptyMercattoContratosApiData;
  }

  const contratoRows = (contratos || []) as Array<Record<string, unknown>>;
  if (!contratoRows.length) return emptyMercattoContratosApiData;

  const contratoIds = contratoRows.map((row) => String(row.id)).filter(Boolean);
  const apiContratoIds = contratoRows
    .map((row) => Number(row.api_contrato_id))
    .filter((value) => Number.isFinite(value));

  const [faturasResult, liquidacoesResult] = await Promise.all([
    supabase
      .from('contratos_api_faturas')
      .select('id, contrato_api_id, api_fatura_id, numero_instrumento_cobranca, situacao, valor_bruto, valor_liquido, data_emissao, data_pagamento')
      .in('contrato_api_id', contratoIds)
      .order('data_emissao', { ascending: true }),
    apiContratoIds.length
      ? supabase
          .from('contratos_api_empenho_liquidacoes_cache')
          .select('id, contrato_api_id, contrato_numero, fatura_id, numero_instrumento_cobranca, situacao, valor_bruto, valor_liquido, data_emissao, data_pagamento, data_liquidacao, processo, empenho_numero')
          .in('contrato_api_id', apiContratoIds)
          .order('data_liquidacao', { ascending: true, nullsFirst: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (faturasResult.error) {
    console.warn('loadMercattoContratosApiData: contratos_api_faturas indisponivel', faturasResult.error);
  }
  if (liquidacoesResult.error) {
    console.warn('loadMercattoContratosApiData: contratos_api_empenho_liquidacoes_cache indisponivel', liquidacoesResult.error);
  }

  return {
    contratos: contratoRows.map((row) => ({
      id: String(row.id),
      apiContratoId: Number(row.api_contrato_id),
      numero: row.numero as string | null,
      fornecedorNome: row.fornecedor_nome as string | null,
      fornecedorDocumento: row.fornecedor_documento as string | null,
      objeto: row.objeto as string | null,
      processo: row.processo as string | null,
      vigenciaInicio: (row.vigencia_inicio_derivada || row.vigencia_inicio) as string | null,
      vigenciaFim: (row.vigencia_fim_derivada || row.vigencia_fim) as string | null,
      valorGlobal: row.valor_global as number | null,
      valorAcumulado: row.valor_acumulado as number | null,
      situacaoDerivada: row.situacao_derivada as boolean | null,
    })),
    faturas: (((faturasResult.data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      contratoApiId: String(row.contrato_api_id),
      apiFaturaId: Number(row.api_fatura_id),
      numeroInstrumentoCobranca: row.numero_instrumento_cobranca as string | null,
      situacao: row.situacao as string | null,
      valorBruto: row.valor_bruto as number | null,
      valorLiquido: row.valor_liquido as number | null,
      dataEmissao: row.data_emissao as string | null,
      dataPagamento: row.data_pagamento as string | null,
    }))),
    liquidacoes: (((liquidacoesResult.data || []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      contratoApiId: row.contrato_api_id as number | null,
      contratoNumero: row.contrato_numero as string | null,
      faturaId: row.fatura_id as number | null,
      numeroInstrumentoCobranca: row.numero_instrumento_cobranca as string | null,
      situacao: row.situacao as string | null,
      valorBruto: row.valor_bruto as number | null,
      valorLiquido: row.valor_liquido as number | null,
      dataEmissao: row.data_emissao as string | null,
      dataPagamento: row.data_pagamento as string | null,
      dataLiquidacao: row.data_liquidacao as string | null,
      processo: row.processo as string | null,
      empenhoNumero: row.empenho_numero as string | null,
    }))),
  };
}

export async function loadEnergiaCampusData(filters: EnergiaCampusFilters = {}): Promise<EnergiaCampusData> {
  const { data: latest, error: latestError } = await supabase
    .from('energia_import_runs')
    .select('id, source_file, imported_by_email, totals, imported_at')
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;
  if (!latest?.id) {
    return { latestRun: null, consumoFaturas: [], solarGeracao: [], contratos: [], contratoExecucoes: [], warnings: [], mercattoContratosApi: await loadMercattoContratosApiData() };
  }

  const latestRun = toImportRun(latest as EnergiaImportRunDbRow);

  let consumoQuery = supabase
    .from('energia_consumo_faturas')
    .select('*')
    .eq('import_run_id', latestRun.id)
    .order('competencia', { ascending: true });

  if (filters.startDate) consumoQuery = consumoQuery.gte('competencia', filters.startDate);
  if (filters.endDate) consumoQuery = consumoQuery.lte('competencia', filters.endDate);
  if (filters.fontes?.length) {
    const consumoFontes = filters.fontes.filter((fonte): fonte is Exclude<EnergiaFonte, 'solar'> => fonte !== 'solar');
    if (consumoFontes.length) consumoQuery = consumoQuery.in('fonte', consumoFontes);
  }

  let solarQuery = supabase
    .from('energia_solar_geracao')
    .select('*')
    .eq('import_run_id', latestRun.id)
    .order('ano', { ascending: true })
    .order('mes', { ascending: true, nullsFirst: true });

  if (filters.startDate) solarQuery = solarQuery.gte('data_referencia', filters.startDate);
  if (filters.endDate) solarQuery = solarQuery.lte('data_referencia', filters.endDate);

  const [consumoResult, solarResult, contratosResult, execucoesResult, mercattoContratosApi] = await Promise.all([
    consumoQuery,
    solarQuery,
    supabase.from('energia_contratos').select('*').eq('import_run_id', latestRun.id).order('fonte', { ascending: true }),
    supabase.from('energia_contrato_execucoes').select('*').eq('import_run_id', latestRun.id).order('parcela', { ascending: true }),
    loadMercattoContratosApiData(),
  ]);

  if (consumoResult.error) throw consumoResult.error;
  if (solarResult.error) throw solarResult.error;
  if (contratosResult.error) throw contratosResult.error;
  if (execucoesResult.error) throw execucoesResult.error;

  return {
    latestRun,
    consumoFaturas: ((consumoResult.data || []) as EnergiaConsumoDbRow[]).map(toConsumo),
    solarGeracao: ((solarResult.data || []) as EnergiaSolarDbRow[]).map(toSolar),
    contratos: ((contratosResult.data || []) as EnergiaContratoDbRow[]).map(toContrato),
    contratoExecucoes: ((execucoesResult.data || []) as EnergiaContratoExecucaoDbRow[]).map(toContratoExecucao),
    warnings: Array.isArray(latestRun.totals?.warnings) ? latestRun.totals.warnings as string[] : [],
    mercattoContratosApi,
  };
}
