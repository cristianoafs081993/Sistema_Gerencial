import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildDespachoLiquidacaoHtml, type ResolvedDocumentContext } from '@/lib/documentGeneration';
import {
  DESPACHO_FINALIDADES,
  DESPACHO_TEMPLATE_DEFAULTS,
  despachoTemplateText,
  renderDespachoTemplate,
} from '@/lib/despachoModelo';
import { sanitizeDespachoModelo } from '@/lib/suapExtensionDispatch';
import { buildManualDespachoHtml, createStandaloneManualDespachoFields } from '@/lib/suapDispatchGeneration';
import { extensionFixturePath } from '@/test/extensionFixtures';

type ExtensionPreferences = {
  DESPACHO_MODELOS: Array<{ id: string; label: string }>;
  defaultDespachoTemplate: (finalidade: string) => Record<string, string>;
  despachoModelo: (raw: unknown) => unknown;
};

const context: ResolvedDocumentContext = {
  documentType: 'despacho-liquidacao',
  candidateId: 'ctx-1',
  title: 'DH 123',
  subtitle: 'Teste',
  processo: '23035.000123/2026-11',
  favorecido: 'Empresa Teste Ltda',
  documentoFavorecido: '12345678000190',
  tipoPessoa: 'PJ',
  empenho: '2026NE000123',
  valor: 15234.56,
  objeto: 'manutencao predial',
  fields: [],
  missingRequiredFields: [],
  warnings: [],
  matchedFrom: ['Documentos habeis'],
};

let extension: ExtensionPreferences;

beforeAll(() => {
  window.eval(readFileSync(extensionFixturePath('user-preferences.js'), 'utf8'));
  extension = (globalThis as unknown as { SiagesUserPreferences: ExtensionPreferences }).SiagesUserPreferences;
});

describe('modelos do despacho de liquidação', () => {
  it('troca variáveis, some com trechos opcionais vazios e marca o que falta', () => {
    const html = renderDespachoTemplate(
      'Ao Campus {campus}: pague {favorecido}[[, contrato {contrato}]][[ (Processo nº {processo})]], **AUTORIZO** {valor} <script>.\nFim {desconhecida}',
      { campus: 'Mossoró', favorecido: 'ANA & CIA', processo: '23035.1', valor: '' },
    );
    expect(html).toBe('Ao <i>Campus</i> Mossoró: pague <b>ANA &amp; CIA</b> (Processo nº <b>23035.1</b>), <b>AUTORIZO</b> <b>[valor da liquidação]</b> &lt;script&gt;.<br>Fim {desconhecida}');
  });

  it('usa o modelo personalizado da finalidade e mantém o texto atual nas demais', () => {
    const modelo = {
      campus: 'Mossoró',
      fecho: 'Respeitosamente,',
      modelos: { servico: { corpo: 'Pague-se a {favorecido} o valor de {valor} pelo empenho {empenho}[[ (contrato {contrato})]].', assunto: 'Liquidação de {objeto}' } },
    };
    const servico = buildDespachoLiquidacaoHtml(context, modelo);
    expect(servico).toContain('Pague-se a <b>EMPRESA TESTE LTDA</b> o valor de <b>R$');
    expect(servico).toContain('pelo empenho <b>2026NE000123</b>.');
    expect(servico).toContain('Assunto: Liquidação de <b>manutencao predial</b>');
    // Texto comum do formato anterior continua valendo onde a finalidade não mudou.
    expect(servico).toContain('<div style="margin-top: 40px;">Respeitosamente,</div>');
    expect(servico).toContain('À Coordenação de Finanças e Contratos do <i>Campus</i> Mossoró');

    const aquisicao = buildDespachoLiquidacaoHtml({ ...context, objeto: 'aquisicao de material de expediente' }, modelo);
    expect(aquisicao).toContain('Considerando a regularidade');
    expect(aquisicao).not.toContain('Pague-se');
  });

  it('aplica o modelo personalizado no despacho manual, inclusive de auxílios', () => {
    const fields = { ...createStandaloneManualDespachoFields(), finalidade: 'pafe' as const, valor: '400,00', empenho: '2026ne000010' };
    const html = buildManualDespachoHtml(fields, {
      modelos: { pafe: { corpo: 'PAFE: {valor} no empenho {empenho}[[ do processo {processo}]].', encaminhamento: 'Encaminhe-se à DIAE.' } },
    });
    expect(html).toContain('PAFE: <b>400,00</b> no empenho <b>2026NE000010</b>.');
    expect(html).toContain('Encaminhe-se à DIAE.');
    expect(html).not.toContain('do processo');
  });

  it('recebe da extensão só finalidades e campos conhecidos', () => {
    expect(sanitizeDespachoModelo({
      fecho: ' Respeitosamente, ',
      modelos: {
        pafe: { corpo: '  Texto {valor} ', extra: 'x', fecho: 7 },
        inexistente: { corpo: 'x' },
        servico: { corpo: 'y'.repeat(2500) },
        projeto: 'texto solto',
      },
    })).toEqual({
      fecho: 'Respeitosamente,',
      modelos: { pafe: { corpo: 'Texto {valor}' }, servico: { corpo: 'y'.repeat(2000) } },
    });
    expect(despachoTemplateText({ fecho: 'Comum' }, 'pafe', 'fecho')).toBe('Comum');
    expect(despachoTemplateText({ fecho: 'Comum' }, 'pafe', 'corpo')).toBeUndefined();
  });

  it('mostra no popup o mesmo texto padrão que o SIAGES usa', () => {
    expect(extension.DESPACHO_MODELOS.map((modelo) => modelo.id)).toEqual([...DESPACHO_FINALIDADES]);
    for (const finalidade of DESPACHO_FINALIDADES) {
      expect(extension.defaultDespachoTemplate(finalidade)).toEqual(DESPACHO_TEMPLATE_DEFAULTS[finalidade]);
    }
  });

  it('o padrão renderizado reproduz o despacho atual de serviço, aquisição e bolsas', () => {
    const texto = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim();
    const cases: Array<[typeof DESPACHO_FINALIDADES[number], ResolvedDocumentContext]> = [
      ['servico', { ...context, contrato: undefined }],
      ['servico', { ...context, contrato: '12/2026' }],
      ['aquisicao', { ...context, objeto: 'aquisicao de material de expediente' }],
      ['projeto', { ...context, tipoPessoa: 'PF', favorecido: 'Maria Silva', objeto: 'bolsa de pesquisa', projeto: 'Robótica Educacional', edital: '01/2026' }],
      ['bolsa-sem-projeto', { ...context, tipoPessoa: 'PF', favorecido: 'Maria Silva', objeto: 'bolsa de monitoria' }],
    ];
    for (const [finalidade, item] of cases) {
      const atual = buildDespachoLiquidacaoHtml(item);
      // Espaço no fim força o caminho do modelo, com o mesmo texto padrão.
      const peloModelo = buildDespachoLiquidacaoHtml(item, { modelos: { [finalidade]: { corpo: `${DESPACHO_TEMPLATE_DEFAULTS[finalidade].corpo} ` } } });
      expect(texto(peloModelo), finalidade).toBe(texto(atual));
    }
  });
});
