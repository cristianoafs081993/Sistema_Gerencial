import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PNCP_UASGS,
  IFRN_CNPJ,
  IFRN_UASG_CATALOG,
  buildComprasGovCompraKey,
  buildPncpCompraUrl,
  buildPncpItemsUrl,
  buildPncpPublicationUrl,
  mapPncpCompra,
  normalizePncpDate,
  pncpCompraMatchesItemSearch,
  splitPncpDateRange,
} from '@/lib/licitacoesPncp';

describe('licitacoesPncp helpers', () => {
  it('normaliza compra retornada pelo PNCP', () => {
    const mapped = mapPncpCompra({
      numeroControlePNCP: '10877412000168-1-000198/2025',
      anoCompra: 2025,
      sequencialCompra: 198,
      numeroCompra: '90001',
      processo: '23035001765202521',
      objetoCompra: 'Prestacao de servico de recepcao',
      modalidadeId: 6,
      modalidadeNome: 'Pregao - Eletronico',
      modoDisputaId: 1,
      modoDisputaNome: 'Aberto',
      situacaoCompraId: 1,
      situacaoCompraNome: 'Divulgada no PNCP',
      srp: false,
      valorTotalEstimado: 103582.32,
      dataPublicacaoPncp: '2026-04-22T07:05:23',
      orgaoEntidade: {
        cnpj: '10877412000168',
        razaoSocial: 'INSTITUTO FEDERAL DO RIO GRANDE DO NORTE',
      },
      unidadeOrgao: {
        codigoUnidade: '158366',
        nomeUnidade: 'CAMPUS CURRAIS NOVOS',
        ufSigla: 'RN',
      },
      amparoLegal: {
        codigo: 1,
        nome: 'Lei 14.133/2021, Art. 28, I',
      },
    });

    expect(mapped).toEqual(expect.objectContaining({
      numero_controle_pncp: '10877412000168-1-000198/2025',
      cnpj_orgao: '10877412000168',
      ano_compra: 2025,
      sequencial_compra: 198,
      numero_compra: '90001',
      modalidade_id: 6,
      uasg_codigo: '158366',
      valor_total_estimado: 103582.32,
      srp: false,
    }));
  });

  it('divide intervalos em janelas aceitas pelo PNCP', () => {
    expect(splitPncpDateRange('20250101', '20260115')).toEqual([
      { dataInicial: '20250101', dataFinal: '20251231' },
      { dataInicial: '20260101', dataFinal: '20260115' },
    ]);
  });

  it('normaliza datas e monta links operacionais', () => {
    expect(normalizePncpDate('2026-05-04')).toBe('20260504');
    expect(buildPncpCompraUrl('10877412000168', 2025, 198)).toBe(
      'https://pncp.gov.br/app/editais/10877412000168/2025/198',
    );
    expect(buildPncpCompraUrl(null, 2025, 198)).toBe(
      'https://pncp.gov.br/app/editais/10877412000168/2025/198',
    );
    expect(buildPncpCompraUrl('10.877.412/0001-68', 2025, 198)).toBe(
      'https://pncp.gov.br/app/editais/10877412000168/2025/198',
    );
    expect(buildPncpCompraUrl('10877412000168', '2025', '000198')).toBe(
      'https://pncp.gov.br/app/editais/10877412000168/2025/198',
    );
    expect(buildComprasGovCompraKey('158366', 6, '90001', 2025)).toBe('15836605900012025');
  });

  it('monta consulta institucional sem limitar UASG nem enviar tamanho de pagina rejeitado', () => {
    const institutionalUrl = buildPncpPublicationUrl({
      cnpj: IFRN_CNPJ,
      dataInicial: '20250401',
      dataFinal: '20250430',
      modalidadeId: 6,
      pagina: 1,
    });
    const campusUrl = buildPncpPublicationUrl({
      cnpj: IFRN_CNPJ,
      unidadeCodigo: '158366',
      dataInicial: '20250401',
      dataFinal: '20250430',
      modalidadeId: 6,
      pagina: 1,
    });

    expect(institutionalUrl).toContain('cnpj=10877412000168');
    expect(institutionalUrl).not.toContain('codigoUnidadeAdministrativa');
    expect(institutionalUrl).not.toContain('tamanhoPagina');
    expect(campusUrl).toContain('codigoUnidadeAdministrativa=158366');
  });

  it('monta endpoint de itens e compara termo normalizado no payload de itens', () => {
    expect(buildPncpItemsUrl({
      cnpj: IFRN_CNPJ,
      anoCompra: 2025,
      sequencialCompra: 198,
      pagina: 1,
      tamanhoPagina: 100,
    })).toBe('https://pncp.gov.br/api/pncp/v1/orgaos/10877412000168/compras/2025/198/itens?pagina=1&tamanhoPagina=100');

    expect(pncpCompraMatchesItemSearch({
      itens: [
        { numeroItem: 1, descricao: 'Serviço de manutenção predial' },
        { numeroItem: 2, descricao: 'Computador portátil' },
      ],
    }, 'manutencao')).toBe(true);
    expect(pncpCompraMatchesItemSearch({ itens: [{ descricao: 'Cadeiras' }] }, 'notebook')).toBe(false);
  });

  it('mantem catalogo interno de UASGs IFRN com CNPJ para sincronizacao', () => {
    expect(DEFAULT_PNCP_UASGS).toEqual([
      '152711',
      '152756',
      '152757',
      '154582',
      '154838',
      '154839',
      '154840',
      '158155',
      '158365',
      '158366',
      '158367',
      '158368',
      '158369',
      '158370',
      '158371',
      '158372',
      '158373',
      '158374',
      '158375',
    ]);
    expect(new Set(DEFAULT_PNCP_UASGS).size).toBe(DEFAULT_PNCP_UASGS.length);
    expect(IFRN_UASG_CATALOG.every((item) => item.cnpj === IFRN_CNPJ)).toBe(true);
    expect(IFRN_UASG_CATALOG.every((item) => item.codigoOrgao === '26435')).toBe(true);
    expect(IFRN_UASG_CATALOG.find((item) => item.codigo === '158366')?.aliases).toEqual(['Jucurutu', 'Parelhas']);
    expect(IFRN_UASG_CATALOG.find((item) => item.codigo === '158155')?.aliases).toEqual(['Lajes', 'Natal - Zona Leste (EAD)']);
  });
});
