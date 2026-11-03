import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.94.1';
import {runSuapPdfRetention} from '../_shared/suap_pdf_retention.ts';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false,autoRefreshToken:false}});
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
  if(req.method!=='POST')return response({error:'Method not allowed'},405);
  const token=req.headers.get('x-cleanup-secret');
  const serviceAuth=req.headers.get('authorization')===`Bearer ${key}`;
  if(!serviceAuth){
    if(!token)return response({error:'Unauthorized'},401);
    const {data,error}=await admin.rpc('validate_suap_pdf_retention_secret',{p_secret:token});
    if(error||!data)return response({error:'Unauthorized'},401);
  }
  try{
    const body=await req.json().catch(()=>({}));
    const dryRun=body.dryRun===true;
    if(!dryRun){const {error}=await admin.rpc('reconcile_suap_pdf_retention');if(error)throw error;}
    const {data:run,error:runError}=dryRun?{data:null,error:null}:await admin.from('suap_pdf_retention_runs').insert({}).select('id').single();
    if(runError)throw runError;
    try{
      const summary=await runSuapPdfRetention({
        candidates:async()=>await admin.rpc('suap_pdf_retention_candidates'),
        claim:async()=>await admin.rpc('claim_suap_pdf_retention',{p_limit:50}),
        confirm:async id=>await admin.rpc('confirm_suap_pdf_retention',{p_object_id:id}),
        remove:async path=>await admin.storage.from('suap-pdfs').remove([path]),
        finish:async(id,deleted)=>await admin.rpc('finish_suap_pdf_retention',{p_object_id:id,p_deleted:deleted}),
      },dryRun);
      if(run){const {error}=await admin.from('suap_pdf_retention_runs').update({finished_at:new Date().toISOString(),deleted_count:summary.deleted,deleted_bytes:summary.bytes,failed_count:summary.failed,status:summary.failed?'partial':'completed'}).eq('id',run.id);if(error)throw error;}
      return response(summary);
    }catch(error){
      if(run)await admin.from('suap_pdf_retention_runs').update({finished_at:new Date().toISOString(),status:'failed',error_message:'Falha na execução da retenção; consultar logs do servidor.'}).eq('id',run.id);
      throw error;
    }
  }catch(error){console.error('SUAP PDF retention failed',error instanceof Error?error.message:'unknown');return response({error:'Falha na retenção dos PDFs SUAP.'},500);}
});
