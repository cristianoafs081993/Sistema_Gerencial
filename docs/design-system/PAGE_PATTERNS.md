# PAGE_PATTERNS

Esta documentacao foi atualizada porque a mudanca altera comportamento visual real em area critica de design system.

## Shell global

O shell principal em `src/components/Layout.tsx` usa sidebar:

1. sidebar branca com borda direita;
2. marca GovFlow no topo com ícone oficial em `public/govflow-icon-192.png`, sem avatar de usuário na sidebar;
3. busca visual no header principal, alinhada ao mesmo divisor horizontal da sidebar;
4. grupos de modulos expansivos derivados de `appScreenGroups`, com icone, texto em caixa normal, superficie discreta quando abertos e transicao de altura/opacidade;
5. itens derivados de `appScreens`, mantendo permissoes, rotas existentes e recuo visual em relacao ao grupo;
6. submenus expansivos quando uma tela possui variacoes de rota, como Planejamento;
7. item ativo com fundo neutro e texto reforcado, sem barra lateral;
8. subitem ativo com ponto discreto e texto reforcado;
9. drawer lateral em mobile;
10. header interno para busca, acoes de pagina e subtitulo.

Nao trocar a sidebar por top nav sem validar que todos os itens continuam acessiveis.

Os metadados de marca usam `public/govflow-logo.png`, `public/govflow-icon-192.png`, `public/govflow-icon-512.png`, `public/favicon.png` e `public/site.webmanifest`.

## Textos e encoding

- Textos de UI e documentacao devem permanecer em UTF-8 legivel.
- Nao commitar mojibake em labels, titulos, mensagens, comentarios ou documentacao.
- Depois de alterar copy de UI ou documentacao do design system, rode `npm test -- src/__tests__/encoding.test.ts`.

## Padrao 1: tabela operacional

Estrutura:

1. `HeaderActions`
2. `FilterPanel`
3. `DataTablePanel`
4. `TablePagination`

Tabelas devem usar cabecalho suave, linhas com divisor claro e texto denso.

## Padrao 2: consulta com KPIs e tabela

Estrutura:

1. `HeaderActions`
2. grid de `StatCard`
3. `FilterPanel`
4. tabela principal

KPIs podem usar `tone` novo ou `stitchColor` legado enquanto a compatibilidade existir.

Aplicacao atual:

- `/artefatos-licitacao` usa resumo por tipo, filtros compactos e tabela operacional para consulta de ETP, Mapa de Risco, Termo de Referencia e Minuta de Contrato. Acoes de linha devem permanecer iconicas e alinhadas a direita.
- `/licitacoes-pregoes` usa `FilterPanel` em grade responsiva com rotulos, pesquisa por objeto e item PNCP, acao de limpar, tabela paginada e drawer de detalhe para consulta institucional dos pregoes PNCP, com UASG opcional. A tela nao exibe card de resumo; a busca no PNCP fica junto aos filtros e a sincronizacao dirigida do catalogo IFRN fica no header.
- `/credito-disponivel` usa KPIs, filtros compactos e tabela paginada para consultar saldo por PTRES/PI, exibindo apenas linhas com saldo por padrao e sem expor o nome do arquivo importado. A importacao CSV fica no header e aparece somente para superadmin.

## Padrao 3: importacao de arquivo

Estrutura:

1. `HeaderActions` com botao primario/secundario;
2. informacao do arquivo atual quando existir;
3. tabela ou cards derivados.

Uploads devem manter estados de loading e erro claros.

## Padrao 4: dashboard analitico

Estrutura:

1. filtros globais;
2. KPIs com `StatCard`;
3. graficos com `ChartPanel`;
4. tabelas secundarias.

O dashboard preserva a paleta anterior para leitura analitica: azul para planejado/series base, verde para pago/naturezas, roxo para empenhado, amber para etapas intermediarias e cores complementares em barras empilhadas.

## Antipadroes

- Remover `src/manus-stage1.css` sem migrar antes todos os tokens legados equivalentes.
- Trocar a sidebar por navegacao superior incompleta.
- Apagar a paleta multicolorida do dashboard.
- Criar card/tabela/filtro ad hoc quando houver componente oficial.
