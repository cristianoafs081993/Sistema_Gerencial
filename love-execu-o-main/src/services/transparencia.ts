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
            query = query.or(`documento.ilike.%${filters.search}%,documento_resumido.ilike.%${filters.search}%,observacao.ilike.%${filters.search}%,favorecido_nome.ilike.%${filters.search}%,favorecido_documento.ilike.%${filters.search}%`);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        const mappedData = data.map((item: any) => ({
            id: item.id,
            documento: item.documento,
            // Adicionando T12:00:00 para garantir que a data caia no dia correto independente do fuso horário local
            dataEmissao: new Date(`${item.data_emissao}T12:00:00`),
            fase: item.fase,
            documentoResumido: item.documento_resumido,
            observacao: item.observacao,
            favorecidoNome: item.favorecido_nome,
            favorecidoDocumento: item.favorecido_documento,
            valor: Number(item.valor),
            elementoDespesa: item.elemento_despesa,
            naturezaDespesa: item.natureza_despesa,
            fonteRecurso: item.fonte_recurso,
            empenhoDocumento: item.empenho_documento,
            valorLiquidado: item.valorLiquidado ? Number(item.valorLiquidado) : undefined,
            valorRestoPago: item.valorRestoPago ? Number(item.valorRestoPago) : undefined,
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

    // Sincronizar dados da API para o Supabase (Liquidação/Pagamento)
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

                        // Processar cada documento um a um para buscar o impacto (empenho)
                        const documentosParaSalvar = [];

                        for (const doc of data) {
                            // Buscar empenho associado
                            // Delay curto para evitar rate limit
                            await delay(100);

                            const impacto = await this.getEmpenhoImpactado(doc.documento, fase.codigo);

                            documentosParaSalvar.push({
                                documento: doc.documento,
                                data_emissao: parse(doc.data, 'dd/MM/yyyy', new Date()),
                                fase: doc.fase,
                                documento_resumido: doc.documentoResumido,
                                observacao: doc.observacao,
                                favorecido_nome: doc.nomeFavorecido,
                                favorecido_documento: doc.codigoFavorecido,
                                valor: parseCurrency(doc.valor),
                                elemento_despesa: doc.elemento,
                                natureza_despesa: `${doc.categoria} - ${doc.grupo} - ${doc.modalidade} - ${doc.elemento}`,
                                empenho_documento: impacto?.empenhoResumido || null,
                                valorLiquidado: impacto?.valorLiquidado,
                                valorRestoPago: impacto?.valorRestoPago,
                                updated_at: new Date(),
                            });

                            // Se houver empenho impactado, verifica se ele existe no banco
                            if (impacto?.empenhoResumido && impacto?.empenho) {
                                await this.ensureEmpenhoExists(impacto.empenhoResumido, impacto.empenho);
                            }
                        }

                        // Upsert
                        const { error } = await supabase
                            .from('transparencia_documentos')
                            .upsert(documentosParaSalvar, { onConflict: 'documento' });

                        if (error) {
                            console.error('Erro ao salvar no Supabase:', error);
                        } else {
                            // Atualizar saldos dos empenhos envolvidos
                            const empenhosAfetados = [...new Set(documentosParaSalvar.map(d => d.empenho_documento).filter(Boolean))];
                            for (const numeroEmpenho of empenhosAfetados) {
                                await this.recalcularSaldoEmpenho(numeroEmpenho as string);
                            }
                        }

                        totalProcessed += data.length;
                        pagina++;

                        await delay(200);

                    } catch (error) {
                        console.error('Erro na requisição:', error);
                        temMaisPaginas = false;
                    }
                }
            }

            currentDate = addDays(currentDate, 1);
        }
    },

    // Recalcular saldo de um empenho com base nos documentos salvos
    async recalcularSaldoEmpenho(numeroEmpenho: string) {
        // Buscar totais de liquidação e pagamento
        const { data: liquidacoes } = await supabase
            .from('transparencia_documentos')
            .select('valor')
            .eq('empenho_documento', numeroEmpenho)
            .eq('fase', 'Liquidação');

        const { data: pagamentos } = await supabase
            .from('transparencia_documentos')
            .select('valor')
            .eq('empenho_documento', numeroEmpenho)
            .eq('fase', 'Pagamento');

        const totalLiquidado = liquidacoes?.reduce((sum, item) => sum + item.valor, 0) || 0;
        const totalPago = pagamentos?.reduce((sum, item) => sum + item.valor, 0) || 0;

        // Atualizar empenho
        // Determinar status
        let status = 'pendente';
        // Se tem pagamento parcial ou total -> 'pago' ou 'liquidado'? 
        // Simplificação: se totalPago >= totalLiquidado > 0 -> pago?
        // Vamos manter simples: se liquidado > 0 -> liquidado.
        if (totalLiquidado > 0) status = 'liquidado';

        // Buscar empenho para verificar se existe e valor total
        const { data: empenho } = await supabase.from('empenhos').select('id, valor').eq('numero', numeroEmpenho).single();

        if (empenho) {
            // Se totalPago >= empenho.valor -> status = pago (ou quase)
            if (totalPago >= empenho.valor) status = 'pago';

            await supabase
                .from('empenhos')
                .update({
                    valor_liquidado: totalLiquidado,
                    valor_pago: totalPago,
                    status: status
                })
                .eq('id', empenho.id);
        }
    },

    // Garantir que o empenho existe no banco (Lazy Sync)
    async ensureEmpenhoExists(numeroResumido: string, numeroCompleto: string) {
        // Verifica se já existe
        const { data } = await supabase
            .from('empenhos')
            .select('id')
            .eq('numero', numeroResumido)
            .maybeSingle();

        if (data) return; // Já existe

        console.log(`[Lazy Sync] Empenho ${numeroResumido} não encontrado. Buscando : ${numeroCompleto}...`);

        try {
            const response = await fetch(
                `/api-transparencia/api-de-dados/despesas/documentos/${numeroCompleto}`,
                {
                    headers: {
                        'accept': '*/*',
                        'chave-api-dados': API_KEY,
                    },
                }
            );

            let empenhoParaSalvar;

            if (response.ok) {
                const data = await response.json();

                // Se retornar vazio ou sem documento, throw error para cair no catch/fallback
                if (!data || !data.documento) {
                    throw new Error('Empenho não encontrado na API detalhada');
                }

                // Mapear e salvar (similar ao syncEmpenhosSequencial)
                const categoriaCode = data.categoria ? data.categoria.split(' - ')[0] : '';
                const grupoCode = data.grupo ? data.grupo.split(' - ')[0] : '';
                const modalidadeCode = data.modalidade ? data.modalidade.split(' - ')[0] : '';
                const elementoCode = data.elemento ? data.elemento.split(' - ')[0] : '';
                const elementoNome = data.elemento ? data.elemento.split(' - ')[1] : '';

                const naturezaDespesaCompleta = `${categoriaCode}${grupoCode}${modalidadeCode}${elementoCode} - ${elementoNome}`;

                empenhoParaSalvar = {
                    numero: numeroResumido,
                    descricao: data.observacao || '',
                    valor: parseCurrency(data.valor),
                    dimensao: 'NÃO DEFINIDA', // Será necessário classificar depois
                    componente_funcional: '', // Removido preenchimento automático
                    origem_recurso: 'NÃO DEFINIDA',
                    natureza_despesa: naturezaDespesaCompleta.trim().startsWith('-') ? '' : naturezaDespesaCompleta,
                    plano_interno: data.planoOrcamentario ? data.planoOrcamentario.split(' - ')[0] : '',
                    favorecido_nome: data.nomeFavorecido,
                    favorecido_documento: data.codigoFavorecido,
                    processo: data.numeroProcesso,
                    valor_liquidado: 0,
                    valor_pago: 0,
                    data_empenho: parse(data.data, 'dd/MM/yyyy', new Date()),
                    status: 'pendente',
                    updated_at: new Date()
                };
            } else {
                throw new Error(`Erro API: ${response.status}`);
            }

            if (empenhoParaSalvar) {
                await supabase.from('empenhos').insert(empenhoParaSalvar);
                console.log(`[Lazy Sync] Empenho ${numeroResumido} criado.`);
            }

        } catch (error) {
            console.warn(`[Lazy Sync] Falha ao buscar detalhes do empenho ${numeroResumido}. Criando Stub...`, error);

            // Fallback: Criar stub
            // Tentar extrair ano do numero (ex: 2024NE...)
            const matchAno = numeroResumido.match(/^(\d{4})/);
            const ano = matchAno ? parseInt(matchAno[1]) : new Date().getFullYear();
            const dataEstimada = new Date(ano, 0, 1); // 01/01/Ano

            const stubEmpenho = {
                numero: numeroResumido,
                descricao: 'Empenho de Exercício Anterior (Sincronizado via Liquidação)',
                valor: 0, // Valor desconhecido inicialmente
                dimensao: 'NÃO DEFINIDA',
                componente_funcional: '',
                origem_recurso: 'NÃO DEFINIDA',
                natureza_despesa: '',
                plano_interno: '',
                valor_liquidado: 0,
                valor_pago: 0,
                data_empenho: dataEstimada,
                status: 'pendente',
                updated_at: new Date()
            };

            await supabase.from('empenhos').insert(stubEmpenho);
            console.log(`[Lazy Sync] Stub criado para ${numeroResumido}.`);
        }
    },

    // Buscar último número de empenho cadastrado
    async getLastEmpenhoSequence(): Promise<number> {
        const { data, error } = await supabase
            .from('empenhos')
            .select('numero')
            .order('numero', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Erro ao buscar último empenho:', error);
            return 0;
        }

        if (data && data.length > 0) {
            const lastNumero = data[0].numero; // Ex: 2026NE000001
            const match = lastNumero.match(/NE(\d+)$/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }

        return 0;
    },

    // Sincronizar dados da API (Sequencial)
    async syncEmpenhosSequencial(
        onProgress: (message: string) => void
    ): Promise<void> {
        const UG = '158366';
        const GESTAO = '26435';
        const ANO = '2026'; // Poderia ser dinâmico
        const TIPO = 'NE';

        let sequence = await this.getLastEmpenhoSequence() + 1;
        let errors = 0;
        const maxErrors = 20; // Revertido para 20 conforme solicitado

        // Limite de segurança para loop infinito
        while (errors < maxErrors) {
            const sequenceStr = sequence.toString().padStart(6, '0');
            const codigoDocumento = `${UG}${GESTAO}${ANO}${TIPO}${sequenceStr}`;
            const numeroEmpenho = `${ANO}${TIPO}${sequenceStr}`;

            onProgress(`Buscando empenho ${numeroEmpenho}... (Erros seguidos: ${errors})`);

            try {
                // Usando delay maior para evitar rate limiting e garantir estabilidade
                await delay(500);

                const response = await fetch(
                    `/api-transparencia/api-de-dados/despesas/documentos/${codigoDocumento}`,
                    {
                        headers: {
                            'accept': '*/*',
                            'chave-api-dados': API_KEY, // Ensure API_KEY matches the one defined at top of file
                        },
                    }
                );

                if (response.status === 404) {
                    errors++;
                    console.log(`[Sync] Empenho ${numeroEmpenho} não encontrado (404). Erros seguidos: ${errors}/${maxErrors}`);
                    sequence++; // Pula para o próximo
                    continue; // Continua o loop
                }

                if (!response.ok) {
                    throw new Error(`Erro API: ${response.status}`);
                }

                let data;
                try {
                    const text = await response.text();
                    if (!text || text.trim() === '') {
                        // Se não tiver corpo, trata como erro ou skip
                        console.warn(`Resposta vazia para ${numeroEmpenho}`);
                        errors++;
                        sequence++;
                        continue;
                    }
                    data = JSON.parse(text);
                } catch (jsonError) {
                    console.error(`Erro ao fazer parse do JSON para ${numeroEmpenho}:`, jsonError);
                    errors++;
                    sequence++;
                    continue;
                }

                if (!data || !data.documento) {
                    errors++;
                    sequence++;
                    continue;
                }

                errors = 0; // Resetar contador de erros se encontrar sucesso

                // Mapear para o formato do banco (tabela empenhos)
                // Extrair códigos da natureza de despesa
                const categoriaCode = data.categoria ? data.categoria.split(' - ')[0] : '';
                const grupoCode = data.grupo ? data.grupo.split(' - ')[0] : '';
                const modalidadeCode = data.modalidade ? data.modalidade.split(' - ')[0] : '';
                const elementoCode = data.elemento ? data.elemento.split(' - ')[0] : '';
                const elementoNome = data.elemento ? data.elemento.split(' - ')[1] : '';

                const naturezaDespesaCompleta = `${categoriaCode}${grupoCode}${modalidadeCode}${elementoCode} - ${elementoNome}`;

                const empenhoParaSalvar = {
                    numero: data.documentoResumido || numeroEmpenho,
                    descricao: '', // API não retorna descrição útil, deixar em branco para edição manual
                    valor: parseCurrency(data.valor),
                    dimensao: 'NÃO DEFINIDA',
                    componente_funcional: '', // Removido preenchimento automático
                    origem_recurso: 'NÃO DEFINIDA',
                    natureza_despesa: naturezaDespesaCompleta.trim().startsWith('-') ? '' : naturezaDespesaCompleta,
                    plano_interno: data.planoOrcamentario ? data.planoOrcamentario.split(' - ')[0] : '',
                    favorecido_nome: data.nomeFavorecido,
                    favorecido_documento: data.codigoFavorecido,
                    processo: data.numeroProcesso, // Adicionado campo processo
                    valor_liquidado: 0,
                    data_empenho: parse(data.data, 'dd/MM/yyyy', new Date()),
                    status: 'pendente',
                    atividade_id: null,
                    updated_at: new Date()
                };

                // Verificar se já existe
                const { data: existingEmpenho, error: searchError } = await supabase
                    .from('empenhos')
                    .select('id')
                    .eq('numero', empenhoParaSalvar.numero)
                    .maybeSingle();

                if (searchError) {
                    console.error(`Erro ao buscar empenho ${numeroEmpenho}:`, searchError);
                }

                let error;
                if (existingEmpenho) {
                    const { error: updateError } = await supabase
                        .from('empenhos')
                        .update(empenhoParaSalvar)
                        .eq('id', existingEmpenho.id);
                    error = updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('empenhos')
                        .insert(empenhoParaSalvar);
                    error = insertError;
                }

                if (error) {
                    console.error(`Erro ao salvar empenho ${numeroEmpenho}:`, error);
                }

                sequence++;

            } catch (error) {
                console.error(`[Sync] Erro crítico ao processar ${numeroEmpenho}:`, error);
                errors++;
                sequence++;
            }
        }

        onProgress(`Sincronização finalizada. Último verificado: ${ANO}${TIPO}${(sequence - 1).toString().padStart(6, '0')}`);
    }
};
