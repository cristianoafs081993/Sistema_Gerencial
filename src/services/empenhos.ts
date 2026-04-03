
import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { Empenho } from '@/types';

const EMPENHOS_SELECT = 'id,numero,descricao,valor,dimensao,dimensao_id,componente_funcional,componente_funcional_id,origem_recurso,origem_recurso_id,natureza_despesa,natureza_despesa_id,plano_interno,favorecido_nome,favorecido_documento,valor_liquidado,data_empenho,status,atividade_id,created_at,updated_at,processo,historico_operacoes,valor_liquidado_oficial,valor_pago_oficial,saldo_rap_oficial,ultima_atualizacao_siafi,tipo,rap_inscrito,rap_a_liquidar,rap_liquidado,rap_pago,valor_liquidado_a_pagar';

type EmpenhoRow = {
    id: string;
    numero: string;
    descricao: string;
    valor: number | string;
    dimensao: string;
    dimensao_id?: string | null;
    componente_funcional: string;
    componente_funcional_id?: string | null;
    origem_recurso: string;
    origem_recurso_id?: string | null;
    natureza_despesa: string;
    natureza_despesa_id?: string | null;
    plano_interno?: string | null;
    favorecido_nome?: string | null;
    favorecido_documento?: string | null;
    valor_liquidado?: number | string | null;
    valor_liquidado_oficial?: number | string | null;
    valor_pago_oficial?: number | string | null;
    valor_liquidado_a_pagar?: number | string | null;
    saldo_rap_oficial?: number | string | null;
    ultima_atualizacao_siafi?: string | null;
    tipo?: 'exercicio' | 'rap' | null;
    rap_inscrito?: number | string | null;
    rap_a_liquidar?: number | string | null;
    rap_liquidado?: number | string | null;
    rap_pago?: number | string | null;
    data_empenho: string;
    status: 'pendente' | 'liquidado' | 'pago' | 'cancelado';
    atividade_id?: string | null;
    processo?: string | null;
    historico_operacoes?: Empenho['historicoOperacoes'] | null;
    created_at: string;
    updated_at: string;
};

const mapEmpenhoRow = (item: EmpenhoRow): Empenho => ({
    id: item.id,
    numero: item.numero,
    descricao: item.descricao,
    valor: Number(item.valor),
    dimensao: item.dimensao,
    dimensaoId: item.dimensao_id || undefined,
    componenteFuncional: item.componente_funcional,
    componenteFuncionalId: item.componente_funcional_id || undefined,
    origemRecurso: item.origem_recurso,
    origemRecursoId: item.origem_recurso_id || undefined,
    naturezaDespesa: item.natureza_despesa,
    naturezaDespesaId: item.natureza_despesa_id || undefined,
    planoInterno: item.plano_interno || undefined,
    favorecidoNome: item.favorecido_nome || undefined,
    favorecidoDocumento: item.favorecido_documento || undefined,
    valorLiquidado: item.valor_liquidado ? Number(item.valor_liquidado) : 0,
    valorLiquidadoOficial: item.valor_liquidado_oficial != null ? Number(item.valor_liquidado_oficial) : undefined,
    valorPagoOficial: item.valor_pago_oficial != null ? Number(item.valor_pago_oficial) : undefined,
    valorLiquidadoAPagar: item.valor_liquidado_a_pagar != null ? Number(item.valor_liquidado_a_pagar) : undefined,
    saldoRapOficial: item.saldo_rap_oficial != null ? Number(item.saldo_rap_oficial) : undefined,
    ultimaAtualizacaoSiafi: item.ultima_atualizacao_siafi || undefined,
    tipo: item.tipo || 'exercicio',
    rapInscrito: item.rap_inscrito != null ? Number(item.rap_inscrito) : undefined,
    rapALiquidar: item.rap_a_liquidar != null ? Number(item.rap_a_liquidar) : undefined,
    rapLiquidado: item.rap_liquidado != null ? Number(item.rap_liquidado) : undefined,
    rapPago: item.rap_pago != null ? Number(item.rap_pago) : undefined,
    dataEmpenho: new Date(item.data_empenho),
    status: item.status,
    atividadeId: item.atividade_id || undefined,
    processo: item.processo || undefined,
    historicoOperacoes: item.historico_operacoes || [],
    createdAt: new Date(item.created_at),
    updatedAt: new Date(item.updated_at),
});

export const empenhosService = {
    async getAll(): Promise<Empenho[]> {
        const { data, error } = await supabase
            .from('empenhos')
            .select(EMPENHOS_SELECT)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('empenhosService.getAll: fallback para Supabase REST', error);
            const fallbackData = await fetchSupabaseRestRows<EmpenhoRow>('empenhos', EMPENHOS_SELECT, {
                orderBy: 'created_at',
            });
            return fallbackData.map(mapEmpenhoRow);
        }

        if (!data || data.length === 0) {
            console.warn('empenhosService.getAll: resultado vazio via supabase-js, consultando REST');
            const fallbackData = await fetchSupabaseRestRows<EmpenhoRow>('empenhos', EMPENHOS_SELECT, {
                orderBy: 'created_at',
            });
            return fallbackData.map(mapEmpenhoRow);
        }

        return (data as EmpenhoRow[]).map(mapEmpenhoRow);
    },

    async create(empenho: Omit<Empenho, 'id' | 'createdAt' | 'updatedAt'>): Promise<Empenho> {
        const { data, error } = await supabase
            .from('empenhos')
            .insert({
                numero: empenho.numero,
                descricao: empenho.descricao,
                valor: empenho.valor,
                dimensao: empenho.dimensao,
                dimensao_id: empenho.dimensaoId || null,
                componente_funcional: empenho.componenteFuncional,
                componente_funcional_id: empenho.componenteFuncionalId || null,
                origem_recurso: empenho.origemRecurso,
                origem_recurso_id: empenho.origemRecursoId || null,
                natureza_despesa: empenho.naturezaDespesa,
                natureza_despesa_id: empenho.naturezaDespesaId || null,
                plano_interno: empenho.planoInterno,
                favorecido_nome: empenho.favorecidoNome,
                favorecido_documento: empenho.favorecidoDocumento,
                processo: empenho.processo,
                valor_liquidado: empenho.valorLiquidado || 0,
                data_empenho: empenho.dataEmpenho instanceof Date ? empenho.dataEmpenho.toISOString() : empenho.dataEmpenho,
                status: empenho.status,
                atividade_id: empenho.atividadeId || null,
                historico_operacoes: empenho.historicoOperacoes || [],
                tipo: empenho.tipo || 'exercicio',
                valor_liquidado_a_pagar: empenho.valorLiquidadoAPagar ?? null,
                rap_inscrito: empenho.rapInscrito ?? null,
                rap_a_liquidar: empenho.rapALiquidar ?? null,
                rap_liquidado: empenho.rapLiquidado ?? null,
                rap_pago: empenho.rapPago ?? null,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            numero: data.numero,
            descricao: data.descricao,
            valor: Number(data.valor),
            dimensao: data.dimensao,
            dimensaoId: data.dimensao_id || undefined,
            componenteFuncional: data.componente_funcional,
            componenteFuncionalId: data.componente_funcional_id || undefined,
            origemRecurso: data.origem_recurso,
            origemRecursoId: data.origem_recurso_id || undefined,
            naturezaDespesa: data.natureza_despesa,
            naturezaDespesaId: data.natureza_despesa_id || undefined,
            planoInterno: data.plano_interno || undefined,
            favorecidoNome: data.favorecido_nome || undefined,
            favorecidoDocumento: data.favorecido_documento || undefined,
            processo: data.processo || undefined,
            valorLiquidado: data.valor_liquidado ? Number(data.valor_liquidado) : 0,
            valorLiquidadoAPagar: data.valor_liquidado_a_pagar != null ? Number(data.valor_liquidado_a_pagar) : undefined,
            tipo: data.tipo || 'exercicio',
            rapInscrito: data.rap_inscrito != null ? Number(data.rap_inscrito) : undefined,
            rapALiquidar: data.rap_a_liquidar != null ? Number(data.rap_a_liquidar) : undefined,
            rapLiquidado: data.rap_liquidado != null ? Number(data.rap_liquidado) : undefined,
            rapPago: data.rap_pago != null ? Number(data.rap_pago) : undefined,
            dataEmpenho: new Date(data.data_empenho),
            status: data.status,
            atividadeId: data.atividade_id || undefined,
            historicoOperacoes: data.historico_operacoes || [],
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
        };
    },

    async update(id: string, empenho: Partial<Empenho>): Promise<void> {
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (empenho.numero) updates.numero = empenho.numero;
        if (empenho.descricao !== undefined) updates.descricao = empenho.descricao;
        if (empenho.valor !== undefined) updates.valor = empenho.valor;
        if (empenho.dimensao) updates.dimensao = empenho.dimensao;
        if (empenho.dimensaoId !== undefined) updates.dimensao_id = empenho.dimensaoId || null;
        if (empenho.componenteFuncional) updates.componente_funcional = empenho.componenteFuncional;
        if (empenho.componenteFuncionalId !== undefined) updates.componente_funcional_id = empenho.componenteFuncionalId || null;
        if (empenho.origemRecurso) updates.origem_recurso = empenho.origemRecurso;
        if (empenho.origemRecursoId !== undefined) updates.origem_recurso_id = empenho.origemRecursoId || null;
        if (empenho.naturezaDespesa) updates.natureza_despesa = empenho.naturezaDespesa;
        if (empenho.naturezaDespesaId !== undefined) updates.natureza_despesa_id = empenho.naturezaDespesaId || null;
        if (empenho.planoInterno !== undefined) updates.plano_interno = empenho.planoInterno;
        if (empenho.favorecidoNome !== undefined) updates.favorecido_nome = empenho.favorecidoNome;
        if (empenho.favorecidoDocumento !== undefined) updates.favorecido_documento = empenho.favorecidoDocumento;
        if (empenho.processo !== undefined) updates.processo = empenho.processo;
        if (empenho.valorLiquidado !== undefined) updates.valor_liquidado = empenho.valorLiquidado;
        if (empenho.dataEmpenho) updates.data_empenho = empenho.dataEmpenho instanceof Date ? empenho.dataEmpenho.toISOString() : empenho.dataEmpenho;
        if (empenho.status) updates.status = empenho.status;
        if (empenho.atividadeId !== undefined) updates.atividade_id = empenho.atividadeId || null;
        if (empenho.historicoOperacoes) updates.historico_operacoes = empenho.historicoOperacoes;
        if (empenho.tipo) updates.tipo = empenho.tipo;
        if (empenho.valorLiquidadoAPagar !== undefined) updates.valor_liquidado_a_pagar = empenho.valorLiquidadoAPagar;
        if (empenho.rapInscrito !== undefined) updates.rap_inscrito = empenho.rapInscrito;
        if (empenho.rapALiquidar !== undefined) updates.rap_a_liquidar = empenho.rapALiquidar;
        if (empenho.rapLiquidado !== undefined) updates.rap_liquidado = empenho.rapLiquidado;
        if (empenho.rapPago !== undefined) updates.rap_pago = empenho.rapPago;

        const { error } = await supabase
            .from('empenhos')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('empenhos')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
