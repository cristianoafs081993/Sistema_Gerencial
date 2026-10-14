// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertCapture, captureProcessNumber, classifyPayment, moneyCents, computeCalculation, RULES, finalizeChecklist, compareChecklists, checklistResult, normalizeAccount, authorizedPdfPath, selectInvoices, validEvidence } from '../../../supabase/functions/_shared/siafi_checklist';
const capture={schemaVersion:'1.0.0',captureId:'capture-123',source:'https://siafi.tesouro.gov.br/siafiweb/dh',status:'complete',sections:[{fields:[{label:'Processo:',value:'23035.002988.2026-97'},{label:'Valor',value:'1.000,01'},{label:'Nota fiscal',value:'NF 170; NF 171'}],tables:[]}],predocs:[]};
const sources=[{id:'pdf1',titulo:'Nota fiscal',paginas:2,paginasTexto:['Valor autorizado: 1.000,00','Segunda página']}];
const pdf={fonte:'processo',sourceId:'pdf1',pagina:1,trecho:'Valor autorizado: 1.000,00'};
const screen={fonte:'siafi',sourceId:capture.captureId,caminho:'sections.0.fields.1.value',trecho:'1.000,01'};
const context={capture,sources,lists:[],kind:'fornecedor_pj' as const};
const base={regraId:'C04',entidade:'NF:170:2026-10-08',status:'conforme',esperado:'1.000,00',encontrado:'1.000,01',observacao:'Conferência da nota.',acao:'Corrigir o valor.',evidencias:[pdf,screen],calculo:{operacao:'igualdade',valores:['1000,00'],resultado:'1000,01',evidencias:[pdf,screen]}};
describe('checklist SIAFI',()=>{
  it('recusa traversal e caminhos codificados antes de usar storage com service role',()=>{
    expect(authorizedPdfPath('user/123/documents/123.pdf','user')).toBe(true);
    for(const path of ['foreign/123.pdf','user/../foreign/123.pdf','user/%2e%2e/123.pdf','user\\123.pdf','user/123.pdf?token=x'])expect(authorizedPdfPath(path,'user')).toBe(false);
  });
  it('mantém as 32 regras e todos os itens omitidos ficam pendentes',()=>{
    expect(RULES).toHaveLength(32);
    const result=finalizeChecklist({},context);
    expect(result).toHaveLength(32);
    expect(result.filter(i=>i.regraId.startsWith('B')).every(i=>i.status==='nao_aplicavel')).toBe(true);
    expect(result.filter(i=>!i.regraId.startsWith('B')).every(i=>i.status==='nao_verificavel')).toBe(true);
    expect(checklistResult(result,'mock').statusGeral).toBe('warning');
  });
  it.each([['R$ 1.234,56',123456],['1234.56',123456],['1.000',100000],['0,00',0],['-0,01',-1],['',null],['abc',null],['1,234',null]])('interpreta %s como %s centavos',(input,expected)=>expect(moneyCents(input)).toBe(expected));
  it('recalcula diferença de um centavo mesmo quando a IA diz conforme',()=>{
    const item=finalizeChecklist({checklist:[base]},context)[0];
    expect(item.status).toBe('divergente');expect(item.diferenca).toBe('0,01');expect(item.calculo?.diferencaCentavos).toBe(1);
  });
  it('reproduz soma e arredondamento percentual em inteiros',()=>{
    expect(computeCalculation({operacao:'soma',valores:['10,01','20,02'],resultado:'30,03',evidencias:[]})?.diferencaCentavos).toBe(0);
    expect(computeCalculation({operacao:'retencao',valores:['10,01'],aliquota:'3,5',resultado:'0,35',evidencias:[]})?.diferencaCentavos).toBe(0);
    expect(computeCalculation({operacao:'retencao',valores:['0,05'],aliquota:'10',resultado:'0,01',evidencias:[]})?.diferencaCentavos).toBe(0);
    expect(computeCalculation({operacao:'retencao',valores:['100,00'],aliquota:'3.125',resultado:'3,13',evidencias:[]})?.diferencaCentavos).toBe(0);
  });
  it('recusa soma sem identificação das parcelas e dedução repetida no pré-doc',()=>{
    const raw={...base,regraId:'C05',calculo:{operacao:'soma',valores:['1000,00','1000,00'],resultado:'1000,01',evidencias:[pdf,screen],parcelas:[{chave:'NF:170:IR:1',valor:'1000,00',evidencias:[pdf]},{chave:'nf:170:ir:1',valor:'1000,00',evidencias:[pdf]}]}};
    expect(finalizeChecklist({checklist:[raw]},context).find(i=>i.regraId==='C05')?.status).toBe('nao_verificavel');
  });
  it('verifica flags booleanas reais dos pré-docs sem convertê-las em valores',()=>{
    expect(validEvidence({fonte:'siafi',sourceId:capture.captureId,caminho:'predocs.0.filled',trecho:'true'},{...capture,predocs:[{filled:true}]},sources,[])?.trecho).toBe('true');
    expect(moneyCents(true)).toBeNull();
  });
  it('usa o processo dos Dados Básicos mesmo se outra aba referenciar outro processo',()=>{
    expect(captureProcessNumber({...capture,sections:[{...capture.sections[0],key:'basic'},{fields:[{label:'Processo',value:'99999.000001.2026-01'}]}]})).toBe('23035.002988.2026-97');
  });
  it('não aprova moeda sem origem nem reutiliza um número parcial',()=>{
    expect(finalizeChecklist({checklist:[{...base,calculo:{...base.calculo,valores:['100,00']}}]},context).find(i=>i.regraId==='C04')?.status).toBe('nao_verificavel');
    expect(finalizeChecklist({checklist:[{...base,calculo:undefined}]},context).find(i=>i.regraId==='C04')?.status).toBe('nao_verificavel');
  });
  it('herda citações já verificadas do item quando o cálculo não as repete',()=>{
    expect(finalizeChecklist({checklist:[{...base,calculo:{...base.calculo,evidencias:[]}}]},context).find(i=>i.regraId==='C04')?.calculo?.diferencaCentavos).toBe(1);
    expect(finalizeChecklist({checklist:[{...base,calculo:{...base.calculo,evidencias:[],valores:['999,00']}}]},context).find(i=>i.regraId==='C04')?.status).toBe('nao_verificavel');
  });
  it('não transforma valor capturado em esperado quando falta valor no documento',()=>{
    const row={...base,regraId:'B03',calculo:{...base.calculo,valores:['1000,01'],evidencias:[]}};
    expect(finalizeChecklist({checklist:[row]},{...context,kind:'estudantes'}).find(i=>i.regraId==='B03')?.status).toBe('nao_verificavel');
  });
  it('rejeita página, campo e citação inventados',()=>{
    expect(validEvidence({...pdf,pagina:3},capture,sources,[])).toBeNull();
    expect(validEvidence({...pdf,trecho:'Valor autorizado 9999'},capture,sources,[])).toBeNull();
    expect(validEvidence({...screen,caminho:'sections.0.fields.99.value'},capture,sources,[])).toBeNull();
    expect(validEvidence({...screen,trecho:'9999'},capture,sources,[])).toBeNull();
    expect(validEvidence({...screen,caminho:'__proto__.foo'},capture,sources,[])).toBeNull();
  });
  it('PDF sem camada textual não produz conformidade silenciosa',()=>{
    const result=finalizeChecklist({checklist:[{...base,regraId:'C01',calculo:undefined}]},{...context,sources:[{id:'pdf1',titulo:'Digitalizado',paginas:2}]});
    expect(result.find(item=>item.regraId==='C01')?.status).toBe('nao_verificavel');
  });
  it('não aprova tributo com tabela histórica ou citação normativa fabricada',()=>{
    const item={...base,regraId:'F07',calculo:undefined,evidencias:[pdf,screen,{fonte:'norma',sourceId:'ufmg-2024',caminho:'17031',trecho:'vigilância receita 6190'}]};
    expect(finalizeChecklist({checklist:[item]},context).find(i=>i.regraId==='F07')?.status).toBe('nao_verificavel');
    expect(validEvidence({fonte:'norma',sourceId:'in1234',caminho:'anexo I',trecho:'Uma alíquota inventada de 100%'},capture,[{id:'in1234',titulo:'Norma',tipo:'norma_oficial',conteudo:'Trecho oficial diferente'}],[])).toBeNull();
  });
  it('ordena divergências por impacto, pendências e conformes',()=>{
    const other={...base,regraId:'C07',status:'divergente',calculo:undefined};
    const result=finalizeChecklist({checklist:[other,base]},context);
    expect(result[0].regraId).toBe('C04');expect(result[1].regraId).toBe('C07');expect(result[2].status).toBe('nao_verificavel');
  });
  it('captura parcial não comprova cobertura de notas ou pré-docs',()=>{
    const result=finalizeChecklist({checklist:[{...base,regraId:'P01',calculo:undefined}]},{...context,capture:{...capture,status:'partial'}});
    expect(result.find(i=>i.regraId==='P01')?.status).toBe('nao_verificavel');
  });
  it('falta de histórico ou valor não permite dispensar uma regra obrigatória',()=>{
    for(const ruleId of ['C04','C08','B05']) {
      const result=finalizeChecklist({checklist:[{...base,regraId:ruleId,status:'nao_aplicavel',observacao:'O dado não está disponível.'}]},{...context,kind:'estudantes'});
      expect(result.find(i=>i.regraId===ruleId)?.status).toBe('nao_verificavel');
    }
  });
  it('uma identidade repetida fica pendente',()=>expect(finalizeChecklist({checklist:[base,base]},context).find(i=>i.regraId==='C04')?.status).toBe('nao_verificavel'));
  it('compara identidade estável, sem tratar item desaparecido como resolvido',()=>{
    const old=finalizeChecklist({checklist:[base]},context).filter(i=>i.regraId==='C04');
    const changed={...old[0],status:'conforme' as const};
    expect(compareChecklists([changed],old)[0].evolucao).toBe('resolvido');
    expect(compareChecklists([old[0]],old)[0].evolucao).toBe('persistente');
    expect(compareChecklists([],old)[0].evolucao).toBe('nao_verificavel');
    expect(compareChecklists([old[0]],[])[0].evolucao).toBe('novo');
  });
  it('cobra conferência individual de cada estudante e não assume valor padrão',()=>{
    const result=finalizeChecklist({}, {...context,kind:'estudantes',lists:[{id:'list',rows:[{cpf:'00000000001',valor:300},{cpf:'00000000002'}]}]});
    expect(result.filter(i=>i.regraId==='B03' && i.entidade.startsWith('CPF:'))).toHaveLength(2);
    expect(result.filter(i=>i.regraId==='B03').every(i=>i.status==='nao_verificavel'&&!i.calculo)).toBe(true);
    expect(normalizeAccount('00123-X')).toBe('00123X');
  });
  it('identifica processo exato e rejeita host parecido ou captura sem processo',()=>{
    expect(captureProcessNumber(capture)).toBe('23035.002988.2026-97');expect(assertCapture(capture)).toEqual(capture);
    expect(()=>assertCapture({...capture,source:'https://siafi.tesouro.gov.br.evil.test/a'})).toThrow('Origem');
    expect(()=>assertCapture({...capture,sections:[{fields:[]}]})).toThrow('processo');
  });
  it('seleciona todas as notas referenciadas sem escolher pela posição',()=>{
    const notes=[{numero:'171',valor:'1,00'},{numero:'170',valor:'2,00'},{numero:'999',valor:'3,00'}];
    expect(selectInvoices(capture,notes).selected).toEqual([0,1]);
    expect(selectInvoices({...capture,sections:[]},notes).ambiguous).toBe(true);
    expect(selectInvoices(capture,[notes[0],notes[0]]).invoices).toHaveLength(1);
  });
  it('classifica auxílio de estudante e PJ sem tratar PF como fornecedor PJ',()=>{
    expect(classifyPayment({assunto:'Assistência estudantil',cpf_cnpj:'00000000000'})).toBe('estudantes');
    expect(classifyPayment({cpf_cnpj:'00000000000000'})).toBe('fornecedor_pj');
    expect(classifyPayment({cpf_cnpj:'00000000000'})).toBe('indefinido');
  });
});
