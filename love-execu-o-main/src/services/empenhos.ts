
import { supabase } from '@/lib/supabase';
import { Empenho } from '@/types';

export const empenhosService = {
    async getAll(): Promise<Empenho[]> {
        const { data, error } = await supabase
            .from('empenhos')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((item: any) => ({
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
        }));
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
        const updates: any = {
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
