# Pesquisa de Preços

## Objetivo

O módulo `/pesquisa-precos` transforma uma planilha de itens em uma cesta auditável de preços públicos. O fluxo:

1. importa e normaliza os itens no navegador;
2. consulta preços homologados dos últimos 12 meses;
3. apresenta até 15 referências por item;
4. permite seleção e exclusão com justificativa;
5. calcula média, mediana, mínimo, máximo, desvio padrão e coeficiente de variação;
6. salva a pesquisa e gera relatório com memória de cálculo.

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
- identificação CATMAT/CATSER;
- ao menos três preços selecionados por item;
- justificativa para cada preço excluído;
- justificativa do método estatístico;
- memória de cálculo e identificação das fontes.

O módulo oferece média, mediana e menor preço. A mediana é o padrão inicial. O uso de menos de três preços não é automatizado neste corte; casos excepcionais devem seguir justificativa e aprovação da autoridade competente fora do fluxo automático.

Referência normativa principal:

- IN SEGES/ME nº 65, de 7 de julho de 2021, especialmente arts. 3º a 6º.

## Persistência

- `price_researches`: metadados, responsável, método, observações, arquivo de origem e status.
- `price_research_items`: snapshot dos itens e candidatos oficiais usados na análise.

As políticas RLS permitem ao usuário autenticado acessar suas próprias pesquisas. Superadministradores podem acessar todos os registros.

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
