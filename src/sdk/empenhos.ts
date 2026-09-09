import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EmpenhoDetalhadoResult,
  OperacaoEmpenhoDetalhe,
  PesquisaEmpenhoParams,
  RapConsolidadoResult,
} from './types';

export class EmpenhosModule {
  constructor(private client: SupabaseClient) {}

  /**
   * Busca os detalhes completos de um empenho pelo número (ex: 2026NE000072) ou ID
   */
  async getEmpenhoDetalhado(numeroOuId: string): Promise<EmpenhoDetalhadoResult> {
    const clean = String(numeroOuId).trim();

    let query = this.client.from('empenhos').select('*');
    if (clean.includes('NE') || /^\d{4}NE\d+$/i.test(clean)) {
      query = query.ilike('numero', clean);
    } else {
      query = query.or(`numero.ilike.${clean},id.eq.${clean}`);
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error(`Erro ao buscar empenho ${clean}: ${error.message}`);
    if (!data) throw new Error(`Empenho "${clean}" não encontrado.`);

    const valor = Number(data.valor || 0);
    const valorLiquidado = Number(data.valor_liquidado_oficial ?? data.valor_liquidado ?? 0);
    const valorPago = Number(data.valor_pago_oficial ?? 0);
    const saldoALiquidar = Math.max(0, valor - valorLiquidado);
    const saldoAPagar = Math.max(0, valorLiquidado - valorPago);

    let historicoOperacoes: OperacaoEmpenhoDetalhe[] = [];
    if (Array.isArray(data.historico_operacoes)) {
      historicoOperacoes = data.historico_operacoes.map((op: any) => ({
        data: String(op.data || op.data_emissao || ''),
        operacao: String(op.operacao || op.descricao || 'Operação'),
        quantidade: Number(op.quantidade || 1),
        valorUnitario: Number(op.valor_unitario || op.valor || 0),
        valorTotal: Number(op.valor_total || op.valor || 0),
      }));
    }

    return {
      id: String(data.id),
      numero: String(data.numero),
      descricao: String(data.descricao || ''),
      valor: Number(valor.toFixed(2)),
      status: String(data.status || 'pendente'),
      tipo: data.tipo === 'rap' ? 'rap' : 'exercicio',
      dataEmpenho: String(data.data_empenho || data.created_at || ''),
      processo: data.processo || undefined,
      favorecidoNome: data.favorecido_nome || undefined,
      favorecidoDocumento: data.favorecido_documento || undefined,
      origemRecurso: String(data.origem_recurso || ''),
      planoInterno: data.plano_interno || undefined,
      naturezaDespesa: String(data.natureza_despesa || ''),
      dimensao: data.dimensao || undefined,
      componenteFuncional: data.componente_funcional || undefined,
      valorLiquidado: Number(valorLiquidado.toFixed(2)),
      valorPago: Number(valorPago.toFixed(2)),
      saldoALiquidar: Number(saldoALiquidar.toFixed(2)),
      saldoAPagar: Number(saldoAPagar.toFixed(2)),
      saldoRapOficial: data.saldo_rap_oficial != null ? Number(data.saldo_rap_oficial) : undefined,
      historicoOperacoes,
    };
  }

  /**
   * Pesquisa avançada de empenhos por múltiplos critérios
   */
  async pesquisarEmpenhos(criterios: PesquisaEmpenhoParams): Promise<EmpenhoDetalhadoResult[]> {
    let query = this.client
      .from('empenhos')
      .select('id, numero, descricao, valor, status, tipo, data_empenho, processo, favorecido_nome, favorecido_documento, origem_recurso, plano_interno, natureza_despesa, dimensao, componente_funcional, valor_liquidado_oficial, valor_liquidado, valor_pago_oficial, saldo_rap_oficial')
      .order('data_empenho', { ascending: false, nullsFirst: false });

    if (criterios.ptres) query = query.eq('origem_recurso', criterios.ptres.trim());
    if (criterios.planoInterno) query = query.eq('plano_interno', criterios.planoInterno.trim());
    if (criterios.naturezaDespesa) query = query.eq('natureza_despesa', criterios.naturezaDespesa.trim());
    if (criterios.processo) query = query.ilike('processo', `%${criterios.processo.trim()}%`);
    if (criterios.tipo && criterios.tipo !== 'todos') query = query.eq('tipo', criterios.tipo);
    if (criterios.status && criterios.status !== 'todos') query = query.eq('status', criterios.status);

    if (criterios.limit) query = query.limit(criterios.limit);
    else query = query.limit(100);

    if (criterios.offset) query = query.range(criterios.offset, criterios.offset + (criterios.limit || 100) - 1);

    const { data: rows, error } = await query;
    if (error) throw new Error(`Erro ao pesquisar empenhos: ${error.message}`);

    let list = rows || [];

    if (criterios.favorecido) {
      const fav = criterios.favorecido.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.favorecido_nome || '').toLowerCase().includes(fav) ||
          String(r.favorecido_documento || '').includes(fav)
      );
    }

    if (criterios.termoBusca) {
      const termo = criterios.termoBusca.toLowerCase();
      list = list.filter(
        (r) =>
          String(r.numero || '').toLowerCase().includes(termo) ||
          String(r.descricao || '').toLowerCase().includes(termo) ||
          String(r.favorecido_nome || '').toLowerCase().includes(termo) ||
          String(r.processo || '').toLowerCase().includes(termo)
      );
    }

    if (criterios.ano) {
      list = list.filter((r) => {
        if (!r.data_empenho) return true;
        return new Date(r.data_empenho).getFullYear() === criterios.ano;
      });
    }

    return list.map((r) => {
      const valor = Number(r.valor || 0);
      const valorLiquidado = Number(r.valor_liquidado_oficial ?? r.valor_liquidado ?? 0);
      const valorPago = Number(r.valor_pago_oficial ?? 0);
      return {
        id: String(r.id),
        numero: String(r.numero),
        descricao: String(r.descricao || ''),
        valor: Number(valor.toFixed(2)),
        status: String(r.status || 'pendente'),
        tipo: r.tipo === 'rap' ? 'rap' : 'exercicio',
        dataEmpenho: String(r.data_empenho || ''),
        processo: r.processo || undefined,
        favorecidoNome: r.favorecido_nome || undefined,
        favorecidoDocumento: r.favorecido_documento || undefined,
        origemRecurso: String(r.origem_recurso || ''),
        planoInterno: r.plano_interno || undefined,
        naturezaDespesa: String(r.natureza_despesa || ''),
        dimensao: r.dimensao || undefined,
        componenteFuncional: r.componente_funcional || undefined,
        valorLiquidado: Number(valorLiquidado.toFixed(2)),
        valorPago: Number(valorPago.toFixed(2)),
        saldoALiquidar: Number(Math.max(0, valor - valorLiquidado).toFixed(2)),
        saldoAPagar: Number(Math.max(0, valorLiquidado - valorPago).toFixed(2)),
        saldoRapOficial: r.saldo_rap_oficial != null ? Number(r.saldo_rap_oficial) : undefined,
        historicoOperacoes: [],
      };
    });
  }

  /**
   * Consolida a posição de Restos a Pagar (RAP) do exercício
   */
  async getRapPosicaoConsolidada(anoExercicio = new Date().getFullYear()): Promise<RapConsolidadoResult> {
    const { data: empenhosRap, error } = await this.client
      .from('empenhos')
      .select('valor, valor_liquidado_oficial, valor_pago_oficial, saldo_rap_oficial, rap_inscrito, rap_a_liquidar, rap_liquidado, rap_pago')
      .eq('tipo', 'rap');

    if (error) throw new Error(`Erro ao consultar Restos a Pagar: ${error.message}`);

    const list = empenhosRap || [];
    const rapInscritoTotal = list.reduce((acc, e) => acc + Number(e.rap_inscrito ?? e.valor ?? 0), 0);
    const rapALiquidarTotal = list.reduce((acc, e) => acc + Number(e.rap_a_liquidar ?? 0), 0);
    const rapLiquidadoTotal = list.reduce((acc, e) => acc + Number(e.rap_liquidado ?? e.valor_liquidado_oficial ?? 0), 0);
    const rapPagoTotal = list.reduce((acc, e) => acc + Number(e.rap_pago ?? e.valor_pago_oficial ?? 0), 0);
    const rapSaldoAtualTotal = list.reduce(
      (acc, e) => acc + Number(e.saldo_rap_oficial ?? Math.max(0, Number(e.valor || 0) - Number(e.valor_pago_oficial || 0))),
      0
    );

    return {
      anoExercicio,
      rapInscritoTotal: Number(rapInscritoTotal.toFixed(2)),
      rapALiquidarTotal: Number(rapALiquidarTotal.toFixed(2)),
      rapLiquidadoTotal: Number(rapLiquidadoTotal.toFixed(2)),
      rapPagoTotal: Number(rapPagoTotal.toFixed(2)),
      rapSaldoAtualTotal: Number(rapSaldoAtualTotal.toFixed(2)),
      quantidadeEmpenhos: list.length,
    };
  }

  /**
   * Identifica empenhos paralisados sem movimentação recente
   */
  async identificarEmpenhosParalisados(diasSemMovimentacao = 60): Promise<Array<{
    numero: string;
    favorecido?: string;
    valor: number;
    saldoALiquidar: number;
    dataEmpenho: string;
    diasSemMovimentacao: number;
    motivo: string;
  }>> {
    const { data, error } = await this.client
      .from('empenhos')
      .select('numero, favorecido_nome, valor, valor_liquidado_oficial, valor_liquidado, valor_pago_oficial, data_empenho, status, tipo')
      .eq('status', 'pendente')
      .or('tipo.eq.exercicio,tipo.is.null');

    if (error) throw new Error(`Erro ao buscar empenhos paralisados: ${error.message}`);

    const now = new Date().getTime();
    const thresholdMs = diasSemMovimentacao * 24 * 60 * 60 * 1000;

    const result: Array<{
      numero: string;
      favorecido?: string;
      valor: number;
      saldoALiquidar: number;
      dataEmpenho: string;
      diasSemMovimentacao: number;
      motivo: string;
    }> = [];

    (data || []).forEach((e) => {
      const valor = Number(e.valor || 0);
      const liq = Number(e.valor_liquidado_oficial ?? e.valor_liquidado ?? 0);
      const saldo = Math.max(0, valor - liq);
      if (saldo <= 0) return;

      if (!e.data_empenho) return;
      const empenhoTime = new Date(e.data_empenho).getTime();
      const diffMs = now - empenhoTime;

      if (diffMs > thresholdMs) {
        const dias = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        result.push({
          numero: String(e.numero),
          favorecido: e.favorecido_nome || undefined,
          valor: Number(valor.toFixed(2)),
          saldoALiquidar: Number(saldo.toFixed(2)),
          dataEmpenho: String(e.data_empenho),
          diasSemMovimentacao: dias,
          motivo: `Empenho emitido há ${dias} dias com saldo de R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem liquidação total.`,
        });
      }
    });

    return result.sort((a, b) => b.diasSemMovimentacao - a.diasSemMovimentacao);
  }
}
