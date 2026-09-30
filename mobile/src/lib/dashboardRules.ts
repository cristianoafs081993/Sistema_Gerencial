/**
 * Cálculos do Dashboard orçamentário — espelham o web (src/pages/Dashboard.tsx).
 * Funções puras, sem rede. Nunca inventam valores: sem dados, o resultado é zero e `semDados` é verdadeiro.
 */

export type PtresOpcao = { code: string; name: string; shortLabel?: string };

export type AtividadeRow = { valor_total?: number | string | null; origem_recurso?: string | null };
export type EmpenhoRow = {
  valor?: number | string | null;
  valor_liquidado?: number | string | null;
  valor_liquidado_oficial?: number | string | null;
  valor_pago_oficial?: number | string | null;
  data_empenho?: string | null;
  origem_recurso?: string | null;
};
export type DescentralizacaoRow = { valor?: number | string | null; origem_recurso?: string | null };
/** Saldo oficial por PTRES da conta de descentralizações (tabela descentralizacoes_conta_saldos). */
export type ContaSaldoRow = { ptres?: string | null; valor?: number | string | null };
export type CreditoRow = { ptres?: string | null; descricao?: string | null; valor?: number | string | null };

export type SerieMensal = { mes: string; empenhado: number; liquidado: number };

export type DashboardMetrics = {
  planejado: number;
  totalAtividades: number;
  descentralizado: number;
  aDescentralizar: number;
  empenhado: number;
  /** Crédito oficial do SIAFI (relatório web); sem relatório usa o saldo descentralizado − empenhado. */
  creditoDisponivel: number;
  creditoOficial: boolean;
  liquidado: number;
  pago: number;
  aPagar: number;
  totalEmpenhos: number;
  /** Razões em % (0–100+). */
  pctExecutado: number; // empenhado / planejado
  pctDescentralizado: number; // descentralizado / planejado
  pctEmpenhadoDescentralizado: number; // empenhado / descentralizado
  pctLiquidadoDescentralizado: number; // liquidado / descentralizado
  pctLiquidadoEmpenhado: number; // liquidado / empenhado
  pctPagoLiquidado: number; // pago / liquidado
  pctCreditoDescentralizado: number;
  mensal: SerieMensal[];
  semDados: boolean;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Origem 230446 (PNAE) fica fora da soma global, como no web. */
export function origemIgnoradaNoEmpenhado(origem?: string | null): boolean {
  return Boolean(origem && origem.trim().includes('230446'));
}

export function origemCorrespondeAoPtres(origem?: string | null, ptres?: string): boolean {
  if (!ptres || ptres === 'all') return true;
  if (!origem) return false;
  const o = String(origem).trim().toLowerCase();
  const t = String(ptres).trim().toLowerCase();
  return o === t || o.startsWith(`${t} `) || o.startsWith(`${t}-`) || o.startsWith(`${t}/`);
}

export function codigoPtresDaOrigem(origem?: string | null): string | null {
  if (!origem) return null;
  const code = String(origem).split(/[\s\-/]/)[0];
  return /^\d+$/.test(code) ? code : null;
}

const num = (valor: unknown): number => Number(valor) || 0;
const soma = <T,>(lista: T[], pega: (item: T) => unknown): number => lista.reduce((acc, item) => acc + num(pega(item)), 0);
const razao = (parte: number, total: number): number => (total > 0 ? (parte / total) * 100 : 0);
const arredonda1 = (valor: number): number => Math.round(valor * 10) / 10;

export type EntradaDashboard = {
  atividades: AtividadeRow[];
  empenhos: EmpenhoRow[];
  descentralizacoes: DescentralizacaoRow[];
  creditos: CreditoRow[];
  /** Quando há saldos da conta, eles são o descentralizado oficial (como no web). */
  contaSaldos?: ContaSaldoRow[];
  ptres?: string;
  /** Até qual mês (0–11) exibir a série mensal; padrão: mês atual. */
  ateMes?: number;
};

export function calcularDashboard(entrada: EntradaDashboard): DashboardMetrics {
  const filtrado = Boolean(entrada.ptres && entrada.ptres !== 'all');
  const ptres = entrada.ptres;

  const atividades = filtrado ? entrada.atividades.filter((a) => origemCorrespondeAoPtres(a.origem_recurso, ptres)) : entrada.atividades;
  const empenhos = filtrado ? entrada.empenhos.filter((e) => origemCorrespondeAoPtres(e.origem_recurso, ptres)) : entrada.empenhos;
  const descentralizacoes = filtrado
    ? entrada.descentralizacoes.filter((d) => origemCorrespondeAoPtres(d.origem_recurso, ptres))
    : entrada.descentralizacoes.filter((d) => !origemIgnoradaNoEmpenhado(d.origem_recurso));

  let empenhado = 0;
  let liquidado = 0;
  let pago = 0;
  const ateMes = entrada.ateMes ?? new Date().getMonth();
  const mensal: SerieMensal[] = MESES.map((mes) => ({ mes, empenhado: 0, liquidado: 0 }));

  for (const row of empenhos) {
    const valor = num(row.valor);
    const liq = num(row.valor_liquidado_oficial ?? row.valor_liquidado);
    const pag = num(row.valor_pago_oficial);

    if (filtrado || !origemIgnoradaNoEmpenhado(row.origem_recurso)) empenhado += valor;
    liquidado += liq;
    pago += pag;

    const mes = /^\d{4}-(\d{2})/.exec(row.data_empenho ?? '');
    if (mes) {
      const idx = Number(mes[1]) - 1;
      if (idx >= 0 && idx < 12) {
        mensal[idx].empenhado += valor;
        mensal[idx].liquidado += liq;
      }
    }
  }

  const planejado = soma(atividades, (a) => a.valor_total);
  // Descentralizado oficial = saldos da conta por PTRES (web: buildDescentralizacaoSummaryRows). Sem a conta,
  // usa a soma das linhas de descentralização.
  const contaSaldos = entrada.contaSaldos ?? [];
  const contaAtiva = filtrado
    ? contaSaldos.filter((c) => origemCorrespondeAoPtres(c.ptres, ptres))
    : contaSaldos.filter((c) => !origemIgnoradaNoEmpenhado(c.ptres));
  const descentralizado = contaSaldos.length > 0 ? soma(contaAtiva, (c) => c.valor) : soma(descentralizacoes, (d) => d.valor);

  const creditosAtivos = filtrado ? entrada.creditos.filter((c) => origemCorrespondeAoPtres(c.ptres, ptres)) : entrada.creditos;
  const creditoOficial = entrada.creditos.length > 0;
  const creditoDisponivel = creditoOficial ? soma(creditosAtivos, (c) => c.valor) : Math.max(0, descentralizado - empenhado);

  return {
    planejado,
    totalAtividades: atividades.length,
    descentralizado,
    aDescentralizar: planejado - descentralizado,
    empenhado,
    creditoDisponivel,
    creditoOficial,
    liquidado,
    pago,
    aPagar: Math.max(0, liquidado - pago),
    totalEmpenhos: empenhos.length,
    pctExecutado: arredonda1(razao(empenhado, planejado)),
    pctDescentralizado: arredonda1(razao(descentralizado, planejado)),
    pctEmpenhadoDescentralizado: arredonda1(razao(empenhado, descentralizado)),
    pctLiquidadoDescentralizado: arredonda1(razao(liquidado, descentralizado)),
    pctLiquidadoEmpenhado: arredonda1(razao(liquidado, empenhado)),
    pctPagoLiquidado: arredonda1(razao(pago, liquidado)),
    pctCreditoDescentralizado: arredonda1(razao(creditoDisponivel, descentralizado)),
    mensal: mensal.slice(0, Math.max(0, Math.min(11, ateMes)) + 1),
    semDados: atividades.length === 0 && empenhos.length === 0 && descentralizacoes.length === 0 && contaSaldos.length === 0,
  };
}

const PRIORIDADE = ['231796', '261941', '231802', '231798', '171166', '260296', '230446'];

/** Monta a lista de PTRES disponíveis a partir de todas as fontes, com os principais primeiro. */
export function montarOpcoesPtres(
  fontes: { origens: (string | null | undefined)[]; creditos: CreditoRow[] },
  nomesConhecidos: Record<string, string> = {},
): PtresOpcao[] {
  const codigos = new Set<string>();
  const descricoes: Record<string, string> = {};

  for (const credito of fontes.creditos) {
    if (credito.ptres) {
      codigos.add(credito.ptres);
      if (credito.descricao && !descricoes[credito.ptres]) descricoes[credito.ptres] = credito.descricao;
    }
  }
  for (const origem of fontes.origens) {
    const codigo = codigoPtresDaOrigem(origem);
    if (codigo) codigos.add(codigo);
  }

  const ordenados = Array.from(codigos)
    .filter((codigo) => /^\d+$/.test(codigo))
    .sort((a, b) => {
      const ia = PRIORIDADE.indexOf(a);
      const ib = PRIORIDADE.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

  return [
    { code: 'all', name: 'Todos os recursos (PTRES)', shortLabel: 'Todos' },
    ...ordenados.map((code) => ({ code, name: nomesConhecidos[code] || descricoes[code] || `PTRES ${code}`, shortLabel: code })),
  ];
}
