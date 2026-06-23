import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('RequisicaoCompra header', () => {
  it('exibe o titulo somente no header global', () => {
    const source = readFileSync('src/pages/RequisicaoCompra.tsx', 'utf8');

    expect(source).toContain('<HeaderSubtitle>Gestão de Requisições de Compra</HeaderSubtitle>');
    expect(source).not.toContain('Módulo de registro e conferência de Requisições de Compra');
    expect(source).not.toContain('>Gestão de Requisições de Compra</h1>');
  });
});
