# PAGE_PATTERNS

Este documento resume as diretrizes de composição e padrões visuais de páginas do GovAnalytics.

## Shell global

O shell principal em [Layout.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/Layout.tsx) usa a estrutura de sidebar e header:

1. **Sidebar Responsiva (Expandida e Rail Mode)**: Fundo branco (`bg-sidebar`), borda divisória sutil, suporte a recolhimento compacto para modo ícones (`w-18`) com tooltips acessíveis e persistência em `localStorage`;
2. **Identidade da Marca**: Logotipo institucional do SIAGES no topo com selo "Beta" em `accent` e legenda em caixa alta espaçada (design system Céu, sem mascote);
3. **Busca e Command Palette Global (`Cmd+K` / `Ctrl+K`)**: Campo de pesquisa rápido no header com atalho de teclado `Ctrl K` que abre a Command Palette para navegação instantânea por telas, módulos e ações rápidas;
4. **Header**: Barra superior branca e sólida de 64px com borda inferior sutil;
5. **Grupos de Módulos (Sidebar)**: Títulos em caixa alta/tamanho reduzido, ícone com cor de destaque ativa e chevrons dinâmicos que rotacionam suavemente;
6. **Item Ativo**: Links de navegação ativa recebem fundo `sidebar-accent`, texto `sidebar-accent-foreground` em negrito e um ponto azul à direita;
7. **Submenus Expansivos**: Subitens com pontos discretos indicando a rota ativa com recuo visual;
8. **Responsividade**: Drawer lateral acionado via botão hambúrguer para dispositivos móveis;
9. **Scrollbars**: Rolagem fina com trilha invisível e cantos arredondados na navegação interna;
10. **Carregamento de Rotas**: Rotas lazy usam `RouteLoadingFallback`: páginas públicas e a validação de sessão exibem o `AppSplash` (logotipo + barra indeterminada) e páginas internas mantêm sidebar/header visíveis com o `PageLoadingSkeleton` na área de conteúdo. Carregamentos dentro de painéis usam `LoadingState`; dentro de tabelas, `TableSkeletonRows`. Evite spinners avulsos com cores fixas.
11. **Cabeçalho de página padrão**: toda tela interna começa com `PageHeader` (eyebrow com o módulo, título, descrição curta, ações à direita e barra secundária opcional). Se a página não declarar o próprio `PageHeader`, o `Layout` exibe o cabeçalho automático (`AutoPageHeader`) com módulo e nome da tela registrados em `src/lib/appScreens.ts`. **Exceção — módulo Orçamentário** (Dashboard, Planejamento, Descentralizações, Crédito disponível, Empenhos): sem eyebrow, título nem descrição visíveis; o topo da página fica só com o seletor de visão e as ações/filtros na mesma linha (`PageHeader compact`), e o `h1` permanece `sr-only` para acessibilidade. As telas **Limpeza e Manutenção** (`/manutencao`, que já abre nas abas Dashboard / Visão Geral / Ocorrências) e **Refeitório › Dashboard** (`/refeitorio/insumos`, cujo painel tem título próprio) também omitem o cabeçalho automático visível (`COMPACT_HEADER_SCREENS` em `PageHeader.tsx`). Não crie `h1` avulsos em páginas internas.
12. **Troca de visão**: alternâncias entre visões de uma mesma tela (ex.: Execução × Restos a Pagar, Orçamento × RAP × Contratos) usam `SegmentedControl` ou `Tabs` na barra secundária do `PageHeader`, nunca abas "folder" nem listas de abas duplicadas para desktop e mobile.


## Textos e encoding

- Todos os textos e documentações devem estar em conformidade UTF-8.
- Após alterar copies de UI ou documentações do design system, execute:
  ```powershell
  npm test -- src/__tests__/encoding.test.ts
  ```

## Padrão 1: tabela operacional

Estrutura:
1. `PageHeader` (título, descrição e `SegmentedControl` quando houver visões; ações globais podem continuar em `HeaderActions`)
2. `FilterPanel` (busca e filtros principais visíveis; filtros avançados em "Mais filtros")
3. `DataTablePanel` (Tabela com overflow horizontal)
4. `TablePagination` (Paginação no rodapé)

As tabelas devem usar cabeçalho suave, linhas com divisores claros, efeito de hover suave (`row-hover`) e tipografia tabular `IBM Plex Mono` para dados.

## Padrão: Contratos

`/contratos` segue o padrão de tabela operacional sem indicadores: `PageHeader compact`, busca em `FilterPanel`, visões (`Vigentes`, `A vencer em 90 dias`, `Com faturas pendentes`, `Vencidos (120d)`, `Favoritos`) em `SegmentedControl` com a contagem de cada uma, e `DataTablePanel`. Cada contrato mostra a vigência em `Badge` (`success` > 90 dias, `warning` até 90 dias, `danger` vencido ou encerrado). Linhas com fatura pendente usam o token `warning`; o carregamento usa `PageLoadingSkeleton`. As regras de cada visão ficam em um único predicado (`matchesView`), usado no filtro e nas contagens.

## Padrão 2: consulta com KPIs e tabela

Estrutura:
1. `HeaderActions`
2. Grid responsiva de `StatCard` (KPIs)
3. `FilterPanel`
4. Tabela operacional com paginação

## Padrão 3: importação de arquivo

Estrutura:
1. `HeaderActions` com botões primários/secundários dinâmicos;
2. Informações e progresso de carregamento;
3. Exibição de cards ou tabelas com estados de erro/sucesso explícitos.

## Padrão: Mapeamento de Processos (tela cheia)

`/mapeamentos` ocupa a área inteira do `Layout` (sem `PageHeader`). A barra própria (`ProcessMappingNavbar`) organiza os controles em três blocos balanceados: à esquerda, o seletor de processo e o alternador de visão (Fluxograma / Matriz / Guia); ao centro, as ferramentas de viewport e grade do canvas quando no modo fluxograma; e à direita, a busca rápida e o botão de exportação. Elementos soltos ou redundantes (como atalhos de restauração global e links repetidos de retorno) foram removidos para manter foco operacional. O título principal fica `sr-only`, pois o módulo e a tela já aparecem no cabeçalho global e na navegação. A criação de etapas ocorre de forma contextual no próprio fluxograma: ao clicar no botão `+` ao lado de qualquer etapa existente (`ProcessMappingNodeCard`), um menu contextual permite escolher o tipo de nó a inserir (Tarefa, Decisão ou Fim) com ligação e posicionamento automáticos, ou iniciar conexão manual com outra etapa. Cores usam a escala `brand-*` (azul-céu) e `slate-*` neutros; âmbar e vermelho são reservados a decisões e fins de processo. O canvas do fluxograma (`ProcessMappingCanvas`) possui contenção estrita de rolagem e arrasto com limites superiores e esquerdos fixados em zero (`maxY = 0`, `maxX = 0`), garantindo que o topo da primeira raia permaneça alinhado diretamente ao cabeçalho ao rolar ou arrastar para cima, sem criar espaço em branco vazio.

## Padrão 4: dashboard analítico

Estrutura:
1. `PageHeader` com descrição da visão ativa, filtros (`DashboardFiltersSheet`) nas ações e `Tabs` das visões na barra secundária;
2. Uma única linha com até 4 `StatCard` no padrão "metric" — cada número aparece uma só vez na tela;
3. Velocímetros (`GaugeChart`) de Empenhado/Descentralizado e Liquidado/Descentralizado;
4. `ChartPanel` principal (evolução) ao lado do funil de execução (Planejado → Descentralizado → Empenhado → Liquidado → Pago, mesmas etapas do app mobile), com as razões entre etapas;
5. Gráficos de apoio e tabela de detalhamento.

Séries seguem a ordem azul-céu `#1E88E5`, ciano `#00B7DC`, azul profundo `#1565C0`, âmbar `#F2A93B` e verde `#2E9E6A`. Evite gradientes em texto, brilhos decorativos e cartões que repetem o mesmo valor.

## Padrão 5: autenticação

A tela desktop de autenticação usa composição dividida:

1. painel institucional à esquerda com imagem temática em baixa opacidade;
2. camada verde escura translúcida sobre a imagem para preservar o contraste;
3. marca, mensagem de produto e informações institucionais acima das camadas decorativas;
4. formulário de acesso em superfície branca à direita;
5. em telas menores, o painel ilustrado é ocultado e o formulário ocupa toda a largura.

## Padrão 6: fluxo assistido auditável

Usado em processos com IA e decisão humana, como pesquisa de preços:

1. `HeaderActions` concentra modelo, importação, salvamento e saída;
2. uma faixa inicial explica etapas, fonte e limite da automação;
3. metadados obrigatórios aparecem antes da execução;
4. itens são revisados individualmente antes da chamada externa;
5. um painel compacto de métodos de cálculo destaca o método estimado, deixa indicadores auxiliares em menor hierarquia visual e mantém configurações secundárias, como atualização monetária, no rodapé discreto do painel;
6. `DataTablePanel` mantém fonte, valor original, valor comparável, aderência e justificativa visíveis;
7. a ação final valida pendências e salva o snapshot antes de gerar o relatório.

Durante consultas externas, a página deve preservar sua hierarquia e dimensões com skeletons contextuais. Estado vazio só aparece depois de uma resposta bem-sucedida sem registros; falhas mostram mensagem inline e uma ação de nova tentativa. Controles que dependem do resultado permanecem desabilitados enquanto a consulta estiver pendente.

Na etapa final, a prévia deve reutilizar o mesmo documento HTML da exportação em um `iframe` isolado e somente leitura, evitando resumos paralelos que possam divergir do arquivo. Alertas de conformidade permanecem em painel externo claramente identificado e nunca integram as exportações.

## Antipadrões a evitar

- Reintroduzir folhas de estilo separadas para sobrescritas de tokens visuais concorrentes.
- Criar cards, tabelas ou formulários customizados ad hoc sem reutilizar os componentes oficiais de `src/components/design-system`.
- Quebrar a curva de transição suave (`spring`) ou a paleta de contraste acessível do Dark Mode.

## Padrao 7: painel embarcado em sistema externo

O painel da extensao usa namespace CSS exclusivo, ocupa primeiro a coluna lateral/timeline e cai para o conteudo principal quando ela nao existe. Dark e o modo inicial; light e recolhimento sao preferencias persistidas. A navegacao inicia em Resumo e preserva a disponibilidade independente das ferramentas durante sincronizacoes longas.

Para o Comprasnet, o launcher usa `br-button` junto às ações do ETP e abre um modal `br-modal` responsivo, sem alterar o layout da página. O iframe recebe tokens computados do site (`--comprasnet-*`) e aplica uma folha isolada com `br-card`, `br-input`, alertas e foco acessível. A prévia total é uma referência de leitura; somente o card da seção aberta recebe controles de aplicação e as demais orientam o avanço manual no sistema externo. Não há tema escuro próprio e a ação `Concluir ETP` nunca é automatizada.

## Padrao 8: dashboard Cloudscape-inspired (prototipo)

Para validacoes de layout sem risco para a rota oficial, usar uma rota isolada com:

1. cabecalho de contexto com titulo, subtitulo e acoes de retorno/atualizacao;
2. abas compactas para os recortes principais do painel;
3. filtros globais em drawer lateral, com contagem de filtros ativos e limpeza explicita;
4. KPIs em paineis densos, neutros e comparaveis, mantendo o verde institucional nos estados ativos;
5. `ChartPanel`/Recharts preservados quando os graficos existentes ja atendem a necessidade;
6. tabelas de apoio com dados do `DataContext`, estados vazios e leitura tabular.

A implementacao de referencia esta em `/dashboard-cloudscape-preview`; a rota `/` permanece o dashboard de producao.

## Padrao 9: modelagem e gestao de processos BPMN (/mapeamentos)

A tela de mapeamento operacional de processos adota arquitetura de estúdio interativo com suporte unificado às rotas `/mapeamentos` e `/mapeamentos/:mappingId`:

1. **Top Navbar Especializada**: seletor de processos ativos com código e categoria, controles integrados de navegação/zoom (ampliar, reduzir, ajuste automático, restaurar e alternar grade), paleta ágil de novos nós (Tarefa, Decisão e Fim de Processo), busca rápida em tempo real com realce no fluxo e alternador de três modos de visualização (Fluxograma, Matriz e Guia de Execução);
2. **Integração Edge-to-Edge no Shell**: integração direta ao shell principal (`Layout.tsx`) sem margens externas superiores ou laterais redundantes (`p-0` e `max-w-none`), preenchendo 100% da altura e largura úteis entre o header e a sidebar da aplicação, com raias operacionais alinhadas diretamente ao topo e à esquerda inicial (`x: 0, y: 0`), superfícies sólidas contínuas eliminando o aspecto flutuante e canvas infinito sem barras artificiais sobrepostas;
3. **Visão Fluxograma (Canvas)**: raias operacionais (swimlanes) horizontais com cores setoriais sólidas, borda de identificação e badges de setor fixos, conectores ortogonais em degrau com cantos arredondados suaves (`r: 8px`), roteamento inteligente para gateways (distribuindo saídas entre vértices do losango) e desvio superior para fluxos de retorno (loopback), handles interativos nos pontos de dobra das linhas para reposicionamento manual por arraste, barra flutuante de ajustes de conexão (portas de entrada/saída, estilo contínua/tracejada, escolha de origem e destino, rótulo digitado em campo na própria barra — sem `window.prompt` — e reset de traçado), grade comutável, dicas contextuais flutuantes no rodapé e nós interativos com identificador `PASSO XX`;
4. **Visão Matriz (Tabela Operacional)**: tabela densa com filtros por links de sistemas, modelos e pendências, com colunas para responsáveis, SLA, base legal e atalhos diretos;
5. **Visão Guia de Execução**: visão orientada a tarefas com progresso geral animado, lista sequencial de cartões, checklists interativos funcionais e botões de acesso direto a sistemas oficiais;
6. **Drawer de Detalhes (`NodeDetailDrawer`)**: gaveta lateral deslizante com as abas Procedimento (título, detalhamento, raia responsável, base legal, entradas/saídas e o checklist operacional da etapa), Automações (várias por etapa, em cartões recolhíveis) e Links & Sistemas (vários sistemas por etapa, com presets para SUAP, Compras.gov.br, SIAFI, PNCP, SEI e AGU). Código, status, tipo de fluxo e SLA não são editáveis nessa gaveta. Todas as abas abrem em modo de leitura; os formulários só aparecem após clicar em "Editar" no rodapé (o checklist continua marcável e aceita novos itens na leitura);
7. **Modais Auxiliares**: modais acessíveis para exportação/impressão em PDF e JSON e criação de novos processos;
8. **Integração com o SUAP**: quando acessado com parâmetro `?suapId=...`, sincroniza os nós e reflete a etapa atual do processo nos modos de visão com interface limpa e foco no fluxo operacional; no painel da extensão injetado no SUAP (`process-toolkit.css`), o cabeçalho do card exibe de forma enxuta apenas a identificação "Caminho do processo" e o link "Mapa completo ↗", sem título intermediário redundante, enquanto o rótulo "Mapeamento aplicado" e o dropdown de seleção do fluxo BPMN ficam alinhados na mesma linha horizontal (`display: flex; align-items: center; justify-content: space-between;`), com tooltips nativos em hover para títulos longos de etapas truncadas por reticências.


## Detalhe de contrato (`ContratoApiDetailsSheet`, modo página)

A listagem de Contratos continua sendo tabela. O detalhe aberto pelo contrato segue a organização do app mobile, em abas: **Resumo** (objeto, indicadores, execução financeira com barra de progresso e prazo de vigência, gestão e fiscalização — gestores, fiscais, prepostos e garantias — e itens do contrato), **Empenhos** (empenhos vinculados ao campus, incluindo RAP), **Faturas** (faturas e NF-e/instrumentos de cobrança), **Termos** (histórico do contrato) e **Documentos e ocorrências** (ocorrências, despesas acessórias, terceirizados e anexos PNCP/Compras.gov.br). O cronograma contratual não é exibido. Cada fatura é um bloco limpo com número, situação, referência, valor líquido, datas (emissão, vencimento, ateste, liquidação, pagamento), empenho, Doc. SIAFI (`raw_data.sfadrao_id`), processo e chave da NF-e (`chave_nfe`); glosa, juros, multa e repactuação só aparecem quando existem. O cabeçalho mostra o status Vigente / A vencer (até 90 dias) / Encerrado. O modo diálogo mantém o layout único em acordeões.

## Prévia e movimentos de RDs

Dashboard e detalhe do empenho distinguem ausência de associação após aplicação, coleta ainda incompleta e conferência pronta sem aplicação. O aviso de captura informa progresso e orienta retomar pela extensão/concluir/aplicar em Importação de dados, preservando os controles próprios de cada fluxo.

Na 1.9.57, o bloco de RDs oferece a opção excepcional de revalidar tudo antes de iniciar unidade/lote. A coleta normal reaproveita concluídas permanentemente e consulta novas/pendentes; canceladas passam por conferência periódica. Progresso distingue detalhes relidos/reaproveitados e relações reaproveitadas. A prévia continua completa e exige aplicação explícita, mesmo com snapshots copiados.

O popup da extensão 1.9.56 apresenta blocos separados `Atividades — Plano 8` e `RDs — Requisições de despesas`. Cada bloco explica os dados atualizados e oferece ações da unidade atual ou de todas as unidades. As RDs agrupam coleta/retomada, pausa e aplicação por escopo, com progresso próprio. A aplicação de atividades também identifica unidade ou lote. Os controles de um fluxo permanecem disponíveis durante a execução do outro; nenhum botão inicia os dois. A conferência no SIAGES fica como link no bloco de RDs.

Importação de RDs acompanha a captura iniciada pela extensão (unidade atual ou todas as unidades), mostrando unidade/campus, atualização do progresso persistido e prévia paginada. A lista de empenhos não exibe contagens de movimentos RD nem o total histórico de operações; esses resumos não disparam consultas RD nessa tela. No detalhe, a tabela de RDs recebe o título **Histórico de Operações**, acrescenta a data de cadastro original do SUAP e mantém RD, tipo de movimento, RO/natureza e atividade/conferência. Valores de dotação e reforço ficam verdes; anulação fica vermelha. A antiga tabela de histórico SIAFI do empenho não é mais exibida. Estados de carregamento, erro de consulta e ausência de RD são distintos. Veja [SUAP_RD_SYNC](../ops/SUAP_RD_SYNC.md).
