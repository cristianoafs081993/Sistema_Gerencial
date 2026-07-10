# Pesquisa de Preços

## Objetivo

O módulo `/pesquisa-precos` transforma uma planilha de itens em uma cesta auditável de preços públicos. O fluxo:

1. importa e normaliza os itens no navegador;
2. consulta preços homologados dos últimos 12 meses;
3. apresenta até 15 referências por item;
4. permite seleção e exclusão com justificativa;
5. calcula média aritmética, mediana, menor preço, média ponderada, média saneada, mínimo, máximo, desvio padrão, coeficiente de variação e quantidade de preços excluídos;
6. verifica automaticamente indícios objetivos de irregularidade com base apenas na IN SEGES/ME nº 65/2021;
7. salva a pesquisa e gera relatório com memória de cálculo.

A IA apenas reordena candidatos pela aderência técnica. Ela não cria valores, não altera preços oficiais e não substitui a análise crítica do agente responsável.

## Entrada aceita

Formatos:

- `.xlsx`
- `.xls`
- `.csv`
- `.pdf`, desde que contenha texto pesquisável e tabela com cabeçalhos identificáveis

O parser procura o cabeçalho nas primeiras 30 linhas. As colunas obrigatórias são:

- descrição do item;
- quantidade;
- unidade;

O código CATMAT/CATSER é recomendado, mas deixou de ser obrigatório no arquivo. Quando estiver ausente, o sistema consulta os catálogos locais e apresenta códigos semelhantes para confirmação humana.

Aliases aceitos incluem:

| Campo normalizado | Exemplos de cabeçalho |
|---|---|
| Item | `Item`, `Número`, `Nº` |
| Descrição | `Descrição`, `Objeto`, `Especificação` |
| Quantidade | `Quantidade`, `Qtd` |
| Unidade | `Unidade`, `Unidade de fornecimento` |
| CATMAT | `CATMAT`, `Código CATMAT` |
| CATSER | `CATSER`, `Código CATSER` |
| Capacidade comparável | `Capacidade`, `Conteúdo`, `Embalagem` |
| Unidade de medida | `Medida`, `Unidade de medida` |
| Custo de referência | `Valor unitário`, `Custo unitário` |

O código pode estar em coluna própria ou no texto, por exemplo `CATMAT 606523`. Capacidade e medida também podem ser inferidas de expressões como `500 g`, mas devem ser revisadas antes da pesquisa.

No PDF, o parser usa a posição dos textos para recompor linhas e colunas. PDFs escaneados sem camada de texto não são aceitos neste corte; não há OCR automático.

## Correspondência CATMAT/CATSER

Catálogos usados:

- CATMAT: `Novo Catálogo de Materiais 26-05-26.xlsx`, com 162.919 itens;
- CATSER: `Lista CATSER.xlsx`, extraída em 23/04/2025, com 2.905 serviços ativos.

Os arquivos operacionais compactados ficam em:

- `public/catalogs/catmat.json.gz`;
- `public/catalogs/catser.json.gz`.

O matching:

- é executado em Web Worker para não bloquear a interface;
- detecta se o servidor já removeu o gzip via `Content-Encoding` antes de tentar descompactar o catálogo;
- normaliza acentos, pontuação e plurais simples;
- compara termos relevantes, expressões consecutivas, objeto principal e números;
- penaliza especificações numéricas divergentes;
- devolve até cinco alternativas ordenadas por aderência;
- nunca aplica o código silenciosamente.

O usuário deve confirmar uma sugestão antes de consultar preços. Também pode trocar entre CATMAT e CATSER, editar a descrição e solicitar novos códigos similares.

Para regenerar os assets após receber novas versões:

```powershell
npm run generate:price-catalogs -- "caminho/CATMAT.xlsx" "caminho/CATSER.xlsx" public/catalogs
```

## Fontes e período

Fonte primária de preços:

- Dados Abertos Compras.gov.br;
- `/modulo-pesquisa-preco/1_consultarMaterial`, para CATMAT;
- `/modulo-pesquisa-preco/3_consultarServico`, para CATSER;
- janela móvel dos 12 meses anteriores à consulta.

Esses endpoints fornecem preços praticados/homologados por código de catálogo. O PNCP é apresentado como link complementar de rastreabilidade da compra. Não se deve substituir o preço homologado por valor meramente estimado de item publicado no PNCP.

## Comparabilidade

O backend tenta normalizar apenas conversões determinísticas:

- `g` e `kg`;
- `ml` e `l`;
- unidade;
- hora.

Quando dimensão ou capacidade não forem comparáveis, o candidato fica inicialmente excluído e exige revisão humana. Conversões comerciais, técnicas ou de qualidade não devem ser inferidas pela IA.

## Regras do relatório

O relatório exige:

- objeto da contratação;
- agente responsável;
- identificação institucional opcional para cabeçalho, com nome, unidade/setor, dados complementares e logotipo;
- servidores responsáveis ou equipe de apoio que devem constar no relatório;
- identificação CATMAT/CATSER;
- ao menos três preços selecionados por item;
- justificativa para cada preço excluído;
- justificativa do método estatístico;
- memória de cálculo e identificação das fontes.

O relatório gerencial consolidado também inclui:

- sumário executivo com total estimado, quantidade de itens, cotações selecionadas/excluídas e composição por tipo de fonte;
- cabeçalho personalizado com logotipo da instituição, identificação da unidade e tabela de servidores informados;
- curva ABC calculada pelo valor total estimado de cada item (`quantidade * preço estimado`), com classes A/B/C por participação acumulada;
- mapa comparativo item x fonte/cotação, com fornecedor, órgão/UASG, localidade, data, status, preço, desvio percentual e justificativa de exclusão;
- QR Code de autenticação contendo hash determinístico do snapshot revisado, versão do relatório e URL de conferência em `/pesquisa-precos/validar?id=<pesquisa>&auth=<hash>`;
- exportação em PDF/impressão, HTML, XLSX e CSV. No XLSX e CSV, instituição e servidores também são exportados em abas/arquivos próprios.

O módulo exibe média aritmética, mediana, menor preço, média ponderada, média saneada e preços excluídos do cálculo. A média ponderada usa a quantidade registrada na referência de preço como peso, quando disponível. A média saneada corresponde à média dos preços mantidos na cesta após as exclusões justificadas pelo usuário. Ao desconsiderar uma cotação, a interface exige justificativa objetiva antes de gravar a exclusão. A mediana é o método padrão inicial para o preço estimado. O uso de menos de três preços não é automatizado neste corte; casos excepcionais devem seguir justificativa e aprovação da autoridade competente fora do fluxo automático.

Na aba PNCP da curadoria, cotações oficiais não exibem colunas de frete nem de evidência. Quando a atualização monetária global é ativada pelo usuário, o espaço antes usado para frete passa a exibir somente o valor numérico do índice de atualização monetária aplicado a cada cotação. As abas de cotações de internet e fornecedores locais continuam exibindo frete, pois esse custo pode compor o preço comparável dessas fontes.

Referência normativa principal:

- IN SEGES/ME nº 65, de 7 de julho de 2021, especialmente arts. 3º a 6º.

## Verificação automática de irregularidades

O módulo executa uma análise determinística de apoio técnico sobre os dados disponíveis na própria pesquisa, sem consultar processos externos e sem substituir a revisão do agente responsável.

A verificação usa somente a IN SEGES/ME nº 65/2021 e gera achados estruturados com severidade, regra aplicada, evidência e ação recomendada. Achados bloqueantes impedem a conclusão do relatório; alertas podem permanecer quando houver justificativa registrada pelo usuário. Para pesquisas antigas com cotações já excluídas sem motivo, o achado de exclusão sem justificativa direciona o usuário para registrar a justificativa pendente.

Regras cobertas neste corte:

- ausência de objeto, responsável, fontes, série de preços, método, memória de cálculo ou justificativa metodológica;
- menos de três preços selecionados sem justificativa excepcional;
- exclusões sem justificativa;
- preços oficiais fora da janela de 1 ano;
- fontes de internet sem data/hora de acesso ou com mais de 6 meses;
- fornecedor direto sem dados mínimos ou justificativa de escolha;
- ausência de priorização de sistemas oficiais/contratações públicas sem justificativa;
- preço estimado acima da mediana quando a cesta selecionada usa somente sistema oficial;
- grande variação entre preços, preço outlier sem justificativa, unidade incompatível selecionada e busca oficial não executada.

## Persistência

- `price_researches`: metadados, responsável, método, observações, arquivo de origem, status, identificação institucional, logotipo e servidores do relatório.
- `price_research_items`: snapshot dos itens e candidatos oficiais usados na análise.

As políticas RLS permitem ao usuário autenticado acessar suas próprias pesquisas. Superadministradores podem acessar todos os registros.

## Validação por QR Code

O QR Code do relatório aponta para `/pesquisa-precos/validar`. A tela chama a Edge Function `validar-pesquisa-precos`, que carrega a pesquisa salva pelo `id` com service role, recompõe o mesmo snapshot usado no relatório e compara o hash recalculado com o parâmetro `auth`. O resultado mostra relatório autenticado quando os hashes coincidem e hash divergente quando o registro salvo foi alterado ou o link não corresponde à pesquisa. A function retorna apenas metadados mínimos e não expõe a cesta completa de preços.

## Implementação

- página: `src/pages/PesquisaPrecos.tsx`
- parser, estatística e relatório: `src/lib/priceResearch.ts`
- normalização e ranking dos catálogos: `src/lib/priceCatalog.ts`
- cliente e processamento em segundo plano: `src/lib/priceCatalogClient.ts` e `src/lib/priceCatalog.worker.ts`
- geração dos catálogos compactados: `scripts/generate-price-catalogs.mjs`
- persistência e chamada da function: `src/services/priceResearch.ts`
- Edge Function: `supabase/functions/pesquisar-precos/index.ts`
- migration: `supabase/migrations/20260609150000_create_price_research_module.sql`

## Limites operacionais

- máximo de 25 itens por chamada;
- até 15 candidatos por item;
- consultas externas processadas em grupos de três;
- a consulta de preços depende de código CATMAT/CATSER válido e confirmado; quando ausente, o sistema sugere alternativas;
- o primeiro carregamento do CATMAT transfere aproximadamente 8,5 MB compactados e fica em cache durante a sessão;
- a disponibilidade e a qualidade dos registros variam conforme a base oficial;
- o relatório não representa parecer jurídico ou aprovação automática da contratação.
