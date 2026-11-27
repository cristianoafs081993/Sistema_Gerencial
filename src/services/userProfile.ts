import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type MyProfilePhoto = {
  fotoUrl: string | null;
  fotoVisivel: boolean;
};

const EMPTY_PROFILE: MyProfilePhoto = { fotoUrl: null, fotoVisivel: true };

/** Foto do SUAP do próprio usuário. Sem perfil (ou sem a tabela) devolve vazio, sem erro. */
export async function fetchMyProfilePhoto(userId: string): Promise<MyProfilePhoto> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('foto_url,foto_visivel')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[userProfile] perfil indisponível:', error.message);
    return EMPTY_PROFILE;
  }

  return {
    fotoUrl: typeof data?.foto_url === 'string' && data.foto_url ? data.foto_url : null,
    fotoVisivel: data?.foto_visivel !== false,
  };
}

export async function setMyPhotoVisibility(visible: boolean) {
  const { error } = await supabase.rpc('set_my_photo_visibility', { visible });
  if (error) throw new Error(error.message || 'Não foi possível atualizar a foto.');
  return visible;
}

/** Fotos visíveis de outros usuários (as ocultas não são devolvidas pelo banco). */
export async function fetchVisibleUserPhotos(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase.rpc('get_visible_user_photos', { target_user_ids: userIds });
  if (error) {
    console.warn('[userProfile] fotos indisponíveis:', error.message);
    return {};
  }
  const rows = (data || []) as Array<{ user_id: string; foto_url: string | null }>;
  return Object.fromEntries(rows.filter((row) => row.foto_url).map((row) => [row.user_id, row.foto_url as string]));
}

export function useMyProfilePhoto(userId: string | null | undefined) {
  const [profile, setProfile] = useState<MyProfilePhoto>(EMPTY_PROFILE);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProfile(EMPTY_PROFILE);
      return undefined;
    }
    void fetchMyProfilePhoto(userId).then((next) => {
      if (!cancelled) setProfile(next);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setVisible = useCallback(async (visible: boolean) => {
    setIsSaving(true);
    try {
      await setMyPhotoVisibility(visible);
      setProfile((current) => ({ ...current, fotoVisivel: visible }));
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { ...profile, isSaving, setVisible };
}
