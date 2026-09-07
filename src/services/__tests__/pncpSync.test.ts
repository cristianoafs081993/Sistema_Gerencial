import { describe, it, expect, vi } from 'vitest';
import { listContractPages, resolvePncpReference, requestPncpJson, parseMoney } from '../../../supabase/functions/_shared/pncpContracts';
import { syncPncpContract, type PncpRepository } from '../../../supabase/functions/sync-contratos-pncp-documentos/core';

const control = '10877412000168-2-000209/2024';
const contract = { id: 'contract-1', numero: '00129/2024', pncp_control_number: control };
const target = { anoContrato: 2024, sequencialContrato: 209, numeroContratoEmpenho: '00129', numeroControlePNCP: control };
const doc = { sequencialDocumento: 1, titulo: 'Contrato', url: 'https://pncp.gov.br/file.pdf' };
const invoice = { sequencialInstrumentoCobranca: 1, numeroInstrumentoCobranca: '1184',
  jsonResponseNFe: JSON.stringify({ notaFiscalDTO: { valorNotaFiscal: '44888.63' } }) };
const repository = () => ({ updateContract: vi.fn().mockResolvedValue(undefined),
  saveResource: vi.fn(async (_table, _id, rows) => rows.map((row) => row.raw_data)) });

describe('PNCP synchronization regressions', () => {
  it('reads page 2 and both publication windows, including a renewed contract', async () => {
    const request = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      if (params.get('dataInicial')?.endsWith('0701')) return null;
      if (params.get('pagina') === '1') return { data: [{ ...target, sequencialContrato: 1, numeroControlePNCP: 'other', numeroContratoEmpenho: '1' }], totalPaginas: 2 };
      return { data: [target], totalPaginas: 2 };
    });
    const ref = await resolvePncpReference({ numero: '00129/2024', vigencia_inicio: '2026-07-11', unidade_codigo: '158366' }, request);
    expect(ref?.sequencial).toBe('209');
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls.every(([url]) => !url.includes('2026'))).toBe(true);
  });
  it('never treats a failed later page as a complete negative lookup', async () => {
    const request = vi.fn().mockResolvedValueOnce({ data: [target], totalPaginas: 2 }).mockRejectedValueOnce(new Error('503'));
    await expect(listContractPages('10877412000168', 2024, '158366', request)).rejects.toThrow('503');
  });
  it('uses the stored contract control without consulting the renewal year', async () => {
    const request = vi.fn();
    expect((await resolvePncpReference(contract, request))?.sequencial).toBe('209');
    expect(request).not.toHaveBeenCalled();
  });
  it('does not mistake a procurement control (-1-) for a contract control (-2-)', async () => {
    const request = vi.fn().mockResolvedValue(null);
    expect(await resolvePncpReference({ numero: '129/2024', raw_data: { numeroControlePNCP: control.replace('-2-', '-1-') } }, request)).toBeNull();
    expect(request).toHaveBeenCalled();
  });
  it('rejects a same-number contract with a different year/process or unit', async () => {
    const request = vi.fn().mockResolvedValue({ data: [
      { ...target, anoContrato: 2025 }, { ...target, processo: '999999999' },
      { ...target, unidadeOrgao: { codigoUnidade: '999999' } },
    ], totalPaginas: 1 });
    expect(await resolvePncpReference({ numero: '129/2024', processo: '23035000357202363', unidade_codigo: '158366' }, request)).toBeNull();
  });
  it('detects repeated pages rather than looping or returning truncated data', async () => {
    const request = vi.fn().mockResolvedValue({ data: [target], totalPaginas: 3 });
    await expect(listContractPages('10877412000168', 2024, '158366', request)).rejects.toThrow('repetiu');
  });
  it('records HTTP 503 as error and leaves successful-check fields unchanged', async () => {
    const repo = repository();
    const result = await syncPncpContract({ id: 'c', numero: '129/2024' }, repo, vi.fn().mockRejectedValue(new Error('503')));
    expect(result.status).toBe('partial_error');
    const patches = repo.updateContract.mock.calls.map(([, patch]) => patch);
    expect(patches.some((patch) => 'pncp_documentos_checked_at' in patch || 'pncp_has_record' in patch)).toBe(false);
    expect(patches.at(-1)?.pncp_sync_error).toContain('503');
  });
  it('persists invoices even when the document endpoint fails', async () => {
    const repo = repository();
    const request = vi.fn().mockRejectedValueOnce(new Error('504')).mockResolvedValueOnce([invoice]);
    const result = await syncPncpContract(contract, repo, request);
    expect(result.documentos).toBeUndefined();
    expect(result.instrumentos).toHaveLength(1);
    expect(result.errors).toEqual(['documentos: 504']);
    expect(repo.saveResource.mock.calls[0][2][0].valor_nota_fiscal).toBe(44888.63);
    expect(repo.updateContract.mock.calls.some(([, patch]) => 'pncp_documentos_count' in patch)).toBe(false);
  });
  it('does not claim saved records or advance success timestamp when upsert fails', async () => {
    const repo = repository();
    repo.saveResource.mockRejectedValueOnce(new Error('RLS write denied'));
    const result = await syncPncpContract(contract, repo, vi.fn().mockResolvedValueOnce([doc]).mockResolvedValueOnce([]));
    expect(result.documentos).toBeUndefined();
    expect(result.errors[0]).toContain('RLS write denied');
    expect(repo.updateContract.mock.calls.some(([, patch]) => 'pncp_documentos_checked_at' in patch)).toBe(false);
  });
  it('distinguishes a successful empty response from malformed data', async () => {
    const repo = repository();
    const result = await syncPncpContract(contract, repo, vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ message: 'bad format' }));
    expect(result.documentos).toEqual([]);
    expect(result.instrumentos).toBeUndefined();
    expect(result.errors[0]).toContain('Formato inesperado');
  });
  it('returns both resources only after persistence completes', async () => {
    const repo = repository();
    const result = await syncPncpContract(contract, repo, vi.fn().mockResolvedValueOnce([doc]).mockResolvedValueOnce([invoice]));
    expect(result.status).toBe('success');
    expect(result.documentos).toEqual([doc]);
    expect(result.instrumentos).toEqual([invoice]);
    expect(repo.updateContract.mock.calls.at(-1)?.[1]).toEqual({ pncp_sync_error: null });
  });
  it('parses both Brazilian and JSON decimal amounts', () => {
    expect(parseMoney('44.888,63')).toBe(44888.63);
    expect(parseMoney('44888.63')).toBe(44888.63);
  });
  it('does not return an empty array for an HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 503, ok: false }));
    await expect(requestPncpJson('https://pncp.gov.br/test')).rejects.toThrow('503');
    vi.unstubAllGlobals();
  });
});
