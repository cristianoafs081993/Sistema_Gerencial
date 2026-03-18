# Integração entre o PDI e a Execução Orçamentária: Desenvolvimento de um Sistema Web para Gestão Orçamentária na Diretoria de Administração de um Instituto Federal

## 1. Introdução

### 1.1 Contextualização
- O ciclo orçamentário na administração pública federal (PPA, LOA, LDO)
- O **Plano de Desenvolvimento Institucional (PDI)** como instrumento estratégico dos Institutos Federais
- A importância da **integração entre o PDI e a execução orçamentária** para garantir que os recursos sejam aplicados de acordo com as metas institucionais
- O papel da Diretoria de Administração (DIAD) como unidade gestora responsável por operacionalizar o orçamento

### 1.2 Problemática
- Dificuldade em monitorar se a execução orçamentária está alinhada às **dimensões e objetivos do PDI**
- O PDI estabelece metas, mas o acompanhamento da execução financeira é feito de forma desconectada
- Uso de planilhas isoladas, gerando retrabalho e risco de inconsistências
- Falta de visibilidade em tempo real sobre quanto do orçamento está sendo direcionado a cada dimensão do PDI

### 1.3 Justificativa
- O PDI é obrigatório para as IFES (Lei 10.861/2004) e deve nortear todas as ações institucionais
- A execução orçamentária precisa refletir as prioridades definidas no PDI
- Contribuição para a melhoria da gestão estratégica e orçamentária em IFs
- Alinhamento com os princípios de governança, eficiência e transparência
- Aplicabilidade imediata do produto na DIAD

### 1.4 Objetivos

**Geral:**
Desenvolver uma ferramenta tecnológica que integre o Plano de Desenvolvimento Institucional (PDI) à execução orçamentária, proporcionando maior controle, transparência e alinhamento estratégico na gestão de recursos públicos.

**Específicos:**
1. Mapear as dimensões e objetivos do PDI que possuem desdobramento orçamentário.
2. Identificar o fluxo atual de execução orçamentária na DIAD e sua relação com o PDI.
3. Desenvolver um sistema web que permita o cadastro de atividades vinculadas ao PDI e o acompanhamento de empenhos.
4. Implementar dashboards gerenciais para visualização de indicadores por dimensão do PDI.
5. Validar o sistema junto aos servidores da DIAD.

---

## 2. Referencial Teórico

### 2.1 O Plano de Desenvolvimento Institucional (PDI)
- Conceito, fundamentação legal e finalidade (Lei 10.861/2004, Decreto 5.773/2006)
- Estrutura do PDI: missão, visão, valores, eixos/dimensões, objetivos estratégicos, metas
- O PDI como instrumento de gestão estratégica nas IFES
- Dimensões típicas do PDI em Institutos Federais (Ensino, Pesquisa, Extensão, Infraestrutura, Gestão, etc.)

### 2.2 Gestão Orçamentária na Administração Pública
- Ciclo orçamentário: planejamento, execução, controle e avaliação
- Marco legal: Lei 4.320/64, Lei de Responsabilidade Fiscal (LRF), Decreto 93.872/86
- Conceitos fundamentais: empenho, liquidação, pagamento, créditos orçamentários

### 2.3 Alinhamento Estratégico: PDI e Orçamento
- O **gap** entre o planejado (PDI) e o executado (orçamento) nas organizações públicas
- A necessidade de traduzir os objetivos do PDI em ações orçamentárias
- Indicadores de desempenho: taxa de execução por dimensão, saldo disponível, desvio orçamentário
- O orçamento como instrumento de materialização do PDI

### 2.4 Governança e Transparência
- Princípios da governança pública (TCU, IBGC)
- Accountability e prestação de contas
- Transparência ativa e acesso à informação

### 2.5 Transformação Digital e Modernização da Gestão
- E-governo e sistemas de informação na administração pública
- Ferramentas de Business Intelligence (BI) para gestão pública
- Dashboards como instrumentos de apoio à decisão

### 2.6 Desenvolvimento de Software para a Administração Pública
- Metodologias ágeis aplicadas ao setor público
- Arquiteturas modernas: SPA (Single Page Application), BaaS (Backend as a Service)
- Tecnologias utilizadas: React, TypeScript, Supabase

---

## 3. Metodologia

### 3.1 Caracterização da Pesquisa
- **Natureza**: Pesquisa aplicada
- **Abordagem**: Qualitativa e quantitativa (mista)
- **Tipo**: Pesquisa tecnológica / Design Science Research (DSR)

### 3.2 Lócus da Pesquisa
- Instituto Federal do Rio Grande do Norte (IFRN) - Campus [Nome]
- Setor: Diretoria de Administração (DIAD)

### 3.3 Etapas da Pesquisa

| Etapa | Descrição | Técnicas |
|-------|-----------|----------|
| 1. Diagnóstico | Mapeamento do PDI e do processo de execução orçamentária | Análise documental, entrevistas |
| 2. Requisitos | Levantamento de necessidades | Brainstorming, observação |
| 3. Desenvolvimento | Construção do sistema | Metodologia ágil, prototipação |
| 4. Validação | Testes e avaliação de usabilidade | Questionário SUS, feedback |

### 3.4 Participantes
- Servidores da DIAD (gestores, ordenadores de despesa, fiscais de contrato)
- Membros da comissão do PDI (se aplicável)
- Servidores das coordenações que demandam recursos

### 3.5 Instrumentos de Coleta
- Roteiro de entrevista semiestruturada
- Questionário de usabilidade (SUS - System Usability Scale)
- Registro de observações

---

## 4. Diagnóstico e Análise do Contexto

### 4.1 O PDI da Instituição
- Vigência do PDI atual
- Dimensões/Eixos estratégicos definidos
- Objetivos e metas que possuem impacto orçamentário
- Exemplo: Dimensão "Infraestrutura" → Objetivo "Modernizar laboratórios" → Demanda orçamentária

### 4.2 O Processo Atual de Execução Orçamentária
- Como as demandas são priorizadas na DIAD
- Como os empenhos são registrados e acompanhados
- Ferramentas utilizadas atualmente (SIAFI, planilhas, e-mails)
- Existe vinculação formal entre empenhos e dimensões do PDI?

### 4.3 Problemas Identificados
- Desconexão entre o PDI e a execução orçamentária
- Dificuldade em responder: "Quanto gastamos com a dimensão Ensino este ano?"
- Dificuldade em saber o saldo disponível por dimensão do PDI ou origem de recurso
- Baixa visibilidade para gestores sobre o alinhamento estratégico

### 4.4 Oportunidades de Melhoria
- Sistema único que vincule atividades orçamentárias às dimensões do PDI
- Dashboard com indicadores por dimensão do PDI em tempo real
- Filtros por dimensão, origem de recurso, natureza de despesa e período
- Relatórios que demonstrem a execução orçamentária organizada pelos eixos do PDI

---

## 5. O Produto: Sistema de Gestão Orçamentária

### 5.1 Arquitetura e Tecnologias
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + autenticação + API REST)
- **Hospedagem**: Vercel (frontend) + Supabase Cloud (backend)

### 5.2 Módulos do Sistema

| Módulo | Funcionalidades |
|--------|-----------------|
| **Atividades** | Cadastro de atividades planejadas vinculadas às **dimensões do PDI**, componente funcional e origem de recurso |
| **Empenhos** | Registro de empenhos com dados de favorecido, valor, natureza de despesa, dimensão do PDI, vínculo com atividade |
| **Dashboard** | Visão consolidada: total planejado vs. empenhado **por dimensão do PDI**, saldo, evolução mensal, funil de execução |
| **Importação** | Carga de dados via planilhas (empenhos e saldos) |

### 5.3 Integração PDI × Execução Orçamentária
- **Atividades** representam as **ações planejadas derivadas do PDI** (vinculadas às dimensões)
- **Empenhos** representam a **execução financeira** dessas ações
- O dashboard mostra a **execução orçamentária organizada pelas dimensões do PDI**
- Possibilidade de vincular empenhos a atividades específicas do planejamento

**Exemplo de fluxo:**
```
PDI (Dimensão: Infraestrutura)
    ↓
Atividade: "Aquisição de mobiliário para laboratórios"
    ↓
Empenho: 2024NE000456 - R$ 50.000,00 - Fornecedor XYZ
    ↓
Dashboard: Infraestrutura → 45% executado do planejado
```

### 5.4 Indicadores Disponíveis

| Indicador | Fórmula |
|-----------|---------|
| Taxa de Execução Global | (Total Empenhado / Total Planejado) × 100 |
| Taxa de Execução por Dimensão do PDI | (Empenhado na Dimensão / Planejado na Dimensão) × 100 |
| Saldo Disponível | Total Planejado - Total Empenhado |
| Execução por Origem de Recurso | Empenhado por fonte de recurso |
| Evolução Mensal | Acumulado de empenhos por mês |

### 5.5 Interface do Sistema
- Screenshots das principais telas
- Descrição dos fluxos de uso
- Responsividade (acesso via desktop e mobile)

---

## 6. Validação e Resultados

### 6.1 Aplicação Piloto
- Período de testes na DIAD
- Dados reais inseridos no sistema (atividades vinculadas ao PDI vigente)
- Acompanhamento da execução organizado pelas dimensões do PDI

### 6.2 Avaliação de Usabilidade
- Aplicação do questionário SUS com servidores
- Análise dos resultados (média, percentil)

### 6.3 Feedback dos Usuários
- Pontos positivos (visualização por dimensão do PDI, agilidade, integração)
- Sugestões de melhoria
- Percepção sobre a utilidade do sistema para o alinhamento estratégico

### 6.4 Comparativo Antes × Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Tempo para consultar execução por dimensão do PDI | Inexistente ou muito trabalhoso | Instantâneo (dashboard) |
| Visão integrada PDI × Execução | Inexistente | Disponível |
| Relatórios de alinhamento estratégico | Manual, sujeito a erros | Automatizado |
| Identificação de dimensões com baixa execução | Difícil | Visual e imediata |

---

## 7. Considerações Finais

### 7.1 Síntese dos Resultados
- O sistema desenvolvido atende à necessidade de integrar o PDI à execução orçamentária
- Os indicadores por dimensão do PDI permitem acompanhamento estratégico em tempo real
- A ferramenta contribui para a transparência, accountability e alinhamento estratégico

### 7.2 Contribuições para a Administração Pública
- Produto replicável para outras DIADs e unidades gestoras de IFs
- Demonstra na prática como o orçamento está atendendo ao PDI
- Alinhamento com os princípios de governança pública
- Potencial de subsidiar relatórios de gestão e auditorias

### 7.3 Limitações
- Sistema não integrado diretamente ao SIAFI (depende de importação manual)
- Necessidade de mapeamento prévio das dimensões do PDI
- Necessidade de treinamento inicial dos usuários

### 7.4 Trabalhos Futuros
- Integração automática com APIs do SIAFI/Tesouro Gerencial
- Módulo de alertas (dimensões com baixa execução, saldo baixo)
- Vinculação com indicadores e metas específicas do PDI
- Extensão para outras unidades (DIRAP, DIREN, PRO-REITORIAS)
- Relatórios para subsidiar a avaliação do PDI

---

## 8. Referências

- BRASIL. Lei nº 4.320, de 17 de março de 1964.
- BRASIL. Lei nº 10.861, de 14 de abril de 2004 (SINAES).
- BRASIL. Lei Complementar nº 101/2000 (LRF).
- BRASIL. Decreto nº 5.773, de 9 de maio de 2006.
- TCU. Referencial Básico de Governança, 2020.
- MEC. Orientações para elaboração do PDI.
- PRESSMAN, R. Engenharia de Software, 8ª ed.
- Artigos do RAP, RSP, Cadernos ENAP sobre gestão estratégica e orçamentária

---

## 9. Apêndices
- A: Manual do usuário do sistema
- B: Dimensões do PDI utilizadas no sistema
- C: Roteiro de entrevista
- D: Questionário SUS aplicado
- E: Termo de Consentimento Livre e Esclarecido
- F: Código-fonte (link para repositório)

---

## 10. Dicas para o PROFIAP

1. **Enfatize o problema prático**: O PROFIAP valoriza produtos que resolvem problemas reais da administração pública
2. **Mostre a aplicabilidade**: O sistema já está em uso/teste na DIAD
3. **Use linguagem de gestão**: Governança, eficiência, transparência, accountability
4. **Quantifique resultados**: Tempo economizado, redução de erros, satisfação dos usuários
5. **Produto replicável**: Destaque que outras unidades podem usar
