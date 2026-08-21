import { describe, expect, it } from 'vitest';

import { DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
import { buildSuapProcessFlowSummary, getOrderedMappingNodes } from '@/lib/suapProcessFlow';

describe('suapProcessFlow', () => {
  it('preserva a ordem visual do mapa e aponta etapa atual e próxima etapa', () => {
    const ordered = getOrderedMappingNodes(DEFAULT_PROCESS_MAPPING);
    expect(ordered.map((node) => node.code)).toEqual(['1', '2', 'GW1', '3', '4', '5', '6']);

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
});
