export type ApiContrato = Record<string, unknown>;
export type ApiEmpenho = Record<string, unknown>;
export type ApiFatura = Record<string, unknown>;
export type ApiContratoItem = Record<string, unknown>;
export type ApiContratoHistorico = Record<string, unknown>;

export type ContratoApiPayload = ReturnType<typeof mapContrato>;
export type ContratoApiEmpenhoPayload = ReturnType<typeof mapEmpenho>;
export type ContratoApiFaturaPayload = ReturnType<typeof mapFatura>;
export type ContratoApiItemPayload = ReturnType<typeof mapItem>;
export type ContratoApiHistoricoPayload = ReturnType<typeof mapHistorico>;
export type ContratoApiFaturaItemPayload = ReturnType<typeof mapFaturaItem>;
export type ContratoApiFaturaEmpenhoPayload = ReturnType<typeof mapFaturaEmpenho>;

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  return Number(cleaned) || 0;
}

export function toDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && 'date' in value) {
    return toDate((value as { date?: unknown }).date);
  }

  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getNestedRecord(value: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return keys.reduce<Record<string, unknown>>((current, key) => asRecord(current[key]), value);
}

export function mapContrato(raw: ApiContrato, situacao: boolean) {
  const contratante = asRecord(raw.contratante);
  const orgao = asRecord(contratante.orgao);
  const unidadeGestora = getNestedRecord(contratante, ['orgao', 'unidade_gestora']);
  const orgaoOrigem = asRecord(contratante.orgao_origem);
  const unidadeOrigem = getNestedRecord(contratante, ['orgao_origem', 'unidade_gestora_origem']);
  const fornecedor = asRecord(raw.fornecedor);

  return {
    api_contrato_id: Number(raw.id),
    numero: String(raw.numero ?? '').trim(),
    receita_despesa: String(raw.receita_despesa ?? ''),
    orgao_codigo: String(raw.orgao_codigo ?? orgao.codigo ?? orgaoOrigem.codigo ?? ''),
    orgao_nome: String(raw.orgao_nome ?? orgao.nome ?? orgaoOrigem.nome ?? ''),
    unidade_codigo: String(raw.unidade_codigo ?? unidadeGestora.codigo ?? ''),
    unidade_nome: String(raw.unidade_nome ?? unidadeGestora.nome ?? ''),
    unidade_nome_resumido: String(raw.unidade_nome_resumido ?? unidadeGestora.nome_resumido ?? ''),
    unidade_origem_codigo: String(raw.unidade_origem_codigo ?? unidadeOrigem.codigo ?? ''),
    unidade_origem_nome: String(raw.unidade_origem_nome ?? unidadeOrigem.nome ?? ''),
    fornecedor_tipo: String(raw.fornecedor_tipo ?? fornecedor.tipo ?? ''),
    fornecedor_documento: String(raw.fonecedor_cnpj_cpf_idgener ?? raw.fornecedor_cnpj_cpf_idgener ?? fornecedor.cnpj_cpf_idgener ?? ''),
    fornecedor_nome: String(raw.fornecedor_nome ?? fornecedor.nome ?? ''),
    categoria: String(raw.categoria ?? ''),
    objeto: String(raw.objeto ?? ''),
    processo: String(raw.processo ?? ''),
    vigencia_inicio: toDate(raw.vigencia_inicio),
    vigencia_fim: toDate(raw.vigencia_fim),
    valor_global: toNumber(raw.valor_global),
    valor_acumulado: toNumber(raw.valor_acumulado),
    situacao,
    raw_data: raw,
  };
}

export function mapHistorico(contratoApiId: string, raw: ApiContratoHistorico) {
  return {
    contrato_api_id: contratoApiId,
    api_historico_id: Number(raw.id),
    numero: String(raw.numero ?? '').trim(),
    receita_despesa: String(raw.receita_despesa ?? ''),
    tipo: String(raw.tipo ?? ''),
    qualificacao_termo: Array.isArray(raw.qualificacao_termo) ? raw.qualificacao_termo : [],
    observacao: raw.observacao == null ? null : String(raw.observacao),
    ug: String(raw.ug ?? ''),
    gestao: String(raw.gestao ?? ''),
    codigo_tipo: String(raw.codigo_tipo ?? ''),
    categoria: String(raw.categoria ?? ''),
    processo: String(raw.processo ?? ''),
    objeto: raw.objeto == null ? null : String(raw.objeto),
    fundamento_legal_aditivo: raw.fundamento_legal_aditivo == null ? null : String(raw.fundamento_legal_aditivo),
    informacao_complementar: raw.informacao_complementar == null ? null : String(raw.informacao_complementar),
    modalidade: String(raw.modalidade ?? ''),
    licitacao_numero: String(raw.licitacao_numero ?? ''),
    codigo_unidade_origem: String(raw.codigo_unidade_origem ?? ''),
    nome_unidade_origem: String(raw.nome_unidade_origem ?? ''),
    data_assinatura: toDate(raw.data_assinatura),
    data_publicacao: toDate(raw.data_publicacao),
    data_proposta_comercial: toDate(raw.data_proposta_comercial),
    vigencia_inicio: toDate(raw.vigencia_inicio),
    vigencia_fim: toDate(raw.vigencia_fim),
    valor_inicial: toNumber(raw.valor_inicial),
    valor_global: toNumber(raw.valor_global),
    num_parcelas: raw.num_parcelas == null ? null : Number(raw.num_parcelas) || null,
    valor_parcela: toNumber(raw.valor_parcela),
    novo_valor_global: toNumber(raw.novo_valor_global),
    novo_num_parcelas: raw.novo_num_parcelas == null ? null : Number(raw.novo_num_parcelas) || null,
    novo_valor_parcela: toNumber(raw.novo_valor_parcela),
    data_inicio_novo_valor: toDate(raw.data_inicio_novo_valor),
    retroativo: String(raw.retroativo ?? ''),
    retroativo_mesref_de: String(raw.retroativo_mesref_de ?? ''),
    retroativo_anoref_de: String(raw.retroativo_anoref_de ?? ''),
    retroativo_mesref_ate: String(raw.retroativo_mesref_ate ?? ''),
    retroativo_anoref_ate: String(raw.retroativo_anoref_ate ?? ''),
    retroativo_vencimento: toDate(raw.retroativo_vencimento),
    retroativo_valor: toNumber(raw.retroativo_valor),
    situacao_contrato: String(raw.situacao_contrato ?? ''),
    raw_data: raw,
  };
}

export function mapEmpenho(contratoApiId: string, raw: ApiEmpenho) {
  return {
    contrato_api_id: contratoApiId,
    api_empenho_id: Number(raw.id),
    numero: String(raw.numero ?? '').trim(),
    unidade_gestora: String(raw.unidade_gestora ?? ''),
    gestao: String(raw.gestao ?? ''),
    data_emissao: toDate(raw.data_emissao),
    credor: String(raw.credor ?? ''),
    fonte_recurso: String(raw.fonte_recurso ?? ''),
    plano_interno: String(raw.planointerno ?? ''),
    natureza_despesa: String(raw.naturezadespesa ?? ''),
    valor_empenhado: toNumber(raw.empenhado),
    valor_a_liquidar: toNumber(raw.aliquidar),
    valor_liquidado: toNumber(raw.liquidado),
    valor_pago: toNumber(raw.pago),
    rp_inscrito: toNumber(raw.rpinscrito),
    rp_a_pagar: toNumber(raw.rpapagar),
    raw_data: raw,
  };
}

export function mapFatura(contratoApiId: string, raw: ApiFatura) {
  return {
    contrato_api_id: contratoApiId,
    api_fatura_id: Number(raw.id),
    tipo_lista_fatura: String(raw.tipolistafatura_id ?? ''),
    tipo_instrumento_cobranca: String(raw.tipo_instrumento_cobranca ?? ''),
    numero_instrumento_cobranca: String(raw.numero_instrumento_cobranca ?? raw.numero ?? ''),
    mes_referencia: String(raw.mes_referencia ?? raw.mesref ?? ''),
    ano_referencia: String(raw.ano_referencia ?? raw.anoref ?? ''),
    data_emissao: toDate(raw.data_emissao ?? raw.emissao),
    data_vencimento: toDate(raw.data_vencimento ?? raw.vencimento ?? raw.prazo),
    data_pagamento: toDate(raw.data_pagamento),
    situacao: String(raw.situacao ?? ''),
    valor_bruto: toNumber(raw.valor_bruto ?? raw.valor),
    valor_liquido: toNumber(raw.valor_liquido ?? raw.valorliquido),
    raw_data: raw,
  };
}

export function mapItem(contratoApiId: string, raw: ApiContratoItem) {
  return {
    contrato_api_id: contratoApiId,
    api_item_id: Number(raw.id),
    tipo_id: String(raw.tipo_id ?? ''),
    tipo_material: String(raw.tipo_material ?? ''),
    grupo_id: String(raw.grupo_id ?? ''),
    catmatseritem_id: String(raw.catmatseritem_id ?? ''),
    descricao_complementar: raw.descricao_complementar == null ? null : String(raw.descricao_complementar),
    quantidade: toNumber(raw.quantidade),
    valor_unitario: toNumber(raw.valorunitario ?? raw.valor_unitario),
    valor_total: toNumber(raw.valortotal ?? raw.valor_total),
    numero_item_compra: String(raw.numero_item_compra ?? ''),
    data_inicio_item: toDate(raw.data_inicio_item),
    historico_item: Array.isArray(raw.historico_item) ? raw.historico_item : [],
    raw_data: raw,
  };
}

export function mapFaturaItem(
  contratoApiId: string,
  contratoApiFaturaId: string,
  contratoApiItemId: string | null,
  raw: Record<string, unknown>,
) {
  return {
    contrato_api_id: contratoApiId,
    contrato_api_fatura_id: contratoApiFaturaId,
    contrato_api_item_id: contratoApiItemId,
    api_item_id: Number(raw.id_item_contrato),
    quantidade_faturado: toNumber(raw.quantidade_faturado),
    valor_unitario_faturado: toNumber(raw.valorunitario_faturado),
    valor_total_faturado: toNumber(raw.valortotal_faturado),
    raw_data: raw,
  };
}

export function mapFaturaEmpenho(
  contratoApiId: string,
  contratoApiFaturaId: string,
  contratoApiEmpenhoId: string | null,
  raw: Record<string, unknown>,
) {
  return {
    contrato_api_id: contratoApiId,
    contrato_api_fatura_id: contratoApiFaturaId,
    contrato_api_empenho_id: contratoApiEmpenhoId,
    api_empenho_id: Number(raw.id_empenho),
    numero_empenho: String(raw.numero_empenho ?? ''),
    valor_empenho: toNumber(raw.valor_empenho),
    subelemento: String(raw.subelemento ?? ''),
    raw_data: raw,
  };
}

export function getFaturaItens(raw: ApiFatura): Record<string, unknown>[] {
  return Array.isArray(raw.dados_item_faturado)
    ? (raw.dados_item_faturado as Record<string, unknown>[])
    : [];
}

export function getFaturaEmpenhos(raw: ApiFatura): Record<string, unknown>[] {
  return Array.isArray(raw.dados_empenho)
    ? (raw.dados_empenho as Record<string, unknown>[])
    : [];
}
