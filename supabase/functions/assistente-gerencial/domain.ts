export type AssistantIntent =
  | 'descentralizacoes'
  | 'contratos'
  | 'empenhos_execucao'
  | 'creditos_saldos'
  | 'pfs_conciliacao'
  | 'geral';

export type ContextSection = {
  label: string;
  rows: unknown[];
  count: number | null;
  warning?: string;
};

export type GerencialAnalysis = {
  intent: AssistantIntent;
  summary: Record<string, unknown>;
  evidence: Record<string, unknown>;
  limitations: string[];
};

type DescentralizacaoRow = {
  dimensao?: string | null;
  nota_credito?: string | null;
  operacao_tipo?: string | null;
  origem_recurso?: string | null;
  natureza_despesa?: string | null;
  plano_interno?: string | null;
  data_emissao?: string | null;
  descricao?: string | null;
  valor?: number | string | null;
};

type ContratoApiRow = {
  id?: string | null;
  numero?: string | null;
  fornecedor_nome?: string | null;
  unidade_codigo?: string | number | null;
  unidade_origem_codigo?: string | number | null;
  objeto?: string | null;
  processo?: string | null;
  vigencia_inicio_derivada?: string | null;
  vigencia_fim_derivada?: string | null;
  valor_global?: number | string | null;
  valor_acumulado?: number | string | null;
  situacao_derivada?: boolean | null;
  campus_scope_reason?: string | null;
};

type ContratoApiEmpenhoRow = {
  contrato_api_id?: string | null;
  numero?: string | null;
  unidade_gestora?: string | number | null;
  valor_empenhado?: number | string | null;
  valor_a_liquidar?: number | string | null;
  valor_liquidado?: number | string | null;
  valor_pago?: number | string | null;
  rp_inscrito?: number | string | null;
  rp_a_liquidar?: number | string | null;
  rp_liquidado?: number | string | null;
  rp_pago?: number | string | null;
  rp_a_pagar?: number | string | null;
};

type ContratoApiFaturaRow = {
  contrato_api_id?: string | null;
  situacao?: string | null;
  valor_bruto?: number | string | null;
  valor_liquido?: number | string | null;
  data_emissao?: string | null;
  data_pagamento?: string | null;
};

type EmpenhoRow = {
  numero?: string | null;
  descricao?: string | null;
  valor?: number | string | null;
  tipo?: string | null;
  plano_interno?: string | null;
  origem_recurso?: string | null;
  natureza_despesa?: string | null;
  favorecido_nome?: string | null;
  valor_liquidado?: number | string | null;
  valor_liquidado_oficial?: number | string | null;
  valor_pago_oficial?: number | string | null;
  saldo_rap_oficial?: number | string | null;
  valor_liquidado_a_pagar?: number | string | null;
  rap_inscrito?: number | string | null;
  rap_a_liquidar?: number | string | null;
  rap_liquidado?: number | string | null;
  rap_pago?: number | string | null;
};

type CreditoDisponivelRow = {
  ptres?: string | null;
  metrica?: string | null;
  valor?: number | string | null;
  updated_at?: string | null;
};

const CAMPUS_UG = '158366';
const REITORIA_UG = '158155';

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactText(value: unknown, maxLength = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function asRows<T>(sections: ContextSection[], label: string) {
  return (sections.find((section) => section.label === label)?.rows || []) as T[];
}

function sectionCount(sections: ContextSection[], label: string) {
  const section = sections.find((item) => item.label === label);
  return section?.count ?? section?.rows.length ?? 0;
}

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

function sortedEntries(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))
    .slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function detectAssistantIntent(message: string): AssistantIntent {
  const text = normalizeText(message);

  if (/descentraliz|reitoria|ptres|plano interno|\bpi\b|nota de credito|\bnc\b/.test(text)) {
    return 'descentralizacoes';
  }

  if (/contrato|fornecedor|vigencia|fatura|comprasnet|terceiriz|mercatto|caern/.test(text)) {
    return 'contratos';
  }

  if (/credito disponivel|saldo disponivel|saldo por ptres|fonte/.test(text)) {
    return 'creditos_saldos';
  }

  if (/pf|programacao financeira|conciliacao|conciliar/.test(text)) {
    return 'pfs_conciliacao';
  }

  if (/empenho|liquid|pagamento|rap|restos a pagar|execucao/.test(text)) {
    return 'empenhos_execucao';
  }

  return 'geral';
}

export function summarizeDescentralizacoes(rows: DescentralizacaoRow[]) {
  const byPtres = new Map<string, {
    ptres: string;
    total: number;
    count: number;
    byPi: Map<string, number>;
    byNatureza: Map<string, number>;
    byDimensao: Map<string, number>;
  }>();
  const byNatureza = new Map<string, number>();
  const byDimensao = new Map<string, number>();
  const notes = new Set<string>();
  let total = 0;
  let entradas = 0;
  let abatimentos = 0;
  let minDate = '';
  let maxDate = '';

  rows.forEach((row) => {
    const value = toNumber(row.valor);
    const ptres = compactText(row.origem_recurso || 'PTRES nao informado', 40);
    const pi = compactText(row.plano_interno || 'PI nao informado', 60);
    const natureza = compactText(row.natureza_despesa || 'Natureza nao informada', 80);
    const dimensao = compactText(row.dimensao || 'Dimensao nao informada', 80);
    const date = String(row.data_emissao || '').slice(0, 10);

    total += value;
    if (value >= 0) entradas += value;
    if (value < 0) abatimentos += value;
    if (row.nota_credito) notes.add(String(row.nota_credito));
    if (date && (!minDate || date < minDate)) minDate = date;
    if (date && (!maxDate || date > maxDate)) maxDate = date;

    if (!byPtres.has(ptres)) {
      byPtres.set(ptres, {
        ptres,
        total: 0,
        count: 0,
        byPi: new Map(),
        byNatureza: new Map(),
        byDimensao: new Map(),
      });
    }

    const bucket = byPtres.get(ptres)!;
    bucket.total += value;
    bucket.count += 1;
    addToMap(bucket.byPi, pi, value);
    addToMap(bucket.byNatureza, natureza, value);
    addToMap(bucket.byDimensao, dimensao, value);
    addToMap(byNatureza, natureza, value);
    addToMap(byDimensao, dimensao, value);
  });

  const ptresDetalhado = [...byPtres.values()]
    .map((bucket) => ({
      ptres: bucket.ptres,
      total: bucket.total,
      lancamentos: bucket.count,
      porPi: sortedEntries(bucket.byPi, 12).map((item) => ({ pi: item.label, total: item.total })),
      porNatureza: sortedEntries(bucket.byNatureza, 6),
      porDimensao: sortedEntries(bucket.byDimensao, 6),
    }))
    .sort((left, right) => Math.abs(right.total) - Math.abs(left.total));

  const principaisLancamentos = rows
    .map((row) => ({
      ptres: row.origem_recurso || null,
      pi: row.plano_interno || null,
      natureza: row.natureza_despesa || null,
      dimensao: row.dimensao || null,
      notaCredito: row.nota_credito || null,
      dataEmissao: row.data_emissao || null,
      descricao: compactText(row.descricao, 140),
      valor: toNumber(row.valor),
    }))
    .sort((left, right) => Math.abs(right.valor) - Math.abs(left.valor))
    .slice(0, 18);

  return {
    summary: {
      escopo: 'Dados de descentralizacoes disponiveis no sistema do IFRN Campus Currais Novos; a tabela nao possui coluna de campus destino.',
      totalDescentralizadoLiquido: total,
      totalEntradas: entradas,
      totalAbatimentos: abatimentos,
      quantidadeLancamentos: rows.length,
      quantidadeNotasCredito: notes.size,
      periodo: minDate || maxDate ? { inicio: minDate || null, fim: maxDate || null } : null,
      porPtres: ptresDetalhado.slice(0, 20),
      porNatureza: sortedEntries(byNatureza, 12),
      porDimensao: sortedEntries(byDimensao, 12),
    },
    evidence: {
      principaisLancamentos,
    },
    limitations: [
      'A tabela descentralizacoes nao identifica campus destino em campo separado; "Campus Currais Novos" foi tratado como o escopo natural dos dados do sistema.',
      'Valores negativos e operacoes de devolucao/anulacao foram abatidos do total liquido.',
    ],
  };
}

function isActiveContrato(row: ContratoApiRow) {
  return row.situacao_derivada === true;
}

function getUg(value: unknown) {
  return String(value ?? '').trim();
}

function isCampusContrato(row: ContratoApiRow) {
  return getUg(row.unidade_codigo) === CAMPUS_UG || getUg(row.unidade_origem_codigo) === CAMPUS_UG;
}

function isReitoriaContrato(row: ContratoApiRow) {
  return getUg(row.unidade_codigo) === REITORIA_UG || getUg(row.unidade_origem_codigo) === REITORIA_UG;
}

function hasCampusEvidence(row: ContratoApiRow, empenhos: ContratoApiEmpenhoRow[]) {
  if (isCampusContrato(row)) return true;
  if (compactText(row.campus_scope_reason)) return true;
  return empenhos.some((empenho) => getUg(empenho.unidade_gestora) === CAMPUS_UG);
}

function getEmpenhoSaldo(empenho: ContratoApiEmpenhoRow) {
  const rpInscrito = toNumber(empenho.rp_inscrito);
  const rpAPagar = toNumber(empenho.rp_a_pagar);
  const rpLiquidado = toNumber(empenho.rp_liquidado);
  const rpPago = toNumber(empenho.rp_pago);
  const hasRap = rpInscrito > 0 || rpAPagar > 0 || toNumber(empenho.rp_a_liquidar) > 0;

  if (hasRap) {
    if (empenho.rp_a_pagar !== null && empenho.rp_a_pagar !== undefined) return Math.max(0, rpAPagar);
    return Math.max(0, rpInscrito - rpLiquidado - rpPago);
  }

  return Math.max(0, toNumber(empenho.valor_a_liquidar));
}

export function summarizeContratos(
  contratos: ContratoApiRow[],
  empenhos: ContratoApiEmpenhoRow[],
  faturas: ContratoApiFaturaRow[] = [],
) {
  const empenhosByContrato = new Map<string, ContratoApiEmpenhoRow[]>();
  const faturasByContrato = new Map<string, ContratoApiFaturaRow[]>();

  empenhos.forEach((empenho) => {
    const id = String(empenho.contrato_api_id || '');
    if (!id) return;
    empenhosByContrato.set(id, [...(empenhosByContrato.get(id) || []), empenho]);
  });

  faturas.forEach((fatura) => {
    const id = String(fatura.contrato_api_id || '');
    if (!id) return;
    faturasByContrato.set(id, [...(faturasByContrato.get(id) || []), fatura]);
  });

  const today = new Date();
  const recentThreshold = new Date(today);
  recentThreshold.setDate(recentThreshold.getDate() - 90);
  const expiringThreshold = new Date(today);
  expiringThreshold.setDate(expiringThreshold.getDate() + 120);

  const active = contratos.filter(isActiveContrato);
  const activeWithCampusScope = active.filter((contrato) =>
    hasCampusEvidence(contrato, empenhosByContrato.get(String(contrato.id || '')) || []));

  const contractSummaries = activeWithCampusScope.map((contrato) => {
    const id = String(contrato.id || '');
    const contractEmpenhos = empenhosByContrato.get(id) || [];
    const contractFaturas = faturasByContrato.get(id) || [];
    const totals = contractEmpenhos.reduce(
      (acc, empenho) => {
        acc.empenhado += toNumber(empenho.valor_empenhado);
        acc.aLiquidar += toNumber(empenho.valor_a_liquidar);
        acc.liquidado += toNumber(empenho.valor_liquidado);
        acc.pago += toNumber(empenho.valor_pago);
        acc.rapInscrito += toNumber(empenho.rp_inscrito);
        acc.rapAPagar += toNumber(empenho.rp_a_pagar);
        acc.saldoAtual += getEmpenhoSaldo(empenho);
        return acc;
      },
      { empenhado: 0, aLiquidar: 0, liquidado: 0, pago: 0, rapInscrito: 0, rapAPagar: 0, saldoAtual: 0 },
    );
    const latestFaturaDate = contractFaturas
      .map((fatura) => String(fatura.data_pagamento || fatura.data_emissao || '').slice(0, 10))
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    const fimVigencia = String(contrato.vigencia_fim_derivada || '').slice(0, 10) || null;
    const fimDate = fimVigencia ? new Date(`${fimVigencia}T00:00:00`) : null;
    const origem = isCampusContrato(contrato)
      ? 'Campus 158366'
      : isReitoriaContrato(contrato)
        ? 'Reitoria 158155 com evidencia do campus'
        : 'Origem nao classificada';

    return {
      id,
      numero: contrato.numero || null,
      fornecedor: contrato.fornecedor_nome || null,
      objeto: compactText(contrato.objeto, 220),
      processo: contrato.processo || null,
      origem,
      campusScopeReason: contrato.campus_scope_reason || null,
      vigenciaInicio: contrato.vigencia_inicio_derivada || null,
      vigenciaFim: fimVigencia,
      valorGlobal: toNumber(contrato.valor_global),
      valorAcumulado: toNumber(contrato.valor_acumulado),
      empenhos: contractEmpenhos.length,
      faturas: contractFaturas.length,
      ultimaFatura: latestFaturaDate,
      venceEmAte120Dias: Boolean(fimDate && fimDate >= today && fimDate <= expiringThreshold),
      semExecucaoRecente: Boolean(!latestFaturaDate || new Date(`${latestFaturaDate}T00:00:00`) < recentThreshold),
      ...totals,
    };
  });

  const sortDesc = (field: 'saldoAtual' | 'empenhado') =>
    [...contractSummaries].sort((left, right) => Number(right[field]) - Number(left[field])).slice(0, 12);

  const vencendo = contractSummaries
    .filter((item) => item.venceEmAte120Dias)
    .sort((left, right) => String(left.vigenciaFim || '').localeCompare(String(right.vigenciaFim || '')))
    .slice(0, 12);

  const semExecucaoRecente = contractSummaries
    .filter((item) => item.semExecucaoRecente)
    .sort((left, right) => Number(right.saldoAtual) - Number(left.saldoAtual))
    .slice(0, 12);

  const totals = contractSummaries.reduce(
    (acc, item) => {
      acc.empenhado += Number(item.empenhado);
      acc.saldoAtual += Number(item.saldoAtual);
      acc.liquidado += Number(item.liquidado);
      acc.pago += Number(item.pago);
      acc.rapAPagar += Number(item.rapAPagar);
      return acc;
    },
    { empenhado: 0, saldoAtual: 0, liquidado: 0, pago: 0, rapAPagar: 0 },
  );

  return {
    summary: {
      contratosTotalConsultados: contratos.length,
      contratosAtivos: active.length,
      contratosAtivosComEscopoCampus: activeWithCampusScope.length,
      contratosAtivosCampus: active.filter(isCampusContrato).length,
      contratosAtivosReitoriaComEvidenciaCampus: activeWithCampusScope.filter((item) => isReitoriaContrato(item)).length,
      totaisExecucao: totals,
      maioresSaldos: sortDesc('saldoAtual'),
      maioresEmpenhados: sortDesc('empenhado'),
      contratosVencendoEmAte120Dias: vencendo,
      contratosSemExecucaoRecente: semExecucaoRecente,
    },
    evidence: {
      contratosAvaliados: contractSummaries.slice(0, 30),
    },
    limitations: [
      'Contratos ativos foram filtrados por situacao_derivada = true.',
      'Contratos da Reitoria foram mantidos somente quando havia campus_scope_reason ou empenho da UG 158366.',
      faturas.length
        ? 'Execucao recente foi estimada pela data de emissao/pagamento das faturas sincronizadas.'
        : 'Execucao recente nao pode ser avaliada porque contratos_api_faturas nao retornou linhas.',
    ],
  };
}

export function summarizeEmpenhos(rows: EmpenhoRow[]) {
  const totals = rows.reduce(
    (acc, row) => {
      const valor = toNumber(row.valor);
      const liquidado = toNumber(row.valor_liquidado_oficial || row.valor_liquidado);
      const pago = toNumber(row.valor_pago_oficial);
      const rapSaldo = toNumber(row.saldo_rap_oficial);
      const saldo = normalizeText(row.tipo).includes('rap') ? rapSaldo : Math.max(0, valor - liquidado);
      acc.valor += valor;
      acc.liquidado += liquidado;
      acc.pago += pago;
      acc.saldo += saldo;
      return acc;
    },
    { valor: 0, liquidado: 0, pago: 0, saldo: 0 },
  );

  const maioresSaldos = rows
    .map((row) => {
      const valor = toNumber(row.valor);
      const liquidado = toNumber(row.valor_liquidado_oficial || row.valor_liquidado);
      const saldo = normalizeText(row.tipo).includes('rap')
        ? toNumber(row.saldo_rap_oficial)
        : Math.max(0, valor - liquidado);
      return {
        numero: row.numero || null,
        favorecido: row.favorecido_nome || null,
        descricao: compactText(row.descricao, 180),
        ptres: row.origem_recurso || null,
        pi: row.plano_interno || null,
        natureza: row.natureza_despesa || null,
        tipo: row.tipo || null,
        valor,
        liquidado,
        saldo,
      };
    })
    .sort((left, right) => right.saldo - left.saldo)
    .slice(0, 15);

  return {
    summary: {
      quantidadeEmpenhos: rows.length,
      totais: totals,
      maioresSaldos,
    },
    evidence: { maioresSaldos },
    limitations: ['Saldo de empenhos de exercicio foi calculado como valor menos liquidado quando nao havia campo de saldo dedicado.'],
  };
}

export function summarizeCreditos(rows: CreditoDisponivelRow[]) {
  const byPtres = new Map<string, number>();
  rows.forEach((row) => addToMap(byPtres, compactText(row.ptres || 'PTRES nao informado', 40), toNumber(row.valor)));
  const porPtres = sortedEntries(byPtres, 30).map((item) => ({ ptres: item.label, total: item.total }));
  return {
    summary: {
      quantidadeLinhas: rows.length,
      totalCreditoDisponivel: porPtres.reduce((acc, item) => acc + item.total, 0),
      porPtres,
    },
    evidence: { porPtres },
    limitations: ['Credito disponivel depende da ultima importacao registrada em creditos_disponiveis.'],
  };
}

export function summarizePfs(sections: ContextSection[]) {
  const rastreabilidade = asRows<Record<string, unknown>>(sections, 'vw_rastreabilidade_pf');
  const conciliacao = asRows<Record<string, unknown>>(sections, 'vw_conciliacao_diaria_pf');
  const totalPfs = rastreabilidade.reduce((acc, row) => acc + toNumber(row.valor), 0);
  const totalSaldoConciliacao = conciliacao.reduce((acc, row) => acc + toNumber(row.saldo), 0);

  return {
    summary: {
      rastreabilidadeLinhas: rastreabilidade.length,
      conciliacaoLinhas: conciliacao.length,
      totalPfs,
      totalSaldoConciliacao,
      principaisPfs: rastreabilidade.slice(0, 15),
      conciliacoesRecentes: conciliacao.slice(0, 15),
    },
    evidence: {
      principaisPfs: rastreabilidade.slice(0, 15),
      conciliacoesRecentes: conciliacao.slice(0, 15),
    },
    limitations: ['PFs e conciliacao dependem das views disponiveis para o usuario autenticado.'],
  };
}

export function buildGerencialAnalysis(message: string, sections: ContextSection[]): GerencialAnalysis {
  const intent = detectAssistantIntent(message);
  const descentralizacoes = summarizeDescentralizacoes(asRows<DescentralizacaoRow>(sections, 'descentralizacoes'));
  const contratos = summarizeContratos(
    asRows<ContratoApiRow>(sections, 'contratos_api'),
    asRows<ContratoApiEmpenhoRow>(sections, 'contratos_api_empenhos'),
    asRows<ContratoApiFaturaRow>(sections, 'contratos_api_faturas'),
  );
  const empenhos = summarizeEmpenhos(asRows<EmpenhoRow>(sections, 'empenhos'));
  const creditos = summarizeCreditos(asRows<CreditoDisponivelRow>(sections, 'creditos_disponiveis'));
  const pfs = summarizePfs(sections);

  if (intent === 'descentralizacoes') {
    return { intent, ...descentralizacoes };
  }
  if (intent === 'contratos') {
    return { intent, ...contratos };
  }
  if (intent === 'empenhos_execucao') {
    return { intent, ...empenhos };
  }
  if (intent === 'creditos_saldos') {
    return { intent, ...creditos };
  }
  if (intent === 'pfs_conciliacao') {
    return { intent, ...pfs };
  }

  return {
    intent,
    summary: {
      descentralizacoes: descentralizacoes.summary,
      contratos: contratos.summary,
      empenhos: empenhos.summary,
      creditos: creditos.summary,
      pfs: pfs.summary,
      totaisDisponiveis: {
        descentralizacoes: sectionCount(sections, 'descentralizacoes'),
        contratosApi: sectionCount(sections, 'contratos_api'),
        empenhos: sectionCount(sections, 'empenhos'),
        creditosDisponiveis: sectionCount(sections, 'creditos_disponiveis'),
      },
    },
    evidence: {
      descentralizacoes: descentralizacoes.evidence,
      contratos: contratos.evidence,
      empenhos: empenhos.evidence,
      creditos: creditos.evidence,
    },
    limitations: [
      ...descentralizacoes.limitations,
      ...contratos.limitations,
      ...empenhos.limitations,
      ...creditos.limitations,
      ...pfs.limitations,
    ],
  };
}

export function normalizeSectionSources(sections: ContextSection[]) {
  return sections.map((section) => ({
    label: section.label,
    totalAmostra: section.rows.length,
    totalDisponivel: section.count,
    warning: section.warning,
  }));
}

export function sanitizeUnknownRows(rows: unknown[]) {
  return rows.filter(isRecord);
}
