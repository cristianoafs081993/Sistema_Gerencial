export type AtaRegistroPrecoRaw = Record<string, unknown>;

export type AtaRegistroPrecoPayload = {
  ata_key: string;
  numero_ata: string;
  numero_compra: string | null;
  ano_compra: number | null;
  modalidade_codigo: string | null;
  modalidade_nome: string | null;
  unidade_gerenciadora_codigo: string;
  unidade_gerenciadora_nome: string | null;
  objeto: string | null;
  data_assinatura: string | null;
  data_vigencia_inicial: string | null;
  data_vigencia_final: string | null;
  raw_data: AtaRegistroPrecoRaw;
};

export type AtaRegistroPrecoItemPayload = {
  item_key: string;
  ata_key: string;
  numero_ata: string;
  unidade_gerenciadora_codigo: string;
  numero_item: string;
  codigo_item: string | null;
  tipo_item: string | null;
  descricao_item: string | null;
  fornecedor_nome: string | null;
  fornecedor_ni: string | null;
  quantidade_homologada: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  raw_data: AtaRegistroPrecoRaw;
};

export type AtaRegistroPrecoUnidadePayload = {
  unidade_item_key: string;
  item_key: string;
  ata_key: string;
  unidade_codigo: string;
  unidade_nome: string | null;
  quantidade_autorizada: number | null;
  quantidade_utilizada: number | null;
  saldo_quantidade: number | null;
  raw_data: AtaRegistroPrecoRaw;
};

export type AtaRegistroPrecoAdesaoPayload = {
  adesao_key: string;
  item_key: string;
  ata_key: string;
  unidade_codigo: string;
  unidade_nome: string | null;
  quantidade_aderida: number | null;
  valor_aderido: number | null;
  data_adesao: string | null;
  situacao: string | null;
  raw_data: AtaRegistroPrecoRaw;
};

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function firstString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function firstNumber(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const str = String(value).trim();
    if (!str) continue;
    if (str.includes(',')) {
      const parsed = Number(str.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    } else {
      const parsed = Number(str);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function firstDate(raw: Record<string, unknown>, keys: string[]) {
  const value = firstString(raw, keys);
  if (!value) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function normalizeAtaUasg(value: unknown) {
  const normalized = String(value ?? '').replace(/\D/g, '');
  return normalized || null;
}

function compactKeyPart(value: unknown, fallback = 'sem-chave') {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '-');
  return normalized || fallback;
}

export function buildAtaKey(unidadeGerenciadoraCodigo: string, numeroAta: string) {
  return `${compactKeyPart(unidadeGerenciadoraCodigo)}-${compactKeyPart(numeroAta)}`;
}

export function buildAtaItemKey(ataKey: string, raw: AtaRegistroPrecoRaw) {
  const row = asRecord(raw);
  return [
    ataKey,
    compactKeyPart(firstString(row, ['numeroItem', 'numero_item', 'item'])),
    compactKeyPart(firstString(row, ['codigoItem', 'codigo_item', 'codItemCatalogo']), 'sem-codigo'),
    compactKeyPart(firstString(row, ['niFornecedor', 'ni_fornecedor', 'cnpjFornecedor']), 'sem-fornecedor'),
  ].join('-');
}

export function buildAtaUnidadeItemKey(itemKey: string, unidadeCodigo: string) {
  return `${itemKey}-${compactKeyPart(unidadeCodigo)}`;
}

export function buildAtaAdesaoKey(itemKey: string, raw: AtaRegistroPrecoRaw, unidadeCodigo: string) {
  const row = asRecord(raw);
  return [
    itemKey,
    compactKeyPart(unidadeCodigo),
    compactKeyPart(firstString(row, ['numeroAdesao', 'numero_adesao', 'idAdesao']), 'sem-adesao'),
    compactKeyPart(firstString(row, ['dataAdesao', 'data_adesao', 'dataAtualizacao']), 'sem-data'),
  ].join('-');
}

export function mapAtaRegistroPreco(raw: AtaRegistroPrecoRaw): AtaRegistroPrecoPayload {
  const row = asRecord(raw);
  const unidadeGerenciadoraCodigo = normalizeAtaUasg(firstString(row, [
    'codigoUnidadeGerenciadora',
    'unidadeGerenciadora',
    'codigo_unidade_gerenciadora',
    'unidade_gerenciadora',
  ]));
  const numeroAta = firstString(row, ['numeroAtaRegistroPreco', 'numeroAta', 'numero_ata', 'numeroAtaCompra']);

  if (!unidadeGerenciadoraCodigo) throw new Error('Ata sem unidade gerenciadora.');
  if (!numeroAta) throw new Error('Ata sem numero.');

  return {
    ata_key: buildAtaKey(unidadeGerenciadoraCodigo, numeroAta),
    numero_ata: numeroAta,
    numero_compra: firstString(row, ['numeroCompra', 'numero_compra']),
    ano_compra: firstNumber(row, ['anoCompra', 'ano_compra']),
    modalidade_codigo: firstString(row, ['codigoModalidadeCompra', 'modalidadeCodigo', 'codigo_modalidade_compra']),
    modalidade_nome: firstString(row, ['nomeModalidadeCompra', 'modalidadeNome', 'modalidade_nome']),
    unidade_gerenciadora_codigo: unidadeGerenciadoraCodigo,
    unidade_gerenciadora_nome: firstString(row, ['nomeUnidadeGerenciadora', 'nome_unidade_gerenciadora']),
    objeto: firstString(row, ['objeto', 'objetoCompra', 'descricaoObjeto']),
    data_assinatura: firstDate(row, ['dataAssinatura', 'data_assinatura']),
    data_vigencia_inicial: firstDate(row, ['dataVigenciaInicial', 'data_vigencia_inicial']),
    data_vigencia_final: firstDate(row, ['dataVigenciaFinal', 'data_vigencia_final']),
    raw_data: raw,
  };
}

export function mapAtaRegistroPrecoItem(raw: AtaRegistroPrecoRaw, ata: Pick<AtaRegistroPrecoPayload, 'ata_key' | 'numero_ata' | 'unidade_gerenciadora_codigo'>): AtaRegistroPrecoItemPayload {
  const row = asRecord(raw);
  const numeroItem = firstString(row, ['numeroItem', 'numero_item', 'item']);
  if (!numeroItem) throw new Error(`Item de ata ${ata.ata_key} sem numero.`);

  const rawNumeroAta = firstString(row, ['numeroAtaRegistroPreco', 'numeroAta', 'numero_ata']);
  if (rawNumeroAta && rawNumeroAta !== ata.numero_ata) {
    throw new Error(`Item com numero de ata divergente (${rawNumeroAta}) da ata ${ata.numero_ata}.`);
  }

  return {
    item_key: buildAtaItemKey(ata.ata_key, raw),
    ata_key: ata.ata_key,
    numero_ata: ata.numero_ata,
    unidade_gerenciadora_codigo: ata.unidade_gerenciadora_codigo,
    numero_item: numeroItem,
    codigo_item: firstString(row, ['codigoItem', 'codigo_item', 'codItemCatalogo']),
    tipo_item: firstString(row, ['tipoItem', 'tipo_item', 'materialOuServico']),
    descricao_item: firstString(row, ['descricaoItem', 'descricao_item', 'nomeItem', 'descricao']),
    fornecedor_nome: firstString(row, ['nomeFornecedor', 'fornecedorNome', 'nome_fornecedor', 'nomeRazaoSocialFornecedor']),
    fornecedor_ni: firstString(row, ['niFornecedor', 'ni_fornecedor', 'cnpjFornecedor']),
    quantidade_homologada: firstNumber(row, ['quantidadeHomologada', 'quantidade_homologada', 'quantidadeHomologadaItem', 'quantidadeHomologadaVencedor', 'quantidade']),
    valor_unitario: firstNumber(row, ['valorUnitario', 'valor_unitario', 'valorUnitarioHomologado']),
    valor_total: firstNumber(row, ['valorTotal', 'valor_total', 'valorTotalHomologado']),
    raw_data: raw,
  };
}

export function mapAtaRegistroPrecoUnidade(raw: AtaRegistroPrecoRaw, item: Pick<AtaRegistroPrecoItemPayload, 'item_key' | 'ata_key'>): AtaRegistroPrecoUnidadePayload {
  const row = asRecord(raw);
  const unidadeCodigo = normalizeAtaUasg(firstString(row, ['codigoUnidade', 'unidade', 'codigo_uasg', 'codigoUasg']));
  if (!unidadeCodigo) throw new Error(`Unidade participante sem codigo para item ${item.item_key}.`);

  return {
    unidade_item_key: buildAtaUnidadeItemKey(item.item_key, unidadeCodigo),
    item_key: item.item_key,
    ata_key: item.ata_key,
    unidade_codigo: unidadeCodigo,
    unidade_nome: firstString(row, ['nomeUnidade', 'nome_uasg', 'nomeUasg']),
    quantidade_autorizada: firstNumber(row, ['quantidadeAutorizada', 'quantidade_autorizada', 'quantidade']),
    quantidade_utilizada: firstNumber(row, ['quantidadeUtilizada', 'quantidade_utilizada']),
    saldo_quantidade: firstNumber(row, ['saldoQuantidade', 'saldo_quantidade', 'saldo']),
    raw_data: raw,
  };
}

export function mapAtaRegistroPrecoAdesao(raw: AtaRegistroPrecoRaw, item: Pick<AtaRegistroPrecoItemPayload, 'item_key' | 'ata_key'>): AtaRegistroPrecoAdesaoPayload {
  const row = asRecord(raw);
  const unidadeCodigo = normalizeAtaUasg(firstString(row, ['codigoUnidade', 'unidade', 'codigo_uasg', 'codigoUasg']));
  if (!unidadeCodigo) throw new Error(`Adesao sem unidade para item ${item.item_key}.`);

  return {
    adesao_key: buildAtaAdesaoKey(item.item_key, raw, unidadeCodigo),
    item_key: item.item_key,
    ata_key: item.ata_key,
    unidade_codigo: unidadeCodigo,
    unidade_nome: firstString(row, ['nomeUnidade', 'nome_uasg', 'nomeUasg']),
    quantidade_aderida: firstNumber(row, ['quantidadeAderida', 'quantidade_aderida', 'quantidade']),
    valor_aderido: firstNumber(row, ['valorAderido', 'valor_aderido', 'valorTotal']),
    data_adesao: firstDate(row, ['dataAdesao', 'data_adesao', 'dataAtualizacao']),
    situacao: firstString(row, ['situacao', 'situacaoAdesao', 'nomeSituacao']),
    raw_data: raw,
  };
}
