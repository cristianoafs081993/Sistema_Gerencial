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
