import { extractPlanoInternoCode } from '@/utils/atividadeEmpenhoMatching';

export const normalizePlanoInterno = (value?: string | null): string => {
  if (!value) return '';
  return value.trim().toUpperCase();
};

export const matchesPlanoInternoFilter = ({
  planoInterno,
  filterValue,
}: {
  planoInterno?: string | null;
  filterValue?: string | null;
}): boolean => {
  if (!filterValue || filterValue === 'all') return true;
  if (!planoInterno) return false;

  const cleanPi = normalizePlanoInterno(planoInterno);
  const cleanFilter = normalizePlanoInterno(filterValue);

  if (cleanPi === cleanFilter) return true;

  const codePi = extractPlanoInternoCode(cleanPi);
  const codeFilter = extractPlanoInternoCode(cleanFilter);
  if (codePi && codeFilter && codePi.toUpperCase() === codeFilter.toUpperCase()) {
    return true;
  }

  if (cleanPi.startsWith(cleanFilter) || cleanFilter.startsWith(cleanPi)) {
    return true;
  }

  // Equivalência alfanumérica para padrões como "PI-EN" vs "PIEN"
  const alphaNumPi = cleanPi.replace(/[^A-Z0-9]/g, '');
  const alphaNumFilter = cleanFilter.replace(/[^A-Z0-9]/g, '');
  if (alphaNumPi && alphaNumFilter && alphaNumPi === alphaNumFilter) {
    return true;
  }

  return false;
};
