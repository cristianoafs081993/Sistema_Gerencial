import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { extensionFixturePath } from '@/test/extensionFixtures';

type ScheduledProcessSyncApi = {
  DEFAULT_PROCESS_BOXES: Array<{ name: string; url: string }>;
  SCHEDULE_HOURS: number[];
  getNextRunAt: (now?: Date) => Date | null;
  parseProcessBoxHtml: (html: string) => Array<{ suapId: string; numProcesso?: string; url: string }>;
};

function loadSyncApi(): ScheduledProcessSyncApi {
  const context: Record<string, unknown> = {};
  const script = readFileSync(extensionFixturePath('scheduled-process-sync.js'), 'utf8');
  new Function('globalThis', script)(context);
  return context.SuapeScheduledProcessSync as ScheduledProcessSyncApi;
}

describe('sincronização agendada das caixas SUAP', () => {
  const syncApi = loadSyncApi();

  it('usa como padrão as duas caixas solicitadas', () => {
    expect(syncApi.DEFAULT_PROCESS_BOXES.map((box) => new URL(box.url).searchParams.get('atribuido_para'))).toEqual(['304806', null]);
    expect(new URL(syncApi.DEFAULT_PROCESS_BOXES[1].url).searchParams.get('setor')).toBe('857');
  });

  it('calcula os horários em dias úteis e pula horários já passados e fins de semana', () => {
    expect(syncApi.getNextRunAt(new Date(2026, 8, 23, 6, 59)).getHours()).toBe(7);
    expect(syncApi.getNextRunAt(new Date(2026, 8, 23, 7, 0)).getHours()).toBe(10);

    const afterFridaySchedule = syncApi.getNextRunAt(new Date(2026, 8, 25, 15, 1));
    expect(afterFridaySchedule?.getDay()).toBe(1);
    expect(afterFridaySchedule?.getHours()).toBe(7);

    const saturday = syncApi.getNextRunAt(new Date(2026, 8, 26, 10, 0));
    expect(saturday?.getDay()).toBe(1);
    expect(saturday?.getHours()).toBe(7);
    expect(syncApi.SCHEDULE_HOURS).toEqual([7, 10, 13, 15]);
  });

  it('extrai processos únicos e o número do processo no contexto da linha', () => {
    const html = `
      <table><tbody>
        <tr><td><a href="/processo_eletronico/processo/123/">Visualizar</a></td><td>12345.678901.2024-12</td></tr>
        <tr><td><a href="https://suap.ifrn.edu.br/processo_eletronico/processo/456/">12345.000001/2025-99</a></td></tr>
        <tr><td><a href="/processo_eletronico/processo/123/">Duplicado</a></td></tr>
        <tr><td><a href="https://example.com/processo_eletronico/processo/789/">Externo</a></td></tr>
      </tbody></table>`;

    expect(syncApi.parseProcessBoxHtml(html)).toEqual([
      {
        suapId: '123',
        numProcesso: '12345.678901.2024-12',
        url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/123/',
      },
      {
        suapId: '456',
        numProcesso: '12345.000001/2025-99',
        url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/456/',
      },
    ]);
  });

  it('interrompe a leitura se o SUAP devolver formulário de login', () => {
    expect(() => syncApi.parseProcessBoxHtml('<form id="login-form"><input type="password"></form>'))
      .toThrow('Sessão do SUAP expirada');
  });
});
