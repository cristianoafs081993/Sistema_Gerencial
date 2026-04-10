import { describe, expect, it } from 'vitest';

import {
  buildEmpenhoLookupKeys,
  detectContratosImportReportKind,
  extractContractParty,
  normalizeContratoNumero,
  normalizeCnpj,
  shouldIgnoreContratoNumero,
} from '@/utils/contratosSync';

describe('contratosSync utils', () => {
  it('normaliza o numero do contrato para cinco digitos antes da barra', () => {
    expect(normalizeContratoNumero('40/2026')).toBe('00040/2026');
    expect(normalizeContratoNumero('00040/2026')).toBe('00040/2026');
    expect(normalizeContratoNumero('  294 / 2023  ')).toBe('00294/2023');
  });

  it('separa razao social e cnpj do campo combinado da planilha', () => {
    expect(
      extractContractParty('Cooperativa Mista dos Agricultores Familiares do Serido (14426441000164) (Pessoa Jurídica)'),
    ).toEqual({
      contratada: 'Cooperativa Mista dos Agricultores Familiares do Serido',
      cnpj: '14426441000164',
    });

    expect(extractContractParty('Funcern')).toEqual({
      contratada: 'Funcern',
      cnpj: undefined,
    });
  });

  it('gera chaves de lookup para numero completo e numero resumido do empenho', () => {
    expect(buildEmpenhoLookupKeys('158366264352025NE000298')).toEqual([
      '158366264352025NE000298',
      '2025NE000298',
    ]);
  });

  it('normaliza o cnpj para somente digitos', () => {
    expect(normalizeCnpj('14.426.441/0001-64')).toBe('14426441000164');
  });

  it('detecta o relatorio de contratos ativos pelos cabecalhos', () => {
    expect(
      detectContratosImportReportKind([
        {
          Número: '00040/2026',
          Contratada: 'Cooperativa',
          'Data de Início': '12/02/2026',
          'Data de Término': '12/02/2027',
        },
      ]),
    ).toBe('active_contracts');
  });

  it('detecta o relatorio de vinculos e valores pelos cabecalhos', () => {
    expect(
      detectContratosImportReportKind([
        {
          Contrato: '00040/2026',
          'Número do empenho': '158366264352025NE000298',
          'Valor (R$)': '1864.80',
        },
      ]),
    ).toBe('links_and_values');
  });

  it('ignora o contrato legado da caern substituido por contrato mais recente', () => {
    expect(shouldIgnoreContratoNumero('00089/2016')).toBe(true);
    expect(shouldIgnoreContratoNumero('89/2016')).toBe(true);
    expect(shouldIgnoreContratoNumero('00374/2024')).toBe(false);
  });
});
