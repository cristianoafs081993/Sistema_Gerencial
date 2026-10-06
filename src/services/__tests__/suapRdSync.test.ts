import { describe, expect, it, vi, beforeAll } from 'vitest';
beforeAll(() => { if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', { value: () => new AbortController().signal, configurable:true }); });
import { collectCapturedRdPage, collectRdChunk, fetchSuapRdHtml, initialRdState, nextRdCaptureUrl, type RdRun } from '../../../supabase/functions/_shared/suap_rd_sync';
import { activityUrl, detailHtml, listHtml, planHtml, rdListUrl } from './suapRdFixtures';

const makeRun = (): RdRun => ({ id:'run',org_id:'org',user_id:'user',campus_uasg:'158366',suap_unit_code:'19',status:'collecting',state:initialRdState('19'),source_count:0,summary:{},complete:false });
describe('Coleta incremental de RDs', () => {
  it('captura uma única revisão por RD, inclui atividade com saldo zero e verifica inventário final', async () => {
    const upsert = vi.fn().mockResolvedValue({ error:null });
    const db = { from: () => ({ upsert }), rpc: vi.fn() };
    const load = vi.fn(async (url: string) => url === rdListUrl ? listHtml() : url === activityUrl ? listHtml({ activity:true }) : url.includes('plano_concluido') ? planHtml : detailHtml());
    const run = makeRun();
    await collectRdChunk(db,run,load,DOMParser,2);
    expect(run.state.phase).toBe('activities'); expect(upsert).not.toHaveBeenCalled();
    while (run.state.phase !== 'ready') await collectRdChunk(db,run,load,DOMParser,2);
    expect(run.state.detailCursor).toBe(1); expect(run.state.verify).toEqual(run.state.inventory);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0].payload.sources).toEqual([expect.objectContaining({ activityId:'32635',planId:8 })]);
  });
  it('preserva o inventário se a captura seguinte do plano falhar; a retomada pede somente o plano', async () => {
    const run = makeRun();
    await collectRdChunk({ from:vi.fn(),rpc:vi.fn() },run,async()=>listHtml(),DOMParser,1);
    await expect(collectRdChunk({ from:vi.fn(),rpc:vi.fn() },run,async url => { if (url.includes('plano_concluido')) throw new Error('Sessão do SUAP expirada.'); return listHtml(); },DOMParser,1)).rejects.toThrow('Sessão');
    expect(run.state.phase).toBe('plan'); expect(run.state.inventory).toHaveLength(1);
    expect(nextRdCaptureUrl(run)).toContain('plano_concluido');
  });
  it('aceita conclusão de uma pendente durante a coleta sem reiniciar as relações oficiais', async () => {
    const upsert=vi.fn().mockResolvedValue({error:null});const db={from:()=>({upsert}),rpc:vi.fn()};
    const run=makeRun();let inventoryReads=0;
    const load=vi.fn(async(url:string)=>url===rdListUrl ? listHtml().replace('Concluída',++inventoryReads===1?'Aguardando validação do SIAFI':'Concluída')
      : url===activityUrl ? listHtml({activity:true}) : url.includes('plano_concluido') ? planHtml : detailHtml());
    while(run.state.phase!=='ready') await collectRdChunk(db,run,load,DOMParser,1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0].payload.situacao).toBe('Concluída');
    expect(load.mock.calls.filter(([url])=>url===activityUrl)).toHaveLength(1);
  });
  it('retoma a coleta legada presa numa pendente e aceita hashes novos na conferência final',async()=>{
    const upsert=vi.fn().mockResolvedValue({error:null});const run=makeRun();
    delete run.state.rowFingerprintVersion;
    run.state.phase='details';run.state.inventory=[{rdId:'9083',numero:'2026RD003731',tipo:'Reforço de empenho',situacao:'Aguardando validação do SIAFI'}];
    run.state.sources={'9083':[{activityId:'32635',planId:8,activityName:'Almoxarifado virtual',sourceUrl:activityUrl}]};
    const load=vi.fn(async(url:string)=>url===rdListUrl?listHtml():detailHtml());
    while(nextRdCaptureUrl(run)) await collectRdChunk({from:()=>({upsert}),rpc:vi.fn()},run,load,DOMParser,1);
    expect(load).toHaveBeenCalledTimes(2);expect(upsert).toHaveBeenCalledOnce();
    expect(run.state.inventory[0].situacao).toBe('Concluída');
  });
  it('reconfere somente a pendente alterada depois do detalhe, antes de liberar a prévia',async()=>{
    const upsert=vi.fn().mockResolvedValue({error:null});const run=makeRun();let inventoryReads=0,detailReads=0;
    const load=vi.fn(async(url:string)=>{
      if(url===rdListUrl) return listHtml().replace('Concluída',++inventoryReads===1?'Em emissão':'Concluída');
      if(url===activityUrl) return listHtml({activity:true});
      if(url.includes('plano_concluido')) return planHtml;
      return detailHtml({status:++detailReads===1?'Em emissão':'Concluída'});
    });
    while(run.state.phase!=='ready') await collectRdChunk({from:()=>({upsert}),rpc:vi.fn()},run,load,DOMParser,1);
    expect(detailReads).toBe(2);expect(inventoryReads).toBe(3);
    expect(run.state.verificationRetries).toBe(1);
    expect(load.mock.calls.filter(([url])=>url===activityUrl)).toHaveLength(1);
    expect(upsert.mock.lastCall![0].payload.situacao).toBe('Concluída');
  });
  it('não permite trocar número, tipo ou situação de uma RD concluída no detalhe',async()=>{
    for(const html of [detailHtml().replace('2026RD003731','2026RD003732'),detailHtml({type:'Dotação para empenho'}),detailHtml({status:'Em emissão'})]) {
      const run=makeRun();run.state.phase='details';run.state.inventory=[{rdId:'9083',numero:'2026RD003731',tipo:'Reforço de empenho',situacao:'Concluída'}];
      const upsert=vi.fn();const before=structuredClone(run.state);
      await expect(collectRdChunk({from:()=>({upsert}),rpc:vi.fn()},run,async()=>html,DOMParser,1)).rejects.toThrow('alterada');
      expect(upsert).not.toHaveBeenCalled();expect(run.state).toEqual(before);
    }
  });
  it.each(['Em emissão','Concluída'])('valor alterado na conferência final de RD %s preserva a regra de mutabilidade',async status=>{
    const upsert=vi.fn().mockResolvedValue({error:null});const run=makeRun();let inventoryReads=0,detailReads=0;
    const load=vi.fn(async(url:string)=>{
      if(url===rdListUrl) {
        const value=++inventoryReads===1?'20.242,46':'19.999,00';
        return listHtml().replace('Concluída',status).replace('</tr></thead>','<th>Valor</th></tr></thead>')
          .replace('</tr></tbody>',`<td>${value}</td></tr></tbody>`);
      }
      if(url===activityUrl) return listHtml({activity:true});
      if(url.includes('plano_concluido')) return planHtml;
      return detailHtml({status,value:++detailReads===1?'20.242,46':'19.999,00'});
    });
    const collect=async()=>{while(run.state.phase!=='ready') await collectRdChunk({from:()=>({upsert}),rpc:vi.fn()},run,load,DOMParser,1);};
    if(status==='Concluída') {
      await expect(collect()).rejects.toThrow('alteradas');expect(upsert).toHaveBeenCalledOnce();
    } else {
      await collect();expect(detailReads).toBe(2);expect(upsert.mock.lastCall![0].payload.linhas[0].valor).toBe(19999);
      expect(load.mock.calls.filter(([url])=>url===activityUrl)).toHaveLength(1);
    }
  });
  it('limita reconferências de pendentes que continuam mudando e preserva a execução incompleta',async()=>{
    const upsert=vi.fn().mockResolvedValue({error:null});const run=makeRun();let value=0;
    const load=async(url:string)=>url===rdListUrl ? listHtml().replace('Concluída',`Pendente ${value++}`)
      : url===activityUrl ? listHtml({activity:true}) : url.includes('plano_concluido') ? planHtml : detailHtml({status:`Pendente ${value-1}`});
    await expect((async()=>{while(run.state.phase!=='ready') await collectRdChunk({from:()=>({upsert}),rpc:vi.fn()},run,load,DOMParser,1);})()).rejects.toThrow('continuam mudando');
    expect(run.state.phase).toBe('verify');expect(run.state.verificationRetries).toBe(3);expect(run.complete).toBe(false);
  });
  it('não conclui captura se uma página final muda ou repete RDs', async () => {
    const run = makeRun(); run.state.phase='verify'; run.state.inventory=[{rdId:'1',numero:'2026RD003731',situacao:'Concluída',tipo:'Reforço de empenho'}];
    await expect(collectRdChunk({from:vi.fn(),rpc:vi.fn()},run,async()=>listHtml(),DOMParser,1)).rejects.toThrow('alteradas');
    expect(run.state.phase).toBe('verify'); expect(run.state.verify).toEqual([]);
    run.state.phase='inventory'; run.state.total=2; run.state.inventory=[{rdId:'9083',numero:'2026RD003731',situacao:'Concluída',tipo:'Reforço de empenho'}];
    await expect(collectRdChunk({from:vi.fn(),rpc:vi.fn()},run,async()=>listHtml({count:2}),DOMParser,1)).rejects.toThrow('repetida');
  });
  it('bloqueia redirecionamentos e URLs fora do escopo sem enviar a sessão', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null,{status:302,headers:{location:'https://evil.test/'}}));
    await expect(fetchSuapRdHtml(rdListUrl,'session-test',fetcher)).rejects.toThrow('externo');
    fetcher.mockClear(); await expect(fetchSuapRdHtml('https://evil.test','session-test',fetcher)).rejects.toThrow('URL'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('aceita uma página por etapa da extensão e rejeita URL externa, de outro campus ou fora da ordem', async () => {
    const run = makeRun(); const db = { from:vi.fn(),rpc:vi.fn() };
    for (const url of ['https://evil.test/',rdListUrl.replace('19','25'),activityUrl]) {
      await expect(collectCapturedRdPage(db,run,listHtml(),url,DOMParser)).rejects.toThrow('esperada');
      expect(run.state).toEqual(initialRdState('19'));
    }
    await collectCapturedRdPage(db,run,listHtml(),rdListUrl,DOMParser);
    expect(run.state.phase).toBe('plan'); expect(run.state.inventory).toHaveLength(1);
    await expect(collectCapturedRdPage(db,run,listHtml(),rdListUrl,DOMParser)).rejects.toThrow('esperada');
  });
  it('não avança com HTML ausente, excessivo ou de outra unidade', async () => {
    const run = makeRun(); const db = { from:vi.fn(),rpc:vi.fn() };
    for (const html of ['', 'ç'.repeat(8*1024*1024), listHtml().replace('DG/CN','DG/JUC')]) {
      await expect(collectCapturedRdPage(db,run,html,rdListUrl,DOMParser)).rejects.toThrow();
      expect(run.state).toEqual(initialRdState('19'));
    }
  });
});
