import { supabase, DEFAULT_CAMPUS_UASG } from '../lib/supabase';
import {
  calcularVigencia,
  compararContratos,
  contratoVisivelPorPadrao,
  faturaPendente,
  valorTotalDoHistorico,
} from '../lib/contratosRules';
import { chunk, lerTudo, tabelaInexistente, type Row } from './query';
import type {
  ContratoDetalhe,
  ContratoEmpenhoLinha,
  ContratoFaturaLinha,
  ContratoItem,
  ContratoItemLinha,
  ContratoTermoLinha,
} from '../types';

/**
 * Dados de Contratos (tabelas contratos_api*). Espelha o web (src/services/contratosApi.ts):
 * contratos no escopo do campus, situação/vigência derivadas no servidor, empenhos da UG do campus,
 * valor total pelo histórico de termos e faturas pendentes. Erros são lançados — o app mostra o erro,
 * nunca dados de demonstração.
 */

const IN_CHUNK = 80;
const ESCOPO_LEGADO = ['ug_campus', 'reitoria_com_empenho_campus', 'reitoria_com_fatura_campus'];

const CONTRATO_COLUNAS =
  'id, numero, fornecedor_nome, objeto, processo, categoria, unidade_origem_nome, vigencia_inicio, vigencia_fim, vigencia_inicio_derivada, vigencia_fim_derivada, valor_global, situacao, situacao_derivada';

async function lerPorContratos(
  tabela: string,
  colunas: string,
  ids: string[],
  ajustar?: (query: any) => any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Row[]> {
  const partes = await Promise.all(
    chunk(ids, IN_CHUNK).map((grupo) =>
      lerTudo((from, to) => {
        let query = supabase.from(tabela).select(colunas).in('contrato_api_id', grupo);
        if (ajustar) query = ajustar(query);
        return query.range(from, to);
      }),
    ),
  );
  return partes.flat();
}

async function idsNoEscopoDoCampus(campusUasg: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('contratos_api_campus_scope')
    .select('contrato_api_id')
    .eq('campus_uasg', campusUasg);

  if (!error) return Array.from(new Set((data ?? []).map((row) => row.contrato_api_id as string).filter(Boolean)));
  if (tabelaInexistente(error)) return null; // rollout antigo: usa campus_scope_reason
  throw new Error(error.message);
}

function iconeDoContrato(objeto: string, categoria: string | null): ContratoItem['icon'] {
  const texto = `${objeto} ${categoria ?? ''}`.toLowerCase();
  if (/vigil|seguran|prote/.test(texto)) return 'shield';
  if (/manuten|energia|loca|telecom|inter|reform|obra|limpeza|conserva/.test(texto)) return 'building';
  return 'doc';
}

const numero = (valor: unknown): number => Number(valor) || 0;

/** Contratos do campus que o web mostra por padrão (vigentes e expirados há até 120 dias). */
async function carregarContratosVisiveis(campusUasg: string, hoje: Date): Promise<Row[]> {
  const escopo = await idsNoEscopoDoCampus(campusUasg);
  if (escopo && escopo.length === 0) return [];

  const contratos = (
    await Promise.all(
      (escopo ? chunk(escopo, IN_CHUNK) : [null]).map(async (grupo) => {
        let query = supabase.from('contratos_api').select(CONTRATO_COLUNAS);
        query = grupo ? query.in('id', grupo) : query.in('campus_scope_reason', ESCOPO_LEGADO);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data ?? []) as Row[];
      }),
    )
  ).flat();

  return contratos.filter((c) =>
    contratoVisivelPorPadrao(c.vigencia_fim_derivada ?? c.vigencia_fim, c.situacao_derivada ?? c.situacao, hoje),
  );
}

export type ResumoContratos = { ativos: number; aVencer: number; valorAtivos: number };

/** Contagens rápidas (sem empenhos/faturas) para o Dashboard, com a mesma regra da tela de Contratos. */
export async function fetchResumoContratos(campusUasg: string = DEFAULT_CAMPUS_UASG, hoje = new Date()): Promise<ResumoContratos> {
  const contratos = await carregarContratosVisiveis(campusUasg, hoje);
  const resumo: ResumoContratos = { ativos: 0, aVencer: 0, valorAtivos: 0 };
  for (const c of contratos) {
    const vigencia = calcularVigencia(
      c.vigencia_inicio_derivada ?? c.vigencia_inicio,
      c.vigencia_fim_derivada ?? c.vigencia_fim,
      c.situacao_derivada ?? c.situacao,
      hoje,
    );
    if (vigencia.status === 'expirado') continue;
    resumo.ativos += 1;
    resumo.valorAtivos += numero(c.valor_global);
    if (vigencia.status === 'a_vencer') resumo.aVencer += 1;
  }
  return resumo;
}

export async function fetchContratos(campusUasg: string = DEFAULT_CAMPUS_UASG, hoje = new Date()): Promise<ContratoItem[]> {
  const visiveis = await carregarContratosVisiveis(campusUasg, hoje);
  if (visiveis.length === 0) return [];

  const ids = visiveis.map((c) => c.id as string);
  const [empenhos, faturas, historico] = await Promise.all([
    lerPorContratos('contratos_api_empenhos', 'contrato_api_id, unidade_gestora, valor_empenhado, valor_a_liquidar, valor_liquidado, valor_pago', ids),
    lerPorContratos('contratos_api_faturas', 'contrato_api_id, situacao', ids),
    lerPorContratos('contratos_api_historico', 'contrato_api_id, api_historico_id, data_assinatura, data_publicacao, vigencia_inicio, valor_inicial', ids),
  ]);

  const empenhosPorContrato = new Map<string, { empenhado: number; aLiquidar: number; liquidado: number; pago: number }>();
  for (const e of empenhos) {
    if (String(e.unidade_gestora ?? '').trim() !== campusUasg) continue;
    const atual = empenhosPorContrato.get(e.contrato_api_id) ?? { empenhado: 0, aLiquidar: 0, liquidado: 0, pago: 0 };
    atual.empenhado += numero(e.valor_empenhado);
    atual.aLiquidar += numero(e.valor_a_liquidar);
    atual.liquidado += numero(e.valor_liquidado);
    atual.pago += numero(e.valor_pago);
    empenhosPorContrato.set(e.contrato_api_id, atual);
  }

  const pendentesPorContrato = new Map<string, number>();
  for (const f of faturas) {
    if (faturaPendente(f.situacao)) pendentesPorContrato.set(f.contrato_api_id, (pendentesPorContrato.get(f.contrato_api_id) ?? 0) + 1);
  }

  const termosPorContrato = new Map<string, Row[]>();
  for (const h of historico) termosPorContrato.set(h.contrato_api_id, [...(termosPorContrato.get(h.contrato_api_id) ?? []), h]);

  const itens: ContratoItem[] = visiveis.map((c) => {
    const inicio = c.vigencia_inicio_derivada ?? c.vigencia_inicio ?? null;
    const fim = c.vigencia_fim_derivada ?? c.vigencia_fim ?? null;
    const vigencia = calcularVigencia(inicio, fim, c.situacao_derivada ?? c.situacao, hoje);
    const totais = empenhosPorContrato.get(c.id) ?? { empenhado: 0, aLiquidar: 0, liquidado: 0, pago: 0 };
    const valorHistorico = valorTotalDoHistorico(termosPorContrato.get(c.id) ?? []);
    const objeto = String(c.objeto ?? '').trim();

    return {
      uuid: c.id,
      numero: c.numero || 'S/N',
      fornecedor: c.fornecedor_nome || 'Contratada não identificada',
      objeto: objeto || 'Objeto não informado',
      categoria: c.categoria ?? null,
      processo: c.processo ?? null,
      unidadeOrigem: c.unidade_origem_nome ?? null,
      valorGlobal: valorHistorico > 0 ? valorHistorico : numero(c.valor_global),
      empenhado: totais.empenhado,
      aLiquidar: totais.aLiquidar,
      liquidado: totais.liquidado,
      pago: totais.pago,
      vigenciaInicio: inicio,
      vigenciaFim: fim,
      status: vigencia.status,
      dias: vigencia.dias,
      vigenciaTexto: vigencia.texto,
      percentualDecorrido: vigencia.percentualDecorrido,
      faturasPendentes: pendentesPorContrato.get(c.id) ?? 0,
      icon: iconeDoContrato(objeto, c.categoria ?? null),
    };
  });

  return itens.sort((a, b) =>
    compararContratos(
      { status: a.status, dias: a.dias, temFaturaPendente: a.faturasPendentes > 0 },
      { status: b.status, dias: b.dias, temFaturaPendente: b.faturasPendentes > 0 },
    ),
  );
}

export async function fetchContratoDetalhe(contratoUuid: string, campusUasg: string = DEFAULT_CAMPUS_UASG): Promise<ContratoDetalhe> {
  const ids = [contratoUuid];
  const [empenhos, faturas, itens, termos] = await Promise.all([
    lerPorContratos(
      'contratos_api_empenhos',
      'id, numero, unidade_gestora, credor, data_emissao, natureza_despesa, valor_empenhado, valor_a_liquidar, valor_liquidado, valor_pago',
      ids,
      (q) => q.order('data_emissao', { ascending: false }),
    ),
    lerPorContratos(
      'contratos_api_faturas',
      'id, api_fatura_id, numero_instrumento_cobranca, mes_referencia, ano_referencia, situacao, valor_bruto, valor_liquido, data_vencimento, data_pagamento',
      ids,
      (q) => q.order('data_vencimento', { ascending: false, nullsFirst: false }),
    ),
    lerPorContratos(
      'contratos_api_itens',
      'id, api_item_id, numero_item_compra, descricao_complementar, quantidade, valor_unitario, valor_total',
      ids,
      (q) => q.order('numero_item_compra', { ascending: true }),
    ),
    lerPorContratos(
      'contratos_api_historico',
      'id, api_historico_id, numero, tipo, data_assinatura, vigencia_inicio, vigencia_fim, valor_inicial, observacao',
      ids,
      (q) => q.order('data_assinatura', { ascending: false, nullsFirst: false }),
    ),
  ]);

  const empenhosCampus: ContratoEmpenhoLinha[] = empenhos
    .filter((e) => String(e.unidade_gestora ?? '').trim() === campusUasg)
    .map((e) => ({
      id: e.id,
      numero: e.numero,
      credor: e.credor ?? null,
      dataEmissao: e.data_emissao ?? null,
      naturezaDespesa: e.natureza_despesa ?? null,
      empenhado: numero(e.valor_empenhado),
      aLiquidar: numero(e.valor_a_liquidar),
      liquidado: numero(e.valor_liquidado),
      pago: numero(e.valor_pago),
    }));

  const faturasLinhas: ContratoFaturaLinha[] = faturas.map((f) => {
    const mes = String(f.mes_referencia ?? '').padStart(2, '0');
    return {
      id: f.id,
      numero: f.numero_instrumento_cobranca || String(f.api_fatura_id ?? ''),
      referencia: f.mes_referencia && f.ano_referencia ? `${mes}/${f.ano_referencia}` : '—',
      situacao: f.situacao || 'Sem situação',
      pendente: faturaPendente(f.situacao),
      valorBruto: numero(f.valor_bruto),
      valorLiquido: numero(f.valor_liquido),
      vencimento: f.data_vencimento ?? null,
      pagamento: f.data_pagamento ?? null,
    };
  });

  const itensLinhas: ContratoItemLinha[] = itens.map((i) => ({
    id: i.id,
    descricao: String(i.descricao_complementar ?? '').trim() || 'Item sem descrição',
    numeroItem: i.numero_item_compra ?? null,
    quantidade: numero(i.quantidade),
    valorUnitario: numero(i.valor_unitario),
    valorTotal: numero(i.valor_total),
  }));

  const termosLinhas: ContratoTermoLinha[] = termos.map((t) => ({
    id: t.id,
    tipo: t.tipo || 'Termo',
    numero: t.numero ?? null,
    assinatura: t.data_assinatura ?? null,
    vigenciaInicio: t.vigencia_inicio ?? null,
    vigenciaFim: t.vigencia_fim ?? null,
    valor: numero(t.valor_inicial),
    observacao: t.observacao ? String(t.observacao).trim() : null,
  }));

  return { empenhos: empenhosCampus, faturas: faturasLinhas, itens: itensLinhas, termos: termosLinhas };
}

/** Quando o servidor sincronizou os contratos pela última vez (mostra a "idade" do dado ao usuário). */
export async function fetchUltimaSincronizacaoContratos(campusUasg: string = DEFAULT_CAMPUS_UASG): Promise<string | null> {
  const { data, error } = await supabase
    .from('contratos_api_sync_runs')
    .select('finished_at, started_at, status')
    .eq('unidade_codigo', campusUasg)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data.finished_at as string | null) || (data.started_at as string | null) || null;
}
