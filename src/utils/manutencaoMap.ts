import type { Ambiente, Ocorrencia } from '@/services/manutencao';

export const normalizeBlocoNome = (value?: string | null) =>
  value?.trim().toLocaleLowerCase('pt-BR') || '';

export const ambientePertenceAoBloco = (
  ambiente: Pick<Ambiente, 'bloco'>,
  blocoNome?: string | null,
) => {
  const blocoNormalizado = normalizeBlocoNome(blocoNome);
  return blocoNormalizado !== '' && normalizeBlocoNome(ambiente.bloco) === blocoNormalizado;
};

export const filterAmbientesByBloco = (
  ambientes: Ambiente[],
  blocoNome?: string | null,
) => {
  if (!blocoNome) return ambientes;
  return ambientes.filter((ambiente) => ambientePertenceAoBloco(ambiente, blocoNome));
};

export const countOpenOccurrencesByBloco = (
  ambientes: Ambiente[],
  ocorrencias: Array<Pick<Ocorrencia, 'ambiente_id' | 'status' | 'ambiente'>>,
  blocoNome: string,
) => {
  const roomIds = new Set(
    filterAmbientesByBloco(ambientes, blocoNome).map((ambiente) => ambiente.id),
  );

  return ocorrencias.filter((ocorrencia) => {
    if (ocorrencia.status !== 'pendente') return false;
    if (roomIds.has(ocorrencia.ambiente_id)) return true;
    return ocorrencia.ambiente
      ? ambientePertenceAoBloco(ocorrencia.ambiente, blocoNome)
      : false;
  }).length;
};
