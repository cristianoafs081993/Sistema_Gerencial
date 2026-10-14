import { authenticateAnalysis, prepareAnalysis } from './siafi_analysis_backend.ts';
const userId='00000000-0000-0000-0000-000000000001';
const processId='00000000-0000-0000-0000-000000000002';
const capture={schemaVersion:'1.0.0',captureId:'fixture-capture',source:'https://siafi.tesouro.gov.br/dh',status:'complete',sections:[{fields:[{label:'Processo',value:'23035.002988.2026-97'},{label:'Número Doc. Origem',value:'NF 123'}],tables:[]}],predocs:[]};
const process={id:processId,tenant_id:userId,num_processo:'23035.002988.2026-97',cpf_cnpj:'00000000000000',dados_completos:{val_nf:'100,00',notas_fiscais:[{numero:'123',valor:'100,00'}]},pdf_url:`${userId}/123.pdf`};
const expect=(condition:unknown,message='Falha de asserção')=>{if(!condition)throw new Error(message);};
async function rejects(task:()=>Promise<unknown>,message:string) {try{await task();}catch(error){expect(String(error).includes(message),String(error));return;}throw new Error('Era esperada uma recusa.');}
async function withFetch(task:(requests:Request[])=>Promise<void>,invalidUser=false) {
  const original=globalThis.fetch, requests:Request[]=[];
  Deno.env.set('SUPABASE_URL','https://fake.supabase.co');Deno.env.set('SUPABASE_ANON_KEY','test-anon');
  globalThis.fetch=async (input,init)=>{
    const request=new Request(input,init);requests.push(request);const url=new URL(request.url);
    let data:unknown=[];
    if(url.pathname==='/auth/v1/user')data=invalidUser?{message:'Invalid JWT'}:{id:userId,email:'test@example.invalid'};
    if(url.pathname.endsWith('/processos'))data=url.searchParams.get('id')==='eq.not-authorized'?[]:[process];
    return new Response(JSON.stringify(data),{status:invalidUser&&url.pathname==='/auth/v1/user'?401:200,headers:{'Content-Type':'application/json'}});
  };
  try {await task(requests);} finally {globalThis.fetch=original;Deno.env.delete('SUPABASE_URL');Deno.env.delete('SUPABASE_ANON_KEY');}
}
const request=()=>new Request('https://fake.test',{headers:{Authorization:'Bearer fixture-jwt'}});
Deno.test('Analysis: JWT obrigatório e nenhum acesso sem sessão',async()=>withFetch(async requests=>{
  await rejects(()=>authenticateAnalysis(new Request('https://fake.test')),'401:');expect(requests.length===0);
}));
Deno.test('Analysis: JWT inválido recusado pelo Auth',async()=>withFetch(async()=>{await rejects(()=>authenticateAnalysis(request()),'401:');},true));
Deno.test('Analysis: consulta processo pelo usuário e ignora resumo adulterado do cliente',async()=>withFetch(async requests=>{
  const auth=await authenticateAnalysis(request());
  const result=await prepareAnalysis(auth,{captura:capture,processo:{dados_completos:{val_nf:'99999'}}});
  expect(result.input.processo.dados_completos.val_nf==='100,00');expect(result.input.escopo.notaKeys.length===1);
  const query=requests.find(r=>r.url.includes('/processos?'))!;
  expect(new URL(query.url).searchParams.get('tenant_id')===`eq.${userId}`);
  expect(result.input.fontes[0].storagePath.startsWith(`${userId}/`));
}));
Deno.test('Analysis: processo de outro usuário e lista sem acesso recusados',async()=>withFetch(async()=>{
  const auth=await authenticateAnalysis(request());
  await rejects(()=>prepareAnalysis(auth,{captura:capture,processoId:'not-authorized'}),'404:');
  await rejects(()=>prepareAnalysis(auth,{captura:capture,listaId:'foreign-list'}),'403:');
}));
Deno.test('Analysis: nenhuma seleção silenciosa quando notas ou documentos mudam',async()=>withFetch(async()=>{
  const auth=await authenticateAnalysis(request());
  await rejects(()=>prepareAnalysis(auth,{captura:capture,notaKeys:['not-authorized']}),'409:');
  await rejects(()=>prepareAnalysis(auth,{captura:capture,documentoIds:[]}),'400:');
  await rejects(()=>prepareAnalysis(auth,{captura:capture,pagamentoParcial:true}),'400:');
  await rejects(()=>prepareAnalysis(auth,{captura:capture,competencia:'2026-99'}),'400:');
}));
