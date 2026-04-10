import { supabase } from '@/lib/supabase';
import { DocumentoDespesa, DocumentoDespesaAPI, OperacaoEmpenho, DocumentoItem, Retencao, CreditoDisponivel } from '@/types';
import { parseCurrency } from '@/lib/utils';
import { addDays, format, isAfter, isBefore, parse } from 'date-fns';
import { dominioService } from './dominio';
import { creditosDisponiveisService } from './creditosDisponiveis';

const API_BASE = '/api-transparencia/api-de-dados/despesas/documentos';
const API_HISTORICO = '/api-transparencia/api-de-dados/despesas/itens-de-empenho/historico';
const UNIDADE_GESTORA = '158366';
const GESTAO = '26435';
const API_KEY = '931d4d57337bef94e775337c318342e9';
const DOCUMENTOS_HABEIS_SELECT = 'id,valor_original,valor_pago,estado,processo,favorecido_nome,favorecido_documento,data_emissao,fonte_sof,empenho_id';
const DOCUMENTOS_HABEIS_ITENS_SELECT = 'id,documento_habil_id,doc_tipo,data_emissao,valor,observacao';
const DOCUMENTOS_HABEIS_SITUACOES_SELECT = 'id,documento_habil_id,situacao_codigo,valor,is_retencao,created_at';

// Delay para evitar Rate Limit (se necessário)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeDocId = (id: string | undefined): string => {
    if (!id) return '';
    const trimmed = id.trim();
    return trimmed.length > 12 ? trimmed.slice(-12) : trimmed;
};

type DocumentoImportState = {
    doc: {
        id: string;
        valor_original: number;
        processo: string;
        estado: string;
        favorecido_documento: string;
        favorecido_nome: string;
        data_emissao: string;
        updated_at: string;
    };
    situacoes: Map<string, {
        documento_habil_id: string;
        situacao_codigo: string;
        valor: number;
        is_retencao: boolean;
    }>;
    itens: Map<string, {
        id: string;
        documento_habil_id: string;
        doc_tipo: string;
        valor: number;
        data_emissao: string;
        observacao: string;
    }>;
};

export const transparenciaService = {
    async getDocumentos(filters?: {
        startDate?: Date;
        endDate?: Date;
        search?: string;
        page?: number;
        perPage?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    }): Promise<{ data: DocumentoDespesa[]; total: number }> {
        const page = filters?.page || 1;
        const perPage = filters?.perPage || 10;
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;

        let query = supabase
            .from('documentos_habeis')
            .select('*, itens:documentos_habeis_itens(*), situacoes:documentos_habeis_situacoes(*)', { count: 'exact' });

        if (filters?.orderBy) {
            let orderCol = filters.orderBy;
            if (orderCol === 'dataEmissao') orderCol = 'data_emissao';
            if (orderCol === 'documento') orderCol = 'id';
            query = query.order(orderCol, { ascending: filters.orderDirection === 'asc' });
        } else {
            query = query.order('data_emissao', { ascending: false });
        }

        query = query.range(from, to);

        if (filters?.startDate) {
            query = query.gte('data_emissao', format(filters.startDate, 'yyyy-MM-dd'));
        }
        if (filters?.endDate) {
            query = query.lte('data_emissao', format(filters.endDate, 'yyyy-MM-dd'));
        }
        if (filters?.search) {
            query = query.or(`id.ilike.%${filters.search}%,observacao.ilike.%${filters.search}%,favorecido_nome.ilike.%${filters.search}%,favorecido_documento.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        const mappedData: DocumentoDespesa[] = (data as Array<Record<string, unknown>>).map((doc) => ({
            id: String(doc.id || ''),
            valor_original: Number(doc.valor_original || 0),
            valor_pago: Number(doc.valor_pago || 0),
            estado: String(doc.estado || 'PENDENTE DE REALIZAÇÃO'),
            processo: String(doc.processo || ''),
            favorecido_nome: String(doc.favorecido_nome || ''),
            favorecido_documento: String(doc.favorecido_documento || ''),
            data_emissao: String(doc.data_emissao || ''),
            fonte_sof: doc.fonte_sof ? String(doc.fonte_sof) : undefined,
            empenho_id: doc.empenho_id ? String(doc.empenho_id) : undefined,
            itens: ((doc.itens || []) as Array<Record<string, unknown>>).map((item) => ({
                id: String(item.id || ''),
                documento_habil_id: String(item.documento_habil_id || ''),
                doc_tipo: String(item.doc_tipo || ''),
                data_emissao: item.data_emissao ? String(item.data_emissao) : undefined,
                valor: Number(item.valor || 0),
                observacao: item.observacao ? String(item.observacao) : undefined
            })),
            situacoes: ((doc.situacoes || []) as Array<Record<string, unknown>>).map((sit) => ({
                id: sit.id ? String(sit.id) : undefined,
                documento_habil_id: String(sit.documento_habil_id || ''),
                situacao_codigo: String(sit.situacao_codigo || ''),
                valor: Number(sit.valor || 0),
                is_retencao: Boolean(sit.is_retencao)
            }))
        }));

        return { data: mappedData, total: count || 0 };
    },

    async getEmpenhoImpactado(codigoDocumento: string, fase: number): Promise<{ empenho: string; empenhoResumido: string; valorLiquidado: number; valorRestoPago: number } | null> {
        try {
            const response = await fetch(
                `/api-transparencia/api-de-dados/despesas/empenhos-impactados?codigoDocumento=${codigoDocumento}&fase=${fase}&pagina=1`,
                {
                    headers: {
                        'accept': '*/*',
                        'chave-api-dados': API_KEY,
                    },
                }
            );

            if (!response.ok) return null;

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                return {
                    empenho: data[0].empenho,
                    empenhoResumido: data[0].empenhoResumido,
                    valorLiquidado: parseCurrency(data[0].valorLiquidado),
                    valorRestoPago: parseCurrency(data[0].valorRestoPago)
                };
            }
            return null;
        } catch (error) {
            console.error('Erro ao buscar impacto:', error);
            return null;
        }
    },

    async getDocumentoCompleto(id: string): Promise<DocumentoDespesa> {
        const { data: doc, error: docError } = await supabase
            .from('documentos_habeis')
            .select(DOCUMENTOS_HABEIS_SELECT)
            .eq('id', id)
            .single();

        if (docError) throw docError;

        const { data: itens, error: itensError } = await supabase
            .from('documentos_habeis_itens')
            .select(DOCUMENTOS_HABEIS_ITENS_SELECT)
            .eq('documento_habil_id', id)
            .order('data_emissao', { ascending: false });

        if (itensError) throw itensError;

        const { data: situacoes, error: sitError } = await supabase
            .from('documentos_habeis_situacoes')
            .select(DOCUMENTOS_HABEIS_SITUACOES_SELECT)
            .eq('documento_habil_id', id);

        if (sitError) throw sitError;

        return {
            id: doc.id,
            valor_original: Number(doc.valor_original || 0),
            valor_pago: Number(doc.valor_pago || 0),
            estado: String(doc.estado || 'PENDENTE DE REALIZAÇÃO'),
            processo: doc.processo || '',
            favorecido_nome: doc.favorecido_nome || '',
            favorecido_documento: doc.favorecido_documento || '',
            data_emissao: doc.data_emissao,
            fonte_sof: doc.fonte_sof,
            empenho_id: doc.empenho_id,
            itens: (itens as Array<Record<string, unknown>>).map((item) => ({
                id: String(item.id || ''),
                documento_habil_id: String(item.documento_habil_id || ''),
                doc_tipo: String(item.doc_tipo || ''),
                data_emissao: item.data_emissao ? String(item.data_emissao) : undefined,
                valor: Number(item.valor || 0),
                observacao: item.observacao ? String(item.observacao) : undefined
            })),
            situacoes: (situacoes as Array<Record<string, unknown>>).map((sit) => ({
                id: sit.id ? String(sit.id) : undefined,
                documento_habil_id: String(sit.documento_habil_id || ''),
                situacao_codigo: String(sit.situacao_codigo || ''),
                valor: Number(sit.valor || 0),
                is_retencao: Boolean(sit.is_retencao),
                created_at: sit.created_at ? String(sit.created_at) : undefined
            }))
        };
    },

    async getLastDocumentoDate(): Promise<Date | null> {
        const { data, error } = await supabase
            .from('documentos_habeis')
            .select('data_emissao')
            .order('data_emissao', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) return null;
        return data ? new Date(`${data.data_emissao}T12:00:00`) : null;
    },

    async importDocumentosHabeis(data: Record<string, string>[]): Promise<void> {
        const docsMap = new Map<string, DocumentoImportState>();
        
        for (const row of data) {
            const rawId = row['documentohabil'] || row['dhdocumentohabil'] || row['documento_habil'] || '';
            const id = normalizeDocId(rawId);
            if (!id) continue;

            if (!docsMap.has(id)) {
                const dataEmissao = row['dhdataemissaodocorigem'] || row['data_emissao_doc_origem'] || row['dataemissao'] || '';
                let formattedDate = new Date().toISOString().split('T')[0];
                if (dataEmissao.includes('/')) {
                    const [d, m, y] = dataEmissao.split('/');
                    formattedDate = `${y}-${m}-${d}`;
                }

                let favorecidoNome = row['favorecidonome'] || '';
                if (!favorecidoNome) {
                    const keys = Object.keys(row);
                    const credorIdx = keys.findIndex(k => k === 'dhcredor' || k === 'credor');
                    if (credorIdx !== -1 && keys[credorIdx + 1] && keys[credorIdx + 1].startsWith('empty_')) {
                        favorecidoNome = row[keys[credorIdx + 1]];
                    }
                }

                docsMap.set(id, {
                    doc: {
                        id,
                        valor_original: Number((row['dhvalordocorigem'] || row['valor'] || '0').replace(/[^\d.,]/g, '').replace(',', '.')),
                        processo: row['dhprocesso'] || row['processo'] || '',
                        estado: row['dhestado'] || row['estado'] || 'PENDENTE',
                        favorecido_documento: row['dhcredor'] || row['credor'] || '',
                        favorecido_nome: favorecidoNome,
                        data_emissao: formattedDate,
                        updated_at: new Date().toISOString()
                    },
                    situacoes: new Map<string, DocumentoImportState['situacoes'] extends Map<string, infer V> ? V : never>(),
                    itens: new Map<string, DocumentoImportState['itens'] extends Map<string, infer V> ? V : never>()
                });
            }

            const docData = docsMap.get(id);
            if (!docData) continue;

            const situacaoCodigo = row['dhsituacao'] || '';
            const valueSituacao = Number((row['metricavalor'] || row['dhvalordocorigem'] || row['valor'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
            
            if (situacaoCodigo && !['OB', 'NS', 'NC', 'DR', 'GR'].includes(situacaoCodigo)) {
                const sitKey = `${situacaoCodigo}-${valueSituacao}`;
                docData.situacoes.set(sitKey, {
                    documento_habil_id: id,
                    situacao_codigo: situacaoCodigo,
                    valor: valueSituacao,
                    is_retencao: situacaoCodigo.startsWith('DDF') || 
                                situacaoCodigo.startsWith('DDU') || 
                                situacaoCodigo === 'DOB001' || 
                                situacaoCodigo === 'DOB035'
                });
            }

            const itemTipo = row['dhitem'] || situacaoCodigo;
            const itemIdRaw = row['dhdocorigem'] || '';
            const itemId = normalizeDocId(itemIdRaw);

            if (['OB', 'NS', 'NC', 'DR', 'GR'].includes(itemTipo)) {
                const itemValor = Number((row['dhvalordocorigem'] || row['valor'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
                const finalItemId = itemId || `${id}-${itemTipo}-${itemValor}`;
                
                docData.itens.set(finalItemId, {
                    id: finalItemId,
                    documento_habil_id: id,
                    doc_tipo: itemTipo,
                    valor: itemValor,
                    data_emissao: docData.doc.data_emissao, 
                    observacao: row['observacao'] || row['docobservacao'] || ''
                });
            }
        }

        const allDocs = Array.from(docsMap.values()).map(d => d.doc);
        const { error: docError } = await supabase.from('documentos_habeis').upsert(allDocs, { onConflict: 'id' });
        if (docError) throw docError;

        const docIds = allDocs.map(d => d.id);

        await supabase.from('documentos_habeis_situacoes').delete().in('documento_habil_id', docIds);
        const allSituacoes = Array.from(docsMap.values()).flatMap(d => Array.from(d.situacoes.values()));
        if (allSituacoes.length > 0) {
            const { error: sitError } = await supabase.from('documentos_habeis_situacoes').insert(allSituacoes);
            if (sitError) throw sitError;
        }

        await supabase.from('documentos_habeis_itens').delete().in('documento_habil_id', docIds);
        const allItens = Array.from(docsMap.values()).flatMap(d => Array.from(d.itens.values()));
        if (allItens.length > 0) {
            const { error: itemError } = await supabase.from('documentos_habeis_itens').insert(allItens);
            if (itemError) throw itemError;
        }
    },

    async importLiquidacoes(data: Record<string, string>[]): Promise<void> {
        const dhUpdates: Map<string, { empenho_numero?: string, fonte_sof?: string }> = new Map();
        const empenhoNumbers = new Set<string>();

        for (const row of data) {
            const rawId = row['documentoorigem'] || row['documento origem'] || row['ne ccor'] || row['neccor'] || row['documento'] || '';
            const id = normalizeDocId(rawId);
            if (!id) continue;

            const neccor = row['ne ccor'] || row['neccor'] || row['empenho'] || '';
            const fonte = row['fontesof'] || row['fonte'] || row['fontedo_recurso'] || '';
            
            const updateData: { empenho_numero?: string; fonte_sof?: string } = {};
            if (neccor) {
                updateData.empenho_numero = neccor;
                empenhoNumbers.add(neccor);
            }
            if (fonte && !['158366', '26435'].includes(fonte)) {
                updateData.fonte_sof = fonte;
            }
            if (Object.keys(updateData).length > 0) {
                dhUpdates.set(id, { ...dhUpdates.get(id), ...updateData });
            }
        }

        if (empenhoNumbers.size > 0) {
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('numero, origem_recurso')
                .in('numero', Array.from(empenhoNumbers));
            const empenhoFonteMap = new Map(empenhos?.map(e => [e.numero, e.origem_recurso]) || []);
            for (const [id, update] of dhUpdates.entries()) {
                if (!update.fonte_sof && update.empenho_numero) {
                    const fetchedFonte = empenhoFonteMap.get(update.empenho_numero);
                    if (fetchedFonte) update.fonte_sof = fetchedFonte;
                }
            }
        }

        for (const [id, update] of dhUpdates.entries()) {
            await supabase.from('documentos_habeis').update(update).eq('id', id);
        }
    },

    async importOrdensBancarias(data: Record<string, string>[]): Promise<void> {
        const itemsMap: Map<string, { id: string; documento_habil_id: string; doc_tipo: string; valor: number; data_emissao: string; observacao: string }> = new Map();
        const parentUpdates: Map<string, { empenho_numero?: string, fonte_sof?: string }> = new Map();
        const empenhoNumbers = new Set<string>();

        for (const row of data) {
            const rawId = row['documento'] || '';
            const rawDhId = row['documentoorigem'] || row['documento origem'] || '';
            const id = normalizeDocId(rawId);
            const dhId = normalizeDocId(rawDhId);
            if (!id || !dhId) continue;

            const neccor = row['ne ccor'] || row['neccor'] || row['empenho'] || '';
            if (neccor) {
                parentUpdates.set(dhId, { ...parentUpdates.get(dhId), empenho_numero: neccor });
                empenhoNumbers.add(neccor);
            }

            const valorStr = row['despesaspagas'] || row['restosapagarpagosprocenproc'] || row['valor'] || '0';
            let valor = 0;
            if (valorStr) {
                const cleaned = valorStr.replace(/\s/g, '');
                if (cleaned.includes(',') && cleaned.includes('.')) {
                    valor = Number(cleaned.replace(/\./g, '').replace(',', '.'));
                } else if (cleaned.includes(',')) {
                    valor = Number(cleaned.replace(',', '.'));
                } else {
                    valor = Number(cleaned);
                }
            }
            
            const dataLancamento = row['dialancamento'] || '';
            let formattedDate = new Date().toISOString().split('T')[0];
            if (dataLancamento.includes('/')) {
                const [d, m, y] = dataLancamento.split('/');
                formattedDate = `${y}-${m}-${d}`;
            }

            if (itemsMap.has(id)) {
                itemsMap.get(id).valor += valor;
            } else {
                itemsMap.set(id, {
                    id,
                    documento_habil_id: dhId,
                    doc_tipo: row['doctipo'] || 'OB',
                    valor,
                    data_emissao: formattedDate,
                    observacao: row['docobservacao'] || ''
                });
            }
        }

        const items = Array.from(itemsMap.values());
        if (items.length > 0) {
            const uniqueDhIds = Array.from(new Set(items.map(i => i.documento_habil_id)));
            const { data: validIds } = await supabase.from('documentos_habeis').select('id').in('id', uniqueDhIds);
            const existingIds = new Set(validIds?.map(v => v.id) || []);
            const filteredItems = items.filter(i => existingIds.has(i.documento_habil_id));

            if (filteredItems.length > 0) {
                const { error } = await supabase.from('documentos_habeis_itens').upsert(filteredItems, { onConflict: 'id' });
                if (error) throw error;
            }
        }

        if (empenhoNumbers.size > 0) {
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('numero, origem_recurso')
                .in('numero', Array.from(empenhoNumbers));
            const empenhoFonteMap = new Map(empenhos?.map(e => [e.numero, e.origem_recurso]) || []);
            for (const [dhId, update] of parentUpdates.entries()) {
                if (update.empenho_numero) {
                    const fetchedFonte = empenhoFonteMap.get(update.empenho_numero);
                    if (fetchedFonte) update.fonte_sof = fetchedFonte;
                    await supabase.from('documentos_habeis').update(update).eq('id', dhId);
                }
            }
        }
    },

    async getCreditosDisponiveis(): Promise<CreditoDisponivel[]> {
        return creditosDisponiveisService.getAll();
    },

    async importCreditosDisponiveis(data: Record<string, string>[]): Promise<void> {
        const updatesMap = new Map<string, { ptres: string; metrica: string; valor: number; updated_at: string }>();
        data.forEach(row => {
            const ptres = (row['ptres'] || row['PTRES'] || '').toString().trim();
            const metrica = (row['metrica'] || row['métrica'] || row['Métrica'] || '').toString().trim();
            const valorStr = (row['valor_disponivel'] || row['valor_diponivel'] || row['valor'] || row['Valor'] || '').toString();

            if (!ptres) return;

            let valor = 0;
            if (valorStr) {
                const cleaned = valorStr.trim().replace(/\s/g, '');
                if (cleaned.includes(',') && cleaned.includes('.')) {
                    valor = Number(cleaned.replace(/\./g, '').replace(',', '.'));
                } else if (cleaned.includes(',')) {
                    valor = Number(cleaned.replace(',', '.'));
                } else {
                    valor = Number(cleaned);
                }
            }

            if (updatesMap.has(ptres)) {
                const existing = updatesMap.get(ptres);
                existing.valor += valor;
                existing.updated_at = new Date().toISOString();
            } else {
                updatesMap.set(ptres, {
                    ptres,
                    metrica,
                    valor,
                    updated_at: new Date().toISOString()
                });
            }
        });

        const updates = Array.from(updatesMap.values());
        if (updates.length > 0) {
            const { error } = await supabase.from('creditos_disponiveis').upsert(updates, { onConflict: 'ptres' });
            if (error) throw error;
        }
    }
};

