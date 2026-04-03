
import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { Atividade } from '@/types';

const ATIVIDADES_SELECT = 'id,dimensao,dimensao_id,componente_funcional,componente_funcional_id,processo,atividade,descricao,valor_total,origem_recurso,origem_recurso_id,natureza_despesa,natureza_despesa_id,plano_interno,created_at,updated_at';

type AtividadeRow = {
    id: string;
    dimensao: string;
    dimensao_id?: string | null;
    componente_funcional: string;
    componente_funcional_id?: string | null;
    processo?: string | null;
    atividade: string;
    descricao: string;
    valor_total: number | string;
    origem_recurso: string;
    origem_recurso_id?: string | null;
    natureza_despesa: string;
    natureza_despesa_id?: string | null;
    plano_interno: string;
    created_at: string;
    updated_at: string;
};

const mapAtividadeRow = (item: AtividadeRow): Atividade => ({
    id: item.id,
    dimensao: item.dimensao,
    dimensaoId: item.dimensao_id || undefined,
    componenteFuncional: item.componente_funcional,
    componenteFuncionalId: item.componente_funcional_id || undefined,
    processo: item.processo || '',
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
});

export const atividadesService = {
    async getAll(): Promise<Atividade[]> {
        const { data, error } = await supabase
            .from('atividades')
            .select(ATIVIDADES_SELECT)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('atividadesService.getAll: fallback para Supabase REST', error);
            const fallbackData = await fetchSupabaseRestRows<AtividadeRow>('atividades', ATIVIDADES_SELECT, {
                orderBy: 'created_at',
            });
            return fallbackData.map(mapAtividadeRow);
        }

        if (!data || data.length === 0) {
            console.warn('atividadesService.getAll: resultado vazio via supabase-js, consultando REST');
            const fallbackData = await fetchSupabaseRestRows<AtividadeRow>('atividades', ATIVIDADES_SELECT, {
                orderBy: 'created_at',
            });
            return fallbackData.map(mapAtividadeRow);
        }

        return (data as AtividadeRow[]).map(mapAtividadeRow);
    },

    async create(atividade: Omit<Atividade, 'id' | 'createdAt' | 'updatedAt'>): Promise<Atividade> {
        const payload: Record<string, unknown> = {
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
        const updates: Record<string, unknown> = {
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
