import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({from:vi.fn(),invoke:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:mocks.from,functions:{invoke:mocks.invoke}}}));
import { suapRdService } from '../suapRdService';
beforeEach(()=>vi.clearAllMocks());
it('pagina leituras autenticadas, limita órgão/campus/unidade e não para em 500 linhas',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn()};
  for (const method of ['select','eq','order'] as const) query[method].mockReturnValue(query);
  query.range.mockResolvedValueOnce({data:Array.from({length:500},(_,i)=>({id:i})),error:null}).mockResolvedValueOnce({data:[{id:500}],error:null});
  mocks.from.mockReturnValue(query);
  expect(await suapRdService.read('suap_rd_movimentacoes','org','158366','19')).toHaveLength(501);
  expect(query.eq.mock.calls).toEqual(expect.arrayContaining([['org_id','org'],['campus_uasg','158366'],['suap_unit_code','19']]));
  expect(query.range.mock.calls).toEqual([[0,499],[500,999]]);
});
it('mantém erro de autorização explícito sem fallback anônimo',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data:null,error:new Error('Sem permissão')})};
  for (const method of ['select','eq','order'] as const) query[method].mockReturnValue(query);
  mocks.from.mockReturnValue(query);await expect(suapRdService.read('atividade_empenho_vinculos','org','158366','19')).rejects.toThrow('Sem permissão');expect(mocks.from).toHaveBeenCalledOnce();
});
it('envia somente ação, campus/unidade e identificador opaco de execução',async()=>{
  mocks.invoke.mockResolvedValue({data:{status:'preview'},error:null});await suapRdService.action('sync','19','158366','run');
  expect(mocks.invoke).toHaveBeenCalledWith('sync-suap-rds',{body:{action:'sync',suapUnitCode:'19',campusUasg:'158366',runId:'run'}});
});
it('consulta coleta e aplicação com RLS e filtros de órgão/campus/unidade, sem carregar snapshots',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn()};
  for(const method of ['select','eq','order','limit'] as const) query[method].mockReturnValue(query);
  query.maybeSingle.mockResolvedValueOnce({data:{status:'partial',source_count:500,processed:'1',reused:null,refreshed:null},error:null})
    .mockResolvedValueOnce({data:null,error:null});mocks.from.mockReturnValue(query);
  expect(await suapRdService.captureStatus('org','158366','19')).toEqual({hasApplied:false,latest:{status:'partial',sourceCount:500,processed:1}});
  for(const filter of [['org_id','org'],['campus_uasg','158366'],['suap_unit_code','19']]) expect(query.eq.mock.calls.filter(call=>call[0]===filter[0])).toEqual([filter,filter]);
  expect(mocks.from.mock.calls).toEqual([['suap_rd_sync_runs'],['suap_rd_sync_runs']]);
});
it('conta detalhes reaproveitados e preserva a aplicação anterior quando uma nova coleta falha',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn()};
  for(const method of ['select','eq','order','limit'] as const) query[method].mockReturnValue(query);
  query.maybeSingle.mockResolvedValueOnce({data:{status:'partial',source_count:500,processed:'0',reused:'450',refreshed:'12'},error:null})
    .mockResolvedValueOnce({data:{status:'applied'},error:null});mocks.from.mockReturnValue(query);
  expect(await suapRdService.captureStatus('org','158366','19')).toEqual({hasApplied:true,latest:{status:'partial',sourceCount:500,processed:462}});
});
it('falha de leitura do estado não é interpretada como ausência de aplicação',async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:null,error:new Error('Sem permissão')})};
  for(const method of ['select','eq','order','limit'] as const) query[method].mockReturnValue(query);
  mocks.from.mockReturnValue(query);await expect(suapRdService.captureStatus('org','158366','19')).rejects.toThrow('Sem permissão');
});
