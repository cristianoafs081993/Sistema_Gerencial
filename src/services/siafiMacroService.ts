import type { BolsistaPdfRecord } from '@/services/bolsistasPdfService';
import type { LCRegistro } from '@/services/lcImportService';
import type { ComparacaoBolsista } from '@/services/lcComparisonService';

export interface SiafiMacroInputRow {
  cpf: string;
  bancoCodigo: string;
  agenciaCodigo: string;
  contaPagadora: string;
  contaFavorecido: string;
}

export interface SiafiMacroOptions {
  scriptName?: string;
  author?: string;
  chunkSize?: number;
  includeFirstConfirmationEnter?: boolean;
  mouseClickRow?: number;
  mouseClickCol?: number;
  codigoFinalCampo2?: string;
}

interface MacroRowsOptions {
  contaPagadoraPadrao?: string;
  bancoPadrao?: string;
  agenciaPadrao?: string;
}

const DEFAULT_SCRIPT_NAME = 'Lista de Credores';
const DEFAULT_AUTHOR = 'sistema-gerencial';
const DEFAULT_CHUNK_SIZE = 7;
const DEFAULT_CONTA_PAGADORA = (import.meta.env.VITE_SIAFI_CONTA_PAGADORA as string | undefined) || '408034';
const DEFAULT_CODIGO_FINAL_CAMPO2 = (import.meta.env.VITE_SIAFI_MACRO_CODIGO_FINAL as string | undefined) || '2200';

function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

function padLeft(value: string, size: number): string {
  const digits = onlyDigits(value);
  if (!digits) return ''.padStart(size, '0');
  return digits.length > size ? digits.slice(-size) : digits.padStart(size, '0');
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatCreationDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
}

export function buildSiafiContaPayload(row: SiafiMacroInputRow, codigoFinalCampo2 = DEFAULT_CODIGO_FINAL_CAMPO2): string {
  const banco = padLeft(row.bancoCodigo, 3);
  const agencia = padLeft(row.agenciaCodigo, 4);
  const contaPagadora = padLeft(row.contaPagadora, 6);
  const codigoFinal = padLeft(codigoFinalCampo2, 4);
  // Novo padrao SIAFI: banco(3) + agencia(4) + zeros(10) + conta pagadora(6) + zeros(4) + codigo final(4)
  return `${banco}${agencia}${'0'.repeat(10)}${contaPagadora}${'0'.repeat(4)}${codigoFinal}`;
}

function buildSiafiCampo3(row: SiafiMacroInputRow): string {
  return padLeft(row.contaFavorecido, 8);
}

export function buildSiafiMacroRowsFromComparison(
  bolsistas: BolsistaPdfRecord[],
  lcRows: LCRegistro[],
  options?: MacroRowsOptions,
): SiafiMacroInputRow[] {
  const lcByDoc = new Map<string, LCRegistro[]>();
  const contaPagadoraPadrao = options?.contaPagadoraPadrao || DEFAULT_CONTA_PAGADORA;

  for (const row of lcRows) {
    const doc = onlyDigits(row.favorecidoDocumento);
    if (!doc) continue;
    const arr = lcByDoc.get(doc) || [];
    arr.push(row);
    lcByDoc.set(doc, arr);
  }

  const selected: SiafiMacroInputRow[] = [];
  const seen = new Set<string>();

  for (const b of bolsistas) {
    const doc = onlyDigits(b.cpf);
    if (!doc) continue;

    const lcList = lcByDoc.get(doc) || [];
    if (!lcList.length) continue;

    const preferred =
      lcList.find((x) => onlyDigits(x.contaBancaria) && onlyDigits(x.contaBancaria) === onlyDigits(b.conta)) ||
      lcList.find((x) => onlyDigits(x.contaBancaria)) ||
      lcList[0];

    const contaLcDigits = onlyDigits(preferred.contaBancaria);
    const contaPdfDigits = onlyDigits(b.conta);

    if (!contaLcDigits) continue;
    if (contaPdfDigits && contaPdfDigits !== contaLcDigits) continue;

    const key = `${doc}|${contaLcDigits}`;
    if (seen.has(key)) continue;
    seen.add(key);

    selected.push({
      cpf: doc,
      bancoCodigo: preferred.bancoCodigo || '001',
      agenciaCodigo: preferred.agenciaCodigo || '0001',
      contaPagadora: contaPagadoraPadrao,
      contaFavorecido: contaLcDigits,
    });
  }

  return selected;
}

export function buildSiafiMacroRowsFromPendencias(
  pendencias: ComparacaoBolsista[],
  bolsistas: BolsistaPdfRecord[],
  options?: MacroRowsOptions,
): SiafiMacroInputRow[] {
  const contaPagadoraPadrao = options?.contaPagadoraPadrao || DEFAULT_CONTA_PAGADORA;
  const bancoPadrao = options?.bancoPadrao || '001';
  const agenciaPadrao = options?.agenciaPadrao || '0001';

  const bolsistaByDocAndFile = new Map<string, BolsistaPdfRecord>();
  for (const b of bolsistas) {
    const key = `${onlyDigits(b.cpf)}|${(b.sourceFile || '').toLowerCase()}`;
    if (!bolsistaByDocAndFile.has(key)) {
      bolsistaByDocAndFile.set(key, b);
    }
  }

  const selected: SiafiMacroInputRow[] = [];
  const seen = new Set<string>();

  for (const p of pendencias) {
    const cpf = onlyDigits(p.cpf);
    if (!cpf) continue;

    const bolsista = bolsistaByDocAndFile.get(`${cpf}|${(p.arquivoPdf || '').toLowerCase()}`);
    const contaFavorecido = onlyDigits(p.contaPdf || bolsista?.conta || p.contaLc || '');
    if (!contaFavorecido) continue;

    const bancoCodigo = onlyDigits(bolsista?.banco || '') || bancoPadrao;
    const agenciaCodigo = onlyDigits(bolsista?.agencia || '') || agenciaPadrao;
    const dedupeKey = `${cpf}|${bancoCodigo}|${agenciaCodigo}|${contaFavorecido}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    selected.push({
      cpf,
      bancoCodigo,
      agenciaCodigo,
      contaPagadora: contaPagadoraPadrao,
      contaFavorecido,
    });
  }

  return selected;
}

export function buildSiafiListaCredoresMacro(
  rows: SiafiMacroInputRow[],
  options?: SiafiMacroOptions,
): string {
  if (!rows.length) throw new Error('Nenhum registro apto para gerar macro.');

  const scriptName = options?.scriptName || DEFAULT_SCRIPT_NAME;
  const author = options?.author || DEFAULT_AUTHOR;
  const chunkSize = Math.max(1, options?.chunkSize || DEFAULT_CHUNK_SIZE);
  const includeFirstConfirmationEnter = options?.includeFirstConfirmationEnter ?? true;
  const mouseClickRow = options?.mouseClickRow ?? 8;
  const mouseClickCol = options?.mouseClickCol ?? 12;
  const codigoFinalCampo2 = options?.codigoFinalCampo2 || DEFAULT_CODIGO_FINAL_CAMPO2;

  const breakDefault = '[enter]s[enter][erinp]';
  const breakFirst = includeFirstConfirmationEnter ? '[enter]s[enter][enter][erinp]' : breakDefault;

  let firstBreakApplied = false;
  const inputActions = rows.map((row, index) => {
    let line = `${padLeft(row.cpf, 11)}[tab]${buildSiafiContaPayload(row, codigoFinalCampo2)}[tab]${buildSiafiCampo3(row)}`;
    const shouldBreak = (index + 1) % chunkSize === 0 && index < rows.length - 1;

    if (shouldBreak) {
      if (!firstBreakApplied) {
        line += breakFirst;
        firstBreakApplied = true;
      } else {
        line += breakDefault;
      }
    }

    return `            <input value="${escapeXmlAttribute(line)}" row="0" col="0" movecursor="true" xlatehostkeys="true" encrypted="false" />`;
  });

  const creationDate = formatCreationDate(new Date());

  return `<HAScript name="${escapeXmlAttribute(scriptName)}" description="" timeout="60000" pausetime="300" promptall="true" blockinput="false" author="${escapeXmlAttribute(author)}" creationdate="${creationDate}" supressclearevents="false" usevars="false" ignorepauseforenhancedtn="true" delayifnotenhancedtn="0" ignorepausetimeforenhancedtn="true">

    <screen name="Tela1" entryscreen="true" exitscreen="true" transient="false">
        <description >
            <oia status="NOTINHIBITED" optional="false" invertmatch="false" />
        </description>
        <actions>
            <mouseclick row="${mouseClickRow}" col="${mouseClickCol}" />
${inputActions.join('\n')}
        </actions>
        <nextscreens timeout="0" >
        </nextscreens>
    </screen>
</HAScript>
`;
}

export function downloadSiafiMacroFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
