import { describe, expect, it, vi, beforeAll } from 'vitest';
beforeAll(() => { if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', { value: () => new AbortController().signal, configurable:true }); });
import { collectRdChunk, fetchSuapRdHtml, initialRdState, type RdRun } from '../../../supabase/functions/_shared/suap_rd_sync';
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
  it('preserva o cursor anterior se o plano falhar após a última página; a retomada lê a página novamente', async () => {
    const run = makeRun();
    await expect(collectRdChunk({ from:vi.fn(),rpc:vi.fn() },run,async url => { if (url.includes('plano_concluido')) throw new Error('Sessão do SUAP expirada.'); return listHtml(); },DOMParser,1)).rejects.toThrow('Sessão');
    expect(run.state).toEqual(initialRdState('19'));
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
});
