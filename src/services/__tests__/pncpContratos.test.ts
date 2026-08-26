import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveContratoPncp,
  buildPncpContratoWebUrl,
  buildPncpContratoArquivosApiUrl,
  buscarDocumentosContratoPncp,
  clearPncpContratosCache,
} from '@/services/pncpContratos';
import { IFRN_CNPJ } from '@/lib/licitacoesPncp';

describe('pncpContratos', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPncpContratosCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('resolveContratoPncp', () => {
    it('deve extrair a referência direta a partir do numeroControlePncpContrato no raw_data', async () => {
      const ref = await resolveContratoPncp({
        numero: '00028/2023',
        raw_data: {
          numeroControlePncpContrato: '10877412000168-2-000209/2023',
        },
      });

      expect(ref).toEqual({
        cnpj: '10877412000168',
        sequencial: '209',
        ano: 2023,
        numeroControlePNCP: '10877412000168-2-000209/2023',
        hasPncpRecord: true,
      });
    });

    it('deve resolver dinamicamente o sequencialContrato correto consultando a API do PNCP por UASG e número', async () => {
      const mockConsultaData = {
        totalRegistros: 1,
        data: [
          {
            anoContrato: 2026,
            sequencialContrato: 293,
            numeroControlePNCP: '10877412000168-2-000293/2026',
            numeroContratoEmpenho: '00174',
            processo: '23035.000100/2026-00',
            objetoContrato: 'SERVIÇOS DE LIMPEZA CURRAIS NOVOS',
            nomeRazaoSocialFornecedor: 'LG. ADMINISTRADORA DE SERVICOS',
            orgaoEntidade: { cnpj: IFRN_CNPJ },
            unidadeOrgao: { codigoUnidade: '158366', nomeUnidade: 'IFRN CURRAIS NOVOS' },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockConsultaData,
      });

      const ref = await resolveContratoPncp({
        numero: '00174/2026',
        unidade_codigo: '158366',
      });

      expect(ref).toEqual({
        cnpj: IFRN_CNPJ,
        ano: 2026,
        sequencial: '293',
        numeroControlePNCP: '10877412000168-2-000293/2026',
        numeroContratoEmpenho: '00174',
        objeto: 'SERVIÇOS DE LIMPEZA CURRAIS NOVOS',
        fornecedorNome: 'LG. ADMINISTRADORA DE SERVICOS',
        unidadeCodigo: '158366',
        unidadeNome: 'IFRN CURRAIS NOVOS',
        hasPncpRecord: true,
      });
    });

    it('deve retornar null quando o contrato não for encontrado no PNCP', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 204,
      });

      const ref = await resolveContratoPncp({
        numero: '00999/2026',
        unidade_codigo: '158366',
      });

      expect(ref).toBeNull();
    });

    it('deve retornar null para entrada nula ou indefinida', async () => {
      expect(await resolveContratoPncp(null)).toBeNull();
      expect(await resolveContratoPncp(undefined)).toBeNull();
    });
  });

  describe('buildPncpContratoWebUrl', () => {
    it('deve montar a URL web correta do portal PNCP', () => {
      const url = buildPncpContratoWebUrl({
        cnpj: '10877412000168',
        ano: 2026,
        sequencial: '293',
      });

      expect(url).toBe('https://pncp.gov.br/app/contratos/10877412000168/2026/293');
    });
  });

  describe('buildPncpContratoArquivosApiUrl', () => {
    it('deve montar a URL de API correta para consulta de arquivos com o sequencialContrato do PNCP', () => {
      const url = buildPncpContratoArquivosApiUrl({
        cnpj: '10877412000168',
        ano: 2026,
        sequencial: '293',
      });

      expect(url).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/10877412000168/contratos/2026/293/arquivos');
    });
  });

  describe('buscarDocumentosContratoPncp', () => {
    it('deve resolver o contrato e retornar a lista de arquivos quando houver PDFs no PNCP', async () => {
      const mockConsultaData = {
        totalRegistros: 1,
        data: [
          {
            anoContrato: 2026,
            sequencialContrato: 293,
            numeroControlePNCP: '10877412000168-2-000293/2026',
            numeroContratoEmpenho: '00174',
            orgaoEntidade: { cnpj: IFRN_CNPJ },
          },
        ],
      };

      const mockArquivos = [
        {
          sequencialDocumento: 1,
          titulo: 'Contrato 00174/2026',
          tipoDocumentoNome: 'Contrato',
          url: 'https://pncp.gov.br/pncp-api/v1/orgaos/10877412000168/contratos/2026/293/arquivos/1',
          dataPublicacaoPncp: '2026-07-02T15:45:49',
        },
      ];

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockConsultaData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockArquivos,
        });

      const result = await buscarDocumentosContratoPncp({
        numero: '00174/2026',
        unidade_codigo: '158366',
      });

      expect(result.hasPncpRecord).toBe(true);
      expect(result.ref?.sequencial).toBe('293');
      expect(result.documentos).toHaveLength(1);
      expect(result.documentos[0].titulo).toBe('Contrato 00174/2026');
      expect(result.documentos[0].url).toBe('https://pncp.gov.br/pncp-api/v1/orgaos/10877412000168/contratos/2026/293/arquivos/1');
    });

    it('deve identificar registro oficial no PNCP com status 204 (sem arquivos enviados)', async () => {
      const mockConsultaData = {
        totalRegistros: 1,
        data: [
          {
            anoContrato: 2024,
            sequencialContrato: 209,
            numeroControlePNCP: '10877412000168-2-000209/2024',
            numeroContratoEmpenho: '00261',
            orgaoEntidade: { cnpj: IFRN_CNPJ },
          },
        ],
      };

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockConsultaData,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        });

      const result = await buscarDocumentosContratoPncp({
        numero: '00261/2024',
        unidade_codigo: '158366',
      });

      expect(result.hasPncpRecord).toBe(true);
      expect(result.ref?.sequencial).toBe('209');
      expect(result.ref?.numeroControlePNCP).toBe('10877412000168-2-000209/2024');
      expect(result.documentos).toEqual([]);
    });

    it('deve retornar hasPncpRecord=false quando o contrato não existir no PNCP', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await buscarDocumentosContratoPncp({
        numero: '00001/2010',
        unidade_codigo: '158366',
      });

      expect(result.hasPncpRecord).toBe(false);
      expect(result.documentos).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('deve retornar lista vazia e mensagem amigável quando target é nulo', async () => {
      const result = await buscarDocumentosContratoPncp(null);
      expect(result.documentos).toEqual([]);
      expect(result.hasPncpRecord).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
