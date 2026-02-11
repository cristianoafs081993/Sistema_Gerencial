import { supabase } from '@/lib/supabase';
import { DocumentoDespesa, DocumentoDespesaAPI } from '@/types';
import { parseCurrency } from '@/lib/utils';
import { addDays, format, isAfter, isBefore, parse } from 'date-fns';

const API_BASE = '/api-transparencia/api-de-dados/despesas/documentos';
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
        fase?: string;
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
            .from('transparencia_documentos')
            .select('*', { count: 'exact' });

        // Ordenação
        if (filters?.orderBy) {
            query = query.order(filters.orderBy, { ascending: filters.orderDirection === 'asc' });
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
        if (filters?.fase && filters.fase !== 'all') {
            query = query.eq('fase', filters.fase);
        }
        if (filters?.search) {
            query = query.or(`documento.ilike.%${filters.search}%,documento_resumido.ilike.%${filters.search}%,observacao.ilike.%${filters.search}%,favorecido_nome.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        const mappedData = data.map((item: any) => ({
            id: item.id,
            documento: item.documento,
            dataEmissao: new Date(item.data_emissao),
            fase: item.fase,
            documentoResumido: item.documento_resumido,
            observacao: item.observacao,
            favorecidoNome: item.favorecido_nome,
            favorecidoDocumento: item.favorecido_documento,
            valor: Number(item.valor),
            elementoDespesa: item.elemento_despesa,
            naturezaDespesa: item.natureza_despesa,
            fonteRecurso: item.fonte_recurso,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
        }));

        return { data: mappedData, total: count || 0 };
    },

    // Sincronizar dados da API para o Supabase
    async syncDados(
        startDate: Date,
        onProgress: (date: Date, total: number, currentPhase: string) => void
    ): Promise<void> {
        const today = new Date();
        let currentDate = startDate;
        let totalProcessed = 0;

        // Fases: 2 - Liquidação, 3 - Pagamento
        const fases = [
            { codigo: 2, nome: 'Liquidação' },
            { codigo: 3, nome: 'Pagamento' }
        ];

        while (isBefore(currentDate, today) || format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
            const dataFormatada = format(currentDate, 'dd/MM/yyyy');

            for (const fase of fases) {
                onProgress(currentDate, totalProcessed, fase.nome);

                let pagina = 1;
                let temMaisPaginas = true;

                while (temMaisPaginas) {
                    try {
                        const response = await fetch(
                            `${API_BASE}?unidadeGestora=${UNIDADE_GESTORA}&gestao=${GESTAO}&dataEmissao=${encodeURIComponent(dataFormatada)}&fase=${fase.codigo}&pagina=${pagina}`,
                            {
                                headers: {
                                    'accept': '*/*',
                                    'chave-api-dados': API_KEY,
                                },
                            }
                        );

                        if (!response.ok) {
                            console.error(`Erro ao buscar dados de ${dataFormatada} fase ${fase.nome}:`, response.statusText);
                            break;
                        }

                        const data: DocumentoDespesaAPI[] = await response.json();

                        if (!Array.isArray(data) || data.length === 0) {
                            temMaisPaginas = false;
                            continue;
                        }

                        // Transformar e salvar no Supabase
                        const documentosParaSalvar = data.map(doc => ({
                            documento: doc.documento,
                            data_emissao: parse(doc.data, 'dd/MM/yyyy', new Date()), // Converte para Date
                            fase: doc.fase,
                            documento_resumido: doc.documentoResumido,
                            observacao: doc.observacao,
                            favorecido_nome: doc.nomeFavorecido,
                            favorecido_documento: doc.codigoFavorecido,
                            valor: parseCurrency(doc.valor), // Usa utils para converter "-"/string
                            elemento_despesa: doc.elemento,
                            natureza_despesa: `${doc.categoria} - ${doc.grupo} - ${doc.modalidade} - ${doc.elemento}`,
                            updated_at: new Date(),
                        }));

                        // Upsert (Insert ou Update se documento já existe)
                        const { error } = await supabase
                            .from('transparencia_documentos')
                            .upsert(documentosParaSalvar, { onConflict: 'documento' });

                        if (error) {
                            console.error('Erro ao salvar no Supabase:', error);
                        }

                        totalProcessed += data.length;

                        // Controle de paginação simples (se vier menos de 15, provavelmente é a última)
                        // Mas a API pode retornar vazio se pagina nao existe.
                        // O loop depende de data.length > 0.
                        pagina++;

                        // Pequeno delay para ser gentil com a API
                        await delay(100);

                    } catch (error) {
                        console.error('Erro na requisição:', error);
                        temMaisPaginas = false;
                    }
                }
            }

            currentDate = addDays(currentDate, 1);
        }
    }
};
