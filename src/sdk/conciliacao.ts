import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AuditoriaSaudeResult,
  ConciliacaoPlanoInternoItem,
  ConciliacaoPtresResult,
  TrilhaDespesaResult,
} from './types';

export class ConciliacaoModule {
  constructor(private client: SupabaseClient) {}

  /**
   * Executa a conciliação trilateral completa de um PTRES:
   * Descentralizações (SIAFI) <--> Atividades Planejadas (SUAP) <--> Empenhos Emitidos (SIAFI)
   */
  async conciliarPtresCompleto(ptres: string): Promise<ConciliacaoPtresResult> {
    const cleanPtres = String(ptres).trim();

    const [
      { data: atividades, error: errAtiv },
      { data: descentralizacoes, error: errDesc },
      { data: empenhos, error: errEmp },
    ] = await Promise.all([
      this.client
        .from('atividades')
        .select('id, atividade, descricao, valor_total, saldo_disponivel, plano_interno, natureza_despesa')
        .eq('origem_recurso', cleanPtres),
      this.client
        .from('descentralizacoes')
        .select('id, nota_credito, operacao_tipo, plano_interno, valor, data_emissao, descricao')
        .eq('origem_recurso', cleanPtres),
      this.client
        .from('empenhos')
        .select('id, numero, descricao, valor, valor_liquidado_oficial, valor_liquidado, status, tipo, plano_interno, processo, favorecido_nome')
        .eq('origem_recurso', cleanPtres),
    ]);

    if (errAtiv) throw new Error(`Erro ao buscar atividades do PTRES ${cleanPtres}: ${errAtiv.message}`);
    if (errDesc) throw new Error(`Erro ao buscar descentralizações do PTRES ${cleanPtres}: ${errDesc.message}`);
    if (errEmp) throw new Error(`Erro ao buscar empenhos do PTRES ${cleanPtres}: ${errEmp.message}`);

    const ativList = atividades || [];
    const descList = descentralizacoes || [];
    const empList = (empenhos || []).filter(
      (e) => e.status !== 'cancelado' && (e.tipo === 'exercicio' || !e.tipo)
    );

    // Mapeamento por Plano Interno (PI)
    const piSet = new Set<string>();
    ativList.forEach((a) => piSet.add(String(a.plano_interno || 'SEM_PI').trim()));
    descList.forEach((d) => piSet.add(String(d.plano_interno || 'SEM_PI').trim()));
    empList.forEach((e) => piSet.add(String(e.plano_interno || 'SEM_PI').trim()));

    const planosInternos: ConciliacaoPlanoInternoItem[] = [];

    let totalPlanejadoGeral = 0;
    let totalDescentralizadoGeral = 0;
    let totalEmpenhadoGeral = 0;

    const atividadesComSaldo: ConciliacaoPtresResult['atividadesComSaldo'] = [];
    const empenhosSemAtividade: ConciliacaoPtresResult['empenhosSemAtividadePlanejada'] = [];

    for (const pi of Array.from(piSet).sort()) {
      const ativPi = ativList.filter((a) => String(a.plano_interno || 'SEM_PI').trim() === pi);
      const descPi = descList.filter((d) => String(d.plano_interno || 'SEM_PI').trim() === pi);
      const empPi = empList.filter((e) => String(e.plano_interno || 'SEM_PI').trim() === pi);

      const planejado = ativPi.reduce((acc, a) => acc + Number(a.valor_total || 0), 0);

      const descentralizado = descPi.reduce((acc, d) => {
        const v = Number(d.valor || 0);
        const isEstorno = String(d.operacao_tipo || '').toUpperCase().includes('ANULACAO') ||
                          String(d.operacao_tipo || '').toUpperCase().includes('ESTORNO');
        return isEstorno ? acc - v : acc + v;
      }, 0);

      const empenhado = empPi.reduce((acc, e) => acc + Number(e.valor || 0), 0);

      totalPlanejadoGeral += planejado;
      totalDescentralizadoGeral += descentralizado;
      totalEmpenhadoGeral += empenhado;

      const saldoSuap = planejado - empenhado;
      const saldoRealSiafi = descentralizado - empenhado;

      const obs: string[] = [];
      let statusPi: ConciliacaoPlanoInternoItem['status'] = 'equilibrado';

      if (planejado === 0 && empenhado > 0) {
        statusPi = 'sem_planejamento';
        obs.push(`Existem R$ ${empenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} empenhados sem nenhuma atividade planejada no SUAP.`);
        empPi.forEach((e) => {
          empenhosSemAtividade.push({
            numero: String(e.numero),
            descricao: String(e.descricao || ''),
            planoInterno: pi,
            valor: Number(e.valor || 0),
            processo: e.processo || undefined,
          });
        });
      } else if (saldoSuap < -0.01 && saldoRealSiafi >= 0) {
        statusPi = 'descompasso_planejamento_insuficiente';
        obs.push(
          `Descompasso: Empenhado (R$ ${empenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) supera o Planejado (R$ ${planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}), gerando saldo virtual negativo no SUAP (-R$ ${Math.abs(saldoSuap).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}), porém o saldo SIAFI está regular (+R$ ${saldoRealSiafi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`
        );
        empPi.forEach((e) => {
          empenhosSemAtividade.push({
            numero: String(e.numero),
            descricao: String(e.descricao || ''),
            planoInterno: pi,
            valor: Number(e.valor || 0),
            processo: e.processo || undefined,
          });
        });
      } else if (saldoRealSiafi > 0.01) {
        statusPi = 'saldo_positivo_a_empenhar';
        obs.push(`Saldo disponível para novos empenhos: R$ ${saldoRealSiafi.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
      }

      ativPi.forEach((a) => {
        const valTot = Number(a.valor_total || 0);
        const sDisp = a.saldo_disponivel != null ? Number(a.saldo_disponivel) : valTot;
        if (sDisp > 0.05) {
          atividadesComSaldo.push({
            id: String(a.id),
            atividade: String(a.atividade || ''),
            planoInterno: pi,
            planejado: Number(valTot.toFixed(2)),
            saldoNaoEmpenhado: Number(sDisp.toFixed(2)),
          });
        }
      });

      planosInternos.push({
        planoInterno: pi,
        planejadoSuap: Number(planejado.toFixed(2)),
        descentralizadoSiafi: Number(descentralizado.toFixed(2)),
        empenhadoSiafi: Number(empenhado.toFixed(2)),
        saldoSuap: Number(saldoSuap.toFixed(2)),
        saldoRealSiafi: Number(saldoRealSiafi.toFixed(2)),
        status: statusPi,
        observacoes: obs,
      });
    }

    const saldoPlanejamentoSuap = totalPlanejadoGeral - totalEmpenhadoGeral;
    const saldoRealSiafiGeral = totalDescentralizadoGeral - totalEmpenhadoGeral;

    let situacaoGeral: ConciliacaoPtresResult['resumoGeral']['situacaoGeral'] = 'REGULAR';
    if (saldoRealSiafiGeral < -0.01) {
      situacaoGeral = 'DEFICIT_ORCAMENTARIO';
    } else if (saldoPlanejamentoSuap < -0.01 && saldoRealSiafiGeral >= 0) {
      situacaoGeral = 'DESCOMPASSO_COM_SUAP';
    } else if (saldoRealSiafiGeral > 0.05) {
      situacaoGeral = 'SUPERAVIT_SEM_EMPENHO';
    }

    // Geração do Diagnóstico Textual Forense
    const recomendacoes: string[] = [];
    let diagnosticoTextual = '';

    if (situacaoGeral === 'DESCOMPASSO_COM_SUAP') {
      const valorDivergencia = Math.abs(saldoPlanejamentoSuap);
      diagnosticoTextual = `O PTRES ${cleanPtres} NÃO possui déficit contábil no SIAFI. O saldo real em conta é POSITIVO em R$ ${saldoRealSiafiGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
        `O valor negativo de -R$ ${valorDivergencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} exibido no painel decorre exclusivamente da fórmula gerencial [Planejado SUAP - Empenhado SIAFI]. ` +
        `Foram emitidos empenhos respaldados por Notas de Crédito reais da Reitoria que não possuem atividade cadastrada com valor suficiente no planejamento do SUAP (Plano 8).`;

      recomendacoes.push(
        `Ajustar o Plano 8 no SUAP: Cadastrar ou suplementar a atividade orçamentária para o(s) Plano(s) Interno(s) divergente(s).`,
        `Reconciliar as Notas de Crédito recebidas com as metas do Plano Anual de Trabalho do campus.`
      );
    } else if (situacaoGeral === 'DEFICIT_ORCAMENTARIO') {
      diagnosticoTextual = `ALERTA CRÍTICO: O PTRES ${cleanPtres} possui déficit orçamentário real no SIAFI de R$ ${Math.abs(saldoRealSiafiGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. ` +
        `O total empenhado supera os créditos descentralizados líquidos recebidos.`;
      recomendacoes.push(
        `Solicitar suplementação orçamentária emergencial à Reitoria/PROEN/PROAD.`,
        `Avaliar cancelamento ou anulação de empenhos ociosos vinculados a este PTRES.`
      );
    } else {
      diagnosticoTextual = `A situação orçamentária do PTRES ${cleanPtres} está regular. Saldo contábil no SIAFI de R$ ${saldoRealSiafiGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} e saldo do planejamento de R$ ${saldoPlanejamentoSuap.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
    }

    return {
      ptres: cleanPtres,
      resumoGeral: {
        planejadoSuap: Number(totalPlanejadoGeral.toFixed(2)),
        descentralizadoSiafi: Number(totalDescentralizadoGeral.toFixed(2)),
        empenhadoSiafi: Number(totalEmpenhadoGeral.toFixed(2)),
        saldoPlanejamentoSuap: Number(saldoPlanejamentoSuap.toFixed(2)),
        saldoRealSiafi: Number(saldoRealSiafiGeral.toFixed(2)),
        situacaoGeral,
      },
      planosInternos,
      atividadesComSaldo,
      empenhosSemAtividadePlanejada: empenhosSemAtividade,
      diagnosticoTextual,
      recomendacoes,
    };
  }

  /**
   * Cruza as obrigações de um contrato com a disponibilidade das fontes orçamentárias (PTRES)
   */
  async conciliarContratoComOrcamento(contratoId: string): Promise<{
    contratoId: string;
    fontesUtilizadas: Array<{
      ptres: string;
      totalEmpenhadoContrato: number;
      saldoRealPtresSiafi: number;
      suportaReforco: boolean;
    }>;
    diagnostico: string;
  }> {
    const { data: empenhosContrato } = await this.client
      .from('contratos_api_empenhos')
      .select('numero, valor_empenhado')
      .eq('contrato_api_id', contratoId);

    const nums = (empenhosContrato || []).map((e) => String(e.numero || '')).filter(Boolean);
    if (nums.length === 0) {
      return {
        contratoId,
        fontesUtilizadas: [],
        diagnostico: 'Nenhum empenho vinculado a este contrato foi localizado no sistema.',
      };
    }

    const { data: emps } = await this.client
      .from('empenhos')
      .select('numero, origem_recurso, valor')
      .in('numero', nums);

    const ptresMap = new Map<string, number>();
    (emps || []).forEach((e) => {
      const p = String(e.origem_recurso || 'N/A');
      ptresMap.set(p, (ptresMap.get(p) || 0) + Number(e.valor || 0));
    });

    const fontes: Array<{
      ptres: string;
      totalEmpenhadoContrato: number;
      saldoRealPtresSiafi: number;
      suportaReforco: boolean;
    }> = [];

    for (const [ptres, empContrato] of ptresMap.entries()) {
      const conc = await this.conciliarPtresCompleto(ptres);
      const saldoSiafi = conc.resumoGeral.saldoRealSiafi;
      fontes.push({
        ptres,
        totalEmpenhadoContrato: Number(empContrato.toFixed(2)),
        saldoRealPtresSiafi: saldoSiafi,
        suportaReforco: saldoSiafi > 100,
      });
    }

    return {
      contratoId,
      fontesUtilizadas: fontes,
      diagnostico: `Contrato amparado por ${fontes.length} fonte(s) orçamentária(s).`,
    };
  }

  /**
   * Rastreabilidade ponta a ponta:
   * Atividade SUAP -> Nota de Crédito -> Empenho -> Contrato -> Faturas -> Liquidações
   */
  async rastrearTrilhaDespesa(empenhoNumero: string): Promise<TrilhaDespesaResult> {
    const cleanNum = String(empenhoNumero).trim();

    const { data: emp, error: errEmp } = await this.client
      .from('empenhos')
      .select('*')
      .ilike('numero', cleanNum)
      .limit(1)
      .maybeSingle();

    if (errEmp) throw new Error(`Erro ao buscar empenho: ${errEmp.message}`);
    if (!emp) throw new Error(`Empenho "${cleanNum}" não encontrado.`);

    const ptres = String(emp.origem_recurso || '');
    const pi = String(emp.plano_interno || '');

    // Busca atividade correspondente
    let queryAtiv = this.client.from('atividades').select('*').eq('origem_recurso', ptres);
    if (pi) queryAtiv = queryAtiv.eq('plano_interno', pi);
    const { data: ativs } = await queryAtiv.limit(1);
    const atividadeOrigem = ativs && ativs.length > 0 ? {
      atividade: String(ativs[0].atividade || ''),
      planejado: Number(ativs[0].valor_total || 0),
      suapPlanId: ativs[0].suap_plan_id || undefined,
    } : undefined;

    // Busca Nota de Crédito no SIAFI
    let queryNc = this.client.from('descentralizacoes').select('*').eq('origem_recurso', ptres);
    if (pi) queryNc = queryNc.eq('plano_interno', pi);
    const { data: ncs } = await queryNc.limit(1);
    const creditoOrigem = ncs && ncs.length > 0 ? {
      notaCredito: String(ncs[0].nota_credito || ''),
      data: String(ncs[0].data_emissao || ''),
      valor: Number(ncs[0].valor || 0),
    } : undefined;

    // Busca contrato vinculado
    const { data: contEmp } = await this.client
      .from('contratos_api_empenhos')
      .select('contrato_api_id')
      .ilike('numero', cleanNum)
      .limit(1)
      .maybeSingle();

    let contratoVinculado: TrilhaDespesaResult['contratoVinculado'] = undefined;
    let faturasAssociadas: TrilhaDespesaResult['faturasAssociadas'] = [];

    if (contEmp?.contrato_api_id) {
      const { data: cont } = await this.client
        .from('contratos_api')
        .select('numero, objeto, vigencia_fim_derivada, vigencia_fim')
        .eq('id', contEmp.contrato_api_id)
        .limit(1)
        .maybeSingle();

      if (cont) {
        contratoVinculado = {
          numero: String(cont.numero || ''),
          objeto: String(cont.objeto || ''),
          vigenciaFim: cont.vigencia_fim_derivada || cont.vigencia_fim || undefined,
        };
      }

      const { data: fats } = await this.client
        .from('contratos_api_faturas')
        .select('numero_instrumento_cobranca, valor_bruto, data_liquidacao, data_pagamento')
        .eq('contrato_api_id', contEmp.contrato_api_id);

      faturasAssociadas = (fats || []).map((f) => ({
        numero: String(f.numero_instrumento_cobranca || 'Fatura'),
        valor: Number(f.valor_bruto || 0),
        dataLiquidacao: f.data_liquidacao || undefined,
        dataPagamento: f.data_pagamento || undefined,
      }));
    }

    return {
      empenhoNumero: String(emp.numero),
      empenho: {
        valor: Number(emp.valor || 0),
        data: String(emp.data_empenho || emp.created_at || ''),
        status: String(emp.status || ''),
        favorecido: String(emp.favorecido_nome || 'Não informado'),
        ptres,
        planoInterno: pi || undefined,
      },
      creditoOrigem,
      atividadeOrigem,
      contratoVinculado,
      faturasAssociadas,
    };
  }

  /**
   * Auditoria preventiva da saúde orçamentária geral do campus
   */
  async auditarSaudeOrcamentariaCampus(anoExercicio = new Date().getFullYear()): Promise<AuditoriaSaudeResult> {
    const { data: ptresList } = await this.client
      .from('descentralizacoes')
      .select('origem_recurso');

    const uniquePtres = Array.from(
      new Set((ptresList || []).map((d) => String(d.origem_recurso || '').trim()).filter(Boolean))
    );

    const ptresComDescompasso: AuditoriaSaudeResult['ptresComDescompasso'] = [];
    const alertasUrgentes: string[] = [];

    for (const ptres of uniquePtres) {
      try {
        const conc = await this.conciliarPtresCompleto(ptres);
        if (conc.resumoGeral.situacaoGeral === 'DESCOMPASSO_COM_SUAP') {
          ptresComDescompasso.push({
            ptres,
            saldoSuap: conc.resumoGeral.saldoPlanejamentoSuap,
            saldoSiafi: conc.resumoGeral.saldoRealSiafi,
            motivo: 'Empenhos emitidos sem atividade orçamentária planejada suficiente no SUAP.',
          });
        } else if (conc.resumoGeral.situacaoGeral === 'DEFICIT_ORCAMENTARIO') {
          ptresComDescompasso.push({
            ptres,
            saldoSuap: conc.resumoGeral.saldoPlanejamentoSuap,
            saldoSiafi: conc.resumoGeral.saldoRealSiafi,
            motivo: 'Déficit orçamentário real no SIAFI: valor empenhado supera créditos descentralizados.',
          });
          alertasUrgentes.push(`Déficit contábil no PTRES ${ptres}: Saldo negativo de R$ ${conc.resumoGeral.saldoRealSiafi.toFixed(2)}.`);
        }
      } catch (err) {
        // ignora erros de PTRES isolados
      }
    }

    return {
      anoExercicio,
      geradoEm: new Date().toISOString(),
      totalPtresAnalisados: uniquePtres.length,
      ptresComDescompasso,
      contratosCriticosSemSaldo: [],
      alertasUrgentes,
    };
  }
}
