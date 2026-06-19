export type ContratoApiStatusContrato = {
  unidade_codigo?: string | null;
  unidade_origem_codigo?: string | null;
  objeto?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  situacao?: boolean | null;
  prorrogavel?: string | null;
};

export type ContratoApiStatusHistorico = {
  tipo?: string | null;
  qualificacao_termo?: Array<Record<string, unknown>> | null;
  observacao?: string | null;
  data_assinatura?: string | null;
  data_publicacao?: string | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  situacao_contrato?: string | null;
};

export type ContratoApiStatusEmpenho = {
  unidade_gestora?: string | null;
};

export type ContratoApiStatusFatura = {
  data_emissao?: string | null;
  data_pagamento?: string | null;
  raw_data?: Record<string, unknown> | null;
};

export type ContratoApiDerivedStatus = {
  situacao_derivada: boolean;
  vigencia_inicio_derivada: string | null;
  vigencia_fim_derivada: string | null;
  situacao_derivada_motivo: string;
};

export type ContratoApiCampusScope = {
  inScope: boolean;
  campus_scope_reason: string;
};

export const CONTRATOS_API_CAMPUS_UG = '158366';
export const CONTRATOS_API_REITORIA_UG = '158155';
const NON_CURRAIS_CAMPUS_TEXT_SIGNALS = ['campus avancado', 'parelhas', 'jucurutu'];

const parseIsoDate = (value: string | null | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isNaN(time) ? null : time;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getHistoricoText = (row: ContratoApiStatusHistorico) => {
  const qualificacoes = (row.qualificacao_termo ?? [])
    .map((item) => `${item?.codigo ?? ''} ${item?.descricao ?? ''}`)
    .join(' ');
  return normalizeText([
    row.tipo,
    row.observacao,
    row.situacao_contrato,
    qualificacoes,
  ].join(' '));
};

const isTerminationTerm = (row: ContratoApiStatusHistorico, todayIso: string) => {
  const text = getHistoricoText(row);
  const hasTerminationSignal =
    text.includes('rescis') ||
    text.includes('extinc') ||
    text.includes('encerr') ||
    text.includes('cancel');

  if (!hasTerminationSignal) return false;

  const effectiveDate =
    row.data_assinatura ||
    row.data_publicacao ||
    row.vigencia_inicio ||
    row.vigencia_fim;
  if (!effectiveDate) return true;
  return effectiveDate <= todayIso;
};

const getLatestVigencia = (historico: ContratoApiStatusHistorico[]) => {
  let latest: { start: string | null; end: string; endTime: number } | null = null;

  for (const row of historico) {
    const endTime = parseIsoDate(row.vigencia_fim);
    if (endTime == null || !row.vigencia_fim) continue;
    if (!latest || endTime > latest.endTime) {
      latest = {
        start: row.vigencia_inicio ?? null,
        end: row.vigencia_fim,
        endTime,
      };
    }
  }

  return latest;
};

export function deriveContratoApiStatus(
  contrato: ContratoApiStatusContrato,
  historico: ContratoApiStatusHistorico[],
  today = new Date(),
): ContratoApiDerivedStatus {
  const todayIso = toIsoDate(today);
  const latestHistorico = getLatestVigencia(historico);

  if (historico.some((row) => isTerminationTerm(row, todayIso))) {
    return {
      situacao_derivada: false,
      vigencia_inicio_derivada: latestHistorico?.start ?? contrato.vigencia_inicio ?? null,
      vigencia_fim_derivada: latestHistorico?.end ?? contrato.vigencia_fim ?? null,
      situacao_derivada_motivo: 'rescisao_ou_cancelamento_no_historico',
    };
  }

  if (latestHistorico) {
    const active = latestHistorico.end >= todayIso;
    return {
      situacao_derivada: active,
      vigencia_inicio_derivada: latestHistorico.start,
      vigencia_fim_derivada: latestHistorico.end,
      situacao_derivada_motivo: active
        ? 'historico_vigente'
        : 'historico_vencido_sem_renovacao',
    };
  }

  const fallbackEnd = contrato.vigencia_fim ?? null;
  const active = Boolean(fallbackEnd && fallbackEnd >= todayIso);

  return {
    situacao_derivada: active,
    vigencia_inicio_derivada: contrato.vigencia_inicio ?? null,
    vigencia_fim_derivada: fallbackEnd,
    situacao_derivada_motivo: active
      ? 'fallback_sem_historico_vigente'
      : 'fallback_sem_historico_vencido_ou_sem_data',
  };
}

const extractUgCode = (value: unknown) => String(value ?? '').match(/\b\d{6}\b/)?.[0] ?? null;

const getFaturaRawData = (fatura: ContratoApiStatusFatura | Record<string, unknown>) => {
  if ('raw_data' in fatura && fatura.raw_data && typeof fatura.raw_data === 'object') {
    return fatura.raw_data;
  }
  return fatura;
};

export const getContratoApiFaturaContratanteCodigo = (fatura: ContratoApiStatusFatura | Record<string, unknown>) => {
  const raw = getFaturaRawData(fatura);
  return extractUgCode(
    raw.contratante ??
      raw.contratante_codigo ??
      raw.unidade_contrato ??
      raw.unidade_gestora,
  );
};

export function isContratoApiCampusEmpenho(
  empenho: ContratoApiStatusEmpenho,
  campusUg = CONTRATOS_API_CAMPUS_UG,
) {
  return String(empenho.unidade_gestora ?? '').trim() === campusUg;
}

export function isContratoApiCampusFatura(
  fatura: ContratoApiStatusFatura | Record<string, unknown>,
  campusUg = CONTRATOS_API_CAMPUS_UG,
) {
  return getContratoApiFaturaContratanteCodigo(fatura) === campusUg;
}

export function isContratoApiDisplayFatura(
  fatura: ContratoApiStatusFatura | Record<string, unknown>,
  campusUg = CONTRATOS_API_CAMPUS_UG,
) {
  const contratanteCodigo = getContratoApiFaturaContratanteCodigo(fatura);
  return !contratanteCodigo || contratanteCodigo === campusUg;
}

export function isContratoApiNonCurraisNovosScope(contrato: ContratoApiStatusContrato) {
  const text = normalizeText(contrato.objeto);
  if (!text) return false;
  if (text.includes('currais novos')) return false;
  return NON_CURRAIS_CAMPUS_TEXT_SIGNALS.some((signal) => text.includes(signal));
}

export function deriveContratoApiCampusScope(
  contrato: ContratoApiStatusContrato,
  empenhos: ContratoApiStatusEmpenho[],
  faturas: ContratoApiStatusFatura[],
  campusUg = CONTRATOS_API_CAMPUS_UG,
  reitoriaUg = CONTRATOS_API_REITORIA_UG,
): ContratoApiCampusScope {
  if (contrato.unidade_codigo === campusUg || contrato.unidade_origem_codigo === campusUg) {
    if (isContratoApiNonCurraisNovosScope(contrato)) {
      return { inScope: false, campus_scope_reason: 'ug_campus_objeto_fora_currais_novos' };
    }
    return { inScope: true, campus_scope_reason: 'ug_campus' };
  }

  const isReitoria = contrato.unidade_codigo === reitoriaUg || contrato.unidade_origem_codigo === reitoriaUg;
  if (!isReitoria) {
    return { inScope: false, campus_scope_reason: 'fora_do_escopo_campus' };
  }

  if (empenhos.some((empenho) => isContratoApiCampusEmpenho(empenho, campusUg))) {
    return { inScope: true, campus_scope_reason: 'reitoria_com_empenho_campus' };
  }

  if (faturas.some((fatura) => isContratoApiCampusFatura(fatura, campusUg))) {
    return { inScope: true, campus_scope_reason: 'reitoria_com_fatura_campus' };
  }

  return { inScope: false, campus_scope_reason: 'reitoria_sem_evidencia_operacional_campus' };
}

export function buildContratoApiDerivedFields(
  contrato: ContratoApiStatusContrato,
  historico: ContratoApiStatusHistorico[],
  empenhos: ContratoApiStatusEmpenho[],
  faturas: ContratoApiStatusFatura[],
  today = new Date(),
) {
  let status = deriveContratoApiStatus(contrato, historico, today);

  // Exception: if the history has expired, but the contract is active in Comprasnet (situacao = true),
  // AND it has recent faturas (invoices) in the last 120 days, we consider it active.
  if (!status.situacao_derivada && contrato.situacao) {
    const todayTime = today.getTime();
    const hundredTwentyDaysAgo = todayTime - 120 * 24 * 60 * 60 * 1000;

    const hasRecentFatura = faturas.some((fatura) => {
      const dateStr = fatura.data_emissao || fatura.data_pagamento;
      if (!dateStr) return false;
      const faturaTime = new Date(`${dateStr}T00:00:00Z`).getTime();
      return !Number.isNaN(faturaTime) && faturaTime >= hundredTwentyDaysAgo;
    });

    if (hasRecentFatura) {
      status = {
        situacao_derivada: true,
        vigencia_inicio_derivada: status.vigencia_inicio_derivada,
        vigencia_fim_derivada: status.vigencia_fim_derivada,
        situacao_derivada_motivo: 'historico_vencido_com_fatura_recente',
      };
    }
  }

  const scope = deriveContratoApiCampusScope(contrato, empenhos, faturas);

  return {
    ...status,
    campus_scope_reason: scope.campus_scope_reason,
    situacao_derivada: status.situacao_derivada && scope.inScope,
  };
}
