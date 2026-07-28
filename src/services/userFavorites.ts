import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export type FavoriteEntityType = 'empenho' | 'contrato' | 'contrato_api';

export interface UserFavorite {
  id: string;
  userId: string;
  entityType: FavoriteEntityType;
  entityId: string;
  createdAt: Date;
}

type UserFavoriteRow = {
  id: string;
  user_id: string;
  entity_type: FavoriteEntityType;
  empenho_id: string | null;
  contrato_id: string | null;
  contrato_api_id: string | null;
  created_at: string;
};

const USER_FAVORITES_SELECT = 'id,user_id,entity_type,empenho_id,contrato_id,contrato_api_id,created_at';

export const userFavoritesQueryKeys = {
  byUser: (userId?: string) => ['user_favorites', userId ?? 'anonymous'] as const,
};

const getEntityColumn = (entityType: FavoriteEntityType) => {
  if (entityType === 'empenho') return 'empenho_id';
  if (entityType === 'contrato_api') return 'contrato_api_id';
  return 'contrato_id';
};

const mapFavoriteRow = (row: UserFavoriteRow): UserFavorite => {
  const entityId = row.entity_type === 'empenho'
    ? row.empenho_id
    : row.entity_type === 'contrato_api'
      ? row.contrato_api_id
      : row.contrato_id;

  if (!entityId) {
    throw new Error(`Favorito ${row.id} sem identificador de ${row.entity_type}.`);
  }

  return {
    id: row.id,
    userId: row.user_id,
    entityType: row.entity_type,
    entityId,
    createdAt: new Date(row.created_at),
  };
};

export const userFavoritesService = {
  async getAll(userId: string): Promise<UserFavorite[]> {
    const { data, error } = await supabase
      .from('user_favorites')
      .select(USER_FAVORITES_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as UserFavoriteRow[]).map(mapFavoriteRow);
  },

  async addFavorite(entityType: FavoriteEntityType, entityId: string, userId: string): Promise<UserFavorite> {
    const payload = {
      user_id: userId,
      entity_type: entityType,
      empenho_id: entityType === 'empenho' ? entityId : null,
      contrato_id: entityType === 'contrato' ? entityId : null,
      contrato_api_id: entityType === 'contrato_api' ? entityId : null,
    };

    const { data, error } = await supabase
      .from('user_favorites')
      .insert(payload)
      .select(USER_FAVORITES_SELECT)
      .single();

    if (error) throw error;

    return mapFavoriteRow(data as UserFavoriteRow);
  },

  async removeFavorite(entityType: FavoriteEntityType, entityId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq(getEntityColumn(entityType), entityId);

    if (error) throw error;
  },
};

export function useUserFavorites() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const queryKey = userFavoritesQueryKeys.byUser(userId);

  const favoritesQuery = useQuery({
    queryKey,
    queryFn: () => userFavoritesService.getAll(userId!),
    enabled: Boolean(userId),
  });

  const favorites = useMemo(() => favoritesQuery.data ?? [], [favoritesQuery.data]);

  const favoriteIdsByType = useMemo(() => {
    const byType: Record<FavoriteEntityType, Set<string>> = {
      empenho: new Set<string>(),
      contrato: new Set<string>(),
      contrato_api: new Set<string>(),
    };

    for (const favorite of favorites) {
      byType[favorite.entityType].add(favorite.entityId);
    }

    return byType;
  }, [favorites]);

  const toggleMutation = useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: FavoriteEntityType; entityId: string }) => {
      if (!userId) throw new Error('Usuário autenticado não encontrado.');

      const currentFavorites = queryClient.getQueryData<UserFavorite[]>(queryKey) ?? favorites;
      const existing = currentFavorites.find(
        (favorite) => favorite.entityType === entityType && favorite.entityId === entityId,
      );

      if (existing) {
        await userFavoritesService.removeFavorite(entityType, entityId, userId);
        return;
      }

      await userFavoritesService.addFavorite(entityType, entityId, userId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error('Falha ao atualizar favorito', error);
      toast.error('Não foi possível atualizar o favorito.');
    },
  });

  return {
    favorites,
    favoriteIdsByType,
    isLoading: favoritesQuery.isLoading,
    isPending: toggleMutation.isPending,
    isFavorite: (entityType: FavoriteEntityType, entityId: string) =>
      favoriteIdsByType[entityType].has(entityId),
    toggleFavorite: (entityType: FavoriteEntityType, entityId: string) =>
      toggleMutation.mutateAsync({ entityType, entityId }),
  };
}
