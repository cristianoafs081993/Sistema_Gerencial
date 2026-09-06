import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtratoDescentralizacaoResult, NotaCreditoDetalhe } from './types';

export class DescentralizacoesModule {
  constructor(private client: SupabaseClient) {}

  /**
   * Retorna o extrato analítico de Notas de Crédito de um PTRES / Plano Interno
   */
  async getExtratoNotasCredito(ptres: string, planoInterno?: string): Promise<ExtratoDescentralizacaoResult> {
    const cleanPtres = String(ptres).trim();

    let query = this.client
      .from('descentralizacoes')
      .select('id, nota_credito, operacao_tipo, origem_recurso, plano_interno, natureza_despesa, dimensao, data_emissao, descricao, valor')
      .eq('origem_recurso', cleanPtres)
      .order('data_emissao', { ascending: false, nullsFirst: false });

    if (planoInterno) {
      query = query.eq('plano_interno', planoInterno.trim());
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(`Erro ao buscar descentralizações do PTRES ${cleanPtres}: ${error.message}`);

    const list = rows || [];
    let totalCreditoRecebido = 0;
    let totalEstornadoOuDevolvido = 0;

    const notasCredito: NotaCreditoDetalhe[] = list.map((r) => {
      const v = Number(r.valor || 0);
      const opTipo = String(r.operacao_tipo || '').toUpperCase();
      const isEstorno = opTipo.includes('ANULACAO') || opTipo.includes('ESTORNO');
      const isCredito = !isEstorno;

      if (isCredito) {
        totalCreditoRecebido += v;
      } else {
        totalEstornadoOuDevolvido += v;
      }

      return {
        id: String(r.id),
        notaCredito: String(r.nota_credito || ''),
        operacaoTipo: String(r.operacao_tipo || 'DESCENTRALIZACAO DE CREDITO'),
        origemRecurso: String(r.origem_recurso || ''),
        planoInterno: String(r.plano_interno || ''),
        naturezaDespesa: String(r.natureza_despesa || ''),
        dimensao: String(r.dimensao || ''),
        dataEmissao: String(r.data_emissao || ''),
        descricao: String(r.descricao || ''),
        valor: Number(v.toFixed(2)),
        isCredito,
        isEstorno,
      };
    });

    const totalLiquidoDescentralizado = totalCreditoRecebido - totalEstornadoOuDevolvido;

    return {
      ptres: cleanPtres,
      totalCreditoRecebido: Number(totalCreditoRecebido.toFixed(2)),
      totalEstornadoOuDevolvido: Number(totalEstornadoOuDevolvido.toFixed(2)),
      totalLiquidoDescentralizado: Number(totalLiquidoDescentralizado.toFixed(2)),
      quantidadeOperacoes: notasCredito.length,
      notasCredito,
    };
  }

  /**
   * Consulta os saldos contábeis oficiais importados do SIAFI (tabela creditos_disponiveis)
   */
  async getSaldosContabeisSiafi(ptres?: string): Promise<Array<{
    ptres: string;
    metrica: string;
    valor: number;
    updatedAt?: string;
  }>> {
    let query = this.client
      .from('creditos_disponiveis')
      .select('ptres, metrica, valor, updated_at')
      .order('updated_at', { ascending: false });

    if (ptres) {
      query = query.eq('ptres', ptres.trim());
    }

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar créditos disponíveis no SIAFI: ${error.message}`);

    return (data || []).map((r) => ({
      ptres: String(r.ptres || ''),
      metrica: String(r.metrica || ''),
      valor: Number(Number(r.valor || 0).toFixed(2)),
      updatedAt: r.updated_at || undefined,
    }));
  }

  /**
   * Identifica créditos recebidos que ainda possuem saldo livre não empenhado
   */
  async listarDescentralizacoesSemEmpenho(ptres?: string): Promise<Array<{
    ptres: string;
    planoInterno: string;
    valorLiquidoRecebido: number;
    valorEmpenhado: number;
    saldoLivreDisponivel: number;
  }>> {
    let queryDesc = this.client
      .from('descentralizacoes')
      .select('origem_recurso, plano_interno, valor, operacao_tipo');
    let queryEmp = this.client
      .from('empenhos')
      .select('origem_recurso, plano_interno, valor, status, tipo');

    if (ptres) {
      queryDesc = queryDesc.eq('origem_recurso', ptres.trim());
      queryEmp = queryEmp.eq('origem_recurso', ptres.trim());
    }

    const [{ data: descList }, { data: empList }] = await Promise.all([queryDesc, queryEmp]);

    const piMap = new Map<string, { ptres: string; pi: string; creditos: number; empenhos: number }>();

    (descList || []).forEach((d) => {
      const p = String(d.origem_recurso || '').trim();
      const pi = String(d.plano_interno || 'SEM_PI').trim();
      const key = `${p}::${pi}`;
      const v = Number(d.valor || 0);
      const isEstorno = String(d.operacao_tipo || '').toUpperCase().includes('ANULACAO') ||
                        String(d.operacao_tipo || '').toUpperCase().includes('ESTORNO');

      const curr = piMap.get(key) || { ptres: p, pi, creditos: 0, empenhos: 0 };
      curr.creditos += isEstorno ? -v : v;
      piMap.set(key, curr);
    });

    (empList || []).forEach((e) => {
      if (e.status === 'cancelado' || e.tipo === 'rap') return;
      const p = String(e.origem_recurso || '').trim();
      const pi = String(e.plano_interno || 'SEM_PI').trim();
      const key = `${p}::${pi}`;
      const v = Number(e.valor || 0);

      const curr = piMap.get(key) || { ptres: p, pi, creditos: 0, empenhos: 0 };
      curr.empenhos += v;
      piMap.set(key, curr);
    });

    const result: Array<{
      ptres: string;
      planoInterno: string;
      valorLiquidoRecebido: number;
      valorEmpenhado: number;
      saldoLivreDisponivel: number;
    }> = [];

    piMap.forEach((val) => {
      const saldo = val.creditos - val.empenhos;
      if (saldo > 0.05) {
        result.push({
          ptres: val.ptres,
          planoInterno: val.pi,
          valorLiquidoRecebido: Number(val.creditos.toFixed(2)),
          valorEmpenhado: Number(val.empenhos.toFixed(2)),
          saldoLivreDisponivel: Number(saldo.toFixed(2)),
        });
      }
    });

    return result.sort((a, b) => b.saldoLivreDisponivel - a.saldoLivreDisponivel);
  }
}
