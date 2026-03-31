import { supabase } from '@/lib/supabase';
import type { NaturezaDespesaDB, DimensaoDB, OrigemRecursoDB, ComponenteFuncionalDB } from '@/types';

/**
 * Service para buscar dados das tabelas de domínio (lookup tables).
 * Usado nos dropdowns e filtros do frontend.
 */
export const dominioService = {
    async getNaturezasDespesa(): Promise<NaturezaDespesaDB[]> {
        const { data, error } = await supabase
            .from('naturezas_despesa')
            .select('*')
            .order('codigo');

        if (error) throw error;
        return (data || []).map((item) => ({
            id: item.id,
            codigo: item.codigo,
            nome: item.nome || '',
        }));
    },

    async getDimensoes(): Promise<DimensaoDB[]> {
        const { data, error } = await supabase
            .from('dimensoes')
            .select('*')
            .order('codigo');

        if (error) throw error;
        return (data || []).map((item) => ({
            id: item.id,
            codigo: item.codigo,
            nome: item.nome,
        }));
    },

    async getOrigensRecurso(): Promise<OrigemRecursoDB[]> {
        const { data, error } = await supabase
            .from('origens_recurso')
            .select('*')
            .order('codigo');

        if (error) throw error;
        return (data || []).map((item) => ({
            id: item.id,
            codigo: item.codigo,
            descricao: item.descricao || '',
        }));
    },

    async getComponentesFuncionais(dimensaoId?: string): Promise<ComponenteFuncionalDB[]> {
        let query = supabase
            .from('componentes_funcionais')
            .select('*')
            .order('nome');

        if (dimensaoId) {
            query = query.eq('dimensao_id', dimensaoId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((item) => ({
            id: item.id,
            dimensaoId: item.dimensao_id,
            nome: item.nome,
        }));
    },

    /**
     * Faz upsert de uma natureza de despesa (usado na sync da API).
     * Retorna o ID da natureza.
     */
    async upsertNaturezaDespesa(codigo: string, nome: string): Promise<string | null> {
        if (!codigo || codigo.trim() === '') return null;

        const { data, error } = await supabase
            .from('naturezas_despesa')
            .upsert(
                { codigo: codigo.trim(), nome: nome.trim() },
                { onConflict: 'codigo' }
            )
            .select('id')
            .single();

        if (error) {
            console.error('Erro ao upsert natureza_despesa:', error);
            return null;
        }
        return data?.id || null;
    },

    /**
     * Faz upsert de uma origem de recurso (usado na sync da API).
     * Retorna o ID da origem.
     */
    async upsertOrigemRecurso(codigo: string): Promise<string | null> {
        if (!codigo || codigo.trim() === '' || codigo === 'NÃO DEFINIDA') return null;

        const { data, error } = await supabase
            .from('origens_recurso')
            .upsert(
                { codigo: codigo.trim() },
                { onConflict: 'codigo' }
            )
            .select('id')
            .single();

        if (error) {
            console.error('Erro ao upsert origem_recurso:', error);
            return null;
        }
        return data?.id || null;
    },
};
