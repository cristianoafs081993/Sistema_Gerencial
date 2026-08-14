import { describe, expect, it } from 'vitest';

import {
  defaultComprasnetEtpGenerationPreferences,
  normalizeComprasnetEtpGenerationPreferences,
} from '@/lib/comprasnetEtpPreferences';

describe('preferências da minuta do ETP Comprasnet', () => {
  it('mantém apenas escolhas permitidas e limites seguros', () => {
    const preferences = normalizeComprasnetEtpGenerationPreferences({
      length: 'infinito',
      paragraphCount: 99,
      itemCount: 1,
      format: 'markdown',
      emphases: ['tecnica', 'invalida'],
      sources: ['processo', 'segredo'],
      existingTextMode: 'apagar',
      sectionOverrides: {
        necessidade: { checklist: ['publico_afetado', 'nao_permitido'] },
        desconhecida: { checklist: ['x'] },
      },
    });

    expect(preferences.length).toBe(defaultComprasnetEtpGenerationPreferences.length);
    expect(preferences.paragraphCount).toBe(8);
    expect(preferences.itemCount).toBe(3);
    expect(preferences.format).toBe(defaultComprasnetEtpGenerationPreferences.format);
    expect(preferences.emphases).toEqual(['tecnica']);
    expect(preferences.sources).toEqual(['processo']);
    expect(preferences.existingTextMode).toBe(defaultComprasnetEtpGenerationPreferences.existingTextMode);
    expect(preferences.sectionOverrides).toEqual({ necessidade: { checklist: ['publico_afetado'] } });
  });

  it('não persiste conteúdo, processo ou anexos no contrato de preferências', () => {
    const preferences = normalizeComprasnetEtpGenerationPreferences({
      ...defaultComprasnetEtpGenerationPreferences,
      processo: '23035.000001/2026-11',
      anexos: ['documento sigiloso.pdf'],
      rascunho: '<p>texto</p>',
    });

    expect(preferences).not.toHaveProperty('processo');
    expect(preferences).not.toHaveProperty('anexos');
    expect(preferences).not.toHaveProperty('rascunho');
  });
});
