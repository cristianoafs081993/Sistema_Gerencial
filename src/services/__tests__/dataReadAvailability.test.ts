// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, fallback: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: () => {
  const builder = { select: () => builder, eq: () => builder, order: () => builder,
    then: (done: (value: unknown) => unknown) => Promise.resolve(mocks.result).then(done) };
  return builder;
} } }));
vi.mock('@/lib/supabaseRest', () => ({ fetchSupabaseRestRows: mocks.fallback }));
import { atividadesService } from '@/services/atividades';
import { empenhosService } from '@/services/empenhos';
import { descentralizacoesService } from '@/services/descentralizacoes';
import { descentralizacoesContaSaldosService } from '@/services/descentralizacoesContaSaldos';
import { creditosDisponiveisService } from '@/services/creditosDisponiveis';
import { contratosService } from '@/services/contratos';
const readers = [atividadesService.getAll, empenhosService.getAll, descentralizacoesService.getAll,
  descentralizacoesContaSaldosService.getAll, creditosDisponiveisService.getAll,
  contratosService.getContratos, contratosService.getContratosEmpenhos];
describe('core data reads during a database outage', () => {
  beforeEach(() => mocks.fallback.mockReset());
  it.each(readers)('propagates a server timeout without issuing another REST read (%#)', async read => {
    const error = { code: '57014', message: 'canceling statement due to statement timeout' };
    mocks.result = { data: null, error };
    await expect(read()).rejects.toEqual(error);
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
  it.each(readers)('accepts an empty successful dataset without duplicate reads (%#)', async read => {
    mocks.result = { data: [], error: null };
    await expect(read()).resolves.toEqual([]);
    expect(mocks.fallback).not.toHaveBeenCalled();
  });
});
