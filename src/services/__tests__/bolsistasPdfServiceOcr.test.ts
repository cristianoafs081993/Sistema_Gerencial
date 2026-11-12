// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakePage = { text: string[]; ops: number[] };

const state = vi.hoisted(() => ({
  OPS: { paintImageXObject: 85, paintInlineImageXObject: 86, paintJpegXObject: 82, paintImageMaskXObject: 83 },
  pages: [] as FakePage[],
  recognizePage: vi.fn(),
  dispose: vi.fn(),
  createSession: vi.fn(),
}));
const { OPS } = state;

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  OPS: state.OPS,
  VerbosityLevel: { ERRORS: 0 },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: state.pages.length,
      getPage: async (n: number) => ({
        pageNumber: n,
        getTextContent: async () => ({ items: state.pages[n - 1].text.map((str) => ({ str })) }),
        getOperatorList: async () => ({ fnArray: state.pages[n - 1].ops }),
      }),
    }),
  }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.js?url', () => ({ default: 'worker.js' }));
vi.mock('../pdfOcrService', () => ({
  createPdfOcrSession: state.createSession,
}));

import { extractBolsistasFromPdfFiles } from '../bolsistasPdfService';

const fakeFile = (name: string) => ({ name, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as File;

// Pagina 1 do oficio real (camada de texto lida pelo pdfjs): 3 bolsistas, o 3o sem dados bancarios (continuam na pagina 2).
const page1Text = [
  'Ofício Nº 147/2026  Conforme projeto de Tutoria de Aprendizagem em Laboratório 3 TAL na modalidade Inclusiva, o auxílio referido por pessoa corresponde a R$ 400,00, onde o mesmo consta no planejamento de 2026 do Campus.  ' +
    'Ana Larissia Paixão de Lima (20231031120033) Curso Técnico em Manutenção e Suporte em Informática E-mail l.larissia@escolar.ifrn.edu.br CPF 128.375.504-18 Empenho 2026NE000028 Dados bancários Banco Caixa Econômica Federal Agência 3880 Conta 729602681-3  ' +
    'Fernanda Gabriella da Silva Medeiros (20231031160030) Curso Técnico em Alimentos E-mail f.gabriella@escolar.ifrn.edu.br CPF 094.043.564-09 Empenho 2026NE000028 Dados bancários Banco Nu Pagamentos S.A. (Nubank) Agência 0001 Conta 983711539-2  ' +
    'Maria Clara da Cunha Silva (20231031120019) Curso Técnico em Manutenção e Suporte em Informática E-mail cunha.clara@escolar.ifrn.edu.br CPF 715.863.064-13 Empenho 2026NE000028',
];

// Pagina 2 (imagem escaneada) lida pelo Tesseract, com o ruido real: "—" no lugar da borda da celula,
// "NF" no lugar de "NE", CPF com virgula no lugar do ponto (saida real do navegador), "Dados a" etc.
const page2Ocr = `Banco Banco do Brasil S.A.
Dados Agência 0361-1
bancários
Conta 45604-7
| Maria Fernanda da Silva Fernandes (20231031160081) |
Curso Técnico em Alimentos
E-mail fernandes.maria2(Qescolar.ifrn.edu.br
CPF 709,443.734-02
Empenho 2026NE000028
Banco PicPay
Dados a
" Agência — 0001
bancários
Conta 119009020-1
| Thalia Soares Silva (20241034010010) |
Curso Técnico em Informática
E-mail thalia.soares(Descolar.ifrn.edu.br
CPF 706.658.914-90
Empenho 2026NF000028
Banco Nu Pagamentos S.A. (Nubank)
Dados A
" Agência — 0001
bancários
Conta 82982547-4
Respeitosamente,
Documento assinado eletronicamente por:
= Fabiana Faustino da Cruz, COORDENADOR(A) - FGOOO1 - , em 19/10/2026 21:04:45.`;

describe('extractBolsistasFromPdfFiles - paginas escaneadas com OCR', () => {
  beforeEach(() => {
    state.pages = [];
    state.recognizePage.mockReset();
    state.dispose.mockReset().mockResolvedValue(undefined);
    state.createSession.mockReset().mockImplementation(() => ({
      recognizePage: state.recognizePage,
      dispose: state.dispose,
    }));
  });

  it('le os 5 bolsistas: 3 da camada de texto e 2 (mais os dados bancarios do 3o) da pagina escaneada', async () => {
    state.pages = [
      { text: page1Text, ops: [OPS.paintImageXObject] }, // logotipo: tem texto, nao vai para OCR
      { text: [], ops: [OPS.paintImageXObject] },
    ];
    state.recognizePage.mockResolvedValue(page2Ocr);

    const records = await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')]);

    expect(state.recognizePage).toHaveBeenCalledTimes(1);
    expect(records).toHaveLength(5);

    expect(records[0]).toEqual({
      nome: 'Ana Larissia Paixão de Lima',
      cpf: '128.375.504-18',
      banco: 'Caixa Econômica Federal',
      agencia: '3880',
      conta: '729602681-3',
      sourceFile: 'oficio.pdf',
      valor: 400,
    });
    expect(records[1]).toMatchObject({ cpf: '094.043.564-09', agencia: '0001', conta: '983711539-2' });
    expect(records[0].ocr).toBeUndefined();
    expect(records[1].ocr).toBeUndefined();

    // 3o: nome e CPF vem do texto, banco/agencia/conta vem da pagina escaneada.
    expect(records[2]).toMatchObject({
      nome: 'Maria Clara da Cunha Silva',
      cpf: '715.863.064-13',
      banco: 'Banco do Brasil S.A.',
      agencia: '0361-1',
      conta: '45604-7',
      ocr: true,
    });
    expect(records[3]).toMatchObject({
      nome: 'Maria Fernanda da Silva Fernandes',
      cpf: '709.443.734-02',
      banco: 'PicPay',
      agencia: '0001',
      conta: '119009020-1',
      valor: 400,
      ocr: true,
    });
    expect(records[4]).toMatchObject({
      nome: 'Thalia Soares Silva',
      cpf: '706.658.914-90',
      banco: 'Nu Pagamentos S.A. (Nubank)',
      agencia: '0001',
      conta: '82982547-4',
      ocr: true,
    });
  });

  it.each([
    ['virgula no lugar do ponto', '709,443.734-02'],
    ['espaco antes do ponto', '709.443 .734-02'],
    ['espacos no lugar dos pontos e do hifen', '709 443 734 02'],
    ['espacos em volta do hifen', '709.443.734 - 02'],
    ['O no lugar de 0', '7O9.443.734-O2'],
  ])('nao perde o aluno quando o OCR erra o separador do CPF (%s)', async (_label, garbledCpf) => {
    state.pages = [
      { text: page1Text, ops: [] },
      { text: [], ops: [OPS.paintImageXObject] },
    ];
    state.recognizePage.mockResolvedValue(page2Ocr.replace('709,443.734-02', garbledCpf));

    const records = await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')]);

    expect(records.map((r) => r.cpf)).toEqual([
      '128.375.504-18',
      '094.043.564-09',
      '715.863.064-13',
      '709.443.734-02',
      '706.658.914-90',
    ]);
  });

  describe('rede de seguranca: total de bolsas declarado no oficio', () => {
    const withDeclaredTotal = (count: string) => [
      `Solicito que autorize a despesa no valor de R$ 2.000,00 (dois mil reais), relativa à ${count} bolsas para as bolsistas abaixo relacionadas.  ${page1Text[0]}`,
    ];

    it('avisa quando foram identificados menos bolsistas do que o declarado', async () => {
      state.pages = [{ text: withDeclaredTotal('5 (cinco)'), ops: [] }];
      const onWarning = vi.fn();

      const records = await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')], { onWarning });

      expect(records).toHaveLength(3);
      expect(onWarning).toHaveBeenCalledWith({ sourceFile: 'oficio.pdf', reason: 'count_mismatch', expected: 5, found: 3 });
    });

    it('nao avisa quando todos os bolsistas declarados foram identificados', async () => {
      state.pages = [{ text: withDeclaredTotal('3 (três)'), ops: [] }];
      const onWarning = vi.fn();

      await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')], { onWarning });

      expect(onWarning).not.toHaveBeenCalled();
    });

    it('nao avisa quando o documento nao declara o total de bolsas', async () => {
      state.pages = [{ text: page1Text, ops: [] }];
      const onWarning = vi.fn();

      await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')], { onWarning });

      expect(onWarning).not.toHaveBeenCalled();
    });
  });

  it('corrige confusoes tipicas de OCR (O/l no lugar de 0/1) em agencia e conta dos registros OCR', async () => {
    state.pages = [{ text: [], ops: [OPS.paintImageXObject] }];
    state.recognizePage.mockResolvedValue(
      'Ana Souza Lima (20231031120033)\nCPF 128.375.504-18\nBanco Caixa Econômica Federal\nAgência 38O0\nConta 7296O2681-l',
    );

    const [record] = await extractBolsistasFromPdfFiles([fakeFile('scan.pdf')]);

    expect(record).toMatchObject({ cpf: '128.375.504-18', agencia: '3800', conta: '729602681-1', ocr: true });
  });

  it('informa o progresso do OCR pagina a pagina e libera o worker ao final', async () => {
    state.pages = [
      { text: [], ops: [OPS.paintImageXObject] },
      { text: page1Text, ops: [] },
      { text: [], ops: [OPS.paintJpegXObject] },
    ];
    state.recognizePage.mockResolvedValue('');
    const onOcrProgress = vi.fn();

    await extractBolsistasFromPdfFiles([fakeFile('misto.pdf')], { onOcrProgress });

    expect(onOcrProgress.mock.calls.map(([p]) => p)).toEqual([
      { sourceFile: 'misto.pdf', page: 1, done: 0, total: 2 },
      { sourceFile: 'misto.pdf', page: 3, done: 1, total: 2 },
    ]);
    expect(state.dispose).toHaveBeenCalledTimes(1);
  });

  it('avisa as paginas que o OCR nao conseguiu ler, mantem as demais e libera o worker', async () => {
    state.pages = [
      { text: page1Text, ops: [] },
      { text: [], ops: [OPS.paintImageXObject] },
    ];
    state.recognizePage.mockRejectedValue(new Error('wasm indisponivel'));
    const onWarning = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const records = await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')], { onWarning });

    expect(records).toHaveLength(3);
    expect(records.every((r) => !r.ocr)).toBe(true);
    expect(onWarning).toHaveBeenCalledWith({ sourceFile: 'oficio.pdf', imageOnlyPages: [2], reason: 'ocr_failed' });
    expect(state.dispose).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('com ocr: false nao inicia o OCR e avisa as paginas escaneadas', async () => {
    state.pages = [
      { text: page1Text, ops: [] },
      { text: [], ops: [OPS.paintImageXObject] },
    ];
    const onWarning = vi.fn();

    await extractBolsistasFromPdfFiles([fakeFile('oficio.pdf')], { ocr: false, onWarning });

    expect(state.createSession).not.toHaveBeenCalled();
    expect(onWarning).toHaveBeenCalledWith({ sourceFile: 'oficio.pdf', imageOnlyPages: [2], reason: 'ocr_disabled' });
  });

  it('nao usa OCR para pagina em branco nem para pagina com texto e imagem (logotipo)', async () => {
    state.pages = [
      { text: page1Text, ops: [OPS.paintImageXObject] },
      { text: [], ops: [] },
    ];
    const onWarning = vi.fn();

    const records = await extractBolsistasFromPdfFiles([fakeFile('folha.pdf')], { onWarning });

    expect(state.createSession).not.toHaveBeenCalled();
    expect(onWarning).not.toHaveBeenCalled();
    expect(records).toHaveLength(3);
  });
});
