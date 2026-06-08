import { vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { parseRapHistoricoAnualFile, rapHistoricoAnualService } from '@/services/rapHistoricoAnual';

describe('rapHistoricoAnualService', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.stubGlobal('crypto', { randomUUID: () => 'batch-rap-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('le arquivo CSV codificado em Windows-1252', async () => {
    const ascii = new TextEncoder().encode(
      '"UG Executora",,"NE CCor - Ano Emissao","Metrica","Item Informacao",,\r\n' +
        '"158366","Campus","2024","Saldo - Moeda Origem (Conta Contabil)","50","RESTOS A PAGAR INSCRITOS (PROC E N PROC)","1.894.706,77"\r\n',
    );
    const encoded = new Uint8Array(ascii);
    const dataOffset = ascii.findIndex((byte, index) => {
      const target = '"158366","Campus"';
      const slice = ascii.slice(index, index + target.length);
      return new TextDecoder().decode(slice) === target;
    }) + '"158366","Camp'.length;
    encoded[dataOffset] = 0xe1;

    const file = {
      arrayBuffer: async () => encoded.buffer,
    } as File;

    await expect(parseRapHistoricoAnualFile(file)).resolves.toEqual([
      expect.objectContaining({
        ugExecutora: '158366',
        ano: 2024,
        itemInformacaoCodigo: '50',
        valor: 1894706.77,
      }),
    ]);
  });

  it('importa novo lote sem apagar lotes anteriores', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert: insertMock });

    await rapHistoricoAnualService.importReport(
      [
        {
          ugExecutora: '158366',
          ugNome: 'Campus Currais Novos',
          ano: 2025,
          metrica: 'Saldo',
          itemInformacaoCodigo: '50',
          itemInformacaoNome: 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)',
          valor: 1536898.22,
        },
      ],
      'historico-rap.csv',
    );

    expect(fromMock).toHaveBeenCalledWith('rap_historico_anual');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        ug_executora: '158366',
        ano: 2025,
        import_batch_id: 'batch-rap-1',
        source_file: 'historico-rap.csv',
      }),
    ]);
  });

  it('carrega sempre o ultimo lote importado', async () => {
    const latestMaybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        import_batch_id: 'batch-latest',
        source_file: 'historico-rap.csv',
        imported_at: '2026-06-02T12:00:00.000Z',
      },
      error: null,
    });
    const latestLimitMock = vi.fn(() => ({ maybeSingle: latestMaybeSingleMock }));
    const latestOrderMock = vi.fn(() => ({ limit: latestLimitMock }));
    const latestSelectMock = vi.fn(() => ({ order: latestOrderMock }));

    const rowsOrderCodigoMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'row-1',
          ug_executora: '158366',
          ug_nome: 'Campus Currais Novos',
          ano: 2025,
          metrica: 'Saldo',
          item_informacao_codigo: '50',
          item_informacao_nome: 'RESTOS A PAGAR INSCRITOS (PROC E N PROC)',
          valor: '1536898.22',
          import_batch_id: 'batch-latest',
          source_file: 'historico-rap.csv',
          imported_at: '2026-06-02T12:00:00.000Z',
        },
      ],
      error: null,
    });
    const rowsOrderAnoMock = vi.fn(() => ({ order: rowsOrderCodigoMock }));
    const rowsOrderUgMock = vi.fn(() => ({ order: rowsOrderAnoMock }));
    const rowsEqMock = vi.fn(() => ({ order: rowsOrderUgMock }));
    const rowsSelectMock = vi.fn(() => ({ eq: rowsEqMock }));

    fromMock
      .mockReturnValueOnce({ select: latestSelectMock })
      .mockReturnValueOnce({ select: rowsSelectMock });

    await expect(rapHistoricoAnualService.getLatestReport()).resolves.toMatchObject({
      sourceFile: 'historico-rap.csv',
      importedAt: '2026-06-02T12:00:00.000Z',
      rows: [
        {
          id: 'row-1',
          ugExecutora: '158366',
          ano: 2025,
          valor: 1536898.22,
          importBatchId: 'batch-latest',
        },
      ],
    });
    expect(rowsEqMock).toHaveBeenCalledWith('import_batch_id', 'batch-latest');
  });
});
