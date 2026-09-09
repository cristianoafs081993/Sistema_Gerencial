import { describe, expect, it } from 'vitest';

import {
  assessDemandClarity,
  buildGerencialAnalysis,
  calculateStatisticalSummary,
  detectAssistantIntent,
  extractDemandItems,
  extractPtresTarget,
  getSynonymsForDemand,
  isPriceResearchClarification,
  mergeClarificationWithDemand,
  reconcilePtresData,
  summarizeContratos,
  summarizeDescentralizacoes,
  type HistoryMessage,
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

  it('detecta intencao de pesquisa de precos e extrai itens da demanda', () => {
    const prompt = 'Pesquise precos para 50 monitores 27 polegadas 4K com porta HDMI e ajuste de altura';
    expect(detectAssistantIntent(prompt)).toBe('pesquisa_precos');

    const items = extractDemandItems(prompt);
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(50);
    expect(items[0].unit).toBe('UN');
    expect(items[0].description).toContain('monitores 27 polegadas 4K');
    expect(items[0].catalogType).toBe('material');
  });

  it('extrai multiplos itens numerados de demanda complexa', () => {
    const complexPrompt = `
      Cotacao de precos para os seguintes itens:
      1) 20 cadeiras ergonomicas padrao NR17
      2) 10 mesas em L 140x140cm
      3) 5 servicos de manutencao preventiva em ar-condicionado
    `;
    expect(detectAssistantIntent(complexPrompt)).toBe('pesquisa_precos');

    const items = extractDemandItems(complexPrompt);
    expect(items.length).toBe(3);
    expect(items[0].quantity).toBe(20);
    expect(items[0].description).toContain('cadeiras ergonomicas');
    expect(items[1].quantity).toBe(10);
    expect(items[1].description).toContain('mesas em L');
    expect(items[2].quantity).toBe(5);
    expect(items[2].catalogType).toBe('service');
  });

  it('calcula estatisticas da IN 65/2021 (Mediana, Media, Desvio Padrao e CV)', () => {
    const prices = [1000, 1050, 1100, 1150, 1200];
    const stats = calculateStatisticalSummary(prices, 'median');

    expect(stats.count).toBe(5);
    expect(stats.median).toBe(1100);
    expect(stats.mean).toBe(1100);
    expect(stats.minimum).toBe(1000);
    expect(stats.maximum).toBe(1200);
    expect(stats.coefficientOfVariation).toBeLessThan(25);
  });

  it('detecta pesquisa de precos mesmo em perguntas informais e indiretas', () => {
    expect(detectAssistantIntent('quanto custa um monitor 27 polegadas?')).toBe('pesquisa_precos');
    expect(detectAssistantIntent('gostaria de pesquisar precos para cadeira escritorio')).toBe('pesquisa_precos');
    expect(detectAssistantIntent('qual o valor estimado de 15 computadores?')).toBe('pesquisa_precos');

    const item1 = extractDemandItems('quanto custa 50 monitores 27 pol');
    expect(item1[0].quantity).toBe(50);
    expect(item1[0].description).toContain('monitores 27 pol');

    const item2 = extractDemandItems('gostaria de pesquisar o preco de cadeira escritorio giratoria');
    expect(item2[0].description).toContain('cadeira escritorio giratoria');
  });

  it('avalia a clareza da demanda identificando itens vagos e formulando perguntas de esclarecimento', () => {
    // 1. Demanda genérica de computadores sem CPU/RAM/armazenamento
    const vaguePc = extractDemandItems('preciso cotar 10 computadores')[0];
    const clarityPc = assessDemandClarity(vaguePc);
    expect(clarityPc.isClear).toBe(false);
    expect(clarityPc.category).toBe('computadores');
    expect(clarityPc.missingAttributes).toBeDefined();
    expect(clarityPc.suggestedQuestions?.length).toBeGreaterThan(0);
    expect(clarityPc.quickOptions?.length).toBeGreaterThan(0);

    // 2. Demanda genérica de cadeiras sem especificação ergonômica
    const vagueChair = extractDemandItems('pesquisa de preco de 20 cadeiras')[0];
    const clarityChair = assessDemandClarity(vagueChair);
    expect(clarityChair.isClear).toBe(false);
    expect(clarityChair.category).toBe('mobiliario');
    expect(clarityChair.suggestedQuestions?.length).toBeGreaterThan(0);

    // 3. Demanda de ar-condicionado sem BTUs
    const vagueAc = extractDemandItems('cotar 4 aparelhos de ar-condicionado')[0];
    const clarityAc = assessDemandClarity(vagueAc);
    expect(clarityAc.isClear).toBe(false);
    expect(clarityAc.category).toBe('climatizacao');

    // 4. Demanda de projetor sem luminosidade (lúmens)
    const vagueProj = extractDemandItems('pesquisa de 2 projetores datashow')[0];
    const clarityProj = assessDemandClarity(vagueProj);
    expect(clarityProj.isClear).toBe(false);
    expect(clarityProj.category).toBe('audiovisual');

    // 5. Demanda clara com especificação técnica completa
    const clearPc = extractDemandItems('cotar 15 notebooks Intel Core i7 16GB SSD 512GB tela 15.6')[0];
    const clarityClearPc = assessDemandClarity(clearPc);
    expect(clarityClearPc.isClear).toBe(true);

    const clearChair = extractDemandItems('cotar 30 cadeiras giratorias ergonomicas padrao NR-17 com bracos regulaveis')[0];
    const clarityClearChair = assessDemandClarity(clearChair);
    expect(clarityClearChair.isClear).toBe(true);
  });

  it('expande termos de busca por sinonimos oficiais para ampliar a amostra no PNCP', () => {
    const synNotebook = getSynonymsForDemand('notebook');
    expect(synNotebook).toEqual(expect.arrayContaining(['computador portátil', 'laptop']));

    const synDesktop = getSynonymsForDemand('computador desktop');
    expect(synDesktop.some((s) => s.includes('microcomputador') || s.includes('estação de trabalho'))).toBe(true);

    const synCadeira = getSynonymsForDemand('cadeiras de escritorio');
    expect(synCadeira.some((s) => s.includes('giratória') || s.includes('poltrona'))).toBe(true);

    const synProjetor = getSynonymsForDemand('projetor');
    expect(synProjetor.some((s) => s.includes('multimídia') || s.includes('datashow'))).toBe(true);

    const synCabo = getSynonymsForDemand('cabos de rede');
    expect(synCabo.some((s) => s.includes('patch cord') || s.includes('utp'))).toBe(true);
  });

  it('detecta intencao de pesquisa_precos ao receber resposta a pergunta de esclarecimento', () => {
    const history: HistoryMessage[] = [
      { role: 'user', content: 'pesquisa de preco de 10 computadores' },
      {
        role: 'assistant',
        content: 'Para uma pesquisa de preco conforme a IN 65/2021, esclareca a configuracao: qual o processador e memoria RAM? ||SUGESTOES|| - Notebook i5 16GB SSD 512GB',
      },
    ];

    expect(isPriceResearchClarification(history[1].content)).toBe(true);

    // Resposta curta do usuário que normalmente seria classificada como 'geral'
    const userClarification = 'Processador Core i5 16GB de RAM e SSD 512GB';
    const detected = detectAssistantIntent(userClarification, history);
    expect(detected).toBe('pesquisa_precos');
  });

  it('funde a resposta de esclarecimento com a demanda original', () => {
    const originalDemand = extractDemandItems('pesquisar 10 computadores')[0];
    expect(originalDemand.quantity).toBe(10);

    const merged = mergeClarificationWithDemand(
      originalDemand,
      'Notebook Intel Core i5 16GB RAM SSD 512GB',
    );

    expect(merged.quantity).toBe(10);
    expect(merged.description.toLowerCase()).toContain('intel core i5');
    expect(merged.description.toLowerCase()).toContain('16gb');
  });

  it('extrai codigo de PTRES da mensagem do usuario', () => {
    expect(extractPtresTarget('me ajude a entender pq o ptres 231798 esta negativo')).toBe('231798');
    expect(extractPtresTarget('verificar saldo da origem 198307')).toBe('198307');
    expect(extractPtresTarget('quanto foi gasto com limpeza?')).toBeNull();
  });

  it('reconcilia com exatidao o caso do PTRES 231798 separando SUAP e SIAFI', () => {
    const atividades = [
      { origem_recurso: '231798', plano_interno: 'CAPACITA', valor_total: 15000 },
      { origem_recurso: '231798', plano_interno: 'LABS', valor_total: 41226.53 },
      { origem_recurso: '231798', plano_interno: 'INTERSEC', valor_total: 837.50 },
    ];
    const descentralizacoes = [
      { origem_recurso: '231798', plano_interno: 'L21B3P19ENN', valor: 1000, operacao_tipo: 'DESCENTRALIZACAO DE CREDITO' },
      { origem_recurso: '231798', plano_interno: 'LABS', valor: 41226.53, operacao_tipo: 'DESCENTRALIZACAO DE CREDITO' },
      { origem_recurso: '231798', plano_interno: 'CAPACITA', valor: 15000, operacao_tipo: 'DESCENTRALIZACAO DE CREDITO' },
      { origem_recurso: '231798', plano_interno: 'INTERSEC', valor: 837.50, operacao_tipo: 'DESCENTRALIZACAO DE CREDITO' },
    ];
    const empenhos = [
      { origem_recurso: '231798', plano_interno: 'L21B3P19ENN', numero: '2026NE000072', valor: 1000, tipo: 'exercicio' },
      { origem_recurso: '231798', plano_interno: 'LABS', numero: '2026NE000010', valor: 41226.53, tipo: 'exercicio' },
      { origem_recurso: '231798', plano_interno: 'CAPACITA', numero: '2026NE000020', valor: 15000, tipo: 'exercicio' },
    ];

    const result = reconcilePtresData('231798', atividades, descentralizacoes, empenhos);

    expect(result.ptres).toBe('231798');
    expect(result.planejadoSuap).toBe(57064.03);
    expect(result.descentralizadoSiafi).toBe(58064.03);
    expect(result.empenhadoSiafi).toBe(57226.53);
    expect(result.saldoPlanejamentoSuap).toBe(-162.50);
    expect(result.saldoRealSiafi).toBe(837.50);
    expect(result.situacaoGeral).toBe('DESCOMPASSO_COM_SUAP');
    expect(result.empenhosSemAtividadePlanejada[0].numero).toBe('2026NE000072');
    expect(result.diagnostico).toContain('NÃO possui déficit contábil no SIAFI');
    expect(result.diagnostico).toContain('POSITIVO em R$ 837.50');
  });

  it('integra conciliacaoPtres dentro de buildGerencialAnalysis quando mensagem contem PTRES', () => {
    const analysis = buildGerencialAnalysis('por que o ptres 231798 esta negativo?', [
      {
        label: 'atividades',
        count: 1,
        rows: [{ origem_recurso: '231798', plano_interno: 'TESTE', valor_total: 100 }],
      },
      {
        label: 'descentralizacoes',
        count: 1,
        rows: [{ origem_recurso: '231798', plano_interno: 'TESTE', valor: 200, operacao_tipo: 'DESCENTRALIZACAO' }],
      },
      {
        label: 'empenhos',
        count: 1,
        rows: [{ origem_recurso: '231798', plano_interno: 'TESTE', valor: 150, tipo: 'exercicio' }],
      },
    ]);

    expect(analysis.summary.conciliacaoPtres).toBeDefined();
    const conc = analysis.summary.conciliacaoPtres as any;
    expect(conc.ptres).toBe('231798');
    expect(conc.planejadoSuap).toBe(100);
    expect(conc.descentralizadoSiafi).toBe(200);
    expect(conc.empenhadoSiafi).toBe(150);
    expect(conc.saldoRealSiafi).toBe(50);
    expect(conc.saldoPlanejamentoSuap).toBe(-50);
  });
});

