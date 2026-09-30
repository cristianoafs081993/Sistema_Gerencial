/**
 * Regras de Contratos do app — espelham o web (src/pages/Contratos.tsx, src/utils/contratosApiHistorico.ts
 * e src/utils/contratosApiStatus.ts). Funções puras, sem rede: fáceis de testar.
 */

export const DIAS_A_VENCER = 90;
export const DIAS_EXPIRADO_VISIVEL = 120;

const MS_DIA = 24 * 60 * 60 * 1000;

export type StatusVigencia = 'vigente' | 'a_vencer' | 'expirado';

export type VigenciaInfo = {
  status: StatusVigencia;
  /** Dias até o fim (negativo se já terminou); null se não há data de término. */
  dias: number | null;
  /** Texto curto para exibir, ex.: "Vence em 45 dias", "Expirou há 12 dias". */
  texto: string;
  /** Percentual do prazo já decorrido (0–100); 0 se faltam datas. */
  percentualDecorrido: number;
};

function parseIsoDate(value?: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const time = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(time) ? null : time;
}

function hojeUtc(hoje: Date): number {
  return Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Situação da vigência. `situacaoDerivada` é a coluna calculada no servidor (igual ao web): quando é
 * `false` o contrato já foi encerrado (rescisão/término), mesmo que a data final ainda não tenha chegado.
 */
export function calcularVigencia(
  inicioIso: string | null | undefined,
  fimIso: string | null | undefined,
  situacaoDerivada: boolean | null | undefined,
  hoje: Date = new Date(),
): VigenciaInfo {
  const fim = parseIsoDate(fimIso);
  const inicio = parseIsoDate(inicioIso);
  const agora = hojeUtc(hoje);

  if (fim === null) {
    return {
      status: situacaoDerivada === false ? 'expirado' : 'vigente',
      dias: null,
      texto: situacaoDerivada === false ? 'Encerrado' : 'Sem data de término',
      percentualDecorrido: 0,
    };
  }

  const dias = Math.round((fim - agora) / MS_DIA);
  let percentual = 0;
  if (inicio !== null && fim > inicio) {
    percentual = Math.min(100, Math.max(0, Math.round(((agora - inicio) / (fim - inicio)) * 100)));
  }

  if (dias < 0 || situacaoDerivada === false) {
    const atraso = Math.abs(dias);
    return {
      status: 'expirado',
      dias,
      texto: dias < 0 ? `Expirou há ${plural(atraso, 'dia', 'dias')}` : 'Encerrado',
      percentualDecorrido: 100,
    };
  }

  if (dias <= DIAS_A_VENCER) {
    return {
      status: 'a_vencer',
      dias,
      texto: dias === 0 ? 'Vence hoje' : `Vence em ${plural(dias, 'dia', 'dias')}`,
      percentualDecorrido: percentual,
    };
  }

  const meses = Math.floor(dias / 30);
  return {
    status: 'vigente',
    dias,
    texto: meses >= 2 ? `${meses} meses restantes` : `${plural(dias, 'dia restante', 'dias restantes')}`,
    percentualDecorrido: percentual,
  };
}

/**
 * Mantém na lista o que o web mostra por padrão: vigentes (situação derivada verdadeira) e os que
 * expiraram nos últimos 120 dias.
 */
export function contratoVisivelPorPadrao(
  fimIso: string | null | undefined,
  situacaoDerivada: boolean | null | undefined,
  hoje: Date = new Date(),
): boolean {
  if (situacaoDerivada === true) return true;
  const fim = parseIsoDate(fimIso);
  if (fim === null) return false;
  const agora = hojeUtc(hoje);
  return fim < agora && fim >= agora - DIAS_EXPIRADO_VISIVEL * MS_DIA;
}

export type TermoValor = {
  api_historico_id?: number | null;
  data_assinatura?: string | null;
  data_publicacao?: string | null;
  vigencia_inicio?: string | null;
  valor_inicial?: number | string | null;
};

const toCents = (value: number) => Math.round(value * 100);

/** Valor total do contrato = soma do valor inicial de todos os termos (contrato + aditivos), como no web. */
export function valorTotalDoHistorico(historico: TermoValor[]): number {
  return historico.reduce((soma, termo) => soma + toCents(Number(termo.valor_inicial) || 0), 0) / 100;
}

/** Fatura em aberto = situação diferente de "pago" e "siafi apropriado" (regra do web). */
export function faturaPendente(situacao?: string | null): boolean {
  const normalizada = (situacao || '').trim().toLowerCase();
  return normalizada !== 'pago' && normalizada !== 'siafi apropriado';
}

type Ordenavel = { status: StatusVigencia; dias: number | null; temFaturaPendente: boolean };

/**
 * Ordem da lista: a vencer (mais urgente primeiro), vigentes (vence antes primeiro) e expirados
 * (expirou mais recentemente primeiro).
 */
export function compararContratos(a: Ordenavel, b: Ordenavel): number {
  const peso: Record<StatusVigencia, number> = { a_vencer: 0, vigente: 1, expirado: 2 };
  if (peso[a.status] !== peso[b.status]) return peso[a.status] - peso[b.status];

  const diasA = a.dias ?? Number.MAX_SAFE_INTEGER;
  const diasB = b.dias ?? Number.MAX_SAFE_INTEGER;
  if (a.status === 'expirado') return diasB - diasA; // -5 (recente) antes de -100
  if (diasA !== diasB) return diasA - diasB;
  return Number(b.temFaturaPendente) - Number(a.temFaturaPendente);
}
