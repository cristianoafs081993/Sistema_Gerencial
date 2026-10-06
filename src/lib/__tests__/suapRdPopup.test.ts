import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';
import { planHtml } from '@/services/__tests__/suapRdFixtures';
const popupHtml=readFileSync(extensionFixturePath('popup.html'),'utf8');
const popupScript=readFileSync(extensionFixturePath('popup.js'),'utf8');
function popup(results:unknown[]=[], rdRunning=false) {
  document.body.innerHTML=popupHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const stored:Record<string,unknown>={};
  const sendMessage=vi.fn(async(message:{source:string;type:string;scope?:string})=>({ok:true,running:rdRunning,status:message.scope==='all'?{results,total:44}:rdRunning?{run:{status:'collecting',processed:3,sourceCount:500,activitiesProcessed:3,activitiesTotal:335}}:null}));
  const response=(payload:unknown)=>({ok:true,json:async()=>payload});
  const fetcher=vi.fn(async(_url:string,options?:{body:string})=>{
    const {action}=JSON.parse(options?.body||'{}');
    return response(action==='sync-html'?{status:'preview',runId:'plan',sourceCount:1}:action==='sync-all'?{status:'preview',batchId:'batch',completedCount:44}:{});
  });
  vi.stubGlobal('chrome',{
    runtime:{sendMessage},storage:{local:{get:vi.fn(async()=>({...stored})),set:vi.fn(async(value:Record<string,unknown>)=>Object.assign(stored,value)),remove:vi.fn(async(keys:string|string[])=>{for(const key of [keys].flat())delete stored[key];})},onChanged:{addListener:vi.fn()}},
    tabs:{query:vi.fn().mockResolvedValue([{id:7,url:'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/'}])},
    scripting:{executeScript:vi.fn().mockResolvedValue([{result:{url:'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',html:planHtml,unit:'19'}}])},
  });
  vi.stubGlobal('SiagesExtensionAuth',{getSession:vi.fn().mockResolvedValue({accessToken:'jwt'})});
  vi.stubGlobal('fetch',fetcher);
  new Function(popupScript)();
  const actions=()=>fetcher.mock.calls.map(([,options])=>JSON.parse(options?.body||'{}').action);
  return {sendMessage,fetcher,actions,response};
}
afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,0));document.body.innerHTML='';vi.unstubAllGlobals();});
const button=(id:string)=>document.getElementById(id) as HTMLButtonElement;
it.each([
  ['btn-extract-en','sync-html','apply','Aplicar atividades desta unidade'],
  ['btn-extract-all','sync-all','apply-batch','Aplicar atividades das unidades conferidas'],
])('sincroniza e aplica somente atividades em %s',async(id,action,applyAction,caption)=>{
  const {sendMessage,actions}=popup();
  button(id).click();
  await waitFor(()=>expect(button('btn-apply-plan').hidden).toBe(false));
  expect(actions()).toContain(action);
  expect(button('btn-apply-plan').textContent).toBe(caption);
  button('btn-apply-plan').click();
  await waitFor(()=>expect(actions()).toContain(applyAction));
  await waitFor(()=>expect(button('btn-apply-plan').hidden).toBe(true));
  expect(sendMessage.mock.calls.some(([message])=>['start','apply'].includes(message.type))).toBe(false);
});
it.each([
  ['btn-collect-rds',undefined],['btn-collect-all-rds','all'],
])('coleta apenas RDs em %s e preserva o progresso das atividades',async(id,scope)=>{
  const {sendMessage,actions}=popup();
  await waitFor(()=>expect(document.getElementById('rd-sync-status')?.textContent).toContain('Unidade SUAP 19'));
  const activityStatus=document.getElementById('status')!;
  activityStatus.textContent='Conferência de atividades disponível';
  button(id!).click();
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({source:'siages-extension-rd-sync',type:'start',unit:'19',tabId:7,...(scope?{scope}:{})})));
  expect(actions().every(action=>action==='status')).toBe(true);
  expect(activityStatus.textContent).toBe('Conferência de atividades disponível');
  expect(button('btn-extract-en').disabled).toBe(false);
  expect(button('btn-extract-all').disabled).toBe(false);
});
it('permite sincronizar atividades durante a coleta de RDs e descreve relações oficiais',async()=>{
  const {actions}=popup([],true);
  await waitFor(()=>expect(document.getElementById('rd-sync-status')?.textContent).toContain('3/335 relações oficiais verificadas'));
  expect(button('btn-collect-rds').disabled).toBe(true);
  expect(button('btn-extract-en').disabled).toBe(false);
  button('btn-extract-en').click();
  await waitFor(()=>expect(button('btn-apply-plan').hidden).toBe(false));
  expect(actions()).toContain('sync-html');
  expect(button('btn-collect-rds').disabled).toBe(true);
  expect(document.getElementById('rd-sync-status')?.textContent).toContain('Coletando RDs');
});
it('permite iniciar RDs sem aguardar a resposta da sincronização de atividades',async()=>{
  const {sendMessage,fetcher,response}=popup();
  await waitFor(()=>expect(document.getElementById('rd-sync-status')?.textContent).toContain('Unidade SUAP 19'));
  let finishPlan!:(value:ReturnType<typeof response>)=>void;
  fetcher.mockImplementation(async(_url,options)=>JSON.parse(options?.body||'{}').action==='sync-html'?new Promise(resolve=>{finishPlan=resolve;}):response({}));
  button('btn-extract-en').click();
  await waitFor(()=>expect(finishPlan).toBeTypeOf('function'));
  try {
    expect(button('btn-extract-en').disabled).toBe(true);
    expect(button('btn-collect-rds').disabled).toBe(false);
    button('btn-collect-rds').click();
    await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({type:'start',unit:'19'})));
  } finally {
    finishPlan(response({status:'preview',runId:'plan',sourceCount:1}));
    await waitFor(()=>expect(button('btn-extract-en').disabled).toBe(false));
  }
});
it('mostra falhas por unidade e oferece aplicar apenas as capturas completas',async()=>{
  const {sendMessage,actions}=popup([{unit:'19',code:'DG/CN',run:{status:'preview',complete:true}},{unit:'25',code:'DG/JUC',error:'Sem permissão SUAP'},{unit:'29',code:'DG/PAAS',run:{status:'collecting',complete:false}}]);
  const applyButton=document.getElementById('btn-apply-all-rds') as HTMLButtonElement;
  await waitFor(()=>expect(applyButton.hidden).toBe(false));
  expect(applyButton.textContent).toBe('Aplicar RDs de 1 unidade(s) conferida(s)');
  expect(document.getElementById('rd-all-sync-status')?.textContent).toContain('DG/JUC: Sem permissão SUAP');
  applyButton.click();
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({source:'siages-extension-rd-sync',type:'apply',scope:'all'})));
  expect(actions().every(action=>action==='status')).toBe(true);
});
