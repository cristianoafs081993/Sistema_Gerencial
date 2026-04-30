# RETENCOES_EFD_REINF

## Objetivo

Importar base de retencoes FD-Reinf, persistir a carga e auditar inconsistencias de UG pagadora e prazo.

## Ponto de entrada

- pagina: [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
- service: [retencoesEfdReinfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/retencoesEfdReinfImportService.ts)
- teste: [retencoesEfdReinfImportService.test.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/__tests__/retencoesEfdReinfImportService.test.ts)

## Arquivos aceitos de fato

- `.csv`

## Divergencia conhecida

A UI atual aceita selecionar `.xlsx` e `.xls`, mas o parser atual lanca erro para XLSX:

- mensagem: `Arquivos XLSX ainda nao foram habilitados para este modulo.`

Este ponto deve ser tratado como debito de documentacao e de UX.

## Regras de leitura

- tenta detectar UTF-16LE, UTF-16BE, UTF-8 e Latin-1
- normaliza fim de linha
- faz split por `tab`
- procura o cabecalho pela presenca de:
  - `documento habil`
  - `dh - situacao`

## Campos produzidos

- `id` quando carregado do banco
- `documentoHabil`
- `dhProcesso`
- `dhEstado`
- `dhUgPagadora`
- `dhItemUgPagadora`
- `dhCredorDocumento`
- `dhCredorNome`
- `dhSituacao`
- `dhDataEmissaoDocOrigem`
- `dhDiaPagamento`
- `dhItemDiaVencimento`
- `dhItemDiaPagamento`
- `dhItemLiquidado`
- `dhValorDocOrigem`
- `metrica`
- `valorRetencao`
- `correcaoRealizada` quando carregado do banco

## Validacoes de negocio

### Critica

- `DH Item - UG Pagadora` deve ser `158155`
- linhas com `DH - Situacao` igual a `DDR001` ou `DGR001` sao ignoradas nessa critica de UG

### Aviso

- `DDF025`: vencimento e pagamento devem ocorrer no dia 20 do mes seguinte ao `Dia Lancamento` da OB de pagamento vinculada a NP em `documentos_habeis_itens`
  - a OB de pagamento e a primeira OB cuja observacao indique pagamento principal, como `PGTO` ou `PAGAMENTO`, ignorando retencoes quando identificaveis
  - a tela exibe o numero da OB escolhida junto da data usada no calculo
  - se nao houver OB de pagamento vinculada a NP, a linha fica em alerta porque nao ha data-base confiavel para calcular o vencimento esperado
- `DDF021`: vencimento e pagamento devem ocorrer no dia 20 do mes seguinte a `DH - Data Emissao Doc.Origem`

## Tratamento de pendencias

- a coluna `correcao_realizada` permite marcar uma linha com alerta como corrigida
- itens corrigidos deixam de contar nas pendencias abertas e saem dos filtros de critica/prazo pendentes
- o alerta original continua visivel no registro para preservar a trilha de auditoria
- enquanto a migration da coluna ainda nao estiver aplicada no ambiente remoto, o frontend usa fallback em `localStorage` para nao quebrar a tela; essa marcacao local nao substitui a persistencia definitiva no banco

## Destino no banco

- tabela: `retencoes_efd_reinf`
- coluna operacional manual:
  - `correcao_realizada`
- chave de upsert:
  - `documento_habil,dh_processo,dh_situacao,dh_credor_documento,dh_dia_pagamento,valor_retencao`

## Arquivos de exemplo

- [Relatorio (3).xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Relatorio%20(3).xlsx)
- [Relatorio (4).xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Relatorio%20(4).xlsx)

## Riscos e observacoes

- os exemplos do repositorio sao XLSX, mas o parser atual esta travado em CSV
- isso e um dos pontos mais importantes para documentar antes de qualquer manutencao futura
