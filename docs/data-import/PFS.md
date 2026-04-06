# PFS

## Objetivo

Importar duas bases de PFs, correlacionar solicitacao, aprovacao e liberacao, gravar no banco e alimentar rastreabilidade e views de controle.

## Ponto de entrada

- pagina: [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)
- dialogo: [PFImportDialog.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/modals/PFImportDialog.tsx)
- service: [pfImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pfImportService.ts)
- leitura da view final: [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)
- tipos: [pfs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/types/pfs.ts)

## Arquivos usados

### Arquivo 1

- solicitacoes do campus
- aceito pelo service como `.xlsx`, `.xls` ou `.csv`

### Arquivo 2

- aprovacoes/liberacoes da reitoria
- aceito pelo service como `.xlsx`, `.xls` ou `.csv`

## Regras de leitura

### Solicitacoes

- usa a primeira aba
- considera que:
  - a linha 6 contem os headers
  - os dados comecam na linha 7
- filtra `PF - Acao` igual a `1` ou `2`

### Aprovacoes e liberacoes

- tenta usar a aba `PFs`
- se nao existir, cai para a primeira aba
- depois classifica por `PF - Acao`

## Transformacoes importantes

- `numero_pf` e sanitizado por `parseNumeroPF`
- valores monetarios passam por `cleanValor`
- datas passam por `safeFormatDate`
- a correlacao principal e feita por:
  - valor
  - tipo derivado do evento
  - ordem temporal

## Eventos relevantes

- solicitacao: `591292`, `591296`
- cancelamento: `596292`, `596296`
- aprovacao: `591290`, `591294`
- liberacao: `561611`, `561618`, `701230`, `701330`

## Destino no banco

- `pf_fonte_recurso`
- `pf_solicitacao`
- `pf_aprovacao`
- `pf_liberacao`

## Views consumidas depois

- `vw_controle_pfs_pendentes`
- `vw_documentos_pendentes_pagamento`
- `vw_rastreabilidade_pf`

## Arquivos de exemplo

- [PFs.xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/PFs.xlsx)
- [PFs - liberacao de recurso.xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/PFs%20-%20libera%C3%A7%C3%A3o%20de%20recurso.xlsx)
- [rastreabilidade_pf_3.xlsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/rastreabilidade_pf_3.xlsx)

## Riscos e observacoes

- a regra de correlacao e de negocio, nao apenas tecnica
- a view `vw_rastreabilidade_pf` e usada no frontend, mas precisa ser confirmada como versionada no banco
- este fluxo merece documentacao futura com exemplos de headers reais e mapeamento coluna -> campo
