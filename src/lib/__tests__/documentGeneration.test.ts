import { describe, expect, it } from 'vitest';

import {
  buildDespachoLiquidacaoHtml,
  extractProcessNumbers,
  parseDocumentIntent,
  type ResolvedDocumentContext,
} from '@/lib/documentGeneration';

const baseContext: ResolvedDocumentContext = {
  documentType: 'despacho-liquidacao',
  candidateId: 'ctx-1',
  title: 'DH 123',
  subtitle: 'Teste',
  processo: '23035.000123/2026-11',
  favorecido: 'Empresa Teste Ltda',
  documentoFavorecido: '12345678000190',
  tipoPessoa: 'PJ',
  contrato: '12/2026',
  empenho: '2026NE000123',
  valor: 15234.56,
  objeto: 'manutencao predial',
  fields: [],
  missingRequiredFields: [],
  warnings: [],
  matchedFrom: ['Documentos habeis'],
};

describe('parseDocumentIntent', () => {
  it('reconhece busca por processo', () => {
    const result = parseDocumentIntent('gerar despacho de liquidacao do processo 23035.000123/2026-11');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.lookupType).toBe('processo');
    expect(result.intent.lookupValue).toBe('23035.000123/2026-11');
  });

  it('retorna erro quando nao encontra processo valido', () => {
    const result = parseDocumentIntent('gerar despacho de liquidacao para o caso pendente');
    expect(result.ok).toBe(false);
  });
});

describe('extractProcessNumbers', () => {
  it('extrai um ou mais processos sem duplicar valores', () => {
    const result = extractProcessNumbers(`
      23035.000123/2026-11
      23035.000124/2026-11
      Processo repetido 23035.000123/2026-11
    `);

    expect(result).toEqual(['23035.000123/2026-11', '23035.000124/2026-11']);
  });

  it('reconhece o formato de processo sincronizado do suap', () => {
    const result = extractProcessNumbers('23035.001016.2026-85');
    expect(result).toEqual(['23035.001016.2026-85']);
  });
});

describe('buildDespachoLiquidacaoHtml', () => {
  it('gera minuta para PJ com modelo de servico', () => {
    const html = buildDespachoLiquidacaoHtml(baseContext);
    expect(html).toContain('AUTORIZO');
    expect(html).toContain('2026NE000123');
    expect(html).toContain('EMPRESA TESTE LTDA');
    expect(html).toContain('em favor de');
    expect(html).not.toContain('em favor da empresa');
  });

  it('gera placeholders quando faltam campos obrigatorios', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      favorecido: undefined,
      empenho: undefined,
      valor: undefined,
    });
    expect(html).toContain('[favorecido]');
    expect(html).toContain('[empenho]');
    expect(html).toContain('[valor da liquidacao]');
  });

  it('normaliza o empenho longo e evita duplicar o contrato no texto', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      contrato: '00030/2026',
      empenho: '158366264352025NE000297',
      objeto: 'PAGAMENTO DE FORNECIMENTO DE GENEROS ALIMENTICIOS. CONTRATO 00030/2026.',
    });

    expect(html).toContain('2025NE000297');
    expect(html).not.toContain('158366264352025NE000297');
    expect(html).toContain('referente ao contrato <b>00030/2026</b>');
    expect(html).not.toContain('<b>Contrato:</b>');
    expect((html.match(/00030\/2026/g) || []).length).toBe(1);
  });

  it('remove prefixos redundantes do objeto em aquisicao', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      objeto: 'Pagamento de fornecimento de generos alimenticios para merenda escolar',
    });

    expect(html).toContain('ateste do fornecimento de <b>generos alimenticios para merenda escolar</b>');
    expect(html).not.toContain('Pagamento de fornecimento');
    expect(html).not.toContain('fornecimento de <b>fornecimento');
  });

  it('usa a redacao revisada para bolsa', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      tipoPessoa: 'PF',
      favorecido: 'Maria da Silva',
      documentoFavorecido: '12345678900',
      objeto: 'Bolsa de extensao',
      projeto: 'Projeto Integrador',
      edital: '12/2025',
    });

    expect(html).toContain('ateste da execu&ccedil;&atilde;o das atividades');
    expect(html).toContain('referente ao empenho');
    expect(html).toContain('no &acirc;mbito do projeto');
    expect(html).toContain('Edital n&ordm; <b>12/2025</b>');
  });

  it('usa modelo de bolsa sem projeto quando nao ha projeto', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      tipoPessoa: 'PF',
      favorecido: 'Maria da Silva',
      documentoFavorecido: '12345678900',
      objeto: 'Bolsa estudantil',
      projeto: undefined,
      edital: undefined,
    });

    expect(html).toContain('ateste da execu&ccedil;&atilde;o das atividades');
    expect(html).toContain('MARIA DA SILVA');
    expect(html).toContain('23035.000123/2026-11');
    expect(html).toContain('15.234,56');
    expect(html).toContain('2026NE000123');
    expect(html).not.toContain('no &acirc;mbito do projeto');
    expect(html).not.toContain('Edital');
    expect(html).not.toContain('[nome do projeto]');
    expect(html).not.toContain('[numero do edital]');
  });

  it('trata folha de pagamento como categoria bolsa e usa redacao amigavel', () => {
    const html = buildDespachoLiquidacaoHtml({
      ...baseContext,
      favorecido: 'VÁRIOS (FOLHA DE PAGAMENTO)',
    });

    // Como é folha de pagamento, deve ser inferido como bolsa e usar a redação correspondente
    expect(html).toContain('pelos estudantes presentes na folha de pagamento');
    expect(html).not.toContain('pelo(s) bolsista(s)');
    expect(html).not.toContain('VÁRIOS (FOLHA DE PAGAMENTO)');
    expect(html).not.toContain('em favor de'); // A minuta de bolsa não tem "em favor de" no final
  });

  it('mantem redacao original de servico/aquisicao para favorecidos comuns', () => {
    const html = buildDespachoLiquidacaoHtml(baseContext); // favorecido: 'Empresa Teste Ltda'

    expect(html).toContain('em favor de <b>EMPRESA TESTE LTDA</b>');
    expect(html).not.toContain('estudantes presentes na folha de pagamento');
  });
});
