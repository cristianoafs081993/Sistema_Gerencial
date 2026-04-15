export const dataQueryKeys = {
  atividades: ['atividades'] as const,
  empenhos: ['empenhos'] as const,
  descentralizacoes: ['descentralizacoes'] as const,
  descentralizacoesContaSaldos: ['descentralizacoes_conta_saldos'] as const,
  contratos: ['contratos'] as const,
  contratosEmpenhos: ['contratos_empenhos'] as const,
  creditosDisponiveis: ['creditos_disponiveis'] as const,
};

export const allDataQueryKeys = [
  dataQueryKeys.atividades,
  dataQueryKeys.empenhos,
  dataQueryKeys.descentralizacoes,
  dataQueryKeys.descentralizacoesContaSaldos,
  dataQueryKeys.contratos,
  dataQueryKeys.contratosEmpenhos,
  dataQueryKeys.creditosDisponiveis,
] as const;
