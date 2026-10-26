// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertCapture, captureProcessNumber, classifyPayment, moneyCents, computeCalculation, RULES, finalizeChecklist, compareChecklists, checklistResult, normalizeAccount, authorizedPdfPath, selectInvoices, validEvidence, captureEvidenceCatalog } from '../../../supabase/functions/_shared/siafi_checklist';
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
  it('aceita o alias captura emitido pela IA e conserva a validação de campo e trecho',()=>{
    expect(validEvidence({...screen,fonte:'captura'},capture,sources,[])).toMatchObject({fonte:'siafi',caminho:screen.caminho});
    expect(validEvidence({...screen,fonte:'captura',trecho:'valor inventado'},capture,sources,[])).toBeNull();
  });
  it('resolve referências de captura no catálogo sem depender de índices inventados pela IA',()=>{
    const reference=captureEvidenceCatalog(capture).find(entry=>entry.caminho===screen.caminho)!;
    expect(validEvidence({...screen,ref:reference.ref,caminho:'sections.99.fields.99.value'},capture,sources,[])).toMatchObject({caminho:screen.caminho});
    expect(validEvidence({...screen,ref:'S9999'},capture,sources,[])).toBeNull();
    expect(validEvidence({...screen,ref:reference.ref,trecho:'valor fabricado'},capture,sources,[])).toBeNull();
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
  const studentSources=[{id:'students',titulo:'Autorização PAFE',paginas:1,paginasTexto:[
    'Solicitados e autorizados PAFE competência 2026-10 parcela 1. Ana CPF 000.000.001-91. Bruno CPF 000.000.002-72. Carla CPF 000.000.003-53.',
  ]}];
  const names:Record<string,string>={'00000000191':'Ana','00000000272':'Bruno','00000000353':'Carla'};
  const cpfTexts:Record<string,string>={'00000000191':'000.000.001-91','00000000272':'000.000.002-72','00000000353':'000.000.003-53'};
  const studentRaw=(cpfs:string[])=>({conferenciaEstudantes:{escopoConfirmado:true,listaCompleta:true,
    evidenciasEscopo:[{fonte:'processo',sourceId:'students',pagina:1,trecho:'Solicitados e autorizados PAFE competência 2026-10 parcela 1.'}],
    autorizados:cpfs.map(cpf=>({cpf,nome:names[cpf],evidencias:[{fonte:'processo',sourceId:'students',pagina:1,trecho:`${names[cpf]} CPF ${cpfTexts[cpf]}.`}]})),
    solicitacao:{escopoConfirmado:true,listaCompleta:true,alunos:cpfs.map(cpf=>({cpf,nome:names[cpf],evidencias:[{fonte:'processo',sourceId:'students',pagina:1,trecho:`${names[cpf]} CPF ${cpfTexts[cpf]}.`}]})),
      evidenciasEscopo:[{fonte:'processo',sourceId:'students',pagina:1,trecho:'Solicitados e autorizados PAFE competência 2026-10 parcela 1.'}]},
  }});
  const studentContext=(cpfs:string[])=>({...context,kind:'estudantes' as const,sources:studentSources,capture:{...capture,sections:[
    {key:'dados-basicos',status:'captured',fields:[{label:'Credor',value:'00000000000191'}]},
    {key:'dados-pagamento',status:'captured',tables:[{id:'lista_DPgtoOB',headers:['CPF','Nome','Valor'],rows:cpfs.map(cpf=>[{text:cpf},{text:names[cpf]},{text:'100,00'}])}]},
  ]}});
  it('detecta o aluno esquecido mesmo ausente da lista de trabalho SIAGES',()=>{
    const result=finalizeChecklist(studentRaw(['00000000191','00000000272']),studentContext(['00000000191']));
    expect(result.find(item=>item.id==='B02:GERAL')).toMatchObject({status:'divergente',esperado:'Solicitação: 2 aluno(s); autorização: 2 aluno(s)'});
    expect(result.find(item=>item.id==='B02:CPF:00000000272:COBERTURA')).toMatchObject({status:'divergente',acao:expect.stringContaining('esquecido')});
    expect(result.filter(item=>item.regraId==='B03'&&item.entidade.includes('00000000272'))).toHaveLength(1);
  });
  it('detecta aluno adicional quando o processo autoriza somente um',()=>{
    const result=finalizeChecklist(studentRaw(['00000000191']),studentContext(['00000000191','00000000272']));
    expect(result.find(item=>item.id==='B02:CPF:00000000272:COBERTURA')).toMatchObject({status:'divergente',acao:expect.stringContaining('incluído a mais')});
  });
  it('não aprova apenas porque a quantidade e o total dos alunos são iguais',()=>{
    const result=finalizeChecklist(studentRaw(['00000000191','00000000272']),studentContext(['00000000191','00000000353']));
    expect(result.filter(item=>item.entidade.startsWith('CPF:')&&item.regraId==='B02'&&item.status==='divergente')).toHaveLength(2);
  });
  it('aprova a cobertura por CPF sem exigir lista de trabalho e aponta ocorrência repetida',()=>{
    const matching=finalizeChecklist(studentRaw(['00000000191','00000000272']),studentContext(['00000000272','00000000191']));
    expect(matching.find(item=>item.id==='B02:GERAL')?.status).toBe('conforme');
    const duplicated=finalizeChecklist(studentRaw(['00000000191']),studentContext(['00000000191','00000000191']));
    expect(duplicated.find(item=>item.id==='B02:CPF:00000000191:COBERTURA')?.status).toBe('divergente');
  });
  it('não acusa ausência definitiva com captura parcial, CPF mascarado ou escopo ambíguo',()=>{
    const full=studentContext(['00000000191']);
    for(const ctx of [{...full,capture:{...full.capture,status:'partial'}},studentContext(['***.***.002-72'])]) {
      expect(finalizeChecklist(studentRaw(['00000000191','00000000272']),ctx).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
    }
    const raw=studentRaw(['00000000191']);raw.conferenciaEstudantes.escopoConfirmado=false;
    expect(finalizeChecklist(raw,full).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
  });
  it('não confunde banco intermediário, lista de trabalho ou CPF inventado com autorização',()=>{
    const raw=studentRaw(['00000000191','00000000272']);raw.conferenciaEstudantes.autorizados[1].evidencias[0].trecho='Aluno fictício CPF 000.000.009-00';
    const ctx=studentContext(['00000000191']);
    expect(finalizeChecklist(raw,ctx).find(item=>item.id==='B02:AUTORIZACAO_LIQUIDACAO')?.status).toBe('nao_verificavel');
    expect(finalizeChecklist({}, {...ctx,lists:[{tipo:'lista_trabalho',rows:[{cpf:'00000000191'}]}]}).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
    expect(finalizeChecklist(studentRaw(['00000000191']),studentContext(['00000000000191'])).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
  });
  it('usa o CPF literal do PDF quando a IA troca dígitos no campo estruturado',()=>{
    const raw=studentRaw(['00000000191','00000000272']);raw.conferenciaEstudantes.autorizados[1].cpf='00000000072';
    const result=finalizeChecklist(raw,studentContext(['00000000191']));
    expect(result.find(item=>item.id==='B02:CPF:00000000272:COBERTURA')?.status).toBe('divergente');
    expect(result.some(item=>item.entidade.includes('00000000072'))).toBe(false);
  });
  it('usa quantidade autorizada explícita do PDF e recusa inventário incompleto mesmo se a IA aprovar',()=>{
    const raw=studentRaw(['00000000191']);raw.conferenciaEstudantes.listaCompleta=false;
    const ctx=studentContext(['00000000191','00000000272']);
    const source={...studentSources[0],paginasTexto:[studentSources[0].paginasTexto[0]+' Quantidade autorizada: 1.']};
    expect(finalizeChecklist(raw,{...ctx,sources:[source]}).find(item=>item.id==='B02:GERAL')?.status).toBe('divergente');
    raw.conferenciaEstudantes.listaCompleta=true;
    expect(finalizeChecklist(raw,{...ctx,sources:[{...source,paginasTexto:[studentSources[0].paginasTexto[0]+' Quantidade autorizada: 2.']}]}).find(item=>item.id==='B02:CPF:00000000191:COBERTURA')?.status).toBe('nao_verificavel');
  });
  it('não promove aluno capturado a autorizado quando o PDF comprova somente um aluno',()=>{
    const raw=studentRaw(['00000000191','00000000272']);
    raw.conferenciaEstudantes.autorizados[1].evidencias=[];
    const ctx=studentContext(['00000000191','00000000272']);
    const source={...studentSources[0],paginasTexto:[studentSources[0].paginasTexto[0]+' Quantidade autorizada: 1.']};
    expect(finalizeChecklist(raw,{...ctx,sources:[source]}).find(item=>item.id==='B02:SOLICITACAO_AUTORIZACAO')?.status).toBe('divergente');
  });
  it('detecta erro do gestor: pedido de dois alunos, autorização e liquidação de apenas um',()=>{
    const raw=studentRaw(['00000000191','00000000272']);raw.conferenciaEstudantes.autorizados=raw.conferenciaEstudantes.autorizados.slice(0,1);
    const result=finalizeChecklist(raw,studentContext(['00000000191']));
    expect(result.find(item=>item.id==='B02:GERAL')?.status).toBe('divergente');
    expect(result.find(item=>item.id==='B02:SOLICITACAO_AUTORIZACAO')?.status).toBe('divergente');
    expect(result.find(item=>item.id==='B02:AUTORIZACAO_LIQUIDACAO')?.status).toBe('conforme');
    expect(result.find(item=>item.id==='B02:CPF:00000000272:COBERTURA')).toMatchObject({status:'divergente',acao:expect.stringContaining('gestor')});
  });
  it('cobra a quantidade solicitada mesmo quando o pedido não identifica os CPFs',()=>{
    const raw=studentRaw(['00000000191']);
    const solicitation={escopoConfirmado:true,listaCompleta:false,alunos:[],quantidade:2,
      evidenciasEscopo:[{fonte:'processo',sourceId:'request',pagina:1,trecho:'Solicito bolsas PAFE competência 2026-10 parcela 1.'}],
      evidenciasQuantidade:[{fonte:'processo',sourceId:'request',pagina:1,trecho:'Quantidade solicitada: 2.'}]};
    const ctx=studentContext(['00000000191']);
    const result=finalizeChecklist({...raw,conferenciaEstudantes:{...raw.conferenciaEstudantes,solicitacao:solicitation}}, {...ctx,sources:[...ctx.sources,{id:'request',titulo:'Solicitação original',paginas:1,paginasTexto:['Solicito bolsas PAFE competência 2026-10 parcela 1. Quantidade solicitada: 2.']}]});
    expect(result.find(item=>item.id==='B02:GERAL')?.status).toBe('divergente');
    expect(result.find(item=>item.id==='B02:SOLICITACAO_LIQUIDACAO')?.status).toBe('divergente');
    expect(result.find(item=>item.id==='B02:CPF:00000000191:COBERTURA')?.status).toBe('nao_verificavel');
  });
  it('não presume pedido correto porque autorização e DH coincidem, nem aceita quantidade inventada',()=>{
    const raw=studentRaw(['00000000191']);
    const {solicitacao:ignored,...withoutRequest}=raw.conferenciaEstudantes;void ignored;
    expect(finalizeChecklist({conferenciaEstudantes:withoutRequest},studentContext(['00000000191'])).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
    const invalid={...raw.conferenciaEstudantes.solicitacao,listaCompleta:false,alunos:[],quantidade:2,evidenciasQuantidade:[{fonte:'processo',sourceId:'students',pagina:1,trecho:'Quantidade solicitada: 2.'}]};
    expect(finalizeChecklist({conferenciaEstudantes:{...withoutRequest,solicitacao:invalid}},studentContext(['00000000191'])).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
  });
  it('quantidade solicitada literal do PDF prevalece mesmo se a IA copiar só um aluno da autorização',()=>{
    const raw=studentRaw(['00000000191']);
    const ctx=studentContext(['00000000191']);
    const source={...studentSources[0],paginasTexto:[studentSources[0].paginasTexto[0]+' Quantidade solicitada: 2.']};
    const result=finalizeChecklist(raw,{...ctx,sources:[source]});
    expect(result.find(item=>item.id==='B02:SOLICITACAO_AUTORIZACAO')).toMatchObject({status:'divergente',esperado:'Quantidade de alunos: 2',encontrado:'Quantidade de alunos: 1'});
    expect(result.find(item=>item.id==='B02:GERAL')?.status).toBe('divergente');
  });
  it('identifica o CPF do pré-doc vinculado à linha RB sem confundir banco intermediário',()=>{
    const ctx=studentContext(['00000000191']);
    const payment=ctx.capture.sections[1];
    const adapted={...ctx,capture:{...ctx.capture,status:'partial',warnings:['Aba não disponível: deducoes'],
      sections:[ctx.capture.sections[0],{...payment,tables:[{id:'lista_DPgtoOB',headers:['Favorecido','Valor'],rows:[[{text:'RB0000050'},{text:'100,00'}]]}]}],
      predocs:[{id:'lista_DPgtoOB:0:btnPredoc',sectionKey:'dados-pagamento',status:'captured',fields:[
        {id:'form_manterDocumentoHabil:codFavorecido_output',label:'Favorecido',value:'00000000191'},
        {id:'form_manterDocumentoHabil:nomeFavorecido',label:'Nome',value:'Ana'},
      ]}],
    }};
    expect(finalizeChecklist(studentRaw(['00000000191']),adapted).find(item=>item.id==='B02:GERAL')?.status).toBe('conforme');
    adapted.capture.predocs[0].sectionKey='deducoes';
    expect(finalizeChecklist(studentRaw(['00000000191']),adapted).find(item=>item.id==='B02:GERAL')?.status).toBe('nao_verificavel');
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
