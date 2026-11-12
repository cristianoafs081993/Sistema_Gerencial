import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extensionFixturePath } from '@/test/extensionFixtures';

type Input = { processo: string; ug: string; vencimento: string; pagamento: string; valor: string; fonte: string };
type Api = { fill: (doc: Document, data: Input) => unknown; extractContaVinculada: (text: string) => string; open: () => void };
const file = readFileSync(extensionFixturePath('siafi-deducoes-assistidas.js'), 'utf8');
const form = 'form_manterDocumentoHabil';
const prefix = `${form}:listaDeducao:0:`;
const input: Input = { processo: '23035.003206.2026-37', ug: '158366', vencimento: '20/11/2026', pagamento: '19/11/2026', valor: '1.234,56', fonte: 'nota fiscal, página 2' };
function api(): Api {
  const scope = {} as { SiagesDeducoesAssistidas: Api };
  new Function('globalThis', file)(scope);
  return scope.SiagesDeducoesAssistidas;
}
function field(suffix: string) { return document.getElementById(prefix + suffix) as HTMLInputElement; }
beforeEach(() => {
  document.body.innerHTML = `<div id="divDeducoes"><div id="${prefix}panelItemDeducao">Situação: DOB035
    <input id="${prefix}inputUgPagadoraDeducao_input" value="158366">
    <input id="${prefix}dataVencimentoDeducao_calendarInputDate">
    <input id="${prefix}dataPagamentoDeducao_calendarInputDate">
    <input id="${prefix}inputValorDeducao_input" value="0,00">
  </div></div><textarea id="${form}:observacaoDeducao">Processo 23035.003206.2026-37</textarea><button id="confirmar">Confirmar</button>`;
});
describe('preenchimento assistido de dedução', () => {
  it('extrai apenas valor explicitamente identificado para conta vinculada', () => {
    const text = 'VALOR DA NOTA FISCAL R$ 69.396,11. Valor calculado para recolhimento na conta vinculada nesta medição: R$ 10.913,22.';
    expect(api().extractContaVinculada(text)).toBe('10913,22');
    expect(() => api().extractContaVinculada('Valor da nota: R$ 69.396,11')).toThrow(/um único valor/i);
    expect(() => api().extractContaVinculada(`${text} Valor calculado para recolhimento na conta vinculada nesta medição: R$ 1,00`)).toThrow(/um único valor/i);
  });
  it('permite revisar o valor extraído no diálogo antes de preencher', () => {
    const original = HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    try {
      api().open();
      const dialog = document.getElementById('siages-deducao-assistida')!;
      const trecho = dialog.querySelector('[name="trecho"]') as HTMLTextAreaElement;
      trecho.value = 'Valor calculado para recolhimento na conta vinculada nesta medição: R$ 10.913,22.';
      (dialog.querySelector('[data-extract]') as HTMLButtonElement).click();
      expect((dialog.querySelector('[name="valor"]') as HTMLInputElement).value).toBe('10913,22');
      expect(field('inputValorDeducao_input').value).toBe('0,00');
    } finally { HTMLDialogElement.prototype.showModal = original; }
  });
  it('preenche somente campos do item DOB035 do processo conferido', () => {
    const confirm = vi.fn(); document.getElementById('confirmar')!.onclick = confirm;
    api().fill(document, input);
    expect(field('dataVencimentoDeducao_calendarInputDate').value).toBe('20/11/2026');
    expect(field('dataPagamentoDeducao_calendarInputDate').value).toBe('19/11/2026');
    expect(field('inputValorDeducao_input').value).toBe('1234,56');
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each([
    [{ processo: '23035.003206.2026-38' }, /processo não corresponde/i],
    [{ ug: '158155' }, /UG pagadora/i],
    [{ fonte: '' }, /fonte/i],
    [{ valor: '0,00' }, /positivo/i],
    [{ vencimento: '31/02/2026' }, /Data inválida/i],
  ])('recusa dados inconsistentes antes de escrever', (change, expected) => {
    expect(() => api().fill(document, { ...input, ...change })).toThrow(expected);
    expect(field('dataVencimentoDeducao_calendarInputDate').value).toBe('');
  });
  it('não substitui valor preenchido diferente', () => {
    field('inputValorDeducao_input').value = '20,00';
    expect(() => api().fill(document, input)).toThrow(/valor diferente/i);
    expect(field('dataVencimentoDeducao_calendarInputDate').value).toBe('');
  });
  it('não confunde um DOB035 anterior com o item de outra situação', () => {
    document.getElementById(prefix + 'panelItemDeducao')!.firstChild!.textContent = 'Situação: DDF055';
    document.getElementById('divDeducoes')!.insertAdjacentHTML('afterbegin', '<div>Situação: DOB035</div>');
    expect(() => api().fill(document, input)).toThrow(/apenas o item DOB035/i);
  });
  it('interrompe se atualização substituir o próximo campo', () => {
    field('dataVencimentoDeducao_calendarInputDate').addEventListener('change', () => field('dataPagamentoDeducao_calendarInputDate').remove());
    expect(() => api().fill(document, input)).toThrow(/tela mudou/i);
    expect(field('inputValorDeducao_input').value).toBe('0,00');
  });
});
