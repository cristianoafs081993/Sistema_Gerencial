import { supabase } from '@/lib/supabase';
import { Retencao } from '@/types';

export const retencoesService = {
  async upsertBatch(data: Partial<Retencao>[]) {
    // Map dates back to ISO strings if needed, though supabase-js often handles Date objects
    const { error } = await supabase
      .from('retencoes')
      .upsert(data, { 
        // We assume a natural key based on the document and item details
        onConflict: 'documento_habil,dh_ug_pagadora,dh_item_ug_pagadora,dh_credor_numero,metrica' 
      });

    if (error) {
      console.error('Error in retencoesService.upsertBatch:', error);
      throw error;
    }
  }
};
