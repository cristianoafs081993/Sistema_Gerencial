
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mnqhwyrzhgykjlyyqodd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucWh3eXJ6aGd5a2pseXlxb2RkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI3OTg2MiwiZXhwIjoyMDg1ODU1ODYyfQ.lylmodjOxHBtiIb81tKna3kVTebyOqE-1mxhzD0smT0';

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_DATA = {
  'AE': [
    '1 - Política de Atividades Estudantis','2 - Serviço Social','3 - Saúde Estudantil',
    '4 - Psicologia Escolar','5 - Alimentação e Nutrição',
    'Programas e Projetos de Protagonismo Estudantil'
  ],
  'CI': ['13 - Apoio a Eventos Institucionais'],
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
    'Avaliação e Regulação do Ensino - Avaliações e Regulação do Ensino',
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
    'Apoio ao Ensino - Administration Escolar',
    'Apoio ao Ensino - Laboratórios Acadêmicos',
    'Gestão de Esportes Estudantis'
  ],
  'EX': [
    '1 - Política de Extensão','2 - Interação com a Sociedade',
    '3 - Relações com o Mundo do Trabalho','4 - Difusão e Cultura',
    '5 - Gestão da Formação Inicial e Continuada'
  ],
  'GE': ['7 - Gestão da Unidade Agrícola/ Industrial-Escola'],
  'GO': ['19 - Suporte aos Colegiados de Apoio à Governança do IFRN'],
  'GP': [
    '25 - Cadastro e pagamento de Pessoal','27 - Desenvolvimento de Pessoal',
    '28 - Atenção à Saúde do Servidor'
  ],
  'IE': [
    '14 - Gestão de Manutenção e Engenharia',
    '15 - Gestão de Serviços de Infraestrutura, Logística e Sustentabilidade'
  ],
  'IN': ['5 - Relações Internacionais'],
  'PI': ['2 - Inovação Tecnológica'],
  'TI': [
    '1 - Política de Tecnologia da Informação e Comunicação',
    '2 - Governança de TIC',
    '4 - Infraestrutura e Operações de TIC'
  ]
};

async function seedMissingComponents() {
    console.log('Iniciando carga de componentes faltantes...');
    
    const { data: dims, error: errDims } = await supabase.from('dimensoes').select('id, codigo');
    if (errDims) {
        console.error('Erro ao buscar dimensões:', errDims);
        return;
    }

    for (const dim of dims) {
        const components = SEED_DATA[dim.codigo];
        if (components) {
            console.log(`Inserindo ${components.length} componentes para ${dim.codigo}...`);
            const rows = components.map(name => ({
                dimensao_id: dim.id,
                nome: name
            }));
            
            const { error: errIns } = await supabase
                .from('componentes_funcionais')
                .upsert(rows, { onConflict: 'dimensao_id, nome' });
                
            if (errIns) {
                console.error(`Erro ao inserir para ${dim.codigo}:`, errIns);
            }
        }
    }
    console.log('Carga concluída.');
}

seedMissingComponents();
