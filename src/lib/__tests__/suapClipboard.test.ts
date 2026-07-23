import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { buildDespachoLiquidacaoHtml, type ResolvedDocumentContext } from '@/lib/documentGeneration';
import { buildSuapClipboardHtml, copySuapDocumentToClipboard, htmlToPlainText } from '@/lib/suapClipboard';

class MockClipboardItem {
  items: Record<string, Blob>;

  constructor(items: Record<string, Blob>) {
    this.items = items;
  }
}

function readBlobText(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

const baseContext: ResolvedDocumentContext = {
  documentType: 'despacho-liquidacao',
  candidateId: 'ctx-suap-1',
  title: 'Despacho teste',
  subtitle: 'Teste',
  processo: '23035.000123/2026-11',
  favorecido: 'Empresa Teste Ltda',
  documentoFavorecido: '12345678000190',
  tipoPessoa: 'PJ',
  contrato: '12/2026',
  empenho: '2026NE000123',
  valor: 7096.78,
  objeto: 'servicos comuns continuos de fornecimento de energia eletrica via ambiente de contratacao livre',
  fields: [],
  missingRequiredFields: [],
  warnings: [],
  matchedFrom: ['Processos'],
};

describe('suapClipboard', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: MockClipboardItem,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normaliza despacho para paragrafos com estilo compativel com o Tiny do SUAP', () => {
    const html = buildDespachoLiquidacaoHtml(baseContext);
    const clipboardHtml = buildSuapClipboardHtml(html);

    expect(clipboardHtml).toContain('<p style="font-family:');
    expect(clipboardHtml).toContain('Times New Roman');
    expect(clipboardHtml).toContain('font-size: 12pt');
    expect(clipboardHtml).toContain('line-height: 1.5');
    expect(clipboardHtml).toContain('text-align: justify');
    expect(clipboardHtml).toContain('text-indent: 2.5cm');
    expect(clipboardHtml).toContain('<i>Campus</i>');
    expect(clipboardHtml).toContain('<b>2026NE000123</b>');
    expect(clipboardHtml).toContain('<b>EMPRESA TESTE LTDA</b>');
  });

  it('preserva tabelas simples de CDO com bordas e alinhamento de valores', () => {
    const html = `
      <div style="font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: black; line-height: 1.4;">
        <div><b>Unidade Administrativa:</b> DG/CN</div>
        <p style="text-align: justify; line-height: 1.6; margin-bottom: 25px;">Certificamos a disponibilidade orcamentaria.</p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
          <thead>
            <tr style="background-color: #f2f2f2; text-align: left;">
              <th style="padding: 10px; border: 1px solid #000; font-size: 10pt;">Natureza de despesa</th>
              <th style="padding: 10px; border: 1px solid #000; text-align: right; font-size: 10pt;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border: 1px solid #000;">339039 - SERVICOS</td>
              <td style="padding: 10px; border: 1px solid #000; text-align: right;">R$ 7.096,78</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const clipboardHtml = buildSuapClipboardHtml(html);

    expect(clipboardHtml).toContain('<table');
    expect(clipboardHtml).toContain('border-collapse: collapse');
    expect(clipboardHtml).toContain('border: 1px solid #000');
    expect(clipboardHtml).toContain('font-size: 11pt');
    expect(clipboardHtml).toContain('font-size: 10pt');
    expect(clipboardHtml).toContain('text-align: right');
    expect(clipboardHtml).toContain('R$ 7.096,78');
  });

  it('copia text/html e text/plain no clipboard rico', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });

    const result = await copySuapDocumentToClipboard('<div><p><b>Assunto:</b> Teste</p></div>');

    expect(result).toBe('html');
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();

    const clipboardItem = write.mock.calls[0][0][0] as MockClipboardItem;
    expect(Object.keys(clipboardItem.items)).toEqual(['text/html', 'text/plain']);
    await expect(readBlobText(clipboardItem.items['text/html'])).resolves.toContain('<p style="font-family:');
    await expect(readBlobText(clipboardItem.items['text/plain'])).resolves.toBe('Assunto: Teste');
  });

  it('usa texto simples quando a escrita rica falha', async () => {
    const write = vi.fn().mockRejectedValue(new Error('rich clipboard blocked'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    });

    const result = await copySuapDocumentToClipboard('<div><p>Texto <b>forte</b></p></div>');

    expect(result).toBe('plain');
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('Texto forte');
  });

  it('gera texto simples legivel a partir do HTML', () => {
    expect(htmlToPlainText('<div><p>Linha 1</p><p>Linha <b>2</b></p></div>')).toBe('Linha 1\nLinha 2');
  });
});
