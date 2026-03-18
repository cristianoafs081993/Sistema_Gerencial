# Governança Orçamentária e Alinhamento Estratégico: Automação do Planejamento e Execução no IFRN - Campus Currais Novos

## 1. Introdução

### 1.1 Contextualização
- **Cenário de Escassez e Rigidez:** A administração pública enfrenta um cenário de restrição orçamentária crescente e alta rigidez das despesas. No IFRN, os campi possuem autonomia administrativa e financeira, mas sofrem com o engessamento do orçamento em contratos continuados e despesas obrigatórias.
- **Lócus da Pesquisa:** O estudo será desenvolvido no **Campus Currais Novos**, onde a necessidade de maximizar a eficiência dos recursos discricionários é crítica para o atendimento das metas institucionais.
- **O Papel do PTT:** Neste contexto, o Produto Técnico e Tecnológico (PTT) surge como uma ferramenta de intervenção para modernizar a gestão, saindo de controles manuais para uma governança baseada em dados reais.

### 1.2 Problema de Pesquisa
A disjunção entre o planejamento estratégico (PDI/Planos de Ação) e a execução orçamentária (SIAFI/Tesouro) cria uma lacuna de gerenciamento.
Principais problemas identificados no Campus Currais Novos:
1.  **Fragmentação da Informação:** Dados de planejamento e execução residem em sistemas desconexos, exigindo conferência manual e "cruzamento" de planilhas.
2.  **Ineficiência Administrativa:** Retrabalho anual no cadastro de planos de atividades (falta de banco de dados histórico para reuso).
3.  **Opacidade Operacional:** Dificuldade de acesso rápido a dados de empenho, liquidação e pagamento por parte dos gestores de ponta.

**Pergunta de Pesquisa:** *Como a implementação de um Produto Técnico e Tecnológico (PTT) de automação pode ampliar o alinhamento entre o planejamento estratégico e a execução orçamentária, promovendo governança e eficiência na gestão do Campus Currais Novos?*

### 1.3 Objetivos

**Objetivo Geral:**
Desenvolver e implementar um **Produto Técnico e Tecnológico (PTT)** na modalidade Software, que automatize a integração entre o planejamento de atividades e a execução financeira via API, fortalecendo a governança orçamentária no IFRN - Campus Currais Novos.

**Objetivos Específicos:**
1.  Realizar a **Análise Situacional** do fluxo atual de gestão orçamentária do Campus Currais Novos, identificando gargalos de retrabalho e assimetria de informação.
2.  Estruturar o **PTT (Software)** para consumir dados abertos/APIs de transparência, automatizando a leitura de empenhos e liquidações.
3.  Implementar funcionalidade de **reuso de planos de atividades**, mitigando a ineficiência burocrática no planejamento anual.
4.  Validar a aderência do PTT como instrumento de transparência e suporte à decisão junto aos gestores do Campus.

### 1.4 Justificativa e Aderência ao PROFIAP
A proposta alinha-se à Área de Concentração "Administração Pública" e à modalidade de TCC "Dissertação com Produto Técnico e Tecnológico (PTT)".
O PTT proposto não é apenas um software, mas um **artefato de governança** que responde diretamente às demandas de:
- **Eficiência:** Pela automação de processos manuais (API).
- **Transparência:** Pela disponibilização de dados em tempo real.
- **Economicidade:** Pela melhor alocação de recursos escassos baseada em evidências.

---

## 2. Referencial Teórico
- **Governança Pública e Accountability:** O dever de prestar contas não apenas financeiras, mas de desempenho (Matias-Pereira).
- **Alinhamento Estratégico:** A conexão necessária entre PDI e LOA nos Institutos Federais.
- **Governo Digital e Interoperabilidade:** O uso de APIs (Application Programming Interfaces) para integrar sistemas estruturantes (SIAFI) a soluções de gestão local, reduzindo a burocracia.

---

## 3. Metodologia

### 3.1 Classificação
- **Natureza:** Pesquisa Aplicada / Tecnológica.
- **Abordagem:** Quali-quantitativa.
- **Método:** *Design Science Research* (DSR), focado na criação e avaliação de um artefato (o PTT).

### 3.2 O Produto Técnico e Tecnológico (PTT)
O artefato será um **Sistema Web de Gestão Integrada**, já em fase de desenvolvimento ("Love Execução"), com as seguintes características técnicas inovadoras para o setor:
1.  **Automação via API:** Diferente de soluções anteriores baseadas em planilhas, o PTT captura dados de execução (Notas de Empenho) automaticamente, eliminando erro humano e defasagem temporal.
2.  **Módulo de Planejamento Inteligente:** Permite clonar/reaproveitar estruturas de planos de anos anteriores, focando o tempo dos gestores na estratégia e não na digitação.
3.  **Dashboard de Governança:** Painéis visuais que correlacionam, em tempo real, o % executado de cada meta do PDI.

### 3.3 Etapas de Execução (Campus Currais Novos)
1.  **Diagnóstico:** Mapeamento do processo atual "as-is" (baseado em planilhas).
2.  **Desenvolvimento do PTT:** Refinamento do software para as especificidades do Campus Currais Novos (autonomia das coordenações).
3.  **Implantação Piloto:** Uso do sistema durante um ciclo orçamentário (ou simulação com dados reais do exercício anterior).
4.  **Avaliação:** Medição de indicadores de eficiência (tempo de cadastro, tempo de consulta) e satisfação do usuário (governança percebida).

---

## 4. Estrutura da Dissertação (Conforme Regimento PROFIAP)
O trabalho final seguirá a estrutura de **Dissertação contendo Análise Situacional e Produto Técnico/Tecnológico**:
1.  **Introdução**
2.  **Referencial Teórico**
3.  **Metodologia** (com detalhamento do PTT)
4.  **Análise Situacional** (Diagnóstico do Campus Currais Novos)
5.  **Descrição e Resultados do Produto Técnico e Tecnológico** (Apresentação do Software e sua validação)
6.  **Considerações Finais**
7.  **Referências**
8.  **Apêndices** (Manual do PTT, links para repositório, etc.)

---
## 5. Próximos Passos
- Validar se a integração via API (Portal da Transparência/Dados Abertos) cobre 100% dos dados necessários ou se haverá necessidade de "de-para" manual para algumas rubricas específicas do Campus.
