import type { ContratoApiHistoricoRow } from '@/services/contratosApi';

const historicoTimestamp = (row: ContratoApiHistoricoRow) => {
  const value = row.data_assinatura || row.data_publicacao || row.vigencia_inicio || '';
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const getValorDoTermo = (row: ContratoApiHistoricoRow) => {
  return Number(row.valor_inicial) || 0;
};

const toCents = (value: number) => Math.round(value * 100);

export const getValorTotalFromHistorico = (historico: ContratoApiHistoricoRow[]) => {
  if (historico.length === 0) return 0;

  const ordered = [...historico].sort((a, b) => {
    const byDate = historicoTimestamp(a) - historicoTimestamp(b);
    if (byDate !== 0) return byDate;
    return (a.api_historico_id || 0) - (b.api_historico_id || 0);
  });

  return ordered.reduce((sum, row) => sum + toCents(getValorDoTermo(row)), 0) / 100;
};
