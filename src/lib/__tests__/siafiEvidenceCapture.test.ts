import { readFileSync } from 'node:fs';
import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type RecordData = { status: string; sections: Array<{ key: string; status: string; fields: Array<{ value: string }>; firstPage?: number; lastPage?: number }>; predocs: Array<{ status: string; fields: Array<{ value: string }>; firstPage?: number; lastPage?: number }> };
type CapturePage = { title: string; width: number; height: number; jpeg: Uint8Array };
type Api = { start: () => Promise<void>; getRecord: () => RecordData; unscroll: (root: Element) => () => void; screenshotPages: (root: Element, title: string, pages: CapturePage[]) => Promise<void>; destroy: () => void };
type TestWindow = typeof window & { __SIAGES_SIAFI_EVIDENCE_TEST__?: boolean; __siagesSiafiEvidence?: Api; __suapeCommandPaletteLoaded?: boolean; SiagesSiafiEvidence: { available: () => boolean; start: () => Promise<void>; isRunning: () => boolean }; chrome?: unknown };
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
let paletteListeners: Array<Parameters<Document['addEventListener']>> = [];
const prefix = 'form_manterDocumentoHabil';
const items = [ ['abaDadosBasicosId', 'Dados Básicos'], ['abaPrincipalComOrcamentoId', 'Principal Com Orçamento'], ['abaDeducaoId', 'Dedução'], ['abaDadosPagRecId', 'Dados de Pagamento'] ];
let screenshots: ReturnType<typeof vi.fn>, confirm: ReturnType<typeof vi.fn>, drawImage: ReturnType<typeof vi.fn>;
let multiSituation = false;
function setup() {
  document.body.innerHTML = `<div id="divDH"><span id="${prefix}:ugEmitente_output">158366</span><span id="${prefix}:anoExercicioSiafi">2026</span><span id="${prefix}:codigoTipoDocHabil_outputText">RP</span><span id="${prefix}:numeroDocumentoHabil_outputText">-</span><div id="${prefix}:abasDocHabil">${items.map(([id,title])=>`<input type="button" id="${prefix}:${id}" value="${title}" class="btn-aba-dh${id==='abaDadosPagRecId'?' btn-aba-dh-selecionada':''}" ${id==='abaDadosPagRecId'?'disabled':''}>`).join('')}<div id="panel"></div></div><input type="button" id="${prefix}:btnRegistrar" value="Registrar"></div><div id="mpStatusContainer" style="display:none"></div><div id="${prefix}:modalPredocContainer" style="display:none"></div>`;
  function content(id: string) {
    const panel = document.getElementById('panel')!;
    if (id === 'abaDeducaoId') panel.innerHTML = '<input value="" aria-label="Situação">';
    else if (id === 'abaDadosPagRecId') {
      panel.innerHTML = `<table><thead><tr><th>Favorecido</th><th>Valor</th></tr></thead><tbody><tr><td>RB0000050</td><td>4.000,00</td><td><input type="button" id="${prefix}:lista_DPgtoOB:0:btnPredoc" class="checked" value="Pré-Doc"></td></tr></tbody></table>`;
      document.getElementById(`${prefix}:lista_DPgtoOB:0:btnPredoc`)!.onclick = () => {
        const modal = document.getElementById(`${prefix}:modalPredocContainer`)!;
        modal.innerHTML = `<div id="${prefix}:modalPredocCDiv"><label for="${prefix}:numeroLista_input">Número da Lista</label><input id="${prefix}:numeroLista_input" value="2026LX000010"><input type="button" id="${prefix}:btnConfirmarPredoc" value="Confirmar"><input type="button" id="${prefix}:btnRetornarPredoc" value="Retornar"></div>`;
        modal.style.display = 'block';
        document.getElementById(`${prefix}:btnConfirmarPredoc`)!.onclick = confirm;
        document.getElementById(`${prefix}:btnRetornarPredoc`)!.onclick = () => { modal.style.display = 'none'; };
      };
    } else if (id === 'abaPrincipalComOrcamentoId' && multiSituation) {
      const renderSituation=(current:string)=>{
        panel.innerHTML=['DSP061','DSP062'].map(code=>`<input type="button" class="linkParaSituacao" id="${prefix}:${code}" value="${code}" ${code===current?'disabled':''}>`).join('')+`<label for="situacao:valor">Valor</label><input id="situacao:valor" value="${current==='DSP061'?'1.000,00':'3.000,00'}" disabled>`;
        for(const code of ['DSP061','DSP062'])document.getElementById(`${prefix}:${code}`)!.onclick=()=>{setTimeout(()=>renderSituation(code),300);};
      };
      renderSituation('DSP061');
    } else panel.innerHTML = `<label for="${id}:valor">Valor</label><input id="${id}:valor" value="4.000,00" disabled>`;
  }
  for (const [id] of items) document.getElementById(`${prefix}:${id}`)!.onclick = () => {
    const busy = document.getElementById('mpStatusContainer')!; busy.style.display='block';
    // Model RichFaces: old panel and active tab survive until the AJAX reply.
    setTimeout(() => {
      for (const [candidate] of items) { const button=document.getElementById(`${prefix}:${candidate}`) as HTMLInputElement; button.disabled=candidate===id; button.classList.toggle('btn-aba-dh-selecionada',candidate===id); }
      content(id); busy.style.display='none';
    }, 400);
  };
  content('abaDadosPagRecId'); document.getElementById(`${prefix}:btnRegistrar`)!.onclick = confirm;
}
beforeEach(() => {
  vi.useFakeTimers(); multiSituation=false; confirm = vi.fn(); screenshots = vi.fn().mockResolvedValue({ok:true,dataUrl:'data:image/png;base64,AAA='});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,right:600,bottom:300,width:600,height:300,toJSON:()=>({})});
  drawImage=vi.fn();
  const context = {drawImage,fillRect:vi.fn(),fillText:vi.fn(),measureText:(value:string)=>({width:value.length*10}),fillStyle:'',font:''};
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/2Q==');
  vi.stubGlobal('Image',class {width=1024;height=768;onload?:()=>void;set src(_value:string){queueMicrotask(()=>this.onload?.());}});
  URL.createObjectURL=vi.fn().mockReturnValue('blob:test'); URL.revokeObjectURL=vi.fn();
  setup();
  const testWindow=window as TestWindow; testWindow.__SIAGES_SIAFI_EVIDENCE_TEST__=true; testWindow.chrome={runtime:{sendMessage:screenshots}};
  for (const file of ['siafi-evidence-core.js','siafi-evidence-pdf.js','siafi-evidence.js']) window.eval(readFileSync(extensionFixturePath(file),'utf8'));
});
afterEach(() => {
  (window as TestWindow).__siagesSiafiEvidence?.destroy();
  for (const [type, listener, options] of paletteListeners) document.removeEventListener(type, listener, options);
  paletteListeners = [];
  delete (window as TestWindow).__suapeCommandPaletteLoaded;
  document.body.innerHTML = '';
  if (originalLocationDescriptor) Object.defineProperty(window, 'location', originalLocationDescriptor);
  vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();
});
describe('coletor completo de comprovantes SIAFI',()=>{
  it('não coloca card no DH ao carregar nem ao atualizar o formulário', async () => {
    expect(document.getElementById('siages-siafi-evidence')).toBeNull();
    document.getElementById('panel')!.appendChild(document.createElement('span'));
    await vi.runAllTimersAsync();
    expect(document.getElementById('siages-siafi-evidence')).toBeNull();
    expect(screenshots).not.toHaveBeenCalled();
  });
  it('executa print pela paleta sem login SIAGES e sem sobrepor os screenshots', async () => {
    Object.defineProperty(window, 'location', { configurable: true, value: {
      protocol: 'https:', hostname: 'siafi.tesouro.gov.br', pathname: '/siafi/editarDH', href: 'https://siafi.tesouro.gov.br/siafi/editarDH', origin: 'https://siafi.tesouro.gov.br',
    } });
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('SiagesExtensionAuth', { getSession: async () => null });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const listeners = vi.spyOn(document, 'addEventListener');
    window.eval(readFileSync(extensionFixturePath('command-palette.js'), 'utf8'));
    paletteListeners = listeners.mock.calls;
    const originalInput = document.createElement('input'); document.body.appendChild(originalInput); originalInput.focus();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    const input = document.querySelector<HTMLInputElement>('.suape-cp-input')!;
    fireEvent.input(input, { target: { value: 'print' } });
    expect(document.querySelector('.suape-cp-list')).toHaveTextContent('Capturar liquidação (PDF e JSON)');
    screenshots.mockImplementation(async () => {
      expect(document.getElementById('suape-cp-overlay')).not.toHaveClass('suape-cp-visible');
      expect(document.getElementById('siages-siafi-evidence')!.style.visibility).toBe('hidden');
      return { ok: true, dataUrl: 'data:image/png;base64,AAA=' };
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((window as TestWindow).SiagesSiafiEvidence.isRunning()).toBe(true);
    expect(document.querySelector<HTMLInputElement>('#siages-siafi-evidence input')!.checked).toBe(true);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(document.getElementById('suape-cp-overlay')).not.toHaveClass('suape-cp-visible');
    await (window as TestWindow).SiagesSiafiEvidence.start(); // A second command cannot start another capture.
    await vi.runAllTimersAsync();
    expect((window as TestWindow).__siagesSiafiEvidence!.getRecord().status).toBe('complete');
    expect(screenshots).toHaveBeenCalledTimes(4);
    expect(confirm).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    expect(document.querySelectorAll('#siages-siafi-evidence a[download]')).toHaveLength(2);
    expect(document.getElementById(`${prefix}:abaDadosPagRecId`)).toHaveClass('btn-aba-dh-selecionada');
    fireEvent.click(document.querySelector('[data-close]')!);
    expect(document.getElementById('siages-siafi-evidence')).toHaveAttribute('hidden');
    expect(document.activeElement).toBe(originalInput);
    document.getElementById('panel')!.appendChild(document.createElement('span'));
    await vi.runAllTimersAsync();
    expect(document.getElementById('siages-siafi-evidence')).toHaveAttribute('hidden');
  });
  it.each([
    ['https:', 'siafi.tesouro.gov.br', false],
    ['https:', 'example.org', true],
    ['http:', 'siafi.tesouro.gov.br', true],
  ])('não oferece print fora de um DH SIAFI HTTPS (%s %s DH=%s)', async (protocol, hostname, hasDh) => {
    Object.defineProperty(window, 'location', { configurable: true, value: { protocol, hostname, pathname: '/', href: `${protocol}//${hostname}/` } });
    if (!hasDh) document.getElementById(`${prefix}:abasDocHabil`)!.remove();
    const api = (window as TestWindow).SiagesSiafiEvidence;
    expect(api.available()).toBe(false);
    await api.start();
    expect(document.getElementById('siages-siafi-evidence')).toBeNull();
    expect(screenshots).not.toHaveBeenCalled();
    vi.stubGlobal('SiagesExtensionAuth', { getSession: async () => null });
    const listeners = vi.spyOn(document, 'addEventListener');
    window.eval(readFileSync(extensionFixturePath('command-palette.js'), 'utf8'));
    paletteListeners = listeners.mock.calls;
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.input(document.querySelector('.suape-cp-input')!, { target: { value: 'print' } });
    expect(document.querySelector('.suape-cp-list')).not.toHaveTextContent('Capturar liquidação');
    await vi.runAllTimersAsync();
  });
  it('captura todas as partes do pré-doc fixo com body bloqueado, sem depender de rolagem da janela',async()=>{
    vi.stubGlobal('innerWidth',1600);vi.stubGlobal('innerHeight',683);vi.stubGlobal('scrollX',0);vi.stubGlobal('scrollY',101);
    vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(1585);
    vi.spyOn(document.documentElement,'clientHeight','get').mockReturnValue(683);
    const bodyStyle=document.body.getAttribute('style');document.body.style.overflow='hidden';
    const wrapper=document.createElement('div');wrapper.style.position='fixed';
    wrapper.innerHTML='<div style="position:absolute;left:283px;top:94px;width:1019px;height:496px;overflow:hidden">Pré-doc inteiro</div>';
    document.body.appendChild(wrapper);const target=wrapper.firstElementChild as HTMLElement;
    const originalStyle=target.getAttribute('style');
    vi.spyOn(target,'getBoundingClientRect').mockImplementation(()=>{
      const left=parseFloat(target.style.left),top=parseFloat(target.style.top),height=target.style.height==='auto'?868:496;
      return {x:left,y:top,left,top,right:left+1019,bottom:top+height,width:1019,height,toJSON:()=>({})};
    });
    const pages:CapturePage[]=[];
    const task=(window as TestWindow).__siagesSiafiEvidence!.screenshotPages(target,'Pré-doc',pages);
    await vi.runAllTimersAsync();await task;
    expect(pages).toHaveLength(2);expect(screenshots).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls.map(call=>call.slice(1,3))).toEqual([[10,18],[10,18]]);
    expect(drawImage.mock.calls.map(call=>call[4])).toEqual([Math.round(643*768/683),Math.round(249*768/683)]);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(target.getAttribute('style')).toBe(originalStyle);expect(wrapper.style.position).toBe('fixed');
    expect(document.body.style.overflow).toBe('hidden');
    if(bodyStyle===null)document.body.removeAttribute('style');else document.body.setAttribute('style',bodyStyle);
  });
  it('restaura posição e estilos do pré-doc fixo quando o navegador recusa a captura',async()=>{
    const wrapper=document.createElement('div');wrapper.style.position='fixed';
    wrapper.innerHTML='<div style="position:absolute;left:283px;top:94px;height:496px">Pré-doc</div>';
    document.body.appendChild(wrapper);const target=wrapper.firstElementChild as HTMLElement;
    const originalStyle=target.getAttribute('style');
    screenshots.mockResolvedValue({ok:false,error:'Falha na captura'});
    const task=(window as TestWindow).__siagesSiafiEvidence!.screenshotPages(target,'Pré-doc',[]);
    const result=expect(task).rejects.toThrow('Falha na captura');await vi.runAllTimersAsync();await result;
    expect(target.getAttribute('style')).toBe(originalStyle);
    expect(document.getElementById('siages-siafi-evidence')).toBeNull();
  });
  it('captura a última parte de uma página longa quando a rolagem chega ao limite inferior',async()=>{
    vi.stubGlobal('innerWidth',1600);vi.stubGlobal('innerHeight',683);vi.stubGlobal('scrollX',0);vi.stubGlobal('scrollY',142);
    vi.spyOn(document.documentElement,'clientWidth','get').mockReturnValue(1585);
    vi.spyOn(document.documentElement,'clientHeight','get').mockReturnValue(683);
    let top=142;
    vi.spyOn(window,'scrollTo').mockImplementation(options=>{if(typeof options==='object')top=Math.max(0,Math.min(options.top||0,1521));});
    const target=document.getElementById('divDH')!;
    vi.spyOn(target,'getBoundingClientRect').mockImplementation(()=>({x:80,y:204-top,left:80,top:204-top,right:1530,bottom:2204-top,width:1450,height:2000,toJSON:()=>({})}));
    const pages:CapturePage[]=[];
    const task=(window as TestWindow).__siagesSiafiEvidence!.screenshotPages(target,'Dados Básicos',pages);
    await vi.runAllTimersAsync();await task;
    expect(pages).toHaveLength(4);expect(screenshots).toHaveBeenCalledTimes(4);
    expect(drawImage.mock.lastCall?.[2]).toBe(Math.round(540*768/683));
    expect(drawImage.mock.lastCall?.[4]).toBe(Math.round(143*768/683));
    expect(top).toBe(142);
  });
  it('expande rolagem RichFaces aninhada e restaura estilos e posições originais',()=>{
    const target=document.createElement('div');
    target.innerHTML='<div id="clip" style="height:100px;overflow-y:hidden"><div id="divScrollDados" style="height:50px;overflow:visible">Conteúdo</div></div>';
    document.body.appendChild(target);
    const clip=target.firstElementChild as HTMLElement;const inner=clip.firstElementChild as HTMLElement;
    const before=clip.getAttribute('style');const innerBefore=inner.getAttribute('style');clip.scrollTop=47;
    Object.defineProperty(clip,'clientHeight',{value:100});
    Object.defineProperty(clip,'scrollHeight',{get:()=>inner.style.height==='auto'?300:100});
    const restore=(window as TestWindow).__siagesSiafiEvidence!.unscroll(target);
    expect(inner.style.height).toBe('auto');expect(clip.style.overflow).toBe('visible');
    restore();expect(clip.getAttribute('style')).toBe(before);expect(inner.getAttribute('style')).toBe(innerBefore);expect(clip.scrollTop).toBe(47);
  });
  it('aguarda AJAX, percorre as abas, captura pré-doc e restaura a aba sem registrar',async()=>{
    const api=(window as TestWindow).__siagesSiafiEvidence!;
    const pdf=(window as unknown as {SiagesSiafiEvidencePdf:{buildPdf:(pages:CapturePage[],record:RecordData)=>Uint8Array}}).SiagesSiafiEvidencePdf;
    const writer=vi.spyOn(pdf,'buildPdf');
    const task=api.start(); await vi.runAllTimersAsync(); await task;
    const record=api.getRecord();
    expect(record.status).toBe('complete');
    expect(record.sections.map(section=>[section.key,section.status])).toEqual([['dados-basicos','captured'],['principal-orcamento','captured'],['deducoes','empty'],['dados-pagamento','captured']]);
    expect(record.predocs).toContainEqual(expect.objectContaining({status:'captured',fields:expect.arrayContaining([expect.objectContaining({value:'2026LX000010'})])}));
    expect(screenshots).toHaveBeenCalledTimes(4); expect(confirm).not.toHaveBeenCalled();
    expect(document.getElementById(`${prefix}:abaDadosPagRecId`)).toHaveClass('btn-aba-dh-selecionada');
    expect(document.querySelectorAll('#siages-siafi-evidence a[download]')).toHaveLength(2);
    expect(writer.mock.calls[0][0]).toHaveLength(4);
    expect(writer.mock.calls[0][0][0].title).toContain('Dados Básicos');
    expect(record.sections.filter(section=>section.status==='captured').map(section=>[section.firstPage,section.lastPage])).toEqual([[1,1],[2,2],[3,3]]);
    expect(record.predocs[0]).toEqual(expect.objectContaining({firstPage:4,lastPage:4}));
  });
  it('falha de screenshot não produz comprovante e restaura a aba',async()=>{
    screenshots.mockResolvedValue({ok:false,error:'A aba ativa mudou'});
    const api=(window as TestWindow).__siagesSiafiEvidence!;
    const task=api.start();await vi.runAllTimersAsync();await task;
    expect(api.getRecord().status).toBe('failed'); expect(confirm).not.toHaveBeenCalled();
    expect(document.querySelectorAll('#siages-siafi-evidence a[download]')).toHaveLength(0);
    expect(document.getElementById(`${prefix}:abaDadosPagRecId`)).toHaveClass('btn-aba-dh-selecionada');
  });
  it('captura todas as situações de orçamento em seções distintas',async()=>{
    multiSituation=true;
    const api=(window as TestWindow).__siagesSiafiEvidence!;
    const task=api.start();await vi.runAllTimersAsync();await task;
    const sections=api.getRecord().sections.filter(section=>section.key==='principal-orcamento');
    expect(sections).toHaveLength(2);
    expect(sections.map(section=>section.fields.find(field=>field.value==='1.000,00'||field.value==='3.000,00')?.value)).toEqual(['1.000,00','3.000,00']);
    expect(api.getRecord().status).toBe('complete');expect(confirm).not.toHaveBeenCalled();
  });
  it('identifica pré-doc ausente como captura parcial sem abrir formulário vazio',async()=>{
    const payment=document.getElementById(`${prefix}:abaDadosPagRecId`)!;
    const prior=payment.onclick!;
    payment.onclick=function(event){prior.call(this,event);setTimeout(()=>document.getElementById(`${prefix}:lista_DPgtoOB:0:btnPredoc`)?.classList.remove('checked'),410);};
    const api=(window as TestWindow).__siagesSiafiEvidence!;
    const task=api.start();await vi.runAllTimersAsync();await task;
    expect(api.getRecord().status).toBe('partial');expect(api.getRecord().predocs[0].status).toBe('missing');
    expect(screenshots).toHaveBeenCalledTimes(3);expect(confirm).not.toHaveBeenCalled();
    expect(document.querySelector('[role="status"]')).toHaveTextContent('Captura parcial');
  });
  it('cancelamento durante AJAX interrompe a coleta e restaura a aba',async()=>{
    const api=(window as TestWindow).__siagesSiafiEvidence!;
    const task=api.start();document.querySelector<HTMLButtonElement>('[data-cancel]')!.click();
    await vi.runAllTimersAsync();await task;
    expect(api.getRecord().status).toBe('failed');expect(screenshots).not.toHaveBeenCalled();
    expect(document.getElementById(`${prefix}:abaDadosPagRecId`)).toHaveClass('btn-aba-dh-selecionada');
  });
  it('Escape cancela a coleta, restaura o DH e depois fecha o diálogo', async () => {
    const task = (window as TestWindow).__siagesSiafiEvidence!.start();
    expect(document.querySelector('[data-close]')).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.runAllTimersAsync(); await task;
    expect(screenshots).not.toHaveBeenCalled();
    expect(document.getElementById(`${prefix}:abaDadosPagRecId`)).toHaveClass('btn-aba-dh-selecionada');
    expect(document.querySelector('[data-close]')).not.toBeDisabled();
    fireEvent.keyDown(document.querySelector('[data-close]')!, { key: 'Escape' });
    expect(document.getElementById('siages-siafi-evidence')).toHaveAttribute('hidden');
  });
  it('mantém o foco no diálogo e libera o formulário ao clicar no fundo', async () => {
    const task = (window as TestWindow).__siagesSiafiEvidence!.start();
    await vi.runAllTimersAsync(); await task;
    const close = document.querySelector<HTMLButtonElement>('[data-close]')!;
    const last = document.querySelector<HTMLAnchorElement>('#siages-siafi-evidence a:last-child')!;
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.click(document.getElementById('siages-siafi-evidence')!);
    expect(document.getElementById('siages-siafi-evidence')).toHaveAttribute('hidden');
  });
});
