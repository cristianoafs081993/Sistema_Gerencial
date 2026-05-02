import { describe, expect, it } from 'vitest';
import {
  createDescentralizacaoImportIdentity,
  normalizeDescentralizacaoImportValue,
  shouldImportDescentralizacaoAsNegative,
  summarizeNotaCredito,
} from '../descentralizacoesImport';

describe('descentralizacoesImport', () => {
  it('summarizes the NC code to the reduced format', () => {
    expect(summarizeNotaCredito('158155264352026NC000179')).toBe('2026NC000179');
  });

  it('keeps DESTINO positive even when the operation is an anulation', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'DESTINO',
        operationType: 'ANULACAO DE DESCENTRALIZACAO DE CREDITO',
        rawValue: 500,
      }),
    ).toEqual({ shouldImport: true, valor: 500 });
  });

  it('keeps DESTINO positive for regular descentralizacao', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'DESTINO',
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        rawValue: -500,
      }),
    ).toEqual({ shouldImport: true, valor: 500 });
  });

  it('imports ORIGEM as negative only for anulation', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'ORIGEM',
        operationType: 'ANULACAO DE DESCENTRALIZACAO DE CREDITO',
        rawValue: 500,
      }),
    ).toEqual({ shouldImport: true, valor: -500 });
  });

  it('ignores ORIGEM when it is not an anulation', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'ORIGEM',
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        rawValue: 500,
      }),
    ).toEqual({ shouldImport: false, valor: 0 });
  });

  it('recognizes ORIGEM and DESTINO labels with extra text', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'Destino da NC',
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        rawValue: -500,
      }),
    ).toEqual({ shouldImport: true, valor: 500 });

    expect(
      normalizeDescentralizacaoImportValue({
        cellType: 'Origem da NC',
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        rawValue: 500,
      }),
    ).toEqual({ shouldImport: false, valor: 0 });
  });

  it('ignores inferred origem rows in files without NC Celula - Tipo', () => {
    expect(
      normalizeDescentralizacaoImportValue({
        operationType: 'DESCENTRALIZACAO DE CREDITO',
        rawValue: 500,
        inferredOrigem: true,
      }),
    ).toEqual({ shouldImport: false, valor: 0 });
  });

  it('keeps the legacy anulation rule when NC Celula - Tipo is absent', () => {
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
});
