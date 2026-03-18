import { supabase } from '@/lib/supabase';
import { Contrato } from '@/types';

export const contratosService = {
  async getContratos() {
    const { data, error } = await supabase
      .from('contratos')
      .select('*')
      .order('numero', { ascending: true });

    if (error) throw error;
    return data as Contrato[];
  },

  async upsertBatch(data: Partial<Contrato>[]) {
    const { error } = await supabase
      .from('contratos')
      .upsert(data, { 
        onConflict: 'numero' 
      });

    if (error) {
      console.error('Error in contratosService.upsertBatch:', error);
      throw error;
    }
  },

  async linkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert({ contrato_id: contratoId, empenho_id: empenhoId }, {
        onConflict: 'contrato_id,empenho_id'
      });

    if (error) throw error;
  },

  async unlinkEmpenho(contratoId: string, empenhoId: string) {
    const { error } = await supabase
      .from('contratos_empenhos')
      .delete()
      .match({ contrato_id: contratoId, empenho_id: empenhoId });

    if (error) throw error;
  }
};
