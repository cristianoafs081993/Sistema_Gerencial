export type RawRow = Record<string, unknown>;
const text = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const positive = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

export function syncWindow(body: RawRow, now = new Date()) {
  if (body.mode !== 'backfill_mensal') return { start: new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
  const year = Number(body.ano ?? now.getUTCFullYear()), month = Number(body.mes ?? 1);
  if (!Number.isInteger(year) || year < 2021 || year > now.getUTCFullYear() || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Ano/mês inválido.');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDay = Number(body.startDay ?? 1), endDay = Number(body.endDay ?? last);
  if (!Number.isInteger(startDay) || !Number.isInteger(endDay) || startDay < 1 || endDay > last || startDay > endDay) throw new Error('Intervalo de dias inválido.');
  return { start: new Date(Date.UTC(year, month - 1, startDay)).toISOString().slice(0, 10), end: new Date(Date.UTC(year, month - 1, endDay)).toISOString().slice(0, 10) };
}

export function mapReference(it: RawRow, scope: string): RawRow | null {
  const control = text(it.numeroControlePNCPCompra || it.idContratacaoPNCP);
  const key = control.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  const item = Number(it.numeroItemPncp || it.numeroItemCompra);
  const price = positive(it.valorUnitarioResultado);
  const publication = text(it.dataInclusaoPncp), resultDate = text(it.dataResultado);
  const description = text(it.descricaoResumida || it.descricaodetalhada);
  // Never fabricate identifiers, dates, quantities or prices for incomplete rows.
  if (!key || !Number.isInteger(item) || item < 1 || !price || !description || !Number.isFinite(Date.parse(publication)) || !Number.isFinite(Date.parse(resultDate))) return null;
  const uf = text(it.unidadeOrgaoUfSigla).toUpperCase();
  const sphere = text(it.orgaoEntidadeEsferaId || it.esferaId);
  const northeast = ['RN','PB','CE','PE','AL','SE','BA','PI','MA'].includes(uf);
  // Missing sphere is kept as unknown, never inferred from UASG prefixes.
  if (scope === 'federal_rn_nordeste' && uf && sphere && sphere !== 'F' && !northeast) return null;
  const quantity = positive(it.quantidadeResultado || it.quantidade);
  if (!quantity) return null;
  return {
    source_id: `pncp:${control}:${item}`, numero_controle_pncp: control, numero_item: item,
    codigo_item_catalogo: text(it.codItemCatalogo) || null,
    tipo_catalogo: it.materialOuServico === 'S' || /servi[çc]o/i.test(text(it.materialOuServicoNome)) ? 'servico' : 'material',
    descricao_item: description, descricao_detalhada: text(it.descricaodetalhada) || null,
    unidade_medida: text(it.unidadeMedida).toUpperCase(), quantidade: quantity,
    valor_unitario: price, valor_total: positive(it.valorTotalResultado) || price * quantity,
    marca: text(it.marca) || null, fornecedor_nome: text(it.nomeFornecedor) || null,
    fornecedor_cnpj: text(it.codFornecedor).replace(/\D/g, '') || null,
    orgao_nome: text(it.orgaoEntidadeRazaoSocial || it.orgaoNome) || `Órgão CNPJ ${key[1]}`,
    orgao_cnpj: key[1], orgao_esfera: ({ F: 'Federal', E: 'Estadual', M: 'Municipal', D: 'Distrital' } as Record<string,string>)[sphere] || 'Não informada',
    orgao_uf: uf || null, uasg_codigo: text(it.unidadeOrgaoCodigoUnidade) || null,
    modalidade_nome: text(it.modalidadeNome) || null, ano_compra: Number(key[3]), numero_compra: text(it.idCompra) || null,
    data_publicacao_pncp: new Date(publication).toISOString(), data_resultado: new Date(resultDate).toISOString(),
    link_pncp: `https://pncp.gov.br/app/editais/${key[1]}/${key[3]}/${Number(key[2])}`,
    amostra_valida: true, price_kind: 'homologado', raw_data: it,
  };
}

export function validatePage(payload: unknown, page: number) {
  const p = payload as { resultado?: unknown; totalPaginas?: unknown; totalRegistros?: unknown };
  if (!p || !Array.isArray(p.resultado) || !Number.isInteger(Number(p.totalPaginas)) || Number(p.totalPaginas) < 0) throw new Error('Resposta de paginação inválida.');
  const totalPages = Number(p.totalPaginas);
  if (p.resultado.length === 0 && page <= totalPages && Number(p.totalRegistros) !== 0) throw new Error('Página vazia antes do término da fonte.');
  return { items: p.resultado as RawRow[], totalPages };
}
