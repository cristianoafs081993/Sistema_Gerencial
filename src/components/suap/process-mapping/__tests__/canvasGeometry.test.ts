import { describe, expect, it } from 'vitest';
import type { ProcessMappingEdge, ProcessMappingNode } from '@/types/processMapping';
import {
  calculateEdgePath,
  determineAutoAnchors,
  generateRoundedSteppedPath,
  getNodeCenter,
  getNodeDimensions,
} from '../canvasGeometry';

describe('canvasGeometry', () => {
  const nodeTask1: ProcessMappingNode = {
    id: 'task-1',
    code: '1',
    title: 'Anexar documentos',
    description: '',
    type: 'task',
    position: { x: 100, y: 100 },
    width: 200,
    height: 100,
    responsible: 'Coordenação',
  };

  const nodeGateway: ProcessMappingNode = {
    id: 'gw-1',
    code: 'GW1',
    title: 'Documentação completa?',
    description: '',
    type: 'gateway',
    position: { x: 400, y: 110 },
    width: 68,
    height: 68,
    responsible: 'Coordenação',
  };

  const nodeTask2Down: ProcessMappingNode = {
    id: 'task-2-down',
    code: '2',
    title: 'Encaminhar à DIAD',
    description: '',
    type: 'task',
    position: { x: 600, y: 300 },
    width: 200,
    height: 100,
    responsible: 'DIAD',
  };

  const nodeTaskRight: ProcessMappingNode = {
    id: 'task-right',
    code: '2A',
    title: 'Solicitar complementação',
    description: '',
    type: 'task',
    position: { x: 600, y: 100 },
    width: 200,
    height: 100,
    responsible: 'Coordenação',
  };

  it('calcula dimensões e centro dos nós corretamente', () => {
    expect(getNodeDimensions(nodeTask1)).toEqual({ width: 200, height: 100 });
    expect(getNodeCenter(nodeTask1)).toEqual({ x: 200, y: 150 });

    expect(getNodeDimensions(nodeGateway)).toEqual({ width: 68, height: 68 });
  });

  it('distribui portas do Gateway evitando sobreposição de saídas', () => {
    // Ramificação para a direita (mesmo nível)
    const edgeRight: ProcessMappingEdge = {
      id: 'e-right',
      source: 'gw-1',
      target: 'task-right',
      label: 'Não',
    };
    const anchorsRight = determineAutoAnchors(nodeGateway, nodeTaskRight, edgeRight);
    expect(anchorsRight.sourceAnchor).toBe('right');

    // Ramificação para baixo (nível inferior)
    const edgeDown: ProcessMappingEdge = {
      id: 'e-down',
      source: 'gw-1',
      target: 'task-2-down',
      label: 'Sim',
    };
    const anchorsDown = determineAutoAnchors(nodeGateway, nodeTask2Down, edgeDown);
    expect(anchorsDown.sourceAnchor).toBe('bottom');
  });

  it('trata fluxos de retorno (loopback) com desvio superior limpo sem cortar nós', () => {
    // Retorno da tarefa da direita para a tarefa 1 (para trás)
    const loopbackEdge: ProcessMappingEdge = {
      id: 'e-loopback',
      source: 'task-right',
      target: 'task-1',
      label: 'Reanálise',
    };
    const anchors = determineAutoAnchors(nodeTaskRight, nodeTask1, loopbackEdge);
    expect(anchors.sourceAnchor).toBe('top');
    expect(anchors.targetAnchor).toBe('top');

    const result = calculateEdgePath(nodeTaskRight, nodeTask1, loopbackEdge);
    expect(result.points.length).toBe(4);
    // Deve contornar por cima da coordenada Y do topo dos nós
    expect(result.points[1].y).toBeLessThan(nodeTask1.position.y);
    expect(result.controlPoints.length).toBeGreaterThan(0);
  });

  it('gera caminho SVG com cantos arredondados suaves', () => {
    const points = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 200 },
    ];
    const path = generateRoundedSteppedPath(points, 8);
    expect(path).toContain('M 100 100');
    expect(path).toContain('Q'); // Curva suave no cotovelo
    expect(path).toContain('300 200');
  });

  it('respeita waypoints manuais arrastados pelo usuário', () => {
    const customEdge: ProcessMappingEdge = {
      id: 'e-custom',
      source: 'task-1',
      target: 'task-right',
      waypoints: [{ x: 350, y: 100 }],
    };
    const result = calculateEdgePath(nodeTask1, nodeTaskRight, customEdge);
    expect(result.controlPoints[0].x).toBe(350);
  });
});
