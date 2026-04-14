import { supabase } from '@/lib/supabase';
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
import { Descentralizacao } from '@/types';

const DESCENTRALIZACOES_SELECT = 'id,dimensao,dimensao_id,nota_credito,operacao_tipo,origem_recurso,origem_recurso_id,natureza_despesa,natureza_despesa_id,plano_interno,plano_interno_id,data_emissao,descricao,valor,created_at,updated_at';

type DescentralizacaoRow = {
    id: string;
    dimensao: string;
    dimensao_id?: string | null;
    nota_credito?: string | null;
    operacao_tipo?: string | null;
    origem_recurso: string;
    origem_recurso_id?: string | null;
    natureza_despesa?: string | null;
    natureza_despesa_id?: string | null;
    plano_interno?: string | null;
    plano_interno_id?: string | null;
    data_emissao?: string | null;
    descricao?: string | null;
    valor: number | string;
    created_at: string;
    updated_at: string;
};

type ProcessDevolucaoInput = {
    dataEmissao?: string;
    descricao?: string;
    ptres: string;
    naturezaDespesa?: string;
    planoInterno?: string;
    valor: number;
    dimensao: string;
};

const mapDescentralizacaoRow = (item: DescentralizacaoRow): Descentralizacao => ({
    id: item.id,
    dimensao: item.dimensao,
    dimensaoId: item.dimensao_id || undefined,
    notaCredito: item.nota_credito || undefined,
    operacaoTipo: item.operacao_tipo || undefined,
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
});

export const descentralizacoesService = {
    async getAll(): Promise<Descentralizacao[]> {
        const { data, error } = await supabase
            .from('descentralizacoes')
            .select(DESCENTRALIZACOES_SELECT)
            .order('data_emissao', { ascending: false, nullsFirst: false });

        if (error) {
            console.warn('descentralizacoesService.getAll: fallback para Supabase REST', error);
            const fallbackData = await fetchSupabaseRestRows<DescentralizacaoRow>('descentralizacoes', DESCENTRALIZACOES_SELECT, {
                orderBy: 'data_emissao',
            });
            return fallbackData.map(mapDescentralizacaoRow);
        }

        if (!data || data.length === 0) {
            const fallbackData = await fetchSupabaseRestRows<DescentralizacaoRow>('descentralizacoes', DESCENTRALIZACOES_SELECT, {
                orderBy: 'data_emissao',
            });
            return fallbackData.map(mapDescentralizacaoRow);
        }

        return (data as DescentralizacaoRow[]).map(mapDescentralizacaoRow);
    },

    async create(descentralizacao: Omit<Descentralizacao, 'id' | 'createdAt' | 'updatedAt'>): Promise<Descentralizacao> {
        const { data, error } = await supabase
            .from('descentralizacoes')
            .insert({
                dimensao: descentralizacao.dimensao,
                dimensao_id: descentralizacao.dimensaoId || null,
                nota_credito: descentralizacao.notaCredito || null,
                operacao_tipo: descentralizacao.operacaoTipo || null,
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
            .select(DESCENTRALIZACOES_SELECT)
            .single();

        if (error) throw error;

        return mapDescentralizacaoRow(data as DescentralizacaoRow);
    },

    async update(id: string, descentralizacao: Partial<Descentralizacao>): Promise<void> {
        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (descentralizacao.dimensao !== undefined) updates.dimensao = descentralizacao.dimensao;
        if (descentralizacao.dimensaoId !== undefined) updates.dimensao_id = descentralizacao.dimensaoId || null;
        if (descentralizacao.notaCredito !== undefined) updates.nota_credito = descentralizacao.notaCredito || null;
        if (descentralizacao.operacaoTipo !== undefined) updates.operacao_tipo = descentralizacao.operacaoTipo || null;
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

    async processDevolucao(devolucao: ProcessDevolucaoInput): Promise<Descentralizacao | null> {
        const valorNormalizado = -Math.abs(devolucao.valor);
        const dataEmissao = devolucao.dataEmissao?.trim() || null;
        const descricao = devolucao.descricao?.trim() || 'DEVOLUCAO';

        const { data, error } = await supabase
            .from('descentralizacoes')
            .insert({
                dimensao: devolucao.dimensao,
                origem_recurso: devolucao.ptres.trim(),
                natureza_despesa: devolucao.naturezaDespesa?.trim() || '',
                plano_interno: devolucao.planoInterno?.trim().toUpperCase() || '',
                data_emissao: dataEmissao,
                descricao,
                valor: valorNormalizado,
                operacao_tipo: 'DEVOLUCAO',
            })
            .select(DESCENTRALIZACOES_SELECT)
            .single();

        if (error) {
            console.error('Erro ao registrar devolucao de descentralizacao:', error);
            return null;
        }

        return mapDescentralizacaoRow(data as DescentralizacaoRow);
    },
};
