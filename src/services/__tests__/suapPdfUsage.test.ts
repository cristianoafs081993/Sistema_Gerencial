import {describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {touchSuapPdfUsage} from '../suapPdfUsage';
describe('SUAP PDF usage',()=>{
 it('envia o alvo pelo cliente autenticado recebido',async()=>{const rpc=vi.fn().mockResolvedValue({error:null});await touchSuapPdfUsage({rpc} as unknown as SupabaseClient,{path:'tenant/123.pdf'});expect(rpc).toHaveBeenCalledWith('touch_suap_process_pdf',{p_processo_id:null,p_storage_path:'tenant/123.pdf',p_suap_id:null});});
 it('bloqueia o acesso durante limpeza ou erro de registro',async()=>{const rpc=vi.fn().mockResolvedValue({error:{message:'PDF em limpeza'}});await expect(touchSuapPdfUsage({rpc} as unknown as SupabaseClient,{processId:'id'})).rejects.toThrow('PDF em limpeza');});
});
