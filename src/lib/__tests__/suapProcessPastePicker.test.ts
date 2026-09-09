import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

describe('Suape - Menu de Colagem Inteligente Alt+V (suapProcessPastePicker)', () => {
  const pasteScript = readFileSync(extensionFixturePath('process-paste-picker.js'), 'utf8');
  const pasteCss = readFileSync(extensionFixturePath('process-paste-picker.css'), 'utf8');
  const manifest = JSON.parse(readFileSync(extensionFixturePath('manifest.json'), 'utf8'));

  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as { __suapeProcessPastePickerLoaded?: boolean }).__suapeProcessPastePickerLoaded;
    delete (window as unknown as { __suapeProcessPastePicker?: unknown }).__suapeProcessPastePicker;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('declara o comando Alt+V e content script global com all_frames no manifest.json', () => {
    expect(manifest.commands?.['open-process-paste']).toEqual({
      suggested_key: {
        default: 'Alt+V',
      },
      description: expect.stringContaining('Alt+V'),
    });

    const pickerEntry = manifest.content_scripts.find(
      (entry: { js: string[] }) => entry.js?.includes('process-paste-picker.js')
    );
    expect(pickerEntry).toBeDefined();
    expect(pickerEntry.matches).toContain('<all_urls>');
    expect(pickerEntry.css).toContain('process-paste-picker.css');
    expect(pickerEntry.all_frames).toBe(true);
    expect(pickerEntry.run_at).toBe('document_idle');
  });

  it('possui classes e estilos essenciais no CSS', () => {
    expect(pasteCss).toContain('#suape-paste-overlay');
    expect(pasteCss).toContain('#suape-paste-modal');
    expect(pasteCss).toContain('.suape-paste-header');
    expect(pasteCss).toContain('.suape-paste-group-header');
    expect(pasteCss).toContain('.suape-paste-group-index');
    expect(pasteCss).toContain('.suape-paste-item');
    expect(pasteCss).toContain('.suape-paste-selected');
    expect(pasteCss).toContain('.suape-paste-toast');
  });

  it('extrai apenas campos identificados e descarta rigorosamente campos vazios ou nulos', () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { extractIdentifiedFields: (data: unknown) => Array<{ label: string; value: string; category: string }> } }).__suapeProcessPastePicker;

    const mockProcess = {
      suapId: '495256',
      processNumber: '23035.002581.2026-60',
      process: {
        numProcesso: '23035.002581.2026-60',
        suapId: '495256',
        caixa: 'Caixa de Entrada',
        beneficiario: 'Empresa Fornecedora LTDA',
        cpfCnpj: '12.345.678/0001-90',
        assunto: 'Fornecimento de materiais de TI',
        dadosCompletos: {
          val_nf: 'R$ 15.420,00',
          ns_numero: '2026NS000123',
          contrato_numero: '15/2024',
          // Campos vazios intencionais que NÃO devem aparecer
          campo_vazio: '',
          campo_hifen: '-',
          campo_nulo: null,
          campo_undefined: undefined,
          notas_fiscais: [
            { numero: '10234', data_emissao: '12/01/2026', valor: 'R$ 15.420,00' },
            { numero: '', data_emissao: '-', valor: null }, // Nota fiscal vazia deve ser descartada
          ],
          dados_bancarios: {
            banco: '001 - Banco do Brasil',
            agencia: '1234-5',
            conta: '98765-4',
            chave_pix: 'contato@fornecedora.com.br',
          },
          empenhos: ['2026NE000111', '2026NE000112'],
          retencoes_tributarias: {
            optante_simples_nacional: true,
            iss: 'R$ 308,40',
            inss: '', // Vazio, não deve aparecer
            ir: null,  // Nulo, não deve aparecer
          },
          workflow: {
            concluido: true,
            nsNumero: '2026NS000123',
            concluidoEm: '15/01/2026',
            concluidoPor: 'Servidor Responsável',
          },
        },
      },
    };

    const fields = api.extractIdentifiedFields(mockProcess);

    // Campos válidos esperados
    const labels = fields.map((f) => f.label);
    const values = fields.map((f) => f.value);

    expect(labels).toContain('Processo');
    expect(values).toContain('23035.002581.2026-60');

    expect(labels).toContain('SUAP ID');
    expect(values).toContain('495256');

    expect(labels).toContain('Beneficiário / Nome');
    expect(values).toContain('Empresa Fornecedora LTDA');

    expect(labels).toContain('CPF / CNPJ');
    expect(values).toContain('12.345.678/0001-90');

    expect(labels).toContain('Valor Total');
    expect(values).toContain('R$ 15.420,00');

    expect(labels).toContain('Nota Fiscal');
    expect(values).toContain('10234');

    expect(labels).toContain('Banco');
    expect(values).toContain('001 - Banco do Brasil');

    expect(labels).toContain('Empenho 1');
    expect(values).toContain('2026NE000111');

    expect(labels).toContain('Empenho 2');
    expect(values).toContain('2026NE000112');

    expect(labels).toContain('Todos os Empenhos');
    expect(values).toContain('2026NE000111, 2026NE000112');

    expect(labels).toContain('Regime Tributário');
    expect(values).toContain('Optante pelo Simples Nacional');

    expect(labels).toContain('ISS');
    expect(values).toContain('R$ 308,40');

    // Verifica que NENHUM campo vazio, hífen ou nulo passou
    fields.forEach((f) => {
      expect(f.value.trim()).not.toBe('');
      expect(f.value).not.toBe('-');
      expect(f.value).not.toBe('null');
      expect(f.value).not.toBe('undefined');
      expect(f.value).not.toBe('NaN');
    });

    expect(labels).not.toContain('INSS');
    expect(labels).not.toContain('IR');
  });

  it('organiza múltiplos processos agrupados: primeiro todos os dados de um, depois do outro', async () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { openPicker: () => Promise<void>; closePicker: () => void } }).__suapeProcessPastePicker;

    // Configura mock de 2 processos abertos no storage
    const proc1 = {
      suapId: '495256',
      processNumber: '23035.002581.2026-60',
      activeAt: 2000,
      process: {
        numProcesso: '23035.002581.2026-60',
        suapId: '495256',
        beneficiario: 'Alpha Servicos',
        cpfCnpj: '11.111.111/0001-11',
      },
    };

    const proc2 = {
      suapId: '495257',
      processNumber: '23035.002582.2026-60',
      activeAt: 1000,
      process: {
        numProcesso: '23035.002582.2026-60',
        suapId: '495257',
        beneficiario: 'Beta Comercio',
        cpfCnpj: '22.222.222/0001-22',
      },
    };

    const chromeStorageMock = {
      local: {
        get: vi.fn((keys: unknown, callback: (data: unknown) => void) => {
          callback({
            suape_active_processes: {
              tab_1: proc1,
              tab_2: proc2,
            },
          });
        }),
      },
    };

    (window as unknown as { chrome: unknown }).chrome = {
      storage: chromeStorageMock,
      runtime: {
        sendMessage: vi.fn((_msg: unknown, cb: (res: unknown) => void) => {
          cb({ ok: true, processes: [proc1, proc2] });
        }),
      },
    };

    await api.openPicker();

    const overlay = document.getElementById('suape-paste-overlay');
    expect(overlay).not.toBeNull();

    const groups = overlay?.querySelectorAll('.suape-paste-group');
    expect(groups?.length).toBe(2);

    // Primeiro grupo: PROCESSO 1
    const group1 = groups?.[0];
    expect(group1?.querySelector('.suape-paste-group-index')?.textContent).toBe('PROCESSO 1');
    expect(group1?.querySelector('.suape-paste-group-title')?.textContent).toBe('23035.002581.2026-60');
    expect(group1?.textContent).toContain('Alpha Servicos');
    expect(group1?.textContent).toContain('11.111.111/0001-11');
    // Não deve conter dados do processo 2 no grupo 1
    expect(group1?.textContent).not.toContain('Beta Comercio');

    // Segundo grupo: PROCESSO 2
    const group2 = groups?.[1];
    expect(group2?.querySelector('.suape-paste-group-index')?.textContent).toBe('PROCESSO 2');
    expect(group2?.querySelector('.suape-paste-group-title')?.textContent).toBe('23035.002582.2026-60');
    expect(group2?.textContent).toContain('Beta Comercio');
    expect(group2?.textContent).toContain('22.222.222/0001-22');
    // Não deve conter dados do processo 1 no grupo 2
    expect(group2?.textContent).not.toContain('Alpha Servicos');

    api.closePicker();
    expect(document.getElementById('suape-paste-overlay')).toBeNull();
  });

  it('cola o valor no campo de texto em foco e fecha com Enter', async () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { openPicker: () => Promise<void>; closePicker: () => void } }).__suapeProcessPastePicker;

    // Campo de texto de teste
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'Prefixo: ';
    document.body.appendChild(input);
    input.focus();
    input.setSelectionRange(9, 9);

    const proc = {
      suapId: '495256',
      processNumber: '23035.002581.2026-60',
      process: {
        numProcesso: '23035.002581.2026-60',
        suapId: '495256',
        cpfCnpj: '12.345.678/0001-90',
      },
    };

    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: vi.fn((_msg: unknown, cb: (res: unknown) => void) => {
          cb({ ok: true, processes: [proc] });
        }),
      },
    };

    await api.openPicker();

    // Simula tecla Enter no primeiro item (Processo: 23035.002581.2026-60)
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(enterEvent);

    // O valor deve ter sido inserido no input
    expect(input.value).toBe('Prefixo: 23035.002581.2026-60');
    // O modal deve ter sido fechado
    expect(document.getElementById('suape-paste-overlay')).toBeNull();
  });

  it('filtra itens em tempo real ao digitar na busca', async () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { openPicker: () => Promise<void>; closePicker: () => void } }).__suapeProcessPastePicker;

    const proc = {
      suapId: '495256',
      processNumber: '23035.002581.2026-60',
      process: {
        numProcesso: '23035.002581.2026-60',
        suapId: '495256',
        beneficiario: 'Empresa Alpha',
        cpfCnpj: '12.345.678/0001-90',
      },
    };

    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: vi.fn((_msg: unknown, cb: (res: unknown) => void) => {
          cb({ ok: true, processes: [proc] });
        }),
      },
    };

    await api.openPicker();

    const searchInput = document.querySelector('.suape-paste-search-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();

    // Digita "cnpj"
    searchInput.value = 'cnpj';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const visibleItems = document.querySelectorAll('.suape-paste-item');
    expect(visibleItems.length).toBe(1);
    expect(visibleItems[0].textContent).toContain('12.345.678/0001-90');

    api.closePicker();
  });

  it('fecha o menu com a tecla Escape sem alterar o campo de texto', async () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { openPicker: () => Promise<void>; closePicker: () => void } }).__suapeProcessPastePicker;

    const input = document.createElement('input');
    input.value = 'inalterado';
    document.body.appendChild(input);
    input.focus();

    await api.openPicker();
    expect(document.getElementById('suape-paste-overlay')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(document.getElementById('suape-paste-overlay')).toBeNull();
    expect(input.value).toBe('inalterado');
  });

  it('detecta dados diretamente da página do SUAP e das linhas do painel lateral quando mensagens de background não respondem', async () => {
    window.eval(pasteScript);
    const api = (window as unknown as { __suapeProcessPastePicker: { openPicker: () => Promise<void>; closePicker: () => void } }).__suapeProcessPastePicker;

    // Simula estar na página do SUAP
    delete (window as unknown as { location: unknown }).location;
    (window as unknown as { location: unknown }).location = {
      pathname: '/processo_eletronico/processo/495256/',
      href: 'https://suap.ifrn.edu.br/processo_eletronico/processo/495256/',
    };

    // Insere o card da barra lateral exatamente como o usuário viu no print
    const toolkit = document.createElement('div');
    toolkit.id = 'siages-suap-toolkit';
    toolkit.innerHTML = `
      <div class="suape-data-row">
        <span>Processo</span>
        <span class="suape-data-value suape-mono">23035.002581.2026-60</span>
        <button class="suape-copy">⧉</button>
      </div>
      <div class="suape-data-row">
        <span>SUAP ID</span>
        <span class="suape-data-value suape-mono">495256</span>
        <button class="suape-copy">⧉</button>
      </div>
    `;
    document.body.appendChild(toolkit);

    // Adiciona elementos nativos da página do SUAP com Interessado e Assunto
    const nativeTable = document.createElement('table');
    nativeTable.innerHTML = `
      <tr><th>Interessado:</th><td>EMPRESA EXEMPLO LTDA (CNPJ: 12.345.678/0001-90)</td></tr>
      <tr><th>Assunto:</th><td>Pagamento de prestação de serviços de apoio</td></tr>
    `;
    document.body.appendChild(nativeTable);

    // Sem chrome.runtime ou storage respondendo
    (window as unknown as { chrome: unknown }).chrome = {
      storage: { local: { get: vi.fn((_keys, cb) => cb({})) } },
      runtime: { sendMessage: vi.fn((_msg, cb) => cb({ ok: false })) },
    };

    await api.openPicker();

    const overlay = document.getElementById('suape-paste-overlay');
    expect(overlay).not.toBeNull();

    const text = overlay?.textContent || '';
    expect(text).toContain('23035.002581.2026-60');
    expect(text).toContain('495256');
    expect(text).toContain('EMPRESA EXEMPLO LTDA');
    expect(text).toContain('12.345.678/0001-90');
    expect(text).toContain('Pagamento de prestação de serviços de apoio');

    api.closePicker();
  });
});
