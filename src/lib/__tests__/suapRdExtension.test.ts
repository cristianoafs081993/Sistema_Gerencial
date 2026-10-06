import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';
import { SUAP_PLAN_UNITS } from '@/lib/suapPlanUnits';
import { collectCapturedRdPage, initialRdState, nextRdCaptureUrl, type RdRun } from '../../../supabase/functions/_shared/suap_rd_sync';
import { activityUrl, detailHtml, listHtml, planHtml, rdListUrl } from '@/services/__tests__/suapRdFixtures';

type PublicRun = { runId:string; status:string; nextUrl:string|null; complete:boolean };
type Request = { action:string; suapUnitCode:string; runId?:string; html?:string; sourceUrl?:string };
type Result = { unit:string; code:string; campusUasg:string; run?:PublicRun; error?:string };
type Options = { unit:string; post:(body:Request)=>Promise<PublicRun>; capture:(url:string)=>Promise<{html:string;sourceUrl:string}>; progress:(run:PublicRun)=>Promise<void>; stopped?:()=>boolean };
type Api = {
  allowedUrl:(url:string)=>boolean; capturePage:(url:string)=>Promise<{html:string;sourceUrl:string}>;
  collect:(options:Options)=>Promise<PublicRun>;
  collectAll:(options:Omit<Options,'unit'|'progress'> & {units:typeof SUAP_PLAN_UNITS; progress:(value:{results:Result[]})=>Promise<void>})=>Promise<{results:Result[];paused:boolean}>;
};
const context: { SuapeRdSync?:Api } = {};
new Function('globalThis',readFileSync(extensionFixturePath('rd-sync.js'),'utf8'))(context);
const api=context.SuapeRdSync!;
const publicRun=(run:RdRun):PublicRun=>({runId:run.id,status:run.state.phase==='ready'?'preview':'collecting',complete:run.state.phase==='ready',nextUrl:nextRdCaptureUrl(structuredClone(run))});
function fixtureServer() {
  const run:RdRun={id:'run19',org_id:'org',user_id:'user',campus_uasg:'158366',suap_unit_code:'19',state:initialRdState('19'),status:'collecting',complete:false,source_count:0,summary:{}};
  const upsert=vi.fn().mockResolvedValue({error:null});
  const post=vi.fn(async (body:Request)=>{
    if(body.action==='sync-html') await collectCapturedRdPage({from:()=>({upsert}),rpc:vi.fn()},run,body.html,body.sourceUrl,DOMParser);
    nextRdCaptureUrl(run); return publicRun(run);
  });
  const capture=vi.fn(async (url:string)=>({sourceUrl:url,html:url===rdListUrl?listHtml():url===activityUrl?listHtml({activity:true}):url.includes('plano_concluido')?planHtml:detailHtml()}));
  return {run,upsert,post,capture};
}
afterEach(()=>vi.unstubAllGlobals());
describe('RDs pela sessão da extensão',()=>{
  it('percorre inventário, plano, relação, detalhe e inventário final com HTML e sem cookie ou aplicação automática',async()=>{
    const server=fixtureServer(); const progress=vi.fn().mockResolvedValue(undefined);
    const result=await api.collect({unit:'19',...server,progress});
    expect(result).toMatchObject({status:'preview',complete:true,nextUrl:null});
    expect(server.capture.mock.calls.map(([url])=>url)).toEqual([rdListUrl,'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',activityUrl,'https://suap.ifrn.edu.br/plan_estrategico/detalhar_requisicaodespesa/9083/',rdListUrl]);
    expect(server.upsert).toHaveBeenCalledOnce();
    expect(server.upsert.mock.calls[0][0]).toMatchObject({campus_uasg:'158366',suap_unit_code:'19',payload:{sources:[expect.objectContaining({activityId:'32635'})]}});
    expect(server.post.mock.calls.map(([body])=>body.action)).toEqual(['sync-extension',...Array(5).fill('sync-html')]);
    expect(JSON.stringify(server.post.mock.calls)).not.toContain('sessionId');
  });
  it('retoma a etapa que falhou sem recapturar as páginas já confirmadas',async()=>{
    const server=fixtureServer(); const goodCapture=server.capture;
    const failingCapture=vi.fn(async(url:string)=>{if(url===activityUrl) throw new Error('Sessão SUAP expirada');return goodCapture(url);});
    await expect(api.collect({unit:'19',post:server.post,capture:failingCapture,progress:async()=>{}})).rejects.toThrow('Sessão');
    expect(server.run.state.phase).toBe('activities'); expect(server.upsert).not.toHaveBeenCalled();
    goodCapture.mockClear();
    await api.collect({unit:'19',post:server.post,capture:goodCapture,progress:async()=>{}});
    expect(goodCapture.mock.calls[0][0]).toBe(activityUrl); expect(server.upsert).toHaveBeenCalledOnce();
  });
  it('pausa após confirmar a etapa atual e pode continuar até a prévia',async()=>{
    const server=fixtureServer();let paused=false;
    const result=await api.collect({unit:'19',...server,stopped:()=>paused,progress:async run=>{if(run.nextUrl?.includes('plano_concluido')) paused=true;}});
    expect(result.complete).toBe(false);expect(server.capture).toHaveBeenCalledOnce();
    paused=false;expect((await api.collect({unit:'19',...server,progress:async()=>{}})).complete).toBe(true);
  });
  it('bloqueia URL externa e captura divergente antes do envio ao SIAGES',async()=>{
    const capture=vi.fn();const post=vi.fn().mockResolvedValue({status:'collecting',runId:'r',nextUrl:'https://evil.test/'});
    await expect(api.collect({unit:'19',post,capture,progress:async()=>{}})).rejects.toThrow('inválida');expect(capture).not.toHaveBeenCalled();
    post.mockResolvedValue({status:'collecting',runId:'r',nextUrl:rdListUrl});capture.mockResolvedValue({sourceUrl:activityUrl,html:'<html/>'});
    await expect(api.collect({unit:'19',post,capture,progress:async()=>{}})).rejects.toThrow('inválida');expect(post).toHaveBeenCalledTimes(2);
    expect(api.allowedUrl(rdListUrl+'&q=outro')).toBe(false);
  });
  it('percorre as 44 unidades e preserva a UASG-pai sem misturar unidades irmãs',async()=>{
    const post=vi.fn(async (body:Request)=>({status:'preview',runId:`run${body.suapUnitCode}`,complete:true,nextUrl:null}));
    const result=await api.collectAll({units:SUAP_PLAN_UNITS,post,capture:vi.fn(),progress:async()=>{}});
    expect(result.results).toHaveLength(44);expect(post).toHaveBeenCalledTimes(44);
    const siblings=result.results.filter(entry=>entry.campusUasg==='158366');
    expect(siblings.map(entry=>entry.unit)).toEqual(['19','25','29','36']);
    expect(new Set(siblings.map(entry=>entry.run?.runId)).size).toBe(4);
  });
  it('continua o lote após falha de uma unidade e mantém prévias das demais',async()=>{
    const units=SUAP_PLAN_UNITS.filter(unit=>['19','25','29'].includes(unit.value));
    const post=vi.fn(async(body:Request)=>{if(body.suapUnitCode==='25')throw new Error('Sem permissão SUAP');return {runId:body.suapUnitCode,status:'preview',complete:true,nextUrl:null};});
    const result=await api.collectAll({units,post,capture:vi.fn(),progress:async()=>{}});
    expect(result.results.map(entry=>entry.error?'falhou':entry.run?.status)).toEqual(['preview','falhou','preview']);
    expect(result.results[1]).toMatchObject({unit:'25',campusUasg:'158366',error:'Sem permissão SUAP'});
  });
});
