import { supabase } from '@/lib/supabase';
import { DocumentoDespesa, DocumentoDespesaAPI, OperacaoEmpenho, DocumentoItem, Retencao } from '@/types';
import { parseCurrency } from '@/lib/utils';
import { addDays, format, isAfter, isBefore, parse } from 'date-fns';
import { dominioService } from './dominio';

const API_BASE = '/api-transparencia/api-de-dados/despesas/documentos';
const API_HISTORICO = '/api-transparencia/api-de-dados/despesas/itens-de-empenho/historico';
const UNIDADE_GESTORA = '158366';
const GESTAO = '26435';
const API_KEY = '931d4d57337bef94e775337c318342e9';

// Delay para evitar Rate Limit (se necessário)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeDocId = (id: string | undefined): string => {
    if (!id) return '';
    const trimmed = id.trim();
    // Os IDs curtos têm 12 caracteres (ex: 2026NP000001). 
    // Os logos têm ~23. Tomamos sempre os últimos 12 para garantir o vínculo.
    return trimmed.length > 12 ? trimmed.slice(-12) : trimmed;
};

export const transparenciaService = {
    // Buscar documentos do Supabase com filtros
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

        // Ordenação
        if (filters?.orderBy) {
            // Mapear colunas de ordenação da UI para o banco se necessário
            let orderCol = filters.orderBy;
            if (orderCol === 'dataEmissao') orderCol = 'data_emissao';
            if (orderCol === 'documento') orderCol = 'id';
            
            query = query.order(orderCol, { ascending: filters.orderDirection === 'asc' });
        } else {
            query = query.order('data_emissao', { ascending: false });
        }

        // Paginação
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

        const mappedData: DocumentoDespesa[] = (data as any[]).map((doc) => ({
            id: doc.id,
            valor_original: Number(doc.valor_original || 0),
            valor_pago: Number(doc.valor_pago || 0),
            estado: doc.estado || 'PENDENTE DE REALIZAÇÃO',
            processo: doc.processo || '',
            favorecido_nome: doc.favorecido_nome || '',
            favorecido_documento: doc.favorecido_documento || '',
            data_emissao: doc.data_emissao,
            fonte_sof: doc.fonte_sof,
            empenho_id: doc.empenho_id,
            itens: (doc.itens || []).map((item: any) => ({
                id: item.id,
                documento_habil_id: item.documento_habil_id,
                doc_tipo: item.doc_tipo,
                data_emissao: item.data_emissao,
                valor: Number(item.valor || 0),
                observacao: item.observacao
            })),
            situacoes: (doc.situacoes || []).map((sit: any) => ({
                id: sit.id,
                documento_habil_id: sit.documento_habil_id,
                situacao_codigo: sit.situacao_codigo,
                valor: Number(sit.valor || 0),
                is_retencao: sit.is_retencao
            }))
        }));

        return { data: mappedData, total: count || 0 };
    },

    // Buscar empenho impactado
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
        // 1. Buscar o documento principal
        const { data: doc, error: docError } = await supabase
            .from('documentos_habeis')
            .select('*')
            .eq('id', id)
            .single();

        if (docError) throw docError;

        // 2. Buscar itens relacionados (NS, OB, etc)
        const { data: itens, error: itensError } = await supabase
            .from('documentos_habeis_itens')
            .select('*')
            .eq('documento_habil_id', id)
            .order('data_emissao', { ascending: false });

        if (itensError) throw itensError;

        // 3. Buscar situações relacionadas (Despesas e Retenções)
        const { data: situacoes, error: sitError } = await supabase
            .from('documentos_habeis_situacoes')
            .select('*')
            .eq('documento_habil_id', id);

        if (sitError) throw sitError;

        // Mapear documento principal
        const mappedDoc: DocumentoDespesa = {
            id: doc.id,
            valor_original: Number(doc.valor_original || 0),
            valor_pago: Number(doc.valor_pago || 0),
            estado: doc.estado || 'PENDENTE DE REALIZAÇÃO',
            processo: doc.processo || '',
            favorecido_nome: doc.favorecido_nome || '',
            favorecido_documento: doc.favorecido_documento || '',
            data_emissao: doc.data_emissao,
            fonte_sof: doc.fonte_sof,
            empenho_id: doc.empenho_id,
            itens: (itens as any[]).map((item) => ({
                id: item.id,
                documento_habil_id: item.documento_habil_id,
                doc_tipo: item.doc_tipo,
                data_emissao: item.data_emissao,
                valor: Number(item.valor || 0),
                observacao: item.observacao
            })),
            situacoes: (situacoes as any[]).map((sit) => ({
                id: sit.id,
                documento_habil_id: sit.documento_habil_id,
                situacao_codigo: sit.situacao_codigo,
                valor: Number(sit.valor || 0),
                is_retencao: sit.is_retencao,
                created_at: sit.created_at
            }))
        };

        return mappedDoc;
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

    // Importação em Lote via UI
    async importDocumentosHabeis(data: Record<string, string>[]): Promise<void> {
        const docsMap = new Map<string, any>();
        
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

                // Identificar o nome do favorecido (pode estar em 'favorecidonome' ou logo após o 'dhcredor' se o header for vazio)
                let favorecidoNome = row['favorecidonome'] || '';
                if (!favorecidoNome) {
                    // Heurística para colunas sem nome (comum em CSVs do governo onde o nome vem após o CPF/CNPJ)
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
                    situacoes: new Map<string, any>(),
                    itens: new Map<string, any>()
                });
            }

            const docData = docsMap.get(id);

            // 1. Identificar Situações (Despesas/Retenções)
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

            // 2. Identificar Itens (Documentos Gerados como OB, NS)
            const itemTipo = row['dhitem'] || situacaoCodigo;
            const itemIdRaw = row['dhdocorigem'] || '';
            const itemId = normalizeDocId(itemIdRaw);

            if (['OB', 'NS', 'NC', 'DR', 'GR'].includes(itemTipo)) {
                const itemValor = Number((row['dhvalordocorigem'] || row['valor'] || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
                // ID Determinístico: Se não tem itemId, gera um baseado no tipo e valor para evitar duplicatas em re-import
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

        // Limpar e Inserir Situações (Limpamos para evitar resíduos se campos mudarem)
        await supabase.from('documentos_habeis_situacoes').delete().in('documento_habil_id', docIds);
        const allSituacoes = Array.from(docsMap.values()).flatMap(d => Array.from(d.situacoes.values()));
        if (allSituacoes.length > 0) {
            const { error: sitError } = await supabase.from('documentos_habeis_situacoes').insert(allSituacoes);
            if (sitError) throw sitError;
        }

        // Limpar e Inserir Itens
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
            // Suporte a múltiplos nomes de coluna para o ID do documento
            const rawId = row['documentoorigem'] || row['documento origem'] || row['ne ccor'] || row['neccor'] || row['documento'] || '';
            const id = normalizeDocId(rawId);
            if (!id) continue;

            const neccor = row['ne ccor'] || row['neccor'] || row['empenho'] || '';
            const fonte = row['fontesof'] || row['fonte'] || row['fontedo_recurso'] || '';
            
            const updateData: any = {};
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

        // Lookup missing fontes from empenhos table if we have empenhos to check
        if (empenhoNumbers.size > 0) {
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('numero, origem_recurso')
                .in('numero', Array.from(empenhoNumbers));
            
            const empenhoFonteMap = new Map(empenhos?.map(e => [e.numero, e.origem_recurso]) || []);

            for (const [id, update] of dhUpdates.entries()) {
                if (!update.fonte_sof && update.empenho_numero) {
                    const fetchedFonte = empenhoFonteMap.get(update.empenho_numero);
                    if (fetchedFonte) {
                        update.fonte_sof = fetchedFonte;
                    }
                }
            }
        }

        // Perform updates in the database
        for (const [id, update] of dhUpdates.entries()) {
            await supabase
                .from('documentos_habeis')
                .update(update)
                .eq('id', id);
        }
    },

    async importOrdensBancarias(data: Record<string, string>[]): Promise<void> {
        const itemsMap: Map<string, any> = new Map();
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
            // Robust parsing: Handling 28.727,79 format
            let valor = 0;
            if (valorStr) {
                const cleaned = valorStr.replace(/\s/g, '');
                if (cleaned.includes(',') && cleaned.includes('.')) {
                    // Brazil format: 1.234,56
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
            // Validação de Chave Estrangeira: Pegar quais IDs de DH realmente existem
            const uniqueDhIds = Array.from(new Set(items.map(i => i.documento_habil_id)));
            const { data: validIds } = await supabase
                .from('documentos_habeis')
                .select('id')
                .in('id', uniqueDhIds);
            
            const existingIds = new Set(validIds?.map(v => v.id) || []);
            const filteredItems = items.filter(i => existingIds.has(i.documento_habil_id));

            if (filteredItems.length > 0) {
                const { error } = await supabase.from('documentos_habeis_itens').upsert(filteredItems, { onConflict: 'id' });
                if (error) throw error;
            }

            if (filteredItems.length < items.length) {
                const skipped = items.length - filteredItems.length;
                console.warn(`${skipped} OBs foram ignoradas pois seus Documentos Hábeis (NP/RP) correspondentes não foram encontrados. Certifique-se de importar o arquivo principal primeiro.`);
            }
        }

        // Parent linkage and Fonte lookup
        if (empenhoNumbers.size > 0) {
            const { data: empenhos } = await supabase
                .from('empenhos')
                .select('numero, origem_recurso')
                .in('numero', Array.from(empenhoNumbers));
            
            const empenhoFonteMap = new Map(empenhos?.map(e => [e.numero, e.origem_recurso]) || []);

            for (const [dhId, update] of parentUpdates.entries()) {
                if (update.empenho_numero) {
                    const fetchedFonte = empenhoFonteMap.get(update.empenho_numero);
                    if (fetchedFonte) {
                        update.fonte_sof = fetchedFonte;
                    }
                    
                    // Update parent DH
                    await supabase
                        .from('documentos_habeis')
                        .update(update)
                        .eq('id', dhId);
                }
            }
        }
    }
};
