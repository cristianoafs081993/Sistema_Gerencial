import {readFileSync} from 'node:fs';
import {describe,expect,it,vi,afterEach} from 'vitest';
import {extensionFixturePath} from '@/test/extensionFixtures';
describe('conferência na extensão',()=>{
  afterEach(()=>{delete (globalThis as any).SiagesSiafiAnalysisBackground;delete (globalThis as any).SiagesSiafiAnalysis;vi.unstubAllGlobals();document.body.replaceChildren();});
  it('recusa frames, login e origens externas antes de acessar a conta',async()=>{
    new Function(readFileSync(extensionFixturePath('siafi-analysis-background.js'),'utf8'))();
    const api=(globalThis as any).SiagesSiafiAnalysisBackground,post=vi.fn(),open=vi.fn();
    for(const sender of [{url:'https://siafi.tesouro.gov.br/a',frameId:1},{url:'http://siafi.tesouro.gov.br/a',frameId:0},{url:'https://sso.acesso.gov.br/a',frameId:0}])await expect(api.handle({type:'prepare'},sender,post,open)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    await api.handle({type:'start',payload:{captura:{captureId:'fixture'}}},{url:'https://siafi.tesouro.gov.br/a',frameId:0},post,open);
    expect(post).toHaveBeenCalledWith({action:'start',captura:{captureId:'fixture'}});
  });
  it('oferece IA só depois da captura e não consulta o SIAGES até o clique',async()=>{
    const sendMessage=vi.fn((_message,callback)=>callback({ok:false,error:'Entre no SIAGES pelo popup'}));
    vi.stubGlobal('chrome',{runtime:{sendMessage}});
    new Function(readFileSync(extensionFixturePath('siafi-analysis.js'),'utf8'))();
    expect(document.body.children).toHaveLength(0);
    const dialog=document.createElement('div');dialog.innerHTML='<section></section>';document.body.appendChild(dialog);
    const record={captureId:'original',analysis:{status:'not_requested'}};
    (globalThis as any).SiagesSiafiAnalysis.attach(dialog,record);
    expect(sendMessage).not.toHaveBeenCalled();
    (dialog.querySelector('button') as HTMLButtonElement).click();
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(sendMessage.mock.calls[0][0]).toMatchObject({type:'prepare',payload:{captura:record}});
    expect(dialog.textContent).toContain('Entre no SIAGES');expect(record.analysis.status).toBe('not_requested');
  });
});
