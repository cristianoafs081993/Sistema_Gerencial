
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
            dimensaoId: item.dimensao_id || undefined,
            componenteFuncional: item.componente_funcional,
            componenteFuncionalId: item.componente_funcional_id || undefined,
            processo: item.processo,
            atividade: item.atividade,
            descricao: item.descricao,
            valorTotal: Number(item.valor_total),
            origemRecurso: item.origem_recurso,
            origemRecursoId: item.origem_recurso_id || undefined,
            naturezaDespesa: item.natureza_despesa,
            naturezaDespesaId: item.natureza_despesa_id || undefined,
            planoInterno: item.plano_interno,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
        }));
    },

    async create(atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>): Promise<Atividade> {
        const payload: any = {
            dimensao: atividade.dimensao,
            dimensao_id: atividade.dimensaoId || null,
            componente_funcional: atividade.componenteFuncional,
            componente_funcional_id: atividade.componenteFuncionalId || null,
            atividade: atividade.atividade,
            descricao: atividade.descricao,
            valor_total: atividade.valorTotal,
            origem_recurso: atividade.origemRecurso,
            origem_recurso_id: atividade.origemRecursoId || null,
            natureza_despesa: atividade.naturezaDespesa,
            natureza_despesa_id: atividade.naturezaDespesaId || null,
            plano_interno: atividade.planoInterno,
            processo: atividade.processo || '', // Garante string vazia em vez de NULL
        };

        const { data, error } = await supabase
            .from('atividades')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            dimensao: data.dimensao,
            dimensaoId: data.dimensao_id || undefined,
            componenteFuncional: data.componente_funcional,
            componenteFuncionalId: data.componente_funcional_id || undefined,
            processo: data.processo,
            atividade: data.atividade,
            descricao: data.descricao,
            valorTotal: Number(data.valor_total),
            origemRecurso: data.origem_recurso,
            origemRecursoId: data.origem_recurso_id || undefined,
            naturezaDespesa: data.natureza_despesa,
            naturezaDespesaId: data.natureza_despesa_id || undefined,
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
        if (atividade.dimensaoId !== undefined) updates.dimensao_id = atividade.dimensaoId || null;
        if (atividade.componenteFuncional) updates.componente_funcional = atividade.componenteFuncional;
        if (atividade.componenteFuncionalId !== undefined) updates.componente_funcional_id = atividade.componenteFuncionalId || null;
        if (atividade.atividade) updates.atividade = atividade.atividade;
        if (atividade.descricao) updates.descricao = atividade.descricao;
        if (atividade.valorTotal !== undefined) updates.valor_total = atividade.valorTotal;
        if (atividade.origemRecurso) updates.origem_recurso = atividade.origemRecurso;
        if (atividade.origemRecursoId !== undefined) updates.origem_recurso_id = atividade.origemRecursoId || null;
        if (atividade.naturezaDespesa) updates.natureza_despesa = atividade.naturezaDespesa;
        if (atividade.naturezaDespesaId !== undefined) updates.natureza_despesa_id = atividade.naturezaDespesaId || null;
        if (atividade.planoInterno) updates.plano_interno = atividade.planoInterno;
        
        // Removido envio de 'processo' no update para evitar conflitos de NOT NULL

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
