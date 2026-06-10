import { describe, expect, it } from 'vitest';

import { gzipSync } from 'node:zlib';

import {
  normalizeCatalogText,
  parseCatalogResponse,
  rankCatalogEntries,
} from '@/lib/priceCatalog';

describe('priceCatalog', () => {
  it('normaliza acentos e pontuação para comparação', () => {
    expect(normalizeCatalogText('Café torrado, moído!')).toBe('cafe torrado moido');
  });

  it('prioriza descrição e especificação numérica compatíveis', () => {
    const result = rankCatalogEntries(
      'Café torrado e moído, pacote de 500 g',
      'material',
      [
        ['100', 'CAFÉ TORRADO E MOÍDO, APRESENTAÇÃO PACOTE 250 G', 'ALIMENTOS', 'cafe torrado e moido apresentacao pacote 250 g alimentos'],
        ['200', 'CAFÉ TORRADO E MOÍDO, APRESENTAÇÃO PACOTE 500 G', 'ALIMENTOS', 'cafe torrado e moido apresentacao pacote 500 g alimentos'],
        ['300', 'AÇÚCAR CRISTAL, PACOTE 1 KG', 'ALIMENTOS', 'acucar cristal pacote 1 kg alimentos'],
      ],
      3,
    );

    expect(result[0]).toMatchObject({ code: '200', catalogType: 'material' });
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].reason).toContain('Especificações numéricas coincidem');
  });

  it('retorna alternativas similares ordenadas por aderência', () => {
    const result = rankCatalogEntries(
      'manutenção preventiva de aparelho de ar condicionado',
      'service',
      [
        ['10', 'MANUTENÇÃO PREVENTIVA DE APARELHO DE AR CONDICIONADO', 'MANUTENÇÃO', 'manutencao preventiva de aparelho de ar condicionado'],
        ['20', 'INSTALAÇÃO DE APARELHO DE AR CONDICIONADO', 'INSTALAÇÃO', 'instalacao de aparelho de ar condicionado'],
        ['30', 'MANUTENÇÃO DE ELEVADOR', 'MANUTENÇÃO', 'manutencao de elevador'],
      ],
      3,
    );

    expect(result.map((suggestion) => suggestion.code)).toEqual(['10', '20', '30']);
  });

  it('aceita catálogo que o navegador já descompactou pelo Content-Encoding', async () => {
    const payload = {
      version: 1,
      type: 'service',
      generatedAt: '2026-06-10T00:00:00.000Z',
      source: 'catser.xlsx',
      entries: [['10', 'MANUTENÇÃO', 'SERVIÇOS', 'manutencao servico']],
    };
    const response = new Response(JSON.stringify(payload), {
      headers: { 'Content-Encoding': 'gzip', 'Content-Type': 'application/json' },
    });

    await expect(parseCatalogResponse(response)).resolves.toEqual(payload);
  });

  it('descompacta catálogo quando o corpo ainda contém gzip', async () => {
    const payload = {
      version: 1,
      type: 'material',
      generatedAt: '2026-06-10T00:00:00.000Z',
      source: 'catmat.xlsx',
      entries: [['20', 'CAFÉ', 'ALIMENTOS', 'cafe alimento']],
    };
    const response = new Response(gzipSync(JSON.stringify(payload)));

    await expect(parseCatalogResponse(response)).resolves.toEqual(payload);
  });
});
