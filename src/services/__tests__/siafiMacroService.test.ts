import { describe, expect, it } from 'vitest';

import type { BolsistaPdfRecord } from '@/services/bolsistasPdfService';
import type { LCRegistro } from '@/services/lcImportService';
import {
  buildSiafiContaPayload,
  buildSiafiListaCredoresMacro,
  buildSiafiMacroRowsFromComparison,
  buildSiafiMacroRowsFromPendencias,
} from '@/services/siafiMacroService';

function makeLc(partial: Partial<LCRegistro>): LCRegistro {
  return {
    obListaCredores: '158366264352023LC000001',
    sequencial: 1,
    favorecidoDocumento: '12672928495',
    favorecidoNome: 'Teste LC',
    bancoCodigo: '001',
    bancoNome: 'Banco do Brasil',
    agenciaCodigo: '1197',
    agenciaNome: 'Agencia',
    contaBancaria: '236428',
    ...partial,
  };
}

function makeBolsista(partial: Partial<BolsistaPdfRecord>): BolsistaPdfRecord {
  return {
    cpf: '126.729.284-95',
    nome: 'Aluno Teste',
    banco: '001',
    agencia: '1197',
    conta: '236428',
    sourceFile: 'Documento (12).pdf',
    ...partial,
  };
}

describe('siafiMacroService', () => {
  it('monta payload de conta no formato esperado do .mac', () => {
    const payload = buildSiafiContaPayload({
      cpf: '12672928495',
      bancoCodigo: '001',
      agenciaCodigo: '1197',
      contaPagadora: '408034',
      contaFavorecido: '236428',
    });

    expect(payload).toBe('0011197000000000040803400002200');
  });

  it('aplica enter extra na primeira quebra e quebra padrao nas demais', () => {
    const rows = Array.from({ length: 15 }).map((_, i) => ({
      cpf: String(10000000000 + i),
      bancoCodigo: '001',
      agenciaCodigo: '1197',
      contaPagadora: '408034',
      contaFavorecido: String(236428 + i),
    }));

    const macro = buildSiafiListaCredoresMacro(rows, {
      scriptName: 'Teste',
      chunkSize: 7,
      includeFirstConfirmationEnter: true,
    });

    expect(macro).toContain('<mouseclick row="8" col="12" />');
    expect(macro).toContain('[enter]s[enter][enter][erinp]');
    expect(macro).toContain('[enter]s[enter][erinp]');
    expect(macro.match(/\[enter\]s\[enter\]\[enter\]\[erinp\]/g)?.length).toBe(1);
    expect(macro.match(/\[enter\]s\[enter\]\[erinp\]/g)?.length).toBe(1);
    expect(macro).toContain('<input value="10000000000[tab]0011197000000000040803400002200[tab]00236428"');
  });

  it('gera linhas aptas apenas para bolsistas sem pendencia', () => {
    const bolsistas = [
      makeBolsista({ cpf: '126.729.284-95', conta: '236428' }),
      makeBolsista({ cpf: '700.352.464-30', conta: '999999' }),
      makeBolsista({ cpf: '123.855.954-94', conta: '000000' }),
      makeBolsista({ cpf: '126.729.284-95', conta: '236428', sourceFile: 'Documento (11).pdf' }),
    ];

    const lcRows = [
      makeLc({ favorecidoDocumento: '12672928495', contaBancaria: '236428', bancoCodigo: '001', agenciaCodigo: '1197' }),
      makeLc({ favorecidoDocumento: '70035246430', contaBancaria: '', bancoCodigo: '001', agenciaCodigo: '1197' }),
      makeLc({ favorecidoDocumento: '12385595494', contaBancaria: '111111', bancoCodigo: '001', agenciaCodigo: '1197' }),
    ];

    const rows = buildSiafiMacroRowsFromComparison(bolsistas, lcRows, { contaPagadoraPadrao: '408034' });

    expect(rows).toEqual([
      {
        cpf: '12672928495',
        bancoCodigo: '001',
        agenciaCodigo: '1197',
        contaPagadora: '408034',
        contaFavorecido: '236428',
      },
    ]);
  });

  it('gera linhas de macro a partir das pendencias usando dados do PDF', () => {
    const bolsistas = [
      makeBolsista({
        cpf: '126.729.284-95',
        banco: '001',
        agencia: '1197',
        conta: '236428',
        sourceFile: 'Documento (12).pdf',
      }),
      makeBolsista({
        cpf: '700.352.464-30',
        banco: '104',
        agencia: '0805',
        conta: '1300657326',
        sourceFile: 'Documento (11).pdf',
      }),
    ];

    const pendencias = [
      {
        cpf: '126.729.284-95',
        nome: 'Aluno 1',
        contaPdf: '236428',
        arquivoPdf: 'Documento (12).pdf',
        status: 'sem_cadastro_lc' as const,
        contaLc: '',
        nomeLc: '',
      },
      {
        cpf: '700.352.464-30',
        nome: 'Aluno 2',
        contaPdf: '1300657326',
        arquivoPdf: 'Documento (11).pdf',
        status: 'conta_divergente' as const,
        contaLc: '999999',
        nomeLc: 'Nome LC',
      },
    ];

    const rows = buildSiafiMacroRowsFromPendencias(pendencias, bolsistas, { contaPagadoraPadrao: '408034' });

    expect(rows).toEqual([
      {
        cpf: '12672928495',
        bancoCodigo: '001',
        agenciaCodigo: '1197',
        contaPagadora: '408034',
        contaFavorecido: '236428',
      },
      {
        cpf: '70035246430',
        bancoCodigo: '104',
        agenciaCodigo: '0805',
        contaPagadora: '408034',
        contaFavorecido: '1300657326',
      },
    ]);
  });

  it('gera macro no novo padrao de input (Teste2.mac)', () => {
    const macro = buildSiafiListaCredoresMacro(
      [
        {
          cpf: '12302654260',
          bancoCodigo: '001',
          agenciaCodigo: '0223',
          contaPagadora: '220200',
          contaFavorecido: '22220000',
        },
      ],
      {
        scriptName: 'Teste2',
        author: 'crist',
      },
    );

    expect(macro).toContain('<mouseclick row="8" col="12" />');
    expect(macro).toContain('<input value="12302654260[tab]0010223000000000022020000002200[tab]22220000"');
    expect(macro).toContain('<nextscreens timeout="0" >');
  });
});
