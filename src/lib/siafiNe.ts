// Sem imports: este módulo também é consumido pela Edge Function (Deno) via caminho relativo.

/**
 * NE CCor completa = UG emitente (6) + gestão (5) + ano + "NE" + sequencial.
 * Ex.: 152711264352026NE000001 -> UG 152711. O número resumido (2026NE000001) se repete entre UGs.
 */
export const extractUgEmitenteDaNe = (numeroCompleto: string | null | undefined): string | null => {
  const match = String(numeroCompleto ?? '').trim().match(/^(\d+)\d{4}NE\d+$/i);
  if (!match || match[1].length < 6) return null;
  return match[1].slice(0, 6);
};

export type NesIgnoradas = {
  total: number;
  /** UG -> quantidade de linhas ignoradas. */
  porUg: Record<string, number>;
  /** UG fora do cadastro de campi do IFRN. */
  ugDesconhecida: number;
  /** UG válida, mas sem permissão para gravar fora do campus da sessão. */
  semPermissao: number;
};

/**
 * Separa as linhas por campus de destino (UG emitente da NE). Sem UG no número (formato resumido),
 * a linha vai para o campus padrão. Com `apenasCampusPadrao`, as demais UGs são ignoradas e contadas.
 */
export function agruparNesPorCampus<T extends { numeroCompleto: string }>(
  rows: T[],
  opts: {
    campusPadrao: string;
    isCampusValido: (uasg: string) => boolean;
    apenasCampusPadrao?: boolean;
  },
): { porCampus: Map<string, T[]>; ignoradas: NesIgnoradas } {
  const porCampus = new Map<string, T[]>();
  const ignoradas: NesIgnoradas = { total: 0, porUg: {}, ugDesconhecida: 0, semPermissao: 0 };

  const ignorar = (ug: string, motivo: 'ugDesconhecida' | 'semPermissao') => {
    ignoradas.total += 1;
    ignoradas[motivo] += 1;
    ignoradas.porUg[ug] = (ignoradas.porUg[ug] ?? 0) + 1;
  };

  rows.forEach((row) => {
    const campus = extractUgEmitenteDaNe(row.numeroCompleto) ?? opts.campusPadrao;

    if (!opts.isCampusValido(campus)) {
      ignorar(campus, 'ugDesconhecida');
      return;
    }
    if (opts.apenasCampusPadrao && campus !== opts.campusPadrao) {
      ignorar(campus, 'semPermissao');
      return;
    }

    const lista = porCampus.get(campus);
    if (lista) lista.push(row);
    else porCampus.set(campus, [row]);
  });

  return { porCampus, ignoradas };
}

type NeComValores = {
  numeroCompleto: string;
  isRap: boolean;
  rapSaldoOnly?: boolean;
  valorEmpenhado: number;
  valorLiquidadoOficial: number;
  valorPagoOficial: number;
  valorLiquidadoAPagar: number;
  rapInscrito: number;
  rapALiquidar: number;
  rapLiquidado: number;
  rapPago: number;
  rapAPagar: number;
};

const centavos = (valor: number) => Math.round(valor * 100) / 100;

const CAMPOS_SOMADOS = [
  'valorEmpenhado',
  'valorLiquidadoOficial',
  'valorPagoOficial',
  'valorLiquidadoAPagar',
  'rapInscrito',
  'rapALiquidar',
  'rapLiquidado',
  'rapPago',
  'rapAPagar',
] as const;

/**
 * O relatório traz mais de uma linha por NE: a principal e linhas de ajuste (empenhado 0, "liquidado a pagar"
 * negativo e o mesmo valor em "pago"). Gravar linha a linha deixa o resultado depender da ordem do arquivo
 * (a linha de ajuste, vindo por último, zerava o empenhado). Aqui as linhas da mesma NE (UG + número) são somadas;
 * "liquidado a pagar" das NEs mescladas do exercício é refeito como liquidado - pago, pois os parsers descartam
 * valores entre parênteses. Linhas de saldo RAP (rapSaldoOnly) não são somadas: a última prevalece, como antes.
 */
export function mesclarNesDuplicadas<T extends NeComValores>(rows: T[]): T[] {
  const porNe = new Map<string, { row: T; linhas: number }>();

  rows.forEach((row) => {
    const atual = porNe.get(row.numeroCompleto);
    if (!atual) {
      porNe.set(row.numeroCompleto, { row: { ...row }, linhas: 1 });
      return;
    }

    if (row.rapSaldoOnly) {
      atual.row = { ...row };
      return;
    }

    atual.linhas += 1;
    const acumulada = atual.row as Record<string, unknown>;
    const nova = row as Record<string, unknown>;
    CAMPOS_SOMADOS.forEach((campo) => {
      acumulada[campo] = centavos(Number(acumulada[campo] ?? 0) + Number(nova[campo] ?? 0));
    });
    Object.keys(nova).forEach((campo) => {
      if ((CAMPOS_SOMADOS as readonly string[]).includes(campo)) return;
      const vazio = acumulada[campo] === undefined || acumulada[campo] === null || acumulada[campo] === '';
      if (vazio && nova[campo] !== undefined && nova[campo] !== null && nova[campo] !== '') acumulada[campo] = nova[campo];
    });
  });

  return Array.from(porNe.values()).map(({ row, linhas }) => {
    if (linhas > 1 && !row.isRap && !row.rapSaldoOnly) {
      return { ...row, valorLiquidadoAPagar: centavos(row.valorLiquidadoOficial - row.valorPagoOficial) };
    }
    return row;
  });
}
