import { parseSuapPlanHtml } from '../../../src/services/suapPlanParser.ts';
import { buildSuapPlanSourceUrl, getSuapPlanUnit } from '../../../src/lib/suapPlanUnits.ts';
import { foldRdText, isAllowedSuapRdUrl, parseSuapRdDetail, parseSuapRdList, SUAP_RD_ORIGIN, type SuapRdRef, type SuapRdDetail } from '../../../src/services/suapRdParser.ts';

type HtmlParser = new () => { parseFromString(html: string, type: string): Document | null };
export type RdDatabase = { from(table: string): any; rpc(name: string, args: Record<string, unknown>): PromiseLike<any> };
type Source = { planId: number; activityId: string; activityName: string; sourceUrl: string };
export type RdState = {
  phase: 'inventory' | 'activities' | 'details' | 'verify' | 'ready';
  nextUrl: string | null; inventory: SuapRdRef[]; total: number | null;
  activities: Array<{ id: string; name: string }>; activityCursor: number;
  activityNextUrl: string | null; sources: Record<string, Source[]>;
  detailCursor: number; verify: SuapRdRef[]; verifyTotal: number | null;
};
export type RdRun = { id: string; org_id: string; user_id: string; campus_uasg: string; suap_unit_code: string;
  status: string; state: RdState; source_count: number; summary: Record<string, number>; complete: boolean;
  error_message?: string | null; started_at?: string; updated_at?: string };

export function rdInventoryUrl(unit: string) { return `${SUAP_RD_ORIGIN}/admin/plan_estrategico/requisicaodespesa/?unidade_gestora=${unit}&tab=tab_any_data`; }
export function initialRdState(unit: string): RdState {
  return { phase: 'inventory', nextUrl: rdInventoryUrl(unit), inventory: [], total: null,
    activities: [], activityCursor: 0, activityNextUrl: null, sources: {}, detailCursor: 0, verify: [], verifyTotal: null };
}

export async function fetchSuapRdHtml(url: string, cookie: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!isAllowedSuapRdUrl(url) && !/^https:\/\/suap\.ifrn\.edu\.br\/plan_estrategico\/plano_concluido\/8\/(?:\?unidade_gestora=\d+)?$/.test(url)) throw new Error('URL SUAP recusada.');
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(12000),
      headers: { Cookie: `sessionid=${cookie}`, Accept: 'text/html', 'User-Agent': 'SIAGES RD Sync/1.0' } });
    if (response.status >= 300 && response.status < 400) {
      const destination = new URL(response.headers.get('location') ?? '/', url);
      if (destination.origin !== SUAP_RD_ORIGIN) throw new Error('Redirecionamento SUAP externo recusado.');
      if (destination.pathname.includes('/accounts/login/')) throw new Error('Sessão do SUAP expirada.');
      throw new Error('Redirecionamento inesperado do SUAP.');
    }
    if ([429,502,503,504].includes(response.status) && attempt < 1) {
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); continue;
    }
    if (!response.ok) throw new Error(`Leitura SUAP recusada (${response.status}).`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > 15 * 1024 * 1024) throw new Error('Página SUAP maior que o limite.');
    const html = await response.text();
    if (html.length > 15 * 1024 * 1024) throw new Error('Página SUAP maior que o limite.');
    if (/<input[^>]+type=["']password["']/i.test(html)) throw new Error('Sessão do SUAP expirada.');
    return html;
  }
  throw new Error('SUAP indisponível.');
}

function addPage(existing: SuapRdRef[], incoming: SuapRdRef[], expected: number | null, total: number) {
  if (expected !== null && expected !== total) throw new Error('Inventário mudou durante a coleta; inicie nova conferência.');
  const ids = new Set(existing.map(rd => rd.rdId));
  if (incoming.some(rd => ids.has(rd.rdId))) throw new Error('Paginação instável ou repetida; inicie nova conferência.');
  existing.push(...incoming);
}
const signature = (refs: SuapRdRef[]) => JSON.stringify([...refs].sort((a,b) => Number(a.rdId)-Number(b.rdId)));

/** Performs only bounded reads; active records are changed exclusively by the apply RPC. */
export async function collectRdChunk(db: RdDatabase, run: RdRun, load: (url: string) => Promise<string>, Parser: HtmlParser, steps = 6) {
  const state = run.state;
  const deadline = Date.now() + 30000;
  for (let index = 0; index < steps && state.phase !== 'ready' && Date.now() < deadline; index++) {
    const before = structuredClone(state);
    try {
    if (state.phase === 'inventory' || state.phase === 'verify') {
      const page = parseSuapRdList(await load(state.nextUrl!), state.nextUrl!, run.suap_unit_code, Parser);
      const verify = state.phase === 'verify';
      addPage(verify ? state.verify : state.inventory, page.refs, verify ? state.verifyTotal : state.total, page.total);
      if (verify) state.verifyTotal = page.total; else state.total = page.total;
      state.nextUrl = page.nextUrl;
      if (!page.nextUrl) {
        const records = verify ? state.verify : state.inventory;
        if (records.length !== page.total) throw new Error('Inventário SUAP incompleto.');
        if (verify) {
          if (signature(state.inventory) !== signature(state.verify)) throw new Error('RDs alteradas durante a coleta; inicie nova conferência.');
          state.phase = 'ready';
        } else {
          const url = buildSuapPlanSourceUrl(run.suap_unit_code);
          const html = await load(url);
          const document = new Parser().parseFromString(html, 'text/html');
          const selected = document?.querySelector('#id_unidade_gestora option[selected]');
          if (!selected || selected.getAttribute('value') !== run.suap_unit_code) throw new Error('Plano retornou outra unidade SUAP.');
          const plan = parseSuapPlanHtml(html, Parser);
          state.activities = plan.activities.map(activity => ({ id: activity.suapActivityId, name: activity.atividade }));
          state.phase = 'activities';
        }
      }
    } else if (state.phase === 'activities') {
      const activity = state.activities[state.activityCursor];
      if (!activity) { state.phase = 'details'; continue; }
      const url = state.activityNextUrl ?? `${SUAP_RD_ORIGIN}/plan_estrategico/listar_requisicoes_despesa/8/${activity.id}/`;
      const page = parseSuapRdList(await load(url), url, run.suap_unit_code, Parser);
      if (foldRdText(page.activityName) !== foldRdText(activity.name)) throw new Error('Nome da atividade diverge do plano oficial.');
      for (const rd of page.refs) {
        if (!state.inventory.some(ref => ref.rdId === rd.rdId)) throw new Error('Lista da atividade diverge do inventário de RDs.');
        const sources = state.sources[rd.rdId] ?? [];
        if (!sources.some(source => source.activityId === activity.id)) sources.push({ planId: 8, activityId: activity.id, activityName: page.activityName, sourceUrl: url });
        state.sources[rd.rdId] = sources;
      }
      state.activityNextUrl = page.nextUrl;
      if (!page.nextUrl) state.activityCursor++;
    } else if (state.phase === 'details') {
      const ref = state.inventory[state.detailCursor];
      if (!ref) { state.phase = 'verify'; state.nextUrl = rdInventoryUrl(run.suap_unit_code); continue; }
      const url = `${SUAP_RD_ORIGIN}/plan_estrategico/detalhar_requisicaodespesa/${ref.rdId}/`;
      const detail = parseSuapRdDetail(await load(url), ref.rdId, run.suap_unit_code, Parser);
      if (detail.numero !== ref.numero || foldRdText(detail.situacao) !== foldRdText(ref.situacao) || foldRdText(detail.tipoRaw) !== foldRdText(ref.tipo)) throw new Error('RD alterada durante a captura; inicie nova conferência.');
      const sources = state.sources[ref.rdId] ?? [];
      if (sources.some(source => foldRdText(source.activityName) !== foldRdText(detail.activityName))) throw new Error('Atividade da RD diverge da relação oficial.');
      const payload = { ...detail, sources };
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
      const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
      const { error } = await db.from('suap_rd_snapshots').upsert({ run_id: run.id, org_id: run.org_id,
        campus_uasg: run.campus_uasg, suap_unit_code: run.suap_unit_code, suap_rd_id: ref.rdId, payload, checksum }, { onConflict: 'run_id,suap_rd_id' });
      if (error) throw error;
      state.detailCursor++;
    }
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  }
  return state;
}

export async function summarizeRdPreview(db: RdDatabase, run: RdRun) {
  const snapshots: Array<{ payload: SuapRdDetail & { sources: Source[] } }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('suap_rd_snapshots').select('payload').eq('run_id',run.id).order('suap_rd_id').range(offset,offset+499);
    if (error) throw error; snapshots.push(...data); if (data.length < 500) break;
  }
  if (snapshots.length !== run.state.inventory.length) throw new Error('Snapshots incompletos.');
  const localRows = async (table: string, select: string) => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      let query = db.from(table).select(select).eq('org_id',run.org_id).eq('campus_uasg',run.campus_uasg);
      if (table === 'atividades') query = query.eq('suap_unit_code',run.suap_unit_code).eq('suap_plan_id',8);
      const { data,error } = await query.order('id').range(offset,offset+499);
      if (error) throw error; rows.push(...data); if (data.length < 500) return rows;
    }
  };
  const activities = await localRows('atividades','id,suap_activity_id');
  const empenhos = await localRows('empenhos','id,numero,atividade_id');
  const summary = { rds: snapshots.length, movimentos: 0, historicas: 0, semNe: 0, canceladasOuPendentes: 0, conflitos: 0,
    totalDotacao:0,totalReforco:0,totalAnulacao:0,atividadesAusentes:0,empenhosAusentes:0,conflitosManuais:0,neAmbiguas:0 };
  for (const { payload } of snapshots) {
    if (!payload.sources.length) summary.historicas++;
    if (payload.sources.length > 1) summary.conflitos++;
    if (!payload.linhas.some(line => line.empenhoNumero)) summary.semNe++;
    if (foldRdText(payload.situacao) !== 'concluida') summary.canceladasOuPendentes++;
    for (const line of payload.linhas.filter(line => line.empenhoNumero && foldRdText(line.situacao) === 'confirmada' && foldRdText(payload.situacao) === 'concluida' && payload.tipo)) {
      summary.movimentos++;
      const key = ({ dotacao:'totalDotacao',reforco:'totalReforco',anulacao:'totalAnulacao' } as const)[payload.tipo!];
      summary[key] = Math.round((summary[key] + line.valor) * 100) / 100;
      const matches = empenhos.filter(e => [line.empenhoNumero,line.empenhoCompleto].includes(String(e.numero).trim().toUpperCase()));
      if (!matches.length) summary.empenhosAusentes++;
      if (matches.length > 1) summary.neAmbiguas++;
      if (payload.sources.length === 1) {
        const activity = activities.find(a => a.suap_activity_id === payload.sources[0].activityId);
        if (!activity) summary.atividadesAusentes++;
        if (activity && matches.length === 1 && matches[0].atividade_id && matches[0].atividade_id !== activity.id) summary.conflitosManuais++;
      }
    }
  }
  return summary;
}
