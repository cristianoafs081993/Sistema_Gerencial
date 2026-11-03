import { readFileSync } from 'node:fs';

import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

const commandPalette = readFileSync(extensionFixturePath('command-palette.js'), 'utf8');
const originalLocationDescriptor=Object.getOwnPropertyDescriptor(window,'location');
type Entry = { captureId: string; capturedAt?: string; day?: string; code: string | null; source: string; valueCents: number | null; warning?: string };
type Api = {
  buildEntry: (record: unknown) => Entry;
  aggregate: (entries: Entry[]) => Array<{ code: string; source: string; valueCents: number; captures: number }>;
  parseCents: (value: unknown) => number | null;
  getEntries: () => Entry[];
  day: (value?: string | Date) => string | null;
  days: () => string[];
  retain: (entries: Entry[]) => Entry[];
  remember: (record: unknown) => Promise<void>;
  show: () => void;
  destroy: () => void;
};

function helper() {
  delete (window as typeof window & { __suapeCommandPaletteLoaded?: boolean }).__suapeCommandPaletteLoaded;
  window.eval(commandPalette);
  return (window as typeof window & { __suapeSolrecfin: Api }).__suapeSolrecfin;
}

function record(fields: Array<{ label: string; value: string }>, overrides: Record<string, unknown> = {}) {
  return {
    captureId: 'capture-1',
    finishedAt: '2026-10-14T12:00:00.000Z',
    document: { year: '2026', type: 'NP', number: '123' },
    sections: [{ key: 'dados-basicos', title: 'Dados Básicos', fields, tables: [], text: '' }],
    ...overrides,
  };
}

beforeEach(() => {
  Object.defineProperty(window,'location',{configurable:true,value:{protocol:'https:',hostname:'siafi.tesouro.gov.br',pathname:'/siafiweb/dh',href:'https://siafi.tesouro.gov.br/siafiweb/dh'}});
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
});

afterEach(() => {
  (window as typeof window & { __suapeSolrecfin?: Api }).__suapeSolrecfin?.destroy();
  vi.useRealTimers();
  document.body.innerHTML = '';
  delete (window as typeof window & { __suapeCommandPaletteLoaded?: boolean }).__suapeCommandPaletteLoaded;
  window.localStorage.removeItem('siages_solrecfin_entries');
  if(originalLocationDescriptor)Object.defineProperty(window,'location',originalLocationDescriptor);
});

describe('solrecfin da extensão SIAFI', () => {
  it('converte moeda brasileira e separa empenho do exercício e RAP', () => {
    const api = helper();
    expect(api.parseCents('R$ 4.000,50')).toBe(400050);
    const exe = api.buildEntry(record([
      { label: 'Valor do Documento', value: '4.000,50' },
      { label: 'Empenho', value: '2026NE000123' },
      { label: 'PTRES', value: '230446' },
    ]));
    expect(exe).toMatchObject({ code: 'EXE001', source: '1333000000', valueCents: 400050, empenho: '2026NE000123', ptres: '230446' });

    const rap = api.buildEntry(record([
      { label: 'Valor do Documento', value: '1.200,00' },
      { label: 'Empenho', value: '2025NE000123' },
      { label: 'PTRES', value: '230000' },
    ]));
    expect(rap).toMatchObject({ code: 'RAP001', source: '1000000000', valueCents: 120000 });
  });

  it('agrega somente capturas identificadas pelo código e fonte, preservando pendências', () => {
    const api = helper();
    const entries = [
      { captureId: 'a', code: 'EXE001', source: '1000000000', valueCents: 10000 },
      { captureId: 'b', code: 'EXE001', source: '1000000000', valueCents: 2500 },
      { captureId: 'c', code: 'RAP001', source: '1000000000', valueCents: 8000 },
      { captureId: 'd', code: null, source: '1000000000', valueCents: 7000, warning: 'Empenho não identificado' },
    ];
    expect(api.aggregate(entries)).toEqual([
      { code: 'EXE001', source: '1000000000', valueCents: 12500, captures: 2 },
      { code: 'RAP001', source: '1000000000', valueCents: 8000, captures: 1 },
    ]);
  });

  it('registra automaticamente cada captura concluída no acumulador local', async () => {
    const api = helper();
    window.dispatchEvent(new CustomEvent('siages-siafi-capture-complete', {
      detail: { record: record([{ label: 'Valor do Documento', value: '80,00' }, { label: 'Empenho', value: '2026NE000001' }]) },
    }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.getEntries()).toHaveLength(1);
    expect(api.getEntries()[0]).toMatchObject({ code: 'EXE001', valueCents: 8000 });
  });
  it('consulta global não aceita evento de captura disparado por outro sistema',async()=>{
    Object.defineProperty(window,'location',{configurable:true,value:{protocol:'https:',hostname:'outro-sistema.example',pathname:'/',href:'https://outro-sistema.example/'}});
    const api=helper();
    window.dispatchEvent(new CustomEvent('siages-siafi-capture-complete',{detail:{record:record([{label:'Valor do Documento',value:'80,00'},{label:'Empenho',value:'2026NE000001'}])}}));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(api.getEntries()).toHaveLength(0);
  });

  it('usa meia-noite de Brasília e mantém exatamente hoje e os seis dias anteriores', () => {
    const api = helper();
    expect(api.day('2026-10-15T02:59:59Z')).toBe('2026-10-14');
    expect(api.day('2026-10-15T03:00:00Z')).toBe('2026-10-15');
    expect(api.days()).toEqual(['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08']);
    const base = { code: 'EXE001', source: '1000000000', valueCents: 10000 };
    expect(api.retain([
      { ...base, captureId: 'hoje', capturedAt: '2026-10-14T12:00:00Z' },
      { ...base, captureId: 'limite', capturedAt: '2026-10-08T12:00:00Z' },
      { ...base, captureId: 'antigo', capturedAt: '2026-10-07T12:00:00Z' },
      { ...base, captureId: 'invalido', capturedAt: 'data inválida' },
    ]).map(entry => entry.captureId)).toEqual(['hoje', 'limite']);
  });

  it('zera o dia na virada com diálogo aberto e mantém os valores de ontem consultáveis', async () => {
    vi.setSystemTime(new Date('2026-10-15T02:59:59Z'));
    const api = helper();
    await api.remember(record([{ label: 'Valor do Documento', value: '80,00' }, { label: 'Empenho', value: '2026NE000001' }], {
      finishedAt: '2026-10-15T02:59:59Z',
    }));
    api.show();
    expect(document.querySelector('[data-solrecfin-count]')).toHaveTextContent('1');
    expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('80,00');
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector<HTMLSelectElement>('[data-solrecfin-day]')?.value).toBe('2026-10-15');
    expect(document.querySelector('[data-solrecfin-count]')).toHaveTextContent('0');
    expect(document.querySelector('.suape-cp-detail-table')).toBeNull();
    fireEvent.change(document.querySelector('[data-solrecfin-day]')!, { target: { value: '2026-10-14' } });
    expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('80,00');
    expect(document.querySelector('[data-solrecfin-clear]')).toBeNull();
  });

  it('preserva histórico ao reabrir e limpar somente o dia atual', async () => {
    window.localStorage.setItem('siages_solrecfin_entries', JSON.stringify([
      { captureId: 'ontem', capturedAt: '2026-10-13T12:00:00Z', code: 'RAP001', source: '1000000000', valueCents: 9000 },
    ]));
    const api = helper();
    await api.remember(record([{ label: 'Valor do Documento', value: '80,00' }, { label: 'Empenho', value: '2026NE000001' }]));
    api.show();
    fireEvent.click(document.querySelector('[data-solrecfin-clear]')!);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.querySelector('[data-solrecfin-count]')).toHaveTextContent('0');
    expect(JSON.parse(window.localStorage.getItem('siages_solrecfin_entries')!).map((entry: Entry) => entry.captureId)).toEqual(['ontem']);
    fireEvent.change(document.querySelector('[data-solrecfin-day]')!, { target: { value: '2026-10-13' } });
    expect(document.querySelector('.suape-cp-detail-table')).toHaveTextContent('90,00');
  });

  it('detalha exatamente as capturas do código, fonte e dia selecionados, com subtotal e recolhimento', async () => {
    const api = helper();
    const capture = (captureId: string, number: string, value: string, empenho: string, ptres = '230000', finishedAt = '2026-10-14T12:00:00Z') => api.remember(record([
      { label: 'Valor do Documento', value }, { label: 'Empenho', value: empenho }, { label: 'PTRES', value: ptres },
    ], { captureId, document: { year: '2026', type: 'RP', number }, finishedAt }));
    await capture('a', '101', '100,25', '2026NE000001');
    await capture('b', '102', '20,50', '2026NE000002');
    await capture('rap', '103', '30,00', '2025NE000003');
    await capture('especial', '104', '40,00', '2026NE000004', '230446');
    await capture('ontem', '105', '50,00', '2026NE000005', '230000', '2026-10-13T12:00:00Z');
    await api.remember(record([{ label: 'Valor do Documento', value: '900,00' }], { captureId: 'pendente', document: { year: '2026', type: 'NP', number: '999' } }));
    api.show();

    const buttons = document.querySelectorAll<HTMLButtonElement>('[data-solrecfin-toggle]');
    expect(buttons).toHaveLength(3);
    const summaryRow = document.querySelector('[data-solrecfin-row]')!;
    expect(summaryRow.children).toHaveLength(3);
    expect(document.querySelectorAll('.suape-cp-detail-table')[0].querySelector('thead tr')?.children).toHaveLength(3);
    const button = buttons[0];
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(panel).not.toBeVisible();
    expect(button).toHaveTextContent('EXE001');
    expect(button).toHaveTextContent('2 capturas');
    // Clicking the source cell expands the row, not only the disclosure icon.
    fireEvent.click(summaryRow.children[1]);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAccessibleName('Recolher NPs/RPs de EXE001, fonte 1000000000');
    expect(panel).toBeVisible();
    const rows = panel.querySelectorAll('.suape-cp-solrecfin-documents > tbody > tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('2026 RP 101');
    expect(rows[0]).toHaveTextContent('2026NE000001');
    expect(rows[0]).toHaveTextContent('230000');
    expect(rows[0]).toHaveTextContent('09:00:00');
    expect(rows[0]).toHaveTextContent('100,25');
    expect(rows[1]).toHaveTextContent('2026 RP 102');
    expect(panel.querySelector('tfoot')).toHaveTextContent('Subtotal (2 capturas)');
    expect(panel.querySelector('tfoot')).toHaveTextContent('120,75');
    for (const excluded of ['2026 RP 103', '2026 RP 104', '2026 RP 105', '2026 NP 999']) expect(panel).not.toHaveTextContent(excluded);
    expect(document.querySelector('[data-solrecfin-count]')).toHaveTextContent('5');
    fireEvent.click(summaryRow.children[2]);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAccessibleName('Expandir NPs/RPs de EXE001, fonte 1000000000');
    expect(panel).not.toBeVisible();

    fireEvent.click(button.querySelector('.suape-cp-solrecfin-chevron')!);
    expect(panel).toBeVisible();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(button);
    expect(panel).not.toBeVisible();

    fireEvent.click(buttons[1]);
    expect(document.getElementById(buttons[1].getAttribute('aria-controls')!)).toHaveTextContent('2026 RP 104');
    fireEvent.click(buttons[2]);
    expect(document.getElementById(buttons[2].getAttribute('aria-controls')!)).toHaveTextContent('2026 RP 103');

    fireEvent.change(document.querySelector('[data-solrecfin-day]')!, { target: { value: '2026-10-13' } });
    const historicalButton = document.querySelector('[data-solrecfin-toggle]')!;
    fireEvent.click(historicalButton);
    const historicalPanel = document.getElementById(historicalButton.getAttribute('aria-controls')!)!;
    expect(historicalPanel.querySelectorAll('.suape-cp-solrecfin-documents > tbody > tr')).toHaveLength(1);
    expect(historicalPanel).toHaveTextContent('2026 RP 105');
    expect(historicalPanel.querySelector('tfoot')).toHaveTextContent('50,00');
    expect(document.querySelector('[data-solrecfin-clear]')).toBeNull();
  });

  it('reabre dados persistidos, preserva capturas repetidas e apresenta documentos legados sem inventar identificação', async () => {
    window.localStorage.setItem('siages_solrecfin_entries', JSON.stringify([
      { captureId: 'a', capturedAt: '2026-10-14T12:00:00Z', code: 'EXE001', source: '1000000000', valueCents: 1000, document: '2026 NP 123' },
      { captureId: 'b', capturedAt: '2026-10-14T13:00:00Z', code: 'EXE001', source: '1000000000', valueCents: 1000, document: '2026 NP 123' },
      { captureId: 'legado', capturedAt: '2026-10-14T14:00:00Z', code: 'EXE001', source: '1000000000', valueCents: 500 },
      { captureId: 'html', capturedAt: '2026-10-14T14:00:00Z', code: 'EXE001', source: '1000000000', valueCents: 500, document: '<img src=x onerror=alert(1)>', empenho: '<b>NE</b>', ptres: '<i>123</i>' },
    ]));
    const api = helper();
    await new Promise(resolve => setTimeout(resolve, 0));
    api.show();
    fireEvent.click(document.querySelector('[data-solrecfin-toggle]')!);
    const panel = document.querySelector('.suape-cp-solrecfin-panel')!;
    expect(panel.querySelectorAll('.suape-cp-solrecfin-documents > tbody > tr')).toHaveLength(4);
    expect(panel.textContent?.match(/2026 NP 123/g)).toHaveLength(2);
    expect(panel).toHaveTextContent('NP/RP não identificada');
    expect(panel).toHaveTextContent('Não informado');
    expect(panel).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(panel.querySelector('img, b, i')).toBeNull();
    expect(panel.querySelector('tfoot')).toHaveTextContent('30,00');
    api.show();
    expect(document.querySelector('[data-solrecfin-toggle]')).toHaveAttribute('aria-expanded', 'false');
    expect(api.getEntries()).toHaveLength(4);
  });
});
