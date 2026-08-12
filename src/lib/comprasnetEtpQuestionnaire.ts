export type ComprasnetEtpQuestion = {
  id: string;
  sectionTitle: string;
  title: string;
  prompt: string;
  guidance: string;
  required: boolean;
};

export type ComprasnetEtpAnswer = {
  questionId: string;
  value?: string;
  skipped?: boolean;
  origin?: 'user' | 'ai' | 'system';
};

export const comprasnetEtpQuestions: ComprasnetEtpQuestion[] = [
  {
    id: 'necessidade',
    sectionTitle: 'Descrição da necessidade',
    title: 'Descrição da necessidade',
    prompt: 'Explique o problema ou a necessidade administrativa que justifica a contratação.',
    guidance: 'Descreva o interesse público atendido e o resultado que se pretende alcançar, sem inventar fatos.',
    required: true,
  },
  {
    id: 'requisitos',
    sectionTitle: 'Descrição dos Requisitos da Contratação',
    title: 'Requisitos da contratação',
    prompt: 'Liste os requisitos técnicos, operacionais, legais e de qualidade indispensáveis à contratação.',
    guidance: 'Inclua somente requisitos compatíveis com o objeto e com a competição do certame.',
    required: true,
  },
  {
    id: 'mercado',
    sectionTitle: 'Levantamento de Mercado',
    title: 'Levantamento de mercado',
    prompt: 'Descreva as alternativas de mercado consideradas e a justificativa da solução escolhida.',
    guidance: 'Compare soluções possíveis e registre as razões técnicas e econômicas da escolha.',
    required: true,
  },
  {
    id: 'solucao',
    sectionTitle: 'Descrição da solução como um todo',
    title: 'Descrição da solução como um todo',
    prompt: 'Descreva a solução escolhida de forma integrada, incluindo escopo, execução, vigência e resultados esperados.',
    guidance: 'Conecte a solução à necessidade e aos requisitos já identificados.',
    required: true,
  },
  {
    id: 'quantitativos',
    sectionTitle: 'Estimativa das Quantidades a serem Contratadas',
    title: 'Estimativa das quantidades',
    prompt: 'Informe as quantidades estimadas e a memória de cálculo ou os critérios utilizados.',
    guidance: 'Não invente números. Marque como pendente aquilo que depender de validação técnica.',
    required: true,
  },
  {
    id: 'estimativa_valor',
    sectionTitle: 'Estimativa do Valor da Contratação',
    title: 'Estimativa do valor da contratação',
    prompt: 'Apresente o valor estimado e a metodologia ou pesquisa utilizada para calculá-lo.',
    guidance: 'Não crie valores, fontes ou datas que não estejam nos dados fornecidos.',
    required: true,
  },
  {
    id: 'parcelamento',
    sectionTitle: 'Justificativa para o Parcelamento ou não da Solução',
    title: 'Justificativa para o parcelamento',
    prompt: 'Justifique o parcelamento ou o não parcelamento da solução sob os aspectos técnico e econômico.',
    guidance: 'Considere competitividade, ganho de escala, responsabilidade e gestão contratual.',
    required: true,
  },
  {
    id: 'correlatas',
    sectionTitle: 'Contratações Correlatas e/ou Interdependentes',
    title: 'Contratações correlatas ou interdependentes',
    prompt: 'Identifique contratações relacionadas ou dependências que possam afetar a solução.',
    guidance: 'Se não houver, registre expressamente a inexistência após revisão do processo.',
    required: false,
  },
  {
    id: 'planejamento',
    sectionTitle: 'Alinhamento entre a Contratação e o Planejamento',
    title: 'Alinhamento ao planejamento',
    prompt: 'Informe como a contratação se relaciona ao planejamento institucional e ao PCA, quando aplicável.',
    guidance: 'Use apenas referências de planejamento presentes no processo ou fornecidas pelo usuário.',
    required: true,
  },
  {
    id: 'resultados',
    sectionTitle: 'Benefícios a serem alcançados com a contratação',
    title: 'Benefícios pretendidos',
    prompt: 'Descreva os benefícios, resultados e ganhos de eficiência esperados com a contratação.',
    guidance: 'Relacione os benefícios ao interesse público e à necessidade identificada.',
    required: true,
  },
  {
    id: 'providencias',
    sectionTitle: 'Providências a serem Adotadas',
    title: 'Providências prévias',
    prompt: 'Indique as providências necessárias antes da contratação e do início da execução.',
    guidance: 'Considere equipe, fiscalização, capacitação, adequações físicas e cronograma de transição.',
    required: false,
  },
  {
    id: 'ambiental',
    sectionTitle: 'Possíveis Impactos Ambientais',
    title: 'Impactos ambientais e sustentabilidade',
    prompt: 'Avalie os possíveis impactos ambientais e as medidas de sustentabilidade aplicáveis.',
    guidance: 'Considere ciclo de vida, resíduos, consumo de recursos e critérios ambientais pertinentes.',
    required: false,
  },
  {
    id: 'conclusao',
    sectionTitle: 'Declaração de Viabilidade',
    title: 'Declaração de viabilidade',
    prompt: 'Apresente a conclusão sobre a viabilidade da contratação, indicando condicionantes ou pendências.',
    guidance: 'A conclusão deve refletir as informações efetivamente confirmadas nas seções anteriores.',
    required: true,
  },
];

export function normalizeComprasnetEtpText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function getComprasnetEtpQuestion(id: string) {
  return comprasnetEtpQuestions.find((question) => question.id === id);
}

