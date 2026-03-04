import { supabase } from '@/lib/supabase';
import { DocumentoDespesa, DocumentoDespesaAPI, OperacaoEmpenho } from '@/types';
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

    // Buscar a data do último documento sincronizado
    async getLastDocumentoDate(): Promise<Date | null> {
        const { data, error } = await supabase
            .from('transparencia_documentos')
            .select('data_emissao')
            .order('data_emissao', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Erro ao buscar última data de documento:', error);
            return null;
        }

        return data ? new Date(`${data.data_emissao}T12:00:00`) : null;
    },

    // Sincronizar dados da API para o Supabase (Liquidação/Pagamento)
    async syncDados(
        startDate?: Date,
        onProgress?: (date: Date, total: number, currentPhase: string) => void
    ): Promise<void> {
        const today = new Date();

        // Se não informar startDate, busca a última data no banco
        let currentDate = startDate;
        if (!currentDate) {
            const lastDate = await this.getLastDocumentoDate();
            // Inicia do MESMO dia do último encontrado para garantir captura de atualizações tardias
            // Se vazio, inicia de 01/01/2026
            currentDate = lastDate || new Date(2026, 0, 1);
        }

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

                            let empenhoId = null;
                            // Se houver empenho impactado, verifica se ele existe no banco
                            if (impacto?.empenhoResumido && impacto?.empenho) {
                                empenhoId = await this.ensureEmpenhoExists(impacto.empenhoResumido, impacto.empenho);
                            }

                            // Priorizar valor do impacto (especialmente para Restos a Pagar onde o valor principal vem "-")
                            let valorDocumento = parseCurrency(doc.valor);
                            const vLiq = impacto?.valorLiquidado || 0;
                            const vPag = impacto?.valorRestoPago || 0;
                            
                            if (valorDocumento === 0) {
                                valorDocumento = vLiq > 0 ? vLiq : vPag;
                            }

                            // Fallback 3: Buscar valor via detalhe individual do documento (resolve Restos a Pagar zerados)
                            if (valorDocumento === 0) {
                                try {
                                    await delay(100);
                                    const detailResp = await fetch(
                                        `${API_BASE}/${doc.documento}`,
                                        { headers: { 'accept': '*/*', 'chave-api-dados': API_KEY } }
                                    );
                                    if (detailResp.ok) {
                                        const detailData = await detailResp.json();
                                        const detailVal = parseCurrency(detailData?.valor);
                                        if (detailVal > 0) {
                                            valorDocumento = detailVal;
                                            console.log(`[Sync] Valor recuperado via detalhe: ${doc.documentoResumido} = R$ ${detailVal}`);
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`[Sync] Falha ao buscar detalhe de ${doc.documentoResumido}`, e);
                                }
                            }

                            documentosParaSalvar.push({
                                documento: doc.documento,
                                data_emissao: parse(doc.data, 'dd/MM/yyyy', new Date()),
                                fase: doc.fase,
                                documento_resumido: doc.documentoResumido,
                                observacao: doc.observacao,
                                favorecido_nome: doc.nomeFavorecido,
                                favorecido_documento: doc.codigoFavorecido,
                                valor: valorDocumento,
                                elemento_despesa: doc.elemento,
                                natureza_despesa: `${doc.categoria} - ${doc.grupo} - ${doc.modalidade} - ${doc.elemento}`,
                                empenho_documento: impacto?.empenhoResumido || null,
                                empenho_id: empenhoId,
                                valorLiquidado: vLiq,
                                valorRestoPago: vPag,
                                updated_at: new Date(),
                            });
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
        const { data: documents } = await supabase
            .from('transparencia_documentos')
            .select('valor, valorLiquidado, valorRestoPago, fase')
            .eq('empenho_documento', numeroEmpenho);

        if (!documents) return;

        const liquidacoes = documents.filter(d => d.fase === 'Liquidação');
        const pagamentos = documents.filter(d => d.fase === 'Pagamento');

        const totalLiquidado = liquidacoes.reduce((sum, item) => sum + (item.valorLiquidado || item.valor || 0), 0);
        const totalPago = pagamentos.reduce((sum, item) => sum + (item.valorRestoPago || item.valor || 0), 0);

        // Atualizar empenho
        // Determinar status
        let status = 'pendente';
        if (totalLiquidado > 0) status = 'liquidado';

        // Buscar empenho para verificar se existe e valor total
        const { data: empenho } = await supabase.from('empenhos').select('id, valor').eq('numero', numeroEmpenho).single();

        if (empenho) {
            // Se totalPago >= empenho.valor -> status = pago
            if (totalPago >= empenho.valor && empenho.valor > 0) status = 'pago';

            await supabase
                .from('empenhos')
                .update({
                    valor_liquidado: totalLiquidado,
                    // Removido valor_pago pois a coluna não existe no banco
                    status: status
                })
                .eq('id', empenho.id);
        }
    },

    async ensureEmpenhoExists(numeroResumido: string, numeroCompleto: string): Promise<string | null> {
        // Verifica se já existe
        const { data } = await supabase
            .from('empenhos')
            .select('id')
            .eq('numero', numeroResumido)
            .maybeSingle();

        if (data) return data.id; // Já existe

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

                // Upsert natureza de despesa e obter ID
                let naturezaDespesaId = null;
                const codigoNatureza = `${categoriaCode}${grupoCode}${modalidadeCode}${elementoCode}`;
                if (codigoNatureza) {
                    naturezaDespesaId = await dominioService.upsertNaturezaDespesa(codigoNatureza, elementoNome);
                }

                empenhoParaSalvar = {
                    numero: numeroResumido,
                    descricao: '', // Deixando em branco por enquanto conforme solicitado
                    valor: parseCurrency(data.valor),
                    dimensao: 'NÃO DEFINIDA', // Será necessário classificar depois
                    componente_funcional: '', // Removido preenchimento automático
                    origem_recurso: 'NÃO DEFINIDA',
                    natureza_despesa: naturezaDespesaCompleta.trim().startsWith('-') ? '' : naturezaDespesaCompleta,
                    natureza_despesa_id: naturezaDespesaId,
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
                const { data: insertedData, error: insertError } = await supabase.from('empenhos').insert(empenhoParaSalvar).select('id').single();
                if (insertError) throw insertError;
                console.log(`[Lazy Sync] Empenho ${numeroResumido} criado.`);
                return insertedData?.id || null;
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

            const { data: insertedData, error: stubInsertError } = await supabase.from('empenhos').insert(stubEmpenho).select('id').single();
            if (stubInsertError) console.error(stubInsertError);
            console.log(`[Lazy Sync] Stub criado para ${numeroResumido}.`);
            return insertedData?.id || null;
        }
        return null;
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

    // Buscar histórico de operações de um empenho (reforços, anulações, inclusão)
    async fetchHistoricoEmpenho(codigoDocumento: string): Promise<OperacaoEmpenho[]> {
        const allItems: OperacaoEmpenho[] = [];
        try {
            for (let seq = 1; seq <= 10; seq++) {
                await delay(300);
                const url = `${API_HISTORICO}?codigoDocumento=${codigoDocumento}&sequencial=${seq}&pagina=1`;
                const response = await fetch(url, {
                    headers: {
                        'accept': '*/*',
                        'chave-api-dados': API_KEY,
                    },
                });

                if (!response.ok) {
                    console.warn(`[Historico] Erro seq ${seq} para ${codigoDocumento}: ${response.status}`);
                    break;
                }

                let data;
                try {
                    const text = await response.text();
                    if (!text || text.trim() === '' || text.trim() === '[]') {
                        break; // Sem mais itens
                    }
                    data = JSON.parse(text);
                } catch {
                    break;
                }

                if (!Array.isArray(data) || data.length === 0) {
                    break;
                }

                for (const item of data) {
                    allItems.push({
                        data: item.data,
                        operacao: item.operacao,
                        quantidade: parseCurrency(item.quantidade),
                        valorUnitario: parseCurrency(item.valorUnitario),
                        valorTotal: parseCurrency(item.valorTotal),
                    });
                }
            }
        } catch (error) {
            console.error(`[Historico] Erro ao buscar histórico de ${codigoDocumento}:`, error);
        }
        return allItems;
    },

    // Calcular valor real a partir do histórico de operações
    calcularValorReal(historico: OperacaoEmpenho[]): number {
        let valor = 0;
        for (const op of historico) {
            if (op.operacao === 'INCLUSAO' || op.operacao === 'REFORCO') {
                valor += op.valorTotal;
            } else if (op.operacao === 'ANULACAO') {
                valor -= op.valorTotal;
            }
        }
        return Math.max(valor, 0); // Proteger contra negativo
    },

    // Sincronizar dados da API (Sequencial)
    async syncEmpenhosSequencial(
        onProgress: (message: string) => void
    ): Promise<void> {
        const UG = '158366';
        const GESTAO = '26435';
        const ANO = '2026';
        const TIPO = 'NE';

        let sequence = await this.getLastEmpenhoSequence() + 1;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3; 
        let empenhosSincronizados = 0;
        const maxTotalSkips = 10; // Limite total de buracos na sequência
        let totalSkips = 0;

        onProgress(`Buscando atualizações no Portal da Transparência...`);

        while (consecutiveErrors < maxConsecutiveErrors && totalSkips < maxTotalSkips) {
            const sequenceStr = sequence.toString().padStart(6, '0');
            const codigoDocumento = `${UG}${GESTAO}${ANO}${TIPO}${sequenceStr}`;
            const numeroEmpenho = `${ANO}${TIPO}${sequenceStr}`;

            try {
                await delay(500);

                const response = await fetch(
                    `/api-transparencia/api-de-dados/despesas/documentos/${codigoDocumento}`,
                    {
                        headers: {
                            'accept': '*/*',
                            'chave-api-dados': API_KEY,
                        },
                    }
                );

                if (!response.ok) {
                    consecutiveErrors++;
                    totalSkips++;
                    console.log(`[Sync] ${numeroEmpenho} indisponível.`);
                    sequence++;
                    continue;
                }

                const text = await response.text();
                if (!text || text.trim() === '') {
                    consecutiveErrors++;
                    totalSkips++;
                    sequence++;
                    continue;
                }

                const data = JSON.parse(text);
                if (!data || !data.documento) {
                    consecutiveErrors++;
                    totalSkips++;
                    sequence++;
                    continue;
                }

                // SUCESSO: Encontrou um empenho válido
                consecutiveErrors = 0; 
                empenhosSincronizados++;
                onProgress(`Sincronizando empenho ${numeroEmpenho}...`);

                // Mapeamento e Salvamento
                const categoriaCode = data.categoria ? data.categoria.split(' - ')[0] : '';
                const grupoCode = data.grupo ? data.grupo.split(' - ')[0] : '';
                const modalidadeCode = data.modalidade ? data.modalidade.split(' - ')[0] : '';
                const elementoCode = data.elemento ? data.elemento.split(' - ')[0] : '';
                const elementoNome = data.elemento ? data.elemento.split(' - ')[1] : '';

                const naturezaDespesaCompleta = `${categoriaCode}${grupoCode}${modalidadeCode}${elementoCode} - ${elementoNome}`;

                let naturezaDespesaId = null;
                const codigoNatureza = `${categoriaCode}${grupoCode}${modalidadeCode}${elementoCode}`;
                if (codigoNatureza) {
                    naturezaDespesaId = await dominioService.upsertNaturezaDespesa(codigoNatureza, elementoNome);
                }

                const historico = await this.fetchHistoricoEmpenho(codigoDocumento);
                const valorReal = historico.length > 0
                    ? this.calcularValorReal(historico)
                    : parseCurrency(data.valor);

                const empenhoParaSalvar = {
                    numero: data.documentoResumido || numeroEmpenho,
                    descricao: '', 
                    valor: valorReal,
                    dimensao: 'NÃO DEFINIDA',
                    componente_funcional: '',
                    origem_recurso: 'NÃO DEFINIDA',
                    natureza_despesa: naturezaDespesaCompleta.trim().startsWith('-') ? '' : naturezaDespesaCompleta,
                    natureza_despesa_id: naturezaDespesaId,
                    plano_interno: data.planoOrcamentario ? data.planoOrcamentario.split(' - ')[0] : '',
                    favorecido_nome: data.nomeFavorecido,
                    favorecido_documento: data.codigoFavorecido,
                    processo: data.numeroProcesso,
                    valor_liquidado: 0,
                    data_empenho: parse(data.data, 'dd/MM/yyyy', new Date()),
                    status: 'pendente',
                    atividade_id: null,
                    historico_operacoes: historico,
                    updated_at: new Date()
                };

                const { data: existingEmpenho } = await supabase
                    .from('empenhos')
                    .select('id')
                    .eq('numero', empenhoParaSalvar.numero)
                    .maybeSingle();

                if (existingEmpenho) {
                    await supabase.from('empenhos').update(empenhoParaSalvar).eq('id', existingEmpenho.id);
                } else {
                    await supabase.from('empenhos').insert(empenhoParaSalvar);
                }

                sequence++;

            } catch (error) {
                consecutiveErrors++;
                totalSkips++;
                sequence++;
            }
        }

        if (empenhosSincronizados > 0) {
            onProgress(`Sincronização concluída. ${empenhosSincronizados} novos empenhos encontrados.`);
        } else {
            onProgress(`Nenhum empenho novo encontrado.`);
        }
    }
};
