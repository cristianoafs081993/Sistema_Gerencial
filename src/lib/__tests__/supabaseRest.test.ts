// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock('@/lib/env', () => ({ getSupabaseEnv: () => ({ url: 'https://project.example.org', anonKey: 'public-key' }) }));
import { fetchSupabaseRestRows } from '@/lib/supabaseRest';
describe('authenticated REST fallback', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('preserves the active session and campus filters and bounds request duration', async () => {
    mocks.session.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', request);
    await fetchSupabaseRestRows('atividades', 'id', { filters: { campus_uasg: '158366' } });
    expect(new URL(request.mock.calls[0][0]).searchParams.get('campus_uasg')).toBe('eq.158366');
    expect(request.mock.calls[0][1]).toMatchObject({ headers: { apikey: 'public-key', Authorization: 'Bearer session-token' }, signal: expect.any(AbortSignal) });
  });
  it('propagates session errors without issuing an anonymous read', async () => {
    const error = new Error('Session unavailable');
    mocks.session.mockResolvedValue({ data: { session: null }, error });
    const request = vi.fn(); vi.stubGlobal('fetch', request);
    await expect(fetchSupabaseRestRows('atividades', 'id')).rejects.toBe(error);
    expect(request).not.toHaveBeenCalled();
  });
});
