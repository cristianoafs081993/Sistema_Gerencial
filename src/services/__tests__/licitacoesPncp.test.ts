import { describe, expect, it } from 'vitest';

import {
  getLicitacaoLinks,
  getProposalStatus,
  mapLicitacaoPncpRow,
  normalizeLicitacoesPncpSyncError,
} from '@/services/licitacoesPncp';

describe('licitacoesPncpService helpers', () => {
  it('normaliza linha de licitacao PNCP', () => {
    const mapped = mapLicitacaoPncpRow({
      id: 'lic-1',
      numero_controle_pncp: '10877412000168-1-000198/2025',
      cnpj_orgao: '10877412000168',
      ano_compra: 2025,
      sequencial_compra: 198,
      numero_compra: '90001',
      objeto_compra: 'Combustiveis',
      modalidade_id: 6,
      uasg_codigo: '158366',
      valor_total_estimado: '275841.38',
      srp: true,
      raw_data: { origem: 'pncp' },
      compras_gov_data: {},
      updated_at: '2026-05-04T12:00:00.000Z',
    });

    expect(mapped).toEqual(expect.objectContaining({
      id: 'lic-1',
      numeroControlePncp: '10877412000168-1-000198/2025',
      anoCompra: 2025,
      sequencialCompra: 198,
      uasgCodigo: '158366',
      valorTotalEstimado: 275841.38,
      srp: true,
    }));
  });

  it('deriva status de propostas e links externos', () => {
    const row = mapLicitacaoPncpRow({
      id: 'lic-1',
      numero_controle_pncp: '10877412000168-1-000198/2025',
      cnpj_orgao: '10877412000168',
      ano_compra: 2025,
      sequencial_compra: 198,
      numero_compra: '90001',
      modalidade_id: 6,
      uasg_codigo: '158366',
      data_abertura_proposta: '2026-05-01T08:00:00.000Z',
      data_encerramento_proposta: '2026-05-10T09:00:00.000Z',
      link_sistema_origem: 'https://compras.gov.br/compra',
      raw_data: {},
      compras_gov_data: {},
      updated_at: '2026-05-04T12:00:00.000Z',
    });

    expect(getProposalStatus(row, new Date('2026-05-04T12:00:00.000Z'))).toBe('Aberta');
    expect(getLicitacaoLinks(row)).toEqual(expect.objectContaining({
      pncpUrl: 'https://pncp.gov.br/app/editais/10877412000168/2025/198',
      comprasGovUrl: 'https://compras.gov.br/compra',
      comprasKey: '15836605900012025',
    }));
  });

  it('traduz falha de fetch da edge function para mensagem operacional', () => {
    const error = normalizeLicitacoesPncpSyncError({
      name: 'FunctionsFetchError',
      message: 'Failed to fetch',
    });

    expect(error.message).toContain('sync-licitacoes-pncp');
    expect(error.message).toContain('function foi publicada');
  });
});
