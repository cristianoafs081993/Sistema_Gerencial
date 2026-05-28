import { describe, expect, it } from 'vitest';

import {
  buildAtaItemSearchFilter,
  buildAtaSearchFilter,
  mapAtaRegistroPrecoRow,
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
});
