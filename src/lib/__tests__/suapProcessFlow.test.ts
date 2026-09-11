import { describe, expect, it } from 'vitest';

import { DEFAULT_BOLSA_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPING, DEFAULT_PROCESS_MAPPINGS } from '@/data/defaultProcessMapping';
import { buildSuapProcessFlowSummary, getOrderedMappingNodes, selectSuapProcessMapping } from '@/lib/suapProcessFlow';

describe('suapProcessFlow', () => {
  it('preserva a ordem visual do mapa e aponta etapa atual e próxima etapa', () => {
    const ordered = getOrderedMappingNodes(DEFAULT_PROCESS_MAPPING);
    expect(ordered.map((node) => node.code)).toEqual(['1', '2', '4', '5', '6']);

    const summary = buildSuapProcessFlowSummary(DEFAULT_PROCESS_MAPPING, {
      events: [
        { id: 'route-1', label: 'Encaminhado por DIAD/CN', rawText: 'Encaminhado por DIAD/CN', unit: 'DIAD/CN', order: 0 },
        { id: 'route-2', label: 'Recebido por COFINC/CN', rawText: 'Recebido por COFINC/CN', unit: 'COFINC/CN', order: 1 },
      ],
    }, { suapId: '321' });

    expect(summary.currentNodeId).toBe('step-4');
    expect(summary.nextNodeId).toBe('step-5');
    expect(summary.steps.find((step) => step.nodeId === 'step-2')?.status).toBe('completed');
    expect(summary.steps.find((step) => step.nodeId === 'step-4')?.status).toBe('current');
    expect(summary.fullPagePath).toBe('/mapeamentos/liquidacao-pagamento-nota-fiscal?suapId=321');
  });

  it('explica quando ainda não há trâmites identificados', () => {
    const summary = buildSuapProcessFlowSummary(DEFAULT_PROCESS_MAPPING, { events: [] });
    expect(summary.confidence).toBe('none');
    expect(summary.steps.find((step) => step.nodeId === 'step-1')?.status).toBe('next');
    expect(summary.note).toContain('histórico de trâmites');
  });

  it('acompanha o fluxo principal de bolsas sem marcar a complementação como concluída', () => {
    const ordered = getOrderedMappingNodes(DEFAULT_BOLSA_PROCESS_MAPPING);
    expect(ordered.map((node) => node.code)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(DEFAULT_BOLSA_PROCESS_MAPPING.nodes.find((node) => node.id === 'bolsa-step-complementacao')?.flowRole).toBe('exception');

    const summary = buildSuapProcessFlowSummary(DEFAULT_BOLSA_PROCESS_MAPPING, {
      events: [
        { id: 'route-1', label: 'Recebido pelo Coordenador do Projeto', rawText: 'Recebido pelo Coordenador do Projeto', unit: 'Coordenador do Projeto', order: 0 },
        { id: 'route-2', label: 'Encaminhado por COEX', rawText: 'Encaminhado por COEX', unit: 'COEX', order: 1 },
        { id: 'route-3', label: 'Recebido por DIAD', rawText: 'Recebido por DIAD', unit: 'DIAD', order: 2 },
        { id: 'route-4', label: 'Encaminhado por COFINC', rawText: 'Encaminhado por COFINC', unit: 'COFINC', order: 3 },
        { id: 'route-5', label: 'Autorizado pela DG', rawText: 'Autorizado pela DG', unit: 'DG', order: 4 },
      ],
    });

    expect(summary.currentNodeId).toBe('bolsa-step-5');
    expect(summary.nextNodeId).toBe('bolsa-step-6');
    expect(summary.steps.find((step) => step.nodeId === 'bolsa-step-4')?.status).toBe('completed');
    expect(summary.steps.find((step) => step.nodeId === 'bolsa-step-5')?.responsible).toBe('DG · Direção-Geral');
    expect(summary.steps.some((step) => step.nodeId === 'bolsa-step-complementacao')).toBe(false);
  });

  it('prioriza o mapa selecionado e reconhece bolsas pelo assunto', () => {
    expect(selectSuapProcessMapping(DEFAULT_PROCESS_MAPPINGS, { assunto: 'Pagamento de BÓLSA de pesquisa' })?.id)
      .toBe(DEFAULT_BOLSA_PROCESS_MAPPING.id);
    expect(selectSuapProcessMapping(DEFAULT_PROCESS_MAPPINGS, { assunto: 'Pagamento de bolsista de extensão' })?.id)
      .toBe(DEFAULT_BOLSA_PROCESS_MAPPING.id);
    expect(selectSuapProcessMapping(DEFAULT_PROCESS_MAPPINGS, {
      assunto: 'Pagamento de bolsa de pesquisa', selectedMappingId: DEFAULT_PROCESS_MAPPING.id,
    })?.id).toBe(DEFAULT_PROCESS_MAPPING.id);
    expect(selectSuapProcessMapping(DEFAULT_PROCESS_MAPPINGS, { assunto: 'Pagamento de nota fiscal' })?.id)
      .toBe(DEFAULT_PROCESS_MAPPING.id);
    expect(selectSuapProcessMapping(DEFAULT_PROCESS_MAPPINGS.slice().reverse(), { assunto: 'Pagamento de nota fiscal' })?.id)
      .toBe(DEFAULT_PROCESS_MAPPING.id);
  });

  it('permite definir manualmente a etapa atual com ajuste dos status anterior e posterior', () => {
    const summary = buildSuapProcessFlowSummary(DEFAULT_PROCESS_MAPPING, {
      events: [
        { id: 'route-1', label: 'Recebido por COFINC/CN', rawText: 'Recebido por COFINC/CN', unit: 'COFINC/CN', order: 0 },
      ],
    }, { manualCurrentStepNodeId: 'step-5' });

    expect(summary.currentNodeId).toBe('step-5');
    expect(summary.nextNodeId).toBe('step-6');
    expect(summary.isManualCurrentStep).toBe(true);
    expect(summary.note).toBeUndefined();

    expect(summary.steps.find((s) => s.nodeId === 'step-1')?.status).toBe('completed');
    expect(summary.steps.find((s) => s.nodeId === 'step-2')?.status).toBe('completed');
    expect(summary.steps.find((s) => s.nodeId === 'step-4')?.status).toBe('completed');
    expect(summary.steps.find((s) => s.nodeId === 'step-5')?.status).toBe('current');
    expect(summary.steps.find((s) => s.nodeId === 'step-6')?.status).toBe('next');
  });

  it('propaga as configurações de automação da etapa para os passos do fluxo', () => {
    const mappingWithAutomation = {
      ...DEFAULT_PROCESS_MAPPING,
      nodes: DEFAULT_PROCESS_MAPPING.nodes.map((node) =>
        node.id === 'step-4'
          ? {
              ...node,
              automation: {
                enabled: true,
                title: 'Registrar Liquidação no SIAFI',
                action: 'open_url' as const,
                targetUrl: 'https://siafi.tesouro.gov.br/processo/{processNumber}',
                autoAdvanceStep: true,
              },
            }
          : node
      ),
    };

    const summary = buildSuapProcessFlowSummary(mappingWithAutomation, { events: [] });
    const step4 = summary.steps.find((s) => s.nodeId === 'step-4');

    expect(step4?.automation).toBeDefined();
    expect(step4?.automation?.enabled).toBe(true);
    expect(step4?.automation?.title).toBe('Registrar Liquidação no SIAFI');
    expect(step4?.automation?.action).toBe('open_url');
  });
});
