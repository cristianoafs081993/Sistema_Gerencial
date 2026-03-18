# Governança e Eficiência Alocativa: Alinhamento entre Planejamento Estratégico e Execução Orçamentária no IFRN - Campus Currais Novos

## 1. Introdução

### 1.1 Contextualização
A Administração Pública gerencial impõe a necessidade de superar o modelo burocrático rígido em favor de uma gestão focada em resultados e eficiência. Nos Institutos Federais, a autonomia administrativa e financeira dos campi é um pilar central, mas traz consigo o desafio da **governança orçamentária** em um cenário de escassez de recursos e rigidez de despesas.
O Plano de Desenvolvimento Institucional (PDI) define a estratégia, mas a execução orçamentária (o dispêndio diário) muitas vezes segue uma lógica incremental e desvinculada das metas de longo prazo, gerando um "gap" de implementação.

### 1.2 Problema de Pesquisa
No Campus Currais Novos do IFRN, o processo de gestão orçamentária enfrenta gargalos que comprometem a eficiência e a transparência:
1.  **Assimetria de Informação:** Gestores tomam decisões sem acesso consolidado aos dados reais de execução (empenhos e liquidações), que residem em sistemas complexos (SIAFI/Tesouro) e desconectados do planejamento local.
2.  **Desconexão Estratégica:** A alocação de recursos muitas vezes não possui rastreabilidade clara com as metas do PDI, dificultando a mensuração da eficácia do gasto.
3.  **Ineficiência Processual:** O retrabalho anual no cadastramento de planos de ação desconexos de séries históricas consome tempo precioso das equipes administrativas.

**Pergunta de Pesquisa:** *Como a estruturação de urn modelo de gestão orçamentária automatizado pode mitigar a assimetria de informação e ampliar o alinhamento entre o planejamento estratégico institucional e a execução financeira no IFRN - Campus Currais Novos?*

### 1.3 Objetivos

**Objetivo Geral:**
Analisar o alinhamento entre o planejamento estratégico e a execução orçamentária no IFRN - Campus Currais Novos, propondo e validando um instrumento técnico de intervenção para aprimorar a governança e a eficiência alocativa.

**Objetivos Específicos:**
1.  **Diagnosticar** o fluxo atual de planejamento e execução orçamentária do Campus, identificando os principais pontos de gargalo, retrabalho e opacidade de informações.
2.  **Mapear** os requisitos de governança necessários para conectar as metas do PDI às notas de empenho e liquidação, estabelecendo indicadores de desempenho orçamentário.
3.  **Desenvolver** um modelo de gestão que sistematize o reuso de planejamento e a automação da consulta de dados financeiros.
4.  **Implementar**, como Produto Técnico e Tecnológico (PTT), um sistema informatizado ("Love Execução") que operacionalize esse modelo, integrando dados via API para suporte à tomada de decisão.

### 1.4 Justificativa
A pesquisa justifica-se pela necessidade de **qualificar o gasto público**. Mais do que controlar "quanto" se gasta, é preciso saber "como" e "para quê" se gasta.
A aderência ao PROFIAP se dá pela proposta de intervir na realidade organizacional, utilizando a tecnologia não como fim, mas como meio para instaurar uma cultura de **transparência ativa** e **eficiência administrativa**. O PTT resultante não é apenas um software, mas a materialização de um novo fluxo de trabalho que elimina burocracia (automatização) e amplia a accountability.

---

## 2. Fundamentação Teórica Preliminar
A pesquisa dialogará com autores seminais sobre:
- **Orçamento Público e Estratégia:** A necessidade de vincular o orçamento (LOA) ao planejamento (PDI) para garantir a efetividade das políticas públicas (Giacomoni, Matias-Pereira).
- **Governança de TI:** O uso de Artefatos Tecnológicos em Gestão (Design Science Research) como ferramentas para reduzir a assimetria de informação e custos de transação.
- **New Public Management (NPM):** A busca por eficiência, redução de retrabalho e foco no cidadão/usuário.

---

## 3. Metodologia

### 3.1 Classificação
- **Natureza:** Pesquisa Aplicada.
- **Estratégia:** Estudo de Caso com Intervenção (Design Science Research - DSR). A DSR é adequada pois busca criar e avaliar um *artefato* (o modelo + software) para resolver um problema relevante.

### 3.2 Procedimetos Metodológicos
1.  **Fase Exploratória (Diagnóstico):** Análise documental (Relatórios de Gestão, PDI) e entrevistas com gestores do Campus Currais Novos para entender as "dores" do processo atual.
2.  **Fase de Construção (Desenvolvimento do PTT):** Elaboração do software que consome dados da API da Transparência e permite o gerenciamento de planos de atividade.
    *   *Nota Técnica:* O software já conta com arquitetura definida (React/Node.js) e integração via API, focando na usabilidade para o gestor público.
3.  **Fase de Validação (Avaliação):** Implantação piloto no Campus. A avaliação focará em:
    *   **Utilidade:** O sistema fornece as informações necessárias para decisão?
    *   **Eficiência:** Houve redução no tempo de elaboração de planos e consulta de saldos?
    *   **Alinhamento:** É possível visualizar a execução por dimensão do PDI?

---

## 4. O Produto Técnico e Tecnológico (PTT)
Conforme exigência do Mestrado Profissional, o trabalho resultará em:
- **Tipo:** Produto Técnico e Tecnológico (Modalidade Software/Sistema de Gestão).
- **Descrição:** Uma plataforma web que integra o ciclo de planejamento (cadastro de atividades vinculadas ao PDI) com o ciclo de execução (importação automática de empenhos).
- **Impacto Esperado:** Modernização administrativa do Campus Currais Novos, servindo de modelo replicável para outras unidades da Rede Federal.

---

## 5. Estrutura Provisória da Dissertação
1.  **Introdução**
2.  **Referencial Teórico** (Governança, Orçamento e TI na Gestão Pública)
3.  **Metodologia** (DSR e Procedimentos)
4.  **Análise Situacional do Campus Currais Novos** (Diagnóstico)
5.  **A Solução Proposta: Modelo de Gestão e PTT** (Apresentação do Artefato)
6.  **Análise dos Resultados e Validação**
7.  **Considerações Finais**
