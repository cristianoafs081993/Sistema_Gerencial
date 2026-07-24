import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildManualDespachoHtml,
  clearDispatchQueue,
  createDispatchQueue,
  createManualDespachoFields,
  isAiAssistedDispatch,
  loadDispatchQueue,
  saveDispatchQueue,
  SUAP_DISPATCH_QUEUE_STORAGE_KEY,
} from '@/lib/suapDispatchGeneration';
import type { SuapProcesso } from '@/types';

const processo: SuapProcesso = {
  id: 'processo-1',
  suapId: '123',
  url: 'https://suap.local/processo/123',
  status: 'success',
  numProcesso: '23035.000123.2026-11',
  beneficiario: 'Fornecedor Teste Ltda',
  assunto: 'Servico de apoio',
  dadosCompletos: { val_nf: '1.250,00', empenhos: ['2026NE000123'] },
};

describe('suapDispatchGeneration', () => {
  beforeEach(() => clearDispatchQueue());

  it('persiste e restaura a fila do lote na sessao', () => {
    const queue = createDispatchQueue([processo, { ...processo, id: 'processo-2' }]);
    queue.currentIndex = 1;
    queue.items[0].status = 'cloned';
    queue.items[0].html = '<p>Despacho revisado</p>';

    saveDispatchQueue(queue);

    expect(loadDispatchQueue()).toEqual(queue);
    clearDispatchQueue();
    expect(loadDispatchQueue()).toBeNull();
  });

  it('ignora estado de sessao invalido', () => {
    sessionStorage.setItem(SUAP_DISPATCH_QUEUE_STORAGE_KEY, '{invalido');
    expect(loadDispatchQueue()).toBeNull();
  });

  it('identifica extracao completa ou parcial como modo assistido', () => {
    expect(isAiAssistedDispatch(processo)).toBe(true);
    expect(isAiAssistedDispatch({ ...processo, status: 'incomplete_extraction' })).toBe(true);
    expect(isAiAssistedDispatch({ ...processo, status: 'queued_extraction' })).toBe(false);
  });

  it('preenche o formulario manual com os dados disponiveis do processo', () => {
    expect(createManualDespachoFields(processo)).toMatchObject({
      processo: '23035.000123.2026-11',
      favorecido: 'Fornecedor Teste Ltda',
      descricao: 'Servico de apoio',
      valor: '1.250,00',
      empenho: '2026NE000123',
    });
  });

  it('gera marcadores no despacho manual para dados pendentes', () => {
    const html = buildManualDespachoHtml({
      ...createManualDespachoFields(processo),
      favorecido: '',
      valor: '',
      empenho: '',
    });

    expect(html).toContain('[favorecido]');
    expect(html).toContain('[valor da liquidacao]');
    expect(html).toContain('[empenho]');
  });
});
