import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildManualDespachoHtml,
  clearDispatchQueue,
  createDispatchQueue,
  createManualDespachoFields,
  createManualDespachoFieldsFromResolvedContext,
  inferManualDespachoFinalidade,
  isAiAssistedDispatch,
  createStandaloneDispatchQueue,
  createStandaloneManualDespachoFields,
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


  it('persiste e restaura o despacho avulso na sessao', () => {
    const queue = createStandaloneDispatchQueue();
    saveDispatchQueue(queue);

    expect(loadDispatchQueue()).toEqual(queue);
    expect(queue.items[0]).toMatchObject({ standalone: true });
    expect(queue.items[0]).not.toHaveProperty('processId');
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
      finalidade: 'servico',
      processo: '23035.000123.2026-11',
      favorecido: 'Fornecedor Teste Ltda',
      descricao: 'Servico de apoio',
      valor: '1.250,00',
      empenho: '2026NE000123',
    });
  });

  it('classifica aquisicoes e servicos em modelos distintos', () => {
    expect(inferManualDespachoFinalidade({
      tipoPessoa: 'PJ',
      favorecido: 'Fornecedor Teste Ltda',
      objeto: 'Compra de equipamentos de informatica',
      projeto: undefined,
    })).toBe('aquisicao');
    expect(inferManualDespachoFinalidade({
      tipoPessoa: 'PJ',
      favorecido: 'Fornecedor Teste Ltda',
      objeto: 'Servico de manutencao preventiva',
      projeto: undefined,
    })).toBe('servico');
  });


  it('deriva campos manuais do contexto resolvido para permitir troca de modelo', () => {
    expect(inferManualDespachoFinalidade({
      tipoPessoa: 'PF',
      favorecido: 'Maria da Silva',
      objeto: 'Bolsa estudantil',
      projeto: undefined,
    })).toBe('bolsa-sem-projeto');

    const fields = createManualDespachoFieldsFromResolvedContext({
      documentType: 'despacho-liquidacao',
      candidateId: 'ctx-1',
      title: 'Despacho',
      subtitle: 'Teste',
      processo: '23035.000123.2026-11',
      favorecido: 'Maria da Silva',
      documentoFavorecido: '12345678900',
      tipoPessoa: 'PF',
      empenho: '2026NE000123',
      valor: 1250,
      objeto: 'Bolsa estudantil',
      fields: [],
      missingRequiredFields: [],
      warnings: [],
      matchedFrom: ['Espelho SUAP'],
    });

    expect(fields).toMatchObject({
      finalidade: 'bolsa-sem-projeto',
      processo: '23035.000123.2026-11',
      favorecido: 'Maria da Silva',
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

  it('gera o texto especifico de aquisicao e preserva o texto atual de servico', () => {
    const aquisicao = buildManualDespachoHtml({
      ...createStandaloneManualDespachoFields(),
      finalidade: 'aquisicao',
      processo: '23035.000123.2026-11',
      favorecido: 'Fornecedor Teste',
      descricao: 'equipamentos de informatica',
      valor: '1.250,00',
      empenho: '2026NE000123',
    });
    const servico = buildManualDespachoHtml({
      ...createStandaloneManualDespachoFields(),
      finalidade: 'servico',
      processo: '23035.000123.2026-11',
      favorecido: 'Fornecedor Teste',
      descricao: 'manutencao preventiva',
      valor: '1.250,00',
      empenho: '2026NE000123',
    });

    expect(aquisicao).toContain('ateste do recebimento do objeto adquirido');
    expect(aquisicao).toContain('destinado a este <i>Campus</i> Currais Novos (Processo n&ordm; <b>23035.000123.2026-11</b>)');
    expect(aquisicao).toContain('<b>equipamentos de informatica</b>');
    expect(servico).toContain('ateste da prestacao de servicos de <b>manutencao preventiva</b>');
    expect(servico).not.toContain('recebimento do objeto adquirido');
  });

  it('omite a referencia ao processo no despacho avulso e a inclui quando informada', () => {
    const fields = {
      ...createStandaloneManualDespachoFields(),
      favorecido: 'Fornecedor Teste',
      descricao: 'Servico de apoio',
      valor: '1.250,00',
      empenho: '2026NE000123',
    };

    expect(buildManualDespachoHtml(fields)).not.toContain('Processo n.');
    expect(buildManualDespachoHtml(fields)).not.toContain('encaminhe-se o processo');
    expect(buildManualDespachoHtml({ ...fields, processo: '23035.000123.2026-11' })).toContain('Processo n. <b>23035.000123.2026-11</b>');
  });

  it('migra filas salvas do modelo contrato para servico ou aquisicao', () => {
    const legacyServiceFields = {
      ...createStandaloneManualDespachoFields(),
      finalidade: 'contrato',
      tipo: 'servico',
      descricao: 'Manutencao preventiva',
    };
    const legacyAcquisitionFields = {
      ...createStandaloneManualDespachoFields(),
      finalidade: 'contrato',
      tipo: 'aquisicao',
      descricao: 'Compra de materiais',
    };
    sessionStorage.setItem(SUAP_DISPATCH_QUEUE_STORAGE_KEY, JSON.stringify({
      version: 1,
      currentIndex: 0,
      items: [
        { standalone: true, status: 'pending', manualFields: legacyServiceFields },
        { standalone: true, status: 'pending', manualFields: legacyAcquisitionFields },
      ],
    }));

    const migratedItems = loadDispatchQueue()?.items;

    expect(migratedItems?.[0].manualFields).toMatchObject({ finalidade: 'servico', descricao: 'Manutencao preventiva' });
    expect(migratedItems?.[1].manualFields).toMatchObject({ finalidade: 'aquisicao', descricao: 'Compra de materiais' });
    expect(migratedItems?.[0].manualFields).not.toHaveProperty('tipo');
    expect(migratedItems?.[1].manualFields).not.toHaveProperty('tipo');
  });
});
