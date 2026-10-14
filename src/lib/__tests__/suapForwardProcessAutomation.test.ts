import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type ForwardPayload = { suapId: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string };
type ForwardWindow = typeof window & {
  __SIAGES_SUAP_FORWARD_TEST__?: boolean;
  __siagesForwardProcessLoaded?: boolean;
  __siagesForwardProcess?: { parsePayloadFromHash: (hash: string) => ForwardPayload | null; run: (payload: ForwardPayload) => Promise<boolean> };
};

const payload = {
  source: 'siages',
  version: 1,
  action: 'suap_forward_process',
  suapId: '501333',
  despacho: 'Ao Diretor geral para autorização de pagamento',
  campus: { id: '3', text: 'CN' },
  setor: { id: '841', text: 'DG/CN' },
  papel: 'ASSISTENTE EM ADMINISTRACAO',
};

// Form as served by SUAP before select2 picks a sector: campus preselected, sector empty.
const formHtml = `
  <form id="tramite_formencaminharparasetor" method="POST">
    <textarea name="despacho_corpo" id="id_despacho_corpo"></textarea>
    <input type="radio" name="tipo_busca_setor" value="autocompletar" id="id_tipo_busca_setor_0">
    <input type="radio" name="tipo_busca_setor" value="arvore" id="id_tipo_busca_setor_1" checked>
    <select id="destinatario_uo_gA86BUQ87k" name="destinatario_uo"><option value="3" selected>CN</option></select>
    <select id="destinatario_setor_autocompletar_kgt6L3SgkV" name="destinatario_setor_autocompletar"></select>
    <select name="papel" id="id_papel">
      <option value="" selected>---------</option>
      <option value="19532">ASSISTENTE EM ADMINISTRACAO</option>
      <option value="110853">DIRETOR(A) DE DIRETORIA - SUB-CHEFIA - DIAD/CN</option>
    </select>
    <input type="password" name="senha" id="id_senha">
  </form>`;

describe('automação do encaminhamento à DG/CN (encdg)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = formHtml;
    const testWindow = window as ForwardWindow;
    testWindow.__SIAGES_SUAP_FORWARD_TEST__ = true;
    delete testWindow.__siagesForwardProcessLoaded;
    window.eval(readFileSync(extensionFixturePath('forward-process-main.js'), 'utf8'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('lê somente payloads de encaminhamento do SIAGES no hash', () => {
    const api = (window as ForwardWindow).__siagesForwardProcess!;
    expect(api.parsePayloadFromHash(`#siagesEncaminhar=${encodeURIComponent(JSON.stringify(payload))}`)).toEqual({
      suapId: '501333',
      despacho: payload.despacho,
      campus: payload.campus,
      setor: payload.setor,
      papel: payload.papel,
    });
    expect(api.parsePayloadFromHash(`#siagesEncaminhar=${encodeURIComponent(JSON.stringify({ ...payload, action: 'suap_upload_document' }))}`)).toBeNull();
    expect(api.parsePayloadFromHash('#outro=1')).toBeNull();
  });

  it('preenche despacho, campus, setor e perfil sem tocar na senha', async () => {
    const api = (window as ForwardWindow).__siagesForwardProcess!;
    const parsed = api.parsePayloadFromHash(`#siagesEncaminhar=${encodeURIComponent(JSON.stringify(payload))}`)!;
    const sectorChanges = vi.fn();
    document.querySelector('[name="destinatario_setor_autocompletar"]')!.addEventListener('change', sectorChanges);

    const task = api.run(parsed);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(task).resolves.toBe(true);

    const form = document.getElementById('tramite_formencaminharparasetor') as HTMLFormElement;
    const data = new FormData(form);
    expect(data.get('despacho_corpo')).toBe('Ao Diretor geral para autorização de pagamento');
    expect(data.get('tipo_busca_setor')).toBe('autocompletar');
    expect(data.get('destinatario_uo')).toBe('3');
    expect(data.get('destinatario_setor_autocompletar')).toBe('841');
    expect(document.querySelector('[name="destinatario_setor_autocompletar"] option[value="841"]')).toHaveTextContent('DG/CN');
    expect(sectorChanges).toHaveBeenCalled();
    expect(data.get('papel')).toBe('19532');
    expect(data.get('senha')).toBe('');
    expect(document.activeElement).toBe(document.getElementById('id_senha'));
    expect(document.getElementById('siages-suap-forward-notice')).toHaveTextContent('Informe a senha');
  });

  it('avisa quando o perfil não existe para o usuário', async () => {
    const api = (window as ForwardWindow).__siagesForwardProcess!;
    const task = api.run({ ...api.parsePayloadFromHash(`#siagesEncaminhar=${encodeURIComponent(JSON.stringify(payload))}`)!, papel: 'PERFIL INEXISTENTE' });
    await vi.advanceTimersByTimeAsync(2000);
    await task;
    expect(document.getElementById('siages-suap-forward-notice')).toHaveTextContent('não encontrei perfil PERFIL INEXISTENTE');
    expect((document.getElementById('id_papel') as HTMLSelectElement).value).toBe('');
  });
});
