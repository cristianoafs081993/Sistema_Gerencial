import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type SiafiApi = {
  normalizeCpf: (value: unknown) => string;
  formatCurrency: (value: number) => string;
  fillSiafiBeneficiaries: (records: Array<{ cpf: string; valor: number }>) => Promise<{ ok: boolean; inserted: number }>;
};

function rowHtml(cpf = '', value = '') {
  return `<tr><td><input maxlength="14" value="${cpf}" /></td><td><input siaficurrency="" value="${value}" /></td><td><button type="button" ptooltip="Confirmar">✓</button><button type="button" ptooltip="Cancelar">×</button></td></tr>`;
}

function invokeMessage(message: unknown) {
  const listeners = (window as typeof window & { __siagesMessageListeners?: Array<(message: unknown, sender: unknown, callback: (response: unknown) => void) => unknown> }).__siagesMessageListeners || [];
  const listener = listeners[0];
  if (!listener) throw new Error('Listener SIAFI nao registrado.');
  return new Promise<unknown>((resolve) => {
    listener(message, {}, resolve);
  });
}

describe('content script de favorecidos SIAFI', () => {
  let includeClicks = 0;
  let confirmClicks = 0;

  beforeEach(() => {
    includeClicks = 0;
    confirmClicks = 0;
    document.body.innerHTML = `<cpr-table-itens-lista><table role="grid"><thead><tr><th>Favorecido</th><th>Valor</th><th>Ações</th></tr></thead><tbody>${rowHtml('123.456.789-01', '100,00')}</tbody><tfoot><tr><td colspan="3"><button id="include" type="button">Incluir Favorecido</button></td></tr></tfoot></table></cpr-table-itens-lista>`;
    document.querySelector('#include')?.addEventListener('click', () => {
      includeClicks += 1;
      document.querySelector('tbody')?.insertAdjacentHTML('beforeend', rowHtml());
    });
    document.querySelectorAll('[ptooltip="Confirmar"]').forEach((button) => button.addEventListener('click', () => { confirmClicks += 1; }));

    const testWindow = window as typeof window & { __siagesSiafiFavorecidos?: SiafiApi; __siagesSiafiFavorecidosLoaded?: boolean; __siagesMessageListeners?: Array<(...args: any[]) => unknown>; chrome?: unknown };
    delete testWindow.__siagesSiafiFavorecidos;
    delete testWindow.__siagesSiafiFavorecidosLoaded;
    testWindow.__siagesMessageListeners = [];
    testWindow.chrome = {
      runtime: {
        onMessage: {
          addListener: (listener: (...args: any[]) => unknown) => testWindow.__siagesMessageListeners?.push(listener),
        },
      },
    };
    window.eval(readFileSync(extensionFixturePath('siafi-favorecidos.js'), 'utf8'));
  });

  it('normaliza CPF, formata valores, inclui ao final e nao confirma linhas', async () => {
    const response = await invokeMessage({
      source: 'siages',
      type: 'siafi:fill-favorecidos',
      version: 1,
      records: [
        { cpf: '987.654.321-00', valor: 250 },
        { cpf: '11122233344', valor: '80,50' },
      ],
    }) as { ok: boolean; inserted: number };

    const inputs = Array.from(document.querySelectorAll('tbody tr')).map((row) => ({
      cpf: (row.querySelector('input[maxlength="14"]') as HTMLInputElement)?.value,
      valor: (row.querySelector('input[siaficurrency]') as HTMLInputElement)?.value,
    }));
    expect(response).toMatchObject({ ok: true, inserted: 2 });
    expect(includeClicks).toBe(2);
    expect(inputs).toEqual([
      { cpf: '123.456.789-01', valor: '100,00' },
      { cpf: '98765432100', valor: '25000' },
      { cpf: '11122233344', valor: '8050' },
    ]);
    expect(confirmClicks).toBe(0);
  });

  it('usa uma linha vazia existente antes de clicar em Incluir Favorecido', async () => {
    document.querySelector('tbody')?.insertAdjacentHTML('beforeend', rowHtml());
    const api = (window as typeof window & { __siagesSiafiFavorecidos: SiafiApi }).__siagesSiafiFavorecidos;
    await expect(api.fillSiafiBeneficiaries([{ cpf: '98765432100', valor: 1.5 }])).resolves.toMatchObject({ inserted: 1 });
    expect(includeClicks).toBe(0);
    expect((document.querySelectorAll('tbody tr')[1].querySelector('input[siaficurrency]') as HTMLInputElement).value).toBe('150');
  });

  it('valida todos os registros antes de alterar o SIAFI', async () => {
    const before = document.querySelector('tbody')?.innerHTML;
    const response = await invokeMessage({
      source: 'siages',
      type: 'siafi:fill-favorecidos',
      version: 1,
      records: [{ cpf: '123', valor: 0 }, { cpf: '98765432100', valor: 20 }],
    }) as { ok: boolean; error: string };

    expect(response.ok).toBe(false);
    expect(response.error).toContain('posições: 1');
    expect(document.querySelector('tbody')?.innerHTML).toBe(before);
    expect(includeClicks).toBe(0);
    expect(confirmClicks).toBe(0);
  });

  it('retorna erro quando a tabela nao foi encontrada', async () => {
    document.querySelector('cpr-table-itens-lista')?.remove();
    const api = (window as typeof window & { __siagesSiafiFavorecidos: SiafiApi }).__siagesSiafiFavorecidos;
    await expect(api.fillSiafiBeneficiaries([{ cpf: '98765432100', valor: 20 }])).rejects.toThrow('tabela de favorecidos');
  });

  it('expõe as funções de normalização usadas pelo popup', () => {
    const api = (window as typeof window & { __siagesSiafiFavorecidos: SiafiApi }).__siagesSiafiFavorecidos;
    expect(api.normalizeCpf('123.456.789-01')).toBe('12345678901');
    expect(api.formatCurrency(250)).toBe('25000');
  });

  it('recusa mais de dez registros em uma única mensagem', async () => {
    const api = (window as typeof window & { __siagesSiafiFavorecidos: SiafiApi }).__siagesSiafiFavorecidos;
    const records = Array.from({ length: 11 }, (_, index) => ({ cpf: String(10000000000 + index), valor: 1 }));
    await expect(api.fillSiafiBeneficiaries(records)).rejects.toThrow('no máximo 10 favorecidos');
    expect(includeClicks).toBe(0);
  });
});
