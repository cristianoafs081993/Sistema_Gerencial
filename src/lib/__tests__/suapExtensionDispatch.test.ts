import { describe, expect, it } from 'vitest';

import {
  getSuapExtensionProcessContext,
  isValidSuapExtensionProcessContext,
  SUAP_EXTENSION_ORIGIN,
} from '@/lib/suapExtensionDispatch';

const validMessage = {
  source: 'siages-suap-extension',
  type: 'siages:suap-process-context',
  version: 1,
  payload: {
    suapId: '12345',
    processNumber: '23035.000001.2026-11',
    processUrl: 'https://suap.ifrn.edu.br/processo_eletronico/processo/12345/',
  },
};

describe('suapExtensionDispatch', () => {
  it('aceita somente o contexto de uma pagina de processo do SUAP', () => {
    expect(isValidSuapExtensionProcessContext(validMessage)).toBe(true);
    expect(isValidSuapExtensionProcessContext({
      ...validMessage,
      payload: { ...validMessage.payload, processUrl: 'https://outro.exemplo/processo_eletronico/processo/12345/' },
    })).toBe(false);
    expect(isValidSuapExtensionProcessContext({
      ...validMessage,
      payload: { ...validMessage.payload, suapId: '999' },
    })).toBe(false);
  });

  it('rejeita mensagem de outra origem ou janela e normaliza o numero do processo', () => {
    const expectedSource = window.parent;
    const event = new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN,
      source: expectedSource,
      data: { ...validMessage, payload: { ...validMessage.payload, processNumber: ' 23035.000001.2026-11 ' } },
    });

    expect(getSuapExtensionProcessContext(event, expectedSource)).toEqual({
      suapId: '12345',
      processNumber: '23035.000001.2026-11',
      processUrl: validMessage.payload.processUrl,
    });
    expect(getSuapExtensionProcessContext(new MessageEvent('message', { origin: 'https://invalido.exemplo', source: expectedSource, data: validMessage }), expectedSource)).toBeNull();
    expect(getSuapExtensionProcessContext(event, null)).toBeNull();
  });
});