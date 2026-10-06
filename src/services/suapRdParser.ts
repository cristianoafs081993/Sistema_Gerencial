import { getSuapPlanUnit, SUAP_PLAN_UNITS } from '../lib/suapPlanUnits.ts';

export const SUAP_RD_ORIGIN = 'https://suap.ifrn.edu.br';
export type SuapRdType = 'dotacao' | 'reforco' | 'anulacao';
export type SuapRdRef = { rdId: string; numero: string; situacao: string; tipo: string; rowFingerprint?: string };
export type SuapRdLine = {
  naturezaDespesa: string; valor: number; empenhoCompleto: string | null;
  empenhoNumero: string | null; ug: string | null; gestao: string | null;
  ro: string | null; situacao: string;
};
export type SuapRdDetail = {
  rdId: string; numero: string; situacao: string; tipo: SuapRdType | null;
  tipoRaw: string; suapUnitCode: string; campusUasg: string; activityName: string;
  origemRecurso: string; planoInterno: string; processo: string; processoUrl: string | null;
  finalidade: string; cdo: string | null; cdoUrl: string | null;
  valorInicial: number; valor: number; linhas: SuapRdLine[]; sourceUrl: string;
};
type ParserConstructor = new () => { parseFromString(html: string, type: string): Document | null };
const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
export const foldRdText = (value: string) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseRdMoney(value: string): number {
  const text = clean(value).replace(/^R\$\s*/, '');
  if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(text)) throw new Error(`Valor SUAP inválido: ${text || 'ausente'}.`);
  return Math.round(Number(text.replace(/\./g, '').replace(',', '.')) * 100) / 100;
}

export function parseFullSuapNe(value: string) {
  const text = clean(value).toUpperCase();
  if (!text || text === '-') return null;
  const match = /^(\d{6})(\d{5})(\d{4}NE\d{6})$/.exec(text);
  if (!match) throw new Error('Número completo da NE inválido no SUAP.');
  return { completo: text, ug: match[1], gestao: match[2], numero: match[3] };
}

export function isAllowedSuapRdUrl(value: string): boolean {
  try {
    const url = new URL(value, SUAP_RD_ORIGIN);
    if (url.origin !== SUAP_RD_ORIGIN || url.hash || url.username || url.password) return false;
    if (/^\/plan_estrategico\/(?:detalhar_requisicaodespesa\/\d+|listar_requisicoes_despesa\/8\/\d+)\/$/.test(url.pathname)) {
      return [...url.searchParams].every(([key, val]) => key === 'p' && /^[1-9]\d*$/.test(val)) && [...url.searchParams].length <= 1;
    }
    if (url.pathname !== '/admin/plan_estrategico/requisicaodespesa/') return false;
    const pairs = [...url.searchParams];
    if (new Set(pairs.map(([key]) => key)).size !== pairs.length) return false;
    return Boolean(getSuapPlanUnit(url.searchParams.get('unidade_gestora')))
      && pairs.every(([key, val]) => (key === 'unidade_gestora' && !!getSuapPlanUnit(val))
        || (key === 'tab' && val === 'tab_any_data') || (key === 'p' && /^[1-9]\d*$/.test(val)));
  } catch { return false; }
}

function readDocument(html: string, Parser: ParserConstructor): Document {
  const doc = new Parser().parseFromString(html, 'text/html');
  if (!doc || doc.querySelector('input[type="password"], form[action*="/accounts/login/"]')) throw new Error('Sessão do SUAP expirada.');
  return doc;
}

function field(root: ParentNode, label: string): Element | null {
  const dt = [...root.querySelectorAll('dt')].find(item => foldRdText(item.textContent ?? '').replace(/\s*:\s*$/, '') === foldRdText(label));
  return dt?.nextElementSibling?.tagName === 'DD' ? dt.nextElementSibling : dt?.parentElement?.querySelector('dd') ?? null;
}

export function assertRdUnit(text: string, unitCode: string) {
  const unit = getSuapPlanUnit(unitCode);
  const code = clean(text).split(/\s+-\s+/)[0];
  if (!unit || code !== unit.code) throw new Error('A unidade da página SUAP não corresponde ao campus/unidade solicitado.');
  return unit;
}

export function parseSuapRdList(html: string, sourceUrl: string, unitCode: string, Parser: ParserConstructor = DOMParser) {
  if (!isAllowedSuapRdUrl(sourceUrl)) throw new Error('URL de RDs não permitida.');
  const url = new URL(sourceUrl);
  const doc = readDocument(html, Parser);
  const root = doc.querySelector('#content') ?? doc;
  const activityPage = url.pathname.includes('/listar_requisicoes_despesa/');
  if (activityPage) assertRdUnit(field(root, 'Unidade administrativa')?.textContent ?? '', unitCode);
  else {
    if (url.searchParams.get('unidade_gestora') !== unitCode) throw new Error('Unidade da URL divergente.');
    const selected = doc.querySelector('select[name^="unidade_gestora"] option[selected]');
    if (selected) assertRdUnit(selected.textContent ?? '', unitCode);
  }
  const refs: SuapRdRef[] = [];
  const table = [...root.querySelectorAll('table')].find(t => foldRdText(t.querySelector('thead')?.textContent ?? t.querySelector('tr')?.textContent ?? '').includes('da requisicao'));
  if (!table) {
    const empty = [...root.querySelectorAll('.alert')].some(e => clean(e.textContent) === 'Nenhuma requisição de despesa cadastrada.');
    if (activityPage && empty && field(root, 'Atividade')) return { refs, total: 0, nextUrl: null,
      activityName: clean(field(root, 'Atividade')?.textContent), activityId: url.pathname.split('/')[4] };
    throw new Error('Tabela de requisições SUAP ausente.');
  }
  const headers = [...table.querySelectorAll('thead th')].map(th => foldRdText(th.textContent ?? ''));
  const col = (needle: string) => headers.findIndex(h => h.includes(needle));
  for (const tr of table.querySelectorAll('tbody tr')) {
    const a = tr.querySelector('a[href*="/plan_estrategico/detalhar_requisicaodespesa/"]');
    if (!a) continue;
    const cells = [...tr.querySelectorAll('td,th')].map(cell => clean(cell.textContent));
    const rdId = a.getAttribute('href')?.match(/detalhar_requisicaodespesa\/(\d+)\//)?.[1];
    const numero = cells[col('da requisicao')] ?? '';
    if (!rdId || !/^\d{4}RD\d{6}$/.test(numero)) throw new Error('Identidade de RD inválida.');
    const rowUnit = cells[col('unidade')] ?? '';
    assertRdUnit(rowUnit, unitCode);
    // The collector hashes this canonical row before persisting it; action links are not data.
    const rowFingerprint = JSON.stringify(headers.flatMap((header,index) =>
      !header || header.includes('situacao') || /^(#|acoes|opcoes)$/.test(header) ? [] : [[header,cells[index] ?? '']]));
    refs.push({ rdId, numero, situacao: cells[col('situacao')] ?? '', tipo: cells[col('tipo')] ?? '', rowFingerprint });
  }
  if (new Set(refs.map(rd => rd.rdId)).size !== refs.length) throw new Error('RD duplicada na página.');
  const currentPage = Number(url.searchParams.get('p') || 1);
  const next = [...root.querySelectorAll('a[href]')].map(a => new URL(a.getAttribute('href')!, url))
    .filter(nextUrl => nextUrl.pathname === url.pathname && Number(nextUrl.searchParams.get('p')) === currentPage + 1)
    .find(nextUrl => isAllowedSuapRdUrl(nextUrl.href));
  const countMatch = clean(root.textContent).match(/Mostrando\s+(\d+)\s+Requisi/i);
  if (!activityPage && !countMatch) throw new Error('Contagem do inventário de RDs ausente.');
  return { refs, total: countMatch ? Number(countMatch[1]) : refs.length, nextUrl: next?.href ?? null,
    activityName: clean(field(root, 'Atividade')?.textContent), activityId: activityPage ? url.pathname.split('/')[4] : null };
}

export function parseSuapRdDetail(html: string, rdId: string, unitCode: string, Parser: ParserConstructor = DOMParser): SuapRdDetail {
  const doc = readDocument(html, Parser);
  const root = doc.querySelector('#content') ?? doc;
  const heading = [...root.querySelectorAll('h2')].find(h => /Requisição Nº\s+\d{4}RD\d{6}/i.test(clean(h.textContent)));
  const numero = clean(heading?.textContent).match(/\d{4}RD\d{6}/)?.[0];
  if (!numero || !/^\d+$/.test(rdId)) throw new Error('Detalhe de RD inválido.');
  const situacao = clean(heading?.nextElementSibling?.textContent);
  if (!situacao) throw new Error('Situação da RD ausente.');
  const unit = assertRdUnit(field(root, 'Unidade')?.textContent ?? '', unitCode);
  const get = (label: string) => clean(field(root, label)?.textContent);
  const box = (label: string) => {
    const h = [...root.querySelectorAll('h4')].find(h => foldRdText(h.textContent ?? '') === foldRdText(label));
    return clean(h?.parentElement?.querySelector('p')?.textContent);
  };
  const tipoRaw = box('Tipo da requisição');
  const tipo: SuapRdType | null = ({ 'dotacao para empenho': 'dotacao', 'reforco de empenho': 'reforco', 'anulacao de empenho': 'anulacao' } as const)[foldRdText(tipoRaw)] ?? null;
  const table = [...root.querySelectorAll('table')].find(t => foldRdText(t.querySelector('thead')?.textContent ?? '').includes('numero do empenho'));
  if (!table) throw new Error('Detalhamento da despesa ausente.');
  const headers = [...table.querySelectorAll('thead th')].map(th => foldRdText(th.textContent ?? ''));
  const col = (needle: string) => headers.findIndex(h => h.includes(needle));
  if (['natureza', 'valor', 'numero do empenho'].some(h => col(h) < 0) || foldRdText(situacao) === 'concluida' && col('situacao') < 0) throw new Error('Cabeçalhos de despesa inválidos.');
  const linhas = [...table.querySelectorAll('tbody tr')].map(tr => {
    const cells = [...tr.querySelectorAll('td,th')].map(td => clean(td.textContent));
    const ne = parseFullSuapNe(cells[col('numero do empenho')]);
    if (ne && ne.ug !== unit.parentUasg) throw new Error('UG da NE fora do campus da RD.');
    const valor = parseRdMoney(cells[col('valor')]);
    if ((tipo === 'anulacao' && valor > 0) || ((tipo === 'dotacao' || tipo === 'reforco') && valor < 0)) throw new Error('Sinal do movimento incompatível com o tipo da RD.');
    const ro = col('numero ro') >= 0 ? cells[col('numero ro')] : null;
    if (ro && ro !== '-' && (!/^\d{11}\d{4}RO\d{6}$/.test(ro) || ro.slice(0, 6) !== unit.parentUasg)) throw new Error('RO inválido ou de outro campus.');
    return { naturezaDespesa: cells[col('natureza')], valor, empenhoCompleto: ne?.completo ?? null,
      empenhoNumero: ne?.numero ?? null, ug: ne?.ug ?? null, gestao: ne?.gestao ?? null,
      ro: ro && ro !== '-' ? ro : null, situacao: cells[col('situacao')] ?? '' };
  });
  const totalCell = table.querySelector('tfoot tr')?.querySelectorAll('td,th')[1];
  if (!totalCell || Math.abs(Math.round(linhas.reduce((sum, line) => sum + line.valor, 0) * 100) - Math.round(parseRdMoney(totalCell.textContent ?? '') * 100)) > 1) throw new Error('Total da RD não fecha com as linhas.');
  const processLink = field(root, 'Processo administrativo')?.querySelector('a');
  const cdoLink = field(root, 'CDO')?.querySelector('a');
  return { rdId, numero, situacao, tipo, tipoRaw, suapUnitCode: unitCode, campusUasg: unit.parentUasg,
    activityName: get('Atividade'), origemRecurso: get('Origem de recurso'), planoInterno: get('Plano interno'),
    processo: clean(processLink?.textContent), processoUrl: processLink ? new URL(processLink.getAttribute('href')!, SUAP_RD_ORIGIN).href : null,
    finalidade: get('Finalidade'), cdo: clean(cdoLink?.textContent) || null, cdoUrl: cdoLink ? new URL(cdoLink.getAttribute('href')!, SUAP_RD_ORIGIN).href : null,
    valorInicial: parseRdMoney(box('Valor inicial')), valor: parseRdMoney(box('Valor')), linhas,
    sourceUrl: `${SUAP_RD_ORIGIN}/plan_estrategico/detalhar_requisicaodespesa/${rdId}/` };
}

export function rdUnitCatalog() { return SUAP_PLAN_UNITS.map(unit => ({ suap_unit_code: unit.value, campus_uasg: unit.parentUasg, code: unit.code })); }
