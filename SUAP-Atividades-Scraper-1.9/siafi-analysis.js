(function () {
  const SOURCE = 'siages-siafi-analysis';
  let dialog, capture, area, wrapper, button, runId, processoId, timer, generation = 0, busy = false, lastSelection;
  const labels = {divergente:'Divergente',nao_verificavel:'Não verificável',conforme:'Conforme',nao_aplicavel:'Não aplicável'};
  function request(type, payload = {}) {
    return new Promise((resolve,reject) => chrome.runtime.sendMessage({source:SOURCE,type,payload}, response => {
      if (chrome.runtime.lastError || !response?.ok) { reject(new Error(response?.error || chrome.runtime.lastError?.message || 'A extensão não respondeu.')); return; }
      resolve(response);
    }));
  }
  function element(tag,text,parent=area) { const node=document.createElement(tag); if(text)node.textContent=text;parent.appendChild(node);return node; }
  function message(text) { area.replaceChildren(); const p=element('p',text);p.setAttribute('role','status'); }
  function action(text, callback, parent=area) { const node=element('button',text,parent);node.type='button';node.addEventListener('click',()=>void callback());return node; }
  function fail(error) { message(error?.message || 'Não foi possível conferir. Os arquivos locais continuam disponíveis.');busy=false;button.disabled=false; }
  async function begin(options={}) {
    if(busy)return;
    runId=null;
    busy=true;button.disabled=true;const current=generation;
    try {
      message('Identificando processo e documentos no SIAGES…');
      const prepared=await request('prepare',{captura:capture,...options});
      if(current!==generation)return;
      processoId=prepared.selection.processoId;
      lastSelection=prepared.selection;
      if(prepared.selection.needsSelection) { choose(prepared.selection);busy=false;button.disabled=false;return; }
      await start({...options,notaKeys:prepared.selection.notaKeys,listaId:prepared.selection.listaId,tipoPagamento:prepared.selection.tipoPagamento});
    } catch(error) {if(current===generation)fail(error);}
  }
  function choose(selection) {
    area.replaceChildren();element('p',`Selecione o escopo da liquidação: ${selection.numProcesso}`);
    const form=element('div');
    const kindLabel=element('label','Tipo de pagamento',form),kind=element('select','',kindLabel);
    for(const [value,text] of [['indefinido','Selecione'],['fornecedor_pj','Fornecedor pessoa jurídica'],['estudantes','Bolsas e auxílios de estudantes']]) {const option=element('option',text,kind);option.value=value;}
    kind.value=selection.tipoPagamento;
    const notes=selection.notas.map(note=>{const label=element('label',`NF ${note.numero || 'sem número'} · ${note.data_emissao || ''} · ${note.valor || ''}`,form),input=document.createElement('input');input.type='checkbox';input.checked=selection.notaKeys.includes(note.key);label.prepend(input);return {key:note.key,input};});
    const listLabel=element('label','Lista de trabalho',form),list=element('select','',listLabel);
    element('option','Sem lista — conferência ficará pendente',list).value='';
    for(const item of selection.listas)element('option',`${item.nome} (${item.quantidade})`,list).value=item.id;
    list.value=selection.listaId || '';
    const docs=element('details','',form);element('summary','Documentos de referência',docs);
    const documents=selection.documentos.map(doc=>{const label=element('label',doc.titulo,docs),input=document.createElement('input');input.type='checkbox';input.checked=true;label.prepend(input);return {id:doc.id,input};});
    const partialLabel=element('label','Pagamento parcial',form),partial=document.createElement('input');partial.type='checkbox';partialLabel.prepend(partial);
    const competence=element('input','',form);competence.placeholder='Competência (AAAA-MM), se necessária';competence.setAttribute('aria-label','Competência');
    const reason=element('input','',form);reason.placeholder='Parcela, glosa ou justificativa';reason.setAttribute('aria-label','Justificativa do escopo');
    for(const warning of selection.avisos)element('p',warning,form);
    action('Conferir seleção',async()=>{try{await start({tipoPagamento:kind.value,notaKeys:notes.filter(note=>note.input.checked).map(note=>note.key),listaId:list.value,listaAusente:kind.value==='estudantes' && !list.value,documentoIds:documents.filter(doc=>doc.input.checked).map(doc=>doc.id),competencia:competence.value,pagamentoParcial:partial.checked,justificativa:reason.value});}catch(error){fail(error);}},form);
  }
  async function start(options) {
    if(busy && runId)return;
    busy=true;button.disabled=true;const current=generation;
    message('Iniciando conferência…');
    const result=await request('start',{captura:capture,processoId,...options});
    if(current!==generation)return;
    if(result.selection){choose(result.selection);busy=false;button.disabled=false;return;}
    runId=result.runId;processoId=result.processoId;busy=false;
    await poll();
  }
  async function poll() {
    clearTimeout(timer);if(!runId || dialog.hidden)return;
    const current=generation;
    try {
      const result=await request('status',{runId});if(current!==generation)return;
      const run=result.run;
      if(run.status==='completed') {button.disabled=false;render(run.result_snapshot,result.reviews || []);return;}
      message(run.error_message || run.progresso);
      if(run.status==='failed') {
        button.disabled=false;
        if(run.attempts<3)action('Retomar análise',async()=>{try{await request('retry',{runId});await poll();}catch(error){fail(error);}});
      } else {timer=setTimeout(()=>void poll(),3000);}
    } catch(error){if(current===generation){fail(error);if(runId)action('Consultar análise',poll);}}
  }
  function render(result,reviews) {
    area.replaceChildren();element('p',result.resumo);element('p','Conferido registra sua revisão. Após corrigir, faça uma nova captura para comparar.');
    if(result.ambiguidades?.length){for(const ambiguity of result.ambiguidades)element('p',`${ambiguity.descricao} ${(ambiguity.opcoes || []).join(' · ')}`);action('Completar seleção',()=>{runId=null;choose(lastSelection);});}
    const open=element('button','Abrir histórico e evidências no SIAGES');open.type='button';open.addEventListener('click',()=>chrome.runtime.sendMessage({source:SOURCE,type:'open-process',processoId},response=>{if(!response?.ok)fail(new Error(response?.error));}));
    action('Baixar checklist (JSON)',async()=>{
      try {
        const current=await request('status',{runId});
        const url=URL.createObjectURL(new Blob([JSON.stringify({analise:current.run,revisoes:current.reviews},null,2)],{type:'application/json;charset=utf-8'}));
        const download=document.createElement('a');download.href=url;download.download=`conferencia-siafi-${runId}.json`;download.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      } catch(error){fail(error);}
    });
    const latest=new Map(reviews.map(review=>[review.item_id,review]));
    const toggler=action('Mostrar todos',()=>{const show=toggler.textContent==='Mostrar todos';for(const row of area.querySelectorAll('[data-extra]'))row.hidden=!show;toggler.textContent=show?'Mostrar pendências':'Mostrar todos';});
    for(const item of result.checklist) {
      const details=element('details');details.dataset.status=item.status;
      if(!['divergente','nao_verificavel'].includes(item.status)){details.dataset.extra='true';details.hidden=true;}
      element('summary',`${labels[item.status]} · ${item.regraId} — ${item.descricao}`,details);
      element('p',item.entidade,details);element('p',`Esperado: ${item.esperado || 'Não identificado'}`,details);element('p',`Encontrado: ${item.encontrado || 'Não identificado'}`,details);
      if(item.diferenca!==undefined)element('p',`Diferença: ${item.diferenca}`,details);
      if(item.evolucao)element('p',`Comparação anterior: ${item.evolucao}`,details);
      element('p',item.observacao,details);element('p',item.acao,details);
      if(item.calculo)element('p',item.calculo.memoria,details);
      for(const evidence of item.evidencias)element('p',`${evidence.fonte} · ${evidence.sourceId}${evidence.pagina?` · página ${evidence.pagina}`:''}${evidence.caminho?` · ${evidence.caminho}`:''}: ${evidence.trecho}`,details);
      const label=element('label','Conferido',details),check=document.createElement('input');check.type='checkbox';check.checked=latest.get(item.id)?.conferido || false;label.prepend(check);
      const reason=element('input','',details);reason.placeholder='Motivo ou observação da revisão';reason.setAttribute('aria-label',`Motivo ${item.regraId}`);
      async function save(feedback) {
        check.disabled=true;
        try{await request('review',{runId,itemId:item.id,conferido:check.checked,feedback,motivo:reason.value});latest.set(item.id,{conferido:check.checked,feedback,motivo:reason.value});}
        catch(error){check.checked=latest.get(item.id)?.conferido || false;element('p',error.message,details);}
        finally{check.disabled=false;}
      }
      check.addEventListener('change',()=>void save());
      for(const [value,text] of [['confirmo_divergencia','Confirmar apontamento'],['falso_positivo','Indicar falso positivo'],['falta_de_dados','Registrar falta de dados']])action(text,async()=>{check.checked=true;await save(value);},details);
    }
  }
  function attach(container,record) {
    generation++;clearTimeout(timer);runId=null;busy=false;capture=record;dialog=container;
    wrapper?.remove();wrapper=document.createElement('div');wrapper.dataset.analysis='true';container.querySelector('section').appendChild(wrapper);
    area=document.createElement('div');button=action('Conferir com IA',()=>begin(),wrapper);wrapper.appendChild(area);
    // A server job can finish after the dialog is closed; history retains it.
    element('p','A conferência consulta os documentos e listas da sua conta SIAGES.');
  }
  globalThis.SiagesSiafiAnalysis={attach,resume:()=>{if(runId)void poll();},reset:()=>{generation++;clearTimeout(timer);runId=null;wrapper?.remove();}};
})();
