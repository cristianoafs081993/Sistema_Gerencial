
import { supabase } from '@/lib/supabase';
import { Atividade } from '@/types';

export const atividadesService = {
    async getAll(): Promise<Atividade[]> {
        const { data, error } = await supabase
            .from('atividades')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((item: any) => ({
            id: item.id,
            dimensao: item.dimensao,
            componenteFuncional: item.componente_funcional,
            processo: item.processo,
            atividade: item.atividade,
            descricao: item.descricao,
            valorTotal: Number(item.valor_total),
            origemRecurso: item.origem_recurso,
            naturezaDespesa: item.natureza_despesa,
            planoInterno: item.plano_interno,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
        }));
    },

    async create(atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>): Promise<Atividade> {
        const { data, error } = await supabase
            .from('atividades')
            .insert({
                dimensao: atividade.dimensao,
                componente_funcional: atividade.componenteFuncional,
                processo: atividade.processo,
                atividade: atividade.atividade,
                descricao: atividade.descricao,
                valor_total: atividade.valorTotal,
                origem_recurso: atividade.origemRecurso,
                natureza_despesa: atividade.naturezaDespesa,
                plano_interno: atividade.planoInterno,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            dimensao: data.dimensao,
            componenteFuncional: data.componente_funcional,
            processo: data.processo,
            atividade: data.atividade,
            descricao: data.descricao,
            valorTotal: Number(data.valor_total),
            origemRecurso: data.origem_recurso,
            naturezaDespesa: data.natureza_despesa,
            planoInterno: data.plano_interno,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
        };
    },

    async update(id: string, atividade: Partial<Atividade>): Promise<void> {
        const updates: any = {
            updated_at: new Date().toISOString(),
        };

        if (atividade.dimensao) updates.dimensao = atividade.dimensao;
        if (atividade.componenteFuncional) updates.componente_funcional = atividade.componenteFuncional;
        if (atividade.processo) updates.processo = atividade.processo;
        if (atividade.atividade) updates.atividade = atividade.atividade;
        if (atividade.descricao) updates.descricao = atividade.descricao;
        if (atividade.valorTotal !== undefined) updates.valor_total = atividade.valorTotal;
        if (atividade.origemRecurso) updates.origem_recurso = atividade.origemRecurso;
        if (atividade.naturezaDespesa) updates.natureza_despesa = atividade.naturezaDespesa;
        if (atividade.planoInterno) updates.plano_interno = atividade.planoInterno;

        const { error } = await supabase
            .from('atividades')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('atividades')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
