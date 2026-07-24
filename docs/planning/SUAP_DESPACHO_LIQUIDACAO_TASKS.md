# Tasks: Despacho de Liquidacao no SUAP

Status: `[-]` em andamento | `[ ]` pendente | `[x]` concluida e validada | `[!]` bloqueada

## 1. Baseline e contratos

- [x] Registrar baseline e criar os contratos do fluxo local.
  - Teste: suites existentes de SUAP, gerador e clonagem.
  - Evidencia: 35 testes existentes passaram em 2026-07-24.

## 2. Estado da fila

- [x] Criar estado persistido da fila de despachos em `sessionStorage`.
  - Teste: serializacao, restauracao e descarte.
  - Evidencia: fila, restauracao, descarte e payload invalido cobertos em suapDispatchGeneration.test.ts.

## 3. Acoes da tabela

- [x] Adicionar geracao individual e em lote na tabela SUAP.
  - Teste: selecao filtrada, menu e acao desabilitada sem selecao.
  - Evidencia: acoes conectadas aos processos visiveis selecionados.

## 4. Dialogo de geracao

- [x] Implementar dialogo embutido com modos assistido e manual.
  - Teste: IA completa, IA parcial com marcadores e formulario manual.
  - Evidencia: modos IA completa, parcial e manual cobertos no teste do dialogo.

## 5. Fila, copia e clonagem

- [x] Implementar navegacao da fila, copia e clonagem por documento.
  - Teste: avancar, voltar, pular, HTML editado e modos de clonagem.
  - Evidencia: navegacao, pulo, copia e clonagem do HTML editado cobertos.

## 6. Teste de ponta e documentacao

- [x] Cobrir fluxo principal, secundarios e excecoes em teste integrado.
  - Teste: lote misto, recuperacao de sessao, processo indisponivel e falhas de operacao.
  - Evidencia: lote misto, restauracao de sessao e processo ausente cobertos nas suites novas.

- [x] Atualizar a documentacao operacional e rodar validacao final.
  - Teste: TypeScript, testes focados, lint focado, encoding e build.
  - Evidencia: `npx tsc --noEmit`, 49 testes de regressao focados, lint focado, teste de encoding e `npm run build` passaram em 2026-07-24. `npm run check:docs` exige refs Git de base e destino e nao avalia mudancas locais ainda nao commitadas; DATA_FLOW e API_CATALOG foram revisados manualmente.
## 7. Edicao no SUAP

- [x] Substituir a previa `contentEditable` pelo editor rico compartilhado e preservar a edicao durante a sincronizacao da fila.
  - Teste: digitacao sequencial, formatacao, copia e clonagem do HTML alterado.
  - Evidencia: RichTextEditor cobre toolbar acessivel e placeholders em vermelho; dialogo cobre a persistencia do HTML editado para copia e clonagem. TypeScript, lint focado, encoding, build e 53 testes de regressao passaram em 2026-07-24.