export const IFRN_CNPJ = '10877412000168';
export const DEFAULT_PNCP_UASG = '158366';
export const PREGAO_ELETRONICO_MODALIDADE_ID = 6;
export const PNCP_MAX_WINDOW_DAYS = 365;
export const PNCP_PUBLICATION_ENDPOINT = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
export const PNCP_ITEMS_ENDPOINT_BASE = 'https://pncp.gov.br/api/consulta/v1/orgaos';

export type PncpUasgCatalogItem = {
  codigo: string;
  nome: string;
  cnpj: string;
  codigoOrgao: string;
  aliases?: string[];
};

export const IFRN_UASG_CATALOG: PncpUasgCatalogItem[] = [
  { codigo: '152711', nome: 'Natal - Cidade Alta', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '152756', nome: 'Parnamirim', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '152757', nome: 'Nova Cruz', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '154582', nome: 'São Gonçalo do Amarante', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '154838', nome: 'Ceará-Mirim', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '154839', nome: 'Canguaretama', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '154840', nome: 'São Paulo do Potengi', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158155', nome: 'Reitoria', cnpj: IFRN_CNPJ, codigoOrgao: '26435', aliases: ['Lajes', 'Natal - Zona Leste (EAD)'] },
  { codigo: '158365', nome: 'Mossoró', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158366', nome: 'Currais Novos', cnpj: IFRN_CNPJ, codigoOrgao: '26435', aliases: ['Jucurutu', 'Parelhas'] },
  { codigo: '158367', nome: 'Ipanguaçu', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158368', nome: 'Natal - Zona Norte', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158369', nome: 'Natal - Central', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158370', nome: 'Caicó', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158371', nome: 'Apodi', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158372', nome: 'Santa Cruz', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158373', nome: 'João Câmara', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158374', nome: 'Pau dos Ferros', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
  { codigo: '158375', nome: 'Macau', cnpj: IFRN_CNPJ, codigoOrgao: '26435' },
];

export const DEFAULT_PNCP_UASGS = IFRN_UASG_CATALOG.map((item) => item.codigo);

export type PncpCompraRaw = Record<string, unknown>;
export type PncpItemRaw = Record<string, unknown>;

type UnidadeOrgao = {
  codigoUnidade?: unknown;
  nomeUnidade?: unknown;
  ufSigla?: unknown;
  municipioNome?: unknown;
  codigoIbge?: unknown;
};

type OrgaoEntidade = {
  cnpj?: unknown;
  razaoSocial?: unknown;
};

type AmparoLegal = {
  codigo?: unknown;
  nome?: unknown;
  descricao?: unknown;
};

export type LicitacaoPncpPayload = {
  numero_controle_pncp: string;
  cnpj_orgao: string;
  razao_social_orgao: string | null;
  ano_compra: number;
  sequencial_compra: number;
  numero_compra: string | null;
  processo: string | null;
  objeto_compra: string | null;
  modalidade_id: number | null;
  modalidade_nome: string | null;
  modo_disputa_id: number | null;
  modo_disputa_nome: string | null;
  situacao_compra_id: number | null;
  situacao_compra_nome: string | null;
  uasg_codigo: string | null;
  uasg_nome: string | null;
  unidade_uf: string | null;
  unidade_municipio: string | null;
  unidade_codigo_ibge: string | null;
  valor_total_estimado: number | null;
  valor_total_homologado: number | null;
  srp: boolean | null;
  data_publicacao_pncp: string | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  data_inclusao: string | null;
  data_atualizacao: string | null;
  data_atualizacao_global: string | null;
  amparo_legal_codigo: number | null;
  amparo_legal_nome: string | null;
  amparo_legal_descricao: string | null;
  tipo_instrumento_convocatorio_codigo: number | null;
  tipo_instrumento_convocatorio_nome: string | null;
  usuario_nome: string | null;
  informacao_complementar: string | null;
  link_sistema_origem: string | null;
  link_processo_eletronico: string | null;
  raw_data: PncpCompraRaw;
};

export type DateWindow = {
  dataInicial: string;
  dataFinal: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return null;
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  return null;
}

function toIsoStringOrNull(value: unknown): string | null {
  const raw = toStringOrNull(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

export function normalizePncpDate(value: string | Date): string {
  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, '0'),
      String(value.getUTCDate()).padStart(2, '0'),
    ].join('');
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length === 8) return digits;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data PNCP invalida: ${value}`);
  }
  return normalizePncpDate(parsed);
}

function parsePncpDate(value: string): Date {
  const normalized = normalizePncpDate(value);
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function splitPncpDateRange(dataInicial: string, dataFinal: string, maxDays = PNCP_MAX_WINDOW_DAYS): DateWindow[] {
  if (maxDays < 1) throw new Error('A janela minima deve ser de 1 dia.');

  const start = parsePncpDate(dataInicial);
  const end = parsePncpDate(dataFinal);
  if (start > end) throw new Error('A data inicial nao pode ser maior que a data final.');

  const windows: DateWindow[] = [];
  let cursor = start;
  while (cursor <= end) {
    const windowEnd = addUtcDays(cursor, maxDays - 1);
    const resolvedEnd = windowEnd < end ? windowEnd : end;
    windows.push({
      dataInicial: normalizePncpDate(cursor),
      dataFinal: normalizePncpDate(resolvedEnd),
    });
    cursor = addUtcDays(resolvedEnd, 1);
  }

  return windows;
}

export function buildPncpCompraUrl(cnpj: string, anoCompra: number, sequencialCompra: number) {
  return `https://pncp.gov.br/app/editais/${cnpj}/${anoCompra}/${sequencialCompra}`;
}

export function buildPncpPublicationUrl(params: {
  cnpj: string;
  unidadeCodigo?: string | null;
  dataInicial: string;
  dataFinal: string;
  modalidadeId: number;
  pagina: number;
}) {
  const search = new URLSearchParams({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: String(params.modalidadeId),
    cnpj: params.cnpj,
    pagina: String(params.pagina),
  });

  if (params.unidadeCodigo) {
    search.set('codigoUnidadeAdministrativa', params.unidadeCodigo);
  }

  return `${PNCP_PUBLICATION_ENDPOINT}?${search.toString()}`;
}

export function buildPncpItemsUrl(params: {
  cnpj: string;
  anoCompra: number;
  sequencialCompra: number;
  pagina?: number;
  tamanhoPagina?: number;
}) {
  const search = new URLSearchParams();
  if (params.pagina) search.set('pagina', String(params.pagina));
  if (params.tamanhoPagina) search.set('tamanhoPagina', String(params.tamanhoPagina));

  const query = search.toString();
  const path = `${PNCP_ITEMS_ENDPOINT_BASE}/${params.cnpj}/compras/${params.anoCompra}/${params.sequencialCompra}/itens`;
  return query ? `${path}?${query}` : path;
}

export function normalizePncpSearchText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function pncpItemMatchesSearch(item: PncpItemRaw, search?: string) {
  const needle = normalizePncpSearchText(search);
  if (!needle) return true;
  return normalizePncpSearchText(JSON.stringify(item)).includes(needle);
}

export function pncpCompraMatchesItemSearch(raw: PncpCompraRaw, itemBusca?: string) {
  const needle = normalizePncpSearchText(itemBusca);
  if (!needle) return true;

  const itens = raw.itens;
  if (!Array.isArray(itens)) return false;
  return itens.some((item) => pncpItemMatchesSearch(asRecord(item), needle));
}

function toComprasGovModalidadeCodigo(modalidadeId: number) {
  if (modalidadeId === PREGAO_ELETRONICO_MODALIDADE_ID) return 5;
  return modalidadeId;
}

export function buildComprasGovCompraKey(uasgCodigo: string | null, modalidadeId: number | null, numeroCompra: string | null, anoCompra: number | null) {
  if (!uasgCodigo || !modalidadeId || !numeroCompra || !anoCompra) return null;
  return `${uasgCodigo}${String(toComprasGovModalidadeCodigo(modalidadeId)).padStart(2, '0')}${String(numeroCompra).padStart(5, '0')}${anoCompra}`;
}

export function mapPncpCompra(raw: PncpCompraRaw): LicitacaoPncpPayload {
  const unidade = asRecord(raw.unidadeOrgao) as UnidadeOrgao;
  const orgao = asRecord(raw.orgaoEntidade) as OrgaoEntidade;
  const amparo = asRecord(raw.amparoLegal) as AmparoLegal;
  const numeroControlePNCP = toStringOrNull(raw.numeroControlePNCP);
  const anoCompra = toNumberOrNull(raw.anoCompra);
  const sequencialCompra = toNumberOrNull(raw.sequencialCompra);

  if (!numeroControlePNCP) throw new Error('Compra PNCP sem numeroControlePNCP.');
  if (!anoCompra || !sequencialCompra) throw new Error(`Compra PNCP ${numeroControlePNCP} sem ano/sequencial.`);

  return {
    numero_controle_pncp: numeroControlePNCP,
    cnpj_orgao: toStringOrNull(orgao.cnpj) ?? IFRN_CNPJ,
    razao_social_orgao: toStringOrNull(orgao.razaoSocial),
    ano_compra: anoCompra,
    sequencial_compra: sequencialCompra,
    numero_compra: toStringOrNull(raw.numeroCompra),
    processo: toStringOrNull(raw.processo),
    objeto_compra: toStringOrNull(raw.objetoCompra),
    modalidade_id: toNumberOrNull(raw.modalidadeId),
    modalidade_nome: toStringOrNull(raw.modalidadeNome),
    modo_disputa_id: toNumberOrNull(raw.modoDisputaId),
    modo_disputa_nome: toStringOrNull(raw.modoDisputaNome),
    situacao_compra_id: toNumberOrNull(raw.situacaoCompraId),
    situacao_compra_nome: toStringOrNull(raw.situacaoCompraNome),
    uasg_codigo: toStringOrNull(unidade.codigoUnidade),
    uasg_nome: toStringOrNull(unidade.nomeUnidade),
    unidade_uf: toStringOrNull(unidade.ufSigla),
    unidade_municipio: toStringOrNull(unidade.municipioNome),
    unidade_codigo_ibge: toStringOrNull(unidade.codigoIbge),
    valor_total_estimado: toNumberOrNull(raw.valorTotalEstimado),
    valor_total_homologado: toNumberOrNull(raw.valorTotalHomologado),
    srp: toBooleanOrNull(raw.srp),
    data_publicacao_pncp: toIsoStringOrNull(raw.dataPublicacaoPncp),
    data_abertura_proposta: toIsoStringOrNull(raw.dataAberturaProposta),
    data_encerramento_proposta: toIsoStringOrNull(raw.dataEncerramentoProposta),
    data_inclusao: toIsoStringOrNull(raw.dataInclusao),
    data_atualizacao: toIsoStringOrNull(raw.dataAtualizacao),
    data_atualizacao_global: toIsoStringOrNull(raw.dataAtualizacaoGlobal),
    amparo_legal_codigo: toNumberOrNull(amparo.codigo),
    amparo_legal_nome: toStringOrNull(amparo.nome),
    amparo_legal_descricao: toStringOrNull(amparo.descricao),
    tipo_instrumento_convocatorio_codigo: toNumberOrNull(raw.tipoInstrumentoConvocatorioCodigo),
    tipo_instrumento_convocatorio_nome: toStringOrNull(raw.tipoInstrumentoConvocatorioNome),
    usuario_nome: toStringOrNull(raw.usuarioNome),
    informacao_complementar: toStringOrNull(raw.informacaoComplementar),
    link_sistema_origem: toStringOrNull(raw.linkSistemaOrigem),
    link_processo_eletronico: toStringOrNull(raw.linkProcessoEletronico),
    raw_data: raw,
  };
}
