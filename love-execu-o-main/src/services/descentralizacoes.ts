import { supabase } from '@/lib/supabase';
import { Descentralizacao } from '@/types';

export const descentralizacoesService = {
    async getAll(): Promise<Descentralizacao[]> {
        const { data, error } = await supabase
            .from('descentralizacoes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((item: any) => ({
            id: item.id,
            dimensao: item.dimensao,
            dimensaoId: item.dimensao_id || undefined,
            origemRecurso: item.origem_recurso,
            origemRecursoId: item.origem_recurso_id || undefined,
            planoInterno: item.plano_interno || undefined,
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
                plano_interno: descentralizacao.planoInterno,
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
            planoInterno: data.plano_interno || undefined,
            valor: Number(data.valor),
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
        };
    },

    async update(id: string, descentralizacao: Partial<Descentralizacao>): Promise<void> {
        const updates: any = {
            updated_at: new Date().toISOString(),
        };

        if (descentralizacao.dimensao !== undefined) updates.dimensao = descentralizacao.dimensao;
        if (descentralizacao.dimensaoId !== undefined) updates.dimensao_id = descentralizacao.dimensaoId || null;
        if (descentralizacao.origemRecurso !== undefined) updates.origem_recurso = descentralizacao.origemRecurso;
        if (descentralizacao.origemRecursoId !== undefined) updates.origem_recurso_id = descentralizacao.origemRecursoId || null;
        if (descentralizacao.planoInterno !== undefined) updates.plano_interno = descentralizacao.planoInterno;
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
};
