import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PROCESS_MAPPING } from '@/data/defaultProcessMapping';
import { ProcessMappingDetailDrawer } from '../ProcessMappingDetailDrawer';

const node = {
  ...DEFAULT_PROCESS_MAPPING.nodes[0],
  systemName: 'SUAP',
  systemUrl: 'https://suap.ifrn.edu.br/',
};

const renderDrawer = (onUpdateNode = vi.fn()) =>
  render(
    <ProcessMappingDetailDrawer
      node={node}
      lanes={DEFAULT_PROCESS_MAPPING.lanes}
      isOpen
      processTitle="Processo"
      onClose={vi.fn()}
      onUpdateNode={onUpdateNode}
      onDeleteNode={vi.fn()}
    />,
  );

describe('ProcessMappingDetailDrawer', () => {
  it('abre em modo de leitura exibindo o que foi preenchido, sem campos de edição', () => {
    renderDrawer();

    expect(screen.getByTestId('drawer-view-procedure')).toBeInTheDocument();
    expect(screen.queryByText('Código')).toBeNull();
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Tipo de fluxo')).toBeNull();
    expect(screen.queryByText(/Prazo de referência/)).toBeNull();
    fireEvent.click(screen.getByText(/Links & Sistemas/));
    expect(screen.getByTestId('drawer-view-links')).toBeInTheDocument();
    expect(screen.getByText('https://suap.ifrn.edu.br/')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Nome do sistema/i)).toBeNull();
    expect(screen.queryByText('Excluir Etapa')).toBeNull();
  });

  it('mostra o procedimento em leitura e libera os campos ao clicar em Editar', () => {
    const onUpdateNode = vi.fn();
    renderDrawer(onUpdateNode);

    fireEvent.click(screen.getByText('Procedimento'));
    expect(screen.getByTestId('drawer-view-procedure')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Descreva o passo a passo/i)).toBeNull();

    fireEvent.click(screen.getByTestId('drawer-toggle-edit'));
    fireEvent.change(screen.getByPlaceholderText(/Descreva o passo a passo/i), { target: { value: 'novo texto' } });

    expect(onUpdateNode).toHaveBeenCalledWith(expect.objectContaining({ description: 'novo texto' }));

    fireEvent.click(screen.getByTestId('drawer-toggle-edit'));
    expect(screen.getByTestId('drawer-view-procedure')).toBeInTheDocument();
  });
  it('permite adicionar item ao checklist direto na leitura da aba Procedimento', () => {
    const onUpdateNode = vi.fn();
    renderDrawer(onUpdateNode);

    fireEvent.change(screen.getByLabelText('Novo item do checklist'), { target: { value: 'Conferir atesto' } });
    fireEvent.submit(screen.getByTestId('drawer-view-checklist-add'));

    const updated = onUpdateNode.mock.calls[0][0];
    expect(updated.checklist.at(-1)).toMatchObject({ text: 'Conferir atesto', done: false });
  });

  it('permite vários sistemas por etapa e mantém o primeiro espelhado em systemName/systemUrl', () => {
    const onUpdateNode = vi.fn();
    const { rerender } = renderDrawer(onUpdateNode);

    fireEvent.click(screen.getByText(/Links & Sistemas/));
    fireEvent.click(screen.getByTestId('drawer-toggle-edit'));
    expect(screen.getAllByTestId('drawer-edit-system-item')).toHaveLength(1);

    fireEvent.click(screen.getByText('+ SIAFI'));
    const withTwo = onUpdateNode.mock.calls.at(-1)![0];
    expect(withTwo.systems).toHaveLength(2);
    expect(withTwo.systems[0].name).toBe('SUAP');
    expect(withTwo.systems[1].name).toBe('SIAFI');
    expect(withTwo.systemName).toBe('SUAP');

    rerender(
      <ProcessMappingDetailDrawer
        node={withTwo}
        lanes={DEFAULT_PROCESS_MAPPING.lanes}
        isOpen
        processTitle="Processo"
        onClose={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Excluir sistema 1'));
    const afterDelete = onUpdateNode.mock.calls.at(-1)![0];
    expect(afterDelete.systems).toHaveLength(1);
    expect(afterDelete.systemName).toBe('SIAFI');
  });

  it('permite várias automações por etapa: adiciona, edita a ação e mantém as anteriores', () => {
    const onUpdateNode = vi.fn();
    const legacy = {
      ...node,
      automation: { enabled: true, title: 'Automação gravada', action: 'advance_step' as const, autoAdvanceStep: true },
    };
    const { rerender } = render(
      <ProcessMappingDetailDrawer
        node={legacy}
        lanes={DEFAULT_PROCESS_MAPPING.lanes}
        isOpen
        processTitle="Processo"
        onClose={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/Automações/));
    fireEvent.click(screen.getByTestId('drawer-toggle-edit'));
    expect(screen.getAllByTestId('drawer-automation-card')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('add-automation-btn'));
    const withTwo = onUpdateNode.mock.calls.at(-1)![0];
    expect(withTwo.automations).toHaveLength(2);
    expect(withTwo.automations[0].title).toBe('Automação gravada');
    expect(withTwo.automation).toBeUndefined();

    rerender(
      <ProcessMappingDetailDrawer
        node={withTwo}
        lanes={DEFAULT_PROCESS_MAPPING.lanes}
        isOpen
        processTitle="Processo"
        onClose={vi.fn()}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('drawer-automation-card')).toHaveLength(2);

    fireEvent.click(screen.getByRole('radio', { name: /Abrir link/ }));
    const edited = onUpdateNode.mock.calls.at(-1)![0];
    expect(edited.automations[1].action).toBe('open_url');
    expect(edited.automations[1].targetUrl).toContain('siafi');
    expect(edited.automations[0].action).toBe('advance_step');
  });

  it('exibe em leitura a automação e o checklist já gravados na etapa', () => {
    render(
      <ProcessMappingDetailDrawer
        node={{
          ...node,
          checklist: [{ id: 'c1', text: 'Item gravado', done: false, required: true }],
          automation: { enabled: true, title: 'Automação gravada', action: 'advance_step', autoAdvanceStep: true },
        }}
        lanes={DEFAULT_PROCESS_MAPPING.lanes}
        isOpen
        processTitle="Processo"
        onClose={vi.fn()}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Checklist/ })).toBeNull();
    expect(screen.getByText('Item gravado')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Automações/));
    expect(screen.getByText('Automação gravada')).toBeInTheDocument();
  });
});
