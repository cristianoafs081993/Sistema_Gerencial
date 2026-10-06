import { readFileSync } from 'node:fs';
import { waitFor } from '@testing-library/dom';
import { afterEach, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';
import { planHtml } from '@/services/__tests__/suapRdFixtures';
const popupHtml=readFileSync(extensionFixturePath('popup.html'),'utf8');
const popupScript=readFileSync(extensionFixturePath('popup.js'),'utf8');
function popup(results:unknown[]=[]) {
  document.body.innerHTML=popupHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1];
  const sendMessage=vi.fn(async(message:{source:string;type:string;scope?:string})=>({ok:true,running:false,status:message.scope==='all'?{results,total:44}:null}));
  const fetcher=vi.fn(async(_url:string,_options?:{body:string})=>({ok:true,json:async()=>({status:'preview',runId:'plan',batchId:'batch',sourceCount:1})}));
  vi.stubGlobal('chrome',{
    runtime:{sendMessage},storage:{local:{get:vi.fn().mockResolvedValue({}),set:vi.fn(),remove:vi.fn()},onChanged:{addListener:vi.fn()}},
    tabs:{query:vi.fn().mockResolvedValue([{id:7,url:'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/'}])},
    scripting:{executeScript:vi.fn().mockResolvedValue([{result:{url:'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',html:planHtml,unit:'19'}}])},
  });
  vi.stubGlobal('SiagesExtensionAuth',{getSession:vi.fn().mockResolvedValue({accessToken:'jwt'})});
  vi.stubGlobal('fetch',fetcher);
  new Function(popupScript)();
  return {sendMessage,fetcher};
}
afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,0));document.body.innerHTML='';vi.unstubAllGlobals();});
it('o botão do plano inicia também as RDs da unidade da aba',async()=>{
  const {sendMessage,fetcher}=popup();
  (document.getElementById('btn-extract-en') as HTMLButtonElement).click();
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith({source:'siages-extension-rd-sync',type:'start',unit:'19',tabId:7}));
  expect(fetcher.mock.calls.some(([,options])=>JSON.parse((options as {body:string}).body).action==='sync-html')).toBe(true);
});
it('o botão de todas as unidades inicia tanto o lote do plano quanto o lote de RDs',async()=>{
  const {sendMessage,fetcher}=popup();
  (document.getElementById('btn-extract-all') as HTMLButtonElement).click();
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({source:'siages-extension-rd-sync',type:'start',scope:'all',tabId:7})));
  expect(fetcher.mock.calls.some(([,options])=>JSON.parse((options as {body:string}).body).action==='sync-all')).toBe(true);
});
it('mostra falhas por unidade e oferece aplicar apenas as capturas completas',async()=>{
  const {sendMessage}=popup([{unit:'19',code:'DG/CN',run:{status:'preview',complete:true}},{unit:'25',code:'DG/JUC',error:'Sem permissão SUAP'},{unit:'29',code:'DG/PAAS',run:{status:'collecting',complete:false}}]);
  const applyButton=document.getElementById('btn-apply-all-rds') as HTMLButtonElement;
  await waitFor(()=>expect(applyButton.hidden).toBe(false));
  expect(applyButton.textContent).toBe('Aplicar RDs de 1 unidade(s) conferida(s)');
  expect(document.getElementById('rd-all-sync-status')?.textContent).toContain('DG/JUC: Sem permissão SUAP');
  applyButton.click();
  await waitFor(()=>expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({source:'siages-extension-rd-sync',type:'apply',scope:'all'})));
});
