import { supabase, DEFAULT_CAMPUS_UASG } from '../lib/supabase';
import { formatarDataIso } from '../lib/format';
import {
  EmpenhoItem,
  NotificationItem,
  PregaoItem,
  AtaItem,
  PtresItem,
  OcorrenciaItem,
  EnergiaFaturaItem,
  EnergiaSolarItem,
  PortariaEventoItem,
  PortariaParticipanteItem,
} from '../types';

export const matchesPtres = (origemRecurso?: string | null, targetPtres?: string): boolean => {
  if (!targetPtres || targetPtres === 'all') return true;
  if (!origemRecurso) return false;
  const o = String(origemRecurso).trim().toLowerCase();
  const t = String(targetPtres).trim().toLowerCase();
  return o === t || o.startsWith(`${t} `) || o.startsWith(`${t}-`) || o.startsWith(`${t}/`);
};

export const KNOWN_PTRES_NAMES: Record<string, string> = {
  '231796': 'PROAD · Gestão Administrativa',
  '261941': 'DIAE · Assistência Estudantil (Alimentação)',
  '231802': 'PROEN · Ensino e PCD / Assistência',
  '231798': 'PROEN · Ações de Ensino (21B3)',
  '171166': 'DIGPE · Ações de Capacitação',
  '260296': 'PROEN · Ações de Ensino (PCDs)',
  '230446': 'PNAE · Alimentação Escolar',
  '231795': 'Equipamentos e TI',
  '231799': 'Saúde Estudantil',
};

export const isOrigemRecursoIgnoradaNoEmpenhado = (origem?: string | null): boolean => {
  if (!origem) return false;
  const trimmed = origem.trim();
  return trimmed.includes('230446');
};

const formatDatePtBR = (dateStr?: string | null): string => {
  if (!dateStr) return 'Não informada';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return formatarDataIso(dateStr, dateStr);
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

export const CAMPUS_TO_SUAP_UNIT: Record<string, string> = {
  '158366': '19', // Currais Novos
  '158371': '13', // Apodi
  '158370': '14', // Caicó
  '154839': '18', // Canguaretama
  '152711': '30', // Natal - Cidade Alta
  '154838': '17', // Ceará-Mirim
  '158369': '33', // Natal - Central
  '158367': '20', // Ipanguaçu
  '158373': '24', // João Câmara
  '158365': '15', // Mossoró
  '158375': '23', // Macau
  '152757': '31', // Nova Cruz
  '152756': '28', // Parnamirim
  '158374': '16', // Pau dos Ferros
  '158372': '27', // Santa Cruz
  '154582': '26', // São Gonçalo do Amarante
  '154840': '22', // São Paulo do Potengi
  '158368': '32', // Natal - Zona Norte
};

export function getCampusSuapUnitCode(campusUasg: string): string {
  return CAMPUS_TO_SUAP_UNIT[campusUasg] || '19';
}

export async function fetchEmpenhos(
  campusUasg = DEFAULT_CAMPUS_UASG,
  tipoFilter: 'exercicio' | 'rap' | 'all' = 'all'
): Promise<EmpenhoItem[]> {
  try {
    let query = supabase
      .from('empenhos')
      .select(
        'id, numero, descricao, valor, valor_liquidado, valor_liquidado_oficial, valor_pago_oficial, saldo_rap_oficial, rap_inscrito, rap_a_liquidar, rap_liquidado, rap_pago, valor_liquidado_a_pagar, status, data_empenho, natureza_despesa, favorecido_nome, tipo, processo, plano_interno, origem_recurso'
      )
      .eq('campus_uasg', campusUasg)
      .neq('status', 'cancelado')
      .order('data_empenho', { ascending: false });

    if (tipoFilter !== 'all') {
      query = query.eq('tipo', tipoFilter);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    if (!data) return [];

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
          processo: row.processo ?? null,
          planoInterno: row.plano_interno ?? null,
          origem: row.origem_recurso ?? null,
          liquidado: Number(row.rap_liquidado ?? 0),
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
        processo: row.processo ?? null,
        planoInterno: row.plano_interno ?? null,
        origem: row.origem_recurso ?? null,
        liquidado,
      };
    });
  } catch (err) {
    console.error('Erro ao buscar empenhos:', err);
    throw err;
  }
}

function parseNotificationDate(value: Date | string | number | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date(0) : value;
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

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

export function sortNotificationEvents(
  empenhos: NotificationItem[],
  descentralizacoes: NotificationItem[],
  requisicoes: NotificationItem[] = [],
  maxTotal = 60
): NotificationItem[] {
  return [...empenhos, ...descentralizacoes, ...requisicoes]
    .sort((a, b) => b.date.getTime() - a.date.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, maxTotal);
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
    const descentralizacaoEvents: NotificationItem[] = (descRes.data || [])
      .map((d: any) => {
        const docDate = parseNotificationDate(d.data_emissao);
        const createdDate = parseNotificationDate(d.created_at);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `desc-${d.id || d.nota_credito}`,
          type: 'descentralizacao' as const,
          date: effectiveDate,
          documentDate: effectiveDate,
          title: d.nota_credito ? `Descentralização ${d.nota_credito}` : 'Descentralização de Crédito',
          subtitle: d.origem_recurso ? `Origem: ${d.origem_recurso}` : 'Origem não informada',
          description: d.descricao || (d.plano_interno ? `PI: ${d.plano_interno}` : ''),
          valor: Number(d.valor) || 0,
          dimensao: d.dimensao || undefined,
          status: 'NC',
          numeroDocumento: d.nota_credito,
        };
      });

    // Mapear empenhos
    const empenhoEvents: NotificationItem[] = (empenhosRes.data || [])
      .map((e: any) => {
        const docDate = parseNotificationDate(e.data_empenho);
        const createdDate = parseNotificationDate(e.created_at);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `emp-${e.id || e.numero}`,
          type: 'empenho' as const,
          date: effectiveDate,
          documentDate: effectiveDate,
          title: `Empenho ${e.numero}`,
          subtitle: e.favorecido_nome || 'Favorecido não informado',
          description: e.descricao || '',
          valor: Number(e.valor) || 0,
          dimensao: e.dimensao || undefined,
          status: e.status || 'pendente',
          numeroDocumento: e.numero,
        };
      });

    // Mapear requisições
    const requisicaoEvents: NotificationItem[] = (reqRes.data || [])
      .map((r: any) => {
        const docDate = parseNotificationDate(r.updated_at);
        const createdDate = parseNotificationDate(r.created_at);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        const totalValor = (r.requisicao_compra_itens || []).reduce(
          (sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)),
          0
        );

        return {
          id: `req-${r.id || r.number}`,
          type: 'requisicao' as const,
          date: effectiveDate,
          documentDate: effectiveDate,
          title: r.number ? `Requisição ${r.number}` : 'Requisição de Compra',
          subtitle: r.created_by_email ? `Criador: ${r.created_by_email}` : 'Enviada ao Fornecedor',
          description: r.title || '',
          valor: totalValor,
          status: 'enviada_fornecedor',
          numeroDocumento: r.number,
        };
      });

    return sortNotificationEvents(empenhoEvents, descentralizacaoEvents, requisicaoEvents, 60);
  } catch (err) {
    // Notificações são complementares: em falha o sino fica vazio (nunca exibimos avisos fictícios).
    console.warn('Erro ao buscar notificações do backend:', err);
    return [];
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
    if (!data || data.length === 0) return [];

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
    return [];
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
    if (!data || data.length === 0) return [];

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
    return [];
  }
}

export async function fetchOcorrencias(): Promise<OcorrenciaItem[]> {
  try {
    const { data, error } = await supabase
      .from('manutencao_ocorrencias')
      .select('*, ambiente:ambiente_id(nome, codigo, bloco)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Erro ao buscar ocorrências no Supabase:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: String(row.id),
      ambienteNome: row.ambiente?.nome || 'Ambiente não identificado',
      ambienteCodigo: row.ambiente?.codigo || 'N/A',
      bloco: row.ambiente?.bloco || null,
      status: (row.status || 'pendente') as OcorrenciaItem['status'],
      avaliacao: Number(row.avaliacao || 0),
      problemas: Array.isArray(row.problemas) ? row.problemas : [],
      observacao: row.observacao || null,
      fotoUrl: row.foto_path || null,
      data: row.created_at,
      resolvidoEm: row.resolvido_em || null,
    }));
  } catch (err) {
    console.warn('Erro ao buscar ocorrências, usando fallback:', err);
    return [];
  }
}

export async function fetchEnergiaFaturas(): Promise<EnergiaFaturaItem[]> {
  try {
    const { data, error } = await supabase
      .from('energia_consumo_faturas')
      .select('id, fonte, competencia, ano, consumo_total_kwh, valor_faturado, fatura_numero, fornecedor, leitura_fim')
      .order('ano', { ascending: false })
      .order('competencia', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Erro ao buscar faturas de energia:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: String(row.id),
      fonte: (row.fonte === 'mercatto' ? 'mercatto' : 'cosern') as 'cosern' | 'mercatto',
      competencia: row.competencia || `${row.ano || ''}`,
      ano: Number(row.ano || 0),
      consumoKwh: Number(row.consumo_total_kwh || 0),
      valor: Number(row.valor_faturado || 0),
      faturaNumero: row.fatura_numero || undefined,
      fornecedor: row.fornecedor || (row.fonte === 'mercatto' ? 'Mercatto Energia' : 'Neoenergia Cosern'),
      leituraFim: row.leitura_fim || undefined,
    }));
  } catch (err) {
    console.warn('Erro ao buscar faturas de energia, usando fallback:', err);
    return [];
  }
}

export async function fetchEnergiaSolar(): Promise<EnergiaSolarItem[]> {
  try {
    const { data, error } = await supabase
      .from('energia_solar_geracao')
      .select('id, ufv_nome, data_referencia, ano, mes, energia_gerada_kwh')
      .order('data_referencia', { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Erro ao buscar dados solar:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: String(row.id),
      ufvNome: row.ufv_nome || 'UFV Campus',
      dataReferencia: row.data_referencia || '',
      ano: Number(row.ano || 0),
      mes: Number(row.mes || 0),
      energiaGeradaKwh: Number(row.energia_gerada_kwh || 0),
    }));
  } catch (err) {
    console.warn('Erro ao buscar dados de energia solar, usando fallback:', err);
    return [];
  }
}

export async function fetchPortariaEventos(campusUasg?: string): Promise<PortariaEventoItem[]> {
  try {
    const { data, error } = await supabase
      .from('portaria_eventos')
      .select(`
        id,
        titulo,
        descricao,
        local,
        ambiente_id,
        data_inicio,
        data_fim,
        responsavel_nome,
        responsavel_contato,
        tipo,
        status,
        observacoes_portaria,
        portaria_evento_participantes (
          id,
          presente
        )
      `)
      .eq('campus_uasg', campusUasg || DEFAULT_CAMPUS_UASG)
      .order('data_inicio', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Erro ao buscar eventos da portaria no Supabase:', error);
      return [];
    }

    return data.map((row: any) => {
      const participantes = Array.isArray(row.portaria_evento_participantes)
        ? row.portaria_evento_participantes
        : [];
      const totalParticipantes = participantes.length;
      const totalPresentes = participantes.filter((p: any) => p.presente === true).length;

      return {
        id: String(row.id),
        titulo: row.titulo,
        descricao: row.descricao || null,
        local: row.local,
        ambienteId: row.ambiente_id ? String(row.ambiente_id) : null,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim || null,
        responsavelNome: row.responsavel_nome || null,
        responsavelContato: row.responsavel_contato || null,
        tipo: row.tipo || 'academico',
        status: row.status || 'confirmado',
        observacoesPortaria: row.observacoes_portaria || null,
        totalParticipantes,
        totalPresentes,
      };
    });
  } catch (err) {
    console.warn('Erro ao buscar eventos da portaria, usando fallback:', err);
    return [];
  }
}

export async function fetchPortariaParticipantes(eventoId: string): Promise<PortariaParticipanteItem[]> {
  try {
    const { data, error } = await supabase
      .from('portaria_evento_participantes')
      .select('id, evento_id, nome, documento, instituicao, tipo, presente, horario_entrada, veiculo_placa, observacao')
      .eq('evento_id', eventoId)
      .order('nome', { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn('Erro ao buscar participantes da portaria:', error);
      return [];
    }

    return data.map((row: any) => ({
      id: String(row.id),
      eventoId: String(row.evento_id),
      nome: row.nome,
      documento: row.documento || null,
      instituicao: row.instituicao || null,
      tipo: row.tipo || 'participante',
      presente: Boolean(row.presente),
      horarioEntrada: row.horario_entrada || null,
      veiculoPlaca: row.veiculo_placa || null,
      observacao: row.observacao || null,
    }));
  } catch (err) {
    console.warn('Erro em fetchPortariaParticipantes:', err);
    return [];
  }
}

export async function toggleParticipanteCheckin(
  participanteId: string,
  presente: boolean
): Promise<boolean> {
  try {
    const updatePayload: Record<string, any> = {
      presente,
      horario_entrada: presente ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('portaria_evento_participantes')
      .update(updatePayload)
      .eq('id', participanteId);

    if (error) {
      console.warn('Erro ao atualizar presença do participante:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Erro em toggleParticipanteCheckin:', err);
    return false;
  }
}




