import { render, screen, waitFor } from '@testing-library/react';

import RichTextEditor from '@/components/Editor/RichTextEditor';
import { PENDING_FIELD_HIGHLIGHT_CLASS } from '@/lib/pendingFieldHighlight';

describe('RichTextEditor', () => {
  it('destaca marcadores de campo pendente quando habilitado', async () => {
    render(
      <RichTextEditor
        content="<p>Revise [CAMPO PENDENTE: Nome da Unidade Demandante, ex: IFRN Campus Currais Novos].</p>"
        onChange={vi.fn()}
        highlightPendingFields
      />,
    );

    expect(await screen.findByText(/CAMPO PENDENTE/i)).toBeInTheDocument();

    await waitFor(() => {
      const marker = document.querySelector(`.${PENDING_FIELD_HIGHLIGHT_CLASS}`);
      expect(marker).toBeInTheDocument();
      expect(marker).toHaveTextContent('CAMPO PENDENTE');
      expect(marker).toHaveAttribute('style', expect.stringContaining('background-color'));
    });
  });

  it('nao destaca marcadores de campo pendente quando desabilitado', async () => {
    render(
      <RichTextEditor
        content="<p>Revise [CAMPO PENDENTE: estimativa de valor].</p>"
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(/CAMPO PENDENTE/i)).toBeInTheDocument();
    expect(document.querySelector(`.${PENDING_FIELD_HIGHLIGHT_CLASS}`)).not.toBeInTheDocument();
  });
});
