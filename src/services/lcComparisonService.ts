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

    const preferred =
      lcList.find((x) => onlyDigits(x.contaBancaria) && onlyDigits(x.contaBancaria) === onlyDigits(b.conta)) ||
      lcList.find((x) => onlyDigits(x.contaBancaria)) ||
      lcList[0];

    const contaLcDigits = onlyDigits(preferred.contaBancaria);
    const contaPdfDigits = onlyDigits(b.conta);

    if (!contaLcDigits) {
      pend.push({
        cpf: b.cpf,
        nome: b.nome,
        contaPdf: b.conta,
        arquivoPdf: b.sourceFile,
        status: 'sem_conta_lc',
        contaLc: preferred.contaBancaria || '',
        nomeLc: preferred.favorecidoNome || '',
      });
      continue;
    }

    if (contaPdfDigits && contaPdfDigits !== contaLcDigits) {
      pend.push({
        cpf: b.cpf,
        nome: b.nome,
        contaPdf: b.conta,
        arquivoPdf: b.sourceFile,
        status: 'conta_divergente',
        contaLc: preferred.contaBancaria || '',
        nomeLc: preferred.favorecidoNome || '',
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
