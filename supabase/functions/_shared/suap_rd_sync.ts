import { parseSuapPlanHtml } from '../../../src/services/suapPlanParser.ts';
import { buildSuapPlanSourceUrl, getSuapPlanUnit } from '../../../src/lib/suapPlanUnits.ts';
import { foldRdText, isAllowedSuapRdUrl, parseSuapRdDetail, parseSuapRdList, SUAP_RD_ORIGIN, type SuapRdRef, type SuapRdDetail } from '../../../src/services/suapRdParser.ts';
import { prepareRdActivities, prepareRdDetails, rdChecksum, type RdActivity, type RdReuse } from './suap_rd_reuse.ts';

type HtmlParser = new () => { parseFromString(html: string, type: string): Document | null };
export type RdDatabase = { from(table: string): any; rpc(name: string, args: Record<string, unknown>): PromiseLike<any> };
type Source = { planId: number; activityId: string; activityName: string; sourceUrl: string };
export type RdState = {
  phase: 'inventory' | 'plan' | 'activities' | 'details' | 'verify' | 'ready';
  captureMode?: 'extension' | 'backend';
  nextUrl: string | null; inventory: SuapRdRef[]; total: number | null;
  activities: RdActivity[]; activityCursor: number;
  activityNextUrl: string | null; sources: Record<string, Source[]>;
  detailCursor: number; verify: SuapRdRef[]; verifyTotal: number | null;
  reuse?: RdReuse;
  rowFingerprintVersion?: number;
  mutableRdIds?: string[]; detailRechecks?: string[]; verificationRetries?: number;
};
export type RdRun = { id: string; org_id: string; user_id: string; campus_uasg: string; suap_unit_code: string;
  status: string; state: RdState; source_count: number; summary: Record<string, number>; complete: boolean;
  error_message?: string | null; started_at?: string; updated_at?: string };

export function rdInventoryUrl(unit: string) { return `${SUAP_RD_ORIGIN}/admin/plan_estrategico/requisicaodespesa/?unidade_gestora=${unit}&tab=tab_any_data`; }
export function initialRdState(unit: string): RdState {
  return { phase: 'inventory', nextUrl: rdInventoryUrl(unit), inventory: [], total: null,
    activities: [], activityCursor: 0, activityNextUrl: null, sources: {}, detailCursor: 0, verify: [], verifyTotal: null,
    rowFingerprintVersion: 2 };
}

/** The server chooses every page; the extension supplies only that page's HTML. */
export function nextRdCaptureUrl(run: RdRun): string | null {
  const state = run.state;
  while (state.phase === 'activities' && state.activities[state.activityCursor]?.reused) state.activityCursor++;
  if (state.phase === 'activities' && state.activityCursor >= state.activities.length) state.phase = 'details';
  const reused = new Set(state.reuse?.reusedIds ?? []);
  while (state.phase === 'details' && !state.detailRechecks?.length && reused.has(state.inventory[state.detailCursor]?.rdId)) state.detailCursor++;
  if (state.phase === 'details' && !state.detailRechecks?.length && state.detailCursor >= state.inventory.length) {
    state.phase = 'verify'; state.nextUrl = rdInventoryUrl(run.suap_unit_code);
  }
  if (state.phase === 'inventory' || state.phase === 'verify') return state.nextUrl;
  if (state.phase === 'plan') return buildSuapPlanSourceUrl(run.suap_unit_code);
  if (state.phase === 'activities') return state.activityNextUrl ?? `${SUAP_RD_ORIGIN}/plan_estrategico/listar_requisicoes_despesa/8/${state.activities[state.activityCursor].id}/`;
  if (state.phase === 'details') return `${SUAP_RD_ORIGIN}/plan_estrategico/detalhar_requisicaodespesa/${state.detailRechecks?.[0] ?? state.inventory[state.detailCursor].rdId}/`;
  return null;
}

export async function collectCapturedRdPage(db: RdDatabase, run: RdRun, html: unknown, sourceUrl: unknown, Parser: HtmlParser) {
  const expected = nextRdCaptureUrl(structuredClone(run));
  if (!expected || sourceUrl !== expected) throw new Error('Página diferente da etapa esperada; consulte o estado e retome a coleta.');
  if (typeof html !== 'string' || !html.trim() || new TextEncoder().encode(html).byteLength > 15 * 1024 * 1024) throw new Error('HTML SUAP ausente ou maior que 15 MB.');
  await collectRdChunk(db, run, async url => {
    if (url !== expected) throw new Error('Etapa de captura divergente.');
    return html;
  }, Parser, 1);
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
/** Only mutable RDs can be reread after the final inventory changes, with bounded retries. */
function reconcileRdInventory(state: RdState) {
  const current = new Map(state.verify.map(ref => [ref.rdId,ref]));
  if (current.size !== state.inventory.length) throw new Error('RDs alteradas durante a coleta; inicie nova conferência.');
  const mutable = new Set(state.mutableRdIds ?? []);
  const changed = state.inventory.filter(ref => {
    const next = current.get(ref.rdId);
    if (!next || ref.numero !== next.numero || foldRdText(ref.tipo) !== foldRdText(next.tipo)) throw new Error('RDs alteradas durante a coleta; inicie nova conferência.');
    const different = foldRdText(ref.situacao) !== foldRdText(next.situacao) ||
      state.rowFingerprintVersion === 2 && ref.rowFingerprint && ref.rowFingerprint !== next.rowFingerprint;
    if (different && foldRdText(ref.situacao) === 'concluida' && !mutable.has(ref.rdId)) throw new Error('RDs alteradas durante a coleta; inicie nova conferência.');
    return different;
  });
  if (!changed.length) { state.phase = 'ready'; return; }
  if ((state.verificationRetries ?? 0) >= 3) throw new Error('RDs pendentes continuam mudando; retome a conferência quando o SUAP estabilizar.');
  state.verificationRetries = (state.verificationRetries ?? 0) + 1;
  for (const ref of changed) {
    mutable.add(ref.rdId);
    Object.assign(ref,current.get(ref.rdId));
  }
  state.mutableRdIds = [...mutable];
  state.detailRechecks = changed.map(ref => ref.rdId);
  state.verify = []; state.verifyTotal = null; state.phase = 'details';
}

/** Performs only bounded reads; active records are changed exclusively by the apply RPC. */
export async function collectRdChunk(db: RdDatabase, run: RdRun, load: (url: string) => Promise<string>, Parser: HtmlParser, steps = 6) {
  const state = run.state;
  const deadline = Date.now() + 30000;
  for (let index = 0; index < steps && state.phase !== 'ready' && Date.now() < deadline; index++) {
    const before = structuredClone(state);
    try {
    const captureUrl = nextRdCaptureUrl(run);
    if (!captureUrl) break;
    if (state.phase === 'inventory' || state.phase === 'verify') {
      const page = parseSuapRdList(await load(state.nextUrl!), state.nextUrl!, run.suap_unit_code, Parser);
      for (const ref of page.refs) if (ref.rowFingerprint) ref.rowFingerprint = await rdChecksum(ref.rowFingerprint);
      const verify = state.phase === 'verify';
      addPage(verify ? state.verify : state.inventory, page.refs, verify ? state.verifyTotal : state.total, page.total);
      if (verify) state.verifyTotal = page.total; else state.total = page.total;
      state.nextUrl = page.nextUrl;
      if (!page.nextUrl) {
        const records = verify ? state.verify : state.inventory;
        if (records.length !== page.total) throw new Error('Inventário SUAP incompleto.');
        if (verify) {
          reconcileRdInventory(state);
        } else state.phase = 'plan';
      }
    } else if (state.phase === 'plan') {
          const html = await load(captureUrl);
          const document = new Parser().parseFromString(html, 'text/html');
          const selected = document?.querySelector('#id_unidade_gestora option[selected]');
          if (!selected || selected.getAttribute('value') !== run.suap_unit_code) throw new Error('Plano retornou outra unidade SUAP.');
          const plan = parseSuapPlanHtml(html, Parser);
          await prepareRdActivities(state,plan.activities);
          state.phase = 'activities';
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
      activity.seenRdIds = [...new Set([...(activity.seenRdIds ?? []),...page.refs.map(ref => ref.rdId)])];
      state.activityNextUrl = page.nextUrl;
      if (!page.nextUrl) {
        const changedRelation = JSON.stringify([...(activity.previousRdIds ?? [])].sort()) !== JSON.stringify([...activity.seenRdIds].sort());
        if (changedRelation && state.activities.some(item => item.reused)) {
          // A hidden reassignment can leave the inventory/plan totals unchanged. Recheck every ID.
          for (const item of state.activities) { item.reused = false; item.seenRdIds = []; }
          state.sources = {}; state.activityCursor = 0;
          if (state.reuse) state.reuse.reusedActivities = 0;
        } else { activity.checkedAt = new Date().toISOString(); state.activityCursor++; }
      }
    } else if (state.phase === 'details') {
      const ref = state.detailRechecks?.length ? state.inventory.find(ref => ref.rdId === state.detailRechecks![0])! : state.inventory[state.detailCursor];
      if (!ref) { state.phase = 'verify'; state.nextUrl = rdInventoryUrl(run.suap_unit_code); continue; }
      const url = `${SUAP_RD_ORIGIN}/plan_estrategico/detalhar_requisicaodespesa/${ref.rdId}/`;
      const detail = parseSuapRdDetail(await load(url), ref.rdId, run.suap_unit_code, Parser);
      if (detail.numero !== ref.numero || foldRdText(detail.tipoRaw) !== foldRdText(ref.tipo) ||
        foldRdText(detail.situacao) !== foldRdText(ref.situacao) && foldRdText(ref.situacao) === 'concluida') throw new Error('RD alterada durante a captura; inicie nova conferência.');
      if (foldRdText(ref.situacao) !== 'concluida') {
        state.mutableRdIds = [...new Set([...(state.mutableRdIds ?? []),ref.rdId])];
        ref.situacao = detail.situacao;
      }
      const sources = state.sources[ref.rdId] ?? [];
      if (sources.some(source => foldRdText(source.activityName) !== foldRdText(detail.activityName))) throw new Error('Atividade da RD diverge da relação oficial.');
      const payload = { ...detail, sources };
      const checksum = await rdChecksum(payload);
      const { error } = await db.from('suap_rd_snapshots').upsert({ run_id: run.id, org_id: run.org_id,
        campus_uasg: run.campus_uasg, suap_unit_code: run.suap_unit_code, suap_rd_id: ref.rdId, payload, checksum,
        captured_at: new Date().toISOString() }, { onConflict: 'run_id,suap_rd_id' });
      if (error) throw error;
      const recheck = Boolean(state.detailRechecks?.length);
      if (recheck) state.detailRechecks!.shift(); else state.detailCursor++;
      if (state.reuse) {
        const copied = state.reuse.reusedIds?.includes(ref.rdId);
        if (copied) {
          state.reuse.reusedIds = state.reuse.reusedIds!.filter(id => id !== ref.rdId);
          state.reuse.reusedDetails--;
        }
        if (!recheck || copied) state.reuse.refreshedDetails++;
      }
    }
    nextRdCaptureUrl(run);
    if (state.phase === 'details') { await prepareRdDetails(db,run); nextRdCaptureUrl(run); }
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
