import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AtividadeDetalhada,
  DimensaoDistribuicao,
  NaturezaDespesaAgrupada,
  OrcamentoFiltros,
  PainelExecucaoResult,
  PtresResumoResult,
} from './types';

export class OrcamentoModule {
  constructor(private client: SupabaseClient) {}

  /**
   * Retorna os KPIs consolidados da execução orçamentária
   */
  async getPainelExecucao(filtros?: OrcamentoFiltros): Promise<PainelExecucaoResult> {
    let queryAtividades = this.client
      .from('atividades')
      .select('valor_total, saldo_disponivel, dimensao, componente_funcional, origem_recurso, tipo_atividade');

    let queryEmpenhos = this.client
      .from('empenhos')
      .select('valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, status, tipo, dimensao, componente_funcional, origem_recurso, data_empenho');

    if (filtros?.dimensao) {
      queryAtividades = queryAtividades.eq('dimensao', filtros.dimensao);
      queryEmpenhos = queryEmpenhos.eq('dimensao', filtros.dimensao);
    }
    if (filtros?.componenteFuncional) {
      queryAtividades = queryAtividades.eq('componente_funcional', filtros.componenteFuncional);
      queryEmpenhos = queryEmpenhos.eq('componente_funcional', filtros.componenteFuncional);
    }
    if (filtros?.origemRecurso) {
      queryAtividades = queryAtividades.eq('origem_recurso', filtros.origemRecurso);
      queryEmpenhos = queryEmpenhos.eq('origem_recurso', filtros.origemRecurso);
    }
    if (filtros?.tipoAtividade && filtros.tipoAtividade !== 'todos') {
      queryAtividades = queryAtividades.eq('tipo_atividade', filtros.tipoAtividade);
    }

    const [{ data: atividades, error: errAtiv }, { data: empenhos, error: errEmp }] = await Promise.all([
      queryAtividades,
      queryEmpenhos,
    ]);

    if (errAtiv) throw new Error(`Erro ao buscar atividades: ${errAtiv.message}`);
    if (errEmp) throw new Error(`Erro ao buscar empenhos: ${errEmp.message}`);

    const ativList = atividades || [];
    let empList = (empenhos || []).filter((e) => e.status !== 'cancelado' && (e.tipo === 'exercicio' || !e.tipo));

    if (filtros?.ano) {
      empList = empList.filter((e) => {
        if (!e.data_empenho) return true;
        const year = new Date(e.data_empenho).getFullYear();
        return year === filtros.ano;
      });
    }

    const totalPlanejado = ativList.reduce((acc, a) => acc + Number(a.valor_total || 0), 0);
    const totalEmpenhado = empList.reduce((acc, e) => acc + Number(e.valor || 0), 0);
    const totalLiquidado = empList.reduce(
      (acc, e) => acc + Number(e.valor_liquidado_oficial ?? e.valor_liquidado ?? 0),
      0
    );
    const totalPago = empList.reduce((acc, e) => acc + Number(e.valor_pago_oficial ?? 0), 0);

    // Consulta Descentralizações líquidas para calcular aDescentralizar
    let queryDesc = this.client.from('descentralizacoes').select('valor, operacao_tipo, origem_recurso');
    if (filtros?.origemRecurso) {
      queryDesc = queryDesc.eq('origem_recurso', filtros.origemRecurso);
    }
    const { data: descData } = await queryDesc;
    const totalDescentralizado = (descData || []).reduce((acc, d) => {
      const v = Number(d.valor || 0);
      const isEstorno = String(d.operacao_tipo || '').toUpperCase().includes('ANULACAO') ||
                        String(d.operacao_tipo || '').toUpperCase().includes('ESTORNO');
      return isEstorno ? acc - v : acc + v;
    }, 0);

    const aDescentralizar = Math.max(0, totalPlanejado - totalDescentralizado);
    const percentualExecutado = totalPlanejado > 0 ? (totalEmpenhado / totalPlanejado) * 100 : 0;
    const percentualLiquidado = totalEmpenhado > 0 ? (totalLiquidado / totalEmpenhado) * 100 : 0;
    const percentualPago = totalEmpenhado > 0 ? (totalPago / totalEmpenhado) * 100 : 0;

    return {
      totalPlanejado: Number(totalPlanejado.toFixed(2)),
      totalDescentralizado: Number(totalDescentralizado.toFixed(2)),
      totalEmpenhado: Number(totalEmpenhado.toFixed(2)),
      totalLiquidado: Number(totalLiquidado.toFixed(2)),
      totalPago: Number(totalPago.toFixed(2)),
      aDescentralizar: Number(aDescentralizar.toFixed(2)),
      percentualExecutado: Number(percentualExecutado.toFixed(2)),
      percentualLiquidado: Number(percentualLiquidado.toFixed(2)),
      percentualPago: Number(percentualPago.toFixed(2)),
      quantidadeAtividades: ativList.length,
      quantidadeEmpenhos: empList.length,
    };
  }

  /**
   * Retorna um resumo executivo de um PTRES (Planejado, Descentralizado, Empenhado e Saldos)
   */
  async getPtresResumo(ptres: string): Promise<PtresResumoResult> {
    const cleanPtres = String(ptres).trim();

    const [
      { data: atividades, error: errAtiv },
      { data: descentralizacoes, error: errDesc },
      { data: empenhos, error: errEmp },
    ] = await Promise.all([
      this.client.from('atividades').select('valor_total, plano_interno').eq('origem_recurso', cleanPtres),
      this.client.from('descentralizacoes').select('valor, operacao_tipo, nota_credito').eq('origem_recurso', cleanPtres),
      this.client
        .from('empenhos')
        .select('valor, valor_liquidado_oficial, valor_liquidado, valor_pago_oficial, status, tipo')
        .eq('origem_recurso', cleanPtres),
    ]);

    if (errAtiv) throw new Error(`Erro ao buscar atividades do PTRES ${cleanPtres}: ${errAtiv.message}`);
    if (errDesc) throw new Error(`Erro ao buscar descentralizações do PTRES ${cleanPtres}: ${errDesc.message}`);
    if (errEmp) throw new Error(`Erro ao buscar empenhos do PTRES ${cleanPtres}: ${errEmp.message}`);

    const planejadoSuap = (atividades || []).reduce((acc, a) => acc + Number(a.valor_total || 0), 0);

    const descentralizadoSiafi = (descentralizacoes || []).reduce((acc, d) => {
      const v = Number(d.valor || 0);
      const isEstorno = String(d.operacao_tipo || '').toUpperCase().includes('ANULACAO') ||
                        String(d.operacao_tipo || '').toUpperCase().includes('ESTORNO');
      return isEstorno ? acc - v : acc + v;
    }, 0);

    const empenhosAtivos = (empenhos || []).filter(
      (e) => e.status !== 'cancelado' && (e.tipo === 'exercicio' || !e.tipo)
    );

    const empenhadoSiafi = empenhosAtivos.reduce((acc, e) => acc + Number(e.valor || 0), 0);
    const liquidadoSiafi = empenhosAtivos.reduce(
      (acc, e) => acc + Number(e.valor_liquidado_oficial ?? e.valor_liquidado ?? 0),
      0
    );
    const pagoSiafi = empenhosAtivos.reduce((acc, e) => acc + Number(e.valor_pago_oficial ?? 0), 0);

    const saldoSuap = planejadoSuap - empenhadoSiafi;
    const saldoRealSiafi = descentralizadoSiafi - empenhadoSiafi;
    const percentualExecucao = planejadoSuap > 0 ? (empenhadoSiafi / planejadoSuap) * 100 : 0;

    const alertas: string[] = [];
    let status: PtresResumoResult['status'] = 'regular';

    if (saldoRealSiafi < 0) {
      status = 'deficit';
      alertas.push(`Déficit orçamentário real no SIAFI de R$ ${Math.abs(saldoRealSiafi).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    } else if (saldoSuap < 0 && saldoRealSiafi >= 0) {
      status = 'alerta_descompasso';
      alertas.push(
        `Descompasso com o SUAP: O saldo do planejamento está negativo em R$ ${Math.abs(saldoSuap).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas o SIAFI possui crédito real disponível de R$ ${saldoRealSiafi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      );
    } else if (planejadoSuap === 0 && empenhadoSiafi > 0) {
      status = 'sem_planejamento';
      alertas.push('Existem empenhos emitidos no SIAFI sem nenhuma atividade cadastrada no planejamento (SUAP).');
    }

    return {
      ptres: cleanPtres,
      planejadoSuap: Number(planejadoSuap.toFixed(2)),
      descentralizadoSiafi: Number(descentralizadoSiafi.toFixed(2)),
      empenhadoSiafi: Number(empenhadoSiafi.toFixed(2)),
      liquidadoSiafi: Number(liquidadoSiafi.toFixed(2)),
      pagoSiafi: Number(pagoSiafi.toFixed(2)),
      saldoSuap: Number(saldoSuap.toFixed(2)),
      saldoRealSiafi: Number(saldoRealSiafi.toFixed(2)),
      percentualExecucao: Number(percentualExecucao.toFixed(2)),
      status,
      alertas,
    };
  }

  /**
   * Lista atividades detalhadas com enriquecimento de execução
   */
  async listarAtividades(filtros?: OrcamentoFiltros & { ptres?: string; planoInterno?: string; termo?: string }): Promise<AtividadeDetalhada[]> {
    let query = this.client
      .from('atividades')
      .select('id, atividade, descricao, dimensao, componente_funcional, plano_interno, natureza_despesa, origem_recurso, valor_total, saldo_disponivel, sync_source, suap_plan_id, suap_activity_id')
      .order('dimensao', { ascending: true });

    if (filtros?.dimensao) query = query.eq('dimensao', filtros.dimensao);
    if (filtros?.componenteFuncional) query = query.eq('componente_funcional', filtros.componenteFuncional);
    if (filtros?.origemRecurso || filtros?.ptres) query = query.eq('origem_recurso', filtros.origemRecurso || filtros.ptres);
    if (filtros?.planoInterno) query = query.eq('plano_interno', filtros.planoInterno);
    if (filtros?.tipoAtividade && filtros.tipoAtividade !== 'todos') query = query.eq('tipo_atividade', filtros.tipoAtividade);

    const { data: rows, error } = await query;
    if (error) throw new Error(`Erro ao listar atividades: ${error.message}`);

    let list = rows || [];
    if (filtros?.termo) {
      const t = filtros.termo.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.atividade || '').toLowerCase().includes(t) ||
          String(r.descricao || '').toLowerCase().includes(t) ||
          String(r.plano_interno || '').toLowerCase().includes(t)
      );
    }

    return list.map((r) => {
      const valorTotal = Number(r.valor_total || 0);
      const saldoDisponivelSuap = r.saldo_disponivel != null ? Number(r.saldo_disponivel) : valorTotal;
      const valorEmpenhadoCalculado = Math.max(0, valorTotal - saldoDisponivelSuap);
      return {
        id: String(r.id),
        atividade: String(r.atividade || ''),
        descricao: String(r.descricao || ''),
        dimensao: String(r.dimensao || ''),
        componenteFuncional: String(r.componente_funcional || ''),
        planoInterno: String(r.plano_interno || ''),
        naturezaDespesa: String(r.natureza_despesa || ''),
        origemRecurso: String(r.origem_recurso || ''),
        valorTotal: Number(valorTotal.toFixed(2)),
        saldoDisponivelSuap: Number(saldoDisponivelSuap.toFixed(2)),
        valorEmpenhadoCalculado: Number(valorEmpenhadoCalculado.toFixed(2)),
        saldoCalculado: Number(saldoDisponivelSuap.toFixed(2)),
        syncSource: r.sync_source || undefined,
        suapPlanId: r.suap_plan_id || undefined,
        suapActivityId: r.suap_activity_id || undefined,
      };
    });
  }

  /**
   * Distribuição orçamentária agrupada por dimensão institucional
   */
  async getDistribuicaoDimensoes(ano?: number): Promise<DimensaoDistribuicao[]> {
    const [{ data: atividades }, { data: empenhos }] = await Promise.all([
      this.client.from('atividades').select('dimensao, valor_total'),
      this.client.from('empenhos').select('dimensao, valor, valor_liquidado_oficial, valor_liquidado, data_empenho, status, tipo'),
    ]);

    const dimMap = new Map<string, { planejado: number; empenhado: number; liquidado: number }>();

    (atividades || []).forEach((a) => {
      const d = String(a.dimensao || 'NÃO INFORMADA').trim();
      const curr = dimMap.get(d) || { planejado: 0, empenhado: 0, liquidado: 0 };
      curr.planejado += Number(a.valor_total || 0);
      dimMap.set(d, curr);
    });

    let empList = (empenhos || []).filter((e) => e.status !== 'cancelado' && (e.tipo === 'exercicio' || !e.tipo));
    if (ano) {
      empList = empList.filter((e) => {
        if (!e.data_empenho) return true;
        return new Date(e.data_empenho).getFullYear() === ano;
      });
    }

    empList.forEach((e) => {
      const d = String(e.dimensao || 'NÃO INFORMADA').trim();
      const curr = dimMap.get(d) || { planejado: 0, empenhado: 0, liquidado: 0 };
      curr.empenhado += Number(e.valor || 0);
      curr.liquidado += Number(e.valor_liquidado_oficial ?? e.valor_liquidado ?? 0);
      dimMap.set(d, curr);
    });

    const totalGeralEmpenhado = Array.from(dimMap.values()).reduce((acc, v) => acc + v.empenhado, 0);

    return Array.from(dimMap.entries())
      .map(([dimensao, stats]) => ({
        dimensao,
        planejado: Number(stats.planejado.toFixed(2)),
        empenhado: Number(stats.empenhado.toFixed(2)),
        liquidado: Number(stats.liquidado.toFixed(2)),
        saldo: Number((stats.planejado - stats.empenhado).toFixed(2)),
        percentual: totalGeralEmpenhado > 0 ? Number(((stats.empenhado / totalGeralEmpenhado) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.empenhado - a.empenhado);
  }

  /**
   * Ranking das maiores naturezas de despesa por volume empenhado
   */
  async getTopNaturezasDespesa(limit = 10): Promise<NaturezaDespesaAgrupada[]> {
    const { data: empenhos } = await this.client
      .from('empenhos')
      .select('natureza_despesa, valor, status, tipo')
      .eq('status', 'pendente')
      .or('tipo.eq.exercicio,tipo.is.null');

    const ndMap = new Map<string, number>();
    let total = 0;

    (empenhos || []).forEach((e) => {
      const nd = String(e.natureza_despesa || 'OUTRAS').trim();
      const v = Number(e.valor || 0);
      ndMap.set(nd, (ndMap.get(nd) || 0) + v);
      total += v;
    });

    return Array.from(ndMap.entries())
      .map(([codigo, empenhado]) => ({
        codigo,
        empenhado: Number(empenhado.toFixed(2)),
        percentual: total > 0 ? Number(((empenhado / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.empenhado - a.empenhado)
      .slice(0, limit);
  }
}
