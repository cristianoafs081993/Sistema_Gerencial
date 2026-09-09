import { supabase } from '@/lib/supabase';
import { DEFAULT_IFRN_CAMPUS_UASG, getIfrnCampus, isIfrnCampusUasg } from '@/lib/ifrnCampuses';

export type UserCampus = {
  codigo: string;
  nome: string;
  aliases?: string[];
};

export async function fetchUserCampus(userId?: string | null): Promise<UserCampus> {
  if (!userId) return getIfrnCampus(DEFAULT_IFRN_CAMPUS_UASG)!;

  const { data, error } = await supabase
    .from('user_campus_preferences')
    .select('campus_uasg')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[userCampus] preferência indisponível:', error.message);
    return getIfrnCampus(DEFAULT_IFRN_CAMPUS_UASG)!;
  }

  const codigo = isIfrnCampusUasg(data?.campus_uasg) ? data.campus_uasg : DEFAULT_IFRN_CAMPUS_UASG;
  return getIfrnCampus(codigo)!;
}

export async function saveUserCampus(userId: string, campusUasg: string): Promise<UserCampus> {
  if (!isIfrnCampusUasg(campusUasg)) throw new Error('Campus IFRN inválido.');

  void userId;
  const { data, error } = await supabase.rpc('set_user_campus_uasg', { target_uasg: campusUasg });

  if (error) throw error;
  const campus = getIfrnCampus(String(data));
  if (!campus) throw new Error('Campus IFRN não encontrado.');
  return campus;
}
