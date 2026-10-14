// Explicit integration test. Creates disposable Auth/process/PDF fixtures and
// removes them in finally. No email, no real financial process, no SIAFI action.
import {createClient} from 'npm:@supabase/supabase-js@2.94.1';
import {PDFDocument,StandardFonts} from 'npm:pdf-lib@1.17.1';
if(Deno.env.get('SIAFI_REMOTE_TEST')!=='1')throw new Error('Execute explicitamente com SIAFI_REMOTE_TEST=1.');
const ref=(await Deno.readTextFile('supabase/.temp/project-ref')).trim();
const command=await new Deno.Command('supabase',{args:['projects','api-keys','--project-ref',ref,'-o','json'],stdout:'piped',stderr:'piped'}).output();
if(!command.success)throw new Error('Não foi possível obter as credenciais do projeto vinculado.');
const keys=JSON.parse(new TextDecoder().decode(command.stdout));
const service=keys.find((key:{name:string})=>key.name==='service_role')?.api_key,anon=keys.find((key:{name:string})=>key.name==='anon')?.api_key;
if(!service||!anon)throw new Error('Credenciais não disponíveis.');
const base=`https://${ref}.supabase.co`,admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
let userId='',processId='',token='',path='';const runs:string[]=[],reports:unknown[]=[];
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
async function action(body:unknown) {
  const response=await fetch(`${base}/functions/v1/analisar-liquidacao-siafi`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw new Error(`Conferência falhou: ${result.error || response.status}`);
  return result;
}
async function result(id:string) {
  for(let attempt=0;attempt<100;attempt++) {
    const data=await action({action:'status',runId:id});
    if(data.run.status==='completed')return data;
    if(data.run.status==='failed')throw new Error(`Worker interrompido: ${data.run.error_message}`);
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw new Error('Worker não concluiu no prazo da integração.');
}
async function cleanup() {
  if(!userId)return;
  const paths=path?[path]:[];
  for(const id of runs) {
    const folder=`${userId}/siafi-analises/${id}`;
    const {data:objects}=await admin.storage.from('suap-pdfs').list(folder,{limit:100});
    paths.push(...(objects || []).map(file=>`${folder}/${file.name}`));
  }
  if(paths.length){const {error}=await admin.storage.from('suap-pdfs').remove(paths);if(error)throw new Error('Falha ao remover os PDFs fictícios.');}
  if(processId){const {error}=await admin.from('processos').delete().eq('id',processId).eq('tenant_id',userId);if(error)throw new Error('Falha ao remover processo fictício.');}
  const {error}=await admin.auth.admin.deleteUser(userId);if(error)throw new Error('Falha ao remover usuário fictício.');
  console.log('Fixture removida: usuário, processo, análises, revisão e PDFs.');
}
try {
  for(const functionName of ['analisar-liquidacao-siafi','analisar-liquidacao-siafi-worker']) {
    const response=await fetch(`${base}/functions/v1/${functionName}`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:'{}'});
    assert(response.status===401,`${functionName} deve recusar acesso sem autenticação.`);
  }
  const password=crypto.randomUUID()+crypto.randomUUID(),email=`siafi-fixture-${Date.now()}@example.invalid`;
  const {data:user,error:userError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(userError||!user.user)throw new Error('Não foi possível criar usuário descartável para a integração.');
  userId=user.user.id;
  const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:session,error:sessionError}=await client.auth.signInWithPassword({email,password});
  if(sessionError||!session.session)throw new Error('Não foi possível autenticar a fixture.');token=session.session.access_token;
  path=`${userId}/fixture-siafi.pdf`;
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage();
  const lines=['DOCUMENTO FICTICIO PARA TESTE AUTOMATIZADO - NAO PAGAR','Processo: 99999.000001.2026-01','Nota fiscal: 123','Data de emissao: 13/10/2026','Fornecedor: EMPRESA FICTICIA','CNPJ: 11.111.111/0001-91','Valor bruto autorizado: 100,00','Valor liquido autorizado: 100,00','Objeto: fornecimento de material de consumo','UG: 158366. Exercicio: 2026. Documento NP 999999.'];
  lines.forEach((line,index)=>page.drawText(line,{x:40,y:780-index*30,font,size:12}));
  const {error:uploadError}=await admin.storage.from('suap-pdfs').upload(path,await pdf.save(),{contentType:'application/pdf'});
  if(uploadError)throw new Error('Não foi possível inserir o PDF fictício.');
  const {data:process,error:processError}=await admin.from('processos').insert({tenant_id:userId,suap_id:`fixture-${Date.now()}`,url:'https://suap.ifrn.edu.br/processo_eletronico/processo/999999/',num_processo:'99999.000001.2026-01',status:'success',beneficiario:'EMPRESA FICTICIA',cpf_cnpj:'11111111000191',assunto:'Fornecimento de material de consumo - fixture',pdf_url:path,dados_completos:{val_nf:'100,00',notas_fiscais:[{numero:'123',data_emissao:'2026-10-13',valor:'100,00'}],dados_bancarios:{banco:'001',agencia:'0012',conta:'00123-X'}}}).select('id').single();
  if(processError||!process)throw new Error('Não foi possível inserir o processo fictício.');processId=process.id;
  const capture=(amount:string)=>({schemaVersion:'1.0.0',captureId:crypto.randomUUID(),source:'https://siafi.tesouro.gov.br/siafiweb/dh',startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),status:'complete',document:{ug:'158366',year:'2026',type:'NP',number:'999999'},warnings:[],sections:[{key:'dados_basicos',status:'captured',fields:[{label:'Processo',id:'processo',value:'99999.000001.2026-01'},{label:'Valor do Documento',id:'valor',value:amount},{label:'Código do Credor',id:'credor',value:'11111111000191'},{label:'Data Emissão Contábil',id:'emissao',value:'13/10/2026'}],tables:[{headers:['Número Doc. Origem','Valor'],rows:[[{text:'123'},{text:amount}]]}],text:'Nota fiscal 123'},{key:'deducao',status:'empty',fields:[],tables:[],text:'Sem deduções'}],predocs:[],analysis:{status:'not_requested'}});
  for(const amount of ['105,50','100,00']) {
    const started=await action({action:'start',captura:capture(amount),processoId:processId});
    assert(started.runId,'O fluxo deveria selecionar a nota e iniciar automaticamente.');runs.push(started.runId);
    const {run}=await result(started.runId),data=run.result_snapshot;
    reports.push(data);
    await Deno.mkdir('tmp',{recursive:true});await Deno.writeTextFile('tmp/siafi-checklist-remoto.json',JSON.stringify(reports,null,2));
    assert(data.checklist.length>=32,'Cobertura incompleta de regras.');
    const check=data.checklist.find((item:{regraId:string})=>item.regraId==='C04');
    assert(check?.status===(amount==='105,50'?'divergente':'conforme'),`C04 inesperado: ${check?.status}; ${check?.observacao}`);
    assert(check.calculo?.diferencaCentavos===(amount==='105,50'?550:0),'Cálculo em centavos não corresponde à fixture.');
    assert(data.fontes.some((source:{paginasTexto?:string[]})=>source.paginasTexto?.[0]?.includes('Valor bruto autorizado: 100,00')),'O worker não verificou o texto do PDF.');
    if(amount==='105,50') {
      await action({action:'review',runId:run.id,itemId:check.id,conferido:true,feedback:'confirmo_divergencia',motivo:'Fixture: diferença esperada de R$ 5,50.'});
      const reviewed=await action({action:'status',runId:run.id});
      assert(reviewed.run.result_snapshot.checklist.find((item:{id:string})=>item.id===check.id).status==='divergente','A revisão alterou o parecer.');
      assert(reviewed.reviews.length===1,'A revisão não foi registrada.');
    } else {
      assert(data.analiseAnteriorId===runs[0],'Análise anterior não vinculada.');
      assert(check.evolucao==='resolvido',`Evolução inesperada: ${check.evolucao}`);
    }
    console.log(`Fixture PJ ${amount}: C04 ${check.status}; delta ${check.calculo.diferencaCentavos} centavos; ${data.checklist.length} itens.`);
  }
  for(const missingValue of [false,true]) {
    const studentPdf=await PDFDocument.create(),studentFont=await studentPdf.embedFont(StandardFonts.Helvetica),studentPage=studentPdf.addPage();
    const studentLines=['DOCUMENTO FICTICIO PARA TESTE - NAO PAGAR','Processo: 99999.000001.2026-01','Autorizacao de bolsas de assistencia estudantil','Programa: PAFE. Competencia: 2026-10. Parcela: 1.','Estudante A. CPF: 000.000.001-91. Valor autorizado: 72,10.',`Estudante B. CPF: 000.000.002-72. Valor autorizado: ${missingValue?'NAO INFORMADO':'127,90'}.`,'Total autorizado: 200,00. Sem comprovacao de pagamento anterior.'];
    studentLines.forEach((line,index)=>studentPage.drawText(line,{x:40,y:780-index*30,font:studentFont,size:12}));
    const upload=await admin.storage.from('suap-pdfs').upload(path,await studentPdf.save(),{contentType:'application/pdf',upsert:true});assert(!upload.error,'PDF de estudantes não atualizado.');
    const updated=await admin.from('processos').update({assunto:'Bolsas assistência estudantil PAFE',dados_completos:{val_nf:'200,00',notas_fiscais:[]}}).eq('id',processId).eq('tenant_id',userId);assert(!updated.error,'Processo de estudantes não atualizado.');
    const studentCapture=capture('200,00');studentCapture.document={ug:'158366',year:'2026',type:'RP',number:missingValue?'999998':'999997'};
    studentCapture.sections[0].text='Programa PAFE, competência 2026-10, parcela 1';
    studentCapture.sections.push({key:'dados_pagamento',status:'captured',fields:[],tables:[{headers:['CPF','Nome','Valor'],rows:[[{text:'00000000191'},{text:'Estudante A'},{text:'72,10'}],[{text:'00000000272'},{text:'Estudante B'},{text:'127,90'}]]}],text:'Favorecidos PAFE 2026-10 parcela 1'});
    const started=await action({action:'start',captura:studentCapture,processoId:processId,tipoPagamento:'estudantes',listaAusente:true,competencia:'2026-10'});
    assert(started.runId,'Análise de estudantes não iniciada.');runs.push(started.runId);
    const {run}=await result(started.runId),data=run.result_snapshot;reports.push(data);
    await Deno.writeTextFile('tmp/siafi-checklist-remoto.json',JSON.stringify(reports,null,2));
    const individual=data.checklist.filter((item:{regraId:string})=>item.regraId==='B03');
    assert(individual.some((item:{entidade:string,status:string})=>item.entidade.includes('00000000191')&&item.status==='conforme'),'Valor individual 72,10 não conferido.');
    const second=individual.find((item:{entidade:string})=>item.entidade.includes('00000000272'));
    assert(second?.status===(missingValue?'nao_verificavel':'conforme'),`Valor do estudante B: ${second?.status}`);
    if(!missingValue)assert(data.checklist.find((item:{regraId:string})=>item.regraId==='B04')?.calculo?.diferencaCentavos===0,'Soma de estudantes não reproduzida.');
    console.log(`Fixture estudantes: valores distintos e ${missingValue?'valor ausente pendente':'soma em centavos conferida'}.`);
  }
  await Deno.mkdir('tmp',{recursive:true});await Deno.writeTextFile('tmp/siafi-checklist-remoto.json',JSON.stringify(reports,null,2));
} finally {
  await cleanup();
}
