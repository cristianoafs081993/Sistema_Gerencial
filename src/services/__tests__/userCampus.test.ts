import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

import { fetchUserCampus, saveUserCampus } from '@/services/userCampus';

describe('userCampus', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it('usa Currais Novos quando a preferência ainda não existe', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    fromMock.mockReturnValue({ select: vi.fn(() => ({ eq })) });

    await expect(fetchUserCampus('user-1')).resolves.toMatchObject({
      codigo: '158366',
      nome: 'Currais Novos',
    });
  });

  it('persiste uma UASG válida via RPC e bloqueia valor fora do catálogo antes de chamar o banco', async () => {
    rpcMock.mockResolvedValue({ data: '158370', error: null });

    await expect(saveUserCampus('user-1', '158370')).resolves.toMatchObject({ codigo: '158370' });
    expect(rpcMock).toHaveBeenCalledWith('set_user_campus_uasg', { target_uasg: '158370' });

    await expect(saveUserCampus('user-1', '999999')).rejects.toThrow('Campus IFRN inválido.');
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });
});
