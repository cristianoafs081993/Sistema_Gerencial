const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

/**
 * Formata datas "AAAA-MM-DD" (com ou sem hora) como "30 set. 2026" SEM passar por `new Date()`:
 * `new Date('2026-09-30')` é interpretado em UTC e, no fuso do Brasil (UTC-3), viraria 29/09.
 */
export function formatarDataIso(value?: string | null, vazio = '—'): string {
  if (!value) return vazio;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return vazio;
  const [, ano, mes, dia] = match;
  const mesIdx = Number(mes) - 1;
  if (mesIdx < 0 || mesIdx > 11) return vazio;
  return `${dia} ${MESES[mesIdx]} ${ano}`;
}

export function formatarMoeda(value: number, comCentavos = true): string {
  return (Number(value) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: comCentavos ? 2 : 0,
    maximumFractionDigits: comCentavos ? 2 : 0,
  });
}

/** Moeda compacta para cartões estreitos: R$ 1,2 mi, R$ 350 mil. */
export function formatarMoedaCompacta(value: number): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace('.', ',')} mi`;
  if (abs >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString('pt-BR')} mil`;
  return formatarMoeda(n, false);
}

/** Primeiro nome para saudações: usa o nome do perfil e, sem ele, a parte inicial do e-mail. */
export function primeiroNome(user?: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null): string {
  const meta = user?.user_metadata ?? {};
  const completo = [meta.full_name, meta.name, meta.display_name].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const base = completo ?? (user?.email ?? '').split('@')[0];
  const primeiro = base.trim().split(/[\s._-]+/).filter(Boolean)[0] ?? '';
  if (!primeiro) return 'tudo bem';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}
