# PRD - Editor Inteligente de Atos Administrativos

## 📈 Visão Geral
Transformar a criação de documentos administrativos (ETP, TR, Minutas) em um processo assistido por Inteligência Artificial, garantindo conformidade legal e diminuindo drasticamente o retrabalho em processos licitatórios.

## 👥 Público-Alvo
- Servidores do Financeiro/Compras.
- Gestores de Contrato.
- Fiscais de Atividades.

## 🚀 Funcionalidades Principais

### 1. Editor de Texto Rico (Powered by Tiptap)
- **Headless UI**: Toolbar customizada com design system do Sistema Gerencial.
- **Seções Dinâmicas**: Divisão do documento em blocos editáveis conforme o template.
- **Exportação**: Copiar HTML formatado ou gerar PDF (futuro).

### 2. Sistema de Templates Inteligentes
- **ETP (Estudo Técnico Preliminar)**
- **TR (Termo de Referência)**
- **Minuta de Contrato**
- **Despacho de Autorização de Despesa** (Migrado do Gerador anterior).
- **Contrato de Serviço IFRN**: gera minuta a partir do PDF sincronizado do processo, reutilizando o modelo contratual presente no próprio processo licitatório.

### 2.1 Regras operacionais do contrato assistido
- A IA deve usar como base o modelo ou a minuta de contrato localizado dentro do processo, e não um template genérico fixo.
- O preenchimento deve priorizar dados extraídos do próprio processo: vencedora, CNPJ, objeto, valores, vigência, itens e referências do Termo de Referência.
- Quando houver mais de um modelo contratual no mesmo PDF, o usuário precisa escolher qual minuta deve ser usada antes da geração.
- Quando o PDF não tiver texto pesquisável ou não trouxer minuta clara de contrato, a geração deve ser bloqueada para revisão manual.

### 2.2 Regras operacionais do TR assistido para compras
- O Termo de Referencia deve partir do modelo DOCX oficial vigente publicado em uma tela administrativa separada do editor.
- O preenchimento deve combinar dados do processo sincronizado, trechos relevantes do PDF e exigencias recorrentes da Lei 14.133/2021, sem inventar informacao ausente.
- A saida principal continua editavel no editor, mas o usuario deve poder baixar o DOCX final preservando a estrutura do modelo publicado.
- Quando nao houver modelo ativo ou quando o PDF do processo nao tiver texto pesquisavel, a geracao deve ser bloqueada para revisao manual.

### 2.3 Regras operacionais do ETP assistido para servicos continuos
- O Estudo Tecnico Preliminar de servicos continuos deve funcionar no Editor de Documentos sem modelo DOCX no v1.
- O usuario pode informar um processo SUAP sincronizado ou digitar manualmente o objeto da licitacao.
- Quando houver PDF sincronizado e pesquisavel, o sistema extrai trechos de apoio e solicita sugestoes com fonte explicita antes da revisao manual.
- Quando nao houver PDF, quando o PDF nao tiver texto pesquisavel ou quando a sugestao falhar, o fluxo continua pelo questionario fixo do ETP.
- Em cada etapa do questionario, o usuario pode solicitar geracao de texto da secao com IA a partir de poucas notas ou mesmo sem digitacao previa; o texto gerado permanece editavel e deve sinalizar pendencias quando faltarem dados concretos.
- Campos sem fonte segura ou sem resposta do usuario permanecem como pendencias no rascunho; a IA nao deve inventar informacao ausente.
- A saida v1 e um rascunho editavel no editor com acoes de copiar documento e copiar secoes. Exportacao DOCX, OCR e persistencia de rascunhos ficam fora do v1.

### 3. Painel de Conformidade IA
- **Análise em Tempo Real**: Verificação de conformidade ao longo da escrita.
- **Categorias de Alerta**:
  - 🟢 **Operacional**: Verificação de cálculos e dados técnicos.
  - 🔵 **Legal**: Adequação à Lei 14.133 e outras normativas federais.
  - 🟣 **Normativo**: Citações de INs (Instruções Normativas) vigentes.
  - 🟠 **Histórico**: Alertas baseados em falhas recorrentes de auditoria.

### 4. Navegação Lateral
- Índice dinâmico do documento.
- Status de conclusão de cada seção (Pendente, Em Escrita, Concluído).

## 🎨 Design UI/UX (Diretrizes)
- **Layout de 3 Colunas**:
  - **Esquerda**: Navegação de Seções / Status.
  - **Centro**: Editor de Texto (Foco no Conteúdo).
  - **Direita**: Painel de Sugestões e Conformidade IA.
- **Estética**: Manter o conceito de "Sistema Gerencial" (Glassmorphism, sombreamento `shadow-lifted`, paleta slate/blue).

## 🛠️ Stack Técnica
- **Frontend**: React, Tiptap, Framer Motion, Tailwind CSS.
- **Backend/IA**: Supabase Edge Functions + OpenAI/Gemini API para análise de conformidade.
- **Estilos**: Tailwind Typography (`prose`) para o editor.

---
*— Morgan, planejando o futuro 📊*
