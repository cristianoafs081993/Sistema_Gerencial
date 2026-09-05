/** Contract validity is a civil date, never shifted by the browser's time zone. */
export function contractDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const civil = (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);
  const date = civil && /^\d{4}-\d{2}-\d{2}$/.test(civil)
    ? new Date(`${civil}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(civil) &&
    (date.getFullYear() !== Number(civil.slice(0, 4)) || date.getMonth() + 1 !== Number(civil.slice(5, 7)) || date.getDate() !== Number(civil.slice(8, 10)))) return null;
  return date;
}

export function formatContractDate(value: string | Date | null | undefined): string {
  const date = contractDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR').format(date) : '—';
}

export function contractDaysRemaining(value: string | Date | null | undefined, today = new Date()): number | null {
  const date = contractDate(value);
  if (!date) return null;
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
}

export function contractDeadlineLabel(value: string | Date | null | undefined): string {
  const days = contractDaysRemaining(value);
  if (days === null) return 'Vigência não informada';
  if (days < 0) return `Vencido há ${Math.abs(days)} dia(s)`;
  return days === 0 ? 'Vence hoje' : `Vence em ${days} dia(s)`;
}
