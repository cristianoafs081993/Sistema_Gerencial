import { describe, expect, it } from 'vitest';

import { parseLCCsv } from '@/services/lcImportService';

describe('lcImportService', () => {
  it('preserva conta bancaria com digito X no valor importado', async () => {
    const csv = [
      'OB - Lista Credores;OB/LC - Sequencial;Favorecido - Documento;Favorecido - Nome;Banco;Banco Nome;Agencia;Agencia Nome;Conta',
      '20261031160044;8;709.453.264-40;Ana Julia de Araujo Santos;001;Banco do Brasil;8285-6;Agencia;7456-X',
    ].join('\n');
    const bytes = new TextEncoder().encode(csv);
    const file = {
      name: '7 - LC.csv',
      type: 'text/csv',
      arrayBuffer: async () => bytes.buffer,
    } as File;

    const rows = await parseLCCsv(file);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      favorecidoDocumento: '709.453.264-40',
      contaBancaria: '7456-X',
    });
  });
});
