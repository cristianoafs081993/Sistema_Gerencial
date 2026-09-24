import { supabase } from '@/lib/supabase';
import { parseCurrency } from '@/lib/utils';
import { DocumentoSituacao } from '@/types';

const normalizeDocumentoHabilId = (value: string) => {
    const normalized = String(value || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    return normalized.length > 12 ? normalized.slice(-12) : normalized;
};

const isSituacaoRetencao = (codigo: string) =>
    codigo.startsWith('DDF') ||
    codigo.startsWith('DDU') ||
    codigo === 'DOB001' ||
    codigo === 'DOB035';

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

    async importSituacoesDocumentosHabeis(data: Record<string, string>[]): Promise<number> {
        const situacoes = data.flatMap((row): DocumentoSituacao[] => {
            const documentoHabilId = normalizeDocumentoHabilId(
                row.documentohabil || row.dhdocumentohabil || row.documento_habil || '',
            );
            const situacaoCodigo = String(row.dhsituacao || row.situacao_codigo || '').trim().toUpperCase();
            const rawValue = row.metricavalor || row.dhvalordocorigem || row.valor;
            if (!documentoHabilId || !situacaoCodigo || rawValue === undefined || rawValue === '') return [];

            return [{
                documento_habil_id: documentoHabilId,
                situacao_codigo: situacaoCodigo,
                valor: parseCurrency(rawValue),
                is_retencao: isSituacaoRetencao(situacaoCodigo),
            }];
        });

        if (situacoes.length === 0) {
            throw new Error('O CSV não contém situações com documento hábil e valor reconhecidos.');
        }

        await this.upsertSituacoesBatch(situacoes);
        return situacoes.length;
    },
    
    async deleteByDocumento(documentoHabilId: string) {
        const { error } = await supabase
            .from('documentos_habeis_situacoes')
            .delete()
            .eq('documento_habil_id', documentoHabilId);

        if (error) throw error;
    }
};
