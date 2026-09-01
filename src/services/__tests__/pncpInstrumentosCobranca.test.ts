import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buscarInstrumentosCobrancaPncp,
  formatChaveNfe,
  buildNfePortalUrl,
} from '@/services/pncpInstrumentosCobranca';

describe('pncpInstrumentosCobranca service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formata chaves de acesso da NF-e em blocos de 4 dígitos', () => {
    const rawKey = '24260755806684000105550010000008641253540068';
    expect(formatChaveNfe(rawKey)).toBe(
      '2426 0755 8066 8400 0105 5500 1000 0008 6412 5354 0068',
    );
    expect(formatChaveNfe('')).toBe('');
    expect(formatChaveNfe(null)).toBe('');
  });

  it('monta a URL oficial de consulta pública no portal da SEFAZ', () => {
    const rawKey = '24260755806684000105550010000008641253540068';
    const url = buildNfePortalUrl(rawKey);
    expect(url).toContain('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx');
    expect(url).toContain('24260755806684000105550010000008641253540068');
  });

  it('faz parse correto do payload retornado pelo PNCP com jsonResponseNFe', async () => {
    const mockApiResponse = [
      {
        cnpj: '10877412000168',
        ano: 2026,
        sequencialContrato: 322,
        sequencialInstrumentoCobranca: 1,
        tipoInstrumentoCobranca: {
          id: 1,
          nome: 'Nota Fiscal Eletrônica (NF-e)',
        },
        numeroInstrumentoCobranca: '864',
        dataEmissaoDocumento: '2026-07-23',
        chaveNFe: '24260755806684000105550010000008641253540068',
        dataConsultaNFe: '2026-08-11T10:21:50',
        statusResponseNFe: '200',
        jsonResponseNFe: JSON.stringify({
          notaFiscalDTO: {
            id: 249831469,
            numero: 864,
            serie: 1,
            chaveNotaFiscal: '24260755806684000105550010000008641253540068',
            valorNotaFiscal: '1.318,11',
            nomeFornecedor: 'ZONA OESTE COMERCIO LTDA',
            cnpjFornecedor: '55.806.684/0001-05',
            municipioFornecedor: 'NATAL',
            tipoEventoMaisRecente: 'Autorização de Uso',
            dataTipoEventoMaisRecente: '23/07/2026 11:33:36',
          },
          itensNotaFiscal: [
            {
              numeroProduto: '1',
              descricaoProdutoServico: 'GLP EM CILINDRO P45',
              codigoNcmSh: '27111910',
              ncmSh: 'Gás liquefeito de petróleo',
              cfop: '5656',
              quantidade: '3,00',
              unidade: 'kg',
              valorUnitario: '439,37',
              valor: '1.318,11',
            },
          ],
          eventosNotaFiscal: [],
        }),
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as Response);

    const result = await buscarInstrumentosCobrancaPncp({
      cnpj: '10877412000168',
      ano: 2026,
      sequencial: '322',
    });

    expect(result.totalNfe).toBe(1);
    expect(result.valorTotalFaturado).toBe(1318.11);
    expect(result.instrumentos[0].numeroInstrumentoCobranca).toBe('864');
    expect(result.instrumentos[0].notaFiscal?.nomeFornecedor).toBe('ZONA OESTE COMERCIO LTDA');
    expect(result.instrumentos[0].itens).toHaveLength(1);
    expect(result.instrumentos[0].itens[0].descricaoProdutoServico).toBe('GLP EM CILINDRO P45');
  });
});
