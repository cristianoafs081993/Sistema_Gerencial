import { describe, expect, it } from 'vitest';

import { formatNotasFiscaisField, getNotasFiscais, hasNotaFiscalNumero } from '@/lib/suapNotaFiscal';
import { mergeInvoiceLists, normalizeInvoiceList } from '../../../supabase/functions/_shared/invoice_utils';

describe('notas fiscais SUAP', () => {
  it('normaliza a lista exibida e reconhece qualquer nota com numero', () => {
    const notas = getNotasFiscais({
      notas_fiscais: [
        { numero: '2350', data_emissao: '2026-01-10', valor: '100,00' },
        { numero: '', data_emissao: '', valor: '' },
        { numero: '2347', data_emissao: '2026-01-11' },
      ],
    });

    expect(notas).toHaveLength(2);
    expect(hasNotaFiscalNumero(notas)).toBe(true);
    expect(formatNotasFiscaisField(notas, 'numero')).toBe('2350\n2347');
    expect(formatNotasFiscaisField(notas, 'data_emissao')).toBe('2026-01-10\n2026-01-11');
  });

  it('mescla notas de reprocessamentos sem apagar as existentes nem duplicar entradas', () => {
    const existentes = normalizeInvoiceList([
      { numero: '2350', data_emissao: '2026-01-10', valor: '100,00' },
      { numero: '2347', data_emissao: '2026-01-11', valor: '80,00' },
    ]);
    const recebidas = normalizeInvoiceList([
      { numero: '2350', data_emissao: '2026-01-10', valor: '100,00' },
      { numero: '2320', data_emissao: '2026-01-12', valor: '50,00' },
    ]);

    expect(mergeInvoiceLists(existentes, recebidas)).toEqual([
      { numero: '2350', data_emissao: '2026-01-10', valor: '100,00' },
      { numero: '2347', data_emissao: '2026-01-11', valor: '80,00' },
      { numero: '2320', data_emissao: '2026-01-12', valor: '50,00' },
    ]);
  });
});
