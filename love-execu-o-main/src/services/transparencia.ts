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
            .select('*', { count: 'exact' });

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedData = (data as any[]).map((item) => ({
            id: item.id,
            documento: item.id,
            dataEmissao: new Date(`${item.data_emissao}T12:00:00`),
            fase: item.doc_tipo || 'N/D',
            documentoResumido: item.id,
            observacao: item.observacao,
            favorecidoNome: item.favorecido_nome,
            favorecidoDocumento: item.favorecido_documento,
            valor: Number(item.valor_liquidado || item.valor_pago || 0),
            empenhoDocumento: item.empenho_numero,
            valorLiquidado: Number(item.valor_liquidado || 0),
            valorRestoPago: Number(item.valor_pago || 0),
            elementoDespesa: '',
            naturezaDespesa: '',
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
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

        // 3. Buscar retenções relacionadas
        const { data: retencoes, error: retencoesError } = await supabase
            .from('retencoes')
            .select('*')
            .eq('documento_habil', id);

        if (retencoesError) throw retencoesError;

        // Mapear documento principal
        const mappedDoc: DocumentoDespesa = {
            id: doc.id,
            documento: doc.id,
            dataEmissao: new Date(`${doc.data_emissao}T12:00:00`),
            fase: doc.doc_tipo || 'N/D',
            documentoResumido: doc.id,
            observacao: doc.observacao,
            favorecidoNome: doc.favorecido_nome,
            favorecidoDocumento: doc.favorecido_documento,
            valor: Number(doc.valor_liquidado || doc.valor_pago || 0),
            empenhoDocumento: doc.empenho_numero,
            valorLiquidado: Number(doc.valor_liquidado || 0),
            valorRestoPago: Number(doc.valor_pago || 0),
            fonteRecurso: doc.fonte_sof,
            createdAt: new Date(doc.created_at),
            updatedAt: new Date(doc.updated_at),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itens: (itens as any[]).map((item) => ({
                id: item.id,
                documento_habil_id: item.documento_habil_id,
                doc_tipo: item.doc_tipo,
                data_emissao: item.data_emissao ? new Date(`${item.data_emissao}T12:00:00`) : undefined,
                valor: Number(item.valor || 0),
                observacao: item.observacao,
                createdAt: new Date(item.created_at),
                updatedAt: new Date(item.updated_at),
            })),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            retencoes: (retencoes as any[]).map((item) => ({
                ...item,
                dh_dia_emissao: item.dh_dia_emissao ? new Date(`${item.dh_dia_emissao}T12:00:00`) : undefined,
                dh_data_emissao_doc_origem: item.dh_data_emissao_doc_origem ? new Date(`${item.dh_data_emissao_doc_origem}T12:00:00`) : undefined,
                dh_item_dia_pagamento: item.dh_item_dia_pagamento ? new Date(`${item.dh_item_dia_pagamento}T12:00:00`) : undefined,
                dh_item_dia_vencimento: item.dh_item_dia_vencimento ? new Date(`${item.dh_item_dia_vencimento}T12:00:00`) : undefined,
                dh_dia_transacao: item.dh_dia_transacao ? new Date(`${item.dh_dia_transacao}T12:00:00`) : undefined,
                dh_dia_pagamento: item.dh_dia_pagamento ? new Date(`${item.dh_dia_pagamento}T12:00:00`) : undefined,
                createdAt: new Date(item.created_at),
                updatedAt: new Date(item.updated_at),
            })),
            elementoDespesa: '', // Manter por compatibilidade de tipo
            naturezaDespesa: '', // Manter por compatibilidade de tipo
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
    }
};
