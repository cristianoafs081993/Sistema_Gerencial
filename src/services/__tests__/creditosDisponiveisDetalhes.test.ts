import { vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

import { parseCreditoDisponivelFile } from '@/services/creditosDisponiveisDetalhes';

describe('parseCreditoDisponivelFile', () => {
  it('le arquivo tabulado codificado em Windows-1252', async () => {
    const ascii = new TextEncoder().encode(
      '"PTRES"\t"PI"\t\t"Metrica"\t\r\n' +
        '"230446"\t"CFF53M9601N"\t"PNAE"\t"Saldo - Moeda Origem (Conta Contabil)"\t"75.867,00"\r\n',
    );
    const encoded = new Uint8Array(ascii);
    const headerOffset = '"PTRES"\t"PI"\t\t"M'.length;
    encoded[headerOffset] = 0xe9;
    encoded[headerOffset + 1] = 't'.charCodeAt(0);

    const file = {
      arrayBuffer: async () => encoded.buffer,
    } as File;

    await expect(parseCreditoDisponivelFile(file)).resolves.toEqual([
      {
        ptres: '230446',
        planoInterno: 'CFF53M9601N',
        descricao: 'PNAE',
        metrica: 'Saldo - Moeda Origem (Conta Contabil)',
        valor: 75867,
      },
    ]);
  });
});
