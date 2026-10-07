import { describe, it, expect } from 'vitest';
import { isAllowedSuapRdUrl, parseFullSuapNe, parseRdMoney, parseSuapRdDetail, parseSuapRdList } from '../suapRdParser';
import { rdListUrl, activityUrl, listHtml, detailHtml } from './suapRdFixtures';

describe('Contratos reais das RDs SUAP', () => {
  it('lê células TH de situação, NE completa e valor confirmado diferente do inicial', () => {
    const rd = parseSuapRdDetail(detailHtml(), '9083', '19');
    expect(rd).toMatchObject({ tipo: 'reforco', valorInicial: 20289.05, valor: 20242.46, processo: '23035.000649.2026-76', campusUasg: '158366' });
    expect(rd.linhas[0]).toMatchObject({ valor: 20242.46, ug: '158366', gestao: '26435', empenhoNumero: '2026NE000014', situacao: 'Confirmada' });
  });
  it('preserva anulação negativa e rejeita sinal positivo', () => {
    expect(parseSuapRdDetail(detailHtml({ type: 'Anulação de empenho', value: '-1.859,51' }), '8968','19').linhas[0].valor).toBe(-1859.51);
    expect(() => parseSuapRdDetail(detailHtml({ type: 'Anulação de empenho' }), '8968','19')).toThrow('Sinal');
  });
  it('aceita canceladas sem coluna situação, mas exige status de linha para concluídas', () => {
    expect(parseSuapRdDetail(detailHtml({ status: 'Cancelada', withStatus: false, ne: '-' }), '5381','19').linhas[0].situacao).toBe('');
    expect(() => parseSuapRdDetail(detailHtml({ withStatus: false }), '9083','19')).toThrow('Cabeçalhos');
  });
  it('aceita RD cancelada sem natureza de despesa e não cria movimentos', () => {
    const html = detailHtml({ status: 'Cancelada' })
      .replace(/<table>[\s\S]*?<\/table>/, '<p class="alert alert-warning">Nenhuma natureza de despesa cadastrada.</p>');
    expect(parseSuapRdDetail(html, '4676', '19')).toMatchObject({ situacao: 'Cancelada', linhas: [] });
    expect(() => parseSuapRdDetail(html.replace('Cancelada', 'Concluída'), '4676', '19')).toThrow('Detalhamento da despesa ausente');
    expect(() => parseSuapRdDetail(html.replace('Nenhuma natureza de despesa cadastrada.', 'Aviso indisponível.'), '4676', '19')).toThrow('Detalhamento da despesa ausente');
  });
  it('lê valor provisório em RD cancelada quando o SUAP não exibe o campo Valor', () => {
    const html = detailHtml({ status: 'Cancelada' }).replace('<h4>Valor</h4>', '<h4>Valor provisório</h4>');
    expect(parseSuapRdDetail(html, '569', '19')).toMatchObject({ situacao: 'Cancelada', valor: 20242.46 });
  });
  it('rejeita divergências de campus, UG, totais e números abreviados', () => {
    expect(() => parseSuapRdDetail(detailHtml(), '9083','25')).toThrow('unidade');
    expect(() => parseSuapRdDetail(detailHtml({ ne: '158371264352026NE000014' }), '9083','19')).toThrow('UG');
    expect(() => parseSuapRdDetail(detailHtml({ total: '20.289,05' }), '9083','19')).toThrow('Total');
    expect(() => parseFullSuapNe('2026NE000014')).toThrow();
    expect(() => parseRdMoney('')).toThrow(); expect(parseRdMoney('R$ -1.859,51')).toBe(-1859.51);
  });
  it('percorre paginação 1-based preservando escopo e exige contagem', () => {
    const parsed = parseSuapRdList(listHtml({ count: 499, next: '?p=2&tab=tab_any_data&unidade_gestora=19' }), rdListUrl, '19');
    expect(parsed.total).toBe(499); expect(parsed.nextUrl).toContain('p=2'); expect(parsed.refs[0].rdId).toBe('9083');
    expect(() => parseSuapRdList(listHtml().replace('Mostrando 1 Requisições de despesas',''),rdListUrl,'19')).toThrow('Contagem');
  });
  it('usa ID da URL oficial e reconhece somente o aviso oficial de atividade vazia', () => {
    expect(parseSuapRdList(listHtml({ activity: true }),activityUrl,'19').activityId).toBe('32635');
    const empty = '<main id="content"><dl><dt>Unidade administrativa</dt><dd>DG/CN</dd><dt>Atividade</dt><dd>Sem despesa</dd></dl><p class="alert alert-warning">Nenhuma requisição de despesa cadastrada.</p></main>';
    expect(parseSuapRdList(empty,activityUrl,'19').refs).toEqual([]);
    expect(() => parseSuapRdList(empty.replace('Nenhuma','Alguma'),activityUrl,'19')).toThrow('Tabela');
  });
  it('rejeita login, host externo, parâmetros extras e edição', () => {
    expect(() => parseSuapRdDetail('<input type="password">','9083','19')).toThrow('Sessão');
    for (const url of ['https://evil.test/plan_estrategico/detalhar_requisicaodespesa/9083/', `${rdListUrl}&unidade_gestora=25`, `${rdListUrl}&p=0`, `${rdListUrl}&q=abc`, 'https://suap.ifrn.edu.br/admin/plan_estrategico/requisicaodespesa/9083/change/']) expect(isAllowedSuapRdUrl(url)).toBe(false);
  });
});
