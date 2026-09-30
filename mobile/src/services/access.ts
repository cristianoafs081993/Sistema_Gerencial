import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { TabType } from '../types';

/**
 * Regras de acesso do app — espelham o web (src/services/userAccess.ts):
 * grupos do usuário -> telas permitidas -> interseção com os módulos habilitados para o órgão.
 * Superadministradores veem tudo. Terceirizados NÃO usam o app: no web eles só enxergam os
 * empenhos vinculados a eles, regra que o app ainda não implementa.
 */

const SUPERADMIN_EMAIL = 'cristiano.cnrn@gmail.com';

export type AppAccess = {
  isSuperAdmin: boolean;
  isTerceirizado: boolean;
  groupNames: string[];
  orgName: string | null;
  /** Abas do app liberadas para o usuário. */
  tabs: TabType[];
  /** Ids das telas do web liberadas (base das seções dentro de cada aba). */
  screens: string[];
};

/** Quais telas do web liberam cada aba do app (qualquer uma basta). */
const TAB_SCREENS: Record<TabType, string[]> = {
  dashboard: ['dashboard'],
  empenhos: ['empenhos', 'descentralizacoes', 'credito-disponivel'],
  contratos: ['contratos'],
  licitacoes: ['licitacoes-pregoes', 'atas-registro-precos'],
  infraestrutura: [
    'manutencao',
    'energia-visao-geral',
    'energia-cosern',
    'energia-mercatto',
    'energia-geracao-solar',
    'energia-contratos',
    'energia-financeiro',
    'energia-esg',
  ],
};

export const ALL_TABS = Object.keys(TAB_SCREENS) as TabType[];
const ALL_SCREENS = Array.from(new Set(Object.values(TAB_SCREENS).flat()));

export type OrcamentoSecao = 'empenhos' | 'descentralizacoes' | 'credito';
const SECAO_TELA: Record<OrcamentoSecao, string> = {
  empenhos: 'empenhos',
  descentralizacoes: 'descentralizacoes',
  credito: 'credito-disponivel',
};

/** Seções da aba Orçamento que o usuário pode abrir (mesma permissão das telas do web). */
export function secoesOrcamento(screens: string[]): OrcamentoSecao[] {
  const liberadas = new Set(screens);
  return (Object.keys(SECAO_TELA) as OrcamentoSecao[]).filter((secao) => liberadas.has(SECAO_TELA[secao]));
}

export function isSuperAdminUser(user: Pick<User, 'email' | 'app_metadata'> | null | undefined): boolean {
  if (!user) return false;
  if (user.email?.trim().toLowerCase() === SUPERADMIN_EMAIL) return true;
  const meta = (user.app_metadata || {}) as { role?: string; is_superadmin?: boolean };
  return meta.role === 'superadmin' || meta.is_superadmin === true;
}

/** Converte as telas liberadas (ids do web) nas abas do app. */
export function tabsFromScreens(screenIds: string[]): TabType[] {
  const allowed = new Set(screenIds);
  return ALL_TABS.filter((tab) => TAB_SCREENS[tab].some((screenId) => allowed.has(screenId)));
}

type MembershipRow = {
  group_id: string;
  user_groups: { id: string; name: string; slug: string } | null;
};

export async function fetchAppAccess(user: User): Promise<AppAccess> {
  const isSuperAdmin = isSuperAdminUser(user);

  const [membershipsResult, orgResult] = await Promise.all([
    supabase.from('user_group_memberships').select('group_id,user_groups(id,name,slug)').eq('user_id', user.id),
    supabase.from('org_users').select('orgs(id,name)').eq('user_id', user.id).maybeSingle(),
  ]);

  if (membershipsResult.error && !isSuperAdmin) throw membershipsResult.error;

  const org = (orgResult.data as { orgs: { id: string; name: string } | null } | null)?.orgs ?? null;
  const memberships = ((membershipsResult.data || []) as unknown as MembershipRow[]).filter((row) => row.user_groups);
  const groupNames = memberships.map((row) => row.user_groups!.name);
  const isTerceirizado = memberships.some((row) => row.user_groups!.slug === 'terceirizado');

  if (isSuperAdmin) {
    return { isSuperAdmin, isTerceirizado: false, groupNames: ['Superadministrador'], orgName: org?.name ?? null, tabs: ALL_TABS, screens: ALL_SCREENS };
  }

  if (isTerceirizado || memberships.length === 0) {
    return { isSuperAdmin, isTerceirizado, groupNames, orgName: org?.name ?? null, tabs: [], screens: [] };
  }

  const groupIds = memberships.map((row) => row.group_id);
  const { data: permissions, error: permissionsError } = await supabase
    .from('user_group_screen_permissions')
    .select('screen_id')
    .in('group_id', groupIds)
    .eq('can_access', true);
  if (permissionsError) throw permissionsError;

  let screenIds = Array.from(new Set((permissions || []).map((row: { screen_id: string }) => row.screen_id)));

  if (org?.id) {
    const { data: orgModules, error: orgModulesError } = await supabase
      .from('org_module_permissions')
      .select('screen_id')
      .eq('org_id', org.id)
      .eq('can_access', true);
    // Sem a tabela (rollout gradual) não há restrição por órgão, como no web.
    if (!orgModulesError) {
      const orgAllowed = new Set((orgModules || []).map((row: { screen_id: string }) => row.screen_id));
      screenIds = screenIds.filter((screenId) => orgAllowed.has(screenId));
    }
  }

  return { isSuperAdmin, isTerceirizado: false, groupNames, orgName: org?.name ?? null, tabs: tabsFromScreens(screenIds), screens: screenIds };
}
