# PAGE_PATTERNS

Este documento resume as diretrizes de composição e padrões visuais de páginas do GovAnalytics.

## Shell global

O shell principal em [Layout.tsx](file:///c:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/components/Layout.tsx) usa a estrutura de sidebar e header:

1. **Sidebar Branca Integrada**: Fundo branco e borda direita fina semi-transparente;
2. **Identidade da Marca**: Logotipo GovAnalytics no topo com ícone oficial, posicionado com espaçamento elegante;
3. **Busca no Header**: Campo de pesquisa com bordas levemente arredondadas e efeito de foco dinâmico verde;
4. **Header com Efeito de Vidro**: Barra superior com translucidez (`backdrop-blur bg-white/80`) e sombra sutil;
5. **Grupos de Módulos (Sidebar)**: Títulos em caixa alta/tamanho reduzido, ícone verde institucional quando ativo e chevrons dinâmicos que rotacionam suavemente;
6. **Indicador Lateral Ativo**: Links de navegação ativa recebem uma barra lateral verde à esquerda (`before:bg-[#2f9e41]`) e fundo verde suave (`bg-[#f0f9f1]`);
7. **Submenus Expansivos**: Subitens com pontos discretos verdes indicando a rota ativa com recuo visual;
8. **Responsividade**: Drawer lateral acionado via botão hambúrguer para dispositivos móveis;
9. **Scrollbars**: Rolagem fina com trilha invisível e cantos arredondados na navegação interna.

## Textos e encoding

- Todos os textos e documentações devem estar em conformidade UTF-8.
- Após alterar copies de UI ou documentações do design system, execute:
  ```powershell
  npm test -- src/__tests__/encoding.test.ts
  ```

## Padrão 1: tabela operacional

Estrutura:
1. `HeaderActions`
2. `FilterPanel` (Filtros)
3. `DataTablePanel` (Tabela com overflow horizontal)
4. `TablePagination` (Paginação no rodapé)

As tabelas devem usar cabeçalho suave, linhas com divisores claros, efeito de hover suave (`row-hover`) e tipografia tabular `IBM Plex Mono` para dados.

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

## Padrão 4: dashboard analítico

Estrutura:
1. Filtros globais de período;
2. Grid de `StatCard` com realces interativos;
3. `ChartPanel` contendo gráficos e legendas customizadas;
4. Tabelas secundárias de apoio.

O dashboard preserva a paleta de cores analíticas (azul para planejado/séries base, verde para pago, roxo para empenhado e âmbar para etapas intermediárias) com transições suaves e estados vazios amigáveis.

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
5. um painel compacto de métodos de cálculo destaca o método estimado e deixa indicadores auxiliares em menor hierarquia visual;
6. `DataTablePanel` mantém fonte, valor original, valor comparável, aderência e justificativa visíveis;
7. a ação final valida pendências e salva o snapshot antes de gerar o relatório.

## Antipadrões a evitar

- Reintroduzir folhas de estilo separadas para sobrescritas de tokens visuais concorrentes.
- Criar cards, tabelas ou formulários customizados ad hoc sem reutilizar os componentes oficiais de `src/components/design-system`.
- Quebrar a curva de transição suave (`spring`) ou a paleta de contraste acessível do Dark Mode.
