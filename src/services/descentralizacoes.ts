import { supabase } from '@/lib/supabase';
import { Descentralizacao } from '@/types';

export const descentralizacoesService = {
    async getAll(): Promise<Descentralizacao[]> {
        const { data, error } = await supabase
            .from('descentralizacoes')
            .select('*')
            .order('data_emissao', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return data.map((item) => ({
            id: item.id,
            dimensao: item.dimensao,
            dimensaoId: item.dimensao_id || undefined,
            origemRecurso: item.origem_recurso,
            origemRecursoId: item.origem_recurso_id || undefined,
            naturezaDespesa: item.natureza_despesa || undefined,
            naturezaDespesaId: item.natureza_despesa_id || undefined,
            planoInterno: item.plano_interno || undefined,
            planoInternoId: item.plano_interno_id || undefined,
            dataEmissao: item.data_emissao ? new Date(item.data_emissao) : undefined,
            descricao: item.descricao || undefined,
            valor: Number(item.valor),
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
        }));
    },

    async create(descentralizacao: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'>): Promise<Descentralizacao> {
        const { data, error } = await supabase
            .from('descentralizacoes')
            .insert({
                dimensao: descentralizacao.dimensao,
                dimensao_id: descentralizacao.dimensaoId || null,
                origem_recurso: descentralizacao.origemRecurso,
                origem_recurso_id: descentralizacao.origemRecursoId || null,
                natureza_despesa: descentralizacao.naturezaDespesa || '',
                natureza_despesa_id: descentralizacao.naturezaDespesaId || null,
                plano_interno: descentralizacao.planoInterno,
                plano_interno_id: descentralizacao.planoInternoId || null,
                data_emissao: descentralizacao.dataEmissao ? descentralizacao.dataEmissao.toISOString().split('T')[0] : null,
                descricao: descentralizacao.descricao || '',
                valor: descentralizacao.valor,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            dimensao: data.dimensao,
            dimensaoId: data.dimensao_id || undefined,
            origemRecurso: data.origem_recurso,
            origemRecursoId: data.origem_recurso_id || undefined,
            naturezaDespesa: data.natureza_despesa || undefined,
            naturezaDespesaId: data.natureza_despesa_id || undefined,
            planoInterno: data.plano_interno || undefined,
            planoInternoId: data.plano_interno_id || undefined,
            dataEmissao: data.data_emissao ? new Date(data.data_emissao) : undefined,
            descricao: data.descricao || undefined,
            valor: Number(data.valor),
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
        };
    },

    async update(id: string, descentralizacao: Partial<Descentralizacao>): Promise<void> {
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (descentralizacao.dimensao !== undefined) updates.dimensao = descentralizacao.dimensao;
        if (descentralizacao.dimensaoId !== undefined) updates.dimensao_id = descentralizacao.dimensaoId || null;
        if (descentralizacao.origemRecurso !== undefined) updates.origem_recurso = descentralizacao.origemRecurso;
        if (descentralizacao.origemRecursoId !== undefined) updates.origem_recurso_id = descentralizacao.origemRecursoId || null;
        if (descentralizacao.naturezaDespesa !== undefined) updates.natureza_despesa = descentralizacao.naturezaDespesa;
        if (descentralizacao.naturezaDespesaId !== undefined) updates.natureza_despesa_id = descentralizacao.naturezaDespesaId || null;
        if (descentralizacao.planoInterno !== undefined) updates.plano_interno = descentralizacao.planoInterno;
        if (descentralizacao.planoInternoId !== undefined) updates.plano_interno_id = descentralizacao.planoInternoId || null;
        if (descentralizacao.dataEmissao !== undefined) updates.data_emissao = descentralizacao.dataEmissao ? descentralizacao.dataEmissao.toISOString().split('T')[0] : null;
        if (descentralizacao.descricao !== undefined) updates.descricao = descentralizacao.descricao;
        if (descentralizacao.valor !== undefined) updates.valor = descentralizacao.valor;

        const { error } = await supabase
            .from('descentralizacoes')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('descentralizacoes')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async processDevolucao(devolucao) {
        const { ptres, planoInterno, valor } = devolucao;

        // Buscar descentralização correspondente
        const { data, error } = await supabase
            .from('descentralizacoes')
            .select('*')
            .eq('plano_interno', planoInterno)
            .eq('ptres', ptres)
            .single();

        if (error) {
            console.error('Erro ao buscar descentralização:', error);
            return;
        }

        // Atualizar saldo
        const novoValor = data.valor - valor;

        const { error: updateError } = await supabase
            .from('descentralizacoes')
            .update({ valor: novoValor })
            .eq('id', data.id);

        if (updateError) {
            console.error('Erro ao atualizar saldo:', updateError);
        } else {
            console.log(`Saldo atualizado para o plano interno ${planoInterno}: ${novoValor}`);
        }
    },
};
