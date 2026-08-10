import { DIMENSOES } from '@/types';

export const normalizeDimensionText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const extractDimensionCode = (value?: string | null) => {
  if (!value) return null;

  const directMatch = value.match(/\b([A-Z]{2})\b/i);
  const directCode = directMatch?.[1]?.toUpperCase();
  if (directCode && DIMENSOES.some((dimension) => dimension.codigo === directCode)) {
    return directCode;
  }

  const normalizedValue = normalizeDimensionText(value);
  const matchedDimension = DIMENSOES.find((dimension) => {
    const normalizedCode = normalizeDimensionText(dimension.codigo);
    const normalizedName = normalizeDimensionText(dimension.nome);

    return (
      normalizedValue === normalizedCode ||
      normalizedValue.includes(normalizedName) ||
      normalizedName.includes(normalizedValue)
    );
  });

  return matchedDimension?.codigo || null;
};

export const extractDimensionCodeFromPlanInternal = (value?: string | null) => {
  if (!value) return null;

  const normalizedValue = value.trim().toUpperCase();
  const endMatch = normalizedValue.match(/([A-Z]{2})[A-Z]?$/);
  if (!endMatch) return null;

  return DIMENSOES.some((dimension) => dimension.codigo === endMatch[1]) ? endMatch[1] : null;
};

export const resolveRecordDimensionCode = ({
  dimensionValue,
  planInternal,
  description,
}: {
  dimensionValue?: string | null;
  planInternal?: string | null;
  description?: string | null;
}) => {
  return (
    extractDimensionCode(dimensionValue) ||
    extractDimensionCodeFromPlanInternal(planInternal) ||
    extractDimensionCode(description) ||
    null
  );
};

export const getDimensionLabel = (dimensionCode?: string | null) => {
  if (!dimensionCode || dimensionCode === 'all') return null;

  return DIMENSOES.find((dimension) => dimension.codigo === dimensionCode)?.nome || dimensionCode;
};

export const matchesDimensionFilter = ({
  dimensionValue,
  planInternal,
  description,
  filterValue,
}: {
  dimensionValue?: string | null;
  planInternal?: string | null;
  description?: string | null;
  filterValue: string;
}) => {
  const filterCode = extractDimensionCode(filterValue) || filterValue.trim().toUpperCase();
  if (!filterCode || filterCode === 'ALL') return true;

  const recordCode = resolveRecordDimensionCode({ dimensionValue, planInternal, description });
  if (recordCode) return recordCode === filterCode;

  if (!dimensionValue?.trim()) return false;

  const normalizedValue = normalizeDimensionText(dimensionValue);
  const normalizedFilter = normalizeDimensionText(filterValue);

  return (
    normalizedValue.length > 0 &&
    (normalizedValue.includes(normalizedFilter) || normalizedFilter.includes(normalizedValue))
  );
};
