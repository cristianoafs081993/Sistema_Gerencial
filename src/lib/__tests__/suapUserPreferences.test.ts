import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type ForwardShortcut = { shortcut: string; title: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string };
type UploadShortcut = { shortcut: string; title: string; tipoConferencia: string; tipoDocumento: string; assunto: string };
type DocumentShortcut = { shortcut: string; title: string; templateId: string; assunto: string; texto: string };
type Preferences = { version: number; forwardShortcuts: ForwardShortcut[]; uploadShortcuts: UploadShortcut[]; documentShortcuts: DocumentShortcut[]; upload: Record<string, string>; despacho: Record<string, string>; hiddenSummaryBlocks: string[] };
type PreferencesApi = {
  STORAGE_KEY: string;
  MAX_FORWARD_SHORTCUTS: number;
  normalize: (raw: unknown) => Preferences;
  normalizeForwardShortcut: (raw: unknown) => ForwardShortcut;
  validateForwardShortcut: (item: ForwardShortcut, others?: Array<{ shortcut: string }>) => string;
  validateUploadShortcut: (item: UploadShortcut, others?: Array<{ shortcut: string }>) => string;
  validateDocumentShortcut: (item: DocumentShortcut, others?: Array<{ shortcut: string }>) => string;
  normalizeDocumentShortcut: (raw: unknown) => DocumentShortcut;
  allShortcuts: (preferences: Preferences) => Array<{ shortcut: string; kind: string; index: number }>;
  documentContentHtml: (text: string) => string;
  uploadTitle: (item: Partial<UploadShortcut>) => string;
  documentTitle: (item: Partial<DocumentShortcut>) => string;
  forwardTitle: (item: ForwardShortcut) => string;
  despachoModelo: (raw: unknown) => Record<string, string> | null;
  load: (storage: { get: (key: string) => Promise<Record<string, unknown>> }) => Promise<Preferences>;
  save: (raw: unknown, storage: { set: (value: Record<string, unknown>) => Promise<void> }) => Promise<Preferences>;
};

let api: PreferencesApi;
const forward = (overrides: Partial<ForwardShortcut> = {}) => ({
  shortcut: 'encfin', title: '', despacho: 'Para pagamento.', campus: { id: '3', text: 'CN' }, setor: { id: '900', text: 'COFIN/CN' }, papel: 'CONTADOR', ...overrides,
});

beforeAll(() => {
  window.eval(readFileSync(extensionFixturePath('user-preferences.js'), 'utf8'));
  api = (globalThis as unknown as { SiagesUserPreferences: PreferencesApi }).SiagesUserPreferences;
});

describe('preferências do servidor na extensão', () => {
  it('começa com o encdg da DG/CN e os valores atuais do upload, sem textos de despacho personalizados', () => {
    const preferences = api.normalize(null);
    expect(preferences.forwardShortcuts).toEqual([{
      shortcut: 'encdg',
      title: 'Encaminhar à DG para Autorização de Pagamento',
      despacho: 'Ao Diretor geral para autorização de pagamento',
      campus: { id: '3', text: 'CN' },
      setor: { id: '841', text: 'DG/CN' },
      papel: 'ASSISTENTE EM ADMINISTRACAO',
    }]);
    expect(preferences.uploadShortcuts).toEqual([{ shortcut: 'up', title: 'Upload de liquidação', tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação' }]);
    expect(preferences.upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação' });
    expect(preferences.documentShortcuts).toEqual([]);
    expect(api.despachoModelo(preferences)).toBeNull();
  });

  it('mantém a lista vazia quando o servidor remove todos os atalhos', () => {
    expect(api.normalize({ forwardShortcuts: [] }).forwardShortcuts).toEqual([]);
  });

  it('normaliza o atalho e descarta itens inválidos, duplicados ou além do limite', () => {
    const many = Array.from({ length: 20 }, (_, index) => forward({ shortcut: `enc${'abcdefghijklmnopqrstu'[index]}x` }));
    const preferences = api.normalize({
      forwardShortcuts: [
        forward({ shortcut: ' EncFin ', despacho: '  Linha 1  \r\n\r\n\r\n  Linha   2 ' }),
        forward({ shortcut: 'encfin' }),
        forward({ shortcut: 'upload' }),
        forward({ shortcut: 'enc2' }),
        forward({ shortcut: 'encsem', setor: null }),
        ...many,
      ],
    });
    expect(preferences.forwardShortcuts[0]).toMatchObject({ shortcut: 'encfin', despacho: 'Linha 1\n\nLinha 2' });
    expect(preferences.forwardShortcuts.map((item) => item.shortcut)).not.toContain('upload');
    expect(preferences.forwardShortcuts.map((item) => item.shortcut)).not.toContain('enc2');
    expect(preferences.forwardShortcuts.filter((item) => item.shortcut === 'encfin')).toHaveLength(1);
    expect(preferences.forwardShortcuts).toHaveLength(api.MAX_FORWARD_SHORTCUTS);
  });

  it('explica por que um atalho não pode ser salvo', () => {
    const others = [api.normalizeForwardShortcut(forward())];
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward({ shortcut: 'e' })))).toContain('2 a 15 letras');
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward({ shortcut: 'encs' })))).toContain('já é um comando da paleta');
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward()), others)).toContain('já está em uso');
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward({ campus: null })))).toContain('campus');
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward({ setor: { id: 'abc', text: 'X' } })))).toContain('setor');
    expect(api.validateForwardShortcut(api.normalizeForwardShortcut(forward()))).toBe('');
  });

  it('usa o setor no nome quando o servidor não define um título', () => {
    expect(api.forwardTitle(api.normalizeForwardShortcut(forward()))).toBe('Encaminhar para COFIN/CN');
    expect(api.forwardTitle(api.normalizeForwardShortcut(forward({ title: 'Mandar à COFIN' })))).toBe('Mandar à COFIN');
  });

  it('envia ao SIAGES só os textos de despacho personalizados', () => {
    expect(api.despachoModelo({ despacho: { destinatario: ' À COFIN do Campus {campus} ', assunto: '', fecho: 'Respeitosamente,' } })).toEqual({
      destinatario: 'À COFIN do Campus {campus}',
      fecho: 'Respeitosamente,',
    });
  });

  it('lê e grava em chrome.storage.sync e recusa conteúdo acima de 8 KB', async () => {
    const store: Record<string, unknown> = {};
    const storage = {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(store, value); }),
    };
    const saved = await api.save({ forwardShortcuts: [forward()], upload: { tipoDocumento: 'Nota Fiscal' } }, storage);
    expect(storage.set).toHaveBeenCalledWith({ [api.STORAGE_KEY]: saved });
    expect((await api.load(storage)).upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota Fiscal', assunto: 'Liquidação' });

    const huge = Array.from({ length: 10 }, (_, index) => forward({ shortcut: `enc${'abcdefghij'[index]}z`, despacho: 'x'.repeat(1900) }));
    await expect(api.save({ forwardShortcuts: huge }, storage)).rejects.toThrow('limite de 8 KB');
  });

  it('transforma o upload único antigo no atalho "up" e usa o primeiro upload como padrão', () => {
    const legacy = api.normalize({ upload: { tipoDocumento: 'Nota Fiscal' } });
    expect(legacy.uploadShortcuts).toEqual([{ shortcut: 'up', title: 'Upload de liquidação', tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota Fiscal', assunto: 'Liquidação' }]);

    const custom = api.normalize({
      uploadShortcuts: [
        { shortcut: 'upnf', title: 'Nota fiscal', tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota Fiscal', assunto: '' },
        { shortcut: 'upsem', tipoDocumento: '' },
        { shortcut: 'upnf', tipoDocumento: 'Duplicado' },
      ],
      upload: { tipoDocumento: 'Ignorado' },
    });
    expect(custom.uploadShortcuts.map((item) => item.shortcut)).toEqual(['upnf']);
    expect(custom.upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Nota Fiscal', assunto: '' });
    expect(api.uploadTitle({ tipoDocumento: 'Nota Fiscal' })).toBe('Upload: Nota Fiscal');
    expect(api.normalize({ uploadShortcuts: [] }).upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação' });
  });

  it('valida atalhos de documento e não repete atalho entre as três listas', () => {
    const doc = (overrides = {}) => api.normalizeDocumentShortcut({ shortcut: 'despliq', title: '', templateId: '1026154', assunto: 'Liquidação', texto: 'Texto', ...overrides });
    expect(api.validateDocumentShortcut(doc())).toBe('');
    expect(api.validateDocumentShortcut(doc({ templateId: 'abc' }))).toContain('ID do documento modelo');
    expect(api.validateDocumentShortcut(doc({ assunto: '' }))).toContain('assunto');
    expect(api.validateDocumentShortcut(doc({ shortcut: 'desp' }))).toContain('já é um comando da paleta');
    expect(api.documentTitle(doc())).toBe('Documento: Liquidação');

    const preferences = api.normalize({
      forwardShortcuts: [forward({ shortcut: 'encfin' })],
      uploadShortcuts: [{ shortcut: 'encfin', tipoDocumento: 'Nota' }, { shortcut: 'up', tipoDocumento: 'Liquidação' }],
      documentShortcuts: [doc({ shortcut: 'up' }), doc()],
    });
    expect(preferences.uploadShortcuts.map((item) => item.shortcut)).toEqual(['up']);
    expect(preferences.documentShortcuts.map((item) => item.shortcut)).toEqual(['despliq']);
    expect(api.allShortcuts(preferences)).toEqual([
      { shortcut: 'encfin', kind: 'forward', index: 0 },
      { shortcut: 'up', kind: 'upload', index: 0 },
      { shortcut: 'despliq', kind: 'document', index: 0 },
    ]);
    expect(api.validateUploadShortcut({ shortcut: 'despliq', title: '', tipoConferencia: '', tipoDocumento: 'Nota', assunto: '' }, api.allShortcuts(preferences))).toContain('já está em uso');
  });

  it('reconhece o encdg de fábrica e monta o encdg da DG de outro campus', () => {
    const prefs = api as unknown as {
      campusSiglaForUasg: (uasg: string) => string;
      isCampusDefaultForward: (item: unknown) => boolean;
      campusDefaultForward: (campus: unknown, setor: unknown) => ForwardShortcut;
    };
    expect(prefs.campusSiglaForUasg('158366')).toBe('CN');
    expect(prefs.campusSiglaForUasg('158365')).toBe('MO');
    expect(prefs.campusSiglaForUasg('158155')).toBe('');
    const mossoro = prefs.campusDefaultForward({ id: '9', text: 'MO' }, { id: '1500', text: 'DG/MO' });
    expect(mossoro).toMatchObject({ shortcut: 'encdg', title: 'Encaminhar à DG para Autorização de Pagamento', campus: { id: '9', text: 'MO' }, setor: { id: '1500', text: 'DG/MO' } });
    expect(prefs.isCampusDefaultForward(api.normalize(null).forwardShortcuts[0])).toBe(true);
    expect(prefs.isCampusDefaultForward(mossoro)).toBe(true);
    expect(prefs.isCampusDefaultForward({ ...mossoro, title: 'Outro nome' })).toBe(false);
    expect(prefs.isCampusDefaultForward({ ...mossoro, setor: { id: '900', text: 'COFIN/MO' } })).toBe(false);
  });

  it('converte o texto do documento em parágrafos HTML seguros para o editor do SUAP', () => {
    expect(api.documentContentHtml('À Direção-Geral.\n\nValor <R$ 10>\nlinha 2')).toBe('<p>À Direção-Geral.</p><p>Valor &lt;R$ 10&gt;<br>linha 2</p>');
    expect(api.documentContentHtml('')).toBe('');
  });

  it('guarda dos modelos de despacho só o que difere do padrão e envia ao SIAGES', () => {
    const prefs = api as unknown as {
      despachoTemplate: (raw: unknown, finalidade: string) => Record<string, string>;
      isDespachoCustomized: (raw: unknown, finalidade: string) => boolean;
    };
    const padraoPafe = prefs.despachoTemplate(null, 'pafe');
    const normalized = api.normalize({
      despachoModelos: {
        pafe: { ...padraoPafe, corpo: '  PAFE {valor}  ' },
        servico: { ...prefs.despachoTemplate(null, 'servico') },
        inexistente: { corpo: 'x' },
      },
    }) as unknown as { despachoModelos: Record<string, Record<string, string>> };
    expect(normalized.despachoModelos).toEqual({ pafe: { corpo: 'PAFE {valor}' } });
    expect(prefs.despachoTemplate(normalized, 'pafe')).toEqual({ ...padraoPafe, corpo: 'PAFE {valor}' });
    expect(prefs.isDespachoCustomized(normalized, 'pafe')).toBe(true);
    expect(prefs.isDespachoCustomized(normalized, 'servico')).toBe(false);
    expect(api.despachoModelo(normalized)).toEqual({ modelos: { pafe: { corpo: 'PAFE {valor}' } } });
    expect(api.despachoModelo(null)).toBeNull();
  });

  it('guarda só os blocos do Resumo conhecidos que o servidor ocultou', () => {
    expect(api.normalize(null).hiddenSummaryBlocks).toEqual([]);
    expect(api.normalize({ hiddenSummaryBlocks: ['lista-credores', 'inexistente', 'conclusao', 'conclusao'] }).hiddenSummaryBlocks).toEqual(['conclusao', 'lista-credores']);
    // O bloco "Processo" saiu do Resumo (o número é copiado no título da página); preferência antiga é descartada.
    expect(api.normalize({ hiddenSummaryBlocks: ['processo'] }).hiddenSummaryBlocks).toEqual([]);
    expect(api.normalize({ hiddenSummaryBlocks: 'processo' }).hiddenSummaryBlocks).toEqual([]);
  });

  it('volta aos padrões quando o armazenamento falha', async () => {
    const preferences = await api.load({ get: vi.fn().mockRejectedValue(new Error('indisponível')) });
    expect(preferences.forwardShortcuts[0].shortcut).toBe('encdg');
  });
});
