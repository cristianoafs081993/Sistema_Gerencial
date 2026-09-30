import { supabase, DEFAULT_CAMPUS_UASG } from '../lib/supabase';
import {
  calcularDashboard,
  montarOpcoesPtres,
  type ContaSaldoRow,
  type CreditoRow,
  type DashboardMetrics,
  type PtresOpcao,
} from '../lib/dashboardRules';
import { lerTudo, tabelaInexistente } from './query';
import { fetchResumoContratos, type ResumoContratos } from './contratos';
import { getCampusSuapUnitCode, KNOWN_PTRES_NAMES } from './api';

export type DashboardData = {
  metricas: DashboardMetrics;
  ptres: PtresOpcao[];
  contratos: ResumoContratos | null;
  /** Momento em que os dados foram lidos no aparelho (mostrado no rodapé). */
  atualizadoEm: Date;
};

async function carregarCreditos(campusUasg: string): Promise<CreditoRow[]> {
  // Crédito oficial = último lote importado do relatório da tela web "Crédito disponível".
  const { data: lote, error } = await supabase
    .from('creditos_disponiveis_detalhes')
    .select('import_batch_id')
    .eq('campus_uasg', campusUasg)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !lote?.import_batch_id) return [];

  const { data } = await supabase
    .from('creditos_disponiveis_detalhes')
    .select('ptres, descricao, valor')
    .eq('import_batch_id', lote.import_batch_id)
    .eq('campus_uasg', campusUasg);
  return (data ?? []) as CreditoRow[];
}

async function carregarContaSaldos(campusUasg: string): Promise<ContaSaldoRow[]> {
  const { data, error } = await supabase.from('descentralizacoes_conta_saldos').select('ptres, valor').eq('campus_uasg', campusUasg);
  if (error) {
    if (tabelaInexistente(error)) return []; // rollout antigo: usa as linhas de descentralização
    throw new Error(error.message); // número de destaque: não mostrar um valor diferente do web sem avisar
  }
  return (data ?? []) as ContaSaldoRow[];
}

/**
 * Dados do Dashboard do campus. Lança erro se as tabelas principais falharem — a tela mostra o erro,
 * nunca valores de demonstração. Crédito e contratos são informações complementares: se falharem,
 * o painel continua (crédito cai para saldo calculado; contratos somem do alerta).
 */
export async function fetchDashboard(campusUasg: string = DEFAULT_CAMPUS_UASG, ptres = 'all'): Promise<DashboardData> {
  const unidadeSuap = getCampusSuapUnitCode(campusUasg);

  const [atividades, empenhos, descentralizacoes, contaSaldos, creditos, contratos] = await Promise.all([
    lerTudo((from, to) =>
      supabase
        .from('atividades')
        .select('valor_total, origem_recurso')
        .eq('campus_uasg', campusUasg)
        .neq('sync_active', false)
        .or(`suap_unit_code.eq.${unidadeSuap},suap_unit_code.is.null`)
        .range(from, to),
    ),
    lerTudo((from, to) =>
      supabase
        .from('empenhos')
        .select('valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, data_empenho, origem_recurso')
        .eq('campus_uasg', campusUasg)
        .eq('tipo', 'exercicio')
        .neq('status', 'cancelado')
        .range(from, to),
    ),
    lerTudo((from, to) =>
      supabase.from('descentralizacoes').select('valor, origem_recurso').eq('campus_uasg', campusUasg).range(from, to),
    ),
    carregarContaSaldos(campusUasg),
    carregarCreditos(campusUasg).catch(() => [] as CreditoRow[]),
    fetchResumoContratos(campusUasg).catch((erro) => {
      console.warn('Resumo de contratos indisponível no dashboard:', erro);
      return null;
    }),
  ]);

  const metricas = calcularDashboard({ atividades, empenhos, descentralizacoes, contaSaldos, creditos, ptres });
  const opcoes = montarOpcoesPtres(
    {
      origens: [...atividades, ...empenhos, ...descentralizacoes].map((linha) => linha.origem_recurso as string | null).concat(contaSaldos.map((c) => c.ptres ?? null)),
      creditos,
    },
    KNOWN_PTRES_NAMES,
  );

  return { metricas, ptres: opcoes, contratos, atualizadoEm: new Date() };
}
