import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type QueryKey = readonly string[];

type UpdatePayload<T> = {
  id: string;
  updates: Partial<T>;
};

type CrudMessages = {
  createSuccess: string;
  createError: string;
  updateSuccess: string;
  updateError: string;
  deleteSuccess: string;
  deleteError: string;
};

type CrudService<T, TCreate> = {
  create: (payload: TCreate) => Promise<unknown>;
  update: (id: string, updates: Partial<T>) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
};

type CrudMutationOptions<T, TCreate> = {
  queryKey: QueryKey;
  service: CrudService<T, TCreate>;
  messages: CrudMessages;
};

function logMutationError(error: unknown, message: string) {
  console.error(error);
  toast.error(message);
}

export function useCrudMutations<T, TCreate>({
  queryKey,
  service,
  messages,
}: CrudMutationOptions<T, TCreate>) {
  const queryClient = useQueryClient();

  const invalidateAndRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.refetchQueries({ queryKey });
  }, [queryClient, queryKey]);

  const createMutation = useMutation({
    mutationFn: service.create,
    onSuccess: async () => {
      await invalidateAndRefetch();
      toast.success(messages.createSuccess);
    },
    onError: (error) => {
      logMutationError(error, messages.createError);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: UpdatePayload<T>) => service.update(id, updates),
    onSuccess: async () => {
      await invalidateAndRefetch();
      toast.success(messages.updateSuccess);
    },
    onError: (error) => {
      logMutationError(error, messages.updateError);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: service.delete,
    onSuccess: async () => {
      await invalidateAndRefetch();
      toast.success(messages.deleteSuccess);
    },
    onError: (error) => {
      logMutationError(error, messages.deleteError);
    },
  });

  const add = useCallback(
    async (payload: TCreate) => createMutation.mutateAsync(payload),
    [createMutation],
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>) => updateMutation.mutateAsync({ id, updates }),
    [updateMutation],
  );

  const remove = useCallback(
    async (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  return {
    add,
    update,
    remove,
  };
}
