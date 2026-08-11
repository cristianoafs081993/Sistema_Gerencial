import { describe, expect, it } from 'vitest';

import {
  getSuapExtensionPlanContext,
  getSuapExtensionDocumentAnalysisContext,
  getSuapExtensionProcessContext,
  isValidSuapExtensionPlanContext,
  isValidSuapExtensionPlanSummaryPayload,
  isValidSuapExtensionProcessContext,
  isValidSuapExtensionProcessPdfResult,
  isValidSuapExtensionProcessRetry,
  isValidSuapExtensionDocumentAnalysisContext,
  isValidSuapExtensionDocumentPdfResult,
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

const validPlanMessage = {
  source: 'siages-suap-extension',
  type: 'siages:suap-plan-context',
  version: 1,
  payload: {
    planId: 8,
    planUrl: 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/8/',
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

  it('aceita somente o contexto do plano concluído 8 enviado pelo SUAP', () => {
    const expectedSource = window.parent;
    const event = new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN,
      source: expectedSource,
      data: validPlanMessage,
    });

    expect(isValidSuapExtensionPlanContext(validPlanMessage)).toBe(true);
    expect(isValidSuapExtensionPlanContext({
      ...validPlanMessage,
      payload: { ...validPlanMessage.payload, planId: 7 },
    })).toBe(false);
    expect(isValidSuapExtensionPlanContext({
      ...validPlanMessage,
      payload: { ...validPlanMessage.payload, planUrl: 'https://suap.ifrn.edu.br/plan_estrategico/plano_concluido/7/' },
    })).toBe(false);
    expect(getSuapExtensionPlanContext(event, expectedSource)).toEqual(validPlanMessage.payload);
    expect(getSuapExtensionPlanContext(new MessageEvent('message', {
      origin: 'https://invalido.exemplo', source: expectedSource, data: validPlanMessage,
    }), expectedSource)).toBeNull();
  });

  it('valida o payload serializavel do resumo antes de entrega-lo a extensao', () => {
    const payload = {
      planId: 8,
      dimensoes: [{
        key: 'EN', dimensao: 'Ensino', totalPlanejado: 100, totalDescentralizado: 60,
        aDescentralizar: 40, totalEmpenhado: 20, aEmpenhar: 40,
        atividades: [], descentralizacoes: [], empenhos: [],
      }],
    };

    expect(isValidSuapExtensionPlanSummaryPayload(payload)).toBe(true);
    expect(isValidSuapExtensionPlanSummaryPayload({ ...payload, planId: 7 })).toBe(false);
    expect(isValidSuapExtensionPlanSummaryPayload({
      ...payload,
      dimensoes: [{ ...payload.dimensoes[0], totalPlanejado: '100' }],
    })).toBe(false);
  });

  it('aceita PDF e nova tentativa somente da janela, origem e processo esperados', () => {
    const expectedSource = window.parent;
    const pdfMessage = {
      source: 'siages-suap-extension',
      type: 'siages:suap-process-pdf-result',
      version: 1,
      payload: { suapId: '12345', bytes: new ArrayBuffer(8) },
    };
    const retryMessage = {
      source: 'siages-suap-extension',
      type: 'siages:suap-process-retry',
      version: 1,
      payload: { suapId: '12345' },
    };

    expect(isValidSuapExtensionProcessPdfResult(new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: pdfMessage,
    }), expectedSource, '12345')).toBe(true);
    expect(isValidSuapExtensionProcessPdfResult(new MessageEvent('message', {
      origin: 'https://invalido.exemplo', source: expectedSource, data: pdfMessage,
    }), expectedSource, '12345')).toBe(false);
    expect(isValidSuapExtensionProcessRetry(new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: retryMessage,
    }), expectedSource, '12345')).toBe(true);
    expect(isValidSuapExtensionProcessRetry(new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: retryMessage,
    }), expectedSource, '999')).toBe(false);
  });

  it('valida o contexto de análise e mantém o PDF preso ao documento selecionado', () => {
    const expectedSource = window.parent;
    const contextMessage = {
      source: 'siages-suap-extension',
      type: 'siages:suap-document-analysis-context',
      version: 1,
      payload: {
        suapId: '12345',
        processNumber: '23035.000001.2026-11',
        processUrl: 'https://suap.ifrn.edu.br/processo_eletronico/processo/12345/',
        documentId: '987',
        documentTitle: 'Termo de Referência: TR 2/2026',
        documentType: 'tr',
        documentOriginalPath: '/documento_eletronico/visualizar_documento/987/?original=sim',
      },
    };
    const event = new MessageEvent('message', { origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: contextMessage });

    expect(isValidSuapExtensionDocumentAnalysisContext(contextMessage)).toBe(true);
    expect(getSuapExtensionDocumentAnalysisContext(event, expectedSource)).toMatchObject({ documentId: '987', documentType: 'tr' });
    expect(isValidSuapExtensionDocumentAnalysisContext({
      ...contextMessage,
      payload: { ...contextMessage.payload, documentOriginalPath: 'https://evil.example/987.pdf' },
    })).toBe(false);

    const pdfMessage = {
      source: 'siages-suap-extension',
      type: 'siages:suap-document-pdf-result',
      version: 1,
      payload: { suapId: '12345', documentId: '987', bytes: new ArrayBuffer(8) },
    };
    expect(isValidSuapExtensionDocumentPdfResult(new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: pdfMessage,
    }), expectedSource, '12345', '987')).toBe(true);
    expect(isValidSuapExtensionDocumentPdfResult(new MessageEvent('message', {
      origin: SUAP_EXTENSION_ORIGIN, source: expectedSource, data: pdfMessage,
    }), expectedSource, '12345', '999')).toBe(false);
  });
});
