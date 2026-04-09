import { describe, expect, it } from 'vitest';
import { compararBolsistasComLC } from '@/services/lcComparisonService';
import type { LCRegistro } from '@/services/lcImportService';
import type { BolsistaPdfRecord } from '@/services/bolsistasPdfService';

function makeBolsista(partial: Partial<BolsistaPdfRecord>): BolsistaPdfRecord {
  return {
    cpf: '000.000.000-00',
    nome: 'Teste',
    banco: '001',
    agencia: '0001',
    conta: '12345-6',
    sourceFile: 'doc.pdf',
    ...partial,
  };
}

function makeLC(partial: Partial<LCRegistro>): LCRegistro {
  return {
    obListaCredores: 'OB1',
    sequencial: 1,
    favorecidoDocumento: '00000000000',
    favorecidoNome: 'Teste LC',
    bancoCodigo: '001',
    bancoNome: 'Banco',
    agenciaCodigo: '0001',
    agenciaNome: 'Agencia',
    contaBancaria: '123456',
    ...partial,
  };
}

describe('compararBolsistasComLC', () => {
  it('nao gera pendencia quando CPF e conta batem', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95', conta: '34710750-8' })];
    const lcRows = [makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '347107508' })];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(0);
  });

  it('gera sem_cadastro_lc quando CPF nao existe na LC', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95' })];
    const lcRows = [makeLC({ favorecidoDocumento: '99999999999' })];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('sem_cadastro_lc');
  });

  it('gera sem_conta_lc quando CPF existe mas conta da LC esta vazia', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95', conta: '34710750-8' })];
    const lcRows = [makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '' })];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('sem_conta_lc');
  });

  it('gera conta_divergente quando contas diferem', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95', conta: '99999999-9' })];
    const lcRows = [makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '347107508' })];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('conta_divergente');
  });

  it('lista todas as contas da LC na divergencia quando o CPF possui multiplas contas', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95', conta: '99999999-9' })];
    const lcRows = [
      makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '11111111' }),
      makeLC({ obListaCredores: 'OB2', sequencial: 2, favorecidoDocumento: '12672928495', contaBancaria: '347107508' }),
    ];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('conta_divergente');
    expect(result[0].contaLc).toBe('11111111, 347107508');
  });

  it('nao gera pendencia se houver multiplas LCs e uma delas bater a conta', () => {
    const bolsistas = [makeBolsista({ cpf: '126.729.284-95', conta: '34710750-8' })];
    const lcRows = [
      makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '11111111' }),
      makeLC({ obListaCredores: 'OB2', sequencial: 2, favorecidoDocumento: '12672928495', contaBancaria: '347107508' }),
    ];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(0);
  });

  it('deduplica pendencias repetidas no mesmo arquivo', () => {
    const bolsistas = [
      makeBolsista({ cpf: '126.729.284-95', conta: '9999', sourceFile: 'a.pdf' }),
      makeBolsista({ cpf: '126.729.284-95', conta: '9999', sourceFile: 'a.pdf' }),
    ];
    const lcRows = [makeLC({ favorecidoDocumento: '12672928495', contaBancaria: '347107508' })];

    const result = compararBolsistasComLC(bolsistas, lcRows);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('conta_divergente');
  });
});
