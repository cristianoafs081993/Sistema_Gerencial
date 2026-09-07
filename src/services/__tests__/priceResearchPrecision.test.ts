// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { compareRequirements, compareUnits, canonicalItemId, executeConversationalPriceResearch, type Row } from '../../../supabase/functions/assistente-gerencial/price-research';
import { extractDemandItems, mergeClarificationWithDemand } from '../../../supabase/functions/assistente-gerencial/domain';
import { mapReference, syncWindow, validatePage } from '../../../supabase/functions/sync-precos-referencia/core';

const now = Date.parse('2026-09-07T00:00:00Z');
const demand = { itemNumber: '1', description: 'notebook 16 GB RAM SSD 512 GB', quantity: 10, unit: 'UN', catalogType: 'material' as const };
const reference = (i: number, extra: Row = {}) => ({ numero_controle_pncp: `12345678000100-1-${String(i).padStart(6,'0')}/2026`, numero_item: 1,
  descricao_item: demand.description, unidade_medida: 'UNIDADE', valor_unitario: 4000 + i,
  data_resultado: '2026-01-02', price_kind: 'homologado', ...extra });
function mockFetch(failAI = false) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(':embedContent')) return Response.json({ embedding: { values: Array(768).fill(0.1) } });
    if (url.includes(':generateContent')) {
      if (failAI) return new Response('', { status: 503 });
      const prompt = JSON.parse(String(init?.body)).contents[0].parts[0].text;
      const candidates = JSON.parse(prompt.split('Candidatos: ')[1]) as Row[];
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ evaluations: candidates.map(c => ({ id: c.id, status: 'atende', reason: 'Requisitos presentes na descrição.' })) }) }] } }] });
    }
    if (url.includes('/api/search/')) return Response.json({ items: [] });
    return Response.json([]);
  });
}
describe('precisão da pesquisa', () => {
  it('não muda a quantidade por RAM, tensão ou BTUs e aceita quantidade explícita', () => {
    for (const text of ['16 GB RAM SSD 512 GB', '220 V', '12.000 BTU']) expect(mergeClarificationWithDemand(demand,text).quantity).toBe(10);
    expect(mergeClarificationWithDemand(demand,'quantidade: 1').quantity).toBe(1);
    expect(mergeClarificationWithDemand(demand,'20 unidades').quantity).toBe(20);
  });
  it('preserva número técnico no início e listas numeradas', () => {
    expect(extractDemandItems('16 GB RAM para notebook')[0].description).toContain('16 GB');
    expect(extractDemandItems('1) 10 notebooks\n2) 20 monitores')).toHaveLength(2);
  });
  it('compara memória, SSD e tensão sem ignorar números curtos', () => {
    expect(compareRequirements(demand.description,'notebook 8 GB RAM SSD 512 GB')).toContainEqual(expect.objectContaining({ attribute: 'ram',status:'nao_atende' }));
    expect(compareRequirements(demand.description,'notebook')).toContainEqual(expect.objectContaining({ status:'nao_informado' }));
    expect(compareRequirements('ar condicionado 12.000 BTU 220V','ar condicionado 12000 BTU 127V')).toContainEqual(expect.objectContaining({ attribute:'tensao',status:'nao_atende' }));
  });
  it('normaliza unidades e rejeita embalagem genérica ou ausente', () => {
    expect(compareUnits('UN','UNIDADE').compatible).toBe(true);
    expect(compareUnits('L','ML')).toEqual({compatible:true,factor:1000});
    expect(compareUnits('UN','CX').compatible).toBe(false);
    expect(compareUnits('CX','CX').compatible).toBe(false);
    expect(compareUnits('UN','').compatible).toBe(false);
  });
  it('distingue itens da mesma compra', () => expect(canonicalItemId('compra',1)).not.toBe(canonicalItemId('compra',2)));
  it('avalia além dos seis primeiros e amplia após rejeições', async () => {
    const fetch = mockFetch();
    const db = { rpc: vi.fn(async () => ({ error:null, data:Array.from({length:8},(_,i)=>reference(i+1,{descricao_item:'notebook 8 GB RAM SSD 512 GB'})) })) };
    const result = await executeConversationalPriceResearch(db,[demand],'test','user',{fetch,now:()=>now});
    expect(result.items[0].candidatesCount).toBe(8);
    expect(result.items[0].selectedCount).toBe(0);
    expect(fetch.mock.calls.some(([url])=>String(url).includes('/api/search/'))).toBe(true);
  });
  it('aproveita candidatos válidos nas posições sete e oito', async () => {
    const db = {rpc:async()=>({error:null,data:Array.from({length:8},(_,i)=>reference(i+1,i<6?{descricao_item:'notebook 8 GB RAM SSD 512 GB'}:{}))})};
    const result=await executeConversationalPriceResearch(db,[demand],'test','user',{fetch:mockFetch(),now:()=>now});
    expect(result.items[0].selectedCount).toBe(2);
  });
  it('falha de IA nunca aprova por palavras em comum', async () => {
    const result=await executeConversationalPriceResearch({rpc:async()=>({error:null,data:[reference(1)]})},[demand],'test','user',{fetch:mockFetch(true),now:()=>now});
    expect(result.items[0].selectedCount).toBe(0);
    expect(result.items[0].candidates[0].editalAudited).toBe(false);
  });
  it('exclui referências antigas, unidades incompatíveis e preços estimados não confirmados', async () => {
    const data=[reference(1,{data_resultado:'2024-01-01'}),reference(2,{unidade_medida:'CX'}),reference(3,{price_kind:'estimado'})];
    const result=await executeConversationalPriceResearch({rpc:async()=>({error:null,data})},[demand],'test','user',{fetch:mockFetch(),now:()=>now});
    expect(result.items[0].selectedCount).toBe(0);
    expect(result.items[0].estimatedTotal).toBe(0);
  });
  it('não usa licitacoes_pncp nem fabrica preços a partir do valor total', async () => {
    const rpc=vi.fn(async()=>({error:null,data:[]}));
    const result=await executeConversationalPriceResearch({rpc},[demand],'test','user',{fetch:mockFetch(),now:()=>now});
    expect(result.overallEstimatedTotal).toBe(0);
    expect(rpc.mock.calls.every(args=>args[0]==='match_preco_referencia_v2')).toBe(true);
  });
  it('recupera o segundo item da compra externa e usa resultado do fornecedor, não estimativa', async () => {
    const base=mockFetch();
    const fetch=vi.fn(async(input: string|URL|Request,init?: RequestInit)=>{
      const url=String(input);
      if(url.includes('/api/search/')) return Response.json({items:[{orgao_cnpj:'12345678000100',ano:2026,numero_sequencial:1,numero_controle_pncp:'12345678000100-1-000001/2026'}]});
      if(url.includes('/itens?')) return Response.json([{numeroItem:1,descricao:'Mouse',valorUnitarioEstimado:20,unidadeMedida:'UN'}, {numeroItem:2,descricao:demand.description,valorUnitarioEstimado:8000,unidadeMedida:'UN'}]);
      if(url.endsWith('/itens/2/resultados')) return Response.json([{valorUnitarioHomologado:4000,dataResultado:'2026-01-02',niFornecedor:'99999999000199',nomeRazaoSocialFornecedor:'Fornecedor real',statusCancelamento:false}]);
      return base(input,init);
    });
    const result=await executeConversationalPriceResearch({rpc:async()=>({error:null,data:[]})},[demand],'test','user',{fetch,now:()=>now});
    expect(result.items[0].selectedCount).toBe(1);
    expect(result.items[0].candidates[0]).toMatchObject({purchaseItemId:'2',unitPrice:4000,supplierDocument:'99999999000199'});
  });
  it('baixa o PDF e só marca leitura quando o trecho está associado ao item correto', async () => {
    const base=mockFetch();
    const docUrl='https://pncp.gov.br/api/pncp/v1/orgaos/12345678000100/compras/2026/1/arquivos/1';
    const fetch=vi.fn(async(input: string|URL|Request,init?: RequestInit)=>{
      const url=String(input);
      if(url.endsWith('/arquivos')) return Response.json([{titulo:'Termo de Referência',url:docUrl}]);
      if(url===docUrl) return new Response('%PDF-1.7\nfixture; conteúdo fornecido pelo mock', {headers:{'Content-Type':'application/pdf'}});
      if(url.includes(':generateContent')) {
        const body=JSON.parse(String(init?.body));
        if(body.contents[0].parts.some((p:Row)=>p.inlineData)) return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({found:true,itemNumber:'1',page:2,excerpt:demand.description})}]}}]});
      }
      return base(input,init);
    });
    const result=await executeConversationalPriceResearch({rpc:async()=>({error:null,data:[reference(1,{descricao_item:'Notebook'})]})},[demand],'test','user',{fetch,now:()=>now});
    const candidate=result.items[0].candidates[0];
    expect(candidate.editalAudited).toBe(true);
    expect(candidate.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(candidate.selected).toBe(true);
    expect(fetch.mock.calls.find(([u])=>String(u)===docUrl)?.[1]?.redirect).toBe('error');
  });
  it('não baixa PDF fora da rota oficial da contratação', async()=>{
    const base=mockFetch();
    const fetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>String(input).endsWith('/arquivos')?Response.json([{titulo:'Termo de Referência',url:'http://127.0.0.1/secrets'}]):base(input,init));
    const result=await executeConversationalPriceResearch({rpc:async()=>({error:null,data:[reference(1,{descricao_item:'Notebook'})]})},[demand],'test','user',{fetch,now:()=>now});
    expect(fetch.mock.calls.some(([u])=>String(u).includes('127.0.0.1'))).toBe(false);
    expect(result.items[0].candidates[0].editalAudited).toBe(false);
    expect(result.items[0].selectedCount).toBe(0);
  });
});

describe('ingestão íntegra', () => {
  const raw={numeroControlePNCPCompra:'12345678000100-1-000001/2026',numeroItemPncp:2,valorUnitarioResultado:4000,
    descricaoResumida:'Notebook',descricaodetalhada:'a'.repeat(1200),quantidadeResultado:10,unidadeMedida:'UN',
    dataInclusaoPncp:'2026-01-01T20:02:41',dataResultado:'2026-01-01 00:00:00.0000000'};
  it('preserva especificação completa e metadados desconhecidos',()=>{
    const mapped=mapReference(raw,'nacional')!;
    expect(String(mapped.descricao_detalhada)).toHaveLength(1200);
    expect(mapped.orgao_esfera).toBe('Não informada');
    expect(mapped.price_kind).toBe('homologado');
    expect(mapped.raw_data).toEqual(raw);
  });
  it('não inventa preço, identificador, quantidade ou data',()=>{
    for(const overrides of [{valorUnitarioResultado:0,valorUnitarioEstimado:4000},{numeroControlePNCPCompra:''},{quantidadeResultado:0},{dataInclusaoPncp:''},{numeroItemPncp:0}]) expect(mapReference({...raw,...overrides},'nacional')).toBeNull();
  });
  it('valida paginação e calendário',()=>{
    expect(()=>validatePage({resultado:[],totalPaginas:25,totalRegistros:2500},10)).toThrow();
    expect(()=>validatePage({resultado:[]},1)).toThrow();
    expect(()=>syncWindow({mode:'backfill_mensal',ano:2026,mes:2,endDay:31})).toThrow();
    expect(syncWindow({mode:'backfill_mensal',ano:2026,mes:1},new Date(now))).toEqual({start:'2026-01-01',end:'2026-01-31'});
  });
});
