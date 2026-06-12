import { describe, expect, it } from 'vitest';

import type { Ambiente } from '@/services/manutencao';
import {
  ambientePertenceAoBloco,
  countOpenOccurrencesByBloco,
  filterAmbientesByBloco,
  normalizeBlocoNome,
} from '@/utils/manutencaoMap';

const ambientes: Ambiente[] = [
  {
    id: 'amb-1',
    codigo: 'SALA-101',
    nome: 'Sala 101',
    bloco: 'Bloco Acadêmico Central',
    tipo: 'sala',
    status: 'ativo',
    created_at: '2026-06-12T12:00:00.000Z',
  },
  {
    id: 'amb-2',
    codigo: 'GINASIO',
    nome: 'Quadra',
    bloco: 'Ginásio Poliesportivo',
    tipo: 'outros',
    status: 'ativo',
    created_at: '2026-06-12T12:00:00.000Z',
  },
  {
    id: 'amb-3',
    codigo: 'EXTERNO',
    nome: 'Área externa',
    bloco: null,
    tipo: 'outros',
    status: 'ativo',
    created_at: '2026-06-12T12:00:00.000Z',
  },
];

describe('manutencaoMap', () => {
  it('normaliza o nome do bloco sem depender de zona funcional', () => {
    expect(normalizeBlocoNome('  BLOCO Acadêmico Central ')).toBe('bloco acadêmico central');
    expect(ambientePertenceAoBloco(ambientes[0], 'bloco acadêmico central')).toBe(true);
  });

  it('filtra somente os ambientes vinculados ao bloco selecionado', () => {
    expect(filterAmbientesByBloco(ambientes, 'Ginásio Poliesportivo')).toEqual([ambientes[1]]);
    expect(filterAmbientesByBloco(ambientes, null)).toEqual(ambientes);
  });

  it('gera alerta somente no bloco da sala com ocorrência pendente', () => {
    const ocorrencias = [
      {
        ambiente_id: 'amb-1',
        status: 'pendente' as const,
        ambiente: {
          nome: 'Sala 101',
          codigo: 'SALA-101',
          bloco: 'Bloco Acadêmico Central',
        },
      },
      {
        ambiente_id: 'amb-2',
        status: 'resolvido' as const,
        ambiente: {
          nome: 'Quadra',
          codigo: 'GINASIO',
          bloco: 'Ginásio Poliesportivo',
        },
      },
    ];

    expect(
      countOpenOccurrencesByBloco(ambientes, ocorrencias, 'Bloco Acadêmico Central'),
    ).toBe(1);
    expect(
      countOpenOccurrencesByBloco(ambientes, ocorrencias, 'Ginásio Poliesportivo'),
    ).toBe(0);
  });
});
