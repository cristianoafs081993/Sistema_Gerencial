// Regras puras do login SUAP: matrícula, campus e decisão de grupos.
// Sem dependências do Deno para poder ser testado pelo Vitest.

export type SuapCampus = { sigla: string | null; nome: string | null };

export type CampusMapRow = { sigla: string; campus_uasg: string };
export type CampusUasgRow = { codigo_uasg: string; nome_uasg: string };

export type AccessGrant = {
  matricula: string;
  status: string;
  valid_until: string | null;
};

export type GroupSyncDecision =
  | { mode: 'grant'; groupIds: string[]; removeOtherGroups: true }
  | { mode: 'terceirizado' }
  | { mode: 'legacy-default'; groupSlug: 'diretores' }
  | { mode: 'keep' }
  | { mode: 'pending' };

export function normalizeMatricula(value: unknown) {
  return String(value ?? '').trim().replace(/[^0-9A-Za-z]/g, '').toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^campus\s+/i, '')
    .replace(/[^0-9A-Za-z]+/g, ' ')
    .trim()
    .toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readCampusValue(value: unknown): SuapCampus | null {
  if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    // "CN" ou "CN - Currais Novos"
    const match = text.match(/^([A-Za-z]{1,8})\s*[-–]\s*(.+)$/);
    if (match) return { sigla: match[1].toUpperCase(), nome: match[2].trim() };
    if (/^[A-Za-z]{1,8}$/.test(text)) return { sigla: text.toUpperCase(), nome: null };
    return { sigla: null, nome: text };
  }

  const record = asRecord(value);
  if (!record) return null;
  const sigla = pickString(record, ['sigla', 'codigo', 'abreviatura']);
  const nome = pickString(record, ['nome', 'descricao', 'nome_campus']);
  if (!sigla && !nome) return null;
  return { sigla: sigla ? sigla.toUpperCase() : null, nome };
}

/** Lê o campus do vínculo devolvido pelo `meus-dados` do SUAP. */
export function extractSuapCampus(profile: unknown): SuapCampus | null {
  const root = asRecord(profile);
  if (!root) return null;
  const vinculo = asRecord(root.vinculo);
  const candidates = [vinculo?.campus, vinculo?.uo, root.campus, root.uo];
  for (const candidate of candidates) {
    const campus = readCampusValue(candidate);
    if (campus) return campus;
  }
  return null;
}

/** Converte o campus do SUAP em UASG pelo mapa de siglas e, na falta dele, pelo nome do campus. */
export function resolveCampusUasg(
  campus: SuapCampus | null,
  campusMap: CampusMapRow[],
  uasgs: CampusUasgRow[],
): string | null {
  if (!campus) return null;

  if (campus.sigla) {
    const sigla = campus.sigla.trim().toUpperCase();
    const mapped = campusMap.find((row) => row.sigla.trim().toUpperCase() === sigla);
    if (mapped) return mapped.campus_uasg;
  }

  if (campus.nome) {
    const nome = normalizeText(campus.nome);
    const byName = uasgs.find((row) => normalizeText(row.nome_uasg) === nome);
    if (byName) return byName.codigo_uasg;
  }

  return null;
}

export function isGrantActive(grant: AccessGrant | null | undefined, today: string) {
  if (!grant) return false;
  if (grant.status !== 'ativo') return false;
  if (grant.valid_until && grant.valid_until < today) return false;
  return true;
}

/**
 * Decide o que fazer com os grupos do usuário no login SUAP.
 *
 * - Autorização ativa por matrícula: os grupos passam a ser exatamente os da autorização.
 * - Terceirizado cadastrado: mantém a regra atual.
 * - Sem autorização e require_grant desligado: mantém a regra atual (adiciona Diretores).
 * - Sem autorização e require_grant ligado: quem já tem grupos fica como está; quem não tem
 *   fica com acesso pendente. Nenhum usuário existente perde acesso.
 */
export function decideGroupSync(input: {
  grantActive: boolean;
  grantGroupIds: string[];
  isTerceirizado: boolean;
  requireGrant: boolean;
  isAppLogin: boolean;
  currentGroupIds: string[];
}): GroupSyncDecision {
  if (input.grantActive) {
    return { mode: 'grant', groupIds: Array.from(new Set(input.grantGroupIds)), removeOtherGroups: true };
  }

  if (input.isTerceirizado) return { mode: 'terceirizado' };

  if (!input.requireGrant) return { mode: 'legacy-default', groupSlug: 'diretores' };

  if (input.currentGroupIds.length > 0) return { mode: 'keep' };

  return input.isAppLogin ? { mode: 'pending' } : { mode: 'keep' };
}

/**
 * Campus ativo a gravar no login. Só define o campus quando o usuário acabou de ser criado
 * ou quando a autorização limita os campi e o campus atual está fora dela; usuários existentes
 * mantêm o campus que já usam.
 */
export function decideCampusPreference(input: {
  isNewUser: boolean;
  suapCampusUasg: string | null;
  grantCampi: string[];
  currentCampusUasg: string | null;
}): string | null {
  const { isNewUser, suapCampusUasg, grantCampi, currentCampusUasg } = input;

  if (grantCampi.length > 0) {
    if (currentCampusUasg && grantCampi.includes(currentCampusUasg)) return null;
    if (suapCampusUasg && grantCampi.includes(suapCampusUasg)) return suapCampusUasg;
    return grantCampi[0];
  }

  if (isNewUser && !currentCampusUasg && suapCampusUasg) return suapCampusUasg;
  return null;
}

export function buildSuapPhotoUrl(profile: unknown) {
  const root = asRecord(profile);
  const raw = pickString(root, ['url_foto_150x200', 'url_foto_75x100', 'foto']);
  if (!raw) return null;
  return raw.startsWith('http') ? raw : `https://suap.ifrn.edu.br${raw.startsWith('/') ? '' : '/'}${raw}`;
}
