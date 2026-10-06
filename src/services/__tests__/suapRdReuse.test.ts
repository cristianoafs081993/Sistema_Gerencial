import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectCapturedRdPage, collectRdChunk, initialRdState, nextRdCaptureUrl, type RdRun } from '../../../supabase/functions/_shared/suap_rd_sync';
import { seedRdReuse } from '../../../supabase/functions/_shared/suap_rd_reuse';
import { detailHtml, listHtml, planHtml, rdListUrl } from './suapRdFixtures';

type Row = { run_id: string; org_id: string; campus_uasg: string; suap_unit_code: string; suap_rd_id: string;
  payload: Record<string, unknown>; captured_at: string; checksum: string };
const scope = { org_id:'org',user_id:'user',campus_uasg:'158366',suap_unit_code:'19' };
const now = new Date('2026-10-06T12:00:00Z');
const number = (id: number) => `2026RD${String(id).padStart(6,'0')}`;

function database() {
  const rows = new Map<string,Row>();
  let failCopy = false;
  const filters: Array<Record<string,string>> = [];
  const upsert = vi.fn(async (values: Row | Row[]) => {
    if (Array.isArray(values) && failCopy) { failCopy = false; return { error:new Error('Falha ao copiar') }; }
    for (const row of [values].flat()) rows.set(`${row.run_id}:${row.suap_rd_id}`,structuredClone(row));
    return { error:null };
  });
  return { rows,upsert,filters,failNextCopy:()=>{failCopy=true;},
    from: (_table: string) => {
      const filter: Record<string,string> = {};
      const query = {
        select: (_columns: string) => query,
        eq: (key: string,value: string) => { filter[key]=value; return query; },
        order: (_key: string) => query,
        range: async (start: number,end: number) => {
          filters.push({...filter});
          return { data:[...rows.values()].filter(row => Object.entries(filter).every(([key,value]) => row[key as keyof Row]===value))
            .sort((a,b)=>a.suap_rd_id.localeCompare(b.suap_rd_id)).slice(start,end+1),error:null };
        },upsert,
      };
      return query;
    },rpc:vi.fn(),
  };
}

function fixture(count = 10) {
  const values = new Map<number,string>();
  const statuses = new Map<number,string>();
  const types = new Map<number,string>();
  const names = new Map<number,string>();
  const relations = new Map<number,number[]>();
  const detailValues = new Map<number,string>();
  const inventory = (activityId?: number) => {
    const ids = activityId === undefined ? Array.from({length:count},(_,i)=>i+1) : relations.get(activityId) ?? [activityId-1000];
    if (!ids.length) return `<main id="content"><dl><dt>Unidade administrativa</dt><dd>DG/CN</dd><dt>Atividade</dt><dd>Almoxarifado virtual</dd></dl><p class="alert">Nenhuma requisição de despesa cadastrada.</p></main>`;
    const row = (id:number) => listHtml({id:String(id),activity:activityId!==undefined}).match(/<tbody>([\s\S]*?)<\/tbody>/)![1]
      .replace('2026RD003731',number(id)).replace('Concluída',statuses.get(id) ?? 'Concluída')
      .replace('Reforço de empenho',types.get(id) ?? 'Reforço de empenho')
      .replace('</tr>',`<td>${values.get(id) ?? '20.242,46'}</td></tr>`);
    const html = listHtml({count:ids.length,activity:activityId!==undefined}).replace(/<tbody>[\s\S]*?<\/tbody>/,`<tbody>${ids.map(row).join('')}</tbody>`)
      .replace('</tr></thead>','<th>Valor</th></tr></thead>');
    return activityId === undefined ? html : html.replace('Almoxarifado virtual',names.get(activityId) ?? 'Almoxarifado virtual');
  };
  const load = vi.fn(async (url:string) => {
    if (url === rdListUrl) return inventory();
    if (url.includes('plano_concluido')) {
      const row = planHtml.match(/<tbody>([\s\S]*?)<\/tbody>/)![1];
      return planHtml.replace(/<tbody>[\s\S]*?<\/tbody>/,`<tbody>${Array.from({length:count},(_,i)=>row.replace('/32635/',`/${1001+i}/`)
        .replace('Almoxarifado virtual',names.get(1001+i) ?? 'Almoxarifado virtual')).join('')}</tbody>`);
    }
    const activityId = url.match(/listar_requisicoes_despesa\/8\/(\d+)/)?.[1];
    if (activityId) return inventory(Number(activityId));
    const id = Number(url.match(/detalhar_requisicaodespesa\/(\d+)/)![1]);
    return detailHtml({value:detailValues.get(id) ?? values.get(id) ?? '20.242,46',status:statuses.get(id) ?? 'Concluída',type:types.get(id) ?? 'Reforço de empenho'})
      .replace('2026RD003731',number(id)).replace('Almoxarifado virtual',names.get(1000+id) ?? 'Almoxarifado virtual');
  });
  return { load,values,statuses,types,names,relations,detailValues };
}

function run(id: string, base: RdRun | null = null, forceFull = false): RdRun {
  const state = initialRdState('19');
  seedRdReuse(state,scope,base,forceFull);
  return {id,...scope,state,status:'collecting',complete:false,source_count:0,summary:{}};
}
async function finish(db:ReturnType<typeof database>, current:RdRun, data:ReturnType<typeof fixture>) {
  while (current.state.phase!=='ready') await collectRdChunk(db,current,data.load,DOMParser,3);
  current.complete=true;current.status='applied';current.source_count=current.state.inventory.length;
  return current;
}
async function baseline(data = fixture()) {
  const db = database();
  const first = await finish(db,run('first'),data);
  data.load.mockClear();
  vi.setSystemTime(new Date(now.getTime()+3600000));
  return { db,first,data };
}
const detailIds = (data:ReturnType<typeof fixture>) => data.load.mock.calls.flatMap(([url])=>
  url.includes('detalhar_requisicaodespesa') ? [url.match(/\/(\d+)\/$/)![1]] : []);

beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(now);});
afterEach(()=>vi.useRealTimers());
describe('reaproveitamento entre coletas completas de RDs',()=>{
  it('na segunda coleta de concluídas reduz 23 páginas a 3, mantendo todos os snapshots e datas originais',async()=>{
    const {db,first,data}=await baseline();
    const second=await finish(db,run('second',first),data);
    expect(data.load).toHaveBeenCalledTimes(3);
    expect(detailIds(data)).toEqual([]);
    expect(second.state.reuse).toMatchObject({mode:'incremental',baseRunId:'first',reusedDetails:10,refreshedDetails:0,reusedActivities:10});
    const copied=db.rows.get('second:2')!;
    expect(copied.payload).toEqual(db.rows.get('first:2')!.payload);
    expect(copied.captured_at).toBe(now.toISOString());
    expect(db.rows.get('second:1')!.captured_at).toBe(now.toISOString());
    expect([...db.rows.values()].filter(row=>row.run_id==='second')).toHaveLength(10);
    expect(db.filters).toContainEqual({run_id:'first',org_id:'org',campus_uasg:'158366',suap_unit_code:'19'});
  });
  it('confere o inventário mesmo após o JSONB reordenar as propriedades persistidas',async()=>{
    const {db,first,data}=await baseline();
    first.state.inventory=first.state.inventory.map(ref=>Object.fromEntries(Object.entries(ref).sort(([a],[b])=>a.localeCompare(b))) as typeof ref);
    first.state.phase='verify';first.state.verify=[];first.state.verifyTotal=null;first.state.nextUrl=rdListUrl;
    await finish(db,first,data);
    expect(first.state.phase).toBe('ready');
  });
  it('a captura HTML pela extensão recebe somente as três URLs necessárias na segunda coleta',async()=>{
    const {db,first,data}=await baseline();const second=run('second',first);
    second.state.captureMode='extension';
    while(second.state.phase!=='ready') {
      const url=nextRdCaptureUrl(second)!;
      await collectCapturedRdPage(db,second,await data.load(url),url,DOMParser);
    }
    expect(data.load).toHaveBeenCalledTimes(3);
    expect(second.state.reuse).toMatchObject({reusedDetails:10,refreshedDetails:0,reusedActivities:10});
    expect([...db.rows.values()].filter(row=>row.run_id==='second')).toHaveLength(10);
  });
  it('rota a auditoria para as RDs e relações mais antigas sem renovar datas reaproveitadas',async()=>{
    const canceled=fixture();for(let id=1;id<=10;id++) canceled.statuses.set(id,'Cancelada');
    const {db,first,data}=await baseline(canceled);
    const second=await finish(db,run('second',first),data);
    data.load.mockClear();vi.setSystemTime(new Date(now.getTime()+7200000));
    await finish(db,run('third',second),data);
    expect(detailIds(data)).toEqual(['10']);
    expect(data.load.mock.calls.some(([url])=>url.includes('/8/1002/'))).toBe(true);
    expect(db.rows.get('third:2')!.captured_at).toBe(now.toISOString());
  });
  it('reaproveita uma anulação sem inverter novamente o sinal do movimento',async()=>{
    const data=fixture();data.types.set(2,'Anulação de empenho');data.values.set(2,'-1.859,51');
    const {db,first}=await baseline(data);
    await finish(db,run('second',first),data);
    expect(detailIds(data)).not.toContain('2');
    expect(db.rows.get('second:2')!.payload).toMatchObject({tipo:'anulacao',valor:-1859.51,linhas:[expect.objectContaining({valor:-1859.51})]});
  });
  it('captura RD nova e reconsulta as relações oficiais, sem reler os detalhes estáveis',async()=>{
    const {db,first}=await baseline();const data=fixture(11);
    const second=await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual(['11']);
    expect(second.state.reuse).toMatchObject({reusedDetails:10,reusedActivities:0});
    expect(db.rows.get('second:11')!.payload.sources).toEqual([expect.objectContaining({activityId:'1011',planId:8})]);
  });
  it('detecta mudança de valor de RD pendente sem reler as concluídas',async()=>{
    const pending=fixture();pending.statuses.set(2,'Em emissão');
    const {db,first,data}=await baseline(pending);data.values.set(2,'19.999,00');
    await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual(['2']);
    expect(data.load).toHaveBeenCalledTimes(5);
    expect(db.rows.get('second:2')!.payload.valor).toBe(19999);
  });
  it('a auditoria de canceladas descobre alterações internas que não aparecem na listagem',async()=>{
    const canceled=fixture();canceled.statuses.set(1,'Cancelada');
    const {db,first,data}=await baseline(canceled);data.detailValues.set(1,'19.999,00');
    await finish(db,run('second',first),data);
    expect(db.rows.get('second:1')!.payload.valor).toBe(19999);
  });
  it('mudança silenciosa de relação invalida todas as relações reutilizadas e conserva o ID oficial',async()=>{
    const pending=fixture();pending.statuses.set(1,'Em emissão');
    const {db,first,data}=await baseline(pending);data.relations.set(1001,[]);data.relations.set(1002,[1,2]);
    const second=await finish(db,run('second',first),data);
    expect(second.state.reuse?.reusedActivities).toBe(0);
    expect(db.rows.get('second:1')!.payload.sources).toEqual([expect.objectContaining({activityId:'1002'})]);
  });
  it('detecta cancelamento e sempre relê uma RD pendente mesmo com inventário igual',async()=>{
    const data=fixture();data.statuses.set(2,'Em emissão');
    const {db,first}=await baseline(data);data.statuses.set(3,'Cancelada');
    await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual(expect.arrayContaining(['2','3']));
    expect(db.rows.get('second:3')!.payload.situacao).toBe('Cancelada');
  });
  it('relê a pendente que concluiu e a reaproveita definitivamente na execução seguinte',async()=>{
    const pending=fixture();pending.statuses.set(2,'Em emissão');
    const {db,first,data}=await baseline(pending);data.statuses.set(2,'Concluída');
    const second=await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual(['2']);
    expect(db.rows.get('second:2')!.payload.situacao).toBe('Concluída');
    data.load.mockClear();vi.setSystemTime(new Date(now.getTime()+60*86400000));
    await finish(db,run('third',second),data);
    expect(data.load).toHaveBeenCalledTimes(3);
    expect(db.rows.get('third:2')!.captured_at).toBe(db.rows.get('second:2')!.captured_at);
  });
  it('conserva pendência de tipo desconhecido na RD concluída sem reler dados imutáveis',async()=>{
    const unknown=fixture();unknown.types.set(2,'Outra operação');
    const {db,first,data}=await baseline(unknown);
    await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual([]);
    expect(db.rows.get('second:2')!.payload).toEqual(db.rows.get('first:2')!.payload);
  });
  it('pendente sem vínculo conhecido força redescobrir as relações oficiais',async()=>{
    const pending=fixture();pending.statuses.set(2,'Em emissão');pending.relations.set(1002,[]);
    const {db,first,data}=await baseline(pending);data.relations.set(1002,[2]);
    const second=await finish(db,run('second',first),data);
    expect(second.state.reuse?.reusedActivities).toBe(0);
    expect(detailIds(data)).toEqual(['2']);
    expect(db.rows.get('second:2')!.payload.sources).toEqual([expect.objectContaining({activityId:'1002'})]);
  });
  it('renomeação da atividade confere o ID oficial e preserva o detalhe da RD concluída',async()=>{
    const {db,first,data}=await baseline();data.names.set(1002,'Nova atividade');
    await finish(db,run('second',first),data);
    expect(detailIds(data)).not.toContain('2');
    expect(db.rows.get('second:2')!.payload).toEqual(db.rows.get('first:2')!.payload);
    expect(db.rows.get('second:2')!.payload.sources).toEqual([expect.objectContaining({activityId:'1002'})]);
  });
  it('concluídas e suas relações não expiram nem entram na auditoria periódica',async()=>{
    const {db,first,data}=await baseline();vi.setSystemTime(new Date(now.getTime()+8*86400000));
    const second=await finish(db,run('second',first),data);
    expect(data.load).toHaveBeenCalledTimes(3);
    expect(second.state.reuse).toMatchObject({reusedDetails:10,reusedActivities:10,refreshedDetails:0});
    expect(db.rows.get('second:1')!.captured_at).toBe(now.toISOString());
  });
  it('canceladas expiram após sete dias, sem afetar as concluídas',async()=>{
    const canceled=fixture();canceled.statuses.set(2,'Cancelada');
    const {db,first,data}=await baseline(canceled);vi.setSystemTime(new Date(now.getTime()+8*86400000));
    const second=await finish(db,run('second',first),data);
    expect(detailIds(data)).toEqual(['2']);
    expect(second.state.reuse).toMatchObject({reusedDetails:9,reusedActivities:9,refreshedDetails:1});
  });
  it('a opção completa ignora a base, enquanto execuções antigas sem fingerprints ainda reaproveitam detalhes',async()=>{
    const {db,first,data}=await baseline();
    const full=await finish(db,run('full',first,true),data);
    expect(full.state.reuse).toMatchObject({mode:'full',reusedDetails:0,reusedActivities:0});
    expect(data.load).toHaveBeenCalledTimes(23);
    for (const ref of first.state.inventory) delete ref.rowFingerprint;
    for (const activity of first.state.activities) {delete activity.fingerprint;delete activity.checkedAt;}
    delete first.state.reuse;data.load.mockClear();
    const upgraded=await finish(db,run('upgraded',first),data);
    expect(upgraded.state.reuse).toMatchObject({mode:'incremental',reusedDetails:10,reusedActivities:10});
    expect(detailIds(data)).toHaveLength(0);
  });
  it.each(['org_id','user_id','campus_uasg','suap_unit_code'] as const)('recusa base de outro escopo em %s',async key=>{
    const {first}=await baseline();
    expect(()=>run('second',{...first,[key]:'outro'})).toThrow('fora');
  });
  it('não usa base incompleta, revertida ou de outra versão do coletor',async()=>{
    const {first}=await baseline();
    for (const base of [{...first,complete:false},{...first,status:'reverted'},
      {...first,state:{...first.state,reuse:{...first.state.reuse!,version:99}}}]) {
      expect(run('second',base).state.reuse).toMatchObject({mode:'full'});
    }
  });
  it('retoma após falha ao copiar sem avançar o cursor nem duplicar snapshots',async()=>{
    const {db,first,data}=await baseline();const second=run('second',first);db.failNextCopy();
    await expect(finish(db,second,data)).rejects.toThrow('Falha ao copiar');
    expect(second.complete).toBe(false);
    expect(nextRdCaptureUrl(second)).toContain('plano_concluido');
    await finish(db,second,data);
    expect([...db.rows.values()].filter(row=>row.run_id==='second')).toHaveLength(10);
    expect(second.state.reuse).toMatchObject({reusedDetails:10,refreshedDetails:0});
  });
  it('exclui a RD removida do novo inventário e recaptura snapshots ausentes',async()=>{
    const {db,first}=await baseline();db.rows.delete('first:2');const data=fixture(9);
    const second=await finish(db,run('second',first),data);
    expect(db.rows.has('second:10')).toBe(false);
    expect(detailIds(data)).toContain('2');
    expect(second.state.inventory).toHaveLength(9);
    expect([...db.rows.values()].filter(row=>row.run_id==='second')).toHaveLength(9);
  });
});
