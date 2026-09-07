import { PNCP_API, resolvePncpReference, requireArray, parseMoney,
  type JsonRow, type RequestJson } from '../_shared/pncpContracts.ts';

export interface PncpRepository {
  updateContract(id: string, patch: JsonRow): Promise<void>;
  saveResource(table: string, id: string, rows: JsonRow[], conflict: string): Promise<JsonRow[]>;
}

export function documentRows(contratoId: string, files: JsonRow[]) {
  if (files.some((f) => !Number(f.sequencialDocumento ?? f.sequencial) || !String(f.url ?? f.uri ?? '').trim())) {
    throw new Error('Documento PNCP sem sequencial ou URL; nenhum registro foi sobrescrito.');
  }
  return files.map((f: Record<string, unknown>) => ({
    contrato_api_id: contratoId,
    sequencial_documento: Number(f.sequencialDocumento ?? f.sequencial ?? 0),
    titulo: String(f.titulo ?? f.nomeDocumento ?? f.tipoDocumentoNome ?? 'Documento'),
    tipo_documento_id: f.tipoDocumentoId != null ? Number(f.tipoDocumentoId) : null,
    tipo_documento_nome: String(f.tipoDocumentoNome ?? f.tipoDocumento ?? 'Outros Documentos'),
    url: String(f.url ?? f.uri ?? ''),
    uri: f.uri ? String(f.uri) : null,
    data_publicacao_pncp: f.dataPublicacaoPncp ? String(f.dataPublicacaoPncp) : null,
    tamanho: f.tamanho != null ? Number(f.tamanho) : null,
    raw_data: f,
    updated_at: new Date().toISOString(),
  }));
}

export function instrumentRows(contratoId: string, instData: JsonRow[]) {
  if (instData.some((raw) => !Number(raw.sequencialInstrumentoCobranca) || !String(raw.numeroInstrumentoCobranca ?? '').trim())) {
    throw new Error('Instrumento PNCP sem sequencial ou número; nenhum registro foi sobrescrito.');
  }
  return instData.map((raw: Record<string, unknown>) => {
    let notaFiscal: Record<string, unknown> | null = null;
    let itens: Array<Record<string, unknown>> = [];
    let eventos: Array<Record<string, unknown>> = [];
    let valorNota: number | null = null;

    if (raw.jsonResponseNFe && typeof raw.jsonResponseNFe === 'string') {
      try {
        const parsed = JSON.parse(raw.jsonResponseNFe);
        if (parsed && typeof parsed === 'object') {
          if (parsed.notaFiscalDTO) {
            notaFiscal = parsed.notaFiscalDTO;
            if (notaFiscal?.valorNotaFiscal) {
              const valNum = parseMoney(notaFiscal.valorNotaFiscal);
              if (valNum !== null) valorNota = valNum;
            }
          }
          if (Array.isArray(parsed.itensNotaFiscal)) itens = parsed.itensNotaFiscal;
          if (Array.isArray(parsed.eventosNotaFiscal)) eventos = parsed.eventosNotaFiscal;
        }
      } catch {
        // ignore JSON parse fallback
      }
    }

    const tipoObj = raw.tipoInstrumentoCobranca as Record<string, unknown> | undefined;

    return {
      contrato_api_id: contratoId,
      sequencial_instrumento_cobranca: Number(raw.sequencialInstrumentoCobranca ?? 0),
      tipo_id: tipoObj?.id != null ? Number(tipoObj.id) : null,
      tipo_nome: String(tipoObj?.nome ?? raw.tipoInstrumentoCobrancaNome ?? 'Nota Fiscal Eletrônica (NF-e)'),
      tipo_descricao: tipoObj?.descricao ? String(tipoObj.descricao) : null,
      numero_instrumento_cobranca: String(raw.numeroInstrumentoCobranca ?? ''),
      data_emissao: raw.dataEmissaoDocumento ? String(raw.dataEmissaoDocumento).slice(0, 10) : null,
      chave_nfe: raw.chaveNFe ? String(raw.chaveNFe) : (notaFiscal?.chaveNotaFiscal ? String(notaFiscal.chaveNotaFiscal) : null),
      data_consulta_nfe: raw.dataConsultaNFe ? String(raw.dataConsultaNFe) : null,
      status_response_nfe: raw.statusResponseNFe ? String(raw.statusResponseNFe) : null,
      valor_nota_fiscal: valorNota,
      serie: notaFiscal?.serie ? String(notaFiscal.serie) : null,
      tipo_evento_mais_recente: notaFiscal?.tipoEventoMaisRecente ? String(notaFiscal.tipoEventoMaisRecente) : null,
      data_tipo_evento_mais_recente: notaFiscal?.dataTipoEventoMaisRecente ? String(notaFiscal.dataTipoEventoMaisRecente) : null,
      nome_fornecedor: notaFiscal?.nomeFornecedor ? String(notaFiscal.nomeFornecedor) : null,
      cnpj_fornecedor: notaFiscal?.cnpjFornecedor ? String(notaFiscal.cnpjFornecedor) : null,
      municipio_fornecedor: notaFiscal?.municipioFornecedor ? String(notaFiscal.municipioFornecedor) : null,
      itens,
      eventos,
      raw_data: raw,
      updated_at: new Date().toISOString(),
    };
  });
}

export async function syncPncpContract(c: JsonRow, repository: PncpRepository,
  request: RequestJson, cache = new Map<string, JsonRow[]>()) {
  const errors: string[] = [];
  const result: { id: string; numero: string; ref?: Awaited<ReturnType<typeof resolvePncpReference>>;
    documentos?: JsonRow[]; instrumentos?: JsonRow[]; errors: string[]; status: string } = {
    id: c.id, numero: c.numero, errors, status: 'success',
  };
  await repository.updateContract(c.id, { pncp_sync_attempted_at: new Date().toISOString() });
  try {
    const ref = await resolvePncpReference(c, request, cache);
    result.ref = ref;
    if (!ref) {
      // A complete lookup is required before recording a negative result.
      // Existing documents are kept for audit; never delete them on lookup failure.
      await repository.updateContract(c.id, {
        pncp_has_record: false, pncp_documentos_checked_at: new Date().toISOString(),
        pncp_instrumentos_checked_at: new Date().toISOString(), pncp_sync_error: null,
      });
      return result;
    }
    await repository.updateContract(c.id, { pncp_sequencial: Number(ref.sequencial), pncp_ano: ref.ano,
      pncp_control_number: ref.numeroControlePNCP, pncp_has_record: true });
    const base = `${PNCP_API}/orgaos/${ref.cnpj}/contratos/${ref.ano}/${ref.sequencial}`;
    // Independent failures: an unavailable invoice endpoint must not suppress PDFs.
    for (const resource of ['documentos', 'instrumentos'] as const) {
      try {
        const docs = resource === 'documentos';
        const data = requireArray(await request(`${base}/${docs ? 'arquivos' : 'instrumentocobranca'}`));
        const rows = docs ? documentRows(c.id, data) : instrumentRows(c.id, data);
        const saved = await repository.saveResource(
          docs ? 'contratos_api_documentos' : 'contratos_api_instrumentos_cobranca', c.id, rows,
          docs ? 'contrato_api_id,sequencial_documento,url' : 'contrato_api_id,sequencial_instrumento_cobranca,numero_instrumento_cobranca');
        await repository.updateContract(c.id, {
          [`pncp_${resource}_checked_at`]: new Date().toISOString(),
          [`pncp_${resource}_count`]: saved.length,
        });
        result[resource] = saved;
      } catch (error) {
        errors.push(`${resource}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  result.status = errors.length ? 'partial_error' : 'success';
  await repository.updateContract(c.id, { pncp_sync_error: errors.length ? errors.join('; ') : null });
  return result;
}
