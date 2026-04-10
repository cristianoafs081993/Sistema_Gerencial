import { supabase } from '@/lib/supabase';
import { DocumentoSituacao } from '@/types';

export const retencoesService = {
    async getSituacoes(documentoHabilId?: string) {
        let query = supabase
            .from('documentos_habeis_situacoes')
            .select('id,documento_habil_id,situacao_codigo,valor,is_retencao,created_at')
            .order('created_at', { ascending: false });

        if (documentoHabilId) {
            query = query.eq('documento_habil_id', documentoHabilId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as DocumentoSituacao[];
    },

    async upsertSituacoesBatch(situacoes: Partial<DocumentoSituacao>[]) {
        if (!situacoes.length) return;

        // O upsert usará a restrição uq_documento_situacao_valor (id_documento, codigo, valor)
        const { error } = await supabase
            .from('documentos_habeis_situacoes')
            .upsert(situacoes, {
                onConflict: 'documento_habil_id, situacao_codigo, valor',
                ignoreDuplicates: false
            });

        if (error) throw error;
    },
    
    async deleteByDocumento(documentoHabilId: string) {
        const { error } = await supabase
            .from('documentos_habeis_situacoes')
            .delete()
            .eq('documento_habil_id', documentoHabilId);

        if (error) throw error;
    }
};
