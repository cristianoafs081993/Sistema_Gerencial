import type { BolsistaPdfRecord } from './bolsistasPdfService';
import type { LCRegistro } from './lcImportService';
import type { SiafiMacroInputRow } from './siafiMacroService';
import { normalizeLcAccount } from '@/utils/lcAccount';
import { resolveBancoCodigo } from '@/utils/bancoCodigo';

export type LcAccountOption = {
  bancoCodigo: string;
  agenciaCodigo: string;
  contaBancaria: string;
};

export type LcGridRowStatus = 'ok' | 'aluno_nao_encontrado' | 'conta_nao_encontrada';

export type LcGridRow = {
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
  status: LcGridRowStatus;
  lcAccounts: LcAccountOption[];
  originalLcAccounts: LcAccountOption[];
  /** Dados lidos de pagina escaneada por OCR: exigem conferencia manual. */
  ocr?: boolean;
  /** Dados extraidos por IA (o script nao leu o documento): exigem conferencia manual. */
  ia?: boolean;
};

const DEFAULT_BANCO = '001';
const DEFAULT_AGENCIA = '0001';

const onlyDigits = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');

/** Codigo do banco do documento: aceita codigo ou nome ("Banco do Brasil S.A."); sem reconhecimento, 001. */
function bancoFromDocument(value: string | null | undefined): string {
  return resolveBancoCodigo(value) || DEFAULT_BANCO;
}

/**
 * Monta a grade da LC na mesma ordem dos bolsistas do documento, cruzando cada CPF com as contas
 * da Lista de Credores carregada.
 */
export function buildLcGridRows(
  bolsistas: BolsistaPdfRecord[],
  lcRows: LCRegistro[],
  contaPagadora: string,
): LcGridRow[] {
  return bolsistas.map((b) => {
    const doc = onlyDigits(b.cpf);
    const lcList = lcRows.filter((r) => onlyDigits(r.favorecidoDocumento) === doc);

    const lcAccounts = lcList
      .map((r) => ({
        bancoCodigo: onlyDigits(r.bancoCodigo) || DEFAULT_BANCO,
        agenciaCodigo: onlyDigits(r.agenciaCodigo) || DEFAULT_AGENCIA,
        contaBancaria: normalizeLcAccount(r.contaBancaria) || '',
      }))
      .filter((acc) => acc.contaBancaria);

    const pdfContaNormalized = normalizeLcAccount(b.conta);
    const matchedLcAcc = lcAccounts.find((acc) => acc.contaBancaria === pdfContaNormalized);
    const bancoPdf = bancoFromDocument(b.banco);

    let status: LcGridRowStatus = 'ok';
    let selectedBanco = bancoPdf;
    let selectedAgencia = onlyDigits(b.agencia) || DEFAULT_AGENCIA;
    let selectedConta = pdfContaNormalized;

    if (lcList.length === 0) {
      status = 'aluno_nao_encontrado';
    } else if (!matchedLcAcc) {
      // Mantem a conta do documento selecionada; a LC tem outras contas disponiveis.
      status = 'conta_nao_encontrada';
    } else {
      selectedBanco = matchedLcAcc.bancoCodigo;
      selectedAgencia = matchedLcAcc.agenciaCodigo;
      selectedConta = matchedLcAcc.contaBancaria;
    }

    return {
      id: `${doc}-${b.sourceFile}`,
      cpf: doc,
      nome: b.nome,
      bancoPdf,
      agenciaPdf: onlyDigits(b.agencia) || DEFAULT_AGENCIA,
      contaPdf: pdfContaNormalized,
      valor: b.valor,
      selectedBanco: onlyDigits(selectedBanco) || DEFAULT_BANCO,
      selectedAgencia: onlyDigits(selectedAgencia) || DEFAULT_AGENCIA,
      selectedConta: normalizeLcAccount(selectedConta),
      contaPagadora,
      status,
      lcAccounts,
      originalLcAccounts: lcAccounts,
      ...(b.ocr ? { ocr: true } : {}),
      ...(b.ia ? { ia: true } : {}),
    };
  });
}

/** Linhas aptas para a macro SIAFI: todas, exceto alunos ausentes da LC. */
export function buildMacroRows(workRows: LcGridRow[]): SiafiMacroInputRow[] {
  return workRows
    .filter((row) => row.status !== 'aluno_nao_encontrado')
    .map((row) => ({
      cpf: row.cpf,
      bancoCodigo: row.selectedBanco,
      agenciaCodigo: row.selectedAgencia,
      contaPagadora: row.contaPagadora,
      contaFavorecido: row.selectedConta,
      valor: row.valor,
    }));
}

/** Quantas linhas da grade ficaram com pendencia de cruzamento com a LC. */
export function countLcGridPendencias(rows: LcGridRow[]): number {
  return rows.filter((row) => row.status !== 'ok').length;
}
