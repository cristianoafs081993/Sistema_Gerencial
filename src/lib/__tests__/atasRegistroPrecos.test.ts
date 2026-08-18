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

  it('preserva valores decimais nativos sem multiplicar por 10x/100x', () => {
    const ata = mapAtaRegistroPreco({
      numeroAtaRegistroPreco: '00002/2026',
      codigoUnidadeGerenciadora: '158366',
      valorTotal: 31354.2,
    });

    expect(ata.raw_data.valorTotal).toBe(31354.2);

    const item1 = mapAtaRegistroPrecoItem({
      numeroItem: '00001',
      valorUnitario: 124.8,
      valorTotal: 4992,
      quantidadeHomologadaItem: 40,
    }, ata);

    expect(item1.valor_unitario).toBe(124.8);
    expect(item1.valor_total).toBe(4992);
    expect(item1.quantidade_homologada).toBe(40);

    const item2 = mapAtaRegistroPrecoItem({
      numeroItem: '00002',
      valorUnitario: 439.37,
      valorTotal: 26362.2,
      quantidadeHomologadaItem: 60,
    }, ata);

    expect(item2.valor_unitario).toBe(439.37);
    expect(item2.valor_total).toBe(26362.2);
    expect(item2.quantidade_homologada).toBe(60);
  });

  it('monta chave de ata por unidade gerenciadora e numero', () => {
    expect(buildAtaKey('158366', '0001/2026')).toBe('158366-0001/2026');
  });

  it('rejeita item quando o numero da ata retornado pela API diverge da ata alvo', () => {
    const ata = mapAtaRegistroPreco({
      numeroAtaRegistroPreco: '00006/2025',
      codigoUnidadeGerenciadora: '158366',
    });

    expect(() => {
      mapAtaRegistroPrecoItem({
        numeroItem: '00001',
        numeroAtaRegistroPreco: '00004/2025',
      }, ata);
    }).toThrow(/divergente/);
  });
});
