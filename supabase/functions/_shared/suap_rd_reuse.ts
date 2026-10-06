import { foldRdText, type SuapRdDetail, type SuapRdRef } from '../../../src/services/suapRdParser.ts';
import type { SuapPlanActivity } from '../../../src/services/suapPlanParser.ts';
import type { RdDatabase, RdRun, RdState } from './suap_rd_sync.ts';

export const RD_REUSE_VERSION = 1;
export const RD_CANCELED_REUSE_MAX_AGE_DAYS = 7;
const AUDIT_FRACTION = 0.1;
type Scope = Pick<RdRun, 'org_id' | 'user_id' | 'campus_uasg' | 'suap_unit_code'>;
export type RdActivity = { id: string; name: string; fingerprint?: string; checkedAt?: string; reused?: boolean;
  previousRdIds?: string[]; seenRdIds?: string[] };
export type RdReuse = {
  version: number; mode: 'full' | 'incremental'; baseRunId?: string; previousInventory?: SuapRdRef[];
  prepared?: boolean; reusedIds?: string[]; reusedDetails: number; refreshedDetails: number;
  reusedActivities: number;
};
type Payload = SuapRdDetail & { sources: RdState['sources'][string] };
type Snapshot = { payload: Payload; captured_at: string };

const refKey = (ref: SuapRdRef) => JSON.stringify([ref.rdId,ref.numero,foldRdText(ref.situacao),foldRdText(ref.tipo)]);
const sourceKey = (sources: Payload['sources'], immutable = false) => JSON.stringify(sources.map(source =>
  immutable ? [source.planId,source.activityId] : [source.planId,source.activityId,foldRdText(source.activityName)])
  .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
const concluded = (ref: SuapRdRef) => foldRdText(ref.situacao) === 'concluida';
const fresh = (date: string | undefined, now: number) => {
  const time = Date.parse(date ?? '');
  return Number.isFinite(time) && time <= now && now - time < RD_CANCELED_REUSE_MAX_AGE_DAYS * 86400000;
};
function auditIds(rows: Array<{ id: string; date: string }>) {
  return new Set([...rows].sort((a,b) => Date.parse(a.date)-Date.parse(b.date) || a.id.localeCompare(b.id))
    .slice(0,Math.ceil(rows.length * AUDIT_FRACTION)).map(row => row.id));
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,canonical(item)]));
  return value;
}
export async function rdChecksum(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

/** Only an applied, complete snapshot from this exact user/tenant/unit can be a baseline. */
export function seedRdReuse(state: RdState, scope: Scope, base: RdRun | null, forceFull = false) {
  if (base && Object.keys(scope).some(key => base[key as keyof Scope] !== scope[key as keyof Scope])) throw new Error('Base de RDs fora do usuário, órgão ou campus/unidade.');
  const eligible = !forceFull && base?.status === 'applied' && base.complete && base.state.phase === 'ready'
    && (!base.state.reuse || base.state.reuse.version === RD_REUSE_VERSION);
  state.reuse = { version: RD_REUSE_VERSION,mode: eligible ? 'incremental' : 'full',
    reusedDetails: 0,refreshedDetails: 0,reusedActivities: 0 };
  if (!eligible || !base) return;
  state.reuse.baseRunId = base.id;
  state.reuse.previousInventory = structuredClone(base.state.inventory);
  state.activities = structuredClone(base.state.activities);
  state.sources = structuredClone(base.state.sources);
}

/** Concluded RDs are immutable; new or unassociated pending RDs need a full official relation scan. */
export async function prepareRdActivities(state: RdState, activities: SuapPlanActivity[], now = Date.now()) {
  const previous = new Map(state.activities.map(activity => [activity.id,activity]));
  const oldInventory = new Map((state.reuse?.previousInventory ?? []).map(ref => [ref.rdId,ref]));
  const inventory = new Map(state.inventory.map(ref => [ref.rdId,ref]));
  const needsDiscovery = state.inventory.some(ref => !oldInventory.has(ref.rdId) ||
    (!concluded(ref) || refKey(ref) !== refKey(oldInventory.get(ref.rdId)!)) && !(state.sources[ref.rdId]?.length));
  const current: Array<RdActivity & { immutable: boolean }> = await Promise.all(activities.map(async activity => {
    const fingerprint = await rdChecksum(activity.rawData);
    const old = previous.get(activity.suapActivityId);
    const previousRdIds = Object.entries(state.sources).filter(([,sources]) => sources.some(source => source.activityId === activity.suapActivityId)).map(([id]) => id);
    const stable = previousRdIds.every(id => {
      const ref = inventory.get(id), before = oldInventory.get(id);
      return ref && before && refKey(ref) === refKey(before) &&
        (concluded(ref) || foldRdText(ref.situacao) === 'cancelada' && ref.rowFingerprint === before.rowFingerprint);
    });
    const immutable = previousRdIds.every(id => inventory.has(id) && concluded(inventory.get(id)!));
    const sameActivity = old && foldRdText(old.name) === foldRdText(activity.atividade);
    const reused = Boolean(state.reuse?.baseRunId && !needsDiscovery && stable && sameActivity &&
      (immutable || old.fingerprint === fingerprint && fresh(old.checkedAt,now)));
    return { id: activity.suapActivityId,name: activity.atividade,fingerprint,checkedAt: reused ? old?.checkedAt : undefined,reused,previousRdIds,seenRdIds:[],immutable };
  }));
  const audit = auditIds(current.filter(activity => activity.reused && !activity.immutable).map(activity => ({ id:activity.id,date:activity.checkedAt! })));
  for (const activity of current) if (audit.has(activity.id)) activity.reused = false;
  const reused = new Set(current.filter(activity => activity.reused).map(activity => activity.id));
  // Old evidence is retained only for reused relations; refreshed/removed activities start empty.
  state.sources = Object.fromEntries(state.inventory.map(ref => [ref.rdId,
    (state.sources[ref.rdId] ?? []).filter(source => reused.has(source.activityId))]));
  state.activities = current;
  if (state.reuse) state.reuse.reusedActivities = reused.size;
}

export async function prepareRdDetails(db: RdDatabase, run: RdRun, now = Date.now()) {
  const reuse = run.state.reuse;
  if (!reuse?.baseRunId || reuse.prepared) return;
  const rows: Snapshot[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data,error } = await db.from('suap_rd_snapshots').select('payload,captured_at').eq('run_id',reuse.baseRunId)
      .eq('org_id',run.org_id).eq('campus_uasg',run.campus_uasg).eq('suap_unit_code',run.suap_unit_code)
      .order('suap_rd_id').range(offset,offset+499);
    if (error) throw error;
    rows.push(...data); if (data.length < 500) break;
  }
  const oldRefs = new Map((reuse.previousInventory ?? []).map(ref => [ref.rdId,ref]));
  const snapshots = new Map(rows.map(row => [row.payload.rdId,row]));
  const candidates = run.state.inventory.flatMap(ref => {
    const old = oldRefs.get(ref.rdId), row = snapshots.get(ref.rdId), payload = row?.payload;
    const sources = run.state.sources[ref.rdId] ?? [];
    const immutable = concluded(ref);
    if (!old || !row || !payload || refKey(old) !== refKey(ref) ||
      !immutable && (old.rowFingerprint && old.rowFingerprint !== ref.rowFingerprint || !fresh(row.captured_at,now)) ||
      payload.rdId !== ref.rdId || payload.suapUnitCode !== run.suap_unit_code || payload.campusUasg !== run.campus_uasg ||
      payload.numero !== ref.numero || foldRdText(payload.situacao) !== foldRdText(ref.situacao) || foldRdText(payload.tipoRaw) !== foldRdText(ref.tipo) ||
      !immutable && sources.length > 1 || !Array.isArray(payload.sources) || sourceKey(payload.sources,immutable) !== sourceKey(sources,immutable)) return [];
    const closed = foldRdText(ref.situacao) === 'cancelada' || immutable;
    if (!closed || !immutable && sources.some(source => foldRdText(source.activityName) !== foldRdText(payload.activityName))) return [];
    return [{ id:ref.rdId,date:row.captured_at,row,immutable }];
  });
  const audit = auditIds(candidates.filter(candidate => !candidate.immutable));
  const cached = candidates.filter(candidate => !audit.has(candidate.id));
  for (let offset = 0; offset < cached.length; offset += 100) {
    const values = await Promise.all(cached.slice(offset,offset+100).map(async candidate => {
      const payload = candidate.immutable ? candidate.row.payload : { ...candidate.row.payload,sources:run.state.sources[candidate.id] ?? [] };
      return { run_id:run.id,org_id:run.org_id,campus_uasg:run.campus_uasg,suap_unit_code:run.suap_unit_code,
        suap_rd_id:candidate.id,payload,checksum:await rdChecksum(payload),captured_at:candidate.row.captured_at };
    }));
    const { error } = await db.from('suap_rd_snapshots').upsert(values,{ onConflict:'run_id,suap_rd_id' });
    if (error) throw error;
  }
  reuse.reusedIds = cached.map(candidate => candidate.id);
  reuse.reusedDetails = cached.length;
  reuse.prepared = true;
}
