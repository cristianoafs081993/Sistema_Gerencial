import type { LCRegistro } from '@/services/lcImportService';
import type { BolsistaPdfRecord } from '@/services/bolsistasPdfService';

export type PendenciaStatus = 'sem_cadastro_lc' | 'sem_conta_lc' | 'conta_divergente';

export interface ComparacaoBolsista {
  cpf: string;
  nome: string;
  contaPdf: string;
  arquivoPdf: string;
  status: PendenciaStatus;
  contaLc: string;
  nomeLc: string;
}

function onlyDigits(value: string) {
  return (value || '').replace(/\D/g, '');
}

function buildContaLcResumo(lcList: LCRegistro[]): string {
  const contas = Array.from(
    new Set(
      lcList
        .map((row) => row.contaBancaria || '')
        .filter(Boolean),
    ),
  );

  return contas.join(', ');
}

function buildNomeLcResumo(lcList: LCRegistro[]): string {
  const nomes = Array.from(
    new Set(
      lcList
        .map((row) => row.favorecidoNome || '')
        .filter(Boolean),
    ),
  );

  return nomes.join(', ');
}

export function compararBolsistasComLC(
  bolsistas: BolsistaPdfRecord[],
  lcRows: LCRegistro[],
): ComparacaoBolsista[] {
  const lcByDoc = new Map<string, LCRegistro[]>();

  for (const row of lcRows) {
    const doc = onlyDigits(row.favorecidoDocumento);
    if (!doc) continue;
    const arr = lcByDoc.get(doc) || [];
    arr.push(row);
    lcByDoc.set(doc, arr);
  }

  const pend: ComparacaoBolsista[] = [];

  for (const b of bolsistas) {
    const doc = onlyDigits(b.cpf);
    const lcList = lcByDoc.get(doc) || [];

    if (!lcList.length) {
      pend.push({
        cpf: b.cpf,
        nome: b.nome,
        contaPdf: b.conta,
        arquivoPdf: b.sourceFile,
        status: 'sem_cadastro_lc',
        contaLc: '',
        nomeLc: '',
      });
      continue;
    }

    const matchingRow = lcList.find(
      (x) => onlyDigits(x.contaBancaria) && onlyDigits(x.contaBancaria) === onlyDigits(b.conta),
    );
    const contaLcDigitsList = lcList
      .map((x) => onlyDigits(x.contaBancaria))
      .filter(Boolean);
    const contaPdfDigits = onlyDigits(b.conta);
    const contaLcResumo = buildContaLcResumo(lcList);
    const nomeLcResumo = buildNomeLcResumo(lcList);

    if (matchingRow) {
      continue;
    }

    if (!contaLcDigitsList.length) {
      pend.push({
        cpf: b.cpf,
        nome: b.nome,
        contaPdf: b.conta,
        arquivoPdf: b.sourceFile,
        status: 'sem_conta_lc',
        contaLc: contaLcResumo,
        nomeLc: nomeLcResumo,
      });
      continue;
    }

    if (contaPdfDigits) {
      pend.push({
        cpf: b.cpf,
        nome: b.nome,
        contaPdf: b.conta,
        arquivoPdf: b.sourceFile,
        status: 'conta_divergente',
        contaLc: contaLcResumo,
        nomeLc: nomeLcResumo,
      });
    }
  }

  const unique = new Map<string, ComparacaoBolsista>();
  for (const item of pend) {
    const key = `${onlyDigits(item.cpf)}|${item.status}|${item.arquivoPdf}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values());
}
