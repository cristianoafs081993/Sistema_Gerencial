import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';
import { rdListUrl } from '@/services/__tests__/suapRdFixtures';

type Values=Record<string, unknown>;
type Message={type:string;unit?:string;scope?:string;tabId?:number;forceFull?:boolean};
const popupUrl='chrome-extension://test/popup.html';
beforeAll(()=>{if(!AbortSignal.timeout)Object.defineProperty(AbortSignal,'timeout',{value:()=>new AbortController().signal,configurable:true});});
function worker(fetcher:ReturnType<typeof vi.fn>) {
  const values:Values={'siages-extension-session':{accessToken:'access',refreshToken:'private-refresh',expiresAt:Date.now()/1000+3600}};
  let listener:(message:unknown,sender:unknown,reply:(value:unknown)=>void)=>unknown;
  const chromeApi={
    runtime:{getURL:(path:string)=>`chrome-extension://test/${path}`,onMessage:{addListener:(value:typeof listener)=>{listener=value;}},onInstalled:{addListener:vi.fn()},onStartup:{addListener:vi.fn()}},
    storage:{local:{get:vi.fn(async(key:string)=>({[key]:values[key]})),set:vi.fn(async(entries:Values)=>{Object.assign(values,entries);}),remove:vi.fn()}},
    alarms:{get:vi.fn(),create:vi.fn(),onAlarm:{addListener:vi.fn()}},
    tabs:{get:vi.fn().mockResolvedValue({id:5,url:'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/'})},
    scripting:{executeScript:vi.fn().mockResolvedValue([{result:{html:'<html>RD</html>',sourceUrl:rdListUrl}}])},
  };
  const context={};
  for(const file of ['scheduled-process-sync.js','rd-sync.js']) new Function('globalThis',readFileSync(extensionFixturePath(file),'utf8'))(context);
  new Function('chrome','fetch','globalThis',readFileSync(extensionFixturePath('background.js'),'utf8'))(chromeApi,fetcher,context);
  return {values,chromeApi,send:(message:Message,senderUrl=popupUrl)=>new Promise<Record<string,unknown>>(resolve=>{
    listener({source:'siages-extension-rd-sync',...message},{url:senderUrl},value=>resolve(value as Record<string,unknown>));
  })};
}
const response=(data:unknown)=>({ok:true,json:async()=>data});
describe('worker de RDs',()=>{
  it.each([{unit:'19'},{scope:'all'}])('encaminha a opção de revalidação completa em %o',async scope=>{
    const fetcher=vi.fn(async(_url:string,options:{body:string})=>{
      const body=JSON.parse(options.body);
      return response(body.action==='units'?{units:[{value:'19',code:'DG/CN',parentUasg:'158366'}]}:{runId:'r',status:'preview',complete:true,nextUrl:null});
    });
    const instance=worker(fetcher);
    await instance.send({type:'start',tabId:5,forceFull:true,...scope});
    await vi.waitFor(()=>expect(fetcher.mock.calls.some(([,options])=>{
      const body=JSON.parse(options.body);return body.action==='sync-extension' && body.forceFull===true && body.suapUnitCode==='19';
    })).toBe(true));
  });
  it('continua após responder ao popup e captura na aba, sem enviar cookies ou refresh token',async()=>{
    const fetcher=vi.fn(async(_url:string,options:{body:string})=>{
      const body=JSON.parse(options.body);
      return response(body.action==='sync-extension'?{runId:'r',status:'collecting',nextUrl:rdListUrl}:{runId:'r',status:'preview',complete:true,nextUrl:null});
    });
    const instance=worker(fetcher);
    await expect(instance.send({type:'start',unit:'19',tabId:5})).resolves.toMatchObject({ok:true,started:true});
    await vi.waitFor(()=>expect(instance.values['siages-suap-rd-status:19']).toMatchObject({running:false,run:{status:'preview'}}));
    expect(instance.chromeApi.scripting.executeScript).toHaveBeenCalledWith(expect.objectContaining({target:{tabId:5},args:[rdListUrl],func:expect.any(Function)}));
    expect(fetcher.mock.calls.map(([,options])=>JSON.parse(options.body).action)).toEqual(['sync-extension','sync-html']);
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/sessionid|private-refresh/);
  });
  it('recusa mensagens de páginas externas antes de ler sessão ou acessar o SUAP',async()=>{
    const fetcher=vi.fn();const instance=worker(fetcher);
    await expect(instance.send({type:'start',unit:'19',tabId:5},'https://evil.test/')).resolves.toMatchObject({ok:false});
    expect(instance.chromeApi.tabs.get).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
  });
  it('mantém retomada disponível se o Chrome encerra a aba antes da leitura',async()=>{
    const fetcher=vi.fn(async(_url:string,options:{body:string})=>response(JSON.parse(options.body).action==='status'?{run:{id:'r',status:'collecting'}}:{runId:'r',status:'collecting',nextUrl:rdListUrl}));
    const instance=worker(fetcher);instance.chromeApi.scripting.executeScript.mockRejectedValue(new Error('Aba fechada'));
    await instance.send({type:'start',unit:'19',tabId:5});
    await vi.waitFor(()=>expect(instance.values['siages-suap-rd-status:19']).toMatchObject({running:false,error:'Aba fechada'}));
    expect(fetcher.mock.calls.map(([,options])=>JSON.parse(options.body).action)).toEqual(['sync-extension','status']);
  });
  it('aplica somente as prévias completas do lote com conferência de usuário e execução no servidor',async()=>{
    const units=[{value:'19',code:'DG/CN',parentUasg:'158366'},{value:'25',code:'DG/JUC',parentUasg:'158366'}];
    const fetcher=vi.fn(async(_url:string,options:{body:string})=>{
      const body=JSON.parse(options.body);
      if(body.action==='units')return response({units});
      if(body.action==='status')return response({run:{id:`r${body.suapUnitCode}`,status:'preview',complete:true}});
      if(body.action==='apply')return response({status:'applied'});
      return response({runId:`r${body.suapUnitCode}`,status:'preview',complete:true,nextUrl:null});
    });
    const instance=worker(fetcher);
    await instance.send({type:'start',scope:'all',tabId:5});
    await vi.waitFor(()=>expect(instance.values['siages-suap-rd-status:all']).toMatchObject({running:false,results:[{unit:'19',campusUasg:'158366'},{unit:'25',campusUasg:'158366'}]}));
    expect(fetcher.mock.calls.some(([,options])=>JSON.parse(options.body).action==='apply')).toBe(false);
    await instance.send({type:'apply',scope:'all'});
    expect(fetcher.mock.calls.filter(([,options])=>JSON.parse(options.body).action==='apply').map(([,options])=>JSON.parse(options.body))).toEqual([
      {action:'apply',suapUnitCode:'19',runId:'r19'},{action:'apply',suapUnitCode:'25',runId:'r25'},
    ]);
    expect(instance.values['siages-suap-rd-status:all']).toMatchObject({results:[{run:{status:'applied'}},{run:{status:'applied'}}]});
    expect(instance.chromeApi.scripting.executeScript).not.toHaveBeenCalled();
  });
  it('reconcilia uma aplicação concluída cuja resposta se perdeu, sem aplicar outra revisão',async()=>{
    const fetcher=vi.fn(async()=>response({run:{id:'r19',status:'applied',complete:true}}));
    const instance=worker(fetcher);
    instance.values['siages-suap-rd-status:19']={run:{id:'r19',status:'preview',complete:true}};
    await expect(instance.send({type:'apply',unit:'19'})).resolves.toMatchObject({ok:true,status:'applied'});
    expect(fetcher).toHaveBeenCalledOnce();
    expect(instance.values['siages-suap-rd-status:19']).toMatchObject({run:{id:'r19',status:'applied'}});
  });
});
