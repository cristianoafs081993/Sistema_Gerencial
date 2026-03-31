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
  },

  async deleteByNumeros(numeros: string[]) {
    if (numeros.length === 0) return;
    const { error } = await supabase
      .from('contratos')
      .delete()
      .in('numero', numeros);
    if (error) throw error;
  },

  async upsertLinks(links: { contrato_id: string; empenho_id: string }[]) {
    if (links.length === 0) return;
    const { error } = await supabase
      .from('contratos_empenhos')
      .upsert(links, { onConflict: 'contrato_id,empenho_id' });
    if (error) throw error;
  },

  async getEmpenhos() {
    const { data, error } = await supabase
      .from('empenhos')
      .select('id, numero');
    if (error) throw error;
    return data as { id: string; numero: string }[];
  },
};
