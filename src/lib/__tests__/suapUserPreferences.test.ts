import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type ForwardShortcut = { shortcut: string; title: string; despacho: string; campus: { id: string; text: string } | null; setor: { id: string; text: string } | null; papel: string };
type Preferences = { version: number; forwardShortcuts: ForwardShortcut[]; upload: Record<string, string>; despacho: Record<string, string>; hiddenSummaryBlocks: string[] };
type PreferencesApi = {
  STORAGE_KEY: string;
  MAX_FORWARD_SHORTCUTS: number;
  normalize: (raw: unknown) => Preferences;
  normalizeForwardShortcut: (raw: unknown) => ForwardShortcut;
  validateForwardShortcut: (item: ForwardShortcut, others?: ForwardShortcut[]) => string;
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
    expect(preferences.upload).toEqual({ tipoConferencia: 'Cópia Simples', tipoDocumento: 'Liquidação', assunto: 'Liquidação' });
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
        forward({ shortcut: 'up' }),
        forward({ shortcut: 'enc2' }),
        forward({ shortcut: 'encsem', setor: null }),
        ...many,
      ],
    });
    expect(preferences.forwardShortcuts[0]).toMatchObject({ shortcut: 'encfin', despacho: 'Linha 1\n\nLinha 2' });
    expect(preferences.forwardShortcuts.map((item) => item.shortcut)).not.toContain('up');
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
