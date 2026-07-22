export function normalizeLcAccount(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase();
}

export function padLeftLcAccount(value: string | null | undefined, size: number): string {
  const normalized = normalizeLcAccount(value);
  if (!normalized) return ''.padStart(size, '0');
  return normalized.length > size ? normalized.slice(-size) : normalized.padStart(size, '0');
}
