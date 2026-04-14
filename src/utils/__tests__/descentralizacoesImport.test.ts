import { describe, expect, it } from 'vitest';
import {
  createDescentralizacaoImportIdentity,
  shouldImportDescentralizacaoAsNegative,
  summarizeNotaCredito,
} from '../descentralizacoesImport';

describe('descentralizacoesImport', () => {
  it('summarizes the NC code to the reduced format', () => {
    expect(summarizeNotaCredito('158155264352026NC000179')).toBe('2026NC000179');
  });

  it('marks an anulation operation as negative even when the value is positive in the CSV', () => {
    expect(
      shouldImportDescentralizacaoAsNegative({
        operationType: 'ANULACAO DE DESCENTRALIZACAO DE CREDITO',
        description: 'PROCESSO 23421.001442.2026-65 - ESTORNO PARA AJUSTE NO PI',
      }),
    ).toBe(true);
  });

  it('keeps the legacy devolucao detection for the main import flow', () => {
    expect(
      shouldImportDescentralizacaoAsNegative({
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        description: 'DEVOLUCAO DE CREDITO PARA AJUSTE',
      }),
    ).toBe(true);
  });

  it('uses the summarized NC as an extra row identifier when available', () => {
    expect(
      createDescentralizacaoImportIdentity({
        dateKey: '2026-03-19',
        planoInterno: 'L21B3P19ENN',
        origemRecurso: '231798',
        naturezaDespesa: '339000',
        valor: -3217.5,
        notaCredito: '2026NC000179',
      }),
    ).toEqual({
      baseKey: '2026-03-19|L21B3P19ENN|231798|339000|-3217.5',
      rowKey: '2026-03-19|L21B3P19ENN|231798|339000|-3217.5|2026NC000179',
    });
  });

  it('keeps rows from the same NC separated when the plano interno changes', () => {
    const ensino = createDescentralizacaoImportIdentity({
      dateKey: '2026-03-19',
      planoInterno: 'L21B3P19ENN',
      origemRecurso: '231798',
      naturezaDespesa: '339000',
      valor: -3217.5,
      notaCredito: '2026NC000179',
    });
    const extensao = createDescentralizacaoImportIdentity({
      dateKey: '2026-03-19',
      planoInterno: 'L21B3P21EXN',
      origemRecurso: '231798',
      naturezaDespesa: '339000',
      valor: -3217.5,
      notaCredito: '2026NC000179',
    });

    expect(ensino.rowKey).not.toBe(extensao.rowKey);
    expect(ensino.baseKey).not.toBe(extensao.baseKey);
  });
});
