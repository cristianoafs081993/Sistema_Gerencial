import { describe, expect, it } from 'vitest';

import {
  buildAtaKey,
  mapAtaRegistroPreco,
  mapAtaRegistroPrecoAdesao,
  mapAtaRegistroPrecoItem,
  mapAtaRegistroPrecoUnidade,
} from '@/lib/atasRegistroPrecos';

describe('atasRegistroPrecos helpers', () => {
  it('normaliza ata, item, participante e adesao do Compras.gov.br', () => {
    const ata = mapAtaRegistroPreco({
      numeroAtaRegistroPreco: '0001/2026',
      numeroCompra: '90001',
      anoCompra: 2026,
      codigoUnidadeGerenciadora: '158366',
      nomeUnidadeGerenciadora: 'CAMPUS CURRAIS NOVOS',
      objeto: 'Aquisicao de materiais',
      dataVigenciaInicial: '2026-01-10',
      dataVigenciaFinal: '2027-01-10',
    });

    expect(ata).toEqual(expect.objectContaining({
      ata_key: '158366-0001/2026',
      numero_ata: '0001/2026',
      unidade_gerenciadora_codigo: '158366',
      data_vigencia_inicial: '2026-01-10T00:00:00.000Z',
    }));

    const item = mapAtaRegistroPrecoItem({
      numeroItem: '1',
      codigoItem: '123',
      descricaoItem: 'Material de consumo',
      niFornecedor: '00000000000100',
      nomeRazaoSocialFornecedor: 'Fornecedor Teste',
      quantidadeHomologadaItem: '4',
      valorTotal: '1.234,56',
    }, ata);

    expect(item).toEqual(expect.objectContaining({
      ata_key: ata.ata_key,
      numero_item: '1',
      codigo_item: '123',
      fornecedor_nome: 'Fornecedor Teste',
      quantidade_homologada: 4,
      valor_total: 1234.56,
    }));

    expect(mapAtaRegistroPrecoUnidade({
      codigoUnidade: '158155',
      nomeUnidade: 'REITORIA',
      saldoQuantidade: '10',
    }, item)).toEqual(expect.objectContaining({
      unidade_codigo: '158155',
      saldo_quantidade: 10,
    }));

    expect(mapAtaRegistroPrecoAdesao({
      codigoUnidade: '158375',
      quantidadeAderida: '2',
      valorAderido: '300,50',
      dataAdesao: '2026-03-01',
    }, item)).toEqual(expect.objectContaining({
      unidade_codigo: '158375',
      quantidade_aderida: 2,
      valor_aderido: 300.5,
    }));
  });

  it('monta chave de ata por unidade gerenciadora e numero', () => {
    expect(buildAtaKey('158366', '0001/2026')).toBe('158366-0001/2026');
  });
});
