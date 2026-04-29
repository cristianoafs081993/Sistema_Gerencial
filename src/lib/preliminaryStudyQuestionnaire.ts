export type PreliminaryStudyQuestionKind = 'field' | 'conclusion';

export type PreliminaryStudyQuestion = {
  id: string;
  kind: PreliminaryStudyQuestionKind;
  title: string;
  prompt: string;
  guidance: string;
  placeholder: string;
  required: boolean;
};

export type PreliminaryStudyQuestionAnswer = {
  questionId: string;
  value?: string;
  skipped?: boolean;
  origin?: 'user' | 'ai' | 'system';
  approved?: boolean;
  confidence?: 'high' | 'medium';
  sourcePage?: number;
  sourceType?: 'processo' | 'anexo' | 'etp';
  sourceLabel?: string;
  sourceExcerpt?: string;
  justification?: string;
};

export type PreliminaryStudyQuestionSuggestion = {
  questionId: string;
  status: 'suggested' | 'unanswered';
  value?: string;
  justification?: string;
  sourcePage?: number;
  sourceType?: 'processo' | 'anexo' | 'etp';
  sourceLabel?: string;
  sourceExcerpt?: string;
  confidence?: 'high' | 'medium';
};

export const preliminaryStudyQuestions: PreliminaryStudyQuestion[] = [
  {
    id: 'necessidade',
    kind: 'field',
    title: 'Necessidade da contratacao',
    prompt: 'Explique a necessidade administrativa que justifica a contratacao do servico continuo.',
    guidance: 'Use o DFD, a justificativa do processo ou a descricao do problema a resolver. Nao descreva apenas o objeto.',
    placeholder: 'Ex.: garantir a continuidade dos servicos de limpeza e conservacao das areas academicas e administrativas.',
    required: true,
  },
  {
    id: 'planejamento',
    kind: 'field',
    title: 'Alinhamento ao planejamento',
    prompt: 'Informe o alinhamento com PCA, planejamento institucional ou demanda formalizada.',
    guidance: 'Se nao houver referencia segura no processo, deixe como pendencia.',
    placeholder: 'Ex.: contratacao prevista no PCA 2026, item...',
    required: false,
  },
  {
    id: 'requisitos',
    kind: 'field',
    title: 'Requisitos da contratacao',
    prompt: 'Liste requisitos tecnicos e operacionais essenciais para o servico continuo.',
    guidance: 'Inclua postos, jornada, dedicacao exclusiva, regime de execucao, qualificacao minima ou cobertura esperada quando aplicavel.',
    placeholder: 'Ex.: prestacao continua, com mao de obra residente, jornada de 44 horas semanais e supervisao local.',
    required: false,
  },
  {
    id: 'quantitativos',
    kind: 'field',
    title: 'Estimativa de quantidades',
    prompt: 'Informe quantitativos, postos, areas atendidas, periodicidade ou memoria de calculo da demanda.',
    guidance: 'Este e elemento minimo do ETP. Use fonte do processo ou registre pendencia.',
    placeholder: 'Ex.: 6 postos de auxiliar de servicos gerais para area aproximada de...',
    required: true,
  },
  {
    id: 'mercado',
    kind: 'field',
    title: 'Levantamento de mercado',
    prompt: 'Descreva alternativas de mercado consideradas e por que a solucao pretendida e adequada.',
    guidance: 'Pode incluir praticas usuais de terceirizacao, contratacao por postos, produtividade ou solucao por escopo.',
    placeholder: 'Ex.: o mercado oferta o servico por postos de trabalho com produtividade minima definida em edital.',
    required: false,
  },
  {
    id: 'estimativa_valor',
    kind: 'field',
    title: 'Estimativa do valor',
    prompt: 'Informe valor estimado e base de calculo ou pesquisa de precos.',
    guidance: 'Este e elemento minimo do ETP. Nao invente valor ausente.',
    placeholder: 'Ex.: valor anual estimado de R$ ..., conforme planilha de custos e formacao de precos.',
    required: true,
  },
  {
    id: 'solucao',
    kind: 'field',
    title: 'Descricao da solucao como um todo',
    prompt: 'Descreva a solucao escolhida, incluindo escopo, forma de execucao e resultado esperado.',
    guidance: 'A redacao deve conectar necessidade, requisitos, execucao continua e atendimento institucional.',
    placeholder: 'Ex.: contratacao de empresa especializada para prestacao continua de...',
    required: false,
  },
  {
    id: 'parcelamento',
    kind: 'field',
    title: 'Justificativa de parcelamento',
    prompt: 'Justifique o parcelamento ou nao parcelamento da solucao.',
    guidance: 'Este e elemento minimo do ETP. Para servicos continuos, explique se ha unidade tecnica/economica do objeto.',
    placeholder: 'Ex.: nao se recomenda parcelamento por risco de perda de coordenacao operacional e responsabilizacao.',
    required: true,
  },
  {
    id: 'resultados',
    kind: 'field',
    title: 'Resultados pretendidos',
    prompt: 'Informe ganhos esperados com a contratacao.',
    guidance: 'Relacione continuidade, qualidade, economicidade, seguranca, disponibilidade ou atendimento a comunidade.',
    placeholder: 'Ex.: manutencao das condicoes de higiene, salubridade e funcionamento regular das unidades atendidas.',
    required: false,
  },
  {
    id: 'providencias',
    kind: 'field',
    title: 'Providencias previas',
    prompt: 'Indique providencias necessarias antes da contratacao.',
    guidance: 'Inclua fiscalizacao, designacao de equipe, adequacao de espacos, cronograma de transicao ou ausencia de providencias.',
    placeholder: 'Ex.: designar equipe de fiscalizacao e validar locais de prestacao antes do inicio da execucao.',
    required: false,
  },
  {
    id: 'correlatas',
    kind: 'field',
    title: 'Contratacoes correlatas ou interdependentes',
    prompt: 'Indique contratacoes relacionadas ou dependencias relevantes.',
    guidance: 'Se inexistentes, registre isso expressamente com base no conhecimento do processo.',
    placeholder: 'Ex.: nao foram identificadas contratacoes interdependentes para execucao do servico.',
    required: false,
  },
  {
    id: 'ambiental',
    kind: 'field',
    title: 'Impactos ambientais e sustentabilidade',
    prompt: 'Informe impactos ambientais e medidas de sustentabilidade aplicaveis.',
    guidance: 'Para servicos continuos, considere insumos, descarte, eficiencia, treinamento e normas ambientais aplicaveis.',
    placeholder: 'Ex.: exigencia de saneantes regularizados, gestao adequada de residuos e reducao de desperdicio de insumos.',
    required: false,
  },
  {
    id: 'conclusao',
    kind: 'conclusion',
    title: 'Conclusao de viabilidade',
    prompt: 'Registre o posicionamento conclusivo sobre a viabilidade da contratacao.',
    guidance: 'Este e elemento minimo do ETP. Deve concluir pela viabilidade ou apontar pendencias impeditivas.',
    placeholder: 'Ex.: conclui-se pela viabilidade da contratacao, condicionada a validacao da estimativa de valor.',
    required: true,
  },
];

export function normalizePreliminaryStudyAnswerValue(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function isPreliminaryStudyQuestionAnswered(answer?: Pick<PreliminaryStudyQuestionAnswer, 'value' | 'skipped'>) {
  if (!answer || answer.skipped) return false;
  return normalizePreliminaryStudyAnswerValue(answer.value).length > 0;
}

export function buildPreliminaryStudyQuestionnaireAnswers(
  answers: Record<string, PreliminaryStudyQuestionAnswer>,
) {
  return preliminaryStudyQuestions.map((question) => {
    const answer = answers[question.id];
    return answer && (isPreliminaryStudyQuestionAnswered(answer) || answer.skipped)
      ? answer
      : {
          questionId: question.id,
          skipped: true,
        };
  });
}

export function getPreliminaryStudyMissingRequiredFields(answers: PreliminaryStudyQuestionAnswer[]) {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

  return preliminaryStudyQuestions
    .filter((question) => question.required && !isPreliminaryStudyQuestionAnswered(answerByQuestion.get(question.id)))
    .map((question) => question.title);
}

export function buildInitialPreliminaryStudyAnswers(manualObject?: string | null) {
  const objectValue = normalizePreliminaryStudyAnswerValue(manualObject);
  if (!objectValue) return {};

  return {
    solucao: {
      questionId: 'solucao',
      value: objectValue,
      origin: 'user' as const,
      skipped: false,
    },
  } satisfies Record<string, PreliminaryStudyQuestionAnswer>;
}
