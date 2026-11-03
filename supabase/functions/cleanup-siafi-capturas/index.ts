import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.94.1';
import {SIAFI_CAPTURAS_BUCKET, runSiafiCapturasCleanup} from '../_shared/siafi_capturas_cleanup.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false,autoRefreshToken:false}});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
// Chamada pelo cron diário (segredo interno no Vault) ou manualmente com a service_role.
Deno.serve(async req=>{
  if(req.method!=='POST')return response({error:'Method not allowed'},405);
  const token=req.headers.get('x-cleanup-secret');
  const serviceAuth=req.headers.get('authorization')===`Bearer ${key}`;
  if(!serviceAuth){
    if(!token)return response({error:'Unauthorized'},401);
    const {data,error}=await admin.rpc('validate_siafi_capturas_cleanup_secret',{p_secret:token});
    if(error||!data)return response({error:'Unauthorized'},401);
  }
  try{
    const summary=await runSiafiCapturasCleanup({
      candidates:async(cutoff,limit)=>await admin.rpc('siafi_capturas_cleanup_candidates',{p_cutoff:cutoff,p_limit:limit}),
      remove:async paths=>await admin.storage.from(SIAFI_CAPTURAS_BUCKET).remove(paths),
      deleteRows:async cutoff=>await admin.from('extension_siafi_uploads').delete({count:'exact'}).lt('updated_at',cutoff),
    });
    console.log('SIAFI capturas cleanup',JSON.stringify(summary));
    return response(summary,summary.failedBatches?207:200);
  }catch(error){
    console.error('SIAFI capturas cleanup failed',error instanceof Error?error.message:'unknown');
    return response({error:'Falha na limpeza das capturas do printup.'},500);
  }
});
