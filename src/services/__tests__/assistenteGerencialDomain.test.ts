import { describe, expect, it } from 'vitest';

import {
  buildGerencialAnalysis,
  detectAssistantIntent,
  summarizeContratos,
  summarizeDescentralizacoes,
} from '../../../supabase/functions/assistente-gerencial/domain';

describe('assistente-gerencial domain helpers', () => {
  it('detecta pergunta de descentralizacao por PTRES e PI', () => {
    expect(detectAssistantIntent('quanto a reitoria descentralizou pro campus currais novos? detalhe por ptres e pi'))
      .toBe('descentralizacoes');
  });

  it('agrega descentralizacoes por PTRES e PI abatendo devolucoes', () => {
    const result = summarizeDescentralizacoes([
      {
        origem_recurso: '231796',
        plano_interno: 'L20RLP19ENN',
        natureza_despesa: '339000',
        dimensao: 'Funcionamento',
        nota_credito: '2026NC000001',
        valor: 1000,
      },
      {
        origem_recurso: '231796',
        plano_interno: 'L20RLP19ENN',
        natureza_despesa: '339000',
        dimensao: 'Funcionamento',
        nota_credito: '2026NC000002',
        operacao_tipo: 'DEVOLUCAO',
        valor: -250,
      },
      {
        origem_recurso: '231802',
        plano_interno: 'L20RLP20ENN',
        natureza_despesa: '449000',
        dimensao: 'Investimento',
        valor: 500,
      },
    ]);

    expect(result.summary.totalDescentralizadoLiquido).toBe(1250);
    expect(result.summary.totalAbatimentos).toBe(-250);
    expect(result.summary.porPtres[0]).toMatchObject({
      ptres: '231796',
      total: 750,
      porPi: [{ pi: 'L20RLP19ENN', total: 750 }],
    });
  });

  it('agrega apenas contratos ativos com escopo do campus e calcula saldo por empenhos', () => {
    const result = summarizeContratos(
      [
        {
          id: 'campus-active',
          numero: '00001/2026',
          fornecedor_nome: 'Fornecedor Campus',
          unidade_codigo: '158366',
          objeto: 'Servico campus',
          situacao_derivada: true,
          vigencia_fim_derivada: '2026-12-31',
        },
        {
          id: 'reitoria-active',
          numero: '00002/2026',
          fornecedor_nome: 'Fornecedor Reitoria',
          unidade_codigo: '158155',
          objeto: 'Servico reitoria para campus',
          situacao_derivada: true,
          campus_scope_reason: 'empenho 158366',
        },
        {
          id: 'inactive',
          numero: '00003/2025',
          unidade_codigo: '158366',
          situacao_derivada: false,
        },
      ],
      [
        {
          contrato_api_id: 'campus-active',
          unidade_gestora: '158366',
          valor_empenhado: 1000,
          valor_a_liquidar: 300,
          valor_liquidado: 700,
          valor_pago: 600,
        },
        {
          contrato_api_id: 'reitoria-active',
          unidade_gestora: '158366',
          valor_empenhado: 2000,
          valor_a_liquidar: 0,
          rp_inscrito: 900,
          rp_a_pagar: 400,
        },
      ],
      [],
    );

    expect(result.summary.contratosAtivos).toBe(2);
    expect(result.summary.contratosAtivosComEscopoCampus).toBe(2);
    expect(result.summary.totaisExecucao).toMatchObject({
      empenhado: 3000,
      saldoAtual: 700,
    });
    expect(result.summary.maioresSaldos[0]).toMatchObject({
      numero: '00002/2026',
      origem: 'Reitoria 158155 com evidencia do campus',
      saldoAtual: 400,
    });
  });

  it('monta analise de contratos a partir das secoes consultadas', () => {
    const analysis = buildGerencialAnalysis('quais contratos ativos tem maior saldo?', [
      {
        label: 'contratos_api',
        rows: [{ id: 'c1', numero: '00001/2026', unidade_codigo: '158366', situacao_derivada: true }],
        count: 1,
      },
      {
        label: 'contratos_api_empenhos',
        rows: [{ contrato_api_id: 'c1', valor_empenhado: 100, valor_a_liquidar: 80 }],
        count: 1,
      },
      { label: 'contratos_api_faturas', rows: [], count: 0 },
    ]);

    expect(analysis.intent).toBe('contratos');
    expect(analysis.summary.maioresSaldos[0]).toMatchObject({ numero: '00001/2026', saldoAtual: 80 });
  });
});
