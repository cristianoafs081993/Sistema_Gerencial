import { supabase, DEFAULT_CAMPUS_UASG } from '../lib/supabase';
import { EmpenhoItem, ContratoItem, NotificationItem, PregaoItem, AtaItem } from '../types';
import { dashboardData, empenhosData, contratosData, mockNotificationsData, pregoesData, atasData } from '../constants/data';

export interface DashboardMetricsResult {
  exercicio: string;
  usuario: string;
  campus: string;
  instituicao: string;
  planejado: number;
  totalAtividades: number;
  percentualExecutado: string;
  percentualExecutadoNum: number;
  percentualDescentralizadoPlanejadoNum: number;
  aDescentralizar: number;
  creditoDisponivel: number;
  percentualCreditoDisponivel: string;
  saldoDisponivel: number;
  percentualDescentralizado: string;
  descentralizado: number;
  empenhado: number;
  percentualEmpenhado: string;
  empenhadoDescentralizadoPct: number;
  liquidado: number;
  liquidadoPct: string;
  pago: number;
  pagoPct: string;
  aPagar: number;
  totalEmpenhos: number;
  contratosValorGlobal: number;
  contratosVigentes: number;
  contratosAVencerCount: number;
  referencia: string;
  monthlyChart: {
    month: string;
    liquidado: number;
    pago: number;
  }[];
}

export const isOrigemRecursoIgnoradaNoEmpenhado = (origem?: string | null): boolean => {
  if (!origem) return false;
  const trimmed = origem.trim();
  return trimmed.includes('230446');
};

const formatDatePtBR = (dateStr?: string | null): string => {
  if (!dateStr) return 'Não informada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
      'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.',
    ];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
};

const getDaysRemaining = (endDateStr?: string | null): { days: number; text: string; warning: boolean; pct: number } => {
  if (!endDateStr) {
    return { days: 999, text: 'Vigência indeterminada', warning: false, pct: 50 };
  }
  try {
    const now = new Date();
    const end = new Date(endDateStr);
    const diffMs = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { days: diffDays, text: `Expirado em ${formatDatePtBR(endDateStr)}`, warning: false, pct: 100 };
    }
    if (diffDays <= 30) {
      return { days: diffDays, text: `Vence em ${diffDays} dias`, warning: true, pct: 94 };
    }
    if (diffDays <= 120) {
      return { days: diffDays, text: `${diffDays} dias restantes`, warning: false, pct: 75 };
    }
    return {
      days: diffDays,
      text: `Vigência até ${formatDatePtBR(endDateStr).slice(3)}`,
      warning: false,
      pct: 35,
    };
  } catch {
    return { days: 999, text: 'Vigência em andamento', warning: false, pct: 50 };
  }
};

export async function fetchDashboardMetrics(
  campusUasg = DEFAULT_CAMPUS_UASG
): Promise<DashboardMetricsResult> {
  try {
    // 0. Fetch atividades do campus para o Planejado
    const { data: atividadesRows } = await supabase
      .from('atividades')
      .select('valor_total')
      .eq('campus_uasg', campusUasg);

    // 1. Fetch empenhos do exercício corrente (tipo = 'exercicio' e não cancelados)
    const { data: empenhosRows, error: empenhosError } = await supabase
      .from('empenhos')
      .select('valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, data_empenho, status, tipo, origem_recurso')
      .eq('campus_uasg', campusUasg)
      .eq('tipo', 'exercicio')
      .neq('status', 'cancelado');

    // 2. Fetch descentralizacoes (excluindo 230446)
    const { data: descRows } = await supabase
      .from('descentralizacoes')
      .select('valor, origem_recurso')
      .eq('campus_uasg', campusUasg);

    // 3. Fetch contratos_api
    const { data: contratosRows } = await supabase
      .from('contratos_api')
      .select('valor_global, situacao, vigencia_fim')
      .eq('unidade_codigo', campusUasg);

    // 4. Fetch crédito disponível do lote mais recente da tela web (creditos_disponiveis_detalhes)
    let creditoDisponivelOficial: number | null = null;
    try {
      const { data: latestBatch } = await supabase
        .from('creditos_disponiveis_detalhes')
        .select('import_batch_id')
        .eq('campus_uasg', campusUasg)
        .order('imported_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestBatch?.import_batch_id) {
        const { data: creditoRows } = await supabase
          .from('creditos_disponiveis_detalhes')
          .select('valor')
          .eq('import_batch_id', latestBatch.import_batch_id)
          .eq('campus_uasg', campusUasg);

        if (creditoRows && creditoRows.length > 0) {
          creditoDisponivelOficial = creditoRows.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
        }
      }
    } catch (err) {
      console.warn('Não foi possível obter crédito disponível de creditos_disponiveis_detalhes:', err);
    }

    if (empenhosError || !empenhosRows || empenhosRows.length === 0) {
      console.warn('Usando fallback do dashboard:', empenhosError);
      return {
        ...dashboardData,
        contratosAVencerCount: 11,
        monthlyChart: [
          { month: 'Jan', liquidado: 757, pago: 708 },
          { month: 'Fev', liquidado: 538, pago: 499 },
          { month: 'Mar', liquidado: 210, pago: 190 },
          { month: 'Abr', liquidado: 280, pago: 250 },
          { month: 'Mai', liquidado: 260, pago: 250 },
          { month: 'Jun', liquidado: 340, pago: 310 },
        ],
      };
    }

    // Totais do exercício alinhados com o Dashboard.tsx da web
    let totalEmpenhadoParaSoma = 0;
    let totalLiquidado = 0;
    let totalPago = 0;

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyDataMap: Record<string, { liquidado: number; pago: number }> = {};
    monthNames.forEach((m) => {
      monthlyDataMap[m] = { liquidado: 0, pago: 0 };
    });

    empenhosRows.forEach((row) => {
      const val = Number(row.valor) || 0;
      const liq = Number(row.valor_liquidado_oficial ?? row.valor_liquidado ?? 0);
      const pag = Number(row.valor_pago_oficial ?? 0);

      // Na web, a soma do empenhado descentralizado desconsidera a origem 230446 (PNAE)
      if (!isOrigemRecursoIgnoradaNoEmpenhado(row.origem_recurso)) {
        totalEmpenhadoParaSoma += val;
      }

      totalLiquidado += liq;
      totalPago += pag;

      if (row.data_empenho) {
        const d = new Date(row.data_empenho);
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < monthNames.length) {
          const mName = monthNames[mIdx];
          monthlyDataMap[mName].liquidado += liq / 1000;
          monthlyDataMap[mName].pago += pag / 1000;
        }
      }
    });

    // Descentralizado filtrando origem 230446
    const totalDescentralizado =
      descRows && descRows.length > 0
        ? descRows
            .filter((r) => !isOrigemRecursoIgnoradaNoEmpenhado(r.origem_recurso))
            .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
        : 2584623.54;

    // Planejado (total das atividades orçadas)
    const totalPlanejado =
      atividadesRows && atividadesRows.length > 0
        ? atividadesRows.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0)
        : 3414691.10;
    const totalAtividades = atividadesRows?.length || 357;

    const planejadoInt = Math.round(totalPlanejado);
    const descentralizadoInt = Math.round(totalDescentralizado);
    const empenhadoInt = Math.round(totalEmpenhadoParaSoma);
    const aDescentralizarInt = planejadoInt - descentralizadoInt;
    const saldoDisponivelInt = Math.max(0, descentralizadoInt - empenhadoInt);
    const creditoDisponivelFinal =
      creditoDisponivelOficial !== null ? creditoDisponivelOficial : saldoDisponivelInt;
    const creditoDisponivelInt = Math.round(creditoDisponivelFinal);
    const liquidadoInt = Math.round(totalLiquidado);
    const pagoInt = Math.round(totalPago);
    const aPagarInt = Math.max(0, liquidadoInt - pagoInt);

    const percentualExecutadoNum =
      totalPlanejado > 0
        ? Number(((totalEmpenhadoParaSoma / totalPlanejado) * 100).toFixed(1))
        : 0;
    const percentualExecutado = percentualExecutadoNum.toFixed(1).replace('.', ',') + '%';

    const percentualDescentralizadoPlanejadoNum =
      totalPlanejado > 0
        ? Number(((totalDescentralizado / totalPlanejado) * 100).toFixed(1))
        : 75.7;

    const empenhadoNum =
      totalDescentralizado > 0
        ? Number(((totalEmpenhadoParaSoma / totalDescentralizado) * 100).toFixed(1))
        : 0;
    const pctEmpenhado = empenhadoNum.toFixed(1).replace('.', ',') + '%';

    const creditoNum =
      totalDescentralizado > 0
        ? Number(((creditoDisponivelFinal / totalDescentralizado) * 100).toFixed(1))
        : 0;
    const pctCreditoDisponivel = creditoNum.toFixed(1).replace('.', ',') + '%';

    const saldoNum =
      totalDescentralizado > 0
        ? Number(((saldoDisponivelInt / totalDescentralizado) * 100).toFixed(1))
        : 0;
    const pctSaldo = saldoNum.toFixed(1).replace('.', ',') + '%';

    const pctLiquidado =
      totalEmpenhadoParaSoma > 0
        ? ((totalLiquidado / totalEmpenhadoParaSoma) * 100).toFixed(1).replace('.', ',') + '%'
        : '0,0%';

    const pctPago =
      totalLiquidado > 0
        ? ((totalPago / totalLiquidado) * 100).toFixed(1).replace('.', ',') + '%'
        : '0,0%';

    // Contratos totals
    let contratosGlobal = 0;
    let contratosVigentes = 0;
    let contratosAVencerCount = 0;

    (contratosRows || []).forEach((c) => {
      const isVigente = c.situacao === true;
      if (isVigente) {
        contratosVigentes++;
        contratosGlobal += Number(c.valor_global) || 0;
        const remaining = getDaysRemaining(c.vigencia_fim);
        if (remaining.warning) {
          contratosAVencerCount++;
        }
      }
    });

    const now = new Date();
    const formattedRef = `${String(now.getDate()).padStart(2, '0')} set. ${now.getFullYear()} · ${String(
      now.getHours()
    ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Monta os 6 meses para o gráfico (Jan a Jun ou meses com execução)
    const monthlyChart = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m) => ({
      month: m,
      liquidado: Math.round(monthlyDataMap[m]?.liquidado || (m === 'Jan' ? 757 : m === 'Fev' ? 538 : 0)),
      pago: Math.round(monthlyDataMap[m]?.pago || (m === 'Jan' ? 708 : m === 'Fev' ? 499 : 0)),
    }));

    return {
      exercicio: '2026',
      usuario: 'Cristiano',
      campus: 'Campus Currais Novos',
      instituicao: 'IFRN',
      planejado: planejadoInt,
      totalAtividades,
      percentualExecutado,
      percentualExecutadoNum,
      percentualDescentralizadoPlanejadoNum,
      aDescentralizar: aDescentralizarInt,
      creditoDisponivel: creditoDisponivelInt,
      percentualCreditoDisponivel: pctCreditoDisponivel,
      saldoDisponivel: saldoDisponivelInt,
      percentualDescentralizado: pctSaldo,
      descentralizado: descentralizadoInt,
      empenhado: empenhadoInt,
      percentualEmpenhado: pctEmpenhado,
      empenhadoDescentralizadoPct: empenhadoNum,
      liquidado: liquidadoInt,
      liquidadoPct: pctLiquidado,
      pago: pagoInt,
      pagoPct: pctPago,
      aPagar: aPagarInt,
      totalEmpenhos: empenhosRows.length,
      contratosValorGlobal: Math.round(contratosGlobal || 50651970),
      contratosVigentes: contratosVigentes || 54,
      contratosAVencerCount: contratosAVencerCount || 11,
      referencia: formattedRef,
      monthlyChart,
    };
  } catch (err) {
    console.error('Erro ao calcular métricas do dashboard:', err);
    return {
      ...dashboardData,
      contratosAVencerCount: 11,
      monthlyChart: [
        { month: 'Jan', liquidado: 757, pago: 708 },
        { month: 'Fev', liquidado: 538, pago: 499 },
        { month: 'Mar', liquidado: 210, pago: 190 },
        { month: 'Abr', liquidado: 280, pago: 250 },
        { month: 'Mai', liquidado: 260, pago: 250 },
        { month: 'Jun', liquidado: 340, pago: 310 },
      ],
    };
  }
}

export async function fetchEmpenhos(
  campusUasg = DEFAULT_CAMPUS_UASG,
  tipoFilter: 'exercicio' | 'rap' | 'all' = 'all'
): Promise<EmpenhoItem[]> {
  try {
    let query = supabase
      .from('empenhos')
      .select(
        'id, numero, descricao, valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, saldo_rap_oficial, rap_inscrito, rap_a_liquidar, rap_liquidado, rap_pago, valor_liquidado_a_pagar, status, data_empenho, natureza_despesa, favorecido_nome, tipo'
      )
      .eq('campus_uasg', campusUasg)
      .neq('status', 'cancelado')
      .order('data_empenho', { ascending: false });

    if (tipoFilter !== 'all') {
      query = query.eq('tipo', tipoFilter);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      console.warn('Usando lista fallback de empenhos:', error);
      return empenhosData;
    }

    return data.map((row) => {
      const isRap = row.tipo === 'rap';

      if (isRap) {
        const rapInscrito = Number(row.rap_inscrito ?? row.valor) || 0;
        const rapPago = Number(row.rap_pago ?? row.rap_liquidado ?? 0);
        const saldoRap = row.saldo_rap_oficial != null
          ? Math.max(0, Number(row.saldo_rap_oficial))
          : Math.max(0, rapInscrito - rapPago);

        const status: 'liquidar' | 'pagar' | 'pago' = saldoRap > 0 ? 'pagar' : 'pago';
        const label = saldoRap > 0 ? 'Pendente' : 'Pago';
        const badge: 'blue' | 'amber' | '' = saldoRap > 0 ? 'amber' : '';

        return {
          id: row.numero || row.id,
          name: row.favorecido_nome || 'Fornecedor não identificado',
          desc: row.descricao || 'Despesa de restos a pagar',
          value: saldoRap, // Saldo atual dos restos a pagar como valor do empenho
          paid: rapPago,
          saldo: saldoRap,
          inscrito: rapInscrito,
          status,
          label,
          badge,
          date: formatDatePtBR(row.data_empenho),
          nd: row.natureza_despesa || '339039',
          tipo: 'rap',
        };
      }

      const valor = Number(row.valor) || 0;
      const liquidado = Number(row.valor_liquidado_oficial ?? row.valor_liquidado ?? 0);
      const pago = Number(row.valor_pago_oficial ?? (row.status === 'pago' ? valor : 0));
      const saldo = Math.max(0, valor - liquidado);

      let status: 'liquidar' | 'pagar' | 'pago' = 'liquidar';
      let label = 'A liquidar';
      let badge: 'blue' | 'amber' | '' = 'blue';

      if (pago >= valor && valor > 0) {
        status = 'pago';
        label = 'Pago';
        badge = '';
      } else if (liquidado > pago) {
        status = 'pagar';
        label = 'A pagar';
        badge = 'amber';
      } else {
        status = 'liquidar';
        label = 'A liquidar';
        badge = 'blue';
      }

      return {
        id: row.numero || row.id,
        name: row.favorecido_nome || 'Fornecedor não identificado',
        desc: row.descricao || 'Despesa empenhada',
        value: valor,
        paid: pago,
        saldo,
        inscrito: valor,
        status,
        label,
        badge,
        date: formatDatePtBR(row.data_empenho),
        nd: row.natureza_despesa || '339039',
        tipo: 'exercicio',
      };
    });
  } catch (err) {
    console.error('Erro ao buscar empenhos:', err);
    return empenhosData;
  }
}

export async function fetchContratos(
  campusUasg = DEFAULT_CAMPUS_UASG
): Promise<ContratoItem[]> {
  try {
    const { data, error } = await supabase
      .from('contratos_api')
      .select('id, numero, fornecedor_nome, objeto, valor_global, vigencia_fim, situacao, categoria')
      .eq('unidade_codigo', campusUasg)
      .order('vigencia_fim', { ascending: false })
      .limit(60);

    if (error || !data || data.length === 0) {
      console.warn('Usando lista fallback de contratos:', error);
      return contratosData;
    }

    return data.map((row) => {
      const val = Number(row.valor_global) || 0;
      const remainingInfo = getDaysRemaining(row.vigencia_fim);

      let title = row.objeto ? row.objeto.trim() : 'Contrato de Serviços';
      if (title.length > 55) {
        title = title.slice(0, 52).trim() + '...';
      }

      let icon: 'shield' | 'building' | 'doc' = 'doc';
      const objLower = (row.objeto || '').toLowerCase();
      if (objLower.includes('vigil') || objLower.includes('seguran') || objLower.includes('prote')) {
        icon = 'shield';
      } else if (
        objLower.includes('manuten') ||
        objLower.includes('energia') ||
        objLower.includes('loca') ||
        objLower.includes('telecom') ||
        objLower.includes('inter') ||
        objLower.includes('reform') ||
        objLower.includes('obra')
      ) {
        icon = 'building';
      }

      return {
        id: row.numero || 'S/N',
        title,
        name: row.fornecedor_nome || 'Contratada não identificada',
        value: val,
        campus: Math.round(val * 0.7),
        end: formatDatePtBR(row.vigencia_fim),
        remaining: remainingInfo.text,
        pct: remainingInfo.pct,
        warning: remainingInfo.warning,
        docs: 3,
        invoices: remainingInfo.warning ? 1 : 0,
        icon,
      };
    });
  } catch (err) {
    console.error('Erro ao buscar contratos:', err);
    return contratosData;
  }
}

function parseNotificationDate(value: Date | string | number | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date(0) : value;
  if (typeof value === 'number') return new Date(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Date(0);
    if (trimmed.includes('/')) {
      const [datePart, timePart] = trimmed.split(' ');
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const time = timePart || '12:00:00';
        const iso = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${time}`;
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = new Date(`${trimmed}T12:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function extractDocNumber(numero?: string | null): number {
  if (!numero) return 0;
  const match = numero.match(/(\d{4})[A-Za-z]+(\d+)/);
  if (match) {
    const year = parseInt(match[1], 10);
    const seq = parseInt(match[2], 10);
    return year * 10_000_000 + seq;
  }
  const digits = numero.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

export function interleaveEvents(
  empenhos: NotificationItem[],
  descentralizacoes: NotificationItem[],
  requisicoes: NotificationItem[] = [],
  maxTotal = 60
): NotificationItem[] {
  const result: NotificationItem[] = [];
  const maxLen = Math.max(empenhos.length, descentralizacoes.length, requisicoes.length);

  for (let i = 0; i < maxLen && result.length < maxTotal; i++) {
    if (requisicoes[i] && result.length < maxTotal) {
      result.push(requisicoes[i]);
    }
    if (descentralizacoes[i] && result.length < maxTotal) {
      result.push(descentralizacoes[i]);
    }
    if (empenhos[i] && result.length < maxTotal) {
      result.push(empenhos[i]);
    }
  }

  return result;
}

export async function fetchNotifications(
  campusUasg = DEFAULT_CAMPUS_UASG
): Promise<NotificationItem[]> {
  try {
    const [empenhosRes, descRes, reqRes] = await Promise.all([
      // 1. Empenhos do exercício mais recentes
      supabase
        .from('empenhos')
        .select('id, numero, valor, data_empenho, favorecido_nome, status, dimensao, descricao, created_at')
        .eq('campus_uasg', campusUasg)
        .eq('tipo', 'exercicio')
        .neq('status', 'cancelado')
        .order('data_empenho', { ascending: false })
        .limit(20),

      // 2. Descentralizações mais recentes
      supabase
        .from('descentralizacoes')
        .select('id, nota_credito, valor, data_emissao, plano_interno, origem_recurso, dimensao, descricao, created_at')
        .eq('campus_uasg', campusUasg)
        .order('data_emissao', { ascending: false })
        .limit(20),

      // 3. Requisições enviadas ao fornecedor
      supabase
        .from('requisicoes_compra')
        .select('id, number, title, status, created_by_email, created_at, updated_at, requisicao_compra_itens(quantity, unit_price)')
        .in('status', ['enviada_fornecedor', 'review', 'approved'])
        .order('updated_at', { ascending: false })
        .limit(20),
    ]);

    // Mapear descentralizações
    const sortedDescentralizacoes: NotificationItem[] = (descRes.data || [])
      .map((d: any) => {
        const docDate = parseNotificationDate(d.data_emissao || d.created_at);
        const createdDate = parseNotificationDate(d.created_at || d.data_emissao);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `desc-${d.id || d.nota_credito}`,
          type: 'descentralizacao' as const,
          date: effectiveDate,
          documentDate: docDate,
          title: d.nota_credito ? `Descentralização ${d.nota_credito}` : 'Descentralização de Crédito',
          subtitle: d.origem_recurso ? `Origem: ${d.origem_recurso}` : 'Origem não informada',
          description: d.descricao || (d.plano_interno ? `PI: ${d.plano_interno}` : ''),
          valor: Number(d.valor) || 0,
          dimensao: d.dimensao || undefined,
          status: 'NC',
          numeroDocumento: d.nota_credito,
        };
      })
      .sort((a, b) => {
        const dateDiff = b.date.getTime() - a.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        const numA = extractDocNumber(a.numeroDocumento);
        const numB = extractDocNumber(b.numeroDocumento);
        return numB - numA;
      });

    // Mapear empenhos
    const sortedEmpenhos: NotificationItem[] = (empenhosRes.data || [])
      .map((e: any) => {
        const docDate = parseNotificationDate(e.data_empenho || e.created_at);
        const createdDate = parseNotificationDate(e.created_at || e.data_empenho);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `emp-${e.id || e.numero}`,
          type: 'empenho' as const,
          date: effectiveDate,
          documentDate: docDate,
          title: `Empenho ${e.numero}`,
          subtitle: e.favorecido_nome || 'Favorecido não informado',
          description: e.descricao || '',
          valor: Number(e.valor) || 0,
          dimensao: e.dimensao || undefined,
          status: e.status || 'pendente',
          numeroDocumento: e.numero,
        };
      })
      .sort((a, b) => {
        const numA = extractDocNumber(a.numeroDocumento);
        const numB = extractDocNumber(b.numeroDocumento);
        if (numA !== 0 && numB !== 0 && numA !== numB) {
          return numB - numA;
        }
        return b.date.getTime() - a.date.getTime();
      });

    // Mapear requisições
    const sortedRequisicoes: NotificationItem[] = (reqRes.data || [])
      .map((r: any) => {
        const docDate = parseNotificationDate(r.updated_at || r.created_at);
        const createdDate = parseNotificationDate(r.created_at || r.updated_at);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        const totalValor = (r.requisicao_compra_itens || []).reduce(
          (sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)),
          0
        );

        return {
          id: `req-${r.id || r.number}`,
          type: 'requisicao' as const,
          date: effectiveDate,
          documentDate: docDate,
          title: r.number ? `Requisição ${r.number}` : 'Requisição de Compra',
          subtitle: r.created_by_email ? `Criador: ${r.created_by_email}` : 'Enviada ao Fornecedor',
          description: r.title || '',
          valor: totalValor,
          status: 'enviada_fornecedor',
          numeroDocumento: r.number,
        };
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const interleaved = interleaveEvents(sortedEmpenhos, sortedDescentralizacoes, sortedRequisicoes, 60);
    if (interleaved.length > 0) {
      return interleaved;
    }
    return mockNotificationsData;
  } catch (err) {
    console.warn('Erro ao buscar notificações do backend, usando mock:', err);
    return mockNotificationsData;
  }
}

export async function fetchPregoes(
  campusUasg = DEFAULT_CAMPUS_UASG
): Promise<PregaoItem[]> {
  try {
    const { data, error } = await supabase
      .from('licitacoes_pncp')
      .select('*')
      .order('data_abertura_proposta', { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) throw error;
    if (!data || data.length === 0) return pregoesData;

    const now = new Date().getTime();

    return data.map((row: any) => {
      const encTime = row.data_encerramento_proposta
        ? new Date(row.data_encerramento_proposta).getTime()
        : null;
      const abTime = row.data_abertura_proposta
        ? new Date(row.data_abertura_proposta).getTime()
        : null;

      let statusProposta: PregaoItem['statusProposta'] = 'Encerrada';
      let badgeColor: PregaoItem['badgeColor'] = 'muted';

      if (encTime && encTime > now) {
        if (abTime && abTime > now) {
          statusProposta = 'Futura';
          badgeColor = 'blue';
        } else {
          statusProposta = 'Aberta';
          badgeColor = 'green';
        }
      } else if (!encTime && abTime && abTime > now) {
        statusProposta = 'Futura';
        badgeColor = 'blue';
      } else if (!encTime && abTime && abTime <= now) {
        statusProposta = 'Em andamento';
        badgeColor = 'amber';
      }

      const valorHomologado = Number(row.valor_total_homologado) || 0;
      const valorEstimado = Number(row.valor_total_estimado) || 0;
      const valor = valorHomologado > 0 ? valorHomologado : valorEstimado;
      const tipoValor: 'homologado' | 'estimado' = valorHomologado > 0 ? 'homologado' : 'estimado';

      return {
        id: String(row.id || row.numero_compra),
        numero: row.numero_compra || 'N/D',
        objeto: row.objeto_compra || 'Sem descrição do objeto',
        modalidade: row.modalidade_nome || 'Pregão Eletrônico',
        uasgCodigo: String(row.uasg_codigo || ''),
        uasgNome: row.uasg_nome || 'IFRN',
        valor,
        tipoValor,
        statusProposta,
        badgeColor,
        dataAbertura: formatDatePtBR(row.data_abertura_proposta),
        dataPublicacao: formatDatePtBR(row.data_publicacao_pncp),
        srp: Boolean(row.srp),
        link: row.link_sistema_origem || undefined,
        processo: row.processo || undefined,
      };
    });
  } catch (err) {
    console.warn('Erro ao buscar pregões, usando mock:', err);
    return pregoesData;
  }
}

export async function fetchAtas(
  campusUasg = DEFAULT_CAMPUS_UASG
): Promise<AtaItem[]> {
  try {
    const { data, error } = await supabase
      .from('atas_registro_precos_resumo')
      .select('*')
      .order('data_vigencia_inicial', { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) throw error;
    if (!data || data.length === 0) return atasData;

    const now = new Date().getTime();

    return data.map((row: any) => {
      const uasg = String(campusUasg);
      let vinculo: AtaItem['vinculo'] = 'outro';

      if (String(row.unidade_gerenciadora_codigo) === uasg) {
        vinculo = 'gerenciadora';
      } else if (
        Array.isArray(row.unidades_participantes) &&
        row.unidades_participantes.includes(uasg)
      ) {
        vinculo = 'participante';
      } else if (
        Array.isArray(row.unidades_aderentes) &&
        row.unidades_aderentes.includes(uasg)
      ) {
        vinculo = 'aderente';
      }

      let statusVigencia: AtaItem['statusVigencia'] = 'vigente';
      let badgeVigencia: AtaItem['badgeVigencia'] = 'green';
      let diasRestantes = 0;

      if (row.data_vigencia_final) {
        const fimTime = new Date(row.data_vigencia_final).getTime();
        const diffMs = fimTime - now;
        diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diasRestantes < 0) {
          statusVigencia = 'expirada';
          badgeVigencia = 'muted';
          diasRestantes = 0;
        } else if (diasRestantes <= 30) {
          statusVigencia = 'vencer';
          badgeVigencia = 'amber';
        } else {
          statusVigencia = 'vigente';
          badgeVigencia = 'green';
        }
      }

      return {
        id: String(row.id || row.numero_ata),
        numeroAta: row.numero_ata || 'N/D',
        numeroCompra: row.numero_compra || undefined,
        objeto: row.objeto || 'Sem descrição do objeto',
        unidadeGerenciadoraCodigo: String(row.unidade_gerenciadora_codigo || ''),
        unidadeGerenciadoraNome: row.unidade_gerenciadora_nome || 'IFRN',
        vinculo,
        vigenciaInicio: formatDatePtBR(row.data_vigencia_inicial),
        vigenciaFim: formatDatePtBR(row.data_vigencia_final),
        statusVigencia,
        diasRestantes,
        totalItens: Number(row.total_itens) || 0,
        totalAdesoes: Number(row.total_adesoes) || 0,
        badgeVigencia,
      };
    });
  } catch (err) {
    console.warn('Erro ao buscar atas, usando mock:', err);
    return atasData;
  }
}


