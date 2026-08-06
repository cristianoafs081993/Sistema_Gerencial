import { describe, expect, it } from 'vitest';

import {
  classifySuapProcessDocument,
  parseSuapProcessDocumentManifest,
  runWithConcurrency,
  toSuapDocumentOriginalPath,
} from '@/lib/suapProcessDocuments';
import { isAllowedSuapProxyPath, isSuapOriginalDocumentPath } from '../../../supabase/functions/_shared/suap_proxy_paths';

describe('documentos individuais do processo SUAP', () => {
  it('classifica exclusões em português independentemente de acentos e mantém desconhecidos', () => {
    expect(classifySuapProcessDocument('IMR')).toMatchObject({ classification: 'excluded', reason: 'imr' });
    expect(classifySuapProcessDocument('CERTIDÕES E DOCUMENTAÇÃO COMPLEMENTAR')).toMatchObject({
      classification: 'excluded', reason: 'certidoes_ou_documentacao_complementar',
    });
    expect(classifySuapProcessDocument('Conta-Vinculada — junho')).toMatchObject({
      classification: 'excluded', reason: 'conta_vinculada',
    });
    expect(classifySuapProcessDocument('Relatório de Recebimento Provisório')).toMatchObject({
      classification: 'excluded', reason: 'relatorio_recebimento_provisorio',
    });
    expect(classifySuapProcessDocument('Folhas de Pagamento dos funcionários')).toMatchObject({
      classification: 'excluded', reason: 'folha_pagamento',
    });
    expect(classifySuapProcessDocument('Nota Fiscal 713')).toMatchObject({ classification: 'included' });
  });

  it('extrai links diretos, preserva a ordem e considera o contexto do cartao', () => {
    const manifest = parseSuapProcessDocumentManifest(`
      <a href="/documento_eletronico/visualizar_documento_digitalizado/2673349/"><strong>NOTA FISCAL:</strong> Nota Fiscal 713</a>
      <a href="https://suap.ifrn.edu.br/documento_eletronico/visualizar_documento/2673350/?foo=bar"><strong>IMR:</strong> IMR</a>
      <div>
        <span>Relat&#243;rio de Recebimento Provis&#243;rio</span>
        <a href="/documento_eletronico/visualizar_documento/2673351/">Relat&#243;rio: Relat&#243;rio 86/2026</a>
      </div>
      <a href="https://malicioso.example/documento_eletronico/visualizar_documento/4/">Ignorar</a>
    `);

    expect(manifest).toHaveLength(3);
    expect(manifest.map((document) => document.originalPath)).toEqual([
      '/documento_eletronico/visualizar_documento_digitalizado/2673349/?original=sim',
      '/documento_eletronico/visualizar_documento/2673350/?original=sim',
      '/documento_eletronico/visualizar_documento/2673351/?original=sim',
    ]);
    expect(manifest.map((document) => document.classification)).toEqual(['included', 'excluded', 'excluded']);
    expect(toSuapDocumentOriginalPath('https://malicioso.example/documento_eletronico/visualizar_documento/4/')).toBeNull();
  });

  it('respeita o limite de quatro downloads concorrentes', async () => {
    let active = 0;
    let maximum = 0;
    const tasks = Array.from({ length: 9 }, (_, index) => async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return index;
    });

    const result = await runWithConcurrency(tasks, 4);
    expect(maximum).toBe(4);
    expect(result.rejected).toEqual([]);
    expect(result.fulfilled.sort((a, b) => a - b)).toEqual(Array.from({ length: 9 }, (_, index) => index));
  });

  it('não permite URLs arbitrárias no proxy do SUAP', () => {
    expect(isAllowedSuapProxyPath('/processo_eletronico/processo/489731/')).toBe(true);
    expect(isAllowedSuapProxyPath('/documento_eletronico/visualizar_documento_digitalizado/2673349/?original=sim')).toBe(true);
    expect(isSuapOriginalDocumentPath('/documento_eletronico/visualizar_documento_digitalizado/2673349/?original=sim')).toBe(true);
    expect(isAllowedSuapProxyPath('/documento_eletronico/visualizar_documento_digitalizado/2673349/')).toBe(false);
    expect(isAllowedSuapProxyPath('https://malicioso.example/processo_eletronico/processo/489731/')).toBe(false);
    expect(isAllowedSuapProxyPath('https://suap.ifrn.edu.br/documento_eletronico/visualizar_documento/1/?original=sim&next=/')).toBe(false);
  });
});