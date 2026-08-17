import { describe, expect, it } from 'vitest';

import { enforceComprasnetEtpFormat } from '@/lib/comprasnetEtpFormatting';

describe('formatação configurável da minuta do ETP', () => {
  it('entrega exatamente a quantidade de parágrafos configurada', () => {
    const html = enforceComprasnetEtpFormat(
      '<p>Primeiro fato confirmado.</p><p>Segundo fato confirmado.</p>',
      { format: 'corrido', paragraphCount: 4, itemCount: 5 },
    );

    expect(html.match(/<p>/g)).toHaveLength(4);
    expect(html).toContain('Primeiro');
    expect(html).toContain('fato confirmado.');
    expect(html).toContain('Segundo');
  });

  it('entrega exatamente a quantidade de itens configurada no formato de tópicos', () => {
    const html = enforceComprasnetEtpFormat(
      '<p>Alternativa técnica.</p><p>Alternativa econômica.</p>',
      { format: 'topicos', paragraphCount: 3, itemCount: 4 },
    );

    expect(html.match(/<li>/g)).toHaveLength(4);
    expect(html).toContain('<ul>');
  });
});
