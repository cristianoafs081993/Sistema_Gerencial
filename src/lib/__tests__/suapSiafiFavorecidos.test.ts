import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type RecordInput = { cpf: string; valor: number | string };
type Result = { ok: boolean; inserted: number; processed: number; confirmed: number; pending: Array<{ position: number; reason: string }>; error?: string };
type Listener = (message: unknown, sender: unknown, callback: (response: Result) => void) => unknown;
type Api = { MESSAGE_VERSION: number; formatCurrency: (value: number) => string; fillSiafiBeneficiaries: (records: RecordInput[], mode?: string) => Promise<Result> };
const script = readFileSync(extensionFixturePath('siafi-favorecidos.js'), 'utf8');
const tw = window as typeof window & { __siagesSiafiFavorecidos?: Api; __siagesSiafiFavorecidosLoaded?: boolean; chrome?: unknown };
const records = [{ cpf: '98765432100', valor: 250 }, { cpf: '11122233344', valor: '80,50' }];
let listeners: Listener[];
let includeClicks: number;
let confirmations: Array<{ cpf: string; value: string; pix: string }>;
let options: string[];
let portal: boolean;
let confirmWorks: boolean;
let loadDelay: number;
let register: ReturnType<typeof vi.fn>;

function dropdownHtml(label = 'Selecione...') {
  return `<p-dropdown><div class="ui-dropdown"><div class="ui-helper-hidden-accessible"><input role="listbox" readonly aria-label="${label}" aria-expanded="false"></div><div class="ui-dropdown-label-container"><span class="ui-dropdown-label">${label}</span></div><div role="button" aria-haspopup="listbox" class="ui-dropdown-trigger" aria-expanded="false"></div></div></p-dropdown>`;
}
function addDropdown(row: HTMLTableRowElement, selected = '') {
  row.cells[3].innerHTML = dropdownHtml(selected || undefined);
  const dd = row.querySelector('p-dropdown')!;
  const trigger = dd.querySelector('.ui-dropdown-trigger')!;
  let panel: HTMLElement | null = null;
  trigger.addEventListener('click', () => {
    if (panel) { panel.remove(); panel = null; trigger.setAttribute('aria-expanded', 'false'); return; }
    trigger.setAttribute('aria-expanded', 'true');
    panel = document.createElement('div');
    panel.className = 'ui-dropdown-panel';
    for (const label of options) {
      const item = document.createElement('li');
      item.setAttribute('role', 'option'); item.className = 'ui-dropdown-item'; item.textContent = label;
      item.addEventListener('click', () => {
        dd.querySelector('.ui-dropdown-label')!.textContent = label;
        dd.querySelector('[role="listbox"]')!.setAttribute('aria-label', label);
        panel?.remove(); panel = null; trigger.setAttribute('aria-expanded', 'false');
      });
      panel.appendChild(item);
    }
    (portal ? document.body : dd).appendChild(panel);
  });
}
function addRow(cpf = '', value = '', selected = '') {
  const row = document.createElement('tr');
  row.innerHTML = `<td>-</td><td><input maxlength="14" value="${cpf}"></td><td>Aluno de teste</td><td></td><td><input siaficurrency maxlength="22" value="${value}"></td><td><button ptooltip="Confirmar">ui-btn</button><button ptooltip="Cancelar">ui-btn</button></td>`;
  document.querySelector('tbody')!.appendChild(row);
  if (cpf) addDropdown(row, selected);
  else row.querySelector('input')!.addEventListener('blur', () => {
    if (loadDelay) setTimeout(() => addDropdown(row), loadDelay);
    else addDropdown(row);
  });
  row.querySelector('[ptooltip="Confirmar"]')!.addEventListener('click', () => {
    const entry = { cpf: (row.querySelector('input[maxlength="14"]') as HTMLInputElement).value, value: (row.querySelector('input[siaficurrency]') as HTMLInputElement).value, pix: row.querySelector('.ui-dropdown-label')!.textContent! };
    confirmations.push(entry);
    if (confirmWorks) row.innerHTML = `<td>1</td><td>${entry.cpf}</td><td>Aluno de teste</td><td>${entry.pix}</td><td>${entry.value}</td><td></td>`;
  });
  return row;
}
// carregarDomicilios: spinner e placeholder Carregando... até chaves Pix e domicílios responderem.
function slowPixDropdown(row: HTMLTableRowElement, loadMs?: number) {
  row.cells[3].innerHTML = dropdownHtml();
  const dropdown = row.querySelector('p-dropdown')!;
  const label = dropdown.querySelector('.ui-dropdown-label')!;
  const trigger = dropdown.querySelector('.ui-dropdown-trigger')!;
  trigger.innerHTML = '<span class="ui-dropdown-trigger-icon pi pi-chevron-down"></span>';
  const icon = trigger.firstElementChild!;
  dropdown.querySelector('input')!.addEventListener('focus', () => {
    icon.className = 'ui-dropdown-trigger-icon pi pi-spinner pi-spin'; label.textContent = 'Carregando...';
    if (loadMs !== undefined) setTimeout(() => {
      icon.className = 'ui-dropdown-trigger-icon pi pi-chevron-down'; label.textContent = 'Selecione...';
      const panel = dropdown.querySelector('.ui-dropdown-panel')!;
      panel.innerHTML = '<li role="option" class="ui-dropdown-item">Chave: teste@example.test</li>';
      panel.firstElementChild!.addEventListener('click', () => {
        label.textContent = 'Chave: teste@example.test'; trigger.setAttribute('aria-expanded', 'false'); panel.remove();
      });
    }, loadMs);
  });
  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!open));
    if (open) dropdown.querySelector('.ui-dropdown-panel')?.remove();
    else dropdown.querySelector('.ui-dropdown')!.insertAdjacentHTML('beforeend', '<div class="ui-dropdown-panel"></div>');
  });
}
function api() { return tw.__siagesSiafiFavorecidos!; }
function invoke(records: RecordInput[], mode = 'fill') {
  return new Promise<Result>((resolve) => listeners[0]({ source: 'siages', type: 'siafi:fill-favorecidos', version: 4, mode, records }, {}, resolve));
}

beforeEach(() => {
  listeners = []; includeClicks = 0; confirmations = []; portal = false; confirmWorks = true; loadDelay = 0;
  options = ['Banco: 001 Agência: 0001', 'Chave: aluno@example.test'];
  document.body.innerHTML = '<cpr-table-itens-lista><table><thead><tr><th>Seq.</th><th>Favorecido</th><th>Nome</th><th>Chave PIX/Domicílio Bancário</th><th>Valor</th><th></th></tr></thead><tbody></tbody><tfoot><tr><td><button id="include">Incluir Favorecido</button></td></tr></tfoot></table></cpr-table-itens-lista><button id="register">Registrar</button>';
  document.querySelector('#include')!.addEventListener('click', () => { includeClicks += 1; addRow(); });
  register = vi.fn(); document.querySelector('#register')!.addEventListener('click', register);
  delete tw.__siagesSiafiFavorecidos; delete tw.__siagesSiafiFavorecidosLoaded;
  tw.chrome = { runtime: { onMessage: { addListener: (listener: Listener) => listeners.push(listener) } } };
  window.eval(script);
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('favorecidos SIAFI com Pix', () => {
  it.each([false, true])('clica na seta e na chave quando o popup retém foco: %s', async (popupHasFocus) => {
    const row = addRow(records[0].cpf, '250,00');
    row.cells[3].innerHTML = dropdownHtml();
    const dropdown = row.querySelector('p-dropdown')!;
    const input = dropdown.querySelector('input')!;
    const trigger = dropdown.querySelector('.ui-dropdown-trigger')!;
    const focusSpy = popupHasFocus ? vi.spyOn(input, 'focus').mockImplementation(() => {}) : null;
    let loaded = false;
    let panel: HTMLElement | null = null;
    const renderOptions = () => {
      if (!panel || !loaded || panel.children.length) return;
      panel.innerHTML = '<ul><li>Chaves PIX</li><p-dropdownitem><li role="option" class="ui-dropdown-item"><span>Chave: teste@example.test</span></li></p-dropdownitem></ul>';
      panel.querySelector('[role="option"]')!.addEventListener('click', () => {
        dropdown.querySelector('.ui-dropdown-label')!.textContent = 'Chave: teste@example.test';
        input.setAttribute('aria-expanded', 'false'); panel!.remove(); panel = null;
      });
    };
    const load = vi.fn(() => { loaded = true; renderOptions(); });
    input.addEventListener('focus', load);
    // Mesmo encadeamento público do PrimeNG: click propaga ao container,
    // onMouseclick chama focus(), abre overlay; onInputFocus carrega opções.
    const open = vi.fn((event: Event) => {
      if (event.target === input || panel) return;
      input.focus();
      input.setAttribute('aria-expanded', 'true');
      panel = document.createElement('div'); panel.className = 'ui-dropdown-panel';
      dropdown.querySelector('.ui-dropdown')!.appendChild(panel);
      renderOptions();
    });
    dropdown.querySelector('.ui-dropdown')!.addEventListener('click', open);
    try {
      await expect(api().fillSiafiBeneficiaries([records[0]], 'resume')).resolves.toMatchObject({ confirmed: 1, pending: [] });
      expect(load).toHaveBeenCalledOnce();
      expect(open.mock.calls[0][0].target).toBe(trigger);
      expect(confirmations[0].pix).toBe('Chave: teste@example.test');
    } finally { focusSpy?.mockRestore(); }
  });

  it('carrega pelo foco e relê o painel substituído pelo Angular, sem aguardar timeout', async () => {
    const row = addRow(records[0].cpf, '250,00');
    row.cells[3].innerHTML = dropdownHtml();
    const dropdown = row.querySelector('p-dropdown')!;
    const focus = dropdown.querySelector('input')!;
    const trigger = dropdown.querySelector('.ui-dropdown-trigger')!;
    let receivedFocus = false;
    focus.addEventListener('focus', () => {
      receivedFocus = true;
      setTimeout(() => {
        const next = document.createElement('div'); next.className = 'ui-dropdown-panel';
        next.innerHTML = '<ul><li class="ui-dropdown-item-group">Chaves PIX</li><p-dropdownitem><li role="option" class="ui-dropdown-item" aria-label="Chave: teste@example.test">Chave: teste@example.test</li></p-dropdownitem></ul>';
        next.querySelector('[role="option"]')!.addEventListener('click', () => {
          dropdown.querySelector('.ui-dropdown-label')!.textContent = 'Chave: teste@example.test';
          trigger.setAttribute('aria-expanded', 'false'); next.remove();
        });
        dropdown.querySelector('.ui-dropdown-panel')!.replaceWith(next);
      }, 20);
    });
    trigger.addEventListener('click', () => {
      expect(receivedFocus).toBe(true);
      trigger.setAttribute('aria-expanded', 'true');
      dropdown.insertAdjacentHTML('beforeend', '<div class="ui-dropdown-panel"></div>');
    });
    await expect(api().fillSiafiBeneficiaries([records[0]], 'resume')).resolves.toMatchObject({ confirmed: 1, pending: [] });
    expect(confirmations[0].pix).toBe('Chave: teste@example.test');
  });

  it('interrompe no primeiro menu vazio e não acumula 10 timeouts nem avança o cursor', async () => {
    vi.useFakeTimers(); options = [];
    const pending = invoke(Array.from({ length: 10 }, (_, i) => ({ cpf: String(10000000000 + i), valor: 10 })));
    await vi.advanceTimersByTimeAsync(4100);
    expect(await pending).toMatchObject({ ok: false, processed: 0, confirmed: 0, error: expect.stringContaining('4 segundos') });
    expect(includeClicks).toBe(1); expect(confirmations).toHaveLength(0);
  });

  it('continua esperando além de 4 s enquanto o SIAFI mostra Carregando...', async () => {
    vi.useFakeTimers();
    slowPixDropdown(addRow(records[0].cpf, '250,00'), 9000);
    const pending = invoke([records[0]], 'resume');
    await vi.advanceTimersByTimeAsync(9100);
    expect(await pending).toMatchObject({ ok: true, processed: 1, confirmed: 1, pending: [] });
    expect(confirmations[0].pix).toBe('Chave: teste@example.test');
  });

  it('interrompe sem avançar quando o SIAFI fica 20 s em Carregando...', async () => {
    vi.useFakeTimers();
    slowPixDropdown(addRow(records[0].cpf, '250,00'));
    let settled = false;
    const pending = invoke([records[0]], 'resume').finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(19000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await pending).toMatchObject({ ok: false, processed: 0, confirmed: 0, error: expect.stringContaining('20 segundos') });
    expect(confirmations).toHaveLength(0);
  });

  it('distingue resposta vazia válida do menu que ainda não carregou', async () => {
    options = ['Nenhum item cadastrado', 'Adicionar nova Chave PIX...'];
    const result = await invoke([records[0]]);
    expect(result).toMatchObject({ ok: true, processed: 1, confirmed: 0, pending: [{ position: 1, reason: 'Sem Pix cadastrado' }] });
  });

  it.each([250, 80.5, 1234.56, 0.01])('sincroniza o modelo monetário desktop antes de confirmar %s', async (amount) => {
    const row = addRow(records[0].cpf, '', options[1]);
    const input = row.querySelector('input[siaficurrency]') as HTMLInputElement;
    let model: number | null = null;
    let touched = false;
    // Contrato observado no bundle público: input é ignorado no desktop,
    // paste atualiza o modelo num timer de 1 ms; blur só marca como tocado.
    input.addEventListener('paste', () => {
      setTimeout(() => {
        model = Number(input.value.replace(/\./g, '').replace(',', '.'));
        input.value = model.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        input.classList.remove('ng-pristine'); input.classList.add('ng-dirty');
      }, 1);
    });
    input.addEventListener('blur', () => { touched = true; });
    input.value = api().formatCurrency(amount);
    ['input', 'change', 'blur'].forEach((event) => input.dispatchEvent(new Event(event, { bubbles: true })));
    expect(model).toBeNull(); // reproduz a falha da 1.9.86: texto visível, modelo vazio.
    touched = false;
    const checkModel = vi.fn(() => { expect(model).toBe(amount); expect(touched).toBe(true); });
    row.querySelector('button[ptooltip="Confirmar"]')!.addEventListener('click', checkModel, true);
    await expect(api().fillSiafiBeneficiaries([{ cpf: records[0].cpf, valor: amount }], 'resume')).resolves.toMatchObject({ confirmed: 1 });
    expect(checkModel).toHaveBeenCalledOnce();
  });

  it('conclui a estrutura real enviada pelo usuário com valores vivos dos inputs', async () => {
    document.body.innerHTML = readFileSync(resolve('src/lib/__tests__/fixtures/siafi-favorecido-pix.html'), 'utf8');
    const row = document.querySelector('tbody tr') as HTMLTableRowElement;
    const cpf = row.querySelector('input[maxlength="14"]') as HTMLInputElement;
    const value = row.querySelector('input[siaficurrency]') as HTMLInputElement;
    cpf.value = records[0].cpf; value.value = '25000';
    const onConfirm = vi.fn(() => {
      expect(value.value).toBe('250,00');
      row.cells[1].textContent = cpf.value; row.cells[4].textContent = value.value;
      row.cells[5].replaceChildren();
    });
    row.querySelector('button[ptooltip="Confirmar"]')!.addEventListener('click', onConfirm);
    await expect(api().fillSiafiBeneficiaries([records[0]], 'resume')).resolves.toMatchObject({ confirmed: 1 });
    expect(onConfirm).toHaveBeenCalledOnce();
  });
  it('preserva terceiros, normaliza CPF, escreve vírgula e confirma apenas a linha com Pix', async () => {
    const previous = addRow('123.456.789-01', '100,00', 'Chave: existente@example.test');
    const before = previous.outerHTML;
    const result = await invoke([{ cpf: '987.654.321-00', valor: 250 }, records[1]]);
    expect(result).toMatchObject({ ok: true, processed: 2, confirmed: 2, pending: [] });
    expect(includeClicks).toBe(2);
    expect(confirmations).toEqual([{ cpf: '98765432100', value: '250,00', pix: options[1] }, { cpf: '11122233344', value: '80,50', pix: options[1] }]);
    expect(previous.outerHTML).toBe(before);
    expect(register).not.toHaveBeenCalled();
  });
  it('reutiliza linha vazia e aceita a máscara brasileira após blur', async () => {
    const row = addRow();
    const value = row.querySelector('input[siaficurrency]') as HTMLInputElement;
    value.addEventListener('blur', () => { value.value = '1.234,56'; });
    await expect(api().fillSiafiBeneficiaries([{ cpf: records[0].cpf, valor: 1234.56 }])).resolves.toMatchObject({ confirmed: 1 });
    expect(includeClicks).toBe(0);
    expect(confirmations[0].value).toBe('1.234,56');
  });
  it('conclui linhas semi-preenchidas pelo CPF da lista, corrigindo centavos antigos e mantendo Pix selecionado', async () => {
    const row = addRow(records[0].cpf, '25000', 'Chave: escolhida@example.test');
    const trigger = vi.fn(); row.querySelector('.ui-dropdown-trigger')!.addEventListener('click', trigger);
    addRow('12345678901', '999,00');
    const list = Array.from({ length: 15 }, (_, i) => ({ cpf: String(10000000000 + i), valor: 5 }));
    await expect(api().fillSiafiBeneficiaries([...list, ...records], 'resume')).resolves.toMatchObject({ processed: 1, confirmed: 1 });
    expect(confirmations[0]).toEqual({ cpf: records[0].cpf, value: '250,00', pix: 'Chave: escolhida@example.test' });
    expect(trigger).not.toHaveBeenCalled(); expect(includeClicks).toBe(0);
  });
  it('não duplica uma linha já confirmada com mesmo CPF e valor', async () => {
    await api().fillSiafiBeneficiaries([records[0]]);
    await expect(api().fillSiafiBeneficiaries([records[0]])).resolves.toMatchObject({ processed: 1, confirmed: 1, inserted: 0 });
    expect(confirmations).toHaveLength(1); expect(includeClicks).toBe(1);
  });
  it.each([['Banco: 001'], ['Chave: a@example.test', 'Chave: b@example.test']])('deixa pendente sem Pix único: %j', async (...labels) => {
    options = labels;
    const result = await invoke([records[0]]);
    expect(result).toMatchObject({ ok: true, processed: 1, confirmed: 0 });
    expect(result.pending).toHaveLength(1); expect(confirmations).toHaveLength(0);
    expect(document.querySelector('.ui-dropdown-panel')).toBeNull();
  });
  it('seleciona somente no painel recém-aberto, inclusive anexado ao body', async () => {
    portal = true;
    const unrelated = document.createElement('div'); unrelated.className = 'ui-dropdown-panel';
    unrelated.innerHTML = '<li role="option">Chave: errado@example.test</li>'; document.body.appendChild(unrelated);
    await api().fillSiafiBeneficiaries([records[0]]);
    expect(confirmations[0].pix).toBe(options[1]);
  });
  it('aguarda consulta assíncrona do CPF e bloqueia execução simultânea', async () => {
    vi.useFakeTimers(); loadDelay = 300;
    const first = api().fillSiafiBeneficiaries([records[0]]);
    await expect(api().fillSiafiBeneficiaries([records[1]])).rejects.toThrow('em andamento');
    await vi.advanceTimersByTimeAsync(500);
    await expect(first).resolves.toMatchObject({ confirmed: 1 });
  });
  it('interrompe se o SIAFI alterar a escala do valor', async () => {
    const row = addRow(); const input = row.querySelector('input[siaficurrency]') as HTMLInputElement;
    input.addEventListener('blur', () => { input.value = '25000,00'; });
    await expect(api().fillSiafiBeneficiaries([records[0]])).rejects.toThrow('não manteve o valor');
    expect(confirmations).toHaveLength(0);
  });
  it('não avança para outro aluno quando a confirmação não foi verificada', async () => {
    vi.useFakeTimers(); confirmWorks = false;
    const pending = invoke(records);
    await vi.advanceTimersByTimeAsync(11000);
    expect(await pending).toMatchObject({ ok: false, processed: 0, confirmed: 0, error: expect.stringContaining('verificar a confirmação') });
    expect(includeClicks).toBe(1); expect(confirmations).toHaveLength(1);
  });
  it('informa progresso parcial quando uma linha posterior falha', async () => {
    const row = addRow(records[1].cpf, '80,50', options[1]);
    (row.querySelector('[ptooltip="Confirmar"]') as HTMLButtonElement).disabled = true;
    expect(await invoke(records)).toMatchObject({ ok: false, processed: 1, confirmed: 1, error: expect.stringContaining('não está disponível') });
  });
  it('valida todo lote e CPFs duplicados antes de tocar no formulário', async () => {
    const before = document.body.innerHTML;
    expect(await invoke([{ cpf: '123', valor: 0 }, records[0]])).toMatchObject({ ok: false, error: expect.stringContaining('posições: 1') });
    await expect(api().fillSiafiBeneficiaries([records[0], records[0]])).rejects.toThrow('duplicados');
    expect(document.body.innerHTML).toBe(before);
  });
  it('mantém limite de dez, recusa tabela ausente e conclusão sem correspondência', async () => {
    await expect(api().fillSiafiBeneficiaries(Array.from({ length: 11 }, (_, i) => ({ cpf: String(10000000000 + i), valor: 1 })))).rejects.toThrow('no máximo 10');
    await expect(api().fillSiafiBeneficiaries(records, 'resume')).rejects.toThrow('Nenhuma linha aberta');
    document.body.innerHTML = '';
    await expect(api().fillSiafiBeneficiaries(records)).rejects.toThrow('tabela de favorecidos');
  });
  it('carrega sobre a versão antiga e reinjeções não duplicam o listener', () => {
    delete tw.__siagesSiafiFavorecidos;
    tw.__siagesSiafiFavorecidosLoaded = true; listeners = [];
    window.eval(script); window.eval(script);
    expect(listeners).toHaveLength(1); expect(api().MESSAGE_VERSION).toBe(4);
    const response = vi.fn();
    expect(listeners[0]({ source: 'siages', type: 'siafi:fill-favorecidos', version: 1, records }, {}, response)).toBeUndefined();
    expect(response).not.toHaveBeenCalled();
    expect(listeners[0]({ source: 'siages', type: 'siafi:fill-favorecidos', version: 2, records }, {}, response)).toBeUndefined();
    expect(response).not.toHaveBeenCalled();
  });
  it.each([[250, '250,00'], [1.5, '1,50'], [0.01, '0,01'], [1234.56, '1234,56']])('formata %s como %s', (value, expected) => {
    expect(api().formatCurrency(value)).toBe(expected);
  });
});
