import type { TipoAtividade } from '@/types';
import { extractDimensionCode } from '@/utils/dimensionFilters';

export const TIPO_ATIVIDADE_VALUES: TipoAtividade[] = [
  'campus',
  'sistemico',
  'emendas-parlamentares',
];

export function isTipoAtividade(value: string | null | undefined): value is TipoAtividade {
  return TIPO_ATIVIDADE_VALUES.includes(value as TipoAtividade);
}

export function inferTipoAtividadeFromDimensao(dimensao?: string | null): TipoAtividade {
  return extractDimensionCode(dimensao) === 'EN' ? 'sistemico' : 'campus';
}

export function resolveTipoAtividade(
  tipoAtividade?: string | null,
  dimensao?: string | null,
): TipoAtividade {
  if (isTipoAtividade(tipoAtividade)) {
    return tipoAtividade;
  }

  return inferTipoAtividadeFromDimensao(dimensao);
}
