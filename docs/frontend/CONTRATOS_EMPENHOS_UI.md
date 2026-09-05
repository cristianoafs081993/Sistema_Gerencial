# Consulta de contratos e empenhos

A revisão visual de setembro de 2026 reorganiza exclusivamente os módulos
`/contratos` e `/empenhos`. O dashboard, as rotas de autenticação, os serviços,
as políticas de acesso e o esquema do banco não foram alterados.

## Listas

- Empenhos usa `FilterPanel`, `DataTablePanel` e `TablePagination`. Número da NE
  e ação de inspeção abrem o detalhe. Empenhado, liquidado, pago e saldo a
  liquidar têm colunas separadas, com valores integrais em reais.
- RAP permanece em uma aba própria: inscrito/reinscrito, liquidado no ano e
  saldo atual. Agrupamento por favorecido e seus totais continuam disponíveis.
- A busca de empenhos passa a incluir processo e plano interno, além dos
  critérios anteriores.
- Contratos apresenta objeto, contratada, datas rotuladas e prazo restante.
  Valor global do instrumento não é comparado percentualmente com a execução
  do campus. Os valores e saldos de empenhos continuam usando os vínculos e
  a preferência SIAFI local já existentes; o saldo pode incluir RAP.
- Os vínculos de NE foram movidos para a tabela do detalhe. A lista mostra sua
  quantidade. Faturas pendentes usam um badge estático com quantidade em
  português. Há filtros por vencimento em até 90 dias e faturas pendentes,
  preservando favoritos e vencidos nos últimos 120 dias. A busca inclui objeto.
- `contractPresentation.ts` trata vigência como data civil, inclusive quando
  recebida como ISO ou `Date`, sem deslocá-la pelo fuso horário do navegador.
  No detalhe são usadas as mesmas datas derivadas apresentadas na lista.

## Detalhes no shell existente

`presentation="page"` é opt-in em `EmpenhoDialog` e
`ContratoApiDetailsSheet`. Os demais consumidores continuam usando o modal
padrão. `RecordDetailsPage` fornece retorno, foco inicial e restauração do foco
e da rolagem. A lista fica montada e oculta durante a inspeção, preservando
busca, filtros, agrupamento e paginação. Esta navegação é interna ao módulo;
não introduz uma nova URL de detalhe nem persistência após recarregar a página.

- Empenhos: **Resumo** e **Itens e histórico**. O resumo inclui valores,
  favorecido, processo, classificação e atividade vinculada quando informada.
  A edição estratégica exige ação explícita; cancelar descarta o rascunho.
  Consultas de itens, histórico e liquidações reutilizam os serviços existentes.
- Contratos: **Resumo e empenhos**, **Faturas e pagamentos** e **Vigência e
  documentos**. Itens, agrupamentos de faturas, termos, documentos PNCP e
  rastreabilidade de notas fiscais permanecem disponíveis nas respectivas abas.
- Os KPIs financeiros do contrato usam o mesmo valor global e os mesmos
  cálculos de execução/saldo da lista. Cada NE distingue base RAP de empenhado
  e informa a fonte local/API. Empenhos existentes no contexto local podem ser
  inspecionados a partir do contrato em modo somente leitura; referências
  exclusivas da API mantêm seus valores e fonte na tabela.
- Falha ao carregar os detalhes do contrato apresenta mensagem e ação de nova
  tentativa, em vez de se confundir com ausência de itens.

## Validação

Os testes de páginas e componentes cobrem valores, preferência SIAFI sobre API,
RAP com saldo zero, exclusão de NE de outra unidade, favoritos, busca, retorno
à lista, abas, edição explícita, cancelamento e nova tentativa. As datas são
testadas com ISO, `Date`, entradas inválidas e limites de dias civis.

```sh
npm test -- src/pages/__tests__/Empenhos.test.tsx src/pages/__tests__/Contratos.test.tsx src/pages/__tests__/ContratosRegression.test.tsx src/components/modals/__tests__/EmpenhoDialog.test.tsx src/components/__tests__/EmpenhoDialog.test.tsx src/components/contratos/__tests__/ContratoApiDetailsSheet.test.tsx src/utils/__tests__/contractPresentation.test.ts src/__tests__/encoding.test.ts
TZ=America/Fortaleza npm test -- src/utils/__tests__/contractPresentation.test.ts
npm run build
```
