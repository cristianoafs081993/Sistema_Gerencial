import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repositoryMock } = vi.hoisted(() => ({
  repositoryMock: {
    listAtas: vi.fn(),
    listItens: vi.fn(),
    listOrgaosClassificacao: vi.fn(),
    getAtaById: vi.fn(),
    listItensByAtaId: vi.fn(),
    listDocumentosByAtaId: vi.fn(),
    createSearchSession: vi.fn(),
    insertSearchResults: vi.fn(),
    logUsageEvent: vi.fn(),
    listSearchSessions: vi.fn(),
  },
}));

/*
  Mock hoisted para permitir que o módulo de serviço seja importado normalmente
  sem acessar variáveis ainda não inicializadas durante o vi.mock.
*/
vi.mock('@/repositories/atas', () => ({
  atasRepository: repositoryMock,
}));

/*
  Import após o mock para garantir que o serviço enxergue o repositório stubado.
*/
import { atasService } from '@/services/atas';

/*
  Fixtures simples para validar ranking, filtros e refinamentos.
*/
const atasFixture = [
  {
    id: 'ata-1',
    numero_ata: '12/2026',
    ano_ata: 2026,
    objeto: 'Aquisicao de notebooks para laboratorio',
    objeto_normalizado: 'aquisicao de notebooks para laboratorio',
    orgao_gerenciador: 'IFRN Reitoria',
    orgao_gerenciador_normalizado: 'ifrn reitoria',
    vigencia_inicio: '2026-01-10',
    vigencia_fim: '2026-12-31',
    status_vigencia: 'vigente',
    fonte: 'fonte_manual',
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
  },
  {
    id: 'ata-2',
    numero_ata: '15/2026',
    ano_ata: 2026,
    objeto: 'Contratacao de servicos de limpeza',
    objeto_normalizado: 'contratacao de servicos de limpeza',
    orgao_gerenciador: 'IFRN Campus Natal',
    orgao_gerenciador_normalizado: 'ifrn campus natal',
    vigencia_inicio: '2026-02-01',
    vigencia_fim: '2026-04-20',
    status_vigencia: 'a_vencer',
    fonte: 'fonte_manual',
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
  },
];

const itensFixture = [
  {
    id: 'item-1',
    ata_id: 'ata-1',
    numero_item: '1',
    descricao: 'Notebook tipo ultrafino com 16GB RAM',
    descricao_normalizada: 'notebook tipo ultrafino com 16gb ram',
    tipo_item: 'material',
    unidade_fornecimento: 'un',
    quantidade: 25,
    codigo_catmat_catser: '123456',
    maximo_adesao: 50,
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
  },
  {
    id: 'item-2',
    ata_id: 'ata-1',
    numero_item: '2',
    descricao: 'Servico de garantia estendida para notebook',
    descricao_normalizada: 'servico de garantia estendida para notebook',
    tipo_item: 'servico',
    unidade_fornecimento: 'servico',
    quantidade: 25,
    codigo_catmat_catser: '654321',
    maximo_adesao: 25,
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
  },
  {
    id: 'item-3',
    ata_id: 'ata-2',
    numero_item: '1',
    descricao: 'Servico continuado de limpeza predial',
    descricao_normalizada: 'servico continuado de limpeza predial',
    tipo_item: 'servico',
    unidade_fornecimento: 'posto',
    quantidade: 10,
    codigo_catmat_catser: null,
    maximo_adesao: null,
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T00:00:00.000Z',
  },
];

describe('atasService.search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMock.listAtas.mockResolvedValue(atasFixture);
    repositoryMock.listItens.mockResolvedValue(itensFixture);
    repositoryMock.listOrgaosClassificacao.mockResolvedValue([]);
    repositoryMock.createSearchSession.mockResolvedValue('sessao-1');
    repositoryMock.insertSearchResults.mockResolvedValue(undefined);
    repositoryMock.logUsageEvent.mockResolvedValue(undefined);
    repositoryMock.listSearchSessions.mockResolvedValue([]);
  });

  it('prioriza a ata mais aderente no modulo de adesao', async () => {
    const response = await atasService.search('adesao', 'notebooks para laboratorio');

    expect(response.results.length).toBeGreaterThanOrEqual(1);
    expect(response.results[0].ata.id).toBe('ata-1');
    expect(response.results[0].justification).toContain('Objeto da ata proximo da demanda');
    expect(response.results[0].adesaoAnalysis.hasMaximoAdesaoSignal).toBe(true);
    expect(response.sessionId).toBe('sessao-1');
    expect(repositoryMock.insertSearchResults).toHaveBeenCalledTimes(1);
  });

  it('aplica filtros de tipo e catalogo no modulo de pesquisa de precos', async () => {
    const response = await atasService.search('pesquisa_precos', 'servico para notebook', {
      filters: {
        statusVigencia: 'todas',
        tipoItem: 'servico',
        requireCatalog: true,
        catalogCode: '654',
      },
    });

    expect(response.results).toHaveLength(1);
    expect(response.results[0].ata.id).toBe('ata-1');
    expect(response.results[0].primaryItem?.id).toBe('item-2');
    expect(response.filters.requireCatalog).toBe(true);
    expect(response.filters.catalogCode).toBe('654');
  });

  it('marca refinamento quando ha busca anterior e gera sugestoes', async () => {
    const response = await atasService.search('pesquisa_precos', 'garantia notebook', {
      previousQuery: 'notebook',
    });

    expect(response.previousQuery).toBe('notebook');
    expect(response.refinementSuggestions.length).toBeGreaterThan(0);
    expect(repositoryMock.logUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_evento: 'refinamento_busca',
      })
    );
  });

  it('bloqueia no modulo de adesao atas marcadas apenas para pesquisa de precos', async () => {
    repositoryMock.listOrgaosClassificacao.mockResolvedValue([
      {
        cnpj: '15126437000143',
        classificacao: 'empresa_publica',
        permite_adesao_ifrn: false,
        usar_somente_pesquisa_precos: true,
        created_at: '2026-04-09T00:00:00.000Z',
        updated_at: '2026-04-09T00:00:00.000Z',
      },
    ]);
    repositoryMock.listAtas.mockResolvedValue([
      {
        ...atasFixture[0],
        raw_payload: {
          cnpjOrgao: '15126437000143',
        },
      },
    ]);

    const response = await atasService.search('adesao', 'notebooks para laboratorio');

    expect(response.results).toHaveLength(0);
  });
});
