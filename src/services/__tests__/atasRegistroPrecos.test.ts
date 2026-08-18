import { describe, expect, it } from 'vitest';

import {
  buildAtaItemSearchFilter,
  buildAtaSearchFilter,
  mapAtaRegistroPrecoRow,
  mapAtaRegistroPrecoUnidadeRow,
} from '@/services/atasRegistroPrecos';

describe('atasRegistroPrecosService helpers', () => {
  it('inclui itens materializados na busca principal de atas', () => {
    expect(buildAtaSearchFilter('caf%C_')).toContain('itens_texto_pesquisa.ilike.%caf\\%C\\_%');
  });

  it('busca a correspondencia de item por descricao, codigo e fornecedor', () => {
    const filter = buildAtaItemSearchFilter('Fornecedor');

    expect(filter).toContain('codigo_item.ilike.%Fornecedor%');
    expect(filter).toContain('descricao_item.ilike.%Fornecedor%');
    expect(filter).toContain('fornecedor_nome.ilike.%Fornecedor%');
    expect(filter).toContain('fornecedor_ni.ilike.%Fornecedor%');
  });

  it('inicia linhas agregadas sem correspondencia de item selecionada', () => {
    expect(mapAtaRegistroPrecoRow({
      id: 'ata-1',
      ata_key: '158366-0001/2026',
      numero_ata: '0001/2026',
      unidade_gerenciadora_codigo: '158366',
      updated_at: '2026-05-27T10:00:00.000Z',
    })).toMatchObject({
      itemCorrespondente: null,
    });
  });

  it('mapeia unidades cotistas com quantidade registrada e saldo de empenho', () => {
    const mapped = mapAtaRegistroPrecoUnidadeRow({
      id: 'u-1',
      unidade_item_key: '158366-00001/2026-00001-461517-55806684000105-158369',
      item_key: '158366-00001/2026-00001-461517-55806684000105',
      ata_key: '158366-00001/2026',
      unidade_codigo: '158369',
      unidade_nome: 'INST.FED.DO RN/CAMPUS NATAL - CENTRAL',
      quantidade_autorizada: null,
      quantidade_utilizada: null,
      saldo_quantidade: null,
      raw_data: {
        tipoUnidade: 'PARTICIPANTE',
        numeroItem: '00001',
        quantidadeRegistrada: 150,
        saldoRemanejamentoEmpenho: 150,
      },
    });

    expect(mapped).toMatchObject({
      unidadeCodigo: '158369',
      tipoUnidade: 'PARTICIPANTE',
      numeroItem: '00001',
      quantidadeRegistrada: 150,
      saldoRemanejamento: 150,
    });
  });
});
