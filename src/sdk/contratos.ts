import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContratoEmpenhoVinculado,
  ContratoFaturaDetalhe,
  FichaContratoResult,
  ProjecaoContratualResult,
  TermoAditivoDetalhe,
} from './types';

export class ContratosModule {
  constructor(private client: SupabaseClient) {}

  /**
   * Retorna a ficha cadastral e financeira consolidada de um contrato
   */
  async getFichaContrato(numeroOuId: string): Promise<FichaContratoResult> {
    const clean = String(numeroOuId).trim();

    // 1. Tenta buscar em contratos_api (sincronizado do Comprasnet / PNCP)
    let queryApi = this.client.from('contratos_api').select('*');
    if (/^\d+$/.test(clean)) {
      queryApi = queryApi.or(`id.eq.${clean},api_contrato_id.eq.${clean},numero.eq.${clean}`);
    } else {
      queryApi = queryApi.or(`numero.ilike.%${clean}%,id.eq.${clean}`);
    }

    const { data: apiData } = await queryApi.limit(1).maybeSingle();

    if (apiData) {
      return this.buildFichaFromContratoApi(apiData);
    }

    // 2. Fallback para tabela contratos (manual)
    let queryManual = this.client.from('contratos').select('*');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
      queryManual = queryManual.eq('id', clean);
    } else {
      queryManual = queryManual.ilike('numero', `%${clean}%`);
    }

    const { data: manualData, error: manualErr } = await queryManual.limit(1).maybeSingle();
    if (manualErr) throw new Error(`Erro ao buscar contrato: ${manualErr.message}`);
    if (!manualData) throw new Error(`Contrato "${clean}" não encontrado nas bases oficiais ou manuais.`);

    return this.buildFichaFromContratoManual(manualData);
  }

  private async buildFichaFromContratoApi(row: any): Promise<FichaContratoResult> {
    const contratoApiId = row.id;
    const unidadeCodigo = String(row.unidade_codigo || '');
    const isCampus = unidadeCodigo === '158366';

    const [{ data: empenhosRows }, { data: faturasRows }] = await Promise.all([
      this.client.from('contratos_api_empenhos').select('*').eq('contrato_api_id', contratoApiId),
      this.client.from('contratos_api_faturas').select('*').eq('contrato_api_id', contratoApiId),
    ]);

    const empenhosList = empenhosRows || [];
    const faturasList = faturasRows || [];

    const totalEmpenhadoVinculado = empenhosList.reduce((acc, e) => acc + Number(e.valor_empenhado || 0), 0);
    const totalLiquidadoEmpenhos = empenhosList.reduce((acc, e) => acc + Number(e.valor_liquidado || 0), 0);
    const saldoEmpenhosVinculados = Math.max(0, totalEmpenhadoVinculado - totalLiquidadoEmpenhos);

    const totalFaturado = faturasList.reduce((acc, f) => acc + Number(f.valor_bruto || 0), 0);
    const totalLiquidado = faturasList.reduce((acc, f) => {
      const isLiq = f.situacao === 'LIQUIDADA' || f.situacao === 'PAGA' || Boolean(f.data_liquidacao);
      return isLiq ? acc + Number(f.valor_liquido || f.valor_bruto || 0) : acc;
    }, 0);
    const totalPago = faturasList.reduce((acc, f) => {
      const isPago = f.situacao === 'PAGA' || Boolean(f.data_pagamento);
      return isPago ? acc + Number(f.valor_liquido || f.valor_bruto || 0) : acc;
    }, 0);

    const vigFim = row.vigencia_fim_derivada || row.vigencia_fim;
    let diasParaVencer: number | null = null;
    if (vigFim) {
      const diffMs = new Date(vigFim).getTime() - new Date().getTime();
      diasParaVencer = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    }

    return {
      id: String(row.id),
      numero: String(row.numero),
      contratada: String(row.fornecedor_nome || ''),
      cnpj: row.fornecedor_cnpj_cpf_idgener || undefined,
      objeto: String(row.objeto || ''),
      situacao: String(row.situacao || ''),
      situacaoDerivada: (row.situacao_derivada as any) || (diasParaVencer !== null && diasParaVencer < 0 ? 'vencido' : 'ativo'),
      situacaoDerivadaMotivo: row.situacao_derivada_motivo || undefined,
      vigenciaInicio: row.vigencia_inicio || null,
      vigenciaFim: row.vigencia_fim || null,
      vigenciaFimDerivada: vigFim || null,
      diasParaVencer,
      valorInicial: Number(Number(row.valor_inicial || 0).toFixed(2)),
      valorGlobal: Number(Number(row.valor_global || row.valor_acumulado || 0).toFixed(2)),
      origemUg: unidadeCodigo || '158366',
      isCampusCurraisNovos: isCampus,
      totalEmpenhadoVinculado: Number(totalEmpenhadoVinculado.toFixed(2)),
      saldoEmpenhosVinculados: Number(saldoEmpenhosVinculados.toFixed(2)),
      totalFaturado: Number(totalFaturado.toFixed(2)),
      totalLiquidado: Number(totalLiquidado.toFixed(2)),
      totalPago: Number(totalPago.toFixed(2)),
    };
  }

  private async buildFichaFromContratoManual(row: any): Promise<FichaContratoResult> {
    const contratoId = row.id;

    const { data: vinculos } = await this.client
      .from('contratos_empenhos')
      .select('empenho_id')
      .eq('contrato_id', contratoId);

    let totalEmpenhado = 0;
    let saldoEmpenho = 0;

    if (vinculos && vinculos.length > 0) {
      const ids = vinculos.map((v) => v.empenho_id);
      const { data: emps } = await this.client
        .from('empenhos')
        .select('valor, valor_liquidado_oficial, valor_liquidado')
        .in('id', ids);

      (emps || []).forEach((e) => {
        const v = Number(e.valor || 0);
        const liq = Number(e.valor_liquidado_oficial ?? e.valor_liquidado ?? 0);
        totalEmpenhado += v;
        saldoEmpenho += Math.max(0, v - liq);
      });
    }

    const vigFim = row.data_termino;
    let diasParaVencer: number | null = null;
    if (vigFim) {
      const diffMs = new Date(vigFim).getTime() - new Date().getTime();
      diasParaVencer = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    }

    return {
      id: String(row.id),
      numero: String(row.numero),
      contratada: String(row.contratada || ''),
      objeto: 'Contrato manual cadastrado no sistema',
      situacao: diasParaVencer !== null && diasParaVencer < 0 ? 'Vencido' : 'Ativo',
      situacaoDerivada: diasParaVencer !== null && diasParaVencer < 0 ? 'vencido' : 'ativo',
      vigenciaInicio: row.data_inicio || null,
      vigenciaFim: row.data_termino || null,
      vigenciaFimDerivada: row.data_termino || null,
      diasParaVencer,
      valorInicial: Number(Number(row.valor || 0).toFixed(2)),
      valorGlobal: Number(Number(row.valor || 0).toFixed(2)),
      origemUg: '158366',
      isCampusCurraisNovos: true,
      totalEmpenhadoVinculado: Number(totalEmpenhado.toFixed(2)),
      saldoEmpenhosVinculados: Number(saldoEmpenho.toFixed(2)),
      totalFaturado: 0,
      totalLiquidado: 0,
      totalPago: 0,
    };
  }

  /**
   * Retorna os termos aditivos e histórico de alterações contratuais
   */
  async getHistoricoTermosAditivos(contratoId: string): Promise<TermoAditivoDetalhe[]> {
    const cleanId = String(contratoId).trim();

    const { data: rows, error } = await this.client
      .from('contratos_api_historico')
      .select('*')
      .eq('contrato_api_id', cleanId)
      .order('data_assinatura', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`Erro ao buscar aditivos do contrato: ${error.message}`);

    return (rows || []).map((r) => ({
      id: String(r.id),
      numero: String(r.numero || ''),
      tipo: String(r.tipo || ''),
      qualificacaoTermo: r.qualificacao_termo || undefined,
      dataAssinatura: r.data_assinatura || undefined,
      vigenciaInicio: r.vigencia_inicio || undefined,
      vigenciaFim: r.vigencia_fim || undefined,
      valorGlobal: r.valor_global != null ? Number(r.valor_global) : undefined,
      novoValorGlobal: r.novo_valor_global != null ? Number(r.novo_valor_global) : undefined,
      observacao: r.observacao || undefined,
    }));
  }

  /**
   * Retorna todos os empenhos vinculados a um contrato com a posição financeira atualizada
   */
  async getEmpenhosVinculadosContrato(contratoId: string): Promise<ContratoEmpenhoVinculado[]> {
    const cleanId = String(contratoId).trim();

    const { data: vinculos, error } = await this.client
      .from('contratos_api_empenhos')
      .select('*')
      .eq('contrato_api_id', cleanId);

    if (error) throw new Error(`Erro ao consultar empenhos do contrato: ${error.message}`);

    const list = vinculos || [];
    if (list.length === 0) return [];

    const numerosNE = list.map((v) => String(v.numero || '').trim()).filter(Boolean);

    const { data: empenhosFull } = await this.client
      .from('empenhos')
      .select('numero, origem_recurso, plano_interno, natureza_despesa, valor, valor_liquidado_oficial, valor_liquidado, valor_pago_oficial, tipo')
      .in('numero', numerosNE);

    const empMap = new Map<string, any>();
    (empenhosFull || []).forEach((e) => empMap.set(e.numero, e));

    return list.map((v) => {
      const num = String(v.numero || '');
      const full = empMap.get(num);

      const valorOriginal = full ? Number(full.valor || 0) : Number(v.valor_empenhado || 0);
      const valorLiquidado = full
        ? Number(full.valor_liquidado_oficial ?? full.valor_liquidado ?? 0)
        : Number(v.valor_liquidado || 0);
      const valorPago = full ? Number(full.valor_pago_oficial ?? 0) : Number(v.valor_pago || 0);
      const saldoDisponivel = Math.max(0, valorOriginal - valorLiquidado);

      return {
        empenhoNumero: num,
        origemRecurso: full?.origem_recurso || 'N/A',
        planoInterno: full?.plano_interno || undefined,
        naturezaDespesa: full?.natureza_despesa || undefined,
        valorOriginal: Number(valorOriginal.toFixed(2)),
        valorLiquidado: Number(valorLiquidado.toFixed(2)),
        valorPago: Number(valorPago.toFixed(2)),
        saldoDisponivel: Number(saldoDisponivel.toFixed(2)),
        tipo: full?.tipo === 'rap' ? 'rap' : 'exercicio',
      };
    });
  }

  /**
   * Retorna as faturas, liquidações e atestes do contrato
   */
  async getFaturasELiquidacoesContrato(contratoId: string): Promise<ContratoFaturaDetalhe[]> {
    const cleanId = String(contratoId).trim();

    const { data: rows, error } = await this.client
      .from('contratos_api_faturas')
      .select('*')
      .eq('contrato_api_id', cleanId)
      .order('data_emissao', { ascending: false, nullsFirst: false });

    if (error) throw new Error(`Erro ao buscar faturas do contrato: ${error.message}`);

    return (rows || []).map((r) => ({
      id: r.id,
      numeroInstrumento: String(r.numero_instrumento_cobranca || r.fatura_id || ''),
      dataEmissao: String(r.data_emissao || ''),
      dataVencimento: r.data_vencimento || undefined,
      dataLiquidacao: r.data_liquidacao || undefined,
      dataPagamento: r.data_pagamento || undefined,
      situacao: String(r.situacao || ''),
      valorBruto: Number(Number(r.valor_bruto || 0).toFixed(2)),
      valorLiquido: Number(Number(r.valor_liquido || r.valor_bruto || 0).toFixed(2)),
      processo: r.processo || undefined,
      empenhosUtilizados: Array.isArray(r.fatura_empenhos)
        ? r.fatura_empenhos.map((fe: any) => String(fe.empenho_numero || fe))
        : [],
    }));
  }

  /**
   * Projeta a necessidade orçamentária do contrato até o fim do exercício e vigência
   */
  async projetarExecucaoContratual(contratoId: string, anoExercicio = new Date().getFullYear()): Promise<ProjecaoContratualResult> {
    const ficha = await this.getFichaContrato(contratoId);
    const faturas = await this.getFaturasELiquidacoesContrato(contratoId);

    // Calcula valor mensal médio baseado nas faturas recentes ou no valor global dividido por 12
    let valorMensalMedio = 0;
    const faturasValidas = faturas.filter((f) => f.valorBruto > 0);

    if (faturasValidas.length >= 2) {
      const soma = faturasValidas.slice(0, 6).reduce((acc, f) => acc + f.valorBruto, 0);
      valorMensalMedio = soma / Math.min(6, faturasValidas.length);
    } else if (ficha.valorGlobal > 0) {
      valorMensalMedio = ficha.valorGlobal / 12;
    }

    const now = new Date();
    const currentMonth = now.getFullYear() === anoExercicio ? now.getMonth() + 1 : 1;
    const mesesRestantesExercicio = Math.max(0, 12 - currentMonth + 1);

    let mesesRestantesVigencia = mesesRestantesExercicio;
    if (ficha.vigenciaFimDerivada) {
      const endVig = new Date(ficha.vigenciaFimDerivada);
      const diffMs = endVig.getTime() - now.getTime();
      const dias = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      mesesRestantesVigencia = Math.max(0, Number((dias / 30.4).toFixed(1)));
    }

    const mesesExercicioCalculo = Math.min(mesesRestantesExercicio, Math.ceil(mesesRestantesVigencia));
    const necessidadeAteFimExercicio = valorMensalMedio * mesesExercicioCalculo;
    const necessidadeAteFimVigencia = valorMensalMedio * mesesRestantesVigencia;

    const saldoEmpenhosAtuais = ficha.saldoEmpenhosVinculados;
    const deficitOuSuperavitExercicio = saldoEmpenhosAtuais - necessidadeAteFimExercicio;
    const requerReforcoExercicio = deficitOuSuperavitExercicio < 0;
    const valorReforcoEstimado = requerReforcoExercicio ? Math.abs(deficitOuSuperavitExercicio) : 0;

    const alertas: string[] = [];
    if (requerReforcoExercicio) {
      alertas.push(
        `Alerta de Insuficiência: O saldo atual empenhado (R$ ${saldoEmpenhosAtuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é insuficiente para cobrir as parcelas estimadas até dezembro. Necessidade de reforço estimada em R$ ${valorReforcoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      );
    }
    if (ficha.diasParaVencer !== null && ficha.diasParaVencer <= 90 && ficha.diasParaVencer > 0) {
      alertas.push(`Atenção à vigência: Contrato expira em ${ficha.diasParaVencer} dias. Inicie o processo de prorrogação ou nova licitação.`);
    }

    return {
      contratoId: ficha.id,
      contratoNumero: ficha.numero,
      valorMensalMedio: Number(valorMensalMedio.toFixed(2)),
      mesesRestantesExercicio,
      mesesRestantesVigencia,
      necessidadeAteFimExercicio: Number(necessidadeAteFimExercicio.toFixed(2)),
      necessidadeAteFimVigencia: Number(necessidadeAteFimVigencia.toFixed(2)),
      saldoEmpenhosAtuais: Number(saldoEmpenhosAtuais.toFixed(2)),
      deficitOuSuperavitExercicio: Number(deficitOuSuperavitExercicio.toFixed(2)),
      requerReforcoExercicio,
      valorReforcoEstimado: Number(valorReforcoEstimado.toFixed(2)),
      alertas,
    };
  }
}
