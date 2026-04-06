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

## Validacoes de negocio

### Critica

- `DH Item - UG Pagadora` deve ser `158155`

### Aviso

- `DDF025`: vencimento e pagamento devem ocorrer no dia 20 do mes seguinte a `DH - Dia Pagamento`
- `DDF021`: vencimento e pagamento devem ocorrer no dia 20 do mes seguinte a `DH - Data Emissao Doc.Origem`

## Destino no banco

- tabela: `retencoes_efd_reinf`
- chave de upsert:
  - `documento_habil,dh_processo,dh_situacao,dh_credor_documento,dh_dia_pagamento,valor_retencao`

## Arquivos de exemplo

- [Relatorio (3).xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Relatorio%20(3).xlsx)
- [Relatorio (4).xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/Relatorio%20(4).xlsx)

## Riscos e observacoes

- os exemplos do repositorio sao XLSX, mas o parser atual esta travado em CSV
- isso e um dos pontos mais importantes para documentar antes de qualquer manutencao futura
