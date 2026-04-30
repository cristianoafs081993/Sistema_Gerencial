import type { DocumentContextSnippet } from '@/lib/documentContextSnippets';

export type EtpInstitutionalContext = {
  id: string;
  campusName: string;
  excerpt: string;
};

export const etpInstitutionalContexts: EtpInstitutionalContext[] = [
  {
    id: 'ifrn-currais-novos',
    campusName: 'Campus Currais Novos',
    excerpt: [
      'O Instituto Federal de Educacao, Ciencia e Tecnologia do Rio Grande do Norte - Campus Currais Novos esta situado na Rua Manoel Lopes Filho, n. 773, bairro Valfredo Galvao, Currais Novos/RN, CEP 59380-000.',
      'A unidade atua como polo educacional e tecnologico da regiao do Serido Potiguar, atendendo municipio sede, zona rural e municipios do entorno, como Acari, Carnauba dos Dantas, Cerro Cora, Florania, Lagoa Nova e Sao Vicente.',
      'Criado em 29 de junho de 2006 como Unidade de Ensino Descentralizada do entao CEFET-RN e integrado ao IFRN pela Lei n. 11.892/2008, o campus consolidou-se como equipamento publico relevante para o desenvolvimento socioeconomico regional.',
      'A infraestrutura compreende blocos academicos, salas de aula climatizadas, biblioteca, auditorio, laboratorios de quimica, processamento de alimentos, informatica e ambientes vinculados aos eixos de alimentos, recursos naturais e tecnologia.',
      'O campus oferta cursos tecnicos integrados, subsequentes, EJA, EAD e superiores, com destaque para Informatica, Alimentos, Licenciatura em Quimica, Tecnologia em Sistemas para Internet e Tecnologia em Alimentos.',
      'Como parametro contextual de escala, a unidade atende aproximadamente 1.400 estudantes ativos em 2026 e conta com cerca de 150 colaboradores entre docentes, tecnicos administrativos e terceirizados, alem do fluxo de comunidade externa e fornecedores.',
      'Em contratacoes vinculadas ao campus, o contexto deve ser usado apenas para enriquecer a descricao da unidade demandante, a escala operacional, a continuidade dos servicos e eventuais desafios logisticos regionais.',
      'O CT Mineral possui gestao administrativa e orcamentaria propria e nao deve ser tratado como patrimonio direto do campus para fins de custeio ordinario, salvo processo licitatorio independente ou convenio especifico.',
    ].join(' '),
  },
];

export const defaultEtpInstitutionalContextId = etpInstitutionalContexts[0]?.id || '';

export function getEtpInstitutionalContextById(id?: string | null) {
  return etpInstitutionalContexts.find((context) => context.id === id) || null;
}

export function buildEtpInstitutionalContextSnippet(context: EtpInstitutionalContext): DocumentContextSnippet {
  return {
    id: `contexto-institucional-${context.id}`,
    kind: 'institucional',
    label: `Contexto institucional - ${context.campusName}`,
    excerpt: context.excerpt,
    sourceType: 'institucional',
  };
}

export function isEtpInstitutionalContextSnippet(snippet: Pick<DocumentContextSnippet, 'kind' | 'sourceType'>) {
  return snippet.kind === 'institucional' || snippet.sourceType === 'institucional';
}
