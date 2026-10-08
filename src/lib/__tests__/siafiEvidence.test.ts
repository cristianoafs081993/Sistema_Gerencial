import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

const read = (name: string) => readFileSync(extensionFixturePath(name), 'utf8');
const form = 'form_manterDocumentoHabil';
type Field = { id: string; label: string; value: string | boolean; disabled: boolean };
type Core = {
  planTabs: (doc: Document) => Array<{ key: string; id: string }>;
  extract: (root: Element) => { fields: Field[]; tables: Array<{ rows: Array<Array<{ text: string }>> }>; text: string };
  documentIdentity: (doc: Document) => Record<string, string>;
  createRecord: (identity: unknown, source: string) => { source: string; schemaVersion: string; analysis: { status: string }; sections: unknown[] };
  predocs: (root: Element) => Array<{ filled: boolean; id: string }>;
  hasDeductions: (root: Element) => boolean;
};
function core() {
  const scope = { crypto: { randomUUID: () => 'capture-test' } } as unknown as { SiagesSiafiEvidenceCore: Core };
  new Function('globalThis', read('siafi-evidence-core.js'))(scope);
  return scope.SiagesSiafiEvidenceCore;
}
const tabs = [
  ['abaDadosBasicosId', 'Dados Básicos'], ['abaPrincipalComOrcamentoId', 'Principal Com Orçamento'],
  ['abaDeducaoId', 'Dedução'], ['abaDadosPagRecId', 'Dados de Pagamento'],
];
function page() {
  document.body.innerHTML = `<div id="divDH"><span id="${form}:ugEmitente_output">158366</span><span id="${form}:anoExercicioSiafi">2026</span>
    <span id="${form}:codigoTipoDocHabil_outputText">RP</span><span id="${form}:numeroDocumentoHabil_outputText">-</span>
    <div id="${form}:abasDocHabil">${tabs.map(([id, title]) => `<input type="button" class="btn-aba-dh ${id === 'abaDadosPagRecId' ? 'btn-aba-dh-selecionada' : ''}" id="${form}:${id}" value="${title}" ${id === 'abaDadosPagRecId' ? 'disabled' : ''}>`).join('')}<div id="content"></div></div></div>`;
}
beforeEach(page);
afterEach(() => vi.restoreAllMocks());
describe('dados estruturados de comprovantes SIAFI', () => {
  it('reconhece aba ativa desabilitada, rótulos reais e captura pagamento por último', () => {
    expect(core().planTabs(document).map(tab => tab.key)).toEqual(['dados-basicos', 'principal-orcamento', 'deducoes', 'dados-pagamento']);
  });
  it('inclui outras abas preenchidas sem capturar navegação Resumo', () => {
    document.getElementById(`${form}:abasDocHabil`)!.insertAdjacentHTML('afterbegin', `<input type="button" class="btn-aba-dh btn-aba-dh-pendente" id="${form}:abaEncargosId" value="Encargo">`);
    expect(core().planTabs(document).map(tab => tab.key)).toContain('abaEncargosId');
  });
  it('falha antes de navegar quando uma aba obrigatória não está disponível', () => {
    document.getElementById(`${form}:abaPrincipalComOrcamentoId`)!.remove();
    expect(() => core().planTabs(document)).toThrow(/principal-orcamento/);
  });
  it('preserva valores de inputs atuais, moedas, zeros de identificadores e campos repetidos', () => {
    const root = document.getElementById('content')!;
    root.innerHTML = `<label for="valor0">Valor</label><input id="valor0" value="1.000,00"><label for="valor1">Valor</label><input id="valor1" value="4.000,00" disabled>
      <label for="credor">Credor</label><span id="credor_outputText">00000000000191</span><label for="obs">Observação</label><textarea id="obs">Texto inicial</textarea>`;
    (document.getElementById('obs') as HTMLTextAreaElement).value = 'Bolsa setembro; texto atualizado';
    const data = core().extract(root);
    expect(data.fields.filter(field => field.label === 'Valor').map(field => field.value)).toEqual(['1.000,00', '4.000,00']);
    expect(data.fields).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Credor', value: '00000000000191' }), expect.objectContaining({ label: 'Observação', value: 'Bolsa setembro; texto atualizado' })]));
  });
  it('não exporta ViewState, senha, campos ocultos, calendários ou detalhes recolhidos', () => {
    const root = document.getElementById('content')!;
    root.innerHTML = '<input type="hidden" name="javax.faces.ViewState" value="TOKEN"><input type="password" value="SENHA"><div style="display:none"><label for="oculto">Oculto</label><input id="oculto" value="SEGREDO"></div><label for="visivel">Campo</label><input id="visivel" value="OK">';
    expect(JSON.stringify(core().extract(root))).not.toMatch(/TOKEN|SENHA|SEGREDO/);
  });
  it('extrai classificação contábil sem atributo for e não mistura colunas de tabelas', () => {
    const root = document.getElementById('content')!;
    root.innerHTML = '<div class="unitGroup"><div class="unitLabel"><label>VPD de Incentivos à Educação</label></div><div class="unitData"><span>3.9.4.1.1.01.00</span></div></div><table><thead><tr><th>Favorecido</th><th>Valor</th></tr></thead><tbody><tr><td>RB0000050</td><td>4.000,00</td></tr></tbody></table>';
    const data = core().extract(root);
    expect(data.fields).toContainEqual(expect.objectContaining({ label: 'VPD de Incentivos à Educação', value: '3.9.4.1.1.01.00' }));
    expect(data.tables[0].rows[0].map(cell => cell.text)).toEqual(['RB0000050', '4.000,00']);
  });
  it('distingue pré-doc preenchido e ausente sem abri-los ou preencher valores', () => {
    const root = document.getElementById('content')!;
    root.innerHTML = `<table><tbody><tr><td>PIX</td><td><input type="button" id="${form}:lista_DPgtoOB:0:btnPredoc" class="checked"></td></tr><tr><td>Dedução</td><td><input type="button" id="${form}:lista_Deducoes:1:btnPredoc"></td></tr></tbody></table>`;
    expect(core().predocs(root).map(entry => entry.filled)).toEqual([true, false]);
    expect(core().hasDeductions(root)).toBe(true);
    root.innerHTML = `<input id="${form}:campo_situacao_input"><input type="button" value="Confirmar">`;
    expect(core().hasDeductions(root)).toBe(false);
  });
  it('identifica RP sem número e elimina query, usuário e fragmento da URL', () => {
    const api = core();
    const identity = api.documentIdentity(document);
    expect(identity).toEqual({ ug: '158366', year: '2026', type: 'RP', number: '-' });
    const record = api.createRecord(identity, 'https://siafi.tesouro.gov.br/siafi2026/incdh.jsf?usuario=SESSAO#token');
    expect(record.source).toBe('https://siafi.tesouro.gov.br/siafi2026/incdh.jsf');
    expect(record.analysis.status).toBe('not_requested');
    expect(JSON.stringify(record)).not.toContain('SESSAO');
  });
});

type Reply = { ok: boolean; dataUrl?: string; error?: string };
function worker() {
  let listener: (message: unknown, sender: unknown, respond: (reply: Reply) => void) => unknown;
  const chrome = { runtime: { onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,SCREENSHOT') } };
  new Function('chrome', read('siafi-evidence-background.js'))(chrome);
  const sender = { url: 'https://siafi.tesouro.gov.br/siafi2026/incdh.jsf?usuario=private', frameId: 0, tab: { id: 7, windowId: 2 } };
  return { chrome, sender, send: (override = {}) => new Promise<Reply>(resolve => listener({ source: 'siages-siafi-evidence', type: 'capture' }, { ...sender, ...override }, resolve)) };
}
describe('captura nativa no worker SIAFI', () => {
  it('usa a imagem real do navegador e o windowId do remetente', async () => {
    const instance = worker();
    await expect(instance.send()).resolves.toEqual({ ok: true, dataUrl: 'data:image/png;base64,SCREENSHOT' });
    expect(instance.chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(2, { format: 'png' });
  });
  it.each([{ url: 'https://evil.test/' }, { frameId: 1 }, { tab: null }])('recusa remetente não autorizado %o', async override => {
    const instance = worker();
    await expect(instance.send(override)).resolves.toMatchObject({ ok: false });
    expect(instance.chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('não captura outra aba, inclusive quando ela muda durante a espera', async () => {
    const instance = worker();
    instance.chrome.tabs.query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 8 }]);
    await expect(instance.send()).resolves.toMatchObject({ ok: false });
    expect(instance.chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('propaga erros de permissão sem devolver uma captura vazia', async () => {
    const instance = worker(); instance.chrome.tabs.captureVisibleTab.mockRejectedValue(new Error('Permissão negada'));
    await expect(instance.send()).resolves.toEqual({ ok: false, error: 'Permissão negada' });
  });
});

describe('PDF local com capturas', () => {
  it('gera xref e tamanhos binários corretos para mais de uma imagem JPEG', () => {
    const scope = {} as { SiagesSiafiEvidencePdf: { buildPdf: (pages: unknown[], record: unknown) => Uint8Array } };
    new Function('globalThis', read('siafi-evidence-pdf.js'))(scope);
    const pdf = scope.SiagesSiafiEvidencePdf.buildPdf([
      { title: 'Dados Básicos', width: 1200, height: 700, jpeg: new Uint8Array([255, 216, 0, 255, 217]) },
      { title: 'Pré-doc', width: 800, height: 600, jpeg: new Uint8Array([255, 216, 1, 255, 217]) },
    ], { document: { ug: '158366', year: '2026', type: 'RP', number: '-' }, startedAt: '2026-10-08', status: 'complete' });
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text).toContain('/Type /Pages /Count 2'); expect(text).toContain('/Filter /DCTDecode /Length 5');
    expect(text).not.toContain('SIAFI'); expect(text).not.toContain('Captura de tela para conferencia'); expect(text).not.toContain('/Font');
    expect(text).toMatch(/ 0 0 cm \/Im0 Do Q/);
    expect(text).toMatch(/\/MediaBox \[0 0 841\.89 491\.10/);
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(new TextDecoder().decode(pdf.slice(xref, xref + 4))).toBe('xref');
    const objectCount = Number(text.match(/xref\n0 (\d+)/)![1]);
    const entries = text.slice(xref).split('\n').slice(3, 3 + objectCount - 1);
    entries.forEach((entry, index) => { const offset = Number(entry.slice(0, 10)); expect(new TextDecoder().decode(pdf.slice(offset, offset + `${index + 1} 0 obj`.length))).toBe(`${index + 1} 0 obj`); });
  });
});
