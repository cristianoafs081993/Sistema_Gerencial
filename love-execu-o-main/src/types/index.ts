export interface Atividade {
  id: string;
  dimensao: string;
  dimensaoId?: string;
  componenteFuncional: string;
  componenteFuncionalId?: string;
  processo?: string;
  atividade: string;
  descricao: string;
  valorTotal: number;
  origemRecurso: string;
  origemRecursoId?: string;
  naturezaDespesa: string;
  naturezaDespesaId?: string;
  planoInterno: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperacaoEmpenho {
  data: string;
  operacao: 'INCLUSAO' | 'REFORCO' | 'ANULACAO' | string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface Empenho {
  id: string;
  numero: string;
  descricao: string;
  valor: number;
  dimensao: string;
  dimensaoId?: string;
  componenteFuncional: string;
  componenteFuncionalId?: string;
  origemRecurso: string;
  origemRecursoId?: string;
  naturezaDespesa: string;
  naturezaDespesaId?: string;
  planoInterno?: string;
  favorecidoNome?: string;
  favorecidoDocumento?: string;
  valorLiquidado?: number;
  valorPago?: number;
  valorLiquidadoOficial?: number;
  valorPagoOficial?: number;
  saldoRapOficial?: number;
  ultimaAtualizacaoSiafi?: Date;
  tipo: 'exercicio' | 'rap';
  rapInscrito?: number;
  rapALiquidar?: number;
  rapLiquidado?: number;
  rapPago?: number;
  dataEmpenho: Date;
  status: 'pendente' | 'liquidado' | 'pago' | 'cancelado';
  atividadeId?: string;
  processo?: string;
  historicoOperacoes?: OperacaoEmpenho[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumoOrcamentario {
  dimensao: string;
  origemRecurso: string;
  valorPlanejado: number;
  valorEmpenhado: number;
  saldoDisponivel: number;
  percentualExecutado: number;
}

export interface Descentralizacao {
  id: string;
  dimensao: string;
  dimensaoId?: string;
  origemRecurso: string;
  origemRecursoId?: string;
  planoInterno?: string;
  valor: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interfaces de Domínio (tabelas de lookup)
export interface DimensaoDB {
  id: string;
  codigo: string;
  nome: string;
}

export interface NaturezaDespesaDB {
  id: string;
  codigo: string;
  nome: string;
}

export interface OrigemRecursoDB {
  id: string;
  codigo: string;
  descricao?: string;
}

export interface ComponenteFuncionalDB {
  id: string;
  dimensaoId: string;
  nome: string;
}

export type Dimensao = {
  codigo: string;
  nome: string;
};

export const DIMENSOES: Dimensao[] = [
  { codigo: 'AD', nome: 'AD - Administração' },
  { codigo: 'AE', nome: 'AE - Atividades Estudantis' },
  { codigo: 'CI', nome: 'CI - Comunicação Institucional' },
  { codigo: 'EN', nome: 'EN - Ensino' },
  { codigo: 'EX', nome: 'EX - Extensão' },
  { codigo: 'GE', nome: 'GE - Gestão Estratégica e Desenvolvimento Institucional' },
  { codigo: 'GO', nome: 'GO - Governança' },
  { codigo: 'GP', nome: 'GP - Gestão de Pessoas' },
  { codigo: 'IE', nome: 'IE - Infraestrutura' },
  { codigo: 'IN', nome: 'IN - Internacionalização' },
  { codigo: 'PI', nome: 'PI - Pesquisa, Pós-Graduação e Inovação' },
  { codigo: 'TI', nome: 'TI - Tecnologia da Informação e Comunicação' },
];

export const COMPONENTES_POR_DIMENSAO: Record<string, string[]> = {
  'AD': [
    '8 - Orçamento',
    '9 - Contabilidade e Finanças',
    '10 - Compras e Licitações',
    '11 - Contratos',
    '12 - Material',
    '13 - Patrimônio'
  ],
  'AE': [
    '1 - Política de Atividades Estudantis',
    '2 - Serviço Social',
    '3 - Saúde Estudantil',
    '4 - Psicologia Escolar',
    '5 - Alimentação e Nutrição',
    'Programas e Projetos de Protagonismo Estudantil'
  ],
  'CI': [
    '13 - Apoio a Eventos Institucionais'
  ],
  'EN': [
    'Política de Ensino - Política de Ensino',
    'Política de Ensino - Planejamento do Ensino',
    'Política de Ensino - Corpo Docente e Técnico do Ensino',
    'Política de Ensino - Representação e Divulgação Institucional',
    'Supervisão Técnica do Ensino - Supervisão Técnica do Ensino',
    'Supervisão Técnica do Ensino - Monitoramento do Ensino',
    'Supervisão Técnica do Ensino - Informações Institucionais do Ensino',
    'Supervisão Técnica do Ensino - Legislação Educacional',
    'Gestão Pedagógica e Desenvolvimento Curricular - Gestão Pedagógica e Desenvolvimento Curricular',
    'Gestão Pedagógica e Desenvolvimento Curricular - Criação e Adequação de Cursos',
    'Gestão Pedagógica e Desenvolvimento Curricular - Acompanhamento do Trabalho Pedagógico',
    'Gestão Pedagógica e Desenvolvimento Curricular - EJA integrada à EPT',
    'Gestão Pedagógica e Desenvolvimento Curricular - Permanência na Graduação',
    'Gestão Pedagógica e Desenvolvimento Curricular - Atividades Acadêmico-Pedagógicas',
    'Avaliação e Regulação do Ensino - Avaliação e Regulação do Ensino',
    'Avaliação e Regulação do Ensino - Procuração e Interlocução Institucional',
    'Avaliação e Regulação do Ensino - Monitoramento institucional e de cursos',
    'Avaliação e Regulação do Ensino - Autorização de Funcionamento de Cursos',
    'Avaliação e Regulação do Ensino - Avaliações e Exames Educacionais Externos',
    'Avaliação e Regulação do Ensino - Revalidação de Diplomas',
    'Educação e Interseccionalidades em Direitos Humanos - Educação e Interseccionalidades em Direitos Humanos',
    'Educação e Interseccionalidades em Direitos Humanos - Educação Especial Inclusiva',
    'Educação e Interseccionalidades em Direitos Humanos - Educação para as Relações Étnico-Raciais',
    'Educação e Interseccionalidades em Direitos Humanos - Educação em Gênero e Diversidades',
    'Tecnologias Educacionais e Educação a Distância - Tecnologias Educacionais e Educação a Distância',
    'Tecnologias Educacionais e Educação a Distância - Programas de Educação a Distância e Ensino Híbrido',
    'Tecnologias Educacionais e Educação a Distância - Recursos e Tecnologias Educacionais',
    'Administração Acadêmica - Administração Acadêmica',
    'Administração Acadêmica - Sistemas de Administração Acadêmica',
    'Administração Acadêmica - Rotinas e Processos Acadêmicos',
    'Administração Acadêmica - Auditorias e Censos Educacionais',
    'Acesso Discente - Acesso Discente',
    'Recursos de Informação e Bibliotecas - Recursos de Informação e Bibliotecas',
    'Recursos de Informação e Bibliotecas - Sistema Integrado de Bibliotecas',
    'Recursos de Informação e Bibliotecas - Repositórios Digitais',
    'Recursos de Informação e Bibliotecas - Arquivos Institucionais',
    'Programas e Projetos de Ensino',
    'Apoio ao Ensino - Apoio ao Ensino',
    'Apoio ao Ensino - Administração Escolar',
    'Apoio ao Ensino - Laboratórios Acadêmicos',
    'Gestão de Esportes Estudantis'
  ],
  'EX': [
    '1 - Política de Extensão',
    '2 - Interação com a Sociedade',
    '3 - Relações com o Mundo do Trabalho',
    '4 - Difusão e Cultura',
    '5 - Gestão da Formação Inicial e Continuada'
  ],
  'GE': [
    '7 - Gestão da Unidade Agrícola/ Industrial-Escola'
  ],
  'GO': [
    '19 - Suporte aos Colegiados de Apoio à Governança do IFRN'
  ],
  'GP': [
    '25 - Cadastro e pagamento de Pessoal',
    '27 - Desenvolvimento de Pessoal',
    '28 - Atenção à Saúde do Servidor'
  ],
  'IE': [
    '14 - Gestão de Manutenção e Engenharia',
    '15 - Gestão de Serviços de Infraestrutura, Logística e Sustentabilidade'
  ],
  'IN': [
    '5 - Relações Internacionais'
  ],
  'PI': [
    '2 - Inovação Tecnológica'
  ],
  'TI': [
    '1 - Política de Tecnologia da Informação e Comunicação',
    '2 - Governança de TIC',
    '4 - Infraestrutura e Operações de TIC'
  ]
};

export interface DocumentoDespesaAPI {
  data: string;
  documento: string;
  documentoResumido: string;
  observacao: string;
  fase: string;
  favorecido: string;
  nomeFavorecido: string;
  codigoFavorecido: string;
  valor: string;
  elemento: string;
  categoria: string;
  grupo: string;
  modalidade: string;
}

export interface DocumentoDespesa {
  id: string;
  documento: string;
  dataEmissao: Date;
  fase: string;
  documentoResumido: string;
  observacao: string;
  favorecidoNome: string;
  favorecidoDocumento: string;
  valor: number;
  elementoDespesa: string;
  naturezaDespesa: string;
  fonteRecurso?: string;
  empenho_id?: string;
  empenhoDocumento?: string;
  valorLiquidado?: number;
  valorRestoPago?: number;
  createdAt: Date;
  updatedAt: Date;
}
