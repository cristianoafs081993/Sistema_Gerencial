import { describe, expect, it } from 'vitest';

import { buildSuapProcessFinanceSummary } from '@/services/suapProcessFinance';
import type { ContratoApiEmpenhoRow, ContratoApiPublicLiquidacaoRow, ContratoApiRow } from '@/services/contratosApi';
import type { Contrato, ContratoEmpenho, Empenho, SuapProcesso } from '@/types';

const date = new Date('2026-01-10T00:00:00Z');

function processo(overrides: Partial<SuapProcesso> = {}): SuapProcesso {
  return {
    id: 'processo-1',
    suapId: '321',
    url: 'https://suap.ifrn.edu.br/processo_eletronico/processo/321/',
    status: 'success',
    numProcesso: '23035.000001.2026-11',
    beneficiario: 'Fornecedor Alfa Ltda',
    cpfCnpj: '12.345.678/0001-90',
    ...overrides,
  };
}

function empenho(overrides: Partial<Empenho> = {}): Empenho {
  return {
    id: 'empenho-1',
    numero: '2026NE000001',
    descricao: 'Empenho de teste',
    valor: 1000,
    dimensao: 'AD',
    componenteFuncional: 'Orcamento',
    origemRecurso: 'Tesouro',
    naturezaDespesa: '339039',
    favorecidoNome: 'Fornecedor Alfa Ltda',
    favorecidoDocumento: '12345678000190',
    valorLiquidado: 250,
    valorLiquidadoOficial: 300,
    valorPagoOficial: 120,
    tipo: 'exercicio',
    dataEmpenho: date,
    status: 'pendente',
    createdAt: date,
    updatedAt: date,
    ...overrides,
  };
}

function contrato(overrides: Partial<Contrato> = {}): Contrato {
  return {
    id: 'contrato-1',
    numero: '00040/2026',
    contratada: 'Fornecedor Alfa Ltda',
    created_at: date,
    updated_at: date,
    ...overrides,
  };
}

function link(overrides: Partial<ContratoEmpenho> = {}): ContratoEmpenho {
  return {
    id: 'link-1',
    contrato_id: 'contrato-1',
    empenho_id: 'empenho-1',
    created_at: date,
    ...overrides,
  };
}

function contratoApi(overrides: Partial<ContratoApiRow> = {}): ContratoApiRow {
  return {
    id: 'api-contrato-1',
    api_contrato_id: 40,
    numero: '40/2026',
    fornecedor_nome: 'Fornecedor Alfa Ltda',
    fornecedor_documento: '12345678000190',
    unidade_codigo: '158366',
    unidade_nome: 'IFRN Campus',
    unidade_origem_codigo: '158366',
    unidade_origem_nome: 'IFRN Campus',
    objeto: 'Servico continuado',
    processo: null,
    vigencia_inicio: null,
    vigencia_fim: null,
    valor_global: 1000,
    valor_acumulado: 1000,
    situacao: true,
    updated_at: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function empenhoApi(overrides: Partial<ContratoApiEmpenhoRow> = {}): ContratoApiEmpenhoRow {
  return {
    id: 'api-empenho-1',
    contrato_api_id: 'api-contrato-1',
    api_empenho_id: 1001,
    numero: '2026NE000099',
    unidade_gestora: '158366',
    gestao: '26435',
    data_emissao: '2026-02-01',
    credor: 'Fornecedor Alfa Ltda',
    fonte_recurso: null,
    plano_interno: null,
    natureza_despesa: null,
    valor_empenhado: 500,
    valor_a_liquidar: 200,
    valor_liquidado: 300,
    valor_pago: 100,
    rp_inscrito: null,
    rp_a_pagar: null,
    raw_data: null,
    ...overrides,
  };
}

function liquidacao(overrides: Partial<ContratoApiPublicLiquidacaoRow> = {}): ContratoApiPublicLiquidacaoRow {
  return {
    contrato_api_id: 40,
    contrato_numero: '40/2026',
    contrato_objeto: 'Servico continuado',
    fatura_id: 900,
    numero_instrumento_cobranca: 'NF 123',
    situacao: 'Liquidada',
    valor_bruto: 300,
    valor_liquido: 280,
    data_emissao: '2026-02-15',
    data_vencimento: null,
    data_pagamento: null,
    data_liquidacao: '2026-02-20',
    processo: null,
    empenho_numero: '2026NE000099',
    valor_empenho: 300,
    subelemento: null,
    ...overrides,
  };
}

describe('buildSuapProcessFinanceSummary', () => {
  it('resume empenhos locais do beneficiario sem expor pagamento', () => {
    const summary = buildSuapProcessFinanceSummary({
      processo: processo(),
      empenhos: [empenho(), empenho({ id: 'empenho-2', numero: '2026NE000002', favorecidoDocumento: '99999999000199' })],
      contratos: [],
      contratosEmpenhos: [],
      contratosApi: [],
      contratosApiEmpenhos: [],
    });

    expect(summary.status).toBe('ready');
    expect(summary.escopoContrato).toBe(false);
    expect(summary.empenhos).toHaveLength(1);
    expect(summary.totais).toEqual({ empenhado: 1000, saldo: 750 });
    expect(JSON.stringify(summary)).not.toMatch(/pago|pagamento/i);
  });

  it('mantem empenhado e saldo da fonte de empenhos e preserva liquidacoes detalhadas', () => {
    const summary = buildSuapProcessFinanceSummary({
      processo: processo({ contrato: '40/2026' }),
      empenhos: [],
      contratos: [contrato()],
      contratosEmpenhos: [],
      contratosApi: [contratoApi()],
      contratosApiEmpenhos: [empenhoApi({ valor_liquidado: 0, valor_pago: 0, valor_empenhado: 500, valor_a_liquidar: 200 })],
      liquidacoesPorEmpenho: new Map([['2026NE000099', [liquidacao({ valor_liquido: 280 })]]]),
    });

    expect(summary.empenhos[0]).toMatchObject({ numero: '2026NE000099', empenhado: 500, saldo: 200 });
    expect(summary.empenhos[0].liquidacoes).toEqual([
      expect.objectContaining({ numero: 'NF 123', valor: 280, data: '2026-02-20' }),
    ]);
    expect(summary.totais).toEqual({ empenhado: 500, saldo: 200 });
  });

  it('quando ha contrato, limita empenhos ao contrato e preserva liquidacoes detalhadas', () => {
    const cache = new Map([[
      '2026NE000099',
      [
        liquidacao({ situacao: 'Pago' }),
        liquidacao({ contrato_numero: '41/2026', fatura_id: 901, numero_instrumento_cobranca: 'NF fora' }),
      ],
    ]]);

    const summary = buildSuapProcessFinanceSummary({
      processo: processo({ contrato: '40/2026' }),
      empenhos: [
        empenho(),
        empenho({ id: 'empenho-fora', numero: '2026NE000002', valor: 900, valorLiquidadoOficial: 0, favorecidoDocumento: '12345678000190' }),
      ],
      contratos: [contrato()],
      contratosEmpenhos: [link({ empenho_id: 'empenho-1' })],
      contratosApi: [contratoApi(), contratoApi({ id: 'api-contrato-2', numero: '41/2026' })],
      contratosApiEmpenhos: [empenhoApi(), empenhoApi({ id: 'api-empenho-fora', contrato_api_id: 'api-contrato-2', numero: '2026NE000100' })],
      liquidacoesPorEmpenho: cache,
    });

    expect(summary.status).toBe('ready');
    expect(summary.escopoContrato).toBe(true);
    expect(summary.contrato?.numero).toBe('00040/2026');
    expect(summary.empenhos.map((item) => item.numero)).toEqual(['2026NE000001', '2026NE000099']);
    expect(summary.empenhos.find((item) => item.numero === '2026NE000099')?.liquidacoes).toEqual([
      expect.objectContaining({ numero: 'NF 123', situacao: 'Liquidada', valor: 280, data: '2026-02-20' }),
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/pago|pagamento/i);
  });

  it('nao injeta dados quando o processo ainda nao tem beneficiario identificado', () => {
    const summary = buildSuapProcessFinanceSummary({
      processo: processo({ beneficiario: undefined, cpfCnpj: undefined }),
      empenhos: [empenho()],
      contratos: [],
      contratosEmpenhos: [],
      contratosApi: [],
      contratosApiEmpenhos: [],
    });

    expect(summary.status).toBe('missing-beneficiary');
    expect(summary.empenhos).toHaveLength(0);
  });
});