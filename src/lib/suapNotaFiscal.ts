import type { SuapDadosCompletos, SuapNotaFiscal } from '@/types';

export function getNotasFiscais(dadosCompletos?: SuapDadosCompletos | null): SuapNotaFiscal[] {
  return (dadosCompletos?.notas_fiscais || []).filter((nota) =>
    Boolean(nota.numero?.trim() || nota.data_emissao?.trim() || nota.valor?.trim()),
  );
}

export function formatNotasFiscaisField(
  notasFiscais: SuapNotaFiscal[],
  field: keyof SuapNotaFiscal,
  fallback = '-',
): string {
  const values = notasFiscais
    .map((nota) => nota[field]?.trim())
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? values.join('\n') : fallback;
}

export function hasNotaFiscalNumero(notasFiscais: SuapNotaFiscal[]): boolean {
  return notasFiscais.some((nota) => Boolean(nota.numero?.trim()));
}
