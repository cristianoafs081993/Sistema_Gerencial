// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { BolsistaPdfRecord } from '../bolsistasPdfService';
import type { LCRegistro } from '../lcImportService';
import {
  buildLcGridRows,
  buildMacroRows,
  buildManualLcGridRow,
  cloneLcGridRowsForCopy,
  countLcGridPendencias,
} from '../lcWorkListBuilder';

const lcRow = (overrides: Partial<LCRegistro>): LCRegistro => ({
  obListaCredores: '2026LC000001',
  sequencial: 1,
  favorecidoDocumento: '',
  favorecidoNome: '',
  bancoCodigo: '001',
  bancoNome: 'BANCO DO BRASIL',
  agenciaCodigo: '1234',
  agenciaNome: '',
  contaBancaria: '',
  ...overrides,
});

const bolsista = (overrides: Partial<BolsistaPdfRecord>): BolsistaPdfRecord => ({
  cpf: '',
  nome: '',
  banco: '',
  agencia: '',
  conta: '',
  sourceFile: 'oficio',
  valor: 400,
  ...overrides,
});

describe('buildLcGridRows', () => {
  const lcRows = [
    lcRow({ favorecidoDocumento: '529.982.247-25', bancoCodigo: '1', agenciaCodigo: '1234', contaBancaria: '12345678-9' }),
    lcRow({ favorecidoDocumento: '11144477735', sequencial: 2, contaBancaria: '55555-5' }),
  ];

  it('marca ok, conta_nao_encontrada e aluno_nao_encontrado na ordem do documento', () => {
    const rows = buildLcGridRows([
      bolsista({ cpf: '529.982.247-25', nome: 'Um', banco: 'Banco do Brasil S.A', agencia: '1234', conta: '12345678-9' }),
      bolsista({ cpf: '111.444.777-35', nome: 'Dois', banco: 'Banco do Brasil S.A.', agencia: '4321-0', conta: '12.345-X' }),
      bolsista({ cpf: '123.456.789-09', nome: 'Tres', banco: 'Nu Pagamentos S.A. (Nubank)', agencia: '0001', conta: '9876543-2', ia: true }),
    ], lcRows, '00001');

    expect(rows.map((row) => row.status)).toEqual(['ok', 'conta_nao_encontrada', 'aluno_nao_encontrado']);
    expect(rows[0]).toMatchObject({ cpf: '52998224725', selectedBanco: '1', selectedAgencia: '1234', selectedConta: '123456789', contaPagadora: '00001' });
    // Conta do documento fica selecionada; a LC oferece a conta cadastrada.
    expect(rows[1]).toMatchObject({ selectedConta: '12345X', bancoPdf: '001', agenciaPdf: '43210', lcAccounts: [{ contaBancaria: '555555' }] });
    // Banco pelo nome vira codigo (antes caia sempre em 001).
    expect(rows[2]).toMatchObject({ bancoPdf: '260', selectedBanco: '260', ia: true });
    expect(countLcGridPendencias(rows)).toBe(2);
  });

  it('gera linhas da macro sem alunos ausentes da LC', () => {
    const rows = buildLcGridRows([
      bolsista({ cpf: '529.982.247-25', agencia: '1234', conta: '12345678-9' }),
      bolsista({ cpf: '123.456.789-09', agencia: '0001', conta: '1' }),
    ], lcRows, '00001');

    expect(buildMacroRows(rows)).toEqual([
      { cpf: '52998224725', bancoCodigo: '1', agenciaCodigo: '1234', contaPagadora: '00001', contaFavorecido: '123456789', valor: 400 },
    ]);
  });

  it('monta linha manual aproveitando nome e primeira conta da LC quando nao informados', () => {
    const namedLcRows = [
      lcRow({
        favorecidoDocumento: '529.982.247-25',
        favorecidoNome: 'MARIA ALUNA',
        bancoCodigo: '001',
        agenciaCodigo: '1234',
        contaBancaria: '12345678-9',
      }),
    ];

    const row = buildManualLcGridRow({ cpf: '529.982.247-25', valor: 350 }, namedLcRows, '00001');
    expect(row).toMatchObject({
      cpf: '52998224725',
      nome: 'MARIA ALUNA',
      selectedBanco: '001',
      selectedAgencia: '1234',
      selectedConta: '123456789',
      status: 'ok',
      valor: 350,
    });
    expect(row.id).toMatch(/^manual-52998224725-/);
  });

  it('clona linhas com novos ids sem compartilhar arrays de contas', () => {
    const original = buildLcGridRows([
      bolsista({ cpf: '529.982.247-25', nome: 'Um', agencia: '1234', conta: '12345678-9' }),
    ], lcRows, '00001');

    const cloned = cloneLcGridRowsForCopy(original);
    expect(cloned).toHaveLength(1);
    expect(cloned[0].id).not.toBe(original[0].id);
    expect(cloned[0].cpf).toBe(original[0].cpf);
    cloned[0].lcAccounts.push({ bancoCodigo: '104', agenciaCodigo: '0001', contaBancaria: '999' });
    expect(original[0].lcAccounts).toHaveLength(1);
  });
});
