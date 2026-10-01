import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
import { ProcessMappingCanvas } from '../ProcessMappingCanvas';

describe('ProcessMappingCanvas - scroll containment', () => {
  const defaultProps = {
    mapping: DEFAULT_PROCESS_MAPPING,
    selectedNode: null,
    onSelectNode: vi.fn(),
    onUpdateMapping: vi.fn(),
  };

  it('inicia com o topo do workspace alinhado em y = 0px sem espaço em branco', () => {
    render(<ProcessMappingCanvas {...defaultProps} />);

    const workspace = screen.getByTestId('process-mapping-workspace');
    expect(workspace).toBeInTheDocument();
    expect(workspace.style.transform).toContain('translate(0px, 0px)');
  });

  it('impede que o pan.y se torne positivo ao dar scroll para cima no canvas', () => {
    render(<ProcessMappingCanvas {...defaultProps} />);

    const container = screen.getByTestId('process-mapping-canvas-container');
    const workspace = screen.getByTestId('process-mapping-workspace');

    // Ao rolar o scroll para cima (deltaY < 0), o workspace não pode descer (y <= 0)
    fireEvent.wheel(container, { deltaY: -120 });
    expect(workspace.style.transform).toContain('translate(0px, 0px)');

    fireEvent.wheel(container, { deltaY: -300 });
    expect(workspace.style.transform).toContain('translate(0px, 0px)');
  });

  it('impede que o pan.y se torne positivo ao arrastar o mouse para baixo no fundo do canvas', () => {
    render(<ProcessMappingCanvas {...defaultProps} />);

    const container = screen.getByTestId('process-mapping-canvas-container');
    const workspace = screen.getByTestId('process-mapping-workspace');

    // Clica no container e arrasta para baixo (clientY aumenta)
    fireEvent.mouseDown(container, { clientX: 200, clientY: 200 });
    fireEvent.mouseMove(container, { clientX: 200, clientY: 450, buttons: 1 });
    fireEvent.mouseUp(container);

    // O transform Y deve continuar travado em 0px
    expect(workspace.style.transform).toContain('translate(0px, 0px)');
  });

  it('permite scroll para baixo (y negativo) e trava no topo (y = 0px) ao retornar com scroll para cima', () => {
    render(<ProcessMappingCanvas {...defaultProps} />);

    const container = screen.getByTestId('process-mapping-canvas-container');
    const workspace = screen.getByTestId('process-mapping-workspace');

    // Scroll para baixo: deltaY > 0 desloca o workspace para cima (y negativo)
    fireEvent.wheel(container, { deltaY: 200 });
    expect(workspace.style.transform).toMatch(/translate\(0px, -[1-9]\d*px\)/);

    // Scroll para cima com força maior para retornar ao topo: deve travar exatamente em 0px
    fireEvent.wheel(container, { deltaY: -600 });
    expect(workspace.style.transform).toContain('translate(0px, 0px)');
  });

  it('renderiza a primeira raia com top 0px', () => {
    render(<ProcessMappingCanvas {...defaultProps} />);

    // A primeira raia (ordem 0) deve estar com top: 0px
    const firstLaneElement = screen.getByTestId('process-mapping-lane-lane-origin');
    expect(firstLaneElement).toBeInTheDocument();
    expect(firstLaneElement.getAttribute('style')).toContain('top: 0px');
  });

  describe('menu de inserção de tipo de nó ao clicar no "+" ao lado dos itens', () => {
    it('abre o menu com opções Tarefa, Decisão, Fim e Conectar ao clicar no "+" de uma etapa', () => {
      render(<ProcessMappingCanvas {...defaultProps} />);

      // Clica no botão "+" do step-1
      const addBtn = screen.getByTestId('node-add-button-step-1');
      fireEvent.click(addBtn);

      const menu = screen.getByTestId('add-node-menu');
      expect(menu).toBeInTheDocument();
      expect(screen.getByTestId('add-node-task-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-node-gateway-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-node-end-btn')).toBeInTheDocument();
      expect(screen.getByTestId('add-node-connect-btn')).toBeInTheDocument();
    });

    it('cria uma nova Tarefa conectada ao nó de origem ao clicar em Tarefa no menu', () => {
      const onUpdateMapping = vi.fn();
      const onSelectNode = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} onSelectNode={onSelectNode} />);

      fireEvent.click(screen.getByTestId('node-add-button-step-1'));
      fireEvent.click(screen.getByTestId('add-node-task-btn'));

      expect(onUpdateMapping).toHaveBeenCalledTimes(1);
      const updatedMapping = onUpdateMapping.mock.calls[0][0];

      // O novo nó deve ser do tipo task
      const newNode = updatedMapping.nodes[updatedMapping.nodes.length - 1];
      expect(newNode.type).toBe('task');
      expect(newNode.title).toBe('Nova Atividade');
      expect(newNode.laneId).toBe('lane-origin');

      // Uma nova aresta deve conectar step-1 ao novo nó
      const newEdge = updatedMapping.edges[updatedMapping.edges.length - 1];
      expect(newEdge.source).toBe('step-1');
      expect(newEdge.target).toBe(newNode.id);

      // O novo nó deve ter sido selecionado
      expect(onSelectNode).toHaveBeenCalledWith(newNode);

      // O menu deve fechar
      expect(screen.queryByTestId('add-node-menu')).toBeNull();
    });

    it('cria uma nova Decisão conectada ao nó de origem ao clicar em Decisão no menu', () => {
      const onUpdateMapping = vi.fn();
      const onSelectNode = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} onSelectNode={onSelectNode} />);

      fireEvent.click(screen.getByTestId('node-add-button-step-1'));
      fireEvent.click(screen.getByTestId('add-node-gateway-btn'));

      expect(onUpdateMapping).toHaveBeenCalledTimes(1);
      const updatedMapping = onUpdateMapping.mock.calls[0][0];
      const newNode = updatedMapping.nodes[updatedMapping.nodes.length - 1];
      expect(newNode.type).toBe('gateway');
      expect(newNode.title).toBe('Critério de Decisão?');

      const newEdge = updatedMapping.edges[updatedMapping.edges.length - 1];
      expect(newEdge.source).toBe('step-1');
      expect(newEdge.target).toBe(newNode.id);
    });

    it('fecha o menu ao clicar no fundo do canvas', () => {
      render(<ProcessMappingCanvas {...defaultProps} />);

      fireEvent.click(screen.getByTestId('node-add-button-step-1'));
      expect(screen.getByTestId('add-node-menu')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('process-mapping-canvas-container'));
      expect(screen.queryByTestId('add-node-menu')).toBeNull();
    });
  });
  describe('reconexão de linhas', () => {
    it('altera o destino da conexão selecionada pela barra de conexão', () => {
      const onUpdateMapping = vi.fn();
      const { container } = render(
        <ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />
      );
      const edge = DEFAULT_PROCESS_MAPPING.edges[0];
      const newTarget = DEFAULT_PROCESS_MAPPING.nodes.find(
        (n) => n.id !== edge.source && n.id !== edge.target
      )!;

      fireEvent.click(container.querySelector('g.connector-group')!);
      fireEvent.change(screen.getByLabelText('Etapa de destino da conexão'), {
        target: { value: newTarget.id },
      });

      const updated = onUpdateMapping.mock.calls[0][0];
      expect(updated.edges[0].target).toBe(newTarget.id);
      expect(updated.edges[0].source).toBe(edge.source);
    });
  });
  describe('edição de raias', () => {
    it('renomeia a raia pelo editor aberto ao clicar no rótulo', () => {
      const onUpdateMapping = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />);

      fireEvent.click(screen.getByTestId('lane-edit-btn-lane-origin'));
      fireEvent.change(screen.getByLabelText('Nome da raia'), { target: { value: 'Raia Renomeada' } });

      const updated = onUpdateMapping.mock.calls[0][0];
      expect(updated.lanes.find((l: { id: string }) => l.id === 'lane-origin').name).toBe('Raia Renomeada');
    });

    it('move a raia para baixo e reordena', () => {
      const onUpdateMapping = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />);

      fireEvent.click(screen.getByTestId('lane-edit-btn-lane-origin'));
      fireEvent.click(screen.getByLabelText('Mover raia para baixo'));

      const updated = onUpdateMapping.mock.calls[0][0];
      expect(updated.lanes[1].id).toBe('lane-origin');
      expect(updated.lanes.map((l: { order: number }) => l.order)).toEqual(
        updated.lanes.map((_: unknown, index: number) => index)
      );
    });

    it('adiciona uma nova raia', () => {
      const onUpdateMapping = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />);

      fireEvent.click(screen.getByTestId('add-lane-btn'));

      const updated = onUpdateMapping.mock.calls[0][0];
      expect(updated.lanes).toHaveLength(DEFAULT_PROCESS_MAPPING.lanes.length + 1);
    });

    it('exclui a raia movendo suas etapas para outra raia', () => {
      const onUpdateMapping = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />);

      fireEvent.click(screen.getByTestId('lane-edit-btn-lane-origin'));
      fireEvent.click(screen.getByLabelText('Excluir raia'));

      const updated = onUpdateMapping.mock.calls[0][0];
      expect(updated.lanes.some((l: { id: string }) => l.id === 'lane-origin')).toBe(false);
      expect(updated.nodes.some((n: { laneId?: string }) => n.laneId === 'lane-origin')).toBe(false);
    });
  });

  describe('navegação horizontal', () => {
    it('arrasta o canvas para a direita ao segurar o mouse sobre uma raia', () => {
      render(<ProcessMappingCanvas {...defaultProps} />);
      const container = screen.getByTestId('process-mapping-canvas-container');
      const workspace = screen.getByTestId('process-mapping-workspace');
      const lane = screen.getByTestId('process-mapping-lane-lane-origin');

      fireEvent.mouseDown(lane, { clientX: 600, clientY: 100 });
      fireEvent.mouseMove(container, { clientX: 300, clientY: 100, buttons: 1 });
      fireEvent.mouseUp(container);

      expect(workspace.style.transform).toMatch(/translate\(-[1-9]\d*px/);
    });

    it('rola horizontalmente com Shift + roda do mouse', () => {
      render(<ProcessMappingCanvas {...defaultProps} />);
      const workspace = screen.getByTestId('process-mapping-workspace');

      fireEvent.wheel(screen.getByTestId('process-mapping-canvas-container'), { deltaY: 200, shiftKey: true });
      expect(workspace.style.transform).toMatch(/translate\(-[1-9]\d*px, 0px\)/);
    });
  });
  describe('nova conexão', () => {
    const Stateful: React.FC<{ onChange: (m: typeof DEFAULT_PROCESS_MAPPING) => void }> = ({ onChange }) => {
      const [mapping, setMapping] = React.useState(DEFAULT_PROCESS_MAPPING);
      return (
        <ProcessMappingCanvas
          {...defaultProps}
          mapping={mapping}
          onUpdateMapping={(next) => {
            setMapping(next as typeof DEFAULT_PROCESS_MAPPING);
            onChange(next as typeof DEFAULT_PROCESS_MAPPING);
          }}
        />
      );
    };

    const connectStep1ToStep3 = () => {
      fireEvent.click(screen.getByTestId('node-add-button-step-1'));
      fireEvent.click(screen.getByTestId('add-node-connect-btn'));
      fireEvent.mouseDown(document.getElementById('node-step-3')!);
    };

    it('conecta a etapa de origem a uma etapa existente sem usar window.prompt', () => {
      const onChange = vi.fn();
      const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => {
        throw new Error('prompt() não é suportado');
      });
      render(<Stateful onChange={onChange} />);

      connectStep1ToStep3();

      const updated = onChange.mock.calls.at(-1)![0];
      expect(updated.edges.at(-1)).toMatchObject({ source: 'step-1', target: 'step-3' });
      expect(promptSpy).not.toHaveBeenCalled();
      // A nova conexão fica selecionada com o campo de rótulo aberto
      expect(screen.getByLabelText('Rótulo da conexão')).toBeInTheDocument();
    });

    it('grava o rótulo digitado na barra da conexão', () => {
      const onChange = vi.fn();
      render(<Stateful onChange={onChange} />);

      connectStep1ToStep3();
      fireEvent.change(screen.getByLabelText('Rótulo da conexão'), { target: { value: 'Sim' } });
      fireEvent.click(screen.getByText('OK'));

      const updated = onChange.mock.calls.at(-1)![0];
      expect(updated.edges.at(-1)).toMatchObject({ source: 'step-1', target: 'step-3', label: 'Sim' });
    });
  });

  describe('arraste de etapas', () => {
    it('encerra o arraste ao soltar o botão fora do canvas', () => {
      const onUpdateMapping = vi.fn();
      render(<ProcessMappingCanvas {...defaultProps} onUpdateMapping={onUpdateMapping} />);
      const container = screen.getByTestId('process-mapping-canvas-container');

      fireEvent.mouseDown(document.getElementById('node-step-1')!, { clientX: 200, clientY: 100, buttons: 1 });
      fireEvent.mouseMove(container, { clientX: 260, clientY: 140, buttons: 1 });
      const callsWhileDragging = onUpdateMapping.mock.calls.length;
      expect(callsWhileDragging).toBeGreaterThan(0);

      // O botão é solto sobre outro elemento (fora do container)
      fireEvent.mouseUp(document.body);
      fireEvent.mouseMove(container, { clientX: 400, clientY: 300, buttons: 0 });

      expect(onUpdateMapping.mock.calls.length).toBe(callsWhileDragging);
    });
  });

});
